import { buildArchiveFilter } from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";
import { isStudentInCourseScope } from "@/lib/courses/access";
import {
  getCourseAssessmentPaperIds,
  getCourseCompletionPercent,
  normalizeCourseBlocks,
  normalizeCourseMetadata,
  normalizeCourseNotes,
  resolveCourseAvailabilityStatus,
  resolveCourseProgressStatus,
} from "@/lib/courses/shared";
import type {
  CourseAssessmentBlock,
  CourseAssessmentState,
  CourseBlock,
  CourseClassSummary,
  CourseMetadata,
  CourseProgressSnapshot,
  CourseScopeSection,
  StudentCourseDetail,
  StudentCourseDetailBlock,
  StudentCourseSummary,
} from "@/lib/courses/types";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import { invalidateStudentDashboardCacheForStudent } from "@/lib/server/student-dashboard-cache";
import { listStudentTestsData } from "@/app/api/student/tests/data";
import {
  getMockStudentCourseDetail,
  getMockStudentCourseSummaries,
  updateMockStudentCourseProgress,
} from "@/lib/test-fixtures/learning-content";
import { isMockedE2ETestMode } from "@/lib/test-mode";

function toId(value: unknown) {
  if (!value) return "";
  if (typeof value === "object" && value !== null && "_id" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)._id || "").trim();
  }
  return String(value || "").trim();
}

function uniqueIds(values: unknown[]) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => toId(value)).filter(Boolean)));
}

function toIsoOrNull(value: unknown) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

type StudentTestListItem = Awaited<ReturnType<typeof listStudentTestsData>>[number];
type PersistedCourseProgressState = {
  _id?: unknown;
  updatedAt?: unknown;
};

const COURSE_PROGRESS_SELECT =
  "status startedAt lastViewedBlockId viewedBlockIds completedBlockIds bookmarkedBlockIds notes completionPercent completedAssessmentPaperIds lastActivityAt completedAt updatedAt";
const MAX_COURSE_PROGRESS_WRITE_RETRIES = 4;

function mapClassSummary(value: any): CourseClassSummary | null {
  if (!value) return null;
  const id = toId(value);
  if (!id) return null;

  return {
    _id: id,
    name: String(value?.name || "").trim() || id,
  };
}

function mapSectionSummary(value: any): CourseScopeSection | null {
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

function mapScopeSections(value: any[] | undefined | null) {
  return (Array.isArray(value) ? value : [])
    .map(mapSectionSummary)
    .filter(
      (
        section: ReturnType<typeof mapSectionSummary>,
      ): section is NonNullable<ReturnType<typeof mapSectionSummary>> =>
        Boolean(section),
    );
}

function normalizeStudentTestStatus(value: string): CourseAssessmentState["attemptStatus"] {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "not_started";
  }

  return normalized as CourseAssessmentState["attemptStatus"];
}

function isAssessmentSubmitted(status: CourseAssessmentState["attemptStatus"]) {
  return status === "submitted" || status === "auto_submitted";
}

function isBlockingProgressBlock(block: CourseBlock) {
  return (
    block.type !== "module" &&
    block.type !== "announcement" &&
    !(block.type === "assessment" && block.required === false)
  );
}

function canManuallyCompleteBlock(block: CourseBlock) {
  return (
    block.type === "lesson" ||
    block.type === "text" ||
    block.type === "image" ||
    block.type === "youtube" ||
    block.type === "resource"
  );
}

