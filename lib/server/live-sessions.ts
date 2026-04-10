import { buildArchiveFilter } from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";
import { resolveTeacherCourseScope } from "@/lib/courses/access";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  buildLiveSessionNotificationEntityId,
  didLiveSessionScheduleChange,
  filterEligibleLiveSessionTeachers,
  isLiveSessionJoinable,
  normalizeLiveSessionDate,
} from "@/lib/live-sessions/shared";
import type {
  LiveSessionAttendanceStatus,
  LiveSessionSupportTeacher,
  LiveSessionWorkspaceSupportData,
  StudentLiveSessionDetail,
  StudentLiveSessionSummary,
  WorkspaceLiveSessionDetail,
  WorkspaceLiveSessionSummary,
} from "@/lib/live-sessions/types";
import {
  listStudentIdsInScope,
  normalizeId as normalizeScopedStudentId,
} from "@/lib/server/student-notification-delivery";
import {
  createLiveSessionCancelledNotifications,
  createLiveSessionScheduledNotifications,
  markStudentNotificationJobsSuperseded,
} from "@/lib/server/student-notifications";
import { invalidateStudentDashboardCacheForStudents } from "@/lib/server/student-dashboard-cache";
import { getWorkspaceClasses, getWorkspaceSections, getWorkspaceSubjects } from "@/lib/server/workspace-support-data";
import {
  createMockLiveSession,
  deleteMockLiveSession,
  getMockLiveSessionAudienceStudentIds,
  getMockLiveSessionSupportData,
  getMockStudentLiveSessionDetail,
  getMockWorkspaceLiveSessionDetail,
  listMockStudentLiveSessions,
  listMockWorkspaceLiveSessions,
  recordMockStudentLiveSessionJoin,
  updateMockLiveSession,
  updateMockLiveSessionAttendance,
} from "@/lib/test-fixtures/live-sessions";
import { isMockedE2ETestMode } from "@/lib/test-mode";

export type WorkspaceLiveSessionFilters = {
  status?: string;
  classId?: string;
  subjectId?: string;
  hostTeacherId?: string;
};

export type LiveSessionWriteInput = {
  title: string;
  description?: string | null;
  classId: string;
  subjectId: string;
  assignedAcademicSectionIds: string[];
  hostTeacherId: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  studentJoinUrl: string;
  hostJoinUrl?: string | null;
  meetingCode?: string | null;
  meetingPasscode?: string | null;
  joinInstructions?: string | null;
  status: "draft" | "scheduled";
};

type LiveSessionViewerRole = "admin" | "teacher";

type LiveSessionAttendanceUpdate = {
  studentId: string;
  status: LiveSessionAttendanceStatus;
};

class LiveSessionHttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "LiveSessionHttpError";
    this.status = status;
  }
}

function throwLiveSessionError(message: string, status = 400): never {
  throw new LiveSessionHttpError(message, status);
}

export function getLiveSessionErrorStatus(error: unknown) {
  const status = Number(
    error &&
      typeof error === "object" &&
      "status" in error
      ? (error as { status?: unknown }).status
      : 0,
  );

  if (Number.isFinite(status) && status >= 400 && status < 600) {
    return status;
  }

  return 500;
}

function toId(value: unknown) {
  if (!value) {
    return "";
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "_id" in (value as Record<string, unknown>)
  ) {
    return String((value as Record<string, unknown>)._id || "").trim();
  }

  return String(value || "").trim();
}

function uniqueIds(value: unknown) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  );
}

