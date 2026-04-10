import {
  filterEligibleLiveSessionTeachers,
  isLiveSessionJoinable,
} from "@/lib/live-sessions/shared";
import type {
  LiveSessionAttendanceStatus,
  LiveSessionStatus,
  LiveSessionSupportTeacher,
  LiveSessionWorkspaceSupportData,
  StudentLiveSessionDetail,
  StudentLiveSessionSummary,
  WorkspaceLiveSessionDetail,
  WorkspaceLiveSessionSummary,
} from "@/lib/live-sessions/types";
import {
  MOCK_CLASS_ID,
  MOCK_SECTION_ID,
  MOCK_SUBJECT_MATH_ID,
  MOCK_SUBJECT_SCIENCE_ID,
  getMockWorkspaceClasses,
  getMockWorkspaceSections,
  getMockWorkspaceSubjects,
} from "@/lib/test-fixtures/learning-content";

export const MOCK_LIVE_SESSION_UPCOMING_ID = "live-session-upcoming-1";
export const MOCK_LIVE_SESSION_LIVE_ID = "live-session-live-1";
export const MOCK_LIVE_SESSION_COMPLETED_ID = "live-session-completed-1";
export const MOCK_LIVE_SESSION_CANCELLED_ID = "live-session-cancelled-1";
export const MOCK_LIVE_SESSION_TEACHER_ID = "live-session-teacher-1";
export const MOCK_LIVE_SESSION_TEACHER_TWO_ID = "live-session-teacher-2";

type MockStudent = {
  _id: string;
  name: string;
  rollNumber: string | null;
  classId: string;
  academicSectionId: string | null;
  academicSectionName: string | null;
};

type MockLiveSessionRecord = {
  _id: string;
  title: string;
  description: string;
  classId: string;
  subjectId: string;
  assignedAcademicSectionIds: string[];
  hostTeacherId: string;
  createdBy: string;
  updatedBy: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  studentJoinUrl: string;
  hostJoinUrl: string | null;
  meetingCode: string | null;
  meetingPasscode: string | null;
  joinInstructions: string | null;
  status: LiveSessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  notificationRevision: number;
  createdAt: string;
  updatedAt: string;
};

type MockLiveSessionAttendanceRecord = {
  liveSessionId: string;
  studentId: string;
  studentName: string;
  rollNumber: string | null;
  academicSectionId: string | null;
  academicSectionName: string | null;
  joinClicks: number;
  firstJoinedAt: string | null;
  lastJoinedAt: string | null;
  status: LiveSessionAttendanceStatus;
  markedBy: string | null;
  markedByName: string | null;
  markedAt: string | null;
};

type MockLiveSessionState = {
  sessions: Map<string, MockLiveSessionRecord>;
  attendanceBySessionId: Map<string, Map<string, MockLiveSessionAttendanceRecord>>;
};

const MOCK_LIVE_SESSION_STUDENTS: MockStudent[] = [
  {
    _id: "student-1",
    name: "Aarav",
    rollNumber: "12",
    classId: MOCK_CLASS_ID,
    academicSectionId: MOCK_SECTION_ID,
    academicSectionName: "Watson",
  },
  {
    _id: "student-2",
    name: "Diya",
    rollNumber: "07",
    classId: MOCK_CLASS_ID,
    academicSectionId: MOCK_SECTION_ID,
    academicSectionName: "Watson",
  },
  {
    _id: "student-3",
    name: "Kabir",
    rollNumber: "21",
    classId: MOCK_CLASS_ID,
    academicSectionId: MOCK_SECTION_ID,
    academicSectionName: "Watson",
  },
];

const MOCK_LIVE_SESSION_TEACHERS: LiveSessionSupportTeacher[] = [
  {
    _id: MOCK_LIVE_SESSION_TEACHER_ID,
    name: "Mock Mathematics Teacher",
    classIds: [MOCK_CLASS_ID],
    academicSectionIds: [MOCK_SECTION_ID],
    subjectIds: [MOCK_SUBJECT_MATH_ID],
    hasAllClasses: false,
    hasAllSections: true,
    hasAllSubjects: false,
  },
  {
    _id: MOCK_LIVE_SESSION_TEACHER_TWO_ID,
    name: "Mock Science Teacher",
    classIds: [MOCK_CLASS_ID],
    academicSectionIds: [MOCK_SECTION_ID],
    subjectIds: [MOCK_SUBJECT_SCIENCE_ID],
    hasAllClasses: false,
    hasAllSections: true,
    hasAllSubjects: false,
  },
];

