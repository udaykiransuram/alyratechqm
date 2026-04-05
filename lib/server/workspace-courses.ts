import { buildArchiveFilter } from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";
import { resolveTeacherCourseScope } from "@/lib/courses/access";
import {
  getCourseAssessmentPaperIds,
  getRequiredCourseAssessmentPaperIds,
  normalizeCourseMetadata,
  normalizeCourseBlocks,
  resolveCourseAvailabilityStatus,
} from "@/lib/courses/shared";
import type {
  CourseBlock,
  CourseClassSummary,
  CourseScopeSection,
  CourseStatus,
  CourseSubjectSummary,
  WorkspaceCourseDetail,
  WorkspaceCoursePaperOption,
  WorkspaceCourseSummary,
} from "@/lib/courses/types";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { resolveTeacherPaperScope } from "@/lib/question-paper/access";
import { serializePaperSubjects } from "@/lib/question-paper/subjects";
import { paperSupportsOnlineDelivery } from "@/lib/student-tests";
import {
  getWorkspaceClasses,
  getWorkspaceSections,
  getWorkspaceSubjects,
} from "@/lib/server/workspace-support-data";
import {
  getMockWorkspaceCourseDetail,
  getMockWorkspaceCourseSummaries,
  getMockWorkspaceCourseSupportData,
} from "@/lib/test-fixtures/learning-content";
import { isMockedE2ETestMode } from "@/lib/test-mode";

function toId(value: unknown) {
  if (!value) return "";
  if (typeof value === "object" && value !== null && "_id" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)._id || "").trim();
  }
  return String(value || "").trim();
}

function toOptionalString(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

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

function mapSubjectSummary(value: any): CourseSubjectSummary | null {
  const id = toId(value);
  if (!id) return null;

  return {
    _id: id,
    name: String(value?.name || "").trim() || id,
  };
}

function mapCourseSubjects(value: any[]): CourseSubjectSummary[] {
  return (Array.isArray(value) ? value : [])
    .map(mapSubjectSummary)
    .filter(
      (
        subject: ReturnType<typeof mapSubjectSummary>,
      ): subject is NonNullable<ReturnType<typeof mapSubjectSummary>> => Boolean(subject),
    );
}

function getCourseSubjectIds(course: any) {
  return mapCourseSubjects(Array.isArray(course?.subjectIds) ? course.subjectIds : []).map(
    (subject) => subject._id,
  );
}

function teacherHasFullSubjectCoverage(subjectIds: string[], scopedUser: any) {
  if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
    return true;
  }

  if (scopedUser?.hasAllSubjects) {
    return true;
  }

  const scopedSubjectIds = new Set(
    Array.isArray(scopedUser?.subjectIds)
      ? scopedUser.subjectIds.map((subjectId: any) => toId(subjectId))
      : [],
  );

  return subjectIds.every((subjectId) => scopedSubjectIds.has(subjectId));
}

function mapPaperOption(paper: any): WorkspaceCoursePaperOption {
  const subjects = serializePaperSubjects(paper).subjects;
  return {
    _id: toId(paper?._id),
    title: String(paper?.title || "").trim(),
    class: mapClassSummary(paper?.class),
    subjects: subjects.map((subject) => ({
      _id: String(subject?._id || "").trim(),
      name: String(subject?.name || "").trim(),
    })),
    assignedAcademicSections: (Array.isArray(paper?.assignedAcademicSections)
      ? paper.assignedAcademicSections
      : []
    )
      .map(mapSectionSummary)
      .filter(
        (
          section: ReturnType<typeof mapSectionSummary>,
        ): section is NonNullable<ReturnType<typeof mapSectionSummary>> =>
          Boolean(section),
      ),
    onlineEnabled: Boolean(paper?.onlineEnabled),
    duration: Number(paper?.duration || 0),
    totalMarks: Number(paper?.totalMarks || 0),
    passingMarks: Number(paper?.passingMarks || 0),
  };
}