function toOptionalString(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function toIsoOrNull(value: unknown) {
  const date = normalizeLiveSessionDate(value);
  return date ? date.toISOString() : null;
}

function normalizeLiveSessionStatusInput(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "scheduled" ? "scheduled" : "draft";
}

function normalizeAttendanceStatus(value: unknown): LiveSessionAttendanceStatus {
  const normalized = String(value || "").trim().toLowerCase();

  if (
    normalized === "joined" ||
    normalized === "present" ||
    normalized === "absent"
  ) {
    return normalized;
  }

  return "invited";
}

export function normalizeLiveSessionWriteInput(
  input: Record<string, unknown>,
): LiveSessionWriteInput {
  const scheduledStartAt = normalizeLiveSessionDate(input?.scheduledStartAt);
  const scheduledEndAt = normalizeLiveSessionDate(input?.scheduledEndAt);

  if (!scheduledStartAt || !scheduledEndAt) {
    throwLiveSessionError(
      "Add a valid start and end time for the live class.",
      400,
    );
  }

  const normalizedInput: LiveSessionWriteInput = {
    title: String(input?.title || "").trim(),
    description: toOptionalString(input?.description),
    classId: String(input?.classId || "").trim(),
    subjectId: String(input?.subjectId || "").trim(),
    assignedAcademicSectionIds: uniqueIds(input?.assignedAcademicSectionIds),
    hostTeacherId: String(input?.hostTeacherId || "").trim(),
    scheduledStartAt,
    scheduledEndAt,
    studentJoinUrl: String(input?.studentJoinUrl || "").trim(),
    hostJoinUrl: toOptionalString(input?.hostJoinUrl),
    meetingCode: toOptionalString(input?.meetingCode),
    meetingPasscode: toOptionalString(input?.meetingPasscode),
    joinInstructions: toOptionalString(input?.joinInstructions),
    status: normalizeLiveSessionStatusInput(input?.status),
  };

  if (!normalizedInput.title) {
    throwLiveSessionError("Live class title is required.", 400);
  }

  if (!normalizedInput.classId || !normalizedInput.subjectId) {
    throwLiveSessionError("Class and subject are required.", 400);
  }

  if (!normalizedInput.hostTeacherId) {
    throwLiveSessionError("Select a host teacher for this live class.", 400);
  }

  if (!normalizedInput.studentJoinUrl) {
    throwLiveSessionError(
      "Add the student meeting link before scheduling the live class.",
      400,
    );
  }

  if (
    normalizedInput.scheduledEndAt.getTime() <=
    normalizedInput.scheduledStartAt.getTime()
  ) {
    throwLiveSessionError(
      "Live class end time must be after the start time.",
      400,
    );
  }

  [normalizedInput.studentJoinUrl, normalizedInput.hostJoinUrl]
    .filter((value): value is string => Boolean(value))
    .forEach((value) => {
      try {
        const parsed = new URL(value);
        if (!/^https?:$/i.test(parsed.protocol)) {
          throw new Error("Invalid live-session URL protocol.");
        }
      } catch {
        throwLiveSessionError(
          "Meeting links must be valid http or https URLs.",
          400,
        );
      }
    });

  return normalizedInput;
}

function mapClassSummary(value: any) {
  if (!value) return null;
  const id = toId(value);
  if (!id) return null;

  return {
    _id: id,
    name: String(value?.name || "").trim() || id,
  };
}

function mapSubjectSummary(value: any) {
  if (!value) return null;
  const id = toId(value);
  if (!id) return null;

  return {
    _id: id,
    name: String(value?.name || "").trim() || id,
  };
}

function mapSectionSummary(value: any) {
  const id = toId(value);
  if (!id) return null;

  return {
    _id: id,
    name: String(value?.name || "").trim() || id,
    class:
      value?.class && typeof value.class === "object"
        ? mapClassSummary(value.class)
        : null,
  };
}

function mapTeacherSummary(value: any) {
  const id = toId(value);
  if (!id) {
    return null;
  }

  return {
    _id: id,
    name: String(value?.name || "").trim() || id,
  };
}

function mapSupportTeacher(value: any): LiveSessionSupportTeacher | null {
  const id = toId(value);
  if (!id) {
    return null;
  }

  return {
    _id: id,
    name: String(value?.name || "").trim() || id,
    classIds: uniqueIds(value?.classIds),
    academicSectionIds: uniqueIds(value?.academicSectionIds),
    subjectIds: uniqueIds(value?.subjectIds),
    hasAllClasses: Boolean(value?.hasAllClasses),
    hasAllSections:
      typeof value?.hasAllSections === "boolean" ? value.hasAllSections : true,
    hasAllSubjects: Boolean(value?.hasAllSubjects),
  };
}

function serializeAttendanceSummary(value: any) {
  const student = value?.student;
  const markedBy = value?.markedBy;

  return {
    studentId: toId(student),
    studentName: String(student?.name || "").trim() || "Student",
    rollNumber: toOptionalString(student?.rollNumber),
    academicSectionName:
      student?.academicSection && typeof student.academicSection === "object"
        ? toOptionalString(student.academicSection?.name)
        : null,
    joinClicks: Number(value?.joinClicks || 0),
    firstJoinedAt: toIsoOrNull(value?.firstJoinedAt),
    lastJoinedAt: toIsoOrNull(value?.lastJoinedAt),
    status: normalizeAttendanceStatus(value?.status),
    markedByName: toOptionalString(markedBy?.name),
    markedAt: toIsoOrNull(value?.markedAt),
  };
}

function serializeWorkspaceDetail(
  liveSession: any,
  attendance: any[],
): WorkspaceLiveSessionDetail {
  const attendanceSummaries = (Array.isArray(attendance) ? attendance : [])
    .map(serializeAttendanceSummary)
    .sort((left, right) =>
      `${left.studentName} ${left.rollNumber || ""}`.localeCompare(
        `${right.studentName} ${right.rollNumber || ""}`,
      ),
    );

  return {
    _id: toId(liveSession?._id),
    title: String(liveSession?.title || "").trim(),
    description: String(liveSession?.description || "").trim(),
    class: mapClassSummary(liveSession?.class),
    subject: mapSubjectSummary(liveSession?.subject),
    assignedAcademicSections: (Array.isArray(liveSession?.assignedAcademicSections)
      ? liveSession.assignedAcademicSections
      : []
    )
      .map(mapSectionSummary)
      .filter(Boolean) as WorkspaceLiveSessionDetail["assignedAcademicSections"],
    hostTeacher: mapTeacherSummary(liveSession?.hostTeacher),
    status: (String(liveSession?.status || "draft").trim() ||
      "draft") as WorkspaceLiveSessionDetail["status"],
    scheduledStartAt: toIsoOrNull(liveSession?.scheduledStartAt),
    scheduledEndAt: toIsoOrNull(liveSession?.scheduledEndAt),
    startedAt: toIsoOrNull(liveSession?.startedAt),
    endedAt: toIsoOrNull(liveSession?.endedAt),
    cancelledAt: toIsoOrNull(liveSession?.cancelledAt),
    cancelReason: toOptionalString(liveSession?.cancelReason),
    notificationRevision: Math.max(
      0,
      Math.trunc(Number(liveSession?.notificationRevision || 0)),
    ),
    createdAt: toIsoOrNull(liveSession?.createdAt),
    updatedAt: toIsoOrNull(liveSession?.updatedAt),
    audienceCount: attendanceSummaries.length,
    joinedCount: attendanceSummaries.filter((item) => item.joinClicks > 0).length,
    presentCount: attendanceSummaries.filter((item) => item.status === "present")
      .length,
    absentCount: attendanceSummaries.filter((item) => item.status === "absent")
      .length,
    studentJoinUrl: String(liveSession?.studentJoinUrl || "").trim(),
    hostJoinUrl: toOptionalString(liveSession?.hostJoinUrl),
    meetingCode: toOptionalString(liveSession?.meetingCode),
    meetingPasscode: toOptionalString(liveSession?.meetingPasscode),
    joinInstructions: toOptionalString(liveSession?.joinInstructions),
    attendance: attendanceSummaries,
  };
}

function serializeWorkspaceSummaryFromDetail(
  detail: WorkspaceLiveSessionDetail,
): WorkspaceLiveSessionSummary {
  return {
    _id: detail._id,
    title: detail.title,
    description: detail.description,
    class: detail.class,
    subject: detail.subject,
    assignedAcademicSections: detail.assignedAcademicSections,
    hostTeacher: detail.hostTeacher,
    status: detail.status,
    scheduledStartAt: detail.scheduledStartAt,
    scheduledEndAt: detail.scheduledEndAt,
    startedAt: detail.startedAt,
    endedAt: detail.endedAt,
    cancelledAt: detail.cancelledAt,
    cancelReason: detail.cancelReason,
    notificationRevision: detail.notificationRevision,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    audienceCount: detail.audienceCount,
    joinedCount: detail.joinedCount,
    presentCount: detail.presentCount,
    absentCount: detail.absentCount,
  };
}

function serializeStudentSummary(
  liveSession: WorkspaceLiveSessionDetail,
  studentAttendance: WorkspaceLiveSessionDetail["attendance"][number] | null,
): StudentLiveSessionSummary {
  const canJoin = isLiveSessionJoinable({
    status: liveSession.status,
    scheduledEndAt: liveSession.scheduledEndAt,
  });

  return {
    _id: liveSession._id,
    title: liveSession.title,
    description: liveSession.description,
    class: liveSession.class,
    subject: liveSession.subject,
    assignedAcademicSections: liveSession.assignedAcademicSections,
    hostTeacher: liveSession.hostTeacher,
    status: liveSession.status,
    scheduledStartAt: liveSession.scheduledStartAt,
    scheduledEndAt: liveSession.scheduledEndAt,
    startedAt: liveSession.startedAt,
    endedAt: liveSession.endedAt,
    cancelledAt: liveSession.cancelledAt,
    cancelReason: liveSession.cancelReason,
    notificationRevision: liveSession.notificationRevision,
    createdAt: liveSession.createdAt,
    updatedAt: liveSession.updatedAt,
    joinInstructions: liveSession.joinInstructions,
    meetingCode: liveSession.meetingCode,
    meetingPasscode: liveSession.meetingPasscode,
    attendanceStatus: studentAttendance?.status || null,
    joinClicks: Number(studentAttendance?.joinClicks || 0),
    canJoin,
    joinHref: `/api/student/live-sessions/${liveSession._id}/join`,
  };
}

function resolveStudentJoinUrlLabel(url: string) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./i, "");
    return hostname ? `Join via ${hostname}` : "Join live class";
  } catch {
    return "Join live class";
  }
}

