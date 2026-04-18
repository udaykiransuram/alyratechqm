import "server-only";

import {
  getStudentExamRuntimeDetail,
  isExamRuntimeEnabled,
  listStudentExamRuntimeTests,
} from "@/lib/exam-runtime";
import { serializePaperSubjects } from "@/lib/question-paper/subjects";
import {
  getStudentTestModels,
  loadOnlinePaperBootstrapById,
  loadOnlinePaperById,
  loadOnlinePapersByIds,
  loadOnlinePapersForClass,
  loadStudentUser,
} from "@/lib/student-test-server";
import {
  autoSubmitExpiredAttemptIfNeeded,
  autoSubmitExpiredAttemptsForPapers,
  buildStudentPlacementSnapshot,
  collectStudentPaperQuestionIds,
  deriveStudentTestStatus,
  getAttemptDeadlineMs,
  getPaperWindowStart,
  getRemainingTimeMs,
  isStudentEligibleForPaper,
  paperRequiresManualReview,
  paperSupportsOnlineDelivery,
  sanitizeAttemptForStudentDelivery,
  sanitizePaperForStudent,
  serializeStudentAttempt,
} from "@/lib/student-tests";
import { buildArchiveFilter } from "@/lib/archive";

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  available: 1,
  upcoming: 2,
  auto_submitted: 3,
  submitted: 4,
  expired: 5,
};

const ATTEMPT_DETAIL_PROJECTION =
  "paper student startedAt submittedAt status lastSavedAt totalMarksAwarded sectionAnswers";

export type StudentPlacementInput = {
  classId?: string | null;
  academicSectionId?: string | null;
};

type StudentTestDetailDataParams = {
  schoolKey: string;
  studentId: string;
  paperId: string;
  studentPlacement?: StudentPlacementInput | null;
  now?: Date;
  deliveryMode?: "bootstrap" | "full";
  skipOnlineDeliveryValidation?: boolean;
};

type StudentTestDataError = Error & {
  code: string;
  httpStatus: number;
  retryable: boolean;
};

function normalizePlacement(placement?: StudentPlacementInput | null) {
  return {
    classId: String(placement?.classId || "").trim(),
    academicSectionId: String(placement?.academicSectionId || "").trim(),
  };
}

function throwStudentTestDataError(params: {
  message: string;
  status: number;
  code: string;
  retryable?: boolean;
}): never {
  const error = new Error(params.message) as StudentTestDataError;
  error.code = params.code;
  error.httpStatus = params.status;
  error.retryable = Boolean(params.retryable);
  throw error;
}

