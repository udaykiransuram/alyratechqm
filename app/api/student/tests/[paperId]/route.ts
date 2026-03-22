import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
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

export async function GET(
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
      loadOnlinePaperById(models, schoolKey, params.paperId),
      QuestionPaperResponseModel.findOne({
        paper: params.paperId,
        student: studentId,
      })
        .select(ATTEMPT_DETAIL_PROJECTION)
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
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to load online test." },
      { status: 500 },
    );
  }
}