function sortLiveSessions(left: { status: string; scheduledStartAt?: string | null }, right: {
  status: string;
  scheduledStartAt?: string | null;
}) {
  const rank = (value: string) => {
    if (value === "live") return 0;
    if (value === "scheduled") return 1;
    if (value === "draft") return 2;
    if (value === "completed") return 3;
    return 4;
  };

  const rankDiff = rank(String(left.status || "")) - rank(String(right.status || ""));
  if (rankDiff !== 0) {
    return rankDiff;
  }

  const leftTime = normalizeLiveSessionDate(left.scheduledStartAt)?.getTime() ||
    Number.POSITIVE_INFINITY;
  const rightTime = normalizeLiveSessionDate(right.scheduledStartAt)?.getTime() ||
    Number.POSITIVE_INFINITY;

  return leftTime - rightTime;
}

async function getTeacherScopedUser(schoolKey: string, userId: string) {
  const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
  return UserModel.findById(userId)
    .select(
      "name role hasAllClasses classIds hasAllSections academicSectionIds hasAllSubjects subjectIds",
    )
    .lean();
}

function filterClassesByTeacherScope(classes: any[], scopedUser: any) {
  if (scopedUser?.hasAllClasses) {
    return classes;
  }

  const allowedClassIds = new Set(uniqueIds(scopedUser?.classIds));
  return classes.filter((item) => allowedClassIds.has(String(item?._id || "")));
}

function filterSectionsByTeacherScope(sections: any[], scopedUser: any) {
  const allowedClassIds = new Set(uniqueIds(scopedUser?.classIds));
  const allowedSectionIds = new Set(uniqueIds(scopedUser?.academicSectionIds));

  return sections.filter((section) => {
    const sectionClassId = toId(section?.class);
    if (!scopedUser?.hasAllClasses && !allowedClassIds.has(sectionClassId)) {
      return false;
    }

    if (scopedUser?.hasAllSections) {
      return true;
    }

    return allowedSectionIds.has(String(section?._id || "").trim());
  });
}

function validateTeacherLiveSessionScope(params: {
  scopedUser: any;
  classId: string;
  subjectId: string;
  assignedAcademicSectionIds: string[];
}) {
  const scope = resolveTeacherCourseScope(
    params.scopedUser,
    params.classId,
    [params.subjectId],
    params.assignedAcademicSectionIds,
  );

  if (!scope.hasClassAccess || !scope.hasSectionAccess || !scope.hasFullSubjectAccess) {
    return false;
  }

  if (scope.allowedSectionIds !== null && params.assignedAcademicSectionIds.length === 0) {
    return false;
  }

  if (scope.allowedSectionIds !== null) {
    return params.assignedAcademicSectionIds.every((sectionId) =>
      scope.allowedSectionIds!.includes(sectionId),
    );
  }

  return true;
}

async function getSupportTeachers(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
}) {
  const { User: UserModel } = await getTenantModels(params.schoolKey, ["User"]);
  const query: Record<string, any> = {
    role: "teacher",
    ...buildArchiveFilter(false),
  };

  if (params.viewerRole === "teacher") {
    query._id = params.viewerId;
  }

  const teachers = await UserModel.find(query)
    .select(
      "name hasAllClasses classIds hasAllSections academicSectionIds hasAllSubjects subjectIds",
    )
    .sort({ name: 1, _id: 1 })
    .lean();

  return teachers
    .map(mapSupportTeacher)
    .filter(
      (teacher): teacher is LiveSessionSupportTeacher => Boolean(teacher),
    );
}

async function validateLiveSessionWriteDependencies(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  input: LiveSessionWriteInput;
}) {
  const {
    Class: ClassModel,
    Subject: SubjectModel,
    AcademicSection: AcademicSectionModel,
    User: UserModel,
  } = await getTenantModels(params.schoolKey, [
    "Class",
    "Subject",
    "AcademicSection",
    "User",
  ]);

  const [selectedClass, selectedSubject, selectedSections, hostTeacher, supportTeachers] =
    await Promise.all([
      ClassModel.findOne({
        _id: params.input.classId,
        ...buildArchiveFilter(false),
      })
        .select("_id name")
        .lean(),
      SubjectModel.findOne({
        _id: params.input.subjectId,
        ...buildArchiveFilter(false),
      })
        .select("_id name")
        .lean(),
      params.input.assignedAcademicSectionIds.length > 0
        ? AcademicSectionModel.find({
            _id: { $in: params.input.assignedAcademicSectionIds },
            class: params.input.classId,
            isActive: true,
            ...buildArchiveFilter(false),
          })
            .select("_id")
            .lean()
        : Promise.resolve([]),
      UserModel.findOne({
        _id: params.input.hostTeacherId,
        role: "teacher",
        ...buildArchiveFilter(false),
      })
        .select(
          "name hasAllClasses classIds hasAllSections academicSectionIds hasAllSubjects subjectIds",
        )
        .lean(),
      getSupportTeachers({
        schoolKey: params.schoolKey,
        viewerRole: params.viewerRole === "teacher" ? "teacher" : "admin",
        viewerId: params.viewerId,
      }),
    ]);

  if (!selectedClass || !selectedSubject) {
    throwLiveSessionError(
      "Select a valid class and subject before saving the live class.",
      400,
    );
  }

  if (
    selectedSections.length !== params.input.assignedAcademicSectionIds.length
  ) {
    throwLiveSessionError(
      "Assigned sections must be active and belong to the selected class.",
      400,
    );
  }

  if (!hostTeacher) {
    throwLiveSessionError("Select a valid host teacher.", 400);
  }

  if (params.viewerRole === "teacher") {
    if (params.input.hostTeacherId !== params.viewerId) {
      throwLiveSessionError(
        "Teachers can only host live classes as themselves.",
        403,
      );
    }

    const scopedUser = await getTeacherScopedUser(
      params.schoolKey,
      params.viewerId,
    );

    if (
      !validateTeacherLiveSessionScope({
        scopedUser,
        classId: params.input.classId,
        subjectId: params.input.subjectId,
        assignedAcademicSectionIds: params.input.assignedAcademicSectionIds,
      })
    ) {
      throwLiveSessionError(
        "You can only manage live classes inside your assigned class, subject, and section scope.",
        403,
      );
    }
  }

  const eligibleTeachers = filterEligibleLiveSessionTeachers({
    teachers: supportTeachers,
    classId: params.input.classId,
    subjectId: params.input.subjectId,
    assignedAcademicSectionIds: params.input.assignedAcademicSectionIds,
  });

  if (
    !eligibleTeachers.some(
      (teacher) => teacher._id === params.input.hostTeacherId,
    )
  ) {
    throwLiveSessionError(
      "The selected host teacher does not cover this class, subject, and section scope.",
      400,
    );
  }
}

