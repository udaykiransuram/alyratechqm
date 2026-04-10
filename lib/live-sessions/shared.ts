import { resolveTeacherCourseScope } from "@/lib/courses/access";
import type {
  LiveSessionAttendanceStatus,
  LiveSessionSupportTeacher,
  LiveSessionStatus,
} from "@/lib/live-sessions/types";

export const LIVE_SESSION_STATUSES = [
  "draft",
  "scheduled",
  "live",
  "completed",
  "cancelled",
] as const satisfies readonly LiveSessionStatus[];

export const LIVE_SESSION_ATTENDANCE_STATUSES = [
  "invited",
  "joined",
  "present",
  "absent",
] as const satisfies readonly LiveSessionAttendanceStatus[];

export function toLiveSessionId(value: unknown) {
  if (!value) return "";

  if (
    typeof value === "object" &&
    value !== null &&
    "_id" in (value as Record<string, unknown>)
  ) {
    return String(
      (value as Record<string, unknown>)._id || "",
    ).trim();
  }

  return String(value || "").trim();
}

export function toLiveSessionOptionalString(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

export function normalizeLiveSessionDate(value: unknown) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function buildDefaultStudentNotificationDedupeKey(
  type: string,
  entityId: string,
) {
  return `${String(type || "").trim()}:${String(entityId || "").trim()}`;
}

export function buildLiveSessionNotificationDedupeKey(params: {
  type: string;
  sessionId: string;
  revision: number;
}) {
  const revision = Number.isFinite(params.revision)
    ? Math.max(0, Math.trunc(params.revision))
    : 0;

  return `${String(params.type || "").trim()}:${String(params.sessionId || "").trim()}:${revision}`;
}

export function buildLiveSessionNotificationEntityId(params: {
  sessionId: string;
  revision: number;
}) {
  const revision = Number.isFinite(params.revision)
    ? Math.max(0, Math.trunc(params.revision))
    : 0;

  return `${String(params.sessionId || "").trim()}:${revision}`;
}

export function resolveLiveSessionReminderAvailableAt(params: {
  scheduledStartAt: Date;
  now?: Date;
}) {
  const startAt = normalizeLiveSessionDate(params.scheduledStartAt);
  const now = normalizeLiveSessionDate(params.now) || new Date();

  if (!startAt) {
    return null;
  }

  if (startAt.getTime() <= now.getTime()) {
    return null;
  }

  const reminderAt = new Date(startAt.getTime() - 15 * 60 * 1000);
  return reminderAt.getTime() <= now.getTime() ? now : reminderAt;
}

export function isLiveSessionJoinable(params: {
  status?: string | null;
  scheduledEndAt?: string | Date | null;
  now?: Date;
}) {
  const status = String(params.status || "").trim();
  if (status === "draft" || status === "completed" || status === "cancelled") {
    return false;
  }

  const now = normalizeLiveSessionDate(params.now) || new Date();
  const scheduledEndAt = normalizeLiveSessionDate(params.scheduledEndAt);

  if (!scheduledEndAt) {
    return status === "scheduled" || status === "live";
  }

  return scheduledEndAt.getTime() >= now.getTime();
}

export function didLiveSessionScheduleChange(params: {
  before?: {
    title?: string | null;
    description?: string | null;
    classId?: string | null;
    subjectId?: string | null;
    assignedAcademicSectionIds?: string[] | null;
    hostTeacherId?: string | null;
    scheduledStartAt?: string | Date | null;
    scheduledEndAt?: string | Date | null;
    studentJoinUrl?: string | null;
    hostJoinUrl?: string | null;
    meetingCode?: string | null;
    meetingPasscode?: string | null;
    joinInstructions?: string | null;
    status?: string | null;
  } | null;
  after?: {
    title?: string | null;
    description?: string | null;
    classId?: string | null;
    subjectId?: string | null;
    assignedAcademicSectionIds?: string[] | null;
    hostTeacherId?: string | null;
    scheduledStartAt?: string | Date | null;
    scheduledEndAt?: string | Date | null;
    studentJoinUrl?: string | null;
    hostJoinUrl?: string | null;
    meetingCode?: string | null;
    meetingPasscode?: string | null;
    joinInstructions?: string | null;
    status?: string | null;
  } | null;
}) {
  const normalizeShape = (value: typeof params.before) =>
    JSON.stringify({
      title: String(value?.title || "").trim(),
      description: String(value?.description || "").trim(),
      classId: String(value?.classId || "").trim(),
      subjectId: String(value?.subjectId || "").trim(),
      assignedAcademicSectionIds: Array.from(
        new Set(
          (Array.isArray(value?.assignedAcademicSectionIds)
            ? value?.assignedAcademicSectionIds
            : []
          )
            .map((item) => String(item || "").trim())
            .filter(Boolean),
        ),
      ).sort(),
      hostTeacherId: String(value?.hostTeacherId || "").trim(),
      scheduledStartAt:
        normalizeLiveSessionDate(value?.scheduledStartAt)?.toISOString() || "",
      scheduledEndAt:
        normalizeLiveSessionDate(value?.scheduledEndAt)?.toISOString() || "",
      studentJoinUrl: String(value?.studentJoinUrl || "").trim(),
      hostJoinUrl: String(value?.hostJoinUrl || "").trim(),
      meetingCode: String(value?.meetingCode || "").trim(),
      meetingPasscode: String(value?.meetingPasscode || "").trim(),
      joinInstructions: String(value?.joinInstructions || "").trim(),
      status: String(value?.status || "").trim(),
    });

  return normalizeShape(params.before) !== normalizeShape(params.after);
}

export function filterEligibleLiveSessionTeachers(params: {
  teachers: LiveSessionSupportTeacher[];
  classId?: string;
  subjectId?: string;
  assignedAcademicSectionIds?: string[];
}) {
  const classId = String(params.classId || "").trim();
  const subjectId = String(params.subjectId || "").trim();
  const assignedAcademicSectionIds = Array.from(
    new Set(
      (Array.isArray(params.assignedAcademicSectionIds)
        ? params.assignedAcademicSectionIds
        : []
      )
        .map((sectionId) => String(sectionId || "").trim())
        .filter(Boolean),
    ),
  );

  if (!classId || !subjectId) {
    return [];
  }

  return (Array.isArray(params.teachers) ? params.teachers : []).filter(
    (teacher) => {
      const scope = resolveTeacherCourseScope(
        teacher,
        classId,
        [subjectId],
        assignedAcademicSectionIds,
      );

      if (!teacher.hasAllSections && assignedAcademicSectionIds.length === 0) {
        return false;
      }

      return (
        scope.hasClassAccess &&
        scope.hasSubjectAccess &&
        scope.hasSectionAccess
      );
    },
  );
}