function cloneForTransport<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getState() {
  const globalState = globalThis as typeof globalThis & {
    __mockLiveSessionState?: MockLiveSessionState;
  };

  if (!globalState.__mockLiveSessionState) {
    globalState.__mockLiveSessionState = buildInitialMockLiveSessionState();
  }

  return globalState.__mockLiveSessionState;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function createRelativeIso(minutesFromNow: number) {
  return addMinutes(new Date(), minutesFromNow).toISOString();
}

function buildInitialMockLiveSessionState(): MockLiveSessionState {
  const sessions = new Map<string, MockLiveSessionRecord>();
  const attendanceBySessionId = new Map<
    string,
    Map<string, MockLiveSessionAttendanceRecord>
  >();

  const baseSessions: MockLiveSessionRecord[] = [
    {
      _id: MOCK_LIVE_SESSION_UPCOMING_ID,
      title: "Mathematics Live Doubt Clinic",
      description:
        "A guided live problem-solving session focused on common algebra mistakes before the weekly review.",
      classId: MOCK_CLASS_ID,
      subjectId: MOCK_SUBJECT_MATH_ID,
      assignedAcademicSectionIds: [MOCK_SECTION_ID],
      hostTeacherId: MOCK_LIVE_SESSION_TEACHER_ID,
      createdBy: "workspace-admin-1",
      updatedBy: "workspace-admin-1",
      scheduledStartAt: createRelativeIso(18 * 60),
      scheduledEndAt: createRelativeIso(19 * 60),
      studentJoinUrl: "https://meet.example.com/student/math-live-clinic",
      hostJoinUrl: "https://meet.example.com/host/math-live-clinic",
      meetingCode: "MATH-204",
      meetingPasscode: "ALGEBRA",
      joinInstructions:
        "Join five minutes early and keep your notebook ready for worked examples.",
      status: "scheduled",
      startedAt: null,
      endedAt: null,
      cancelledAt: null,
      cancelReason: null,
      notificationRevision: 2,
      createdAt: createRelativeIso(-3 * 24 * 60),
      updatedAt: createRelativeIso(-60),
    },
    {
      _id: MOCK_LIVE_SESSION_LIVE_ID,
      title: "Science Lab Readiness Session",
      description:
        "A short live walkthrough covering observation notes, viva expectations, and lab safety reminders.",
      classId: MOCK_CLASS_ID,
      subjectId: MOCK_SUBJECT_SCIENCE_ID,
      assignedAcademicSectionIds: [MOCK_SECTION_ID],
      hostTeacherId: MOCK_LIVE_SESSION_TEACHER_TWO_ID,
      createdBy: "workspace-admin-1",
      updatedBy: "workspace-admin-1",
      scheduledStartAt: createRelativeIso(-15),
      scheduledEndAt: createRelativeIso(45),
      studentJoinUrl: "https://meet.example.com/student/science-lab-readiness",
      hostJoinUrl: "https://meet.example.com/host/science-lab-readiness",
      meetingCode: "SCI-108",
      meetingPasscode: "LABREADY",
      joinInstructions:
        "Keep your practical record beside you and be ready to answer short viva prompts.",
      status: "live",
      startedAt: createRelativeIso(-12),
      endedAt: null,
      cancelledAt: null,
      cancelReason: null,
      notificationRevision: 1,
      createdAt: createRelativeIso(-2 * 24 * 60),
      updatedAt: createRelativeIso(-10),
    },
    {
      _id: MOCK_LIVE_SESSION_COMPLETED_ID,
      title: "Weekly Exam Strategy Session",
      description:
        "A recap session on pacing, review order, and how to avoid blank-answer panic late in a test.",
      classId: MOCK_CLASS_ID,
      subjectId: MOCK_SUBJECT_MATH_ID,
      assignedAcademicSectionIds: [MOCK_SECTION_ID],
      hostTeacherId: MOCK_LIVE_SESSION_TEACHER_ID,
      createdBy: "workspace-admin-1",
      updatedBy: "workspace-admin-1",
      scheduledStartAt: createRelativeIso(-26 * 60),
      scheduledEndAt: createRelativeIso(-25 * 60),
      studentJoinUrl: "https://meet.example.com/student/exam-strategy",
      hostJoinUrl: null,
      meetingCode: "MATH-STRATEGY",
      meetingPasscode: null,
      joinInstructions: "Review the attached checklist before joining.",
      status: "completed",
      startedAt: createRelativeIso(-26 * 60),
      endedAt: createRelativeIso(-25 * 60),
      cancelledAt: null,
      cancelReason: null,
      notificationRevision: 1,
      createdAt: createRelativeIso(-5 * 24 * 60),
      updatedAt: createRelativeIso(-24 * 60),
    },
    {
      _id: MOCK_LIVE_SESSION_CANCELLED_ID,
      title: "Science Revision Sprint",
      description:
        "Cancelled mock session kept in the history list so students can still see the update state.",
      classId: MOCK_CLASS_ID,
      subjectId: MOCK_SUBJECT_SCIENCE_ID,
      assignedAcademicSectionIds: [MOCK_SECTION_ID],
      hostTeacherId: MOCK_LIVE_SESSION_TEACHER_TWO_ID,
      createdBy: "workspace-admin-1",
      updatedBy: "workspace-admin-1",
      scheduledStartAt: createRelativeIso(30 * 60),
      scheduledEndAt: createRelativeIso(31 * 60),
      studentJoinUrl: "https://meet.example.com/student/science-revision-sprint",
      hostJoinUrl: null,
      meetingCode: "SCI-REVISION",
      meetingPasscode: null,
      joinInstructions: "Cancelled pending lab scheduling confirmation.",
      status: "cancelled",
      startedAt: null,
      endedAt: null,
      cancelledAt: createRelativeIso(-30),
      cancelReason: "Host teacher moved the session to the next day.",
      notificationRevision: 3,
      createdAt: createRelativeIso(-24 * 60),
      updatedAt: createRelativeIso(-30),
    },
  ];

  baseSessions.forEach((session) => {
    sessions.set(session._id, session);
  });

  const buildAttendanceMap = (
    liveSessionId: string,
    seed: Partial<
      Record<
        string,
        Partial<
          Pick<
            MockLiveSessionAttendanceRecord,
            | "joinClicks"
            | "firstJoinedAt"
            | "lastJoinedAt"
            | "status"
            | "markedBy"
            | "markedByName"
            | "markedAt"
          >
        >
      >
    > = {},
  ) => {
    const attendance = new Map<string, MockLiveSessionAttendanceRecord>();
    type AttendanceSeed = NonNullable<(typeof seed)[string]>;

    MOCK_LIVE_SESSION_STUDENTS.forEach((student) => {
      const seeded: AttendanceSeed = seed[student._id] || {};
      attendance.set(student._id, {
        liveSessionId,
        studentId: student._id,
        studentName: student.name,
        rollNumber: student.rollNumber,
        academicSectionId: student.academicSectionId,
        academicSectionName: student.academicSectionName,
        joinClicks: seeded.joinClicks ?? 0,
        firstJoinedAt: seeded.firstJoinedAt ?? null,
        lastJoinedAt: seeded.lastJoinedAt ?? null,
        status: seeded.status ?? "invited",
        markedBy: seeded.markedBy ?? null,
        markedByName: seeded.markedByName ?? null,
        markedAt: seeded.markedAt ?? null,
      });
    });

    return attendance;
  };

  attendanceBySessionId.set(
    MOCK_LIVE_SESSION_UPCOMING_ID,
    buildAttendanceMap(MOCK_LIVE_SESSION_UPCOMING_ID),
  );
  attendanceBySessionId.set(
    MOCK_LIVE_SESSION_LIVE_ID,
    buildAttendanceMap(MOCK_LIVE_SESSION_LIVE_ID, {
      "student-1": {
        joinClicks: 1,
        firstJoinedAt: createRelativeIso(-11),
        lastJoinedAt: createRelativeIso(-8),
        status: "joined",
      },
      "student-2": {
        joinClicks: 1,
        firstJoinedAt: createRelativeIso(-9),
        lastJoinedAt: createRelativeIso(-3),
        status: "present",
        markedBy: MOCK_LIVE_SESSION_TEACHER_TWO_ID,
        markedByName: "Mock Science Teacher",
        markedAt: createRelativeIso(-2),
      },
    }),
  );
  attendanceBySessionId.set(
    MOCK_LIVE_SESSION_COMPLETED_ID,
    buildAttendanceMap(MOCK_LIVE_SESSION_COMPLETED_ID, {
      "student-1": {
        joinClicks: 1,
        firstJoinedAt: createRelativeIso(-26 * 60 + 4),
        lastJoinedAt: createRelativeIso(-26 * 60 + 31),
        status: "present",
        markedBy: MOCK_LIVE_SESSION_TEACHER_ID,
        markedByName: "Mock Mathematics Teacher",
        markedAt: createRelativeIso(-25 * 60 + 10),
      },
      "student-2": {
        status: "absent",
        markedBy: MOCK_LIVE_SESSION_TEACHER_ID,
        markedByName: "Mock Mathematics Teacher",
        markedAt: createRelativeIso(-25 * 60 + 12),
      },
    }),
  );
  attendanceBySessionId.set(
    MOCK_LIVE_SESSION_CANCELLED_ID,
    buildAttendanceMap(MOCK_LIVE_SESSION_CANCELLED_ID),
  );

  return {
    sessions,
    attendanceBySessionId,
  };
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

function mapAttendanceSummary(
  record: MockLiveSessionAttendanceRecord,
): WorkspaceLiveSessionDetail["attendance"][number] {
  return {
    studentId: record.studentId,
    studentName: record.studentName,
    rollNumber: record.rollNumber,
    academicSectionName: record.academicSectionName,
    joinClicks: record.joinClicks,
    firstJoinedAt: record.firstJoinedAt,
    lastJoinedAt: record.lastJoinedAt,
    status: record.status,
    markedByName: record.markedByName,
    markedAt: record.markedAt,
  };
}

function getTeacherById(teacherId: string) {
  return (
    MOCK_LIVE_SESSION_TEACHERS.find((teacher) => teacher._id === teacherId) ||
    null
  );
}

function getClassSummary(classId: string) {
  const item = getMockWorkspaceClasses().find((entry) => entry._id === classId);
  return item
    ? {
        _id: item._id,
        name: item.name,
      }
    : null;
}

function getSubjectSummary(subjectId: string) {
  const item = getMockWorkspaceSubjects().find((entry) => entry._id === subjectId);
  return item
    ? {
        _id: item._id,
        name: item.name,
      }
    : null;
}

function getSectionSummaries(sectionIds: string[]) {
  const sectionIdSet = new Set(uniqueIds(sectionIds));
  return getMockWorkspaceSections()
    .filter((section) => sectionIdSet.has(section._id))
    .map((section) => ({
      _id: section._id,
      name: section.name,
      class:
        typeof section.class === "string"
          ? getClassSummary(section.class)
          : section.class
            ? {
                _id: section.class._id,
                name: section.class.name,
              }
            : null,
    }));
}

function getAudienceStudents(session: MockLiveSessionRecord) {
  const scopedSectionIds = uniqueIds(session.assignedAcademicSectionIds);

  return MOCK_LIVE_SESSION_STUDENTS.filter((student) => {
    if (student.classId !== session.classId) {
      return false;
    }

    if (scopedSectionIds.length === 0) {
      return true;
    }

    return Boolean(
      student.academicSectionId &&
        scopedSectionIds.includes(student.academicSectionId),
    );
  });
}

function syncAudienceAttendance(sessionId: string) {
  const state = getState();
  const session = state.sessions.get(sessionId);
  if (!session) {
    return [];
  }

  const audience = getAudienceStudents(session);
  const audienceIds = new Set(audience.map((student) => student._id));
  const attendance =
    state.attendanceBySessionId.get(sessionId) ||
    new Map<string, MockLiveSessionAttendanceRecord>();

  audience.forEach((student) => {
    if (attendance.has(student._id)) {
      return;
    }

    attendance.set(student._id, {
      liveSessionId: sessionId,
      studentId: student._id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      academicSectionId: student.academicSectionId,
      academicSectionName: student.academicSectionName,
      joinClicks: 0,
      firstJoinedAt: null,
      lastJoinedAt: null,
      status: "invited",
      markedBy: null,
      markedByName: null,
      markedAt: null,
    });
  });

  Array.from(attendance.keys()).forEach((studentId) => {
    if (!audienceIds.has(studentId)) {
      attendance.delete(studentId);
    }
  });

  state.attendanceBySessionId.set(sessionId, attendance);
  return Array.from(attendance.values());
}

function getSortedAttendance(sessionId: string) {
  return syncAudienceAttendance(sessionId)
    .map(mapAttendanceSummary)
    .sort((left, right) =>
      `${left.studentName} ${left.rollNumber || ""}`.localeCompare(
        `${right.studentName} ${right.rollNumber || ""}`,
      ),
    );
}

function serializeWorkspaceSession(
  session: MockLiveSessionRecord,
): WorkspaceLiveSessionDetail {
  const attendance = getSortedAttendance(session._id);
  const joinedCount = attendance.filter((item) => item.joinClicks > 0).length;
  const presentCount = attendance.filter((item) => item.status === "present").length;
  const absentCount = attendance.filter((item) => item.status === "absent").length;
  const hostTeacher = getTeacherById(session.hostTeacherId);

  return {
    _id: session._id,
    title: session.title,
    description: session.description,
    class: getClassSummary(session.classId),
    subject: getSubjectSummary(session.subjectId),
    assignedAcademicSections: getSectionSummaries(session.assignedAcademicSectionIds),
    hostTeacher: hostTeacher
      ? {
          _id: hostTeacher._id,
          name: hostTeacher.name,
        }
      : null,
    status: session.status,
    scheduledStartAt: session.scheduledStartAt,
    scheduledEndAt: session.scheduledEndAt,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    cancelledAt: session.cancelledAt,
    cancelReason: session.cancelReason,
    notificationRevision: session.notificationRevision,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    audienceCount: attendance.length,
    joinedCount,
    presentCount,
    absentCount,
    studentJoinUrl: session.studentJoinUrl,
    hostJoinUrl: session.hostJoinUrl,
    meetingCode: session.meetingCode,
    meetingPasscode: session.meetingPasscode,
    joinInstructions: session.joinInstructions,
    attendance,
  };
}

function serializeWorkspaceSummary(
  session: MockLiveSessionRecord,
): WorkspaceLiveSessionSummary {
  const detail = serializeWorkspaceSession(session);
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

function resolveStudentJoinUrlLabel(url: string) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./i, "");
    return hostname ? `Join via ${hostname}` : "Join live class";
  } catch {
    return "Join live class";
  }
}

