import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  buildExamRuntimeErrorPayload,
  isExamRuntimeEnabled,
  saveStudentExamRuntimeAttempt,
  startStudentExamRuntimeAttempt,
} from "@/lib/exam-runtime";
import { validateStudentSectionAnswers } from "@/lib/question-paper/grading";
import {
  getStudentTestModels,
  loadOnlinePaperRuntimeById,
  loadStudentUser,
} from "@/lib/student-test-server";
import {
  autoSubmitExpiredAttemptIfNeeded,
  buildSectionAnswersSignature,
  deriveStudentTestStatus,
  findOrCreateStudentAttempt,
  getAttemptDeadlineMs,
  getPaperWindowEnd,
  getPaperWindowStart,
  getRemainingTimeMs,
  isStudentEligibleForPaper,
  paperSupportsOnlineDelivery,
  serializeStudentAttempt,
} from "@/lib/student-tests";

export const dynamic = "force-dynamic";

const ATTEMPT_RUNTIME_PROJECTION =
  "paper student startedAt submittedAt status lastSavedAt totalMarksAwarded sectionAnswers";

function testErrorResponse(params: {
  message: string;
  status: number;
  code: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}) {
  return NextResponse.json(
    {
      success: false,
      message: params.message,
      code: params.code,
      retryable: Boolean(params.retryable),
      httpStatus: params.status,
      ...(params.details ? { details: params.details } : {}),
    },
    { status: params.status },
  );
}