function buildAssessmentState(params: {
  courseId: string;
  block: CourseAssessmentBlock;
  paperTitle: string;
  test?: StudentTestListItem;
}): CourseAssessmentState {
  const testStatus = normalizeStudentTestStatus(String(params.test?.status || ""));
  const attemptId = params.test?.attempt?._id ? String(params.test.attempt._id) : null;
  const totalMarks = Number(params.test?.totalMarks || 0);
  const obtainedMarks = Number(params.test?.attempt?.totalMarksAwarded);
  const scorePct =
    isAssessmentSubmitted(testStatus) &&
    Number.isFinite(obtainedMarks) &&
    totalMarks > 0
      ? roundPercent((obtainedMarks / totalMarks) * 100)
      : null;
  const minimumScorePct =
    typeof params.block.minimumScorePct === "number" &&
    Number.isFinite(params.block.minimumScorePct)
      ? params.block.minimumScorePct
      : null;
  const meetsMinimumScore =
    !minimumScorePct
      ? isAssessmentSubmitted(testStatus)
      : scorePct !== null && scorePct >= minimumScorePct;

  return {
    paperId: String(params.block.questionPaperId || "").trim(),
    paperTitle: params.paperTitle,
    attemptStatus: params.test ? testStatus : ("unavailable" as const),
    attemptId,
    reportHref:
      isAssessmentSubmitted(testStatus) && attemptId
        ? buildHrefWithReturnTo(
            `/student/reports/${attemptId}`,
            `/student/courses/${params.courseId}`,
          )
        : null,
    launchHref: buildHrefWithReturnTo(
      `/student/tests/${params.block.questionPaperId}`,
      `/student/courses/${params.courseId}`,
    ),
    requiresManualReview: Boolean(params.test?.requiresManualReview),
    scorePct,
    meetsMinimumScore,
    minimumScorePct,
  };
}

function createAssessmentStatesByPaperId(params: {
  courseId: string;
  blocks: CourseBlock[];
  testsByPaperId: Map<string, StudentTestListItem>;
  paperTitleById?: Map<string, string>;
}) {
  const assessmentStatesByPaperId = new Map<string, CourseAssessmentState>();

  params.blocks.forEach((block) => {
    if (block.type !== "assessment") {
      return;
    }

    const paperId = String(block.questionPaperId || "").trim();
    if (!paperId || assessmentStatesByPaperId.has(paperId)) {
      return;
    }

    assessmentStatesByPaperId.set(
      paperId,
      buildAssessmentState({
        courseId: params.courseId,
        block,
        paperTitle:
          params.testsByPaperId.get(paperId)?.title ||
          params.paperTitleById?.get(paperId) ||
          "Linked assessment",
        test: params.testsByPaperId.get(paperId),
      }),
    );
  });

  return assessmentStatesByPaperId;
}

function normalizeExistingProgress(existingProgress: any): CourseProgressSnapshot {
  return {
    status:
      String(existingProgress?.status || "").trim() === "completed"
        ? "completed"
        : String(existingProgress?.status || "").trim() === "in_progress"
          ? "in_progress"
          : "not_started",
    startedAt: toIsoOrNull(existingProgress?.startedAt),
    lastViewedBlockId: existingProgress?.lastViewedBlockId
      ? String(existingProgress.lastViewedBlockId)
      : null,
    viewedBlockIds: uniqueIds(existingProgress?.viewedBlockIds || []),
    completedBlockIds: uniqueIds(existingProgress?.completedBlockIds || []),
    bookmarkedBlockIds: uniqueIds(existingProgress?.bookmarkedBlockIds || []),
    notes: normalizeCourseNotes(existingProgress?.notes),
    completionPercent:
      typeof existingProgress?.completionPercent === "number" &&
      Number.isFinite(existingProgress.completionPercent)
        ? Math.max(0, Math.min(100, Number(existingProgress.completionPercent)))
        : 0,
    completedAssessmentPaperIds: uniqueIds(existingProgress?.completedAssessmentPaperIds || []),
    lastActivityAt: toIsoOrNull(existingProgress?.lastActivityAt),
    completedAt: toIsoOrNull(existingProgress?.completedAt),
  };
}

function hasCourseProgressActivity(
  operations:
    | {
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
      }
    | undefined,
) {
  if (!operations) {
    return false;
  }

  return (
    "lastViewedBlockId" in operations ||
    "viewedBlockId" in operations ||
    "completedBlockId" in operations ||
    "bookmarkedBlockId" in operations ||
    "note" in operations
  );
}

