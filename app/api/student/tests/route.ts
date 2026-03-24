import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  buildExamRuntimeErrorPayload,
  isExamRuntimeEnabled,
  listStudentExamRuntimeTests,
} from "@/lib/exam-runtime";
import { getStudentTestModels, loadOnlinePapersForClass, loadStudentUser } from "@/lib/student-test-server";
import {
  autoSubmitExpiredAttemptIfNeeded,
  deriveStudentTestStatus,
  getRemainingTimeMs,
  isStudentEligibleForPaper,
  paperRequiresManualReview,
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

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) return auth.response;

  const schoolKey = auth.schoolKey as string;
  const studentId = auth.session.user.id;
  const now = new Date();

  try {
    if (await isExamRuntimeEnabled()) {
      const tests = await listStudentExamRuntimeTests(schoolKey, studentId);
      return NextResponse.json({ success: true, tests });
    }

    const {
      QuestionPaper: QuestionPaperModel,
      QuestionPaperResponse: QuestionPaperResponseModel,
      User: UserModel,
      Question: QuestionModel,
      Class: ClassModel,
      Subject: SubjectModel,
    } = await getStudentTestModels(schoolKey);

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

    const studentClassId = String(student.class?._id || student.class || "").trim();
    if (!studentClassId) {
      return NextResponse.json({ success: true, tests: [] });
    }

    const papers = await loadOnlinePapersForClass(
      {
        QuestionPaper: QuestionPaperModel,
        Question: QuestionModel,
        Class: ClassModel,
        Subject: SubjectModel,
      },
      schoolKey,
      studentClassId,
    );

    const eligiblePapers = papers.filter(
      (paper: any) =>
        paperSupportsOnlineDelivery(paper) &&
        isStudentEligibleForPaper(paper, student),
    );

    const attempts = await QuestionPaperResponseModel.find({
      student: studentId,
      paper: { $in: eligiblePapers.map((paper: any) => paper._id) },
    })
      .select("paper student startedAt submittedAt status lastSavedAt totalMarksAwarded sectionAnswers")
      .lean();

    const attemptsByPaperId = new Map(
      attempts.map((attempt: any) => [String(attempt.paper), attempt]),
    );

    const tests = [];

    for (const paper of eligiblePapers) {
      let attempt = attemptsByPaperId.get(String(paper._id)) || null;
      if (attempt) {
        attempt = await autoSubmitExpiredAttemptIfNeeded({
          QuestionPaperResponseModel,
          attempt,
          paper,
          now,
        });
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

    return NextResponse.json({ success: true, tests });
  } catch (error: any) {
    if (await isExamRuntimeEnabled()) {
      const payload = buildExamRuntimeErrorPayload(
        error,
        "Failed to load student tests.",
      );
      return NextResponse.json(payload, { status: payload.httpStatus });
    }

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load student tests.",
        code: "STUDENT_TESTS_LOAD_FAILED",
        retryable: true,
        httpStatus: 500,
      },
      { status: 500 },
    );
  }
}
