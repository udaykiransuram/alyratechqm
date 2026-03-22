import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { validateStudentSectionAnswers } from "@/lib/question-paper/grading";
import {
  getStudentTestModels,
  loadOnlinePaperRuntimeById,
  loadStudentUser,
} from "@/lib/student-test-server";
import {
  autoSubmitExpiredAttemptIfNeeded,
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
    const { QuestionPaperResponse: QuestionPaperResponseModel, User: UserModel } = models;

    const [paperResult, attemptResult] = await Promise.all([
      loadOnlinePaperRuntimeById(models, schoolKey, params.paperId),
      QuestionPaperResponseModel.findOne({
        paper: params.paperId,
        student: studentId,
      })
        .select(ATTEMPT_RUNTIME_PROJECTION)
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
          return NextResponse.json(
            { success: false, message: "Student profile not found." },
            { status: 404 },
          );
        }

        if (!isStudentEligibleForPaper(paper, student)) {
          return NextResponse.json(
            { success: false, message: "You are not assigned to this online test." },
            { status: 403 },
          );
        }

        const windowStart = getPaperWindowStart(paper);
        const windowEnd = getPaperWindowEnd(paper);

        if (windowStart && now.getTime() < windowStart.getTime()) {
          return NextResponse.json(
            { success: false, message: "This online test is not open yet." },
            { status: 403 },
          );
        }

        if (windowEnd && now.getTime() > windowEnd.getTime()) {
          return NextResponse.json(
            { success: false, message: "This online test is closed." },
            { status: 403 },
          );
        }

        attempt = await findOrCreateStudentAttempt({
          QuestionPaperResponseModel,
          paperId: params.paperId,
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
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to start test." },
      { status: 500 },
    );
  }
}

export async function PATCH(
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
        .select(ATTEMPT_RUNTIME_PROJECTION)
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
        return NextResponse.json(
          { success: false, message: "This online test is not open yet." },
          { status: 403 },
        );
      }

      if (windowEnd && now.getTime() > windowEnd.getTime()) {
        return NextResponse.json(
          { success: false, message: "This online test is closed." },
          { status: 403 },
        );
      }

      return NextResponse.json(
        {
          success: false,
          message: "Start the test before saving answers.",
        },
        { status: 409 },
      );
    }

    if (attempt.status === "submitted" || attempt.status === "auto_submitted") {
      return NextResponse.json(
        { success: false, message: "This attempt has already been submitted." },
        { status: 409 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const normalized = validateStudentSectionAnswers(
      body?.sectionAnswers ?? [],
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
      return NextResponse.json(
        { success: false, message: "This attempt has already been submitted." },
        { status: 409 },
      );
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
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to save attempt." },
      { status: 500 },
    );
  }
}