function mapCourseScopeSections(value: any[]) {
  return (Array.isArray(value) ? value : [])
    .map(mapSectionSummary)
    .filter(
      (
        section: ReturnType<typeof mapSectionSummary>,
      ): section is NonNullable<ReturnType<typeof mapSectionSummary>> =>
        Boolean(section),
    );
}

function serializeWorkspaceCourseBlock(
  block: CourseBlock,
  paperOptionsById: Map<string, WorkspaceCoursePaperOption>,
) {
  if (block.type === "assessment") {
    return {
      ...block,
      paper: paperOptionsById.get(String(block.questionPaperId || "").trim()) || null,
    };
  }

  return block;
}

function serializeWorkspaceCourseSummary(course: any): WorkspaceCourseSummary {
  const blocks = normalizeCourseBlocks(course?.blocks);
  const metadata = normalizeCourseMetadata(course);
  const assessmentPaperIds = getCourseAssessmentPaperIds(blocks);
  const requiredAssessmentPaperIds = getRequiredCourseAssessmentPaperIds(blocks);
  const blockCounts = blocks.reduce<WorkspaceCourseSummary["blockCounts"]>(
    (counts, block) => {
      counts[block.type] = (counts[block.type] || 0) + 1;
      return counts;
    },
    {
      module: 0,
      lesson: 0,
      text: 0,
      image: 0,
      youtube: 0,
      resource: 0,
      announcement: 0,
      assessment: 0,
    },
  );

  return {
    _id: toId(course?._id),
    title: String(course?.title || "").trim(),
    summary: String(course?.summary || ""),
    class: mapClassSummary(course?.class),
    subjects: mapCourseSubjects(course?.subjectIds),
    assignedAcademicSections: mapCourseScopeSections(
      course?.assignedAcademicSections,
    ),
    status: (String(course?.status || "draft").trim() || "draft") as CourseStatus,
    publishedAt: course?.publishedAt ? new Date(course.publishedAt).toISOString() : null,
    createdAt: course?.createdAt ? new Date(course.createdAt).toISOString() : null,
    updatedAt: course?.updatedAt ? new Date(course.updatedAt).toISOString() : null,
    blockCount: blocks.length,
    assessmentCount: assessmentPaperIds.length,
    requiredAssessmentCount: requiredAssessmentPaperIds.length,
    blockCounts,
    metadata,
  };
}

async function getTeacherScopedUser(schoolKey: string, userId: string) {
  const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
  return UserModel.findById(userId)
    .select(
      "hasAllClasses classIds hasAllSubjects subjectIds hasAllSections academicSectionIds",
    )
    .lean();
}

function filterClassesByTeacherScope(classes: any[], scopedUser: any) {
  if (scopedUser?.hasAllClasses) {
    return classes;
  }

  const allowedClassIds = new Set(
    Array.isArray(scopedUser?.classIds)
      ? scopedUser.classIds.map((classId: any) => toId(classId))
      : [],
  );

  return classes.filter((item) => allowedClassIds.has(String(item?._id || "")));
}

function filterSectionsByTeacherScope(sections: any[], scopedUser: any) {
  const allowedClassIds = new Set(
    Array.isArray(scopedUser?.classIds)
      ? scopedUser.classIds.map((classId: any) => toId(classId))
      : [],
  );
  const allowedSectionIds = new Set(
    Array.isArray(scopedUser?.academicSectionIds)
      ? scopedUser.academicSectionIds.map((sectionId: any) => toId(sectionId))
      : [],
  );

  return sections.filter((section) => {
    const sectionClassId = String(section?.class?._id || section?.class || "").trim();
    if (!scopedUser?.hasAllClasses && !allowedClassIds.has(sectionClassId)) {
      return false;
    }

    if (scopedUser?.hasAllSections) {
      return true;
    }

    return allowedSectionIds.has(String(section?._id || "").trim());
  });
}

