import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import { getTodayDiaryEntryDate } from "@/lib/diary/shared";
import type {
  CourseAssessmentState,
  CourseMetadata,
  CourseProgressSnapshot,
  CourseScopeSection,
  StudentCourseDetail,
  StudentCourseSummary,
  WorkspaceCourseDetail,
  WorkspaceCoursePaperOption,
  WorkspaceCourseSummary,
} from "@/lib/courses/types";
import type {
  DiaryContentSummary,
  DiaryProgressSummary,
  DiaryRosterStudentState,
  DiaryStudentStateSnapshot,
  StudentDiaryDetail,
  StudentDiarySummary,
  WorkspaceDiaryDetail,
  WorkspaceDiarySummary,
} from "@/lib/diary/types";
import type {
  WorkspaceAcademicSectionItem,
  WorkspaceClassItem,
  WorkspaceSubjectItem,
} from "@/lib/workspace/support-types";

export const MOCK_CLASS_ID = "111111111111111111111111";
export const MOCK_SECTION_ID = "222222222222222222222222";
export const MOCK_SUBJECT_MATH_ID = "333333333333333333333333";
export const MOCK_SUBJECT_SCIENCE_ID = "444444444444444444444444";
export const MOCK_PAPER_ID = "555555555555555555555555";
export const MOCK_COURSE_ID = "666666666666666666666666";
export const MOCK_DIARY_MATH_ID = "777777777777777777777777";
export const MOCK_DIARY_SCIENCE_ID = "888888888888888888888888";

const FIXTURE_ISO = "2026-04-05T09:30:00.000Z";
const SAMPLE_IMAGE_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='720' viewBox='0 0 1200 720'%3E%3Crect width='1200' height='720' fill='%23e6f4ff'/%3E%3Crect x='88' y='104' width='1024' height='512' rx='32' fill='%23ffffff' stroke='%230f6cbd' stroke-width='8'/%3E%3Ccircle cx='220' cy='220' r='56' fill='%230f6cbd' opacity='0.15'/%3E%3Cpath d='M220 170 L260 240 L180 240 Z' fill='%230f6cbd'/%3E%3Crect x='336' y='188' width='464' height='24' rx='12' fill='%231f2937' opacity='0.85'/%3E%3Crect x='336' y='244' width='360' height='18' rx='9' fill='%234b5563' opacity='0.55'/%3E%3Crect x='336' y='300' width='540' height='18' rx='9' fill='%234b5563' opacity='0.55'/%3E%3Crect x='336' y='356' width='420' height='18' rx='9' fill='%234b5563' opacity='0.55'/%3E%3Crect x='336' y='420' width='196' height='64' rx='24' fill='%230f6cbd'/%3E%3Crect x='560' y='420' width='252' height='64' rx='24' fill='%23dbeafe' stroke='%2393c5fd' stroke-width='4'/%3E%3C/svg%3E";

type MockLearningContentState = {
  courseProgressByStudentKey: Map<string, CourseProgressSnapshot>;
  diaryStateByStudentKey: Map<string, DiaryStudentStateSnapshot>;
};

function getState() {
  const globalState = globalThis as typeof globalThis & {
    __mockLearningContentState?: MockLearningContentState;
  };

  if (!globalState.__mockLearningContentState) {
    globalState.__mockLearningContentState = {
      courseProgressByStudentKey: new Map(),
      diaryStateByStudentKey: new Map(),
    };
  }

  return globalState.__mockLearningContentState;
}

function cloneForTransport<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function courseStudentKey(studentId: string, courseId: string) {
  return `${studentId}::${courseId}`;
}

function diaryStudentKey(studentId: string, entryId: string) {
  return `${studentId}::${entryId}`;
}

function buildMockCourseMetadata(): CourseMetadata {
  return {
    coverImageUrl: SAMPLE_IMAGE_DATA_URI,
    coverImageAltText: "Mock course cover",
    startsAt: "2026-04-01T00:00:00.000Z",
    dueAt: "2026-04-30T23:59:59.000Z",
    completionBadgeLabel: "Ready for review",
    enforceSequentialProgress: false,
    allowNotes: true,
    allowBookmarks: true,
    isTemplate: false,
  };
}

