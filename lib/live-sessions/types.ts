import type {
  CourseClassSummary,
  CourseScopeSection,
  CourseSubjectSummary,
} from "@/lib/courses/types";
import type {
  WorkspaceAcademicSectionItem,
  WorkspaceClassItem,
  WorkspaceSubjectItem,
} from "@/lib/workspace/support-types";

export type LiveSessionStatus =
  | "draft"
  | "scheduled"
  | "live"
  | "completed"
  | "cancelled";

export type LiveSessionAttendanceStatus =
  | "invited"
  | "joined"
  | "present"
  | "absent";

export type LiveSessionTeacherSummary = {
  _id: string;
  name: string;
};

export type LiveSessionSupportTeacher = LiveSessionTeacherSummary & {
  classIds: string[];
  academicSectionIds: string[];
  subjectIds: string[];
  hasAllClasses: boolean;
  hasAllSections: boolean;
  hasAllSubjects: boolean;
};

export type LiveSessionWorkspaceSupportData = {
  classes: WorkspaceClassItem[];
  sections: WorkspaceAcademicSectionItem[];
  subjects: WorkspaceSubjectItem[];
  teachers: LiveSessionSupportTeacher[];
  defaultHostTeacherId: string | null;
};

export type LiveSessionSummaryBase = {
  _id: string;
  title: string;
  description: string;
  class: CourseClassSummary | null;
  subject: CourseSubjectSummary | null;
  assignedAcademicSections: CourseScopeSection[];
  hostTeacher: LiveSessionTeacherSummary | null;
  status: LiveSessionStatus;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  notificationRevision: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type LiveSessionAttendanceSummary = {
  studentId: string;
  studentName: string;
  rollNumber: string | null;
  academicSectionName: string | null;
  joinClicks: number;
  firstJoinedAt: string | null;
  lastJoinedAt: string | null;
  status: LiveSessionAttendanceStatus;
  markedByName: string | null;
  markedAt: string | null;
};

export type WorkspaceLiveSessionSummary = LiveSessionSummaryBase & {
  audienceCount: number;
  joinedCount: number;
  presentCount: number;
  absentCount: number;
};

export type WorkspaceLiveSessionDetail = WorkspaceLiveSessionSummary & {
  studentJoinUrl: string;
  hostJoinUrl: string | null;
  meetingCode: string | null;
  meetingPasscode: string | null;
  joinInstructions: string | null;
  attendance: LiveSessionAttendanceSummary[];
};

export type StudentLiveSessionSummary = LiveSessionSummaryBase & {
  joinInstructions: string | null;
  meetingCode: string | null;
  meetingPasscode: string | null;
  attendanceStatus: LiveSessionAttendanceStatus | null;
  joinClicks: number;
  canJoin: boolean;
  joinHref: string;
};

export type StudentLiveSessionDetail = StudentLiveSessionSummary & {
  studentJoinUrlLabel: string;
};
