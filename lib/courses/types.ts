export type CourseStatus = "draft" | "published" | "archived";

export type CourseProgressStatus = "not_started" | "in_progress" | "completed";

export type CourseBlockType =
  | "module"
  | "lesson"
  | "text"
  | "image"
  | "youtube"
  | "resource"
  | "announcement"
  | "assessment";

export type CourseImageFit = "contain" | "cover";
export type CourseImageWidth = "compact" | "standard" | "full";
export type CourseImageHeight = "small" | "medium" | "large" | "xlarge";
export type CourseAnnouncementTone = "info" | "success" | "warning";

export type CourseModuleBlock = {
  id: string;
  type: "module";
  title: string;
  summary?: string;
};

export type CourseLessonTextItem = {
  type: "text";
  contentHtml: string;
};

export type CourseLessonImageItem = {
  type: "image";
  imageUrl: string;
  altText?: string;
  caption?: string;
  imageFit: CourseImageFit;
  imageWidth: CourseImageWidth;
  imageHeight: CourseImageHeight;
};

export type CourseLessonYoutubeItem = {
  type: "youtube";
  videoId: string;
  caption?: string;
};

export type CourseLessonResourceItem = {
  type: "resource";
  title: string;
  fileUrl: string;
  fileName: string;
  caption?: string;
};

export type CourseLessonItem =
  | CourseLessonTextItem
  | CourseLessonImageItem
  | CourseLessonYoutubeItem
  | CourseLessonResourceItem;

export type CourseLessonBlock = {
  id: string;
  type: "lesson";
  title: string;
  summary?: string;
  estimatedMinutes?: number | null;
  items: CourseLessonItem[];
};

export type CourseTextBlock = {
  id: string;
  type: "text";
  contentHtml: string;
};

export type CourseImageBlock = {
  id: string;
  type: "image";
  imageUrl: string;
  altText?: string;
  caption?: string;
  imageFit: CourseImageFit;
  imageWidth: CourseImageWidth;
  imageHeight: CourseImageHeight;
};

export type CourseYoutubeBlock = {
  id: string;
  type: "youtube";
  videoId: string;
  caption?: string;
};

export type CourseResourceBlock = {
  id: string;
  type: "resource";
  title: string;
  fileUrl: string;
  fileName: string;
  caption?: string;
};

export type CourseAnnouncementBlock = {
  id: string;
  type: "announcement";
  title: string;
  contentHtml: string;
  tone: CourseAnnouncementTone;
};

export type CourseAssessmentBlock = {
  id: string;
  type: "assessment";
  questionPaperId: string;
  titleOverride?: string;
  required: boolean;
  minimumScorePct?: number | null;
};

export type CourseBlock =
  | CourseModuleBlock
  | CourseLessonBlock
  | CourseTextBlock
  | CourseImageBlock
  | CourseYoutubeBlock
  | CourseResourceBlock
  | CourseAnnouncementBlock
  | CourseAssessmentBlock;

export type CourseNote = {
  blockId: string;
  text: string;
  updatedAt: string;
};

export type CourseAvailabilityStatus =
  | "upcoming"
  | "active"
  | "overdue"
  | "completed";

export type CourseMetadata = {
  coverImageUrl?: string;
  coverImageAltText?: string;
  startsAt?: string | null;
  dueAt?: string | null;
  completionBadgeLabel?: string;
  enforceSequentialProgress: boolean;
  allowNotes: boolean;
  allowBookmarks: boolean;
  isTemplate: boolean;
};

export type CourseTemplateInfo = {
  familyId: string | null;
  versionNumber: number | null;
  parentCourseId: string | null;
  derivedFromTemplateCourseId: string | null;
  derivedFromTemplateVersionNumber: number | null;
};

export type CourseScopeSection = {
  _id: string;
  name: string;
  class?: {
    _id: string;
    name: string;
  } | null;
};

export type CourseClassSummary = {
  _id: string;
  name: string;
};

export type CourseSubjectSummary = {
  _id: string;
  name: string;
};

export type CoursePaperStatus =
  | "not_started"
  | "available"
  | "upcoming"
  | "in_progress"
  | "submitted"
  | "auto_submitted"
  | "expired"
  | "unavailable";

export type CourseAssessmentState = {
  paperId: string;
  paperTitle: string;
  attemptStatus: CoursePaperStatus;
  attemptId: string | null;
  reportHref: string | null;
  launchHref: string;
  requiresManualReview: boolean;
  scorePct: number | null;
  meetsMinimumScore: boolean;
  minimumScorePct: number | null;
};