function buildMockCourseSections(): CourseScopeSection[] {
  return [
    {
      _id: MOCK_SECTION_ID,
      name: "Watson",
      class: {
        _id: MOCK_CLASS_ID,
        name: "CLASS X",
      },
    },
  ];
}

function buildMockWorkspaceCourseSummary(): WorkspaceCourseSummary {
  return {
    _id: MOCK_COURSE_ID,
    title: "Diagnostic Foundations",
    summary:
      "A guided walkthrough that combines lesson notes, visual examples, video explanations, and one linked assessment.",
    class: {
      _id: MOCK_CLASS_ID,
      name: "CLASS X",
    },
    subjects: [
      {
        _id: MOCK_SUBJECT_MATH_ID,
        name: "Mathematics",
      },
      {
        _id: MOCK_SUBJECT_SCIENCE_ID,
        name: "Science",
      },
    ],
    assignedAcademicSections: buildMockCourseSections(),
    status: "published",
    publishedAt: FIXTURE_ISO,
    createdAt: FIXTURE_ISO,
    updatedAt: FIXTURE_ISO,
    blockCount: 6,
    assessmentCount: 1,
    requiredAssessmentCount: 1,
    blockCounts: {
      module: 1,
      lesson: 1,
      text: 1,
      image: 1,
      youtube: 0,
      resource: 0,
      announcement: 1,
      assessment: 1,
    },
    metadata: buildMockCourseMetadata(),
  };
}

function buildMockPaperOption(): WorkspaceCoursePaperOption {
  return {
    _id: MOCK_PAPER_ID,
    title: "Baseline Diagnostic Test",
    class: {
      _id: MOCK_CLASS_ID,
      name: "CLASS X",
    },
    subjects: [
      { _id: MOCK_SUBJECT_MATH_ID, name: "Mathematics" },
      { _id: MOCK_SUBJECT_SCIENCE_ID, name: "Science" },
    ],
    assignedAcademicSections: buildMockCourseSections(),
    onlineEnabled: true,
    duration: 45,
    totalMarks: 100,
    passingMarks: 35,
  };
}

export function getMockWorkspaceCourseSupportData() {
  return cloneForTransport({
    classes: getMockWorkspaceClasses(),
    sections: getMockWorkspaceSections(),
    subjects: getMockWorkspaceSubjects(),
    papers: [buildMockPaperOption()],
  });
}

export function getMockWorkspaceCourseSummaries(): WorkspaceCourseSummary[] {
  return cloneForTransport([buildMockWorkspaceCourseSummary()]);
}

export function getMockWorkspaceCourseDetail(
  courseId: string,
): WorkspaceCourseDetail | null {
  if (String(courseId || "").trim() !== MOCK_COURSE_ID) {
    return null;
  }

  const summary = buildMockWorkspaceCourseSummary();
  const paper = buildMockPaperOption();

  const detail: WorkspaceCourseDetail = {
    ...summary,
    blocks: [
      {
        id: "course-module-1",
        type: "module",
        title: "Hidden patterns",
        summary: "Start with the concept map and then move into the activity.",
      },
      {
        id: "course-lesson-1",
        type: "lesson",
        title: "Where marks hide misconceptions",
        summary: "Use the lesson to frame why diagnostics matter.",
        estimatedMinutes: 15,
        items: [
          {
            type: "text",
            contentHtml:
              "<h2>Lesson overview</h2><p>Marks alone do not explain hesitation, confidence drift, or misconception clusters.</p>",
          },
          {
            type: "youtube",
            videoId: "REUsK6IFAlk",
            caption: "Teacher walkthrough",
          },
        ],
      },
      {
        id: "course-text-1",
        type: "text",
        contentHtml:
          "<h2>Action note</h2><p>Review the dashboard before opening the linked assessment so the context stays clear.</p>",
      },
      {
        id: "course-image-1",
        type: "image",
        imageUrl: SAMPLE_IMAGE_DATA_URI,
        altText: "Mock analytics panel",
        caption: "A mock analytics frame used during E2E automation.",
        imageFit: "contain",
        imageWidth: "full",
        imageHeight: "medium",
      },
      {
        id: "course-announcement-1",
        type: "announcement",
        title: "Teacher reminder",
        contentHtml:
          "<p>Students should complete this course before the Friday review meeting.</p>",
        tone: "info",
      },
      {
        id: "course-assessment-1",
        type: "assessment",
        questionPaperId: MOCK_PAPER_ID,
        titleOverride: "Baseline readiness check",
        required: true,
        minimumScorePct: 60,
        paper,
      },
    ],
    progressSummary: {
      assignedStudents: 24,
      startedStudents: 9,
      completedStudents: 3,
      averageCompletionPercent: 41.7,
      overdueStudents: 0,
      assessmentSummaries: [
        {
          blockId: "course-assessment-1",
          paperId: MOCK_PAPER_ID,
          paperTitle: paper.title,
          required: true,
          minimumScorePct: 60,
          submittedStudents: 5,
          inProgressStudents: 4,
        },
      ],
    },
  };

  return cloneForTransport(detail);
}