export async function POST(
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
      const result = await startStudentExamRuntimeAttempt(
        schoolKey,
        studentId,
        paperId,
      );
      return NextResponse.json(result);
    }

    const models = await getStudentTestModels(schoolKey);
    const { QuestionPaperResponse: QuestionPaperResponseModel, User: UserModel } = models;

    const [paperResult, attemptResult] = await Promise.all([
      loadOnlinePaperRuntimeById(models, schoolKey, paperId),
      QuestionPaperResponseModel.findOne({
        paper: paperId,
        student: studentId,
      })
        .select(ATTEMPT_RUNTIME_PROJECTION)
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

    if (!attempt || (attempt.status !== "submitted" && attempt.status !== "auto_submitted")) {
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

        const windowStart = getPaperWindowStart(paper);
        const windowEnd = getPaperWindowEnd(paper);

        if (windowStart && now.getTime() < windowStart.getTime()) {
          return testErrorResponse({
            message: "This online test is not open yet.",
            status: 403,
            code: "ONLINE_TEST_NOT_OPEN_YET",
          });
        }

        if (windowEnd && now.getTime() > windowEnd.getTime()) {
          return testErrorResponse({
            message: "This online test is closed.",
            status: 403,
            code: "ONLINE_TEST_CLOSED",
          });
        }

        attempt = await findOrCreateStudentAttempt({
          QuestionPaperResponseModel,
          paperId,
          studentId,
          now,
          lean: true,
        });
      }

      const deadlineMs = getAttemptDeadlineMs(paper, attempt);

      return NextResponse.json({
        success: true,
        attempt: serializeStudentAttempt(attempt),
        status: deriveStudentTestStatus(paper, attempt, now),
        remainingTimeMs: getRemainingTimeMs(paper, attempt, now),
        deadlineAt: deadlineMs ? new Date(deadlineMs).toISOString() : null,
      });
    }

    return NextResponse.json({
      success: true,
      attempt: serializeStudentAttempt(attempt),
      status: deriveStudentTestStatus(paper, attempt, now),
      remainingTimeMs: 0,
      deadlineAt: attempt?.submittedAt || null,
    });
  } catch (error: any) {
    if (await isExamRuntimeEnabled()) {
      const payload = buildExamRuntimeErrorPayload(
        error,
        "Failed to start test.",
      );
      return NextResponse.json(payload, { status: payload.httpStatus });
    }

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to start test.",
        code: "ONLINE_TEST_START_FAILED",
        retryable: true,
        httpStatus: 500,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
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
      const body = await req.json().catch(() => ({}));
      const result = await saveStudentExamRuntimeAttempt({
        schoolKey,
        studentId,
        paperId,
        sectionAnswers: body?.sectionAnswers ?? [],
        baseLastSavedAt:
          typeof body?.baseLastSavedAt === "string" ? body.baseLastSavedAt : null,
      });
      return NextResponse.json(result);
    }

    const models = await getStudentTestModels(schoolKey);
    const { QuestionPaperResponse: QuestionPaperResponseModel } = models;

    const [paperResult, attemptResult] = await Promise.all([
      loadOnlinePaperRuntimeById(models, schoolKey, paperId),
      QuestionPaperResponseModel.findOne({
        paper: paperId,
        student: studentId,
      })
        .select(ATTEMPT_RUNTIME_PROJECTION)
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
      const windowStart = getPaperWindowStart(paper);
      const windowEnd = getPaperWindowEnd(paper);

      if (windowStart && now.getTime() < windowStart.getTime()) {
        return testErrorResponse({
          message: "This online test is not open yet.",
          status: 403,
          code: "ONLINE_TEST_NOT_OPEN_YET",
        });
      }

      if (windowEnd && now.getTime() > windowEnd.getTime()) {
        return testErrorResponse({
          message: "This online test is closed.",
          status: 403,
          code: "ONLINE_TEST_CLOSED",
        });
      }

      return testErrorResponse({
        message: "Start the test before saving answers.",
        status: 409,
        code: "ATTEMPT_NOT_STARTED",
      });
    }

    if (attempt.status === "submitted" || attempt.status === "auto_submitted") {
      return testErrorResponse({
        message: "This attempt has already been submitted.",
        status: 409,
        code: "ATTEMPT_ALREADY_SUBMITTED",
        details: {
          attempt: serializeStudentAttempt(attempt),
          serverLastSavedAt: attempt?.lastSavedAt || null,
        },
      });
    }

    const body = await req.json().catch(() => ({}));
    const baseLastSavedAt =
      typeof body?.baseLastSavedAt === "string" ? body.baseLastSavedAt : null;
    const normalized = validateStudentSectionAnswers(
      body?.sectionAnswers ?? [],
      paper,
      { allowEmpty: true },
    );
    if (!normalized.ok) {
      return testErrorResponse({
        message: normalized.issues[0] || "Invalid answers payload.",
        status: 400,
        code: "INVALID_ANSWERS_PAYLOAD",
        details: { issues: normalized.issues },
      });
    }

    const nextSignature = buildSectionAnswersSignature(
      normalized.sectionAnswers,
      paper,
    );
    const existingSignature = buildSectionAnswersSignature(
      attempt?.sectionAnswers || [],
      paper,
    );
    const baseLastSavedAtMs = baseLastSavedAt
      ? new Date(baseLastSavedAt).getTime()
      : NaN;
    const serverLastSavedAtMs = attempt?.lastSavedAt
      ? new Date(attempt.lastSavedAt).getTime()
      : NaN;

    if (
      Number.isFinite(baseLastSavedAtMs) &&
      Number.isFinite(serverLastSavedAtMs) &&
      baseLastSavedAtMs + 1000 < serverLastSavedAtMs &&
      nextSignature !== existingSignature
    ) {
      return testErrorResponse({
        message:
          "This test was updated from another session. Reload to continue with the latest saved answers.",
        status: 409,
        code: "ATTEMPT_STATE_CONFLICT",
        details: {
          attempt: serializeStudentAttempt(attempt),
          serverLastSavedAt: attempt?.lastSavedAt || null,
        },
      });
    }

    if (nextSignature === existingSignature) {
      const deadlineMs = getAttemptDeadlineMs(paper, attempt);
      return NextResponse.json({
        success: true,
        attempt: serializeStudentAttempt(attempt),
        status: deriveStudentTestStatus(paper, attempt, now),
        remainingTimeMs: getRemainingTimeMs(paper, attempt, now),
        deadlineAt: deadlineMs ? new Date(deadlineMs).toISOString() : null,
      });
    }

    attempt = await QuestionPaperResponseModel.findOneAndUpdate(
      {
        _id: attempt._id,
        status: { $nin: ["submitted", "auto_submitted"] },
      },
      {
        $set: {
          sectionAnswers: normalized.sectionAnswers,
          lastSavedAt: now,
        },
      },
      { new: true },
    )
      .select(ATTEMPT_RUNTIME_PROJECTION)
      .lean();

    if (!attempt) {
      const submittedAttempt = await QuestionPaperResponseModel.findOne({
        paper: paperId,
        student: studentId,
      })
        .select(ATTEMPT_RUNTIME_PROJECTION)
        .lean();
      return testErrorResponse({
        message: "This attempt has already been submitted.",
        status: 409,
        code: "ATTEMPT_ALREADY_SUBMITTED",
        details: {
          attempt: serializeStudentAttempt(submittedAttempt),
          serverLastSavedAt: submittedAttempt?.lastSavedAt || null,
        },
      });
    }

    const deadlineMs = getAttemptDeadlineMs(paper, attempt);

    return NextResponse.json({
      success: true,
      attempt: serializeStudentAttempt(attempt),
      status: deriveStudentTestStatus(paper, attempt, now),
      remainingTimeMs: getRemainingTimeMs(paper, attempt, now),
      deadlineAt: deadlineMs ? new Date(deadlineMs).toISOString() : null,
    });
  } catch (error: any) {
    if (await isExamRuntimeEnabled()) {
      const payload = buildExamRuntimeErrorPayload(
        error,
        "Failed to save attempt.",
      );
      return NextResponse.json(payload, { status: payload.httpStatus });
    }

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to save attempt.",
        code: "ATTEMPT_SAVE_FAILED",
        retryable: true,
        httpStatus: 500,
      },
      { status: 500 },
    );
  }
}