function serializeStudentSummary(
  session: MockLiveSessionRecord,
  studentId: string,
): StudentLiveSessionSummary {
  const detail = serializeWorkspaceSession(session);
  const attendance = detail.attendance.find((item) => item.studentId === studentId);

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
    joinInstructions: detail.joinInstructions,
    meetingCode: detail.meetingCode,
    meetingPasscode: detail.meetingPasscode,
    attendanceStatus: attendance?.status || null,
    joinClicks: attendance?.joinClicks || 0,
    canJoin: isLiveSessionJoinable({
      status: detail.status,
      scheduledEndAt: detail.scheduledEndAt,
    }),
    joinHref: `/api/student/live-sessions/${detail._id}/join`,
  };
}

function matchesTeacherScope(
  session: MockLiveSessionRecord,
  viewerId: string,
) {
  const teacher = getTeacherById(viewerId);
  if (!teacher) {
    return false;
  }

  const eligibleTeachers = filterEligibleLiveSessionTeachers({
    teachers: [teacher],
    classId: session.classId,
    subjectId: session.subjectId,
    assignedAcademicSectionIds: session.assignedAcademicSectionIds,
  });

  return eligibleTeachers.length > 0;
}

function sortSessions(left: MockLiveSessionRecord, right: MockLiveSessionRecord) {
  const rank = (value: LiveSessionStatus) => {
    if (value === "live") return 0;
    if (value === "scheduled") return 1;
    if (value === "draft") return 2;
    if (value === "completed") return 3;
    return 4;
  };

  const rankDiff = rank(left.status) - rank(right.status);
  if (rankDiff !== 0) {
    return rankDiff;
  }

  return (
    new Date(left.scheduledStartAt).getTime() -
    new Date(right.scheduledStartAt).getTime()
  );
}