function buildDefaultCourseProgress(): CourseProgressSnapshot {
  return {
    status: "in_progress",
    startedAt: FIXTURE_ISO,
    lastViewedBlockId: "course-lesson-1",
    viewedBlockIds: ["course-lesson-1"],
    completedBlockIds: [],
    bookmarkedBlockIds: [],
    notes: [],
    completionPercent: 25,
    completedAssessmentPaperIds: [],
    lastActivityAt: FIXTURE_ISO,
    completedAt: null,
  };
}

function getStoredCourseProgress(studentId: string, courseId: string) {
  const state = getState();
  const key = courseStudentKey(studentId, courseId);
  if (!state.courseProgressByStudentKey.has(key)) {
    state.courseProgressByStudentKey.set(key, buildDefaultCourseProgress());
  }
  return state.courseProgressByStudentKey.get(key)!;
}

function buildMockAssessmentState(): CourseAssessmentState {
  return {
    paperId: MOCK_PAPER_ID,
    paperTitle: "Baseline Diagnostic Test",
    attemptStatus: "available",
    attemptId: null,
    reportHref: null,
    launchHref: buildHrefWithReturnTo(`/student/tests/${MOCK_PAPER_ID}`, `/student/courses/${MOCK_COURSE_ID}`),
    requiresManualReview: false,
    scorePct: null,
    meetsMinimumScore: false,
    minimumScorePct: 60,
  };
}

function calculateMockCourseCompletionPercent(progress: CourseProgressSnapshot) {
  const viewedOrCompleted = new Set([
    ...progress.viewedBlockIds,
    ...progress.completedBlockIds,
  ]);
  const totalTrackableBlocks = 4;
  const completedTrackableBlocks = [
    "course-lesson-1",
    "course-text-1",
    "course-image-1",
  ].filter((blockId) => viewedOrCompleted.has(blockId)).length;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round((completedTrackableBlocks / totalTrackableBlocks) * 100),
    ),
  );
}

function normalizeMockCourseProgress(progress: CourseProgressSnapshot) {
  const completionPercent = calculateMockCourseCompletionPercent(progress);
  const hasStarted =
    Boolean(progress.startedAt) ||
    Boolean(progress.lastViewedBlockId) ||
    progress.viewedBlockIds.length > 0 ||
    progress.completedBlockIds.length > 0 ||
    progress.bookmarkedBlockIds.length > 0 ||
    progress.notes.length > 0;

  return {
    ...progress,
    status: completionPercent >= 100 ? "completed" : hasStarted ? "in_progress" : "not_started",
    completionPercent,
    completedAt: completionPercent >= 100 ? progress.completedAt || new Date().toISOString() : null,
    lastActivityAt: new Date().toISOString(),
  } satisfies CourseProgressSnapshot;
}

