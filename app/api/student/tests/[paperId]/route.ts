import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  buildExamRuntimeErrorPayload,
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
  deriveStudentTestStatus,
  getAttemptDeadlineMs,
  getRemainingTimeMs,
  isStudentEligibleForPaper,
  paperSupportsOnlineDelivery,
  sanitizePaperForStudent,
  serializeStudentAttempt,
} from "@/lib/student-tests";

export const dynamic = "force-dynamic";

const ATTEMPT_DETAIL_PROJECTION =
  "paper student startedAt submittedAt status lastSavedAt totalMarksAwarded sectionAnswers";

function testErrorResponse(params: {
  message: string;
  status: number;
  code: string;
  retryable?: boolean;
}) {
  return NextResponse.json(
    {
      success: false,
      message: params.message,
      code: params.code,
      retryable: Boolean(params.retryable),
      httpStatus: params.status,
    },
    { status: params.status },
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ paperId: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) return auth.response;
  const { paperId } = await params;

  const schoolKey = auth.schoolKey as string;
  const studentId = auth.session.user.id;
  const now = new Date();

  try {
    if (await isExamRuntimeEnabled()) {
      const result = await getStudentExamRuntimeDetail(
        schoolKey,
        studentId,
        paperId,
      );
      return NextResponse.json(result);
    }

    const models = await getStudentTestModels(schoolKey);
    const { QuestionPaperResponse: QuestionPaperResponseModel, User: UserModel } = models;

    const [paperResult, attemptResult] = await Promise.all([
      loadOnlinePaperById(models, schoolKey, paperId),
      QuestionPaperResponseModel.findOne({
        paper: paperId,
        student: studentId,
      })
        .select(ATTEMPT_DETAIL_PROJECTION)
        .lean(),
    ]);

    const paper = paperResult;
    if (!paper) {
      return testErrorResponse({
        message: "Online test not found.",
        status: 404,
        code: "ONLINE_TEST_NOT_FOUND",
      });
    }

    if (!paperSupportsOnlineDelivery(paper)) {
      return testErrorResponse({
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
      const student = await loadStudentUser(UserModel, studentId, {
        schoolKey,
        useCache: true,
      });
      if (!student) {
        return testErrorResponse({
          message: "Student profile not found.",
          status: 404,
          code: "STUDENT_NOT_FOUND",
        });
      }

      if (!isStudentEligibleForPaper(paper, student)) {
        return testErrorResponse({
          message: "You are not assigned to this online test.",
          status: 403,
          code: "ONLINE_TEST_NOT_ASSIGNED",
        });
      }
    }

    if (!attempt) {
      return NextResponse.json({
        success: true,
        paper: sanitizePaperForStudent(paper),
        attempt: null,
        status: deriveStudentTestStatus(paper, null, now),
        remainingTimeMs: null,
        deadlineAt: null,
      });
    }

    const deadlineMs = getAttemptDeadlineMs(paper, attempt);

    return NextResponse.json({
      success: true,
      paper: sanitizePaperForStudent(paper),
      attempt: serializeStudentAttempt(attempt),
      status: deriveStudentTestStatus(paper, attempt, now),
      remainingTimeMs: getRemainingTimeMs(paper, attempt, now),
      deadlineAt: deadlineMs ? new Date(deadlineMs).toISOString() : null,
    });
  } catch (error: any) {
    if (await isExamRuntimeEnabled()) {
      const payload = buildExamRuntimeErrorPayload(
        error,
        "Failed to load online test.",
      );
      return NextResponse.json(payload, { status: payload.httpStatus });
    }

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load online test.",
        code: "ONLINE_TEST_LOAD_FAILED",
        retryable: true,
        httpStatus: 500,
      },
      { status: 500 },
    );
  }
}