async function loadWorkspaceLiveSessionRows(params: {
  schoolKey: string;
  filters?: WorkspaceLiveSessionFilters;
}) {
  const {
    LiveSession: LiveSessionModel,
    Class: ClassModel,
    Subject: SubjectModel,
    AcademicSection: AcademicSectionModel,
    User: UserModel,
  } = await getTenantModels(params.schoolKey, [
    "LiveSession",
    "Class",
    "Subject",
    "AcademicSection",
    "User",
  ]);

  const query: Record<string, any> = {};

  if (params.filters?.status) {
    query.status = params.filters.status;
  }
  if (params.filters?.classId) {
    query.class = params.filters.classId;
  }
  if (params.filters?.subjectId) {
    query.subject = params.filters.subjectId;
  }
  if (params.filters?.hostTeacherId) {
    query.hostTeacher = params.filters.hostTeacherId;
  }

  return LiveSessionModel.find(query)
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({ path: "subject", model: SubjectModel, select: "name" })
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      select: "name class",
      populate: {
        path: "class",
        model: ClassModel,
        select: "name",
      },
    })
    .populate({ path: "hostTeacher", model: UserModel, select: "name" })
    .sort({ scheduledStartAt: 1, createdAt: -1 })
    .lean();
}

async function loadWorkspaceLiveSessionDetailRow(params: {
  schoolKey: string;
  liveSessionId: string;
}) {
  const {
    LiveSession: LiveSessionModel,
    Class: ClassModel,
    Subject: SubjectModel,
    AcademicSection: AcademicSectionModel,
    User: UserModel,
  } = await getTenantModels(params.schoolKey, [
    "LiveSession",
    "Class",
    "Subject",
    "AcademicSection",
    "User",
  ]);

  return LiveSessionModel.findById(params.liveSessionId)
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({ path: "subject", model: SubjectModel, select: "name" })
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      select: "name class",
      populate: {
        path: "class",
        model: ClassModel,
        select: "name",
      },
    })
    .populate({ path: "hostTeacher", model: UserModel, select: "name" })
    .lean();
}

async function loadLiveSessionAttendanceRows(params: {
  schoolKey: string;
  liveSessionId: string;
}) {
  const {
    LiveSessionAttendance: LiveSessionAttendanceModel,
    User: UserModel,
    AcademicSection: AcademicSectionModel,
  } = await getTenantModels(params.schoolKey, [
    "LiveSessionAttendance",
    "User",
    "AcademicSection",
  ]);

  return LiveSessionAttendanceModel.find({
    liveSession: params.liveSessionId,
  })
    .populate({
      path: "student",
      model: UserModel,
      select: "name rollNumber academicSection",
      populate: {
        path: "academicSection",
        model: AcademicSectionModel,
        select: "name",
      },
    })
    .populate({ path: "markedBy", model: UserModel, select: "name" })
    .sort({ updatedAt: -1, _id: 1 })
    .lean();
}

async function loadLiveSessionAudienceStudentIds(params: {
  schoolKey: string;
  liveSessionId: string;
}) {
  const { LiveSessionAttendance: LiveSessionAttendanceModel } = await getTenantModels(
    params.schoolKey,
    ["LiveSessionAttendance"],
  );

  const studentIds = await LiveSessionAttendanceModel.distinct("student", {
    liveSession: params.liveSessionId,
  });

  return studentIds.map((studentId: unknown) => normalizeScopedStudentId(studentId));
}