export function getMockStudentCourseSummaries(
  studentId: string,
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  },
): StudentCourseSummary[] {
  if (String(studentPlacement?.classId || "").trim() !== MOCK_CLASS_ID) {
    return [];
  }

  const summary = buildMockWorkspaceCourseSummary();
  const progress = normalizeMockCourseProgress(
    cloneForTransport(getStoredCourseProgress(studentId, MOCK_COURSE_ID)),
  );

  return cloneForTransport<StudentCourseSummary[]>([
    {
      _id: summary._id,
      title: summary.title,
      summary: summary.summary,
      class: summary.class,
      assignedAcademicSections: summary.assignedAcademicSections,
      status: progress.status,
      availabilityStatus: "active",
      publishedAt: summary.publishedAt,
      updatedAt: summary.updatedAt,
      blockCount: summary.blockCount,
      assessmentCount: summary.assessmentCount,
      requiredAssessmentCount: summary.requiredAssessmentCount,
      completedAssessmentCount: progress.completedAssessmentPaperIds.length,
      completionPercent: progress.completionPercent,
      lastViewedBlockId: progress.lastViewedBlockId,
      metadata: summary.metadata,
    } satisfies StudentCourseSummary,
  ]);
}

export function getMockStudentCourseDetail(
  studentId: string,
  courseId: string,
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  },
): StudentCourseDetail | null {
  if (
    String(courseId || "").trim() !== MOCK_COURSE_ID ||
    String(studentPlacement?.classId || "").trim() !== MOCK_CLASS_ID
  ) {
    return null;
  }

  const summary = buildMockWorkspaceCourseSummary();
  const progress = normalizeMockCourseProgress(
    cloneForTransport(getStoredCourseProgress(studentId, courseId)),
  );
  const bookmarked = new Set(progress.bookmarkedBlockIds);
  const noteByBlockId = new Map(progress.notes.map((note) => [note.blockId, note.text]));
  const viewed = new Set([...progress.viewedBlockIds, ...progress.completedBlockIds]);

  const detail: StudentCourseDetail = {
    _id: summary._id,
    title: summary.title,
    summary: summary.summary,
    class: summary.class,
    assignedAcademicSections: summary.assignedAcademicSections,
    availabilityStatus: "active",
    metadata: summary.metadata,
    progress,
    blocks: [
      {
        id: "course-module-1",
        type: "module",
        title: "Hidden patterns",
        summary: "Move from lesson to diagnostic action.",
        isLocked: false,
        isCompleted: false,
        isBookmarked: false,
        note: null,
      },
      {
        id: "course-lesson-1",
        type: "lesson",
        title: "Where marks hide misconceptions",
        summary: "A guided lesson block with structured items.",
        estimatedMinutes: 15,
        items: [
          {
            type: "text",
            contentHtml:
              "<h2>Why diagnostics matter</h2><p>Diagnostic reporting reveals what raw marks miss.</p>",
          },
          {
            type: "youtube",
            videoId: "REUsK6IFAlk",
            caption: "Lesson walkthrough",
          },
        ],
        isLocked: false,
        isCompleted: viewed.has("course-lesson-1"),
        isBookmarked: bookmarked.has("course-lesson-1"),
        note: noteByBlockId.get("course-lesson-1") || null,
      },
      {
        id: "course-text-1",
        type: "text",
        contentHtml:
          "<h2>Checklist</h2><p>Pause after the lesson and write down the three biggest misconceptions you notice.</p>",
        isLocked: false,
        isCompleted: viewed.has("course-text-1"),
        isBookmarked: bookmarked.has("course-text-1"),
        note: noteByBlockId.get("course-text-1") || null,
      },
      {
        id: "course-image-1",
        type: "image",
        imageUrl: SAMPLE_IMAGE_DATA_URI,
        altText: "Sample analytics panel",
        caption: "A sample analytics panel used in E2E mode.",
        imageFit: "contain",
        imageWidth: "full",
        imageHeight: "medium",
        isLocked: false,
        isCompleted: viewed.has("course-image-1"),
        isBookmarked: bookmarked.has("course-image-1"),
        note: noteByBlockId.get("course-image-1") || null,
      },
      {
        id: "course-announcement-1",
        type: "announcement",
        title: "Teacher reminder",
        contentHtml:
          "<p>Complete the reflection before opening the linked assessment.</p>",
        tone: "info",
        isLocked: false,
        isCompleted: false,
        isBookmarked: false,
        note: null,
      },
      {
        id: "course-assessment-1",
        type: "assessment",
        questionPaperId: MOCK_PAPER_ID,
        titleOverride: "Baseline readiness check",
        required: true,
        minimumScorePct: 60,
        assessmentState: buildMockAssessmentState(),
        isLocked: false,
        isCompleted: false,
        isBookmarked: false,
        note: null,
      },
    ],
  };

  return cloneForTransport(detail);
}