function areCourseProgressSnapshotsEqual(
  left: CourseProgressSnapshot,
  right: CourseProgressSnapshot,
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildCourseProgressUpdateDocument(params: {
  courseId: string;
  studentId: string;
  snapshot: CourseProgressSnapshot;
}) {
  const { snapshot } = params;

  return {
    $set: {
      status: snapshot.status,
      startedAt: snapshot.startedAt ? new Date(snapshot.startedAt) : null,
      lastViewedBlockId: snapshot.lastViewedBlockId,
      viewedBlockIds: snapshot.viewedBlockIds,
      completedBlockIds: snapshot.completedBlockIds,
      bookmarkedBlockIds: snapshot.bookmarkedBlockIds,
      notes: snapshot.notes.map((note) => ({
        blockId: note.blockId,
        text: note.text,
        updatedAt: new Date(note.updatedAt),
      })),
      completionPercent: snapshot.completionPercent,
      completedAssessmentPaperIds: snapshot.completedAssessmentPaperIds,
      lastActivityAt: snapshot.lastActivityAt ? new Date(snapshot.lastActivityAt) : null,
      completedAt: snapshot.completedAt ? new Date(snapshot.completedAt) : null,
    },
    $setOnInsert: {
      course: params.courseId,
      student: params.studentId,
    },
  };
}

async function persistStudentCourseProgressWithRetry(params: {
  CourseProgressModel: any;
  courseId: string;
  studentId: string;
  computeSnapshot: (existingProgress: PersistedCourseProgressState | null) => CourseProgressSnapshot;
}) {
  for (let attempt = 0; attempt < MAX_COURSE_PROGRESS_WRITE_RETRIES; attempt += 1) {
    const existingProgress = await params.CourseProgressModel.findOne({
      course: params.courseId,
      student: params.studentId,
    })
      .select(COURSE_PROGRESS_SELECT)
      .lean();

    const normalizedExistingProgress = normalizeExistingProgress(existingProgress);
    const nextSnapshot = params.computeSnapshot(existingProgress);

    if (areCourseProgressSnapshotsEqual(normalizedExistingProgress, nextSnapshot)) {
      return {
        progress: normalizedExistingProgress,
        previousProgress: existingProgress,
      };
    }

    try {
      const persistedProgress = await params.CourseProgressModel.findOneAndUpdate(
        existingProgress
          ? {
              _id: existingProgress._id,
              updatedAt: existingProgress.updatedAt,
            }
          : {
              course: params.courseId,
              student: params.studentId,
              updatedAt: { $exists: false },
            },
        buildCourseProgressUpdateDocument({
          courseId: params.courseId,
          studentId: params.studentId,
          snapshot: nextSnapshot,
        }),
        {
          new: true,
          lean: true,
          upsert: !existingProgress,
          setDefaultsOnInsert: true,
        },
      );

      if (persistedProgress) {
        return {
          progress: normalizeExistingProgress(persistedProgress),
          previousProgress: existingProgress,
        };
      }
    } catch (error: any) {
      if (error?.code !== 11000) {
        throw error;
      }
    }
  }

  throw new Error("Course progress changed during save. Please retry.");
}

function collectAssessmentPaperIdsFromCourses(courses: any[]) {
  return uniqueIds(
    (Array.isArray(courses) ? courses : []).flatMap((course) =>
      getCourseAssessmentPaperIds(normalizeCourseBlocks(course?.blocks)),
    ),
  );
}

function isNonAssessmentBlockCompleted(params: {
  block: CourseBlock;
  viewedBlockIds: string[];
  completedBlockIds: string[];
}) {
  if (!canManuallyCompleteBlock(params.block)) {
    return false;
  }

  if (params.completedBlockIds.includes(params.block.id)) {
    return true;
  }

  return (
    (params.block.type === "lesson" ||
      params.block.type === "text" ||
      params.block.type === "image" ||
      params.block.type === "youtube" ||
      params.block.type === "resource") &&
    params.viewedBlockIds.includes(params.block.id)
  );
}

function buildComputedProgressState(params: {
  blocks: CourseBlock[];
  metadata: CourseMetadata;
  testsByPaperId: Map<string, StudentTestListItem>;
  existingProgress: any;
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
  markStarted?: boolean;
  touchLastActivity?: boolean;
  now: Date;
}) {
  const currentProgress = normalizeExistingProgress(params.existingProgress);

  let lastViewedBlockId = currentProgress.lastViewedBlockId;
  let viewedBlockIds = [...currentProgress.viewedBlockIds];
  let completedBlockIds = [...currentProgress.completedBlockIds];
  let bookmarkedBlockIds = [...currentProgress.bookmarkedBlockIds];
  let notes = [...currentProgress.notes];

  if (params.operations && "lastViewedBlockId" in params.operations) {
    lastViewedBlockId = params.operations.lastViewedBlockId ?? null;
  }

  if (params.operations?.viewedBlockId) {
    viewedBlockIds = uniqueIds([...viewedBlockIds, params.operations.viewedBlockId]);
  }

  if (params.operations?.completedBlockId) {
    if (params.operations.completed !== false) {
      completedBlockIds = uniqueIds([
        ...completedBlockIds,
        params.operations.completedBlockId,
      ]);
    } else {
      completedBlockIds = completedBlockIds.filter(
        (blockId) => blockId !== params.operations?.completedBlockId,
      );
    }
  }

  if (params.operations?.bookmarkedBlockId) {
    if (params.operations.bookmarked !== false) {
      bookmarkedBlockIds = uniqueIds([
        ...bookmarkedBlockIds,
        params.operations.bookmarkedBlockId,
      ]);
    } else {
      bookmarkedBlockIds = bookmarkedBlockIds.filter(
        (blockId) => blockId !== params.operations?.bookmarkedBlockId,
      );
    }
  }

  if (params.operations?.note) {
    const nextBlockId = String(params.operations.note.blockId || "").trim();
    const nextText = String(params.operations.note.text || "").trim();
    notes = notes.filter((note) => note.blockId !== nextBlockId);
    if (nextBlockId && nextText) {
      notes.push({
        blockId: nextBlockId,
        text: nextText,
        updatedAt: params.now.toISOString(),
      });
    }
  }

  const assessmentStatesByPaperId = createAssessmentStatesByPaperId({
    courseId: "",
    blocks: params.blocks,
    testsByPaperId: params.testsByPaperId,
  });

  const completedAssessmentPaperIds = uniqueIds(
    params.blocks
      .filter((block): block is CourseAssessmentBlock => block.type === "assessment")
      .filter((block) => {
        const paperId = String(block.questionPaperId || "").trim();
        const assessmentState = assessmentStatesByPaperId.get(paperId);
        return Boolean(assessmentState?.meetsMinimumScore);
      })
      .map((block) => block.questionPaperId),
  );

  const completionPercent = getCourseCompletionPercent({
    blocks: params.blocks,
    viewedBlockIds,
    completedBlockIds,
    completedAssessmentPaperIds,
  });

  const hasStarted =
    Boolean(params.markStarted) ||
    Boolean(currentProgress.startedAt) ||
    Boolean(lastViewedBlockId) ||
    viewedBlockIds.length > 0 ||
    completedBlockIds.length > 0 ||
    completedAssessmentPaperIds.length > 0 ||
    bookmarkedBlockIds.length > 0 ||
    notes.length > 0;

  const status = resolveCourseProgressStatus({
    completionPercent,
    hasStarted,
    existingStatus: currentProgress.status,
  });

  const startedAt =
    status === "not_started"
      ? currentProgress.startedAt
      : currentProgress.startedAt || params.now.toISOString();

  const completedAt =
    status === "completed"
      ? currentProgress.completedAt || params.now.toISOString()
      : null;

  const lastActivityAt =
    params.touchLastActivity
      ? params.now.toISOString()
      : currentProgress.lastActivityAt;

  return {
    status,
    startedAt,
    lastViewedBlockId,
    viewedBlockIds,
    completedBlockIds,
    bookmarkedBlockIds,
    notes,
    completionPercent,
    completedAssessmentPaperIds,
    lastActivityAt,
    completedAt,
  } satisfies CourseProgressSnapshot;
}

function buildStudentCourseBlocks(params: {
  courseId: string;
  blocks: CourseBlock[];
  progress: CourseProgressSnapshot;
  metadata: CourseMetadata;
  availabilityStatus: StudentCourseDetail["availabilityStatus"];
  testsByPaperId: Map<string, StudentTestListItem>;
  paperTitleById: Map<string, string>;
}) {
  const assessmentStatesByPaperId = createAssessmentStatesByPaperId({
    courseId: params.courseId,
    blocks: params.blocks,
    testsByPaperId: params.testsByPaperId,
    paperTitleById: params.paperTitleById,
  });
  const noteByBlockId = new Map(
    params.progress.notes.map((note) => [note.blockId, note.text]),
  );

  let blockNextTrackable = false;

  return params.blocks.map((block): StudentCourseDetailBlock => {
    const isCompleted =
      block.type === "assessment"
        ? Boolean(
            assessmentStatesByPaperId.get(String(block.questionPaperId || "").trim())
              ?.meetsMinimumScore,
          )
        : isNonAssessmentBlockCompleted({
            block,
            viewedBlockIds: params.progress.viewedBlockIds,
            completedBlockIds: params.progress.completedBlockIds,
          });

    const isLocked =
      block.type === "module" || block.type === "announcement"
        ? false
        : params.availabilityStatus === "upcoming"
          ? true
          : blockNextTrackable;

    if (
      params.metadata.enforceSequentialProgress &&
      !isLocked &&
      isBlockingProgressBlock(block) &&
      !isCompleted
    ) {
      blockNextTrackable = true;
    }

    const sharedState = {
      isLocked,
      isCompleted,
      isBookmarked: params.progress.bookmarkedBlockIds.includes(block.id),
      note: noteByBlockId.get(block.id) || null,
    };

    if (block.type === "assessment") {
      return {
        ...block,
        ...sharedState,
        assessmentState:
          assessmentStatesByPaperId.get(String(block.questionPaperId || "").trim()) ||
          buildAssessmentState({
            courseId: params.courseId,
            block,
            paperTitle: params.paperTitleById.get(String(block.questionPaperId || "").trim()) || "Linked assessment",
          }),
      };
    }

    return {
      ...block,
      ...sharedState,
    } as StudentCourseDetailBlock;
  });
}

async function getStudentCourseModels(schoolKey: string) {
  return getTenantModels(schoolKey, [
    "Course",
    "CourseProgress",
    "Class",
    "AcademicSection",
    "QuestionPaper",
  ]);
}

async function getStudentCoursesBase(params: {
  schoolKey: string;
  studentPlacement: {
    classId?: string | null;
    academicSectionId?: string | null;
  };
}) {
  const classId = String(params.studentPlacement.classId || "").trim();
  const sectionId = String(params.studentPlacement.academicSectionId || "").trim();

  if (!classId) {
    return [];
  }

  const {
    Course: CourseModel,
    Class: ClassModel,
    AcademicSection: AcademicSectionModel,
  } = await getStudentCourseModels(params.schoolKey);

  const sectionFilter =
    sectionId
      ? {
          $or: [
            { assignedAcademicSections: sectionId },
            { assignedAcademicSections: { $exists: false } },
            { assignedAcademicSections: { $size: 0 } },
          ],
        }
      : {
          $or: [
            { assignedAcademicSections: { $exists: false } },
            { assignedAcademicSections: { $size: 0 } },
          ],
        };

  const courses = await CourseModel.find({
    class: classId,
    status: "published",
    ...buildArchiveFilter(false),
    ...sectionFilter,
  })
    .select(
      "_id title summary coverImageUrl coverImageAltText startsAt dueAt completionBadgeLabel enforceSequentialProgress allowNotes allowBookmarks isTemplate class assignedAcademicSections status blocks publishedAt createdAt updatedAt",
    )
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      select: "name class",
      populate: { path: "class", model: ClassModel, select: "name" },
    })
    .sort({ publishedAt: -1, updatedAt: -1, title: 1 })
    .lean();

  return Array.isArray(courses) ? courses : [];
}