function canTeacherAccessPaper(paper: WorkspaceCoursePaperOption, scopedUser: any) {
  const paperSubjectIds = paper.subjects.map((subject) => subject._id);
  const scope = resolveTeacherPaperScope(
    scopedUser,
    String(paper?.class?._id || "").trim(),
    paperSubjectIds,
    paper.assignedAcademicSections.map((section) => section._id),
  );

  return (
    scope.hasClassAccess &&
    scope.hasSubjectAccess &&
    scope.hasSectionAccess &&
    teacherHasFullSubjectCoverage(paperSubjectIds, scopedUser)
  );
}

function canTeacherAccessCourse(course: any, scopedUser: any) {
  const courseSubjectIds = getCourseSubjectIds(course);
  const scope = resolveTeacherCourseScope(
    scopedUser,
    toId(course?.class),
    courseSubjectIds,
    (Array.isArray(course?.assignedAcademicSections)
      ? course.assignedAcademicSections
      : []
    ).map((section: any) => toId(section)),
  );

  return (
    scope.hasClassAccess &&
    scope.hasSectionAccess &&
    teacherHasFullSubjectCoverage(courseSubjectIds, scopedUser)
  );
}

async function getAllQuestionPaperOptions(schoolKey: string) {
  if (isMockedE2ETestMode()) {
    return getMockWorkspaceCourseSupportData().papers;
  }

  const {
    QuestionPaper: QuestionPaperModel,
    Class: ClassModel,
    Subject: SubjectModel,
    AcademicSection: AcademicSectionModel,
  } = await getTenantModels(schoolKey, [
    "QuestionPaper",
    "Class",
    "Subject",
    "AcademicSection",
  ]);

  const papers = await QuestionPaperModel.find(buildArchiveFilter(false))
    .select(
      "_id title class subject subjectIds onlineEnabled duration totalMarks passingMarks assignedAcademicSections",
    )
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({ path: "subject", model: SubjectModel, select: "name" })
    .populate({ path: "subjectIds", model: SubjectModel, select: "name" })
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
    .sort({ updatedAt: -1, title: 1 })
    .lean();

  return Array.isArray(papers) ? papers.map(mapPaperOption) : [];
}

export async function getWorkspaceCourseSupportData(params: {
  schoolKey: string;
  viewerId: string;
  viewerRole: "admin" | "teacher";
}) {
  if (isMockedE2ETestMode()) {
    return getMockWorkspaceCourseSupportData();
  }

  const [classes, sections, subjects, paperOptions] = await Promise.all([
    getWorkspaceClasses(params.schoolKey),
    getWorkspaceSections(params.schoolKey),
    getWorkspaceSubjects(params.schoolKey),
    getAllQuestionPaperOptions(params.schoolKey),
  ]);

  if (params.viewerRole !== "teacher") {
    return {
      classes,
      sections,
      subjects,
      papers: paperOptions.filter((paper) => paper.onlineEnabled),
    };
  }

  const scopedUser = await getTeacherScopedUser(params.schoolKey, params.viewerId);
  const allowedSubjectIds = new Set(
    Array.isArray(scopedUser?.subjectIds)
      ? scopedUser.subjectIds.map((subjectId: any) => toId(subjectId))
      : [],
  );

  return {
    classes: filterClassesByTeacherScope(classes, scopedUser),
    sections: filterSectionsByTeacherScope(sections, scopedUser),
    subjects: Boolean(scopedUser?.hasAllSubjects)
      ? subjects
      : subjects.filter((subject) => allowedSubjectIds.has(String(subject?._id || ""))),
    papers: paperOptions.filter(
      (paper) => paper.onlineEnabled && canTeacherAccessPaper(paper, scopedUser),
    ),
  };
}