export async function listStudentTestsData(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement?: StudentPlacementInput | null;
  paperIds?: string[] | null;
  autoSubmitExpiredAttempts?: boolean;
  now?: Date;
}) {
  const now = params.now || new Date();
  const placement = normalizePlacement(params.studentPlacement);
  const requestedPaperIds = Array.from(
    new Set(
      (Array.isArray(params.paperIds) ? params.paperIds : [])
        .map((paperId) => String(paperId || "").trim())
        .filter(Boolean),
    ),
  );
  const shouldAutoSubmitExpiredAttempts =
    params.autoSubmitExpiredAttempts !== false;

  if (await isExamRuntimeEnabled()) {
    return listStudentExamRuntimeTests(
      params.schoolKey,
      params.studentId,
      placement,
      {
        paperIds: requestedPaperIds,
        autoSubmitExpiredAttempts: shouldAutoSubmitExpiredAttempts,
        now,
      },
    );
  }

  if (!placement.classId) {
    return [];
  }

  const {
    QuestionPaper: QuestionPaperModel,
    QuestionPaperResponse: QuestionPaperResponseModel,
    Question: QuestionModel,
    Class: ClassModel,
    Subject: SubjectModel,
  } = await getStudentTestModels(params.schoolKey);

  const paperLoaderModels = {
    QuestionPaper: QuestionPaperModel,
    Question: QuestionModel,
    Class: ClassModel,
    Subject: SubjectModel,
  };
  const papers =
    requestedPaperIds.length > 0
      ? await loadOnlinePapersByIds(paperLoaderModels, requestedPaperIds)
      : await loadOnlinePapersForClass(
          paperLoaderModels,
          params.schoolKey,
          placement.classId,
        );
  const practicePapers =
    requestedPaperIds.length > 0
      ? []
      : await QuestionPaperModel.find({
          class: placement.classId,
          onlineEnabled: true,
          isPracticeSet: true,
          practiceStudent: params.studentId,
          ...buildArchiveFilter(false),
        })
          .select(
            "title class subject subjectIds duration passingMarks examDate onlineEnabled onlineStartsAt onlineEndsAt totalMarks assignedAcademicSections sections.name sections.questions.question isPracticeSet practiceStudent",
          )
          .populate({ path: "class", model: ClassModel, select: "name" })
          .populate({ path: "subject", model: SubjectModel, select: "name" })
          .populate({ path: "subjectIds", model: SubjectModel, select: "name" })
          .populate({
            path: "sections.questions.question",
            model: QuestionModel,
            select: "type matrixOptions subject",
            populate: { path: "subject", model: SubjectModel, select: "name" },
          })
          .lean();

  const mergedPapers = [...papers, ...practicePapers];

  const eligiblePapers = mergedPapers.filter(
    (paper: any) =>
      paperSupportsOnlineDelivery(paper) &&
      isStudentEligibleForPaper(paper, { ...placement, studentId: params.studentId }),
  );

  if (eligiblePapers.length === 0) {
    return [];
  }

  const attempts = await QuestionPaperResponseModel.find({
    student: params.studentId,
    paper: { $in: eligiblePapers.map((paper: any) => paper._id) },
  })
    .select(
      "paper student startedAt submittedAt status lastSavedAt totalMarksAwarded sectionAnswers",
    )
    .lean();

  const attemptsByPaperId = new Map<string, any>(
    attempts.map((attempt: any) => [String(attempt.paper), attempt]),
  );

  if (shouldAutoSubmitExpiredAttempts) {
    await autoSubmitExpiredAttemptsForPapers({
      attemptsByPaperId,
      papers: eligiblePapers,
      now,
      QuestionPaperResponseModel,
      maxConcurrency: 6,
    });
  }

  const tests = [];

  for (const paper of eligiblePapers) {
    const attempt = attemptsByPaperId.get(String(paper._id)) || null;

    const status = deriveStudentTestStatus(paper, attempt, now);
    const remainingTimeMs = attempt
      ? getRemainingTimeMs(paper, attempt, now)
      : null;
    const paperSubjects = serializePaperSubjects(paper);

    tests.push({
      _id: String(paper._id),
      title: String(paper.title || ""),
      duration: Number(paper.duration || 0),
      passingMarks: Number(paper.passingMarks || 0),
      totalMarks: Number(paper.totalMarks || 0),
      examDate: paper.examDate || null,
      onlineStartsAt: paper.onlineStartsAt || null,
      onlineEndsAt: paper.onlineEndsAt || null,
      class: paper.class
        ? {
            _id: String(paper.class?._id || paper.class),
            name: String(paper.class?.name || ""),
          }
        : null,
      ...paperSubjects,
      assignedAcademicSections: Array.isArray(paper.assignedAcademicSections)
        ? paper.assignedAcademicSections.map((section: any) => ({
            _id: String(section?._id || section),
            name: String(section?.name || ""),
          }))
        : [],
      requiresManualReview: paperRequiresManualReview(paper),
      status,
      remainingTimeMs,
      attempt: serializeStudentAttempt(attempt),
    });
  }

  tests.sort((left: any, right: any) => {
    const leftRank = STATUS_ORDER[left.status] ?? 99;
    const rightRank = STATUS_ORDER[right.status] ?? 99;
    if (leftRank !== rightRank) return leftRank - rightRank;

    const leftTime = left.onlineStartsAt
      ? new Date(left.onlineStartsAt).getTime()
      : new Date(left.examDate || 0).getTime();
    const rightTime = right.onlineStartsAt
      ? new Date(right.onlineStartsAt).getTime()
      : new Date(right.examDate || 0).getTime();
    return leftTime - rightTime;
  });

  return tests;
}