async function buildStudentTestsMap(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement: {
    classId?: string | null;
    academicSectionId?: string | null;
  };
  paperIds?: string[];
}) {
  const paperIds = uniqueIds(params.paperIds || []);
  if (paperIds.length === 0) {
    return new Map<string, StudentTestListItem>();
  }

  const tests = await listStudentTestsData({
    schoolKey: params.schoolKey,
    studentId: params.studentId,
    studentPlacement: params.studentPlacement,
    paperIds,
    autoSubmitExpiredAttempts: false,
    now: new Date(),
  });

  return new Map(
    (Array.isArray(tests) ? tests : []).map((test) => [String(test?._id || ""), test]),
  );
}

function serializeStudentCourseSummary(params: {
  course: any;
  progress: any;
  testsByPaperId: Map<string, StudentTestListItem>;
  now: Date;
}): StudentCourseSummary {
  const blocks = normalizeCourseBlocks(params.course?.blocks);
  const metadata = normalizeCourseMetadata(params.course);
  const computedProgress = buildComputedProgressState({
    blocks,
    metadata,
    testsByPaperId: params.testsByPaperId,
    existingProgress: params.progress,
    now: params.now,
  });
  const availabilityStatus = resolveCourseAvailabilityStatus({
    startsAt: metadata.startsAt,
    dueAt: metadata.dueAt,
    completed: computedProgress.status === "completed",
    now: params.now,
  });

  return {
    _id: toId(params.course?._id),
    title: String(params.course?.title || "").trim(),
    summary: String(params.course?.summary || ""),
    class: mapClassSummary(params.course?.class),
    assignedAcademicSections: mapScopeSections(params.course?.assignedAcademicSections),
    status: computedProgress.status,
    availabilityStatus,
    publishedAt: toIsoOrNull(params.course?.publishedAt),
    updatedAt: toIsoOrNull(params.course?.updatedAt),
    blockCount: blocks.length,
    assessmentCount: blocks.filter((block) => block.type === "assessment").length,
    requiredAssessmentCount: blocks.filter(
      (block) => block.type === "assessment" && block.required !== false,
    ).length,
    completedAssessmentCount: computedProgress.completedAssessmentPaperIds.length,
    completionPercent: computedProgress.completionPercent,
    lastViewedBlockId: computedProgress.lastViewedBlockId,
    metadata,
  };
}