export async function listWorkspaceCourses(params: {
  schoolKey: string;
  viewerId: string;
  viewerRole: "admin" | "teacher";
}) {
  if (isMockedE2ETestMode()) {
    return getMockWorkspaceCourseSummaries();
  }

  await connectDB();
  const {
    Course: CourseModel,
    Class: ClassModel,
    Subject: SubjectModel,
    AcademicSection: AcademicSectionModel,
  } = await getTenantModels(params.schoolKey, [
    "Course",
    "Class",
    "Subject",
    "AcademicSection",
  ]);

  const courses = await CourseModel.find(buildArchiveFilter(false))
    .select(
      "_id title summary coverImageUrl coverImageAltText startsAt dueAt completionBadgeLabel enforceSequentialProgress allowNotes allowBookmarks isTemplate class subjectIds assignedAcademicSections status blocks publishedAt createdAt updatedAt",
    )
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({ path: "subjectIds", model: SubjectModel, select: "name" })
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      select: "name class",
      populate: { path: "class", model: ClassModel, select: "name" },
    })
    .sort({ updatedAt: -1, title: 1 })
    .lean();

  let filteredCourses = Array.isArray(courses) ? courses : [];

  if (params.viewerRole === "teacher") {
    const scopedUser = await getTeacherScopedUser(params.schoolKey, params.viewerId);
    filteredCourses = filteredCourses.filter((course) =>
      canTeacherAccessCourse(course, scopedUser),
    );
  }

  return filteredCourses.map(serializeWorkspaceCourseSummary);
}

function isCourseAssignedToStudent(student: any, assignedSectionIds: string[]) {
  const studentSectionId = toId(
    student?.academicSectionId ||
      student?.academicSection?._id ||
      student?.academicSection,
  );

  if (assignedSectionIds.length === 0) {
    return true;
  }

  return Boolean(studentSectionId && assignedSectionIds.includes(studentSectionId));
}