export type WorkspaceCoursePaperOption = {
  _id: string;
  title: string;
  class: CourseClassSummary | null;
  subjects: Array<{ _id: string; name: string }>;
  assignedAcademicSections: CourseScopeSection[];
  onlineEnabled: boolean;
  duration: number;
  totalMarks: number;
  passingMarks: number;
};

export type CourseBlockCounts = Record<CourseBlockType, number>;

export type CourseProgressSnapshot = {
  status: CourseProgressStatus;
  startedAt: string | null;
  lastViewedBlockId: string | null;
  viewedBlockIds: string[];
  completedBlockIds: string[];
  bookmarkedBlockIds: string[];
  notes: CourseNote[];
  completionPercent: number;
  completedAssessmentPaperIds: string[];
  lastActivityAt: string | null;
  completedAt: string | null;
};

export type WorkspaceCourseSummary = {
  _id: string;
  title: string;
  summary: string;
  class: CourseClassSummary | null;
  subjects: CourseSubjectSummary[];
  assignedAcademicSections: CourseScopeSection[];
  status: CourseStatus;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  blockCount: number;
  assessmentCount: number;
  requiredAssessmentCount: number;
  blockCounts: CourseBlockCounts;
  metadata: CourseMetadata;
  template: CourseTemplateInfo;
};

export type WorkspaceCourseProgressSummary = {
  assignedStudents: number;
  startedStudents: number;
  completedStudents: number;
  averageCompletionPercent: number;
  overdueStudents: number;
  assessmentSummaries: Array<{
    blockId: string;
    paperId: string;
    paperTitle: string;
    required: boolean;
    minimumScorePct: number | null;
    submittedStudents: number;
    inProgressStudents: number;
  }>;
};

export type WorkspaceCourseDetail = WorkspaceCourseSummary & {
  blocks: Array<
    | CourseModuleBlock
    | CourseLessonBlock
    | CourseTextBlock
    | CourseImageBlock
    | CourseYoutubeBlock
    | CourseResourceBlock
    | CourseAnnouncementBlock
    | (CourseAssessmentBlock & {
        paper: WorkspaceCoursePaperOption | null;
      })
  >;
  progressSummary: WorkspaceCourseProgressSummary;
};

export type StudentCourseSummary = {
  _id: string;
  title: string;
  summary: string;
  class: CourseClassSummary | null;
  subjects: CourseSubjectSummary[];
  assignedAcademicSections: CourseScopeSection[];
  status: CourseProgressStatus;
  availabilityStatus: CourseAvailabilityStatus;
  publishedAt: string | null;
  updatedAt: string | null;
  blockCount: number;
  assessmentCount: number;
  requiredAssessmentCount: number;
  completedAssessmentCount: number;
  completionPercent: number;
  lastViewedBlockId: string | null;
  metadata: CourseMetadata;
};

export type StudentCourseListFilters = {
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  query?: string;
};

export type StudentCourseListOptions = {
  classes: CourseClassSummary[];
  sections: CourseScopeSection[];
  subjects: CourseSubjectSummary[];
};

export type StudentCourseListStats = {
  total: number;
  inProgress: number;
  completed: number;
  requiredAssessments: number;
};

export type StudentCourseListResult = {
  items: StudentCourseSummary[];
  total: number;
  page: number;
  pages: number;
  limit: number;
  filters: StudentCourseListFilters;
  options: StudentCourseListOptions;
  stats: StudentCourseListStats;
};

export type StudentCourseBlockState = {
  isLocked: boolean;
  isCompleted: boolean;
  isBookmarked: boolean;
  note: string | null;
};

export type StudentCourseDetailBlock =
  | (CourseModuleBlock & StudentCourseBlockState)
  | (CourseLessonBlock & StudentCourseBlockState)
  | (CourseTextBlock & StudentCourseBlockState)
  | (CourseImageBlock & StudentCourseBlockState)
  | (CourseYoutubeBlock & StudentCourseBlockState)
  | (CourseResourceBlock & StudentCourseBlockState)
  | (CourseAnnouncementBlock & StudentCourseBlockState)
  | (CourseAssessmentBlock &
      StudentCourseBlockState & {
        assessmentState: CourseAssessmentState;
      });

export type StudentCourseDetail = {
  _id: string;
  title: string;
  summary: string;
  class: CourseClassSummary | null;
  assignedAcademicSections: CourseScopeSection[];
  availabilityStatus: CourseAvailabilityStatus;
  metadata: CourseMetadata;
  blocks: StudentCourseDetailBlock[];
  progress: CourseProgressSnapshot;
};