export async function listStudentCourses(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement: {
    classId?: string | null;
    academicSectionId?: string | null;
  };
}) {
  if (isMockedE2ETestMode()) {
    return getMockStudentCourseSummaries(
      params.studentId,
      params.studentPlacement,
    );
  }

  await connectDB();
  const now = new Date();
  const courses = await getStudentCoursesBase(params);
  const { CourseProgress: CourseProgressModel } = await getStudentCourseModels(
    params.schoolKey,
  );
  const progressDocs =
    courses.length > 0
      ? await CourseProgressModel.find({
          course: { $in: courses.map((course: any) => course._id) },
          student: params.studentId,
        })
          .select(
            "course status startedAt lastViewedBlockId viewedBlockIds completedBlockIds bookmarkedBlockIds notes completionPercent completedAssessmentPaperIds lastActivityAt completedAt",
          )
          .lean()
      : [];
  const progressByCourseId = new Map(
    progressDocs.map((progress: any) => [toId(progress?.course), progress]),
  );
  const testsByPaperId = await buildStudentTestsMap({
    ...params,
    paperIds: collectAssessmentPaperIdsFromCourses(courses),
  });

  return courses.map((course) =>
    serializeStudentCourseSummary({
      course,
      progress: progressByCourseId.get(toId(course?._id)) || null,
      testsByPaperId,
      now,
    }),
  );
}