export async function getWorkspaceCourseById(params: {
  schoolKey: string;
  courseId: string;
  viewerId: string;
  viewerRole: "admin" | "teacher";
}) {
  if (isMockedE2ETestMode()) {
    return getMockWorkspaceCourseDetail(params.courseId);
  }

  await connectDB();
  const {
    Course: CourseModel,
    CourseProgress: CourseProgressModel,
    Class: ClassModel,
    Subject: SubjectModel,
    AcademicSection: AcademicSectionModel,
    User: UserModel,
    QuestionPaperResponse: QuestionPaperResponseModel,
  } = await getTenantModels(params.schoolKey, [
    "Course",
    "CourseProgress",
    "Class",
    "Subject",
    "AcademicSection",
    "User",
    "QuestionPaperResponse",
  ]);

  const course = await CourseModel.findOne({
    _id: params.courseId,
    ...buildArchiveFilter(false),
  })
    .select(
      "_id title summary coverImageUrl coverImageAltText startsAt dueAt completionBadgeLabel enforceSequentialProgress allowNotes allowBookmarks isTemplate class subjectIds assignedAcademicSections status blocks publishedAt createdBy createdAt updatedAt",
    )
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({ path: "subjectIds", model: SubjectModel, select: "name" })
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

  if (params.viewerRole === "teacher") {
    const scopedUser = await getTeacherScopedUser(params.schoolKey, params.viewerId);
    if (!canTeacherAccessCourse(course, scopedUser)) {
      return null;
    }
  }

  const normalizedBlocks = normalizeCourseBlocks(course.blocks);
  const linkedPaperIds = getCourseAssessmentPaperIds(normalizedBlocks);
  const requiredPaperIds = getRequiredCourseAssessmentPaperIds(normalizedBlocks);
  const paperOptions = await getAllQuestionPaperOptions(params.schoolKey);
  const paperOptionsById = new Map(paperOptions.map((paper) => [paper._id, paper]));

  const assignedStudents = await UserModel.find({
    role: "student",
    class: toId(course.class),
    ...(Array.isArray(course.assignedAcademicSections) &&
    course.assignedAcademicSections.length > 0
      ? {
          academicSection: {
            $in: course.assignedAcademicSections.map((section: any) => toId(section)),
          },
        }
      : {}),
    ...buildArchiveFilter(false),
  })
    .select("_id academicSection")
    .lean();

  const assignedStudentIds = assignedStudents.map((student: any) => toId(student?._id));
  const progressDocs =
    assignedStudentIds.length > 0
      ? await CourseProgressModel.find({
          course: course._id,
          student: { $in: assignedStudentIds },
        })
          .select("student status completionPercent")
          .lean()
      : [];
  const attempts =
    assignedStudentIds.length > 0 && linkedPaperIds.length > 0
      ? await QuestionPaperResponseModel.find({
          paper: { $in: linkedPaperIds },
          student: { $in: assignedStudentIds },
        })
          .select("paper student status")
          .lean()
      : [];

  const progressByStudentId = new Map(
    progressDocs.map((progress: any) => [toId(progress?.student), progress]),
  );
  const attemptsByStudentId = new Map<
    string,
    Map<string, { status: string }>
  >();

  attempts.forEach((attempt: any) => {
    const studentId = toId(attempt?.student);
    const paperId = toId(attempt?.paper);
    if (!studentId || !paperId) {
      return;
    }

    if (!attemptsByStudentId.has(studentId)) {
      attemptsByStudentId.set(studentId, new Map());
    }

    attemptsByStudentId.get(studentId)!.set(paperId, {
      status: String(attempt?.status || "").trim(),
    });
  });

  const metadata = normalizeCourseMetadata(course);
  let startedStudents = 0;
  let completedStudents = 0;
  let completionPercentTotal = 0;
  let overdueStudents = 0;

  assignedStudentIds.forEach((studentId) => {
    const progress = progressByStudentId.get(studentId);
    const studentAttemptMap = attemptsByStudentId.get(studentId) || new Map();
    const hasAttemptStarted = linkedPaperIds.some((paperId) =>
      studentAttemptMap.has(paperId),
    );
    const completedRequiredCount =
      requiredPaperIds.length > 0
        ? requiredPaperIds.filter((paperId) => {
            const status = String(studentAttemptMap.get(paperId)?.status || "");
            return status === "submitted" || status === "auto_submitted";
          }).length
        : 0;

    const isCompleted =
      requiredPaperIds.length > 0
        ? completedRequiredCount === requiredPaperIds.length
        : progress?.status === "completed";
    const hasStarted =
      Boolean(progress) || hasAttemptStarted || Boolean(isCompleted);
    const studentCompletionPercent =
      typeof progress?.completionPercent === "number" &&
      Number.isFinite(progress.completionPercent)
        ? Math.max(0, Math.min(100, Number(progress.completionPercent)))
        : isCompleted
          ? 100
          : 0;
    const availabilityStatus = resolveCourseAvailabilityStatus({
      startsAt: metadata.startsAt,
      dueAt: metadata.dueAt,
      completed: isCompleted,
      now: new Date(),
    });

    if (hasStarted) {
      startedStudents += 1;
    }
    if (isCompleted) {
      completedStudents += 1;
    }
    if (availabilityStatus === "overdue") {
      overdueStudents += 1;
    }
    completionPercentTotal += studentCompletionPercent;
  });

  const assessmentSummaries = normalizedBlocks
    .filter((block): block is Extract<CourseBlock, { type: "assessment" }> => block.type === "assessment")
    .map((block) => {
      let submittedStudents = 0;
      let inProgressStudents = 0;

      attemptsByStudentId.forEach((studentAttemptMap) => {
        const status = String(
          studentAttemptMap.get(String(block.questionPaperId || "").trim())?.status || "",
        );

        if (status === "submitted" || status === "auto_submitted") {
          submittedStudents += 1;
        } else if (status === "in_progress") {
          inProgressStudents += 1;
        }
      });

      return {
        blockId: block.id,
        paperId: block.questionPaperId,
        paperTitle:
          paperOptionsById.get(String(block.questionPaperId || "").trim())?.title ||
          "Linked assessment",
        required: block.required !== false,
        minimumScorePct:
          typeof block.minimumScorePct === "number" &&
          Number.isFinite(block.minimumScorePct)
            ? block.minimumScorePct
            : null,
        submittedStudents,
        inProgressStudents,
      };
    });

  return {
    ...serializeWorkspaceCourseSummary(course),
    blocks: normalizedBlocks.map((block) =>
      serializeWorkspaceCourseBlock(block, paperOptionsById),
    ),
    progressSummary: {
      assignedStudents: assignedStudentIds.length,
      startedStudents,
      completedStudents,
      averageCompletionPercent:
        assignedStudentIds.length > 0
          ? Math.round(completionPercentTotal / assignedStudentIds.length)
          : 0,
      overdueStudents,
      assessmentSummaries,
    },
  } satisfies WorkspaceCourseDetail;
}

