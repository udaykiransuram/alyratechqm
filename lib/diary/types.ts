export type DiaryStatus = "draft" | "published" | "archived";

export type DiaryStudentStateStatus = "not_seen" | "seen" | "completed";

export type DiaryResourceType = "image" | "youtube" | "file";

export type DiaryImageResource = {
  id: string;
  type: "image";
  url: string;
  altText?: string;
  caption?: string;
};

export type DiaryYoutubeResource = {
  id: string;
  type: "youtube";
  videoId: string;
  caption?: string;
};

export type DiaryFileResource = {
  id: string;
  type: "file";
  url: string;
  fileName: string;
  caption?: string;
};

export type DiaryResource =
  | DiaryImageResource
  | DiaryYoutubeResource
  | DiaryFileResource;

export type DiaryClassSummary = {
  _id: string;
  name: string;
};

export type DiarySubjectSummary = {
  _id: string;
  name: string;
};

export type DiarySectionSummary = {
  _id: string;
  name: string;
  class?: DiaryClassSummary | null;
};

export type DiaryAuthorSummary = {
  _id: string;
  name: string;
  role?: "admin" | "teacher" | "student";
};

export type DiaryContentSummary = {
  hasLessonSummary: boolean;
  hasHomework: boolean;
  hasTeacherNote: boolean;
  resourceCount: number;
};

export type DiaryProgressSummary = {
  assignedStudents: number;
  notSeenStudents: number;
  seenStudents: number;
  completedStudents: number;
};

export type DiaryStudentStateSnapshot = {
  status: DiaryStudentStateStatus;
  firstSeenAt: string | null;
  lastViewedAt: string | null;
  completedAt: string | null;
};

export type WorkspaceDiarySummary = {
  _id: string;
  title: string;
  entryDate: string;
  class: DiaryClassSummary | null;
  subject: DiarySubjectSummary | null;
  assignedAcademicSections: DiarySectionSummary[];
  status: DiaryStatus;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  author: DiaryAuthorSummary | null;
  updatedBy: DiaryAuthorSummary | null;
  content: DiaryContentSummary;
  progressSummary: DiaryProgressSummary;
};

export type DiaryRosterStudentState = {
  student: {
    _id: string;
    name: string;
    rollNumber?: string;
    academicSection?: DiarySectionSummary | null;
  };
  state: DiaryStudentStateSnapshot;
};

export type WorkspaceDiaryDetail = WorkspaceDiarySummary & {
  lessonSummaryHtml: string;
  homeworkHtml: string;
  teacherNoteHtml: string;
  resources: DiaryResource[];
  roster: DiaryRosterStudentState[];
};

export type StudentDiarySummary = {
  _id: string;
  title: string;
  entryDate: string;
  class: DiaryClassSummary | null;
  subject: DiarySubjectSummary | null;
  assignedAcademicSections: DiarySectionSummary[];
  publishedAt: string | null;
  updatedAt: string | null;
  author: DiaryAuthorSummary | null;
  content: DiaryContentSummary;
  state: DiaryStudentStateSnapshot;
};

export type StudentDiaryDetail = StudentDiarySummary & {
  lessonSummaryHtml: string;
  homeworkHtml: string;
  teacherNoteHtml: string;
  resources: DiaryResource[];
};

