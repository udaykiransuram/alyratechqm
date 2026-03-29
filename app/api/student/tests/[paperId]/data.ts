import {
  getStudentExamRuntimeDetail,
  isExamRuntimeEnabled,
} from "@/lib/exam-runtime";
import {
  getStudentTestModels,
  loadOnlinePaperById,
  loadStudentUser,
} from "@/lib/student-test-server";
import {
  autoSubmitExpiredAttemptIfNeeded,
  buildStudentPlacementSnapshot,
  deriveStudentTestStatus,
  getAttemptDeadlineMs,
  getPaperWindowStart,
  getRemainingTimeMs,
  isStudentEligibleForPaper,
  paperSupportsOnlineDelivery,
  sanitizeAttemptForStudentDelivery,
  sanitizePaperForStudent,
} from "@/lib/student-tests";

const ATTEMPT_DETAIL_PROJECTION =
  "paper student startedAt submittedAt status lastSavedAt totalMarksAwarded sectionAnswers";

type StudentPlacementInput = {
  classId?: string | null;
  academicSectionId?: string | null;
};

type StudentTestDetailDataParams = {
  schoolKey: string;
  studentId: string;
  paperId: string;
  studentPlacement?: StudentPlacementInput | null;
  now?: Date;
};

type StudentTestDataError = Error & {
  code: string;
  httpStatus: number;
  retryable: boolean;
};

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

export async function getStudentTestDetailData(
  params: StudentTestDetailDataParams,
) {
  const now = params.now || new Date();
  const studentPlacement = buildStudentPlacementSnapshot(params.studentPlacement);

  if (await isExamRuntimeEnabled()) {
    return getStudentExamRuntimeDetail(
      params.schoolKey,
      params.studentId,
      params.paperId,
      studentPlacement,
    );
  }

  const models = await getStudentTestModels(params.schoolKey);
  const { QuestionPaperResponse: QuestionPaperResponseModel, User: UserModel } =
    models;

  const [paperResult, attemptResult] = await Promise.all([
    loadOnlinePaperById(models, params.schoolKey, params.paperId),
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

  if (!paperSupportsOnlineDelivery(paper)) {
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
      paper: sanitizePaperForStudent(paper),
      attempt: null,
      status: deriveStudentTestStatus(paper, null, now),
      remainingTimeMs: null,
      deadlineAt: null,
    };
  }

  const deadlineMs = getAttemptDeadlineMs(paper, attempt);

  return {
    success: true,
    paper: sanitizePaperForStudent(paper),
    attempt: sanitizeAttemptForStudentDelivery(attempt, paper, now),
    status: deriveStudentTestStatus(paper, attempt, now),
    remainingTimeMs: getRemainingTimeMs(paper, attempt, now),
    deadlineAt: deadlineMs ? new Date(deadlineMs).toISOString() : null,
  };
}