export async function getStudentTestDetailData(
  params: StudentTestDetailDataParams,
){
  const now = params.now || new Date();
  const studentPlacement = buildStudentPlacementSnapshot(params.studentPlacement);
  const deliveryMode =
    params.deliveryMode === "bootstrap" ? "bootstrap" : "full";

  if (await isExamRuntimeEnabled()) {
    const runtimeDetail = await getStudentExamRuntimeDetail(
      params.schoolKey,
      params.studentId,
      params.paperId,
      studentPlacement,
      {
        skipOnlineDeliveryValidation: Boolean(
          params.skipOnlineDeliveryValidation,
        ),
      },
    );

    if (deliveryMode !== "bootstrap" || !runtimeDetail.paper) {
      return runtimeDetail;
    }

    return {
      ...runtimeDetail,
      paper: sanitizePaperForStudent(runtimeDetail.paper, {
        hydratedQuestionIds: collectStudentPaperQuestionIds(runtimeDetail.paper, 1),
      }),
    };
  }

  const models = await getStudentTestModels(params.schoolKey);
  const { QuestionPaperResponse: QuestionPaperResponseModel, User: UserModel } =
    models;

  const [paperResult, attemptResult] = await Promise.all([
    deliveryMode === "bootstrap"
      ? loadOnlinePaperBootstrapById(models, params.schoolKey, params.paperId)
      : loadOnlinePaperById(models, params.schoolKey, params.paperId),
    QuestionPaperResponseModel.findOne({
      paper: params.paperId,
      student: params.studentId,
    })
      .select(ATTEMPT_DETAIL_PROJECTION)
      .lean(),
  ]);

  const paper = paperResult;
  if (!paper) {
    throwStudentTestDataError({
      message: "Online test not found.",
      status: 404,
      code: "ONLINE_TEST_NOT_FOUND",
    });
  }

  if (
    !params.skipOnlineDeliveryValidation &&
    !paperSupportsOnlineDelivery(paper)
  ) {
    throwStudentTestDataError({
      message:
        "This paper cannot be delivered online because it contains unsupported question types.",
      status: 400,
      code: "ONLINE_TEST_UNSUPPORTED",
    });
  }

  let attempt = attemptResult;

  if (attempt) {
    attempt = await autoSubmitExpiredAttemptIfNeeded({
      QuestionPaperResponseModel,
      attempt,
      paper,
      now,
    });
  }

  if (!attempt) {
    const student =
      studentPlacement.classId
        ? studentPlacement
        : await loadStudentUser(UserModel, params.studentId, {
            schoolKey: params.schoolKey,
            useCache: true,
          });
    if (!student) {
      throwStudentTestDataError({
        message: "Student profile not found.",
        status: 404,
        code: "STUDENT_NOT_FOUND",
      });
    }

    if (!isStudentEligibleForPaper(paper, student)) {
      throwStudentTestDataError({
        message: "You are not assigned to this online test.",
        status: 403,
        code: "ONLINE_TEST_NOT_ASSIGNED",
      });
    }
  }

  if (!attempt) {
    const windowStart = getPaperWindowStart(paper);
    if (windowStart && now.getTime() < windowStart.getTime()) {
      throwStudentTestDataError({
        message: "This online test is not open yet.",
        status: 403,
        code: "ONLINE_TEST_NOT_OPEN_YET",
      });
    }

    return {
      success: true,
      paper:
        deliveryMode === "bootstrap"
          ? sanitizePaperForStudent(paper, {
              hydratedQuestionIds: collectStudentPaperQuestionIds(paper, 1),
            })
          : sanitizePaperForStudent(paper),
      attempt: null,
      status: deriveStudentTestStatus(paper, null, now),
      remainingTimeMs: null,
      deadlineAt: null,
    };
  }

  const deadlineMs = getAttemptDeadlineMs(paper, attempt);

  return {
    success: true,
    paper:
      deliveryMode === "bootstrap"
        ? sanitizePaperForStudent(paper, {
            hydratedQuestionIds: collectStudentPaperQuestionIds(paper, 1),
          })
        : sanitizePaperForStudent(paper),
    attempt: sanitizeAttemptForStudentDelivery(attempt, paper, now),
    status: deriveStudentTestStatus(paper, attempt, now),
    remainingTimeMs: getRemainingTimeMs(paper, attempt, now),
    deadlineAt: deadlineMs ? new Date(deadlineMs).toISOString() : null,
  };
}