async function syncLiveSessionAudience(params: {
  schoolKey: string;
  liveSessionId: string;
  classId: string;
  assignedAcademicSectionIds: string[];
}) {
  const {
    LiveSessionAttendance: LiveSessionAttendanceModel,
  } = await getTenantModels(params.schoolKey, ["LiveSessionAttendance"]);
  const targetStudentIds = await listStudentIdsInScope({
    schoolKey: params.schoolKey,
    classId: params.classId,
    assignedSectionIds: params.assignedAcademicSectionIds,
  });
  const existingRows = await LiveSessionAttendanceModel.find({
    liveSession: params.liveSessionId,
  })
    .select("student")
    .lean();

  const existingStudentIds = existingRows
    .map((row: any) => normalizeScopedStudentId(row?.student))
    .filter(Boolean);
  const existingStudentIdSet = new Set(existingStudentIds);

  if (targetStudentIds.length > 0) {
    await LiveSessionAttendanceModel.bulkWrite(
      targetStudentIds.map((studentId) => ({
        updateOne: {
          filter: {
            liveSession: params.liveSessionId,
            student: studentId,
          },
          update: {
            $setOnInsert: {
              liveSession: params.liveSessionId,
              student: studentId,
              joinClicks: 0,
              firstJoinedAt: null,
              lastJoinedAt: null,
              status: "invited",
              markedBy: null,
              markedAt: null,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  if (targetStudentIds.length > 0) {
    await LiveSessionAttendanceModel.deleteMany({
      liveSession: params.liveSessionId,
      student: { $nin: targetStudentIds },
    });
  } else {
    await LiveSessionAttendanceModel.deleteMany({
      liveSession: params.liveSessionId,
    });
  }

  return {
    targetStudentIds,
    existingStudentIds,
    affectedStudentIds: Array.from(
      new Set([...existingStudentIds, ...targetStudentIds]),
    ),
    addedStudentIds: targetStudentIds.filter(
      (studentId) => !existingStudentIdSet.has(studentId),
    ),
    removedStudentIds: existingStudentIds.filter(
      (studentId) => !targetStudentIds.includes(studentId),
    ),
  };
}

async function assertViewerCanManageLiveSession(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSession: any;
}) {
  if (params.viewerRole !== "teacher") {
    return;
  }

  const scopedUser = await getTeacherScopedUser(params.schoolKey, params.viewerId);
  if (
    !validateTeacherLiveSessionScope({
      scopedUser,
      classId: toId(params.liveSession?.class),
      subjectId: toId(params.liveSession?.subject),
      assignedAcademicSectionIds: uniqueIds(
        params.liveSession?.assignedAcademicSections,
      ),
    })
  ) {
    throwLiveSessionError(
      "You do not have access to manage this live class.",
      403,
    );
  }
}

export async function getWorkspaceLiveSessionSupportData(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
}) {
  if (isMockedE2ETestMode()) {
    return getMockLiveSessionSupportData({
      viewerRole: params.viewerRole,
      viewerId: params.viewerId,
    });
  }

  await connectDB();

  const [classes, sections, subjects, teachers] = await Promise.all([
    getWorkspaceClasses(params.schoolKey),
    getWorkspaceSections(params.schoolKey),
    getWorkspaceSubjects(params.schoolKey),
    getSupportTeachers(params),
  ]);

  if (params.viewerRole !== "teacher") {
    return {
      classes,
      sections,
      subjects,
      teachers,
      defaultHostTeacherId: null,
    } satisfies LiveSessionWorkspaceSupportData;
  }

  const viewerTeacher = teachers[0] || null;
  if (!viewerTeacher) {
    return {
      classes: [],
      sections: [],
      subjects: [],
      teachers: [],
      defaultHostTeacherId: null,
    } satisfies LiveSessionWorkspaceSupportData;
  }

  const allowedSubjectIds = new Set(viewerTeacher.subjectIds);

  return {
    classes: filterClassesByTeacherScope(classes, viewerTeacher),
    sections: filterSectionsByTeacherScope(sections, viewerTeacher),
    subjects: viewerTeacher.hasAllSubjects
      ? subjects
      : subjects.filter((subject) => allowedSubjectIds.has(subject._id)),
    teachers: [viewerTeacher],
    defaultHostTeacherId: viewerTeacher._id,
  } satisfies LiveSessionWorkspaceSupportData;
}

export async function listWorkspaceLiveSessions(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  filters?: WorkspaceLiveSessionFilters;
}) {
  if (isMockedE2ETestMode()) {
    return listMockWorkspaceLiveSessions({
      viewerRole: params.viewerRole,
      viewerId: params.viewerId,
      filters: params.filters,
    });
  }

  await connectDB();
  const rows = await loadWorkspaceLiveSessionRows(params);
  let filteredRows = Array.isArray(rows) ? rows : [];

  if (params.viewerRole === "teacher") {
    const scopedUser = await getTeacherScopedUser(params.schoolKey, params.viewerId);
    filteredRows = filteredRows.filter((row) =>
      validateTeacherLiveSessionScope({
        scopedUser,
        classId: toId(row?.class),
        subjectId: toId(row?.subject),
        assignedAcademicSectionIds: uniqueIds(row?.assignedAcademicSections),
      }),
    );
  }

  const {
    LiveSessionAttendance: LiveSessionAttendanceModel,
  } = await getTenantModels(params.schoolKey, ["LiveSessionAttendance"]);
  const sessionIds = filteredRows.map((row) => toId(row?._id)).filter(Boolean);
  const attendanceRows =
    sessionIds.length > 0
      ? await LiveSessionAttendanceModel.find({
          liveSession: { $in: sessionIds },
        })
          .select("liveSession joinClicks status")
          .lean()
      : [];

  const attendanceBySessionId = new Map<string, any[]>();
  (Array.isArray(attendanceRows) ? attendanceRows : []).forEach((row) => {
    const liveSessionId = normalizeScopedStudentId(row?.liveSession);
    if (!liveSessionId) {
      return;
    }

    if (!attendanceBySessionId.has(liveSessionId)) {
      attendanceBySessionId.set(liveSessionId, []);
    }

    attendanceBySessionId.get(liveSessionId)?.push(row);
  });

  return filteredRows
    .map((row) =>
      serializeWorkspaceSummaryFromDetail(
        serializeWorkspaceDetail(
          row,
          attendanceBySessionId.get(toId(row?._id)) || [],
        ),
      ),
    )
    .sort(sortLiveSessions);
}

export async function getWorkspaceLiveSessionById(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
}) {
  if (isMockedE2ETestMode()) {
    return getMockWorkspaceLiveSessionDetail({
      liveSessionId: params.liveSessionId,
      viewerRole: params.viewerRole,
      viewerId: params.viewerId,
    });
  }

  await connectDB();
  const liveSession = await loadWorkspaceLiveSessionDetailRow(params);
  if (!liveSession) {
    return null;
  }

  await assertViewerCanManageLiveSession({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSession,
  });

  const attendance = await loadLiveSessionAttendanceRows(params);
  return serializeWorkspaceDetail(liveSession, attendance);
}

export async function createWorkspaceLiveSession(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  input: LiveSessionWriteInput;
}) {
  if (isMockedE2ETestMode()) {
    return createMockLiveSession({
      ...params.input,
      createdBy: params.viewerId,
      updatedBy: params.viewerId,
      scheduledStartAt: params.input.scheduledStartAt.toISOString(),
      scheduledEndAt: params.input.scheduledEndAt.toISOString(),
      notificationRevision: params.input.status === "scheduled" ? 1 : 0,
    });
  }

  await connectDB();
  await validateLiveSessionWriteDependencies(params);

  const { LiveSession: LiveSessionModel } = await getTenantModels(
    params.schoolKey,
    ["LiveSession"],
  );

  const notificationRevision = params.input.status === "scheduled" ? 1 : 0;
  const liveSession = await LiveSessionModel.create({
    title: params.input.title,
    description: params.input.description || undefined,
    class: params.input.classId,
    subject: params.input.subjectId,
    assignedAcademicSections: params.input.assignedAcademicSectionIds,
    hostTeacher: params.input.hostTeacherId,
    createdBy: params.viewerId,
    updatedBy: params.viewerId,
    scheduledStartAt: params.input.scheduledStartAt,
    scheduledEndAt: params.input.scheduledEndAt,
    studentJoinUrl: params.input.studentJoinUrl,
    hostJoinUrl: params.input.hostJoinUrl || undefined,
    meetingCode: params.input.meetingCode || undefined,
    meetingPasscode: params.input.meetingPasscode || undefined,
    joinInstructions: params.input.joinInstructions || undefined,
    status: params.input.status,
    notificationRevision,
  });

  const audienceSync = await syncLiveSessionAudience({
    schoolKey: params.schoolKey,
    liveSessionId: toId(liveSession?._id),
    classId: params.input.classId,
    assignedAcademicSectionIds: params.input.assignedAcademicSectionIds,
  });

  if (params.input.status === "scheduled") {
    await createLiveSessionScheduledNotifications({
      schoolKey: params.schoolKey,
      sessionId: toId(liveSession?._id),
      title: params.input.title,
      classId: params.input.classId,
      assignedAcademicSections: params.input.assignedAcademicSectionIds,
      notificationRevision,
      scheduledStartAt: params.input.scheduledStartAt,
      scheduledEndAt: params.input.scheduledEndAt,
    });
  }

  await invalidateStudentDashboardCacheForStudents(
    params.schoolKey,
    audienceSync.affectedStudentIds,
  ).catch(() => undefined);

  await recordTenantAudit({
    schoolKey: params.schoolKey,
    entityType: "live_session",
    entityId: toId(liveSession?._id),
    entityLabel: params.input.title,
    action: "live_session.create",
    summary: `Created live class "${params.input.title}".`,
    details: {
      status: params.input.status,
      classId: params.input.classId,
      subjectId: params.input.subjectId,
      assignedAcademicSectionIds: params.input.assignedAcademicSectionIds,
      hostTeacherId: params.input.hostTeacherId,
    },
  });

  return getWorkspaceLiveSessionById({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSessionId: toId(liveSession?._id),
  });
}

export async function updateWorkspaceLiveSession(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
  input: LiveSessionWriteInput;
}) {
  if (isMockedE2ETestMode()) {
    return updateMockLiveSession(params.liveSessionId, {
      title: params.input.title,
      description: params.input.description || "",
      classId: params.input.classId,
      subjectId: params.input.subjectId,
      assignedAcademicSectionIds: params.input.assignedAcademicSectionIds,
      hostTeacherId: params.input.hostTeacherId,
      updatedBy: params.viewerId,
      scheduledStartAt: params.input.scheduledStartAt.toISOString(),
      scheduledEndAt: params.input.scheduledEndAt.toISOString(),
      studentJoinUrl: params.input.studentJoinUrl,
      hostJoinUrl: params.input.hostJoinUrl || null,
      meetingCode: params.input.meetingCode || null,
      meetingPasscode: params.input.meetingPasscode || null,
      joinInstructions: params.input.joinInstructions || null,
      status: params.input.status,
    });
  }

  await connectDB();

  const { LiveSession: LiveSessionModel } = await getTenantModels(
    params.schoolKey,
    ["LiveSession"],
  );
  const existingLiveSession = await LiveSessionModel.findById(params.liveSessionId);
  if (!existingLiveSession) {
    return null;
  }

  await assertViewerCanManageLiveSession({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSession: existingLiveSession,
  });

  if (
    existingLiveSession.status !== "draft" &&
    existingLiveSession.status !== "scheduled"
  ) {
    throwLiveSessionError(
      "Only draft or scheduled live classes can be edited.",
      400,
    );
  }

  if (
    existingLiveSession.status === "scheduled" &&
    params.input.status !== "scheduled"
  ) {
    throwLiveSessionError(
      "Scheduled live classes cannot move back to draft. Cancel the session instead.",
      400,
    );
  }

  await validateLiveSessionWriteDependencies(params);

  const previousStudentIds = await loadLiveSessionAudienceStudentIds({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
  });
  const previousShape = {
    title: existingLiveSession.title,
    description: existingLiveSession.description,
    classId: toId(existingLiveSession.class),
    subjectId: toId(existingLiveSession.subject),
    assignedAcademicSectionIds: uniqueIds(existingLiveSession.assignedAcademicSections),
    hostTeacherId: toId(existingLiveSession.hostTeacher),
    scheduledStartAt: existingLiveSession.scheduledStartAt,
    scheduledEndAt: existingLiveSession.scheduledEndAt,
    studentJoinUrl: existingLiveSession.studentJoinUrl,
    hostJoinUrl: existingLiveSession.hostJoinUrl,
    meetingCode: existingLiveSession.meetingCode,
    meetingPasscode: existingLiveSession.meetingPasscode,
    joinInstructions: existingLiveSession.joinInstructions,
    status: existingLiveSession.status,
  };
  const nextShape = {
    title: params.input.title,
    description: params.input.description,
    classId: params.input.classId,
    subjectId: params.input.subjectId,
    assignedAcademicSectionIds: params.input.assignedAcademicSectionIds,
    hostTeacherId: params.input.hostTeacherId,
    scheduledStartAt: params.input.scheduledStartAt,
    scheduledEndAt: params.input.scheduledEndAt,
    studentJoinUrl: params.input.studentJoinUrl,
    hostJoinUrl: params.input.hostJoinUrl,
    meetingCode: params.input.meetingCode,
    meetingPasscode: params.input.meetingPasscode,
    joinInstructions: params.input.joinInstructions,
    status: params.input.status,
  };
  const scheduleChanged = didLiveSessionScheduleChange({
    before: previousShape,
    after: nextShape,
  });
  const shouldQueueScheduledNotifications =
    params.input.status === "scheduled" &&
    (existingLiveSession.status !== "scheduled" || scheduleChanged);
  const nextNotificationRevision = shouldQueueScheduledNotifications
    ? Math.max(1, Number(existingLiveSession.notificationRevision || 0) + 1)
    : Math.max(0, Number(existingLiveSession.notificationRevision || 0));

  existingLiveSession.title = params.input.title;
  existingLiveSession.description = params.input.description || undefined;
  existingLiveSession.class = params.input.classId as any;
  existingLiveSession.subject = params.input.subjectId as any;
  existingLiveSession.assignedAcademicSections =
    params.input.assignedAcademicSectionIds as any;
  existingLiveSession.hostTeacher = params.input.hostTeacherId as any;
  existingLiveSession.updatedBy = params.viewerId as any;
  existingLiveSession.scheduledStartAt = params.input.scheduledStartAt;
  existingLiveSession.scheduledEndAt = params.input.scheduledEndAt;
  existingLiveSession.studentJoinUrl = params.input.studentJoinUrl;
  existingLiveSession.hostJoinUrl = params.input.hostJoinUrl || undefined;
  existingLiveSession.meetingCode = params.input.meetingCode || undefined;
  existingLiveSession.meetingPasscode =
    params.input.meetingPasscode || undefined;
  existingLiveSession.joinInstructions =
    params.input.joinInstructions || undefined;
  existingLiveSession.status = params.input.status;
  existingLiveSession.notificationRevision = nextNotificationRevision;
  await existingLiveSession.save();

  const audienceSync = await syncLiveSessionAudience({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
    classId: params.input.classId,
    assignedAcademicSectionIds: params.input.assignedAcademicSectionIds,
  });

  if (shouldQueueScheduledNotifications) {
    await createLiveSessionScheduledNotifications({
      schoolKey: params.schoolKey,
      sessionId: params.liveSessionId,
      title: params.input.title,
      classId: params.input.classId,
      assignedAcademicSections: params.input.assignedAcademicSectionIds,
      notificationRevision: nextNotificationRevision,
      scheduledStartAt: params.input.scheduledStartAt,
      scheduledEndAt: params.input.scheduledEndAt,
    });
  }

  await invalidateStudentDashboardCacheForStudents(
    params.schoolKey,
    Array.from(
      new Set([...previousStudentIds, ...audienceSync.affectedStudentIds]),
    ),
  ).catch(() => undefined);

  await recordTenantAudit({
    schoolKey: params.schoolKey,
    entityType: "live_session",
    entityId: params.liveSessionId,
    entityLabel: params.input.title,
    action: "live_session.update",
    summary: `Updated live class "${params.input.title}".`,
    details: {
      status: params.input.status,
      scheduleChanged,
      notificationRevision: nextNotificationRevision,
    },
  });

  return getWorkspaceLiveSessionById({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSessionId: params.liveSessionId,
  });
}

export async function deleteWorkspaceLiveSession(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
}) {
  if (isMockedE2ETestMode()) {
    return deleteMockLiveSession(params.liveSessionId);
  }

  await connectDB();

  const {
    LiveSession: LiveSessionModel,
    LiveSessionAttendance: LiveSessionAttendanceModel,
  } = await getTenantModels(params.schoolKey, [
    "LiveSession",
    "LiveSessionAttendance",
  ]);
  const liveSession = await LiveSessionModel.findById(params.liveSessionId);
  if (!liveSession) {
    return false;
  }

  await assertViewerCanManageLiveSession({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSession,
  });

  if (String(liveSession.status || "") !== "draft") {
    throwLiveSessionError(
      "Only draft live classes can be deleted. Cancel scheduled sessions instead.",
      400,
    );
  }

  const audienceStudentIds = await loadLiveSessionAudienceStudentIds({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
  });

  await LiveSessionAttendanceModel.deleteMany({
    liveSession: params.liveSessionId,
  });
  await LiveSessionModel.deleteOne({ _id: params.liveSessionId });
  await markStudentNotificationJobsSuperseded({
    schoolKey: params.schoolKey,
    entityType: "live_session",
    entityId: params.liveSessionId,
  }).catch(() => undefined);
  await invalidateStudentDashboardCacheForStudents(
    params.schoolKey,
    audienceStudentIds,
  ).catch(() => undefined);

  return true;
}

export async function startWorkspaceLiveSession(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
}) {
  if (isMockedE2ETestMode()) {
    const updated = updateMockLiveSession(params.liveSessionId, {
      status: "live",
      startedAt: new Date().toISOString(),
      updatedBy: params.viewerId,
    });
    return {
      liveSession: updated,
      joinUrl: updated?.hostJoinUrl || updated?.studentJoinUrl || "",
    };
  }

  await connectDB();
  const { LiveSession: LiveSessionModel } = await getTenantModels(
    params.schoolKey,
    ["LiveSession"],
  );
  const liveSession = await LiveSessionModel.findById(params.liveSessionId);
  if (!liveSession) {
    return null;
  }

  await assertViewerCanManageLiveSession({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSession,
  });

  if (String(liveSession.status || "") !== "scheduled") {
    throwLiveSessionError(
      "Only scheduled live classes can be started.",
      400,
    );
  }

  liveSession.status = "live";
  liveSession.startedAt = liveSession.startedAt || new Date();
  liveSession.updatedBy = params.viewerId as any;
  await liveSession.save();

  const audienceStudentIds = await loadLiveSessionAudienceStudentIds({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
  });
  await invalidateStudentDashboardCacheForStudents(
    params.schoolKey,
    audienceStudentIds,
  ).catch(() => undefined);

  const detail = await getWorkspaceLiveSessionById({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSessionId: params.liveSessionId,
  });

  return {
    liveSession: detail,
    joinUrl: liveSession.hostJoinUrl || liveSession.studentJoinUrl,
  };
}

