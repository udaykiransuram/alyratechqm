import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  buildExamRuntimeErrorPayload,
  isExamRuntimeEnabled,
  submitStudentExamRuntimeAttempt,
} from "@/lib/exam-runtime";
import { validateStudentSectionAnswers } from "@/lib/question-paper/grading";
import { getStudentTestModels, loadOnlinePaperRuntimeById } from "@/lib/student-test-server";
import {
  buildSectionAnswersSignature,
  finalizeAttemptAsSubmitted,
  getAttemptDeadlineMs,
  paperSupportsOnlineDelivery,
  serializeStudentAttempt,
} from "@/lib/student-tests";

export const dynamic = "force-dynamic";

const ATTEMPT_SUBMIT_PROJECTION =
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
      const body = await req.json().catch(() => ({}));
      const result = await submitStudentExamRuntimeAttempt({
        schoolKey,
        studentId,
        paperId,
        sectionAnswers: body?.sectionAnswers,
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
        .select(ATTEMPT_SUBMIT_PROJECTION)
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

    if (!attempt) {
      return testErrorResponse({
        message: "Start the test before submitting it.",
        status: 409,
        code: "ATTEMPT_NOT_STARTED",
      });
    }

    if (attempt.status === "submitted" || attempt.status === "auto_submitted") {
      return NextResponse.json({
        success: true,
        attempt: serializeStudentAttempt(attempt),
        status: attempt.status,
      });
    }

    const body = await req.json().catch(() => ({}));
    const baseLastSavedAt =
      typeof body?.baseLastSavedAt === "string" ? body.baseLastSavedAt : null;
    const normalized = validateStudentSectionAnswers(
      body?.sectionAnswers ?? attempt.sectionAnswers ?? [],
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

    const incomingSignature = buildSectionAnswersSignature(
      normalized.sectionAnswers,
      paper,
    );
    const existingSignature = buildSectionAnswersSignature(
      attempt.sectionAnswers || [],
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
      incomingSignature !== existingSignature
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

    const deadlineMs = getAttemptDeadlineMs(paper, attempt);
    const autoSubmitted =
      deadlineMs !== null && now.getTime() > deadlineMs;
    const submittedAt =
      deadlineMs !== null && autoSubmitted ? new Date(deadlineMs) : now;

    attempt = await finalizeAttemptAsSubmitted({
      QuestionPaperResponseModel,
      attempt,
      paper,
      sectionAnswers: normalized.sectionAnswers,
      autoSubmitted,
      submittedAt,
    });

    if (!attempt) {
      return testErrorResponse({
        message: "This attempt could not be submitted.",
        status: 409,
        code: "ATTEMPT_SUBMIT_FAILED",
      });
    }

    return NextResponse.json({
      success: true,
      attempt: serializeStudentAttempt(attempt),
      status: attempt.status,
    });
  } catch (error: any) {
    if (await isExamRuntimeEnabled()) {
      const payload = buildExamRuntimeErrorPayload(
        error,
        "Failed to submit test.",
      );
      return NextResponse.json(payload, { status: payload.httpStatus });
    }

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to submit test.",
        code: "ATTEMPT_SUBMIT_FAILED",
        retryable: true,
        httpStatus: 500,
      },
      { status: 500 },
    );
  }
}
