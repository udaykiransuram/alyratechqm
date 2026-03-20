import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { getStudentTestModels, loadOnlinePaperById, loadStudentUser } from "@/lib/student-test-server";
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
  sanitizePaperForStudent,
  serializeStudentAttempt,
} from "@/lib/student-tests";

export const dynamic = "force-dynamic";

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
    const { QuestionPaperResponse: QuestionPaperResponseModel, User: UserModel } =
      models;

    const student = await loadStudentUser(UserModel, studentId);
    if (!student) {
      return NextResponse.json(
        { success: false, message: "Student profile not found." },
        { status: 404 },
      );
    }

    const paper = await loadOnlinePaperById(models, params.paperId);
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

    if (!isStudentEligibleForPaper(paper, student)) {
      return NextResponse.json(
        { success: false, message: "You are not assigned to this online test." },
        { status: 403 },
      );
    }

    let attempt = await QuestionPaperResponseModel.findOne({
      paper: params.paperId,
      student: studentId,
    });

    if (attempt) {
      attempt = await autoSubmitExpiredAttemptIfNeeded({ attempt, paper, now });
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

      attempt = await findOrCreateStudentAttempt({
        QuestionPaperResponseModel,
        paperId: params.paperId,
        studentId,
        now,
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