export async function endWorkspaceLiveSession(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
}) {
  if (isMockedE2ETestMode()) {
    return updateMockLiveSession(params.liveSessionId, {
      status: "completed",
      endedAt: new Date().toISOString(),
      updatedBy: params.viewerId,
    });
  }

  await connectDB();
  const { LiveSession: LiveSessionModel } = await getTenantModels(
    params.schoolKey,
    ["LiveSession"],
  );
  const liveSession = await LiveSessionModel.findById(params.liveSessionId);
  if (!liveSession) {
    return null;
  }

  await assertViewerCanManageLiveSession({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSession,
  });

  if (String(liveSession.status || "") !== "live") {
    throwLiveSessionError("Only live sessions can be completed.", 400);
  }

  liveSession.status = "completed";
  liveSession.endedAt = new Date();
  liveSession.updatedBy = params.viewerId as any;
  await liveSession.save();

  const audienceStudentIds = await loadLiveSessionAudienceStudentIds({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
  });
  await invalidateStudentDashboardCacheForStudents(
    params.schoolKey,
    audienceStudentIds,
  ).catch(() => undefined);

  return getWorkspaceLiveSessionById({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSessionId: params.liveSessionId,
  });
}

export async function cancelWorkspaceLiveSession(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
  cancelReason?: string | null;
}) {
  if (isMockedE2ETestMode()) {
    return updateMockLiveSession(params.liveSessionId, {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      cancelReason: String(params.cancelReason || "").trim() || "Cancelled.",
      updatedBy: params.viewerId,
    });
  }

  await connectDB();
  const { LiveSession: LiveSessionModel } = await getTenantModels(
    params.schoolKey,
    ["LiveSession"],
  );
  const liveSession = await LiveSessionModel.findById(params.liveSessionId);
  if (!liveSession) {
    return null;
  }

  await assertViewerCanManageLiveSession({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSession,
  });

  if (
    String(liveSession.status || "") === "completed" ||
    String(liveSession.status || "") === "cancelled"
  ) {
    throwLiveSessionError(
      "This live class can no longer be cancelled.",
      400,
    );
  }

  liveSession.status = "cancelled";
  liveSession.cancelledAt = new Date();
  liveSession.cancelReason =
    String(params.cancelReason || "").trim() || "Cancelled.";
  liveSession.updatedBy = params.viewerId as any;
  await liveSession.save();

  const audienceStudentIds = await loadLiveSessionAudienceStudentIds({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
  });

  if (Number(liveSession.notificationRevision || 0) > 0) {
    await createLiveSessionCancelledNotifications({
      schoolKey: params.schoolKey,
      sessionId: params.liveSessionId,
      title: String(liveSession.title || "").trim(),
      classId: toId(liveSession.class),
      assignedAcademicSections: uniqueIds(liveSession.assignedAcademicSections),
      notificationRevision: Math.max(
        1,
        Number(liveSession.notificationRevision || 0),
      ),
    });
  }

  await invalidateStudentDashboardCacheForStudents(
    params.schoolKey,
    audienceStudentIds,
  ).catch(() => undefined);

  return getWorkspaceLiveSessionById({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSessionId: params.liveSessionId,
  });
}

