import {
  isExamRuntimeEnabled,
  listStudentExamRuntimeTests,
} from "@/lib/exam-runtime";
import { serializePaperSubjects } from "@/lib/question-paper/subjects";
import { getStudentTestModels, loadOnlinePapersForClass } from "@/lib/student-test-server";
import {
  autoSubmitExpiredAttemptsForPapers,
  deriveStudentTestStatus,
  getRemainingTimeMs,
  isStudentEligibleForPaper,
  paperRequiresManualReview,
  paperSupportsOnlineDelivery,
  serializeStudentAttempt,
} from "@/lib/student-tests";

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  available: 1,
  upcoming: 2,
  auto_submitted: 3,
  submitted: 4,
  expired: 5,
};

export type StudentPlacementInput = {
  classId?: string | null;
  academicSectionId?: string | null;
};

function normalizePlacement(placement?: StudentPlacementInput | null) {
  return {
    classId: String(placement?.classId || "").trim(),
    academicSectionId: String(placement?.academicSectionId || "").trim(),
  };
}

export async function listStudentTestsData(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement?: StudentPlacementInput | null;
  now?: Date;
}) {
  const now = params.now || new Date();
  const placement = normalizePlacement(params.studentPlacement);

  if (await isExamRuntimeEnabled()) {
    return listStudentExamRuntimeTests(
      params.schoolKey,
      params.studentId,
      placement,
    );
  }

  if (!placement.classId) {
    return [];
  }

  const {
    QuestionPaper: QuestionPaperModel,
    QuestionPaperResponse: QuestionPaperResponseModel,
    Question: QuestionModel,
    Class: ClassModel,
    Subject: SubjectModel,
  } = await getStudentTestModels(params.schoolKey);

  const papers = await loadOnlinePapersForClass(
    {
      QuestionPaper: QuestionPaperModel,
      Question: QuestionModel,
      Class: ClassModel,
      Subject: SubjectModel,
    },
    params.schoolKey,
    placement.classId,
  );

  const eligiblePapers = papers.filter(
    (paper: any) =>
      paperSupportsOnlineDelivery(paper) &&
      isStudentEligibleForPaper(paper, placement),
  );

  if (eligiblePapers.length === 0) {
    return [];
  }

  const attempts = await QuestionPaperResponseModel.find({
    student: params.studentId,
    paper: { $in: eligiblePapers.map((paper: any) => paper._id) },
  })
    .select("paper student startedAt submittedAt status lastSavedAt totalMarksAwarded sectionAnswers")
    .lean();

  const attemptsByPaperId = new Map<string, any>(
    attempts.map((attempt: any) => [String(attempt.paper), attempt]),
  );

  await autoSubmitExpiredAttemptsForPapers({
    attemptsByPaperId,
    papers: eligiblePapers,
    now,
    QuestionPaperResponseModel,
    maxConcurrency: 6,
  });

  const tests = [];

  for (const paper of eligiblePapers) {
    const attempt = attemptsByPaperId.get(String(paper._id)) || null;

    const status = deriveStudentTestStatus(paper, attempt, now);
    const remainingTimeMs = attempt
      ? getRemainingTimeMs(paper, attempt, now)
      : null;
    const paperSubjects = serializePaperSubjects(paper);

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
      ...paperSubjects,
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

  return tests;
}