function doesPaperCoverCourseSections(
  courseSectionIds: string[],
  paperSectionIds: string[],
) {
  if (courseSectionIds.length === 0) {
    return paperSectionIds.length === 0;
  }

  if (paperSectionIds.length === 0) {
    return true;
  }

  return courseSectionIds.every((sectionId) => paperSectionIds.includes(sectionId));
}

export async function validateCourseAssessmentPapers(params: {
  schoolKey: string;
  paperIds: string[];
  courseClassId: string;
  courseSubjectIds: string[];
  courseAssignedSectionIds: string[];
  viewerId: string;
  viewerRole: "admin" | "teacher";
}) {
  const uniquePaperIds = Array.from(
    new Set((Array.isArray(params.paperIds) ? params.paperIds : []).filter(Boolean)),
  );

  if (uniquePaperIds.length === 0) {
    return {
      ok: true as const,
      papers: [] as any[],
    };
  }

  const {
    QuestionPaper: QuestionPaperModel,
    Question: QuestionModel,
    Class: ClassModel,
    Subject: SubjectModel,
    AcademicSection: AcademicSectionModel,
    User: UserModel,
  } = await getTenantModels(params.schoolKey, [
    "QuestionPaper",
    "Question",
    "Class",
    "Subject",
    "AcademicSection",
    "User",
  ]);

  const papers = await QuestionPaperModel.find({
    _id: { $in: uniquePaperIds },
    ...buildArchiveFilter(false),
  })
    .select(
      "_id title class subject subjectIds onlineEnabled assignedAcademicSections sections duration totalMarks passingMarks",
    )
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({ path: "subject", model: SubjectModel, select: "name" })
    .populate({ path: "subjectIds", model: SubjectModel, select: "name" })
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      select: "name class",
      populate: { path: "class", model: ClassModel, select: "name" },
    })
    .populate({
      path: "sections.questions.question",
      model: QuestionModel,
      select: "_id type subject matrixOptions",
      populate: { path: "subject", model: SubjectModel, select: "name" },
    })
    .lean();

  if (papers.length !== uniquePaperIds.length) {
    return {
      ok: false as const,
      message: "One or more linked assessments could not be found.",
      status: 400,
    };
  }

  let scopedUser: any = null;
  if (params.viewerRole === "teacher") {
    scopedUser = await UserModel.findById(params.viewerId)
      .select(
        "hasAllClasses classIds hasAllSubjects subjectIds hasAllSections academicSectionIds",
      )
      .lean();
  }

  for (const paper of papers) {
    if (!paper?.onlineEnabled || !paperSupportsOnlineDelivery(paper)) {
      return {
        ok: false as const,
        message: `Linked assessment "${paper?.title || "Untitled paper"}" is not valid for online delivery.`,
        status: 400,
      };
    }

    if (toId(paper?.class) !== params.courseClassId) {
      return {
        ok: false as const,
        message: `Linked assessment "${paper?.title || "Untitled paper"}" belongs to a different class.`,
        status: 400,
      };
    }

    const paperSectionIds = (Array.isArray(paper?.assignedAcademicSections)
      ? paper.assignedAcademicSections
      : []
    ).map((section: any) => toId(section));
    const paperSubjectIds = serializePaperSubjects(paper).subjects.map((subject) =>
      String(subject?._id || "").trim(),
    );

    if (
      !doesPaperCoverCourseSections(params.courseAssignedSectionIds, paperSectionIds)
    ) {
      return {
        ok: false as const,
        message: `Linked assessment "${paper?.title || "Untitled paper"}" does not cover the full course section assignment.`,
        status: 400,
      };
    }

    if (
      Array.isArray(params.courseSubjectIds) &&
      params.courseSubjectIds.length > 0 &&
      paperSubjectIds.some((subjectId) => !params.courseSubjectIds.includes(subjectId))
    ) {
      return {
        ok: false as const,
        message: `Linked assessment "${paper?.title || "Untitled paper"}" includes subjects outside the selected course subject scope.`,
        status: 400,
      };
    }

    if (params.viewerRole === "teacher") {
      const scope = resolveTeacherPaperScope(
        scopedUser,
        toId(paper?.class),
        paperSubjectIds,
        paperSectionIds,
      );

      if (!scope.hasClassAccess || !scope.hasSubjectAccess || !scope.hasSectionAccess) {
        return {
          ok: false as const,
          message: `Linked assessment "${paper?.title || "Untitled paper"}" is outside your teaching scope.`,
          status: 403,
        };
      }
    }
  }

  return {
    ok: true as const,
    papers,
  };
}