export async function updateWorkspaceLiveSessionAttendance(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
  attendance: LiveSessionAttendanceUpdate[];
}) {
  if (isMockedE2ETestMode()) {
    return updateMockLiveSessionAttendance({
      liveSessionId: params.liveSessionId,
      attendance: params.attendance.map((item) => ({
        studentId: item.studentId,
        status: item.status,
        markedBy: params.viewerId,
        markedByName: params.viewerRole === "teacher" ? "Teacher" : "Admin",
      })),
    });
  }

  await connectDB();
  const {
    LiveSession: LiveSessionModel,
    LiveSessionAttendance: LiveSessionAttendanceModel,
    User: UserModel,
  } = await getTenantModels(params.schoolKey, [
    "LiveSession",
    "LiveSessionAttendance",
    "User",
  ]);
  const liveSession = await LiveSessionModel.findById(params.liveSessionId);
  if (!liveSession) {
    return null;
  }

  await assertViewerCanManageLiveSession({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSession,
  });

  const marker = await UserModel.findById(params.viewerId)
    .select("name")
    .lean();

  const updates = (Array.isArray(params.attendance) ? params.attendance : [])
    .map((item) => ({
      studentId: String(item.studentId || "").trim(),
      status: normalizeAttendanceStatus(item.status),
    }))
    .filter((item) => item.studentId);

  if (updates.length === 0) {
    throwLiveSessionError("Select at least one student attendance update.", 400);
  }

  await LiveSessionAttendanceModel.bulkWrite(
    updates.map((item) => ({
      updateOne: {
        filter: {
          liveSession: params.liveSessionId,
          student: item.studentId,
        },
        update: {
          $set: {
            status: item.status,
            markedBy: params.viewerId,
            markedAt: new Date(),
          },
        },
      },
    })),
    { ordered: false },
  );

  const detail = await getWorkspaceLiveSessionById({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSessionId: params.liveSessionId,
  });

  await recordTenantAudit({
    schoolKey: params.schoolKey,
    entityType: "live_session",
    entityId: params.liveSessionId,
    entityLabel: String(liveSession.title || "").trim(),
    action: "live_session.attendance",
    summary: `Updated live class attendance for "${String(
      liveSession.title || "Live class",
    ).trim()}".`,
    details: {
      markedBy: {
        id: params.viewerId,
        name: String(marker?.name || "").trim() || undefined,
      },
      updatedCount: updates.length,
    },
  });

  return detail;
}

