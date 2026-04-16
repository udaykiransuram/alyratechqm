import { buildArchiveFilter } from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";
import { resolveTeacherCourseScope } from "@/lib/courses/access";
import { resolveYouTubeVideoId } from "@/lib/courses/youtube";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  buildLiveSessionNotificationEntityId,
  didLiveSessionScheduleChange,
  filterEligibleLiveSessionTeachers,
  isLiveSessionJoinable,
  LIVE_SESSION_ITEM_STATUSES,
  LIVE_SESSION_ITEM_TYPES,
  normalizeLiveSessionDate,
} from "@/lib/live-sessions/shared";
import type {
  LiveSessionAttendanceStatus,
  LiveSessionItemResponsePage,
  LiveSessionItemResponseSummary,
  LiveSessionItemStatus,
  LiveSessionItemType,
  LiveSessionPublishedTranscript,
  LiveSessionStudentItem,
  LiveSessionStudentResponse,
  LiveSessionSupportTeacher,
  LiveSessionTeacherItem,
  LiveSessionTeacherTranscript,
  LiveSessionWorkspaceSupportData,
  StudentLiveSessionDetail,
  StudentLiveSessionSummary,
  WorkspaceLiveSessionDetail,
  WorkspaceLiveSessionSummary,
} from "@/lib/live-sessions/types";
import {
  hasMeaningfulRichTextContent,
  sanitizeRichTextHtml,
  trimTrailingBlankRichTextBlocks,
} from "@/lib/security/html-sanitize";
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
  getMockLiveSessionItemResponses,
  getMockStudentLiveSessionDetail,
  getMockWorkspaceLiveSessionDetail,
  listMockStudentLiveSessions,
  listMockWorkspaceLiveSessions,
  activateMockLiveSessionItem,
  archiveMockLiveSessionItem,
  closeMockLiveSessionItem,
  createMockLiveSessionItem,
  deleteMockLiveSessionItem,
  recordMockStudentLiveSessionJoin,
  reorderMockLiveSessionItems,
  submitMockStudentLiveSessionResponse,
  updateMockLiveSessionItem,
  updateMockLiveSession,
  updateMockLiveSessionAttendance,
  upsertMockLiveSessionTranscript,
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

export type LiveSessionItemWriteInput = {
  type: LiveSessionItemType;
  promptHtml: string;
  options: Array<{ contentHtml: string }>;
  answerIndexes: number[];
  tagIds: string[];
  explanationHtml?: string | null;
};

export type LiveSessionTranscriptWriteInput = {
  rawText: string;
  summaryHtml: string;
  isPublished: boolean;
};

export type StudentLiveSessionResponseInput = {
  selectedOptionIndexes: number[];
  answerHtml: string | null;
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
        .map((item) => toId(item))
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

function sanitizeLiveSessionRichText(value: unknown) {
  return trimTrailingBlankRichTextBlocks(sanitizeRichTextHtml(value));
}

function sortNumbersAscending(values: number[]) {
  return [...values].sort((left, right) => left - right);
}

function normalizeIntegerIndexes(value: unknown) {
  return sortNumbersAscending(
    Array.from(
      new Set(
        (Array.isArray(value) ? value : [])
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item >= 0),
      ),
    ),
  );
}

function normalizeLiveSessionItemType(value: unknown): LiveSessionItemType {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    LIVE_SESSION_ITEM_TYPES.includes(
      normalized as (typeof LIVE_SESSION_ITEM_TYPES)[number],
    )
  ) {
    return normalized as LiveSessionItemType;
  }

  throwLiveSessionError(
    "Live-item type must be single choice, multiple choice, or short text.",
    400,
  );
}

function normalizeLiveSessionItemStatus(value: unknown): LiveSessionItemStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    LIVE_SESSION_ITEM_STATUSES.includes(
      normalized as (typeof LIVE_SESSION_ITEM_STATUSES)[number],
    )
  ) {
    return normalized as LiveSessionItemStatus;
  }

  return "draft";
}