export async function recordCourseAudit(params: {
  schoolKey: string;
  req?: any;
  courseId: string;
  title: string;
  action: string;
  summary: string;
  details?: Record<string, unknown>;
}) {
  await recordTenantAudit({
    schoolKey: params.schoolKey,
    req: params.req,
    entityType: "course",
    entityId: params.courseId,
    entityLabel: params.title,
    action: params.action,
    summary: params.summary,
    details: params.details || null,
  });
}

export function validateTeacherCourseScope(params: {
  scopedUser: any;
  classId: string;
  subjectIds: string[];
  assignedAcademicSectionIds: string[];
}) {
  const scope = resolveTeacherCourseScope(
    params.scopedUser,
    params.classId,
    params.subjectIds,
    params.assignedAcademicSectionIds,
  );

  if (!scope.hasClassAccess || !scope.hasSectionAccess || !scope.hasFullSubjectAccess) {
    return {
      ok: false as const,
      message:
        "You can only create courses inside your assigned class, subject, and section scope.",
      status: 403,
    };
  }

  if (!Boolean(params.scopedUser?.hasAllSubjects)) {
    const outOfScopeSubjects = (Array.isArray(params.subjectIds) ? params.subjectIds : []).filter(
      (subjectId) => !scope.allowedSubjectIds.includes(subjectId),
    );

    if (outOfScopeSubjects.length > 0) {
      return {
        ok: false as const,
        message: "One or more selected subjects are outside your teaching scope.",
        status: 403,
      };
    }
  }

  if (scope.allowedSectionIds !== null && params.assignedAcademicSectionIds.length === 0) {
    return {
      ok: false as const,
      message:
        "Teachers with section-scoped access must assign at least one section to a course.",
      status: 400,
    };
  }

  if (scope.allowedSectionIds !== null) {
    const outOfScopeSections = params.assignedAcademicSectionIds.filter(
      (sectionId) => !scope.allowedSectionIds!.includes(sectionId),
    );

    if (outOfScopeSections.length > 0) {
      return {
        ok: false as const,
        message: "One or more assigned sections are outside your access scope.",
        status: 403,
      };
    }
  }

  return {
    ok: true as const,
  };
}