export async function listStudentLiveSessions(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  } | null;
}) {
  if (isMockedE2ETestMode()) {
    return listMockStudentLiveSessions(params);
  }

  await connectDB();

  const classId = String(params.studentPlacement?.classId || "").trim();
  const sectionId = String(params.studentPlacement?.academicSectionId || "").trim();
  if (!classId) {
    return [] as StudentLiveSessionSummary[];
  }

  const {
    LiveSession: LiveSessionModel,
    Class: ClassModel,
    Subject: SubjectModel,
    AcademicSection: AcademicSectionModel,
    User: UserModel,
    LiveSessionAttendance: LiveSessionAttendanceModel,
  } = await getTenantModels(params.schoolKey, [
    "LiveSession",
    "Class",
    "Subject",
    "AcademicSection",
    "User",
    "LiveSessionAttendance",
  ]);

  const query: Record<string, any> = {
    class: classId,
    status: { $ne: "draft" },
    $or: [
      { assignedAcademicSections: { $exists: false } },
      { assignedAcademicSections: { $size: 0 } },
      ...(sectionId ? [{ assignedAcademicSections: sectionId }] : []),
    ],
  };

  const sessions = await LiveSessionModel.find(query)
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({ path: "subject", model: SubjectModel, select: "name" })
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      select: "name class",
      populate: {
        path: "class",
        model: ClassModel,
        select: "name",
      },
    })
    .populate({ path: "hostTeacher", model: UserModel, select: "name" })
    .sort({ scheduledStartAt: 1, createdAt: -1 })
    .lean();

  const sessionIds = sessions.map((session: any) => toId(session?._id)).filter(Boolean);
  const attendanceRows =
    sessionIds.length > 0
      ? await LiveSessionAttendanceModel.find({
          liveSession: { $in: sessionIds },
          student: params.studentId,
        })
          .populate({
            path: "student",
            model: UserModel,
            select: "name rollNumber academicSection",
            populate: {
              path: "academicSection",
              model: AcademicSectionModel,
              select: "name",
            },
          })
          .lean()
      : [];
  const attendanceBySessionId = new Map<string, any>();

  (Array.isArray(attendanceRows) ? attendanceRows : []).forEach((row) => {
    attendanceBySessionId.set(normalizeScopedStudentId(row?.liveSession), row);
  });

  return (Array.isArray(sessions) ? sessions : [])
    .map((session: any) => {
      const detail = serializeWorkspaceDetail(
        session,
        attendanceBySessionId.has(toId(session?._id))
          ? [attendanceBySessionId.get(toId(session?._id))]
          : [],
      );

      return serializeStudentSummary(
        detail,
        detail.attendance[0] || null,
      );
    })
    .sort(sortLiveSessions);
}

export async function getStudentLiveSessionById(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  } | null;
  liveSessionId: string;
}) {
  if (isMockedE2ETestMode()) {
    return getMockStudentLiveSessionDetail(params);
  }

  const sessions = await listStudentLiveSessions({
    schoolKey: params.schoolKey,
    studentId: params.studentId,
    studentPlacement: params.studentPlacement,
  });
  const session = sessions.find(
    (item) => item._id === String(params.liveSessionId || "").trim(),
  );

  if (!session) {
    return null;
  }

  const workspaceDetail = await getWorkspaceLiveSessionById({
    schoolKey: params.schoolKey,
    viewerRole: "admin",
    viewerId: "",
    liveSessionId: params.liveSessionId,
  });

  if (!workspaceDetail) {
    return null;
  }

  const studentJoinUrlLabel = resolveStudentJoinUrlLabel(
    workspaceDetail.studentJoinUrl,
  );

  return {
    ...session,
    studentJoinUrlLabel,
  } satisfies StudentLiveSessionDetail;
}

export async function recordStudentLiveSessionJoin(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  } | null;
  liveSessionId: string;
}) {
  if (isMockedE2ETestMode()) {
    return recordMockStudentLiveSessionJoin({
      liveSessionId: params.liveSessionId,
      studentId: params.studentId,
    });
  }

  await connectDB();

  const detail = await getStudentLiveSessionById(params);
  if (!detail) {
    return null;
  }

  if (!detail.canJoin) {
    throwLiveSessionError("This live class is no longer open for joining.", 400);
  }

  const {
    LiveSession: LiveSessionModel,
    LiveSessionAttendance: LiveSessionAttendanceModel,
  } = await getTenantModels(params.schoolKey, [
    "LiveSession",
    "LiveSessionAttendance",
  ]);
  const liveSession = await LiveSessionModel.findById(params.liveSessionId)
    .select("studentJoinUrl")
    .lean();
  const attendance = await LiveSessionAttendanceModel.findOne({
    liveSession: params.liveSessionId,
    student: params.studentId,
  });

  if (!attendance) {
    await LiveSessionAttendanceModel.create({
      liveSession: params.liveSessionId,
      student: params.studentId,
      joinClicks: 1,
      firstJoinedAt: new Date(),
      lastJoinedAt: new Date(),
      status: "joined",
    });
  } else {
    attendance.joinClicks = Math.max(0, Number(attendance.joinClicks || 0)) + 1;
    attendance.firstJoinedAt = attendance.firstJoinedAt || new Date();
    attendance.lastJoinedAt = new Date();
    if (String(attendance.status || "") === "invited") {
      attendance.status = "joined";
    }
    await attendance.save();
  }

  await invalidateStudentDashboardCacheForStudents(
    params.schoolKey,
    [params.studentId],
  ).catch(() => undefined);

  return {
    redirectUrl: String(liveSession?.studentJoinUrl || "").trim(),
    session: await getStudentLiveSessionById(params),
  };
}

export async function recordStudentLiveSessionJoinAndResolveTarget(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  } | null;
  liveSessionId: string;
}) {
  if (isMockedE2ETestMode()) {
    return recordMockStudentLiveSessionJoin({
      liveSessionId: params.liveSessionId,
      studentId: params.studentId,
    });
  }

  const joinResult = await recordStudentLiveSessionJoin(params);
  if (!joinResult) {
    return null;
  }

  return joinResult;
}

export function buildLiveSessionNotificationRecordEntityId(
  liveSessionId: string,
  notificationRevision: number,
) {
  return buildLiveSessionNotificationEntityId({
    sessionId: liveSessionId,
    revision: notificationRevision,
  });
}

export async function getLiveSessionAudienceStudentIds(params: {
  schoolKey: string;
  liveSessionId: string;
}) {
  if (isMockedE2ETestMode()) {
    return getMockLiveSessionAudienceStudentIds(params.liveSessionId);
  }

  return loadLiveSessionAudienceStudentIds(params);
}