function isObjectiveResponseCorrect(selected: number[], expected: number[]) {
  const left = sortNumbersAscending(selected);
  const right = sortNumbersAscending(expected);

  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function buildLiveSessionShareHref(liveSessionId: string) {
  return `/student/live-classes/${String(liveSessionId || "").trim()}`;
}

function assertMockViewerCanManageLiveSession(params: {
  liveSessionId: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
}) {
  const detail = getMockWorkspaceLiveSessionDetail({
    liveSessionId: params.liveSessionId,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
  });

  if (!detail) {
    if (params.viewerRole === "teacher") {
      throwLiveSessionError(
        "You do not have access to manage this live class.",
        403,
      );
    }

    return null;
  }

  return detail;
}

function mapLiveSessionItemOption(value: any, index: number) {
  return {
    index,
    contentHtml: sanitizeLiveSessionRichText(
      value?.contentHtml || value?.content || "",
    ),
  };
}

function serializeLiveSessionTeacherTranscript(
  transcript: any,
): LiveSessionTeacherTranscript | null {
  if (!transcript) {
    return null;
  }

  return {
    rawText: String(transcript?.rawText || ""),
    summaryHtml: sanitizeLiveSessionRichText(transcript?.summaryHtml || ""),
    isPublished: Boolean(transcript?.isPublished),
    updatedAt: toIsoOrNull(transcript?.updatedAt),
    updatedByName: toOptionalString(transcript?.updatedBy?.name),
  };
}

function serializePublishedLiveSessionTranscript(
  transcript: any,
): LiveSessionPublishedTranscript | null {
  if (!transcript || !transcript?.isPublished) {
    return null;
  }

  const summaryHtml = sanitizeLiveSessionRichText(transcript?.summaryHtml || "");
  if (!hasMeaningfulRichTextContent(summaryHtml)) {
    return null;
  }

  return {
    summaryHtml,
    updatedAt: toIsoOrNull(transcript?.updatedAt),
  };
}

function serializeLiveSessionTeacherItem(
  item: any,
  responses: any[],
): LiveSessionTeacherItem {
  const options: LiveSessionTeacherItem["options"] = (
    Array.isArray(item?.options) ? item.options : []
  ).map(mapLiveSessionItemOption);
  const answerIndexes = normalizeIntegerIndexes(item?.answerIndexes);
  const type = normalizeLiveSessionItemType(item?.type);
  const responseRows = Array.isArray(responses) ? responses : [];
  const optionStats = options.map((option) => ({
    optionIndex: option.index,
    responseCount: responseRows.filter((response) =>
      normalizeIntegerIndexes(response?.selectedOptionIndexes).includes(
        option.index,
      ),
    ).length,
  }));
  const responseCount = responseRows.length;
  const correctCount =
    type === "short-text"
      ? null
      : responseRows.filter((response) =>
          isObjectiveResponseCorrect(
            normalizeIntegerIndexes(response?.selectedOptionIndexes),
            answerIndexes,
          ),
        ).length;

  return {
    _id: toId(item?._id),
    type,
    promptHtml: sanitizeLiveSessionRichText(item?.promptHtml || ""),
    options,
    answerIndexes,
    tagIds: Array.isArray(item?.tagIds)
      ? item.tagIds.map((tagId: any) => toId(tagId)).filter(Boolean)
      : [],
    explanationHtml: sanitizeLiveSessionRichText(item?.explanationHtml || ""),
    status: normalizeLiveSessionItemStatus(item?.status),
    order: Math.max(0, Math.trunc(Number(item?.order || 0))),
    openedAt: toIsoOrNull(item?.openedAt),
    closedAt: toIsoOrNull(item?.closedAt),
    createdAt: toIsoOrNull(item?.createdAt),
    updatedAt: toIsoOrNull(item?.updatedAt),
    responseCount,
    correctCount,
    incorrectCount:
      correctCount === null ? null : Math.max(0, responseCount - correctCount),
    optionStats,
  };
}

function serializeLiveSessionStudentItem(item: any): LiveSessionStudentItem {
  return {
    _id: toId(item?._id),
    type: normalizeLiveSessionItemType(item?.type),
    promptHtml: sanitizeLiveSessionRichText(item?.promptHtml || ""),
    options: (Array.isArray(item?.options) ? item.options : []).map(
      mapLiveSessionItemOption,
    ),
    status: normalizeLiveSessionItemStatus(item?.status),
    order: Math.max(0, Math.trunc(Number(item?.order || 0))),
    openedAt: toIsoOrNull(item?.openedAt),
    closedAt: toIsoOrNull(item?.closedAt),
  };
}

function serializeLiveSessionStudentResponse(
  response: any,
): LiveSessionStudentResponse | null {
  if (!response) {
    return null;
  }

  return {
    itemId: toId(response?.item),
    selectedOptionIndexes: normalizeIntegerIndexes(response?.selectedOptionIndexes),
    answerHtml: response?.answerHtml
      ? sanitizeLiveSessionRichText(response.answerHtml)
      : null,
    submittedAt: toIsoOrNull(response?.submittedAt),
    updatedAt: toIsoOrNull(response?.updatedAt),
  };
}

function serializeLiveSessionResponseSummary(
  response: any,
  item: any,
): LiveSessionItemResponseSummary {
  const student = response?.student;
  const academicSection =
    student?.academicSection && typeof student.academicSection === "object"
      ? student.academicSection
      : null;
  const itemType = normalizeLiveSessionItemType(item?.type);
  const selectedOptionIndexes = normalizeIntegerIndexes(
    response?.selectedOptionIndexes,
  );
  const answerIndexes = normalizeIntegerIndexes(item?.answerIndexes);

  return {
    studentId: toId(student),
    studentName: String(student?.name || "").trim() || "Student",
    rollNumber: toOptionalString(student?.rollNumber),
    academicSectionName: toOptionalString(academicSection?.name),
    selectedOptionIndexes,
    answerHtml: response?.answerHtml
      ? sanitizeLiveSessionRichText(response.answerHtml)
      : null,
    submittedAt: toIsoOrNull(response?.submittedAt),
    updatedAt: toIsoOrNull(response?.updatedAt),
    isCorrect:
      itemType === "short-text"
        ? null
        : isObjectiveResponseCorrect(selectedOptionIndexes, answerIndexes),
  };
}

export function normalizeLiveSessionItemWriteInput(
  input: Record<string, unknown>,
): LiveSessionItemWriteInput {
  const type = normalizeLiveSessionItemType(input?.type);
  const promptHtml = sanitizeLiveSessionRichText(
    input?.promptHtml || input?.prompt || "",
  );
  const explanationHtml = sanitizeLiveSessionRichText(
    input?.explanationHtml || input?.explanation || "",
  );
  const options = (Array.isArray(input?.options) ? input.options : []).map(
    (value) => ({
      contentHtml: sanitizeLiveSessionRichText(
        value && typeof value === "object"
          ? (value as Record<string, unknown>).contentHtml ||
              (value as Record<string, unknown>).content ||
              ""
          : "",
      ),
    }),
  );
  const answerIndexes = normalizeIntegerIndexes(input?.answerIndexes);
  const tagIds = (Array.isArray(input?.tagIds) ? input.tagIds : [])
    .map((value) => toId(value))
    .filter(Boolean);

  if (!hasMeaningfulRichTextContent(promptHtml)) {
    throwLiveSessionError("Live-item prompts cannot be empty.", 400);
  }

  if (type === "single" || type === "multiple") {
    if (options.length < 2) {
      throwLiveSessionError(
        "Single and multiple live items need at least two answer options.",
        400,
      );
    }

    if (options.some((option) => !hasMeaningfulRichTextContent(option.contentHtml))) {
      throwLiveSessionError(
        "Every answer option must include visible text, math, or an image.",
        400,
      );
    }

    if (type === "single" && answerIndexes.length !== 1) {
      throwLiveSessionError(
        "Single-choice live items need exactly one correct answer.",
        400,
      );
    }

    if (type === "multiple" && answerIndexes.length === 0) {
      throwLiveSessionError(
        "Multiple-choice live items need at least one correct answer.",
        400,
      );
    }

    if (answerIndexes.some((answerIndex) => answerIndex >= options.length)) {
      throwLiveSessionError(
        "Correct answers must point to existing live-item options.",
        400,
      );
    }
  }

  return {
    type,
    promptHtml,
    options: type === "short-text" ? [] : options,
    answerIndexes: type === "short-text" ? [] : answerIndexes,
    tagIds,
    explanationHtml,
  };
}

export function normalizeLiveSessionTranscriptWriteInput(
  input: Record<string, unknown>,
): LiveSessionTranscriptWriteInput {
  const rawText = String(input?.rawText || "")
    .replace(/\r\n?/g, "\n")
    .trim();
  const summaryHtml = sanitizeLiveSessionRichText(
    input?.summaryHtml || input?.summary || "",
  );
  const isPublished = Boolean(input?.isPublished);

  if (isPublished && !hasMeaningfulRichTextContent(summaryHtml)) {
    throwLiveSessionError(
      "Add a transcript summary before publishing it to students.",
      400,
    );
  }

  return {
    rawText,
    summaryHtml,
    isPublished,
  };
}

export function normalizeStudentLiveSessionResponseInput(
  input: Record<string, unknown>,
): StudentLiveSessionResponseInput {
  return {
    selectedOptionIndexes: normalizeIntegerIndexes(input?.selectedOptionIndexes),
    answerHtml: sanitizeLiveSessionRichText(
      input?.answerHtml || input?.answer || "",
    ),
  };
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
    shareHref: buildLiveSessionShareHref(toId(liveSession?._id)),
    activeItem: null,
    items: [],
    transcript: null,
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

async function loadLiveSessionItemRows(params: {
  schoolKey: string;
  liveSessionId: string;
  statuses?: LiveSessionItemStatus[];
}) {
  const { LiveSessionItem: LiveSessionItemModel } = await getTenantModels(
    params.schoolKey,
    ["LiveSessionItem"],
  );
  const query: Record<string, unknown> = {
    liveSession: params.liveSessionId,
  };

  if (Array.isArray(params.statuses) && params.statuses.length > 0) {
    query.status = { $in: params.statuses };
  }

  return LiveSessionItemModel.find(query)
    .sort({ order: 1, createdAt: 1, _id: 1 })
    .lean();
}

async function loadLiveSessionTranscriptRow(params: {
  schoolKey: string;
  liveSessionId: string;
  publishedOnly?: boolean;
}) {
  const {
    LiveSessionTranscript: LiveSessionTranscriptModel,
    User: UserModel,
  } = await getTenantModels(params.schoolKey, [
    "LiveSessionTranscript",
    "User",
  ]);

  return LiveSessionTranscriptModel.findOne({
    liveSession: params.liveSessionId,
    ...(params.publishedOnly ? { isPublished: true } : {}),
  })
    .populate({
      path: "updatedBy",
      model: UserModel,
      select: "name",
    })
    .lean();
}

async function loadLiveSessionResponseRows(params: {
  schoolKey: string;
  itemIds: string[];
  studentId?: string;
}) {
  if (params.itemIds.length === 0) {
    return [];
  }

  const { LiveSessionResponse: LiveSessionResponseModel } = await getTenantModels(
    params.schoolKey,
    ["LiveSessionResponse"],
  );

  return LiveSessionResponseModel.find({
    item: { $in: params.itemIds },
    ...(params.studentId ? { student: params.studentId } : {}),
  })
    .sort({ updatedAt: -1, _id: 1 })
    .lean();
}

async function loadWorkspaceLiveSessionV2State(params: {
  schoolKey: string;
  liveSessionId: string;
  activeItemId?: string | null;
}) {
  const [itemRows, transcriptRow] = await Promise.all([
    loadLiveSessionItemRows({
      schoolKey: params.schoolKey,
      liveSessionId: params.liveSessionId,
    }),
    loadLiveSessionTranscriptRow({
      schoolKey: params.schoolKey,
      liveSessionId: params.liveSessionId,
    }),
  ]);

  const itemIds = itemRows.map((item) => toId(item?._id)).filter(Boolean);
  const responseRows = await loadLiveSessionResponseRows({
    schoolKey: params.schoolKey,
    itemIds,
  });
  const responsesByItemId = new Map<string, any[]>();

  (Array.isArray(responseRows) ? responseRows : []).forEach((response) => {
    const itemId = toId(response?.item);
    if (!itemId) {
      return;
    }

    if (!responsesByItemId.has(itemId)) {
      responsesByItemId.set(itemId, []);
    }

    responsesByItemId.get(itemId)?.push(response);
  });

  const items = (Array.isArray(itemRows) ? itemRows : []).map((item) =>
    serializeLiveSessionTeacherItem(
      item,
      responsesByItemId.get(toId(item?._id)) || [],
    ),
  );

  const activeItem =
    items.find(
      (item) =>
        item._id === String(params.activeItemId || "").trim() &&
        item.status === "active",
    ) || items.find((item) => item.status === "active") || null;

  return {
    shareHref: buildLiveSessionShareHref(params.liveSessionId),
    activeItem,
    items,
    transcript: serializeLiveSessionTeacherTranscript(transcriptRow),
  };
}

async function loadStudentLiveSessionV2State(params: {
  schoolKey: string;
  liveSessionId: string;
  studentId: string;
  activeItemId?: string | null;
}) {
  const itemRows = await loadLiveSessionItemRows({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
    statuses: ["active"],
  });

  const activeSource =
    itemRows.find((item) => toId(item?._id) === String(params.activeItemId || "").trim()) ||
    itemRows[0] ||
    null;
  const activeItemId = toId(activeSource?._id);
  const [responseRows, transcriptRow] = await Promise.all([
    activeItemId
      ? loadLiveSessionResponseRows({
          schoolKey: params.schoolKey,
          itemIds: [activeItemId],
          studentId: params.studentId,
        })
      : Promise.resolve([]),
    loadLiveSessionTranscriptRow({
      schoolKey: params.schoolKey,
      liveSessionId: params.liveSessionId,
      publishedOnly: true,
    }),
  ]);

  return {
    shareHref: buildLiveSessionShareHref(params.liveSessionId),
    activeItem: activeSource ? serializeLiveSessionStudentItem(activeSource) : null,
    studentResponse: serializeLiveSessionStudentResponse(responseRows[0] || null),
    publishedTranscriptSummary: serializePublishedLiveSessionTranscript(
      transcriptRow,
    ),
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
  if (resolveYouTubeVideoId(url)) {
    return "Watch on YouTube";
  }

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

export function isLiveSessionVisibleToStudent(params: {
  liveSession: any;
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  } | null;
}) {
  const classId = String(params.studentPlacement?.classId || "").trim();
  const sectionId = String(params.studentPlacement?.academicSectionId || "").trim();
  const liveSessionClassId = toId(params.liveSession?.class);

  if (!classId || classId !== liveSessionClassId) {
    return false;
  }

  const status = String(params.liveSession?.status || "").trim();
  if (status === "draft") {
    return false;
  }

  const assignedSectionIds = uniqueIds(params.liveSession?.assignedAcademicSections);
  if (assignedSectionIds.length === 0) {
    return true;
  }

  return Boolean(sectionId && assignedSectionIds.includes(sectionId));
}

async function loadStudentLiveSessionAttendanceRow(params: {
  schoolKey: string;
  liveSessionId: string;
  studentId: string;
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

  return LiveSessionAttendanceModel.findOne({
    liveSession: params.liveSessionId,
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
    .lean();
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
  const detail = serializeWorkspaceDetail(liveSession, attendance);
  const v2State = await loadWorkspaceLiveSessionV2State({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
    activeItemId: toId(liveSession?.activeItemId),
  });

  return {
    ...detail,
    ...v2State,
  };
}

async function getWorkspaceLiveSessionDocumentForManagement(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
}) {
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

  return liveSession;
}

function assertLiveSessionAllowsDraftItemMutations(status: string) {
  if (
    status !== "draft" &&
    status !== "scheduled" &&
    status !== "live"
  ) {
    throwLiveSessionError(
      "Live items can only be changed before or during an active live class.",
      400,
    );
  }
}

function assertLiveSessionAllowsItemActivation(status: string) {
  if (status !== "scheduled" && status !== "live") {
    throwLiveSessionError(
      "Activate live items only when the session is scheduled or already live.",
      400,
    );
  }
}

async function getLiveSessionItemDocument(params: {
  schoolKey: string;
  liveSessionId: string;
  itemId: string;
}) {
  const { LiveSessionItem: LiveSessionItemModel } = await getTenantModels(
    params.schoolKey,
    ["LiveSessionItem"],
  );

  return LiveSessionItemModel.findOne({
    _id: params.itemId,
    liveSession: params.liveSessionId,
  });
}

async function resequenceDraftLiveSessionItems(params: {
  schoolKey: string;
  liveSessionId: string;
  orderedDraftItemIds: string[];
}) {
  const { LiveSessionItem: LiveSessionItemModel } = await getTenantModels(
    params.schoolKey,
    ["LiveSessionItem"],
  );

  if (params.orderedDraftItemIds.length === 0) {
    return;
  }

  await LiveSessionItemModel.bulkWrite(
    params.orderedDraftItemIds.map((itemId, index) => ({
      updateOne: {
        filter: {
          _id: itemId,
          liveSession: params.liveSessionId,
          status: "draft",
        },
        update: {
          $set: {
            order: index,
          },
        },
      },
    })),
    { ordered: true },
  );
}

async function closeActiveLiveSessionItems(params: {
  schoolKey: string;
  liveSessionId: string;
  viewerId?: string;
}) {
  const { LiveSessionItem: LiveSessionItemModel } = await getTenantModels(
    params.schoolKey,
    ["LiveSessionItem"],
  );

  const update: Record<string, unknown> = {
    status: "closed",
    closedAt: new Date(),
  };
  if (params.viewerId) {
    update.updatedBy = params.viewerId;
  }

  await LiveSessionItemModel.updateMany(
    {
      liveSession: params.liveSessionId,
      status: "active",
    },
    {
      $set: update,
    },
  );
}

async function deleteLiveSessionV2Artifacts(params: {
  schoolKey: string;
  liveSessionId: string;
}) {
  const {
    LiveSessionItem: LiveSessionItemModel,
    LiveSessionResponse: LiveSessionResponseModel,
    LiveSessionTranscript: LiveSessionTranscriptModel,
  } = await getTenantModels(params.schoolKey, [
    "LiveSessionItem",
    "LiveSessionResponse",
    "LiveSessionTranscript",
  ]);

  const itemIds = await LiveSessionItemModel.distinct("_id", {
    liveSession: params.liveSessionId,
  });

  if (itemIds.length > 0) {
    await LiveSessionResponseModel.deleteMany({
      item: { $in: itemIds },
    });
  }

  await LiveSessionTranscriptModel.deleteMany({
    liveSession: params.liveSessionId,
  });
  await LiveSessionItemModel.deleteMany({
    liveSession: params.liveSessionId,
  });
}

async function upsertLiveSessionResponseRecord(params: {
  schoolKey: string;
  liveSessionId: string;
  itemId: string;
  studentId: string;
  itemType: LiveSessionItemType;
  selectedOptionIndexes: number[];
  answerHtml: string | null;
}) {
  const { LiveSessionResponse: LiveSessionResponseModel } = await getTenantModels(
    params.schoolKey,
    ["LiveSessionResponse"],
  );

  const update = {
    liveSession: params.liveSessionId,
    item: params.itemId,
    student: params.studentId,
    itemType: params.itemType,
    selectedOptionIndexes: params.selectedOptionIndexes,
    answerHtml:
      params.itemType === "short-text" ? params.answerHtml || null : null,
    submittedAt: new Date(),
  };

  try {
    return await LiveSessionResponseModel.findOneAndUpdate(
      {
        item: params.itemId,
        student: params.studentId,
      },
      {
        $set: update,
        $setOnInsert: {
          liveSession: params.liveSessionId,
          item: params.itemId,
          student: params.studentId,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).lean();
  } catch (error) {
    const duplicateKeyError =
      error &&
      typeof error === "object" &&
      "code" in error &&
      Number((error as { code?: unknown }).code) === 11000;

    if (!duplicateKeyError) {
      throw error;
    }

    return LiveSessionResponseModel.findOneAndUpdate(
      {
        item: params.itemId,
        student: params.studentId,
      },
      {
        $set: update,
      },
      {
        new: true,
        runValidators: true,
      },
    ).lean();
  }
}

export async function createWorkspaceLiveSessionItem(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
  input: LiveSessionItemWriteInput;
}) {
  if (isMockedE2ETestMode()) {
    if (!assertMockViewerCanManageLiveSession(params)) {
      return null;
    }

    return createMockLiveSessionItem({
      liveSessionId: params.liveSessionId,
      createdBy: params.viewerId,
      updatedBy: params.viewerId,
      input: params.input,
    });
  }

  const liveSession = await getWorkspaceLiveSessionDocumentForManagement(params);
  if (!liveSession) {
    return null;
  }

  assertLiveSessionAllowsDraftItemMutations(String(liveSession.status || ""));

  const { LiveSessionItem: LiveSessionItemModel } = await getTenantModels(
    params.schoolKey,
    ["LiveSessionItem"],
  );
  const lastDraftItem = await LiveSessionItemModel.findOne({
    liveSession: params.liveSessionId,
    status: "draft",
  })
    .sort({ order: -1, createdAt: -1, _id: -1 })
    .select("order")
    .lean();
  const nextOrder = Math.max(0, Math.trunc(Number(lastDraftItem?.order || -1)) + 1);

  await LiveSessionItemModel.create({
    liveSession: params.liveSessionId,
    type: params.input.type,
    promptHtml: params.input.promptHtml,
    options: params.input.options,
    answerIndexes: params.input.answerIndexes,
    tagIds: params.input.tagIds,
    explanationHtml: params.input.explanationHtml || "",
    status: "draft",
    order: nextOrder,
    createdBy: params.viewerId,
    updatedBy: params.viewerId,
  });

  return getWorkspaceLiveSessionById({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSessionId: params.liveSessionId,
  });
}

export async function updateWorkspaceLiveSessionItem(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
  itemId: string;
  input: LiveSessionItemWriteInput;
}) {
  if (isMockedE2ETestMode()) {
    if (!assertMockViewerCanManageLiveSession(params)) {
      return null;
    }

    return updateMockLiveSessionItem({
      liveSessionId: params.liveSessionId,
      itemId: params.itemId,
      updatedBy: params.viewerId,
      input: params.input,
    });
  }

  const liveSession = await getWorkspaceLiveSessionDocumentForManagement(params);
  if (!liveSession) {
    return null;
  }

  assertLiveSessionAllowsDraftItemMutations(String(liveSession.status || ""));

  const item = await getLiveSessionItemDocument({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
    itemId: params.itemId,
  });
  if (!item) {
    return null;
  }

  if (String(item.status || "") !== "draft") {
    throwLiveSessionError(
      "Only draft live items can be edited.",
      400,
    );
  }

  item.type = params.input.type as any;
  item.promptHtml = params.input.promptHtml;
  item.options = params.input.options as any;
  item.answerIndexes = params.input.answerIndexes as any;
  item.tagIds = params.input.tagIds as any;
  item.explanationHtml = params.input.explanationHtml || "";
  item.updatedBy = params.viewerId as any;
  await item.save();

  return getWorkspaceLiveSessionById({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSessionId: params.liveSessionId,
  });
}

export async function deleteWorkspaceLiveSessionItem(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
  itemId: string;
}) {
  if (isMockedE2ETestMode()) {
    if (!assertMockViewerCanManageLiveSession(params)) {
      return null;
    }

    return deleteMockLiveSessionItem({
      liveSessionId: params.liveSessionId,
      itemId: params.itemId,
    });
  }

  const liveSession = await getWorkspaceLiveSessionDocumentForManagement(params);
  if (!liveSession) {
    return null;
  }

  assertLiveSessionAllowsDraftItemMutations(String(liveSession.status || ""));

  const {
    LiveSessionItem: LiveSessionItemModel,
    LiveSessionResponse: LiveSessionResponseModel,
  } = await getTenantModels(params.schoolKey, [
    "LiveSessionItem",
    "LiveSessionResponse",
  ]);
  const item = await LiveSessionItemModel.findOne({
    _id: params.itemId,
    liveSession: params.liveSessionId,
  });
  if (!item) {
    return null;
  }

  if (String(item.status || "") !== "draft") {
    throwLiveSessionError(
      "Only draft live items can be deleted. Archive active history items instead.",
      400,
    );
  }

  const responseCount = await LiveSessionResponseModel.countDocuments({
    item: params.itemId,
  });
  if (responseCount > 0) {
    throwLiveSessionError(
      "Live items with responses cannot be deleted. Archive them instead.",
      400,
    );
  }

  await LiveSessionItemModel.deleteOne({
    _id: params.itemId,
  });

  const remainingDraftItems = await LiveSessionItemModel.find({
    liveSession: params.liveSessionId,
    status: "draft",
  })
    .sort({ order: 1, createdAt: 1, _id: 1 })
    .select("_id")
    .lean();
  await resequenceDraftLiveSessionItems({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
    orderedDraftItemIds: remainingDraftItems
      .map((draftItem) => toId(draftItem?._id))
      .filter(Boolean),
  });

  return getWorkspaceLiveSessionById({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSessionId: params.liveSessionId,
  });
}

export async function reorderWorkspaceLiveSessionItems(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
  orderedItemIds: string[];
}) {
  if (isMockedE2ETestMode()) {
    if (!assertMockViewerCanManageLiveSession(params)) {
      return null;
    }

    return reorderMockLiveSessionItems({
      liveSessionId: params.liveSessionId,
      orderedItemIds: params.orderedItemIds,
    });
  }

  const liveSession = await getWorkspaceLiveSessionDocumentForManagement(params);
  if (!liveSession) {
    return null;
  }

  assertLiveSessionAllowsDraftItemMutations(String(liveSession.status || ""));

  const { LiveSessionItem: LiveSessionItemModel } = await getTenantModels(
    params.schoolKey,
    ["LiveSessionItem"],
  );
  const draftItems = await LiveSessionItemModel.find({
    liveSession: params.liveSessionId,
    status: "draft",
  })
    .sort({ order: 1, createdAt: 1, _id: 1 })
    .select("_id")
    .lean();

  const currentDraftIds = draftItems.map((item) => toId(item?._id)).filter(Boolean);
  const requestedIds = params.orderedItemIds.map((itemId) => String(itemId || "").trim()).filter(Boolean);

  if (
    currentDraftIds.length !== requestedIds.length ||
    currentDraftIds.some((itemId) => !requestedIds.includes(itemId))
  ) {
    throwLiveSessionError(
      "Reordering must include every draft live item exactly once.",
      400,
    );
  }

  await resequenceDraftLiveSessionItems({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
    orderedDraftItemIds: requestedIds,
  });

  return getWorkspaceLiveSessionById({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSessionId: params.liveSessionId,
  });
}

export async function activateWorkspaceLiveSessionItem(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
  itemId: string;
}) {
  if (isMockedE2ETestMode()) {
    if (!assertMockViewerCanManageLiveSession(params)) {
      return null;
    }

    return activateMockLiveSessionItem({
      liveSessionId: params.liveSessionId,
      itemId: params.itemId,
      viewerId: params.viewerId,
    });
  }

  const liveSession = await getWorkspaceLiveSessionDocumentForManagement(params);
  if (!liveSession) {
    return null;
  }

  assertLiveSessionAllowsItemActivation(String(liveSession.status || ""));

  const item = await getLiveSessionItemDocument({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
    itemId: params.itemId,
  });
  if (!item) {
    return null;
  }

  if (String(item.status || "") !== "draft") {
    throwLiveSessionError(
      "Only draft live items can be activated.",
      400,
    );
  }

  await closeActiveLiveSessionItems({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
    viewerId: params.viewerId,
  });

  item.status = "active" as any;
  item.openedAt = item.openedAt || new Date();
  item.closedAt = null;
  item.updatedBy = params.viewerId as any;
  await item.save();

  liveSession.activeItemId = item._id as any;
  liveSession.updatedBy = params.viewerId as any;
  await liveSession.save();

  return getWorkspaceLiveSessionById({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSessionId: params.liveSessionId,
  });
}

export async function closeWorkspaceLiveSessionItem(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
  itemId: string;
}) {
  if (isMockedE2ETestMode()) {
    if (!assertMockViewerCanManageLiveSession(params)) {
      return null;
    }

    return closeMockLiveSessionItem({
      liveSessionId: params.liveSessionId,
      itemId: params.itemId,
      viewerId: params.viewerId,
    });
  }

  const liveSession = await getWorkspaceLiveSessionDocumentForManagement(params);
  if (!liveSession) {
    return null;
  }

  const item = await getLiveSessionItemDocument({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
    itemId: params.itemId,
  });
  if (!item) {
    return null;
  }

  if (String(item.status || "") !== "active") {
    throwLiveSessionError(
      "Only active live items can be closed.",
      400,
    );
  }

  item.status = "closed" as any;
  item.closedAt = new Date();
  item.updatedBy = params.viewerId as any;
  await item.save();

  if (toId(liveSession.activeItemId) === params.itemId) {
    liveSession.activeItemId = null as any;
    liveSession.updatedBy = params.viewerId as any;
    await liveSession.save();
  }

  return getWorkspaceLiveSessionById({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSessionId: params.liveSessionId,
  });
}

export async function archiveWorkspaceLiveSessionItem(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
  itemId: string;
}) {
  if (isMockedE2ETestMode()) {
    if (!assertMockViewerCanManageLiveSession(params)) {
      return null;
    }

    return archiveMockLiveSessionItem({
      liveSessionId: params.liveSessionId,
      itemId: params.itemId,
      viewerId: params.viewerId,
    });
  }

  const liveSession = await getWorkspaceLiveSessionDocumentForManagement(params);
  if (!liveSession) {
    return null;
  }

  const item = await getLiveSessionItemDocument({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
    itemId: params.itemId,
  });
  if (!item) {
    return null;
  }

  if (String(item.status || "") === "active") {
    throwLiveSessionError(
      "Close the live item before archiving it.",
      400,
    );
  }

  item.status = "archived" as any;
  item.updatedBy = params.viewerId as any;
  await item.save();

  if (toId(liveSession.activeItemId) === params.itemId) {
    liveSession.activeItemId = null as any;
    liveSession.updatedBy = params.viewerId as any;
    await liveSession.save();
  }

  return getWorkspaceLiveSessionById({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSessionId: params.liveSessionId,
  });
}

