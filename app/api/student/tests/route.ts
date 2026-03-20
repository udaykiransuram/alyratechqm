import { NextRequest, NextResponse } from "next/server";

import { buildArchiveFilter } from "@/lib/archive";
import { requireTenantSession } from "@/lib/api-auth";
import { getStudentTestModels, loadStudentUser } from "@/lib/student-test-server";
import {
  autoSubmitExpiredAttemptIfNeeded,
  deriveStudentTestStatus,
  getRemainingTimeMs,
  isStudentEligibleForPaper,
  paperSupportsOnlineDelivery,
  serializeStudentAttempt,
} from "@/lib/student-tests";

export const dynamic = "force-dynamic";

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  available: 1,
  upcoming: 2,
  auto_submitted: 3,
  submitted: 4,
  expired: 5,
};

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) return auth.response;

  const schoolKey = auth.schoolKey as string;
  const studentId = auth.session.user.id;
  const now = new Date();

  try {
    const {
      QuestionPaper: QuestionPaperModel,
      QuestionPaperResponse: QuestionPaperResponseModel,
      User: UserModel,
      Question: QuestionModel,
      Class: ClassModel,
      Subject: SubjectModel,
      AcademicSection: AcademicSectionModel,
    } = await getStudentTestModels(schoolKey);

    const student = await loadStudentUser(UserModel, studentId);
    if (!student) {
      return NextResponse.json(
        { success: false, message: "Student profile not found." },
        { status: 404 },
      );
    }

    const papers = await QuestionPaperModel.find({
      class: student.class,
      onlineEnabled: true,
      ...buildArchiveFilter(false),
    })
      .select(
        "title class subject duration passingMarks examDate onlineEnabled onlineStartsAt onlineEndsAt totalMarks assignedAcademicSections sections",
      )
      .populate({ path: "class", model: ClassModel, select: "name" })
      .populate({ path: "subject", model: SubjectModel, select: "name" })
      .populate({
        path: "assignedAcademicSections",
        model: AcademicSectionModel,
        select: "name class",
        populate: { path: "class", model: ClassModel, select: "name" },
      })
      .populate({
        path: "sections.questions.question",
        model: QuestionModel,
        select: "type options answerIndexes matrixOptions matrixAnswers",
      })
      .lean();

    const eligiblePapers = papers.filter(
      (paper: any) =>
        paperSupportsOnlineDelivery(paper) &&
        isStudentEligibleForPaper(paper, student),
    );

    const attempts = await QuestionPaperResponseModel.find({
      student: studentId,
      paper: { $in: eligiblePapers.map((paper: any) => paper._id) },
    });

    const attemptsByPaperId = new Map(
      attempts.map((attempt: any) => [String(attempt.paper), attempt]),
    );

    const tests = [];

    for (const paper of eligiblePapers) {
      let attempt = attemptsByPaperId.get(String(paper._id)) || null;
      if (attempt) {
        attempt = await autoSubmitExpiredAttemptIfNeeded({ attempt, paper, now });
      }

      const status = deriveStudentTestStatus(paper, attempt, now);
      const remainingTimeMs = attempt
        ? getRemainingTimeMs(paper, attempt, now)
        : null;

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
        subject: paper.subject
          ? {
              _id: String(paper.subject?._id || paper.subject),
              name: String(paper.subject?.name || ""),
            }
          : null,
        assignedAcademicSections: Array.isArray(paper.assignedAcademicSections)
          ? paper.assignedAcademicSections.map((section: any) => ({
              _id: String(section?._id || section),
              name: String(section?.name || ""),
            }))
          : [],
        requiresManualReview: Array.isArray(paper.sections)
          ? paper.sections.some((section: any) =>
              Array.isArray(section?.questions)
                ? section.questions.some(
                    (entry: any) => String(entry?.question?.type || "") === "descriptive",
                  )
                : false,
            )
          : false,
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

    return NextResponse.json({ success: true, tests });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to load student tests." },
      { status: 500 },
    );
  }
}