export function getMockLiveSessionSupportData(params: {
  viewerRole: "admin" | "teacher";
  viewerId: string;
}): LiveSessionWorkspaceSupportData {
  const classes = getMockWorkspaceClasses();
  const sections = getMockWorkspaceSections();
  const subjects = getMockWorkspaceSubjects();

  if (params.viewerRole !== "teacher") {
    return cloneForTransport({
      classes,
      sections,
      subjects,
      teachers: MOCK_LIVE_SESSION_TEACHERS,
      defaultHostTeacherId: null,
    });
  }

  const teacher =
    getTeacherById(params.viewerId) || getTeacherById(MOCK_LIVE_SESSION_TEACHER_ID);

  if (!teacher) {
    return cloneForTransport({
      classes: [],
      sections: [],
      subjects: [],
      teachers: [],
      defaultHostTeacherId: null,
    });
  }

  const allowedClassIds = new Set(teacher.classIds);
  const allowedSectionIds = new Set(teacher.academicSectionIds);
  const allowedSubjectIds = new Set(teacher.subjectIds);

  return cloneForTransport({
    classes: teacher.hasAllClasses
      ? classes
      : classes.filter((item) => allowedClassIds.has(item._id)),
    sections: sections.filter((item) => {
      const sectionClassId = toId(item.class);
      if (!teacher.hasAllClasses && !allowedClassIds.has(sectionClassId)) {
        return false;
      }

      if (teacher.hasAllSections) {
        return true;
      }

      return allowedSectionIds.has(item._id);
    }),
    subjects: teacher.hasAllSubjects
      ? subjects
      : subjects.filter((item) => allowedSubjectIds.has(item._id)),
    teachers: [teacher],
    defaultHostTeacherId: teacher._id,
  });
}

