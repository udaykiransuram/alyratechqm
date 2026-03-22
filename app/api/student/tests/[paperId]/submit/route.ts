import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { validateStudentSectionAnswers } from "@/lib/question-paper/grading";
import { getStudentTestModels, loadOnlinePaperRuntimeById } from "@/lib/student-test-server";
import {
  finalizeAttemptAsSubmitted,
  getAttemptDeadlineMs,
  paperSupportsOnlineDelivery,
  serializeStudentAttempt,
} from "@/lib/student-tests";

export const dynamic = "force-dynamic";

const ATTEMPT_SUBMIT_PROJECTION =
  "paper student startedAt submittedAt status lastSavedAt totalMarksAwarded sectionAnswers";

export async function POST(
  req: NextRequest,
  { params }: { params: { paperId: string } },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) return auth.response;

  const schoolKey = auth.schoolKey as string;
  const studentId = auth.session.user.id;
  const now = new Date();

  try {
    const models = await getStudentTestModels(schoolKey);
    const { QuestionPaperResponse: QuestionPaperResponseModel } = models;

    const [paperResult, attemptResult] = await Promise.all([
      loadOnlinePaperRuntimeById(models, schoolKey, params.paperId),
      QuestionPaperResponseModel.findOne({
        paper: params.paperId,
        student: studentId,
      })
        .select(ATTEMPT_SUBMIT_PROJECTION)
        .lean(),
    ]);

    const paper = paperResult;
    if (!paper) {
      return NextResponse.json(
        { success: false, message: "Online test not found." },
        { status: 404 },
      );
    }

    if (!paperSupportsOnlineDelivery(paper)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This paper cannot be delivered online because it contains unsupported question types.",
        },
        { status: 400 },
      );
    }

    let attempt = attemptResult;

    if (!attempt) {
      return NextResponse.json(
        {
          success: false,
          message: "Start the test before submitting it.",
        },
        { status: 409 },
      );
    }

    if (attempt.status === "submitted" || attempt.status === "auto_submitted") {
      return NextResponse.json({
        success: true,
        attempt: serializeStudentAttempt(attempt),
      });
    }

    const body = await req.json().catch(() => ({}));
    const normalized = validateStudentSectionAnswers(
      body?.sectionAnswers ?? attempt.sectionAnswers ?? [],
      paper,
      { allowEmpty: true },
    );
    if (!normalized.ok) {
      return NextResponse.json(
        {
          success: false,
          message: normalized.issues[0] || "Invalid answers payload.",
          issues: normalized.issues,
        },
        { status: 400 },
      );
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
      return NextResponse.json(
        { success: false, message: "This attempt could not be submitted." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      attempt: serializeStudentAttempt(attempt),
      status: attempt.status,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to submit test." },
      { status: 500 },
    );
  }
}