export function updateMockStudentCourseProgress(params: {
  studentId: string;
  courseId: string;
  operations?: {
    lastViewedBlockId?: string | null;
    viewedBlockId?: string | null;
    completedBlockId?: string | null;
    completed?: boolean;
    bookmarkedBlockId?: string | null;
    bookmarked?: boolean;
    note?: {
      blockId: string;
      text: string | null;
    } | null;
  };
}) {
  if (String(params.courseId || "").trim() !== MOCK_COURSE_ID) {
    return null;
  }

  const allowedBlockIds = new Set([
    "course-lesson-1",
    "course-text-1",
    "course-image-1",
    "course-assessment-1",
  ]);
  const current = cloneForTransport(
    getStoredCourseProgress(params.studentId, params.courseId),
  );

  const validateBlockId = (blockId: string | null | undefined, message: string) => {
    if (!blockId) {
      return;
    }
    if (!allowedBlockIds.has(blockId)) {
      throw new Error(message);
    }
  };

  validateBlockId(
    params.operations?.lastViewedBlockId,
    "Selected block is not part of this course.",
  );
  validateBlockId(
    params.operations?.viewedBlockId,
    "Viewed block is not part of this course.",
  );
  validateBlockId(
    params.operations?.completedBlockId,
    "Completed block is not part of this course.",
  );
  validateBlockId(
    params.operations?.bookmarkedBlockId,
    "Bookmarked block is not part of this course.",
  );
  validateBlockId(
    params.operations?.note?.blockId,
    "Note target block is not part of this course.",
  );

  if (params.operations?.lastViewedBlockId !== undefined) {
    current.lastViewedBlockId = params.operations.lastViewedBlockId || null;
  }

  if (params.operations?.viewedBlockId) {
    current.viewedBlockIds = Array.from(
      new Set([...current.viewedBlockIds, params.operations.viewedBlockId]),
    );
  }

  if (params.operations?.completedBlockId) {
    const nextCompleted = params.operations.completed !== false;
    current.completedBlockIds = nextCompleted
      ? Array.from(
          new Set([...current.completedBlockIds, params.operations.completedBlockId]),
        )
      : current.completedBlockIds.filter(
          (blockId) => blockId !== params.operations?.completedBlockId,
        );
  }

  if (params.operations?.bookmarkedBlockId) {
    const nextBookmarked = params.operations.bookmarked !== false;
    current.bookmarkedBlockIds = nextBookmarked
      ? Array.from(
          new Set([
            ...current.bookmarkedBlockIds,
            params.operations.bookmarkedBlockId,
          ]),
        )
      : current.bookmarkedBlockIds.filter(
          (blockId) => blockId !== params.operations?.bookmarkedBlockId,
        );
  }

  if (params.operations?.note) {
    const blockId = String(params.operations.note.blockId || "").trim();
    const text = String(params.operations.note.text || "").trim();
    current.notes = current.notes.filter((note) => note.blockId !== blockId);
    if (blockId && text) {
      current.notes.push({
        blockId,
        text,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  const normalized = normalizeMockCourseProgress(current);
  getState().courseProgressByStudentKey.set(
    courseStudentKey(params.studentId, params.courseId),
    normalized,
  );
  return cloneForTransport(normalized);
}

function buildDiaryContent(resourceCount: number): DiaryContentSummary {
  return {
    hasLessonSummary: true,
    hasHomework: true,
    hasTeacherNote: true,
    resourceCount,
  };
}

function buildDiaryProgressSummary(): DiaryProgressSummary {
  return {
    assignedStudents: 24,
    notSeenStudents: 18,
    seenStudents: 4,
    completedStudents: 2,
  };
}

function buildDefaultDiaryState(): DiaryStudentStateSnapshot {
  return {
    status: "not_seen",
    firstSeenAt: null,
    lastViewedAt: null,
    completedAt: null,
  };
}

function getStoredDiaryState(studentId: string, entryId: string) {
  const state = getState();
  const key = diaryStudentKey(studentId, entryId);
  if (!state.diaryStateByStudentKey.has(key)) {
    state.diaryStateByStudentKey.set(key, buildDefaultDiaryState());
  }
  return state.diaryStateByStudentKey.get(key)!;
}

function buildDiarySummariesForToday(): WorkspaceDiarySummary[] {
  const entryDate = getTodayDiaryEntryDate();
  return [
    {
      _id: MOCK_DIARY_MATH_ID,
      title: "Fractions recap and correction work",
      entryDate,
      class: {
        _id: MOCK_CLASS_ID,
        name: "CLASS X",
      },
      subject: {
        _id: MOCK_SUBJECT_MATH_ID,
        name: "Mathematics",
      },
      assignedAcademicSections: buildMockCourseSections(),
      status: "published",
      publishedAt: FIXTURE_ISO,
      createdAt: FIXTURE_ISO,
      updatedAt: FIXTURE_ISO,
      author: {
        _id: "999999999999999999999991",
        name: "Mock Teacher",
        role: "teacher",
      },
      updatedBy: {
        _id: "999999999999999999999991",
        name: "Mock Teacher",
        role: "teacher",
      },
      content: buildDiaryContent(2),
      progressSummary: buildDiaryProgressSummary(),
    },
    {
      _id: MOCK_DIARY_SCIENCE_ID,
      title: "Matter states reflection and observation task",
      entryDate,
      class: {
        _id: MOCK_CLASS_ID,
        name: "CLASS X",
      },
      subject: {
        _id: MOCK_SUBJECT_SCIENCE_ID,
        name: "Science",
      },
      assignedAcademicSections: buildMockCourseSections(),
      status: "draft",
      publishedAt: null,
      createdAt: FIXTURE_ISO,
      updatedAt: FIXTURE_ISO,
      author: {
        _id: "999999999999999999999992",
        name: "Mock Science Teacher",
        role: "teacher",
      },
      updatedBy: {
        _id: "999999999999999999999992",
        name: "Mock Science Teacher",
        role: "teacher",
      },
      content: buildDiaryContent(1),
      progressSummary: buildDiaryProgressSummary(),
    },
  ];
}

export function getMockWorkspaceDiarySummaries(filters?: {
  entryDate?: string;
  subjectId?: string;
  status?: string;
}) {
  return cloneForTransport(
    buildDiarySummariesForToday().filter((entry) => {
      if (filters?.entryDate && entry.entryDate !== filters.entryDate) {
        return false;
      }
      if (filters?.subjectId && entry.subject?._id !== filters.subjectId) {
        return false;
      }
      if (filters?.status && entry.status !== filters.status) {
        return false;
      }
      return true;
    }),
  );
}

export function getMockWorkspaceDiaryDetail(entryId: string): WorkspaceDiaryDetail | null {
  const summary = buildDiarySummariesForToday().find((entry) => entry._id === entryId);
  if (!summary) {
    return null;
  }

  const detail: WorkspaceDiaryDetail = {
    ...summary,
    lessonSummaryHtml:
      "<p>Today we traced the difference between correct answers and confident understanding.</p>",
    homeworkHtml:
      "<p>Complete questions 4 to 8 and write one misconception you corrected.</p>",
    teacherNoteHtml:
      "<p>Parents can review the notebook corrections before tomorrow's class.</p>",
    resources: [
      {
        id: "diary-resource-image-1",
        type: "image",
        url: SAMPLE_IMAGE_DATA_URI,
        altText: "Diary image",
        caption: "Mock classroom snapshot",
      },
      {
        id: "diary-resource-youtube-1",
        type: "youtube",
        videoId: "REUsK6IFAlk",
        caption: "Short recap video",
      },
    ],
    roster: [
      {
        student: {
          _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
          name: "Aarav",
          rollNumber: "12",
          academicSection: buildMockCourseSections()[0],
        },
        state: {
          status: "seen",
          firstSeenAt: FIXTURE_ISO,
          lastViewedAt: FIXTURE_ISO,
          completedAt: null,
        },
      } satisfies DiaryRosterStudentState,
    ],
  };

  return cloneForTransport(detail);
}

export function getMockStudentDiarySummaries(
  studentId: string,
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  },
  filters?: {
    entryDate?: string;
    subjectId?: string;
  },
): StudentDiarySummary[] {
  if (String(studentPlacement?.classId || "").trim() !== MOCK_CLASS_ID) {
    return [];
  }

  return buildDiarySummariesForToday()
    .filter((entry) => entry.status === "published")
    .filter((entry) => {
      if (filters?.entryDate && entry.entryDate !== filters.entryDate) {
        return false;
      }
      if (filters?.subjectId && entry.subject?._id !== filters.subjectId) {
        return false;
      }
      return true;
    })
    .map((entry) => ({
      _id: entry._id,
      title: entry.title,
      entryDate: entry.entryDate,
      class: entry.class,
      subject: entry.subject,
      assignedAcademicSections: entry.assignedAcademicSections,
      publishedAt: entry.publishedAt,
      updatedAt: entry.updatedAt,
      author: entry.author,
      content: entry.content,
      state: cloneForTransport(getStoredDiaryState(studentId, entry._id)),
    }));
}

export function getMockStudentDiaryDetail(
  studentId: string,
  entryId: string,
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  },
): StudentDiaryDetail | null {
  if (String(studentPlacement?.classId || "").trim() !== MOCK_CLASS_ID) {
    return null;
  }

  const workspaceDetail = getMockWorkspaceDiaryDetail(entryId);
  if (!workspaceDetail || workspaceDetail.status !== "published") {
    return null;
  }

  return cloneForTransport({
    _id: workspaceDetail._id,
    title: workspaceDetail.title,
    entryDate: workspaceDetail.entryDate,
    class: workspaceDetail.class,
    subject: workspaceDetail.subject,
    assignedAcademicSections: workspaceDetail.assignedAcademicSections,
    publishedAt: workspaceDetail.publishedAt,
    updatedAt: workspaceDetail.updatedAt,
    author: workspaceDetail.author,
    content: workspaceDetail.content,
    state: getStoredDiaryState(studentId, entryId),
    lessonSummaryHtml: workspaceDetail.lessonSummaryHtml,
    homeworkHtml: workspaceDetail.homeworkHtml,
    teacherNoteHtml: workspaceDetail.teacherNoteHtml,
    resources: workspaceDetail.resources,
  });
}

export function updateMockStudentDiaryState(params: {
  studentId: string;
  entryId: string;
  operations: {
    markSeen?: boolean;
    markCompleted?: boolean;
  };
}) {
  const allowedEntryIds = new Set([MOCK_DIARY_MATH_ID]);
  if (!allowedEntryIds.has(String(params.entryId || "").trim())) {
    return null;
  }

  const current = cloneForTransport(getStoredDiaryState(params.studentId, params.entryId));
  const now = new Date().toISOString();

  if (params.operations.markCompleted) {
    current.status = "completed";
    current.firstSeenAt = current.firstSeenAt || now;
    current.lastViewedAt = now;
    current.completedAt = current.completedAt || now;
  } else if (params.operations.markSeen) {
    if (current.status !== "completed") {
      current.status = "seen";
    }
    current.firstSeenAt = current.firstSeenAt || now;
    current.lastViewedAt = now;
  }

  getState().diaryStateByStudentKey.set(
    diaryStudentKey(params.studentId, params.entryId),
    current,
  );
  return cloneForTransport(current);
}

export function getMockWorkspaceClasses(): WorkspaceClassItem[] {
  return cloneForTransport([
    {
      _id: MOCK_CLASS_ID,
      name: "CLASS X",
      description: "Mock class used for E2E learning-content checks.",
    },
  ]);
}

export function getMockWorkspaceSections(): WorkspaceAcademicSectionItem[] {
  return cloneForTransport([
    {
      _id: MOCK_SECTION_ID,
      name: "Watson",
      description: "Mock section",
      isActive: true,
      class: {
        _id: MOCK_CLASS_ID,
        name: "CLASS X",
      },
    },
  ]);
}

export function getMockWorkspaceSubjects(): WorkspaceSubjectItem[] {
  return cloneForTransport([
    {
      _id: MOCK_SUBJECT_MATH_ID,
      name: "Mathematics",
      code: "MATH",
      description: "Mock math subject",
      tags: [],
    },
    {
      _id: MOCK_SUBJECT_SCIENCE_ID,
      name: "Science",
      code: "SCI",
      description: "Mock science subject",
      tags: [],
    },
  ]);
}