export function listMockWorkspaceLiveSessions(params?: {
  viewerRole?: "admin" | "teacher";
  viewerId?: string;
  filters?: {
    status?: string;
    classId?: string;
    subjectId?: string;
    hostTeacherId?: string;
  };
}) {
  const state = getState();
  const sessions = Array.from(state.sessions.values())
    .filter((session) => {
      if (params?.viewerRole === "teacher") {
        const viewerId = String(params.viewerId || "").trim();
        if (!viewerId || !matchesTeacherScope(session, viewerId)) {
          return false;
        }
      }

      if (params?.filters?.status && session.status !== params.filters.status) {
        return false;
      }

      if (params?.filters?.classId && session.classId !== params.filters.classId) {
        return false;
      }

      if (
        params?.filters?.subjectId &&
        session.subjectId !== params.filters.subjectId
      ) {
        return false;
      }

      if (
        params?.filters?.hostTeacherId &&
        session.hostTeacherId !== params.filters.hostTeacherId
      ) {
        return false;
      }

      return true;
    })
    .sort(sortSessions)
    .map(serializeWorkspaceSummary);

  return cloneForTransport(sessions);
}

export function getMockWorkspaceLiveSessionDetail(params: {
  liveSessionId: string;
  viewerRole?: "admin" | "teacher";
  viewerId?: string;
}) {
  const state = getState();
  const session = state.sessions.get(String(params.liveSessionId || "").trim());
  if (!session) {
    return null;
  }

  if (params.viewerRole === "teacher") {
    const viewerId = String(params.viewerId || "").trim();
    if (!viewerId || !matchesTeacherScope(session, viewerId)) {
      return null;
    }
  }

  return cloneForTransport(serializeWorkspaceSession(session));
}