export async function getStudentCourseDetail(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement: {
    classId?: string | null;
    academicSectionId?: string | null;
  };
  courseId: string;
}) {
  if (isMockedE2ETestMode()) {
    return getMockStudentCourseDetail(
      params.studentId,
      params.courseId,
      params.studentPlacement,
    );
  }

  await connectDB();
  const now = new Date();
  const {
    Course: CourseModel,
    CourseProgress: CourseProgressModel,
    QuestionPaper: QuestionPaperModel,
    Class: ClassModel,
    AcademicSection: AcademicSectionModel,
  } = await getStudentCourseModels(params.schoolKey);

  const course = await CourseModel.findOne({
    _id: params.courseId,
    status: "published",
    ...buildArchiveFilter(false),
  })
    .select(
      "_id title summary coverImageUrl coverImageAltText startsAt dueAt completionBadgeLabel enforceSequentialProgress allowNotes allowBookmarks isTemplate class assignedAcademicSections status blocks publishedAt createdAt updatedAt",
    )
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      select: "name class",
      populate: { path: "class", model: ClassModel, select: "name" },
    })
    .lean();

  if (!course) {
    return null;
  }

  const studentPlacementRecord = {
    classId: params.studentPlacement.classId,
    academicSectionId: params.studentPlacement.academicSectionId,
  };

  if (!isStudentInCourseScope(course, studentPlacementRecord)) {
    return null;
  }

  const blocks = normalizeCourseBlocks(course.blocks);
  const metadata = normalizeCourseMetadata(course);
  const linkedPaperIds = getCourseAssessmentPaperIds(blocks);
  const testsByPaperId = await buildStudentTestsMap({
    ...params,
    paperIds: linkedPaperIds,
  });

  const linkedPapers =
    linkedPaperIds.length > 0
      ? await QuestionPaperModel.find({
          _id: { $in: linkedPaperIds },
          ...buildArchiveFilter(false),
        })
          .select("title")
          .lean()
      : [];
  const paperTitleById = new Map(
    linkedPapers.map((paper: any) => [toId(paper?._id), String(paper?.title || "").trim()]),
  );

  const startsAtTime = metadata.startsAt ? new Date(metadata.startsAt).getTime() : null;
  const markStarted =
    startsAtTime === null || Number.isNaN(startsAtTime) || startsAtTime <= now.getTime();

  const { progress: normalizedProgress, previousProgress } =
    await persistStudentCourseProgressWithRetry({
      CourseProgressModel,
      courseId: toId(course._id),
      studentId: params.studentId,
      computeSnapshot: (existingProgress) => {
        const currentProgress = normalizeExistingProgress(existingProgress);

        return buildComputedProgressState({
          blocks,
          metadata,
          testsByPaperId,
          existingProgress,
          markStarted,
          touchLastActivity: Boolean(markStarted) && !currentProgress.startedAt,
          now,
        });
      },
    });
  const previousSnapshot = normalizeExistingProgress(previousProgress);

  if (!areCourseProgressSnapshotsEqual(previousSnapshot, normalizedProgress)) {
    await invalidateStudentDashboardCacheForStudent(
      params.schoolKey,
      params.studentId,
    );
  }

  const availabilityStatus = resolveCourseAvailabilityStatus({
    startsAt: metadata.startsAt,
    dueAt: metadata.dueAt,
    completed: normalizedProgress.status === "completed",
    now,
  });

  return {
    _id: toId(course?._id),
    title: String(course?.title || "").trim(),
    summary: String(course?.summary || ""),
    class: mapClassSummary(course?.class),
    assignedAcademicSections: mapScopeSections(course?.assignedAcademicSections),
    availabilityStatus,
    metadata,
    blocks: buildStudentCourseBlocks({
      courseId: toId(course?._id),
      blocks,
      progress: normalizedProgress,
      metadata,
      availabilityStatus,
      testsByPaperId,
      paperTitleById,
    }),
    progress: normalizedProgress,
  } satisfies StudentCourseDetail;
}

