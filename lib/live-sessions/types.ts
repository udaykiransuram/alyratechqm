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

export type LiveSessionItemType = "single" | "multiple" | "short-text";

export type LiveSessionItemStatus =
  | "draft"
  | "active"
  | "closed"
  | "archived";

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

export type LiveSessionItemOption = {
  index: number;
  contentHtml: string;
};

export type LiveSessionObjectiveOptionStat = {
  optionIndex: number;
  responseCount: number;
};

export type LiveSessionTeacherItem = {
  _id: string;
  type: LiveSessionItemType;
  promptHtml: string;
  options: LiveSessionItemOption[];
  answerIndexes: number[];
  tagIds: string[];
  explanationHtml: string;
  status: LiveSessionItemStatus;
  order: number;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  responseCount: number;
  correctCount: number | null;
  incorrectCount: number | null;
  optionStats: LiveSessionObjectiveOptionStat[];
};

export type LiveSessionStudentItem = {
  _id: string;
  type: LiveSessionItemType;
  promptHtml: string;
  options: LiveSessionItemOption[];
  status: LiveSessionItemStatus;
  order: number;
  openedAt: string | null;
  closedAt: string | null;
};

export type LiveSessionStudentResponse = {
  itemId: string;
  selectedOptionIndexes: number[];
  answerHtml: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
};

export type LiveSessionTeacherTranscript = {
  rawText: string;
  summaryHtml: string;
  isPublished: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
};

export type LiveSessionPublishedTranscript = {
  summaryHtml: string;
  updatedAt: string | null;
};

export type LiveSessionItemResponseSummary = {
  studentId: string;
  studentName: string;
  rollNumber: string | null;
  academicSectionName: string | null;
  selectedOptionIndexes: number[];
  answerHtml: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
  isCorrect: boolean | null;
};

export type LiveSessionItemResponsePage = {
  itemId: string;
  page: number;
  pages: number;
  total: number;
  limit: number;
  responses: LiveSessionItemResponseSummary[];
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
  shareHref: string;
  activeItem: LiveSessionTeacherItem | null;
  items: LiveSessionTeacherItem[];
  transcript: LiveSessionTeacherTranscript | null;
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
  studentJoinUrl: string;
  studentJoinUrlLabel: string;
  shareHref: string;
  activeItem: LiveSessionStudentItem | null;
  studentResponse: LiveSessionStudentResponse | null;
  publishedTranscriptSummary: LiveSessionPublishedTranscript | null;
};