export async function getWorkspaceLiveSessionItemResponses(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
  itemId: string;
  page?: number;
  limit?: number;
}) {
  if (isMockedE2ETestMode()) {
    if (!assertMockViewerCanManageLiveSession(params)) {
      return null;
    }

    return getMockLiveSessionItemResponses({
      liveSessionId: params.liveSessionId,
      itemId: params.itemId,
      page: params.page,
      limit: params.limit,
    });
  }

  const liveSession = await getWorkspaceLiveSessionDocumentForManagement(params);
  if (!liveSession) {
    return null;
  }

  const {
    LiveSessionItem: LiveSessionItemModel,
    LiveSessionResponse: LiveSessionResponseModel,
    User: UserModel,
    AcademicSection: AcademicSectionModel,
  } = await getTenantModels(params.schoolKey, [
    "LiveSessionItem",
    "LiveSessionResponse",
    "User",
    "AcademicSection",
  ]);
  const item = await LiveSessionItemModel.findOne({
    _id: params.itemId,
    liveSession: params.liveSessionId,
  }).lean();
  if (!item) {
    return null;
  }

  const limit = Math.min(50, Math.max(1, Math.trunc(Number(params.limit || 10))));
  const total = await LiveSessionResponseModel.countDocuments({
    item: params.itemId,
  });
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(Math.max(1, Math.trunc(Number(params.page || 1))), pages);
  const skip = (page - 1) * limit;
  const responses = await LiveSessionResponseModel.find({
    item: params.itemId,
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
    .sort({ updatedAt: -1, _id: 1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    itemId: params.itemId,
    page,
    pages,
    total,
    limit,
    responses: (Array.isArray(responses) ? responses : []).map((response) =>
      serializeLiveSessionResponseSummary(response, item),
    ),
  } satisfies LiveSessionItemResponsePage;
}

export async function upsertWorkspaceLiveSessionTranscript(params: {
  schoolKey: string;
  viewerRole: LiveSessionViewerRole;
  viewerId: string;
  liveSessionId: string;
  input: LiveSessionTranscriptWriteInput;
}) {
  if (isMockedE2ETestMode()) {
    const detail = assertMockViewerCanManageLiveSession(params);
    if (!detail) {
      return null;
    }

    return upsertMockLiveSessionTranscript({
      liveSessionId: params.liveSessionId,
      viewerId: params.viewerId,
      input: params.input,
    });
  }

  const liveSession = await getWorkspaceLiveSessionDocumentForManagement(params);
  if (!liveSession) {
    return null;
  }

  const { LiveSessionTranscript: LiveSessionTranscriptModel } = await getTenantModels(
    params.schoolKey,
    ["LiveSessionTranscript"],
  );
  const hasRawText = params.input.rawText.length > 0;
  const hasSummary = hasMeaningfulRichTextContent(params.input.summaryHtml);

  if (!hasRawText && !hasSummary && !params.input.isPublished) {
    await LiveSessionTranscriptModel.deleteMany({
      liveSession: params.liveSessionId,
    });
  } else {
    await LiveSessionTranscriptModel.findOneAndUpdate(
      {
        liveSession: params.liveSessionId,
      },
      {
        $set: {
          rawText: params.input.rawText || null,
          summaryHtml: params.input.summaryHtml || null,
          isPublished: params.input.isPublished,
          updatedBy: params.viewerId,
        },
        $setOnInsert: {
          liveSession: params.liveSessionId,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  return getWorkspaceLiveSessionById({
    schoolKey: params.schoolKey,
    viewerRole: params.viewerRole,
    viewerId: params.viewerId,
    liveSessionId: params.liveSessionId,
  });
}

export async function submitStudentLiveSessionResponse(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  } | null;
  liveSessionId: string;
  itemId: string;
  input: StudentLiveSessionResponseInput;
}) {
  if (isMockedE2ETestMode()) {
    const studentDetail = getMockStudentLiveSessionDetail({
      liveSessionId: params.liveSessionId,
      studentId: params.studentId,
      studentPlacement: params.studentPlacement,
    });
    if (!studentDetail) {
      return null;
    }

    const workspaceDetail = getMockWorkspaceLiveSessionDetail({
      liveSessionId: params.liveSessionId,
    });
    const item = workspaceDetail?.items.find(
      (entry) => entry._id === params.itemId,
    );

    if (!item) {
      return null;
    }

    if (item.status !== "active") {
      throwLiveSessionError(
        "This live item is no longer accepting responses.",
        400,
      );
    }

    const optionCount = item.options.length;

    if (item.type === "single" && params.input.selectedOptionIndexes.length !== 1) {
      throwLiveSessionError(
        "Choose exactly one answer for this live question.",
        400,
      );
    }

    if (item.type === "multiple" && params.input.selectedOptionIndexes.length === 0) {
      throwLiveSessionError(
        "Choose at least one answer for this live question.",
        400,
      );
    }

    if (
      (item.type === "single" || item.type === "multiple") &&
      params.input.selectedOptionIndexes.some((index) => index >= optionCount)
    ) {
      throwLiveSessionError(
        "Selected answers must point to valid live-item options.",
        400,
      );
    }

    if (
      item.type === "short-text" &&
      !hasMeaningfulRichTextContent(params.input.answerHtml)
    ) {
      throwLiveSessionError(
        "Short-text live responses cannot be empty.",
        400,
      );
    }

    return submitMockStudentLiveSessionResponse({
      liveSessionId: params.liveSessionId,
      itemId: params.itemId,
      studentId: params.studentId,
      input: params.input,
    });
  }

  await connectDB();
  const liveSession = await loadWorkspaceLiveSessionDetailRow({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
  });

  if (!liveSession || !isLiveSessionVisibleToStudent({
    liveSession,
    studentPlacement: params.studentPlacement,
  })) {
    return null;
  }

  const { LiveSessionItem: LiveSessionItemModel } = await getTenantModels(
    params.schoolKey,
    ["LiveSessionItem"],
  );
  const item = await LiveSessionItemModel.findOne({
    _id: params.itemId,
    liveSession: params.liveSessionId,
  }).lean();

  if (!item) {
    return null;
  }

  if (String(item.status || "") !== "active") {
    throwLiveSessionError(
      "This live item is no longer accepting responses.",
      400,
    );
  }

  const itemType = normalizeLiveSessionItemType(item?.type);
  const optionCount = Array.isArray(item?.options) ? item.options.length : 0;

  if (itemType === "single") {
    if (params.input.selectedOptionIndexes.length !== 1) {
      throwLiveSessionError(
        "Choose exactly one answer for this live question.",
        400,
      );
    }
  }

  if (itemType === "multiple") {
    if (params.input.selectedOptionIndexes.length === 0) {
      throwLiveSessionError(
        "Choose at least one answer for this live question.",
        400,
      );
    }
  }

  if (
    (itemType === "single" || itemType === "multiple") &&
    params.input.selectedOptionIndexes.some((index) => index >= optionCount)
  ) {
    throwLiveSessionError(
      "Selected answers must point to valid live-item options.",
      400,
    );
  }

  if (itemType === "short-text" && !hasMeaningfulRichTextContent(params.input.answerHtml)) {
    throwLiveSessionError(
      "Short-text live responses cannot be empty.",
      400,
    );
  }

  await upsertLiveSessionResponseRecord({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
    itemId: params.itemId,
    studentId: params.studentId,
    itemType,
    selectedOptionIndexes:
      itemType === "short-text" ? [] : params.input.selectedOptionIndexes,
    answerHtml: itemType === "short-text" ? params.input.answerHtml : null,
  });

  return getStudentLiveSessionById({
    schoolKey: params.schoolKey,
    studentId: params.studentId,
    studentPlacement: params.studentPlacement,
    liveSessionId: params.liveSessionId,
  });
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

  await deleteLiveSessionV2Artifacts({
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

  await closeActiveLiveSessionItems({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
    viewerId: params.viewerId,
  });
  liveSession.status = "completed";
  liveSession.endedAt = new Date();
  liveSession.activeItemId = null as any;
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

  await closeActiveLiveSessionItems({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
    viewerId: params.viewerId,
  });
  liveSession.status = "cancelled";
  liveSession.cancelledAt = new Date();
  liveSession.cancelReason =
    String(params.cancelReason || "").trim() || "Cancelled.";
  liveSession.activeItemId = null as any;
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

  await connectDB();

  const liveSession = await loadWorkspaceLiveSessionDetailRow({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
  });
  if (
    !liveSession ||
    !isLiveSessionVisibleToStudent({
      liveSession,
      studentPlacement: params.studentPlacement,
    })
  ) {
    return null;
  }

  const attendanceRow = await loadStudentLiveSessionAttendanceRow({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
    studentId: params.studentId,
  });
  const workspaceDetail = serializeWorkspaceDetail(
    liveSession,
    attendanceRow ? [attendanceRow] : [],
  );
  const session = serializeStudentSummary(
    workspaceDetail,
    workspaceDetail.attendance[0] || null,
  );
  const studentJoinUrlLabel = resolveStudentJoinUrlLabel(
    workspaceDetail.studentJoinUrl,
  );
  const v2State = await loadStudentLiveSessionV2State({
    schoolKey: params.schoolKey,
    liveSessionId: params.liveSessionId,
    studentId: params.studentId,
    activeItemId: toId(liveSession?.activeItemId),
  });

  return {
    ...session,
    studentJoinUrl: workspaceDetail.studentJoinUrl,
    studentJoinUrlLabel,
    ...v2State,
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

export async function recordStudentLiveSessionPresence(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  } | null;
  liveSessionId: string;
}) {
  const MIN_PRESENCE_MS = 2 * 60 * 1000;

  if (isMockedE2ETestMode()) {
    return {
      attendanceStatus: "present" as const,
    };
  }

  await connectDB();

  const detail = await getStudentLiveSessionById(params);
  if (!detail) {
    return null;
  }

  if (!detail.canJoin) {
    return {
      attendanceStatus: detail.attendanceStatus || "invited",
    };
  }

  const { LiveSessionAttendance: LiveSessionAttendanceModel } =
    await getTenantModels(params.schoolKey, ["LiveSessionAttendance"]);

  const attendance = await LiveSessionAttendanceModel.findOne({
    liveSession: params.liveSessionId,
    student: params.studentId,
  });

  let attendanceStatus: LiveSessionAttendanceStatus = "joined";

  if (!attendance) {
    const now = new Date();
    await LiveSessionAttendanceModel.create({
      liveSession: params.liveSessionId,
      student: params.studentId,
      joinClicks: 0,
      firstJoinedAt: now,
      lastJoinedAt: now,
      status: "joined",
    });
    attendanceStatus = "joined";
  } else {
    const now = new Date();
    attendance.firstJoinedAt = attendance.firstJoinedAt || now;
    attendance.lastJoinedAt = now;
    const currentStatus = String(attendance.status || "");
    const hasManualOverride = Boolean(attendance.markedBy);
    const elapsedMs =
      attendance.firstJoinedAt instanceof Date
        ? now.getTime() - attendance.firstJoinedAt.getTime()
        : 0;
    if (
      !hasManualOverride &&
      (currentStatus === "invited" || currentStatus === "joined") &&
      elapsedMs >= MIN_PRESENCE_MS
    ) {
      attendance.status = "present";
    }
    await attendance.save();
    attendanceStatus = (attendance.status as LiveSessionAttendanceStatus) || "joined";
  }

  await invalidateStudentDashboardCacheForStudents(
    params.schoolKey,
    [params.studentId],
  ).catch(() => undefined);

  return {
    attendanceStatus,
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