export async function updateStudentCourseProgress(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement: {
    classId?: string | null;
    academicSectionId?: string | null;
  };
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
  if (isMockedE2ETestMode()) {
    return updateMockStudentCourseProgress({
      studentId: params.studentId,
      courseId: params.courseId,
      operations: params.operations,
    });
  }

  await connectDB();
  const now = new Date();
  const {
    Course: CourseModel,
    CourseProgress: CourseProgressModel,
    Class: ClassModel,
    AcademicSection: AcademicSectionModel,
  } = await getStudentCourseModels(params.schoolKey);

  const course = await CourseModel.findOne({
    _id: params.courseId,
    status: "published",
    ...buildArchiveFilter(false),
  })
    .select(
      "_id title coverImageUrl coverImageAltText startsAt dueAt completionBadgeLabel enforceSequentialProgress allowNotes allowBookmarks isTemplate class assignedAcademicSections blocks",
    )
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      select: "name class",
      populate: { path: "class", model: ClassModel, select: "name" },
    })
    .lean();

  if (!course) {
    return null;
  }

  const studentPlacementRecord = {
    classId: params.studentPlacement.classId,
    academicSectionId: params.studentPlacement.academicSectionId,
  };

  if (!isStudentInCourseScope(course, studentPlacementRecord)) {
    return null;
  }

  const blocks = normalizeCourseBlocks(course.blocks);
  const metadata = normalizeCourseMetadata(course);
  const blockIds = new Set(blocks.map((block) => block.id));

  const validateBlockId = (blockId: string | null | undefined, message: string) => {
    if (!blockId) {
      return;
    }

    if (!blockIds.has(blockId)) {
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

  if (params.operations?.completedBlockId) {
    const targetBlock = blocks.find((block) => block.id === params.operations?.completedBlockId);
    if (!targetBlock || !canManuallyCompleteBlock(targetBlock)) {
      throw new Error("Only learning content blocks can be marked complete manually.");
    }
  }

  if (params.operations?.bookmarkedBlockId && !metadata.allowBookmarks) {
    throw new Error("Bookmarks are disabled for this course.");
  }

  if (params.operations?.note?.blockId && !metadata.allowNotes) {
    throw new Error("Notes are disabled for this course.");
  }

  const lessonBlocksById = new Map(
    blocks
      .filter((block) => block.type === "lesson")
      .map((block) => [block.id, block]),
  );

  const viewedBlockId = params.operations?.viewedBlockId || null;
  const completedBlockId = params.operations?.completedBlockId || null;
  const testsByPaperId = await buildStudentTestsMap({
    ...params,
    paperIds: getCourseAssessmentPaperIds(blocks),
  });
  const hasActivity = hasCourseProgressActivity(params.operations);
  const { progress, previousProgress } = await persistStudentCourseProgressWithRetry({
    CourseProgressModel,
    courseId: toId(course._id),
    studentId: params.studentId,
    computeSnapshot: (existingProgress) =>
      buildComputedProgressState({
        blocks,
        metadata,
        testsByPaperId,
        existingProgress,
        operations: params.operations,
        markStarted: hasActivity,
        touchLastActivity: hasActivity,
        now,
      }),
  });

  const previousSnapshot = normalizeExistingProgress(previousProgress);

  if (
    viewedBlockId &&
    lessonBlocksById.has(viewedBlockId) &&
    !previousSnapshot.viewedBlockIds.includes(viewedBlockId) &&
    progress.viewedBlockIds.includes(viewedBlockId)
  ) {
    const lessonBlock = lessonBlocksById.get(viewedBlockId);
    void recordTenantAudit({
      schoolKey: params.schoolKey,
      entityType: "course_lesson",
      entityId: viewedBlockId,
      entityLabel: lessonBlock?.title || "Lesson",
      action: "lesson_start",
      summary: `Lesson started: ${lessonBlock?.title || "Lesson"}`,
      details: {
        courseId: toId(course._id),
        courseTitle: String(course?.title || "").trim(),
        lessonId: viewedBlockId,
      },
      actor: {
        id: params.studentId,
        role: "student",
      },
    });
  }

  if (
    completedBlockId &&
    params.operations?.completed !== false &&
    lessonBlocksById.has(completedBlockId) &&
    !previousSnapshot.completedBlockIds.includes(completedBlockId) &&
    progress.completedBlockIds.includes(completedBlockId)
  ) {
    const lessonBlock = lessonBlocksById.get(completedBlockId);
    void recordTenantAudit({
      schoolKey: params.schoolKey,
      entityType: "course_lesson",
      entityId: completedBlockId,
      entityLabel: lessonBlock?.title || "Lesson",
      action: "lesson_complete",
      summary: `Lesson completed: ${lessonBlock?.title || "Lesson"}`,
      details: {
        courseId: toId(course._id),
        courseTitle: String(course?.title || "").trim(),
        lessonId: completedBlockId,
      },
      actor: {
        id: params.studentId,
        role: "student",
      },
    });
  }

  if (!areCourseProgressSnapshotsEqual(previousSnapshot, progress)) {
    await invalidateStudentDashboardCacheForStudent(
      params.schoolKey,
      params.studentId,
    );
  }

  return progress;
}