export function getMockLiveSessionAudienceStudentIds(liveSessionId: string) {
  return getSortedAttendance(liveSessionId).map((item) => item.studentId);
}

export function createMockLiveSession(params: {
  title: string;
  description?: string | null;
  classId: string;
  subjectId: string;
  assignedAcademicSectionIds?: string[];
  hostTeacherId: string;
  createdBy: string;
  updatedBy: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  studentJoinUrl: string;
  hostJoinUrl?: string | null;
  meetingCode?: string | null;
  meetingPasscode?: string | null;
  joinInstructions?: string | null;
  status: LiveSessionStatus;
  notificationRevision?: number;
}) {
  const state = getState();
  const id = `live-session-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const now = new Date().toISOString();

  const session: MockLiveSessionRecord = {
    _id: id,
    title: String(params.title || "").trim(),
    description: String(params.description || "").trim(),
    classId: String(params.classId || "").trim(),
    subjectId: String(params.subjectId || "").trim(),
    assignedAcademicSectionIds: uniqueIds(params.assignedAcademicSectionIds),
    hostTeacherId: String(params.hostTeacherId || "").trim(),
    createdBy: String(params.createdBy || "").trim(),
    updatedBy: String(params.updatedBy || "").trim(),
    scheduledStartAt: String(params.scheduledStartAt || "").trim(),
    scheduledEndAt: String(params.scheduledEndAt || "").trim(),
    studentJoinUrl: String(params.studentJoinUrl || "").trim(),
    hostJoinUrl: String(params.hostJoinUrl || "").trim() || null,
    meetingCode: String(params.meetingCode || "").trim() || null,
    meetingPasscode: String(params.meetingPasscode || "").trim() || null,
    joinInstructions: String(params.joinInstructions || "").trim() || null,
    status: params.status,
    startedAt: params.status === "live" ? now : null,
    endedAt: params.status === "completed" ? now : null,
    cancelledAt: params.status === "cancelled" ? now : null,
    cancelReason: params.status === "cancelled" ? "Cancelled." : null,
    notificationRevision: Math.max(
      0,
      Math.trunc(Number(params.notificationRevision || 0)),
    ),
    createdAt: now,
    updatedAt: now,
  };

  state.sessions.set(id, session);
  syncAudienceAttendance(id);
  return cloneForTransport(serializeWorkspaceSession(session));
}

export function updateMockLiveSession(
  liveSessionId: string,
  updates: Partial<
    Pick<
      MockLiveSessionRecord,
      | "title"
      | "description"
      | "classId"
      | "subjectId"
      | "assignedAcademicSectionIds"
      | "hostTeacherId"
      | "updatedBy"
      | "scheduledStartAt"
      | "scheduledEndAt"
      | "studentJoinUrl"
      | "hostJoinUrl"
      | "meetingCode"
      | "meetingPasscode"
      | "joinInstructions"
      | "status"
      | "startedAt"
      | "endedAt"
      | "cancelledAt"
      | "cancelReason"
      | "notificationRevision"
    >
  >,
) {
  const state = getState();
  const session = state.sessions.get(String(liveSessionId || "").trim());
  if (!session) {
    return null;
  }

  Object.assign(session, {
    ...updates,
    assignedAcademicSectionIds:
      updates.assignedAcademicSectionIds !== undefined
        ? uniqueIds(updates.assignedAcademicSectionIds)
        : session.assignedAcademicSectionIds,
    description:
      updates.description !== undefined
        ? String(updates.description || "").trim()
        : session.description,
    hostJoinUrl:
      updates.hostJoinUrl !== undefined
        ? String(updates.hostJoinUrl || "").trim() || null
        : session.hostJoinUrl,
    meetingCode:
      updates.meetingCode !== undefined
        ? String(updates.meetingCode || "").trim() || null
        : session.meetingCode,
    meetingPasscode:
      updates.meetingPasscode !== undefined
        ? String(updates.meetingPasscode || "").trim() || null
        : session.meetingPasscode,
    joinInstructions:
      updates.joinInstructions !== undefined
        ? String(updates.joinInstructions || "").trim() || null
        : session.joinInstructions,
    cancelReason:
      updates.cancelReason !== undefined
        ? String(updates.cancelReason || "").trim() || null
        : session.cancelReason,
    updatedAt: new Date().toISOString(),
  });

  syncAudienceAttendance(session._id);
  return cloneForTransport(serializeWorkspaceSession(session));
}

export function deleteMockLiveSession(liveSessionId: string) {
  const state = getState();
  const normalizedId = String(liveSessionId || "").trim();
  const deleted = state.sessions.delete(normalizedId);
  state.attendanceBySessionId.delete(normalizedId);
  return deleted;
}

export function updateMockLiveSessionAttendance(params: {
  liveSessionId: string;
  attendance: Array<{
    studentId: string;
    status: LiveSessionAttendanceStatus;
    markedBy: string;
    markedByName: string;
  }>;
}) {
  const state = getState();
  const sessionAttendance =
    state.attendanceBySessionId.get(String(params.liveSessionId || "").trim()) ||
    new Map<string, MockLiveSessionAttendanceRecord>();

  params.attendance.forEach((update) => {
    const record = sessionAttendance.get(String(update.studentId || "").trim());
    if (!record) {
      return;
    }

    record.status = update.status;
    record.markedBy = String(update.markedBy || "").trim() || null;
    record.markedByName = String(update.markedByName || "").trim() || null;
    record.markedAt = new Date().toISOString();
  });

  state.attendanceBySessionId.set(
    String(params.liveSessionId || "").trim(),
    sessionAttendance,
  );

  return getMockWorkspaceLiveSessionDetail({
    liveSessionId: params.liveSessionId,
  });
}

export function listMockStudentLiveSessions(params: {
  studentId: string;
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  } | null;
}) {
  const classId = String(params.studentPlacement?.classId || "").trim();
  const sectionId = String(params.studentPlacement?.academicSectionId || "").trim();

  if (!classId) {
    return [] as StudentLiveSessionSummary[];
  }

  const state = getState();
  const sessions = Array.from(state.sessions.values())
    .filter((session) => {
      if (session.status === "draft") {
        return false;
      }

      if (session.classId !== classId) {
        return false;
      }

      const assignedSectionIds = uniqueIds(session.assignedAcademicSectionIds);
      if (assignedSectionIds.length === 0) {
        return true;
      }

      return Boolean(sectionId && assignedSectionIds.includes(sectionId));
    })
    .sort(sortSessions)
    .map((session) => serializeStudentSummary(session, params.studentId));

  return cloneForTransport(sessions);
}

export function getMockStudentLiveSessionDetail(params: {
  liveSessionId: string;
  studentId: string;
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  } | null;
}) {
  const session = listMockStudentLiveSessions({
    studentId: params.studentId,
    studentPlacement: params.studentPlacement,
  }).find((item) => item._id === String(params.liveSessionId || "").trim());

  if (!session) {
    return null;
  }

  const workspaceDetail = getMockWorkspaceLiveSessionDetail({
    liveSessionId: params.liveSessionId,
  });
  if (!workspaceDetail) {
    return null;
  }

  return cloneForTransport({
    ...session,
    studentJoinUrlLabel: resolveStudentJoinUrlLabel(workspaceDetail.studentJoinUrl),
  } satisfies StudentLiveSessionDetail);
}

export function recordMockStudentLiveSessionJoin(params: {
  liveSessionId: string;
  studentId: string;
}) {
  const state = getState();
  const session = state.sessions.get(String(params.liveSessionId || "").trim());
  if (!session) {
    return null;
  }

  const attendanceRecords = syncAudienceAttendance(session._id);
  const matchingAttendance = attendanceRecords.find(
    (item) => item.studentId === String(params.studentId || "").trim(),
  );

  if (!matchingAttendance) {
    return null;
  }

  const attendanceMap =
    state.attendanceBySessionId.get(session._id) ||
    new Map<string, MockLiveSessionAttendanceRecord>();
  const attendance = attendanceMap.get(matchingAttendance.studentId);

  if (!attendance) {
    return null;
  }

  const now = new Date().toISOString();
  attendance.joinClicks += 1;
  attendance.firstJoinedAt = attendance.firstJoinedAt || now;
  attendance.lastJoinedAt = now;

  if (attendance.status === "invited") {
    attendance.status = "joined";
  }

  attendanceMap.set(attendance.studentId, attendance);
  state.attendanceBySessionId.set(session._id, attendanceMap);

  return {
    redirectUrl: session.studentJoinUrl,
    session: cloneForTransport(
      serializeStudentSummary(session, String(params.studentId || "").trim()),
    ),
  };
}
