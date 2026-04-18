import "server-only";

import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { resolveExamRuntimeMongoResponseIdWithCooldown } from "@/lib/exam-runtime-sync-cache";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import { buildPaperQuestionLookup } from "@/lib/question-paper/grading";
import {
  buildSummerCrashAnswerSummary,
  buildSummerCrashAreaInsights,
  buildSummerCrashParentNextSteps,
  getSummerCrashQuestionStatus,
  selectSummerCrashQuestionLabels,
  truncateText,
  type SummerCrashDiagnosticAreaSummary,
} from "@/lib/summer-crash/diagnostic-report";
import { getSummerCrashCourseAccessForStudent } from "@/lib/server/summer-crash";

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

function normalizeText(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function serializeDate(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

type SummerCrashDiagnosticOverview = {
  totalQuestions: number;
  answered: number;
  correct: number;
  incorrect: number;
  unattempted: number;
};

export type SummerCrashDiagnosticParentReviewQuestion = {
  questionId: string;
  questionNumber: number;
  status: "incorrect" | "unattempted";
  weakAreaLabel: string;
  promptHtml: string;
  promptPreview: string;
  studentAnswerSummary: string;
  correctAnswerSummary: string;
  explanationHtml: string;
  subjectLabel: string;
  topicLabel: string;
  detailHref: string;
};

export type SummerCrashDiagnosticParentReport = {
  student: string;
  guardianName: string;
  classBand: string;
  paperTitle: string;
  submittedAt: string | null;
  score: number;
  totalMarks: number;
  percent: number;
  overview: SummerCrashDiagnosticOverview;
  strengths: SummerCrashDiagnosticAreaSummary[];
  focusAreas: SummerCrashDiagnosticAreaSummary[];
  weakSubskills: SummerCrashDiagnosticAreaSummary[];
  weakTopics: SummerCrashDiagnosticAreaSummary[];
  nextSteps: string[];
  reviewQuestions: SummerCrashDiagnosticParentReviewQuestion[];
  courseAccess: Awaited<
    ReturnType<typeof getSummerCrashCourseAccessForStudent>
  >["courseAccess"];
  supportContact: string;
};

export async function getSummerCrashDiagnosticParentReport(params: {
  schoolKey: string;
  studentId: string;
  responseId: string;
}): Promise<SummerCrashDiagnosticParentReport | null> {
  let resolvedResponseId = normalizeId(params.responseId);

  if (
    resolvedResponseId &&
    !mongoose.Types.ObjectId.isValid(resolvedResponseId)
  ) {
    resolvedResponseId =
      (await resolveExamRuntimeMongoResponseIdWithCooldown(
        params.schoolKey,
        resolvedResponseId,
      )) || resolvedResponseId;
  }

  if (!mongoose.Types.ObjectId.isValid(resolvedResponseId)) {
    return null;
  }

  await connectDB();
  const {
    QuestionPaperResponse: QuestionPaperResponseModel,
    QuestionPaper: QuestionPaperModel,
    Question: QuestionModel,
    Tag: TagModel,
    TagType: TagTypeModel,
    Subject: SubjectModel,
    Class: ClassModel,
  } = await getTenantModels(params.schoolKey, [
    "QuestionPaperResponse",
    "QuestionPaper",
    "Question",
    "Tag",
    "TagType",
    "Subject",
    "Class",
  ]);

  const response = await QuestionPaperResponseModel.findOne({
    _id: resolvedResponseId,
    student: params.studentId,
  })
    .select("paper status submittedAt updatedAt totalMarksAwarded sectionAnswers")
    .populate({
      path: "paper",
      model: QuestionPaperModel,
      select: "title class subject subjectIds totalMarks sections",
      populate: [
        { path: "class", model: ClassModel, select: "name" },
        { path: "subject", model: SubjectModel, select: "name" },
        { path: "subjectIds", model: SubjectModel, select: "name" },
        {
          path: "sections.questions.question",
          model: QuestionModel,
          select:
            "content options answerIndexes matrixOptions matrixAnswers explanation marks type subject class tags",
          populate: [
            {
              path: "tags",
              model: TagModel,
              populate: { path: "type", model: TagTypeModel, select: "name" },
            },
            { path: "subject", model: SubjectModel, select: "name" },
            { path: "class", model: ClassModel, select: "name" },
          ],
        },
      ],
    })
    .lean();

  const paper = response?.paper as any;
  if (!paper?._id) {
    return null;
  }

  const { campaign, enrollment, courseAccess } =
    await getSummerCrashCourseAccessForStudent({
      schoolKey: params.schoolKey,
      studentId: params.studentId,
    });

  const answerLookup = new Map<string, any>();
  const answerLookupByQuestionId = new Map<string, any>();

  (Array.isArray(response?.sectionAnswers) ? response.sectionAnswers : []).forEach(
    (sectionAnswer: any) => {
      const sectionName = normalizeText(sectionAnswer?.sectionName);
      (Array.isArray(sectionAnswer?.answers) ? sectionAnswer.answers : []).forEach(
        (answer: any) => {
          const questionId = normalizeId(answer?.question);
          if (!questionId) {
            return;
          }

          if (sectionName) {
            answerLookup.set(`${sectionName}::${questionId}`, answer);
          }

          if (!answerLookupByQuestionId.has(questionId)) {
            answerLookupByQuestionId.set(questionId, answer);
          }
        },
      );
    },
  );

  const paperQuestionLookup = buildPaperQuestionLookup(paper);
  const questionResults: Array<{
    question: any;
    sectionName: string;
    fallbackSubjectName?: string;
    status: "correct" | "incorrect" | "unattempted";
  }> = [];
  const reviewQuestions: SummerCrashDiagnosticParentReviewQuestion[] = [];

  let questionNumber = 0;
  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;

  const paperSubjectNames = [
    paper?.subject?.name,
    ...(Array.isArray(paper?.subjectIds)
      ? paper.subjectIds.map((subject: any) => subject?.name)
      : []),
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  (Array.isArray(paper?.sections) ? paper.sections : []).forEach((section: any) => {
    const sectionName = normalizeText(section?.name);
    const sectionDescription = normalizeText(section?.description);
    (Array.isArray(section?.questions) ? section.questions : []).forEach(
      (entry: any) => {
        questionNumber += 1;
        const question = entry?.question;
        const questionId = normalizeId(question?._id || question);
        if (!questionId || !question) {
          return;
        }

        const spec = paperQuestionLookup.get(`${sectionName}::${questionId}`);
        if (!spec) {
          return;
        }

        const answer =
          answerLookup.get(`${sectionName}::${questionId}`) ||
          answerLookupByQuestionId.get(questionId) ||
          null;
        const status = getSummerCrashQuestionStatus({
          spec,
          answer,
        });

        questionResults.push({
          question,
          sectionName,
          fallbackSubjectName: paperSubjectNames[0],
          status,
        });

        if (status === "correct") {
          correct += 1;
        } else if (status === "incorrect") {
          incorrect += 1;
        } else {
          unattempted += 1;
        }

        if (status === "correct") {
          return;
        }

        const answerSummary = buildSummerCrashAnswerSummary({
          question,
          answer,
        });
        const labels = selectSummerCrashQuestionLabels({
          question,
          fallbackSectionName: sectionName || sectionDescription,
          fallbackSubjectName: paperSubjectNames[0],
        });
        reviewQuestions.push({
          questionId,
          questionNumber,
          status,
          weakAreaLabel: labels.weakAreaLabel || labels.topicLabel || "Needs review",
          promptHtml: String(question?.content || ""),
          promptPreview: truncateText(question?.content || "", 180),
          studentAnswerSummary: answerSummary.studentAnswerSummary,
          correctAnswerSummary: answerSummary.correctAnswerSummary,
          explanationHtml: String(question?.explanation || ""),
          subjectLabel: labels.subjectLabel || paperSubjectNames[0] || "",
          topicLabel: labels.topicLabel || sectionName || "",
          detailHref: buildHrefWithReturnTo(
            `/student/reports/${encodeURIComponent(resolvedResponseId)}/questions/${encodeURIComponent(
              questionId,
            )}`,
            `/student/reports/${encodeURIComponent(resolvedResponseId)}`,
          ),
        });
      },
    );
  });

  const overview = {
    totalQuestions: questionNumber,
    answered: correct + incorrect,
    correct,
    incorrect,
    unattempted,
  } satisfies SummerCrashDiagnosticOverview;

  const score = Number.isFinite(Number(response?.totalMarksAwarded))
    ? Number(response?.totalMarksAwarded)
    : Number.isFinite(Number(enrollment?.diagnosticScore))
      ? Number(enrollment?.diagnosticScore)
      : 0;
  const paperTotalMarks = Number.isFinite(Number(paper?.totalMarks))
    ? Number(paper.totalMarks)
    : 0;
  const percent = Number.isFinite(Number(enrollment?.diagnosticPercent))
    ? Number(enrollment?.diagnosticPercent)
    : paperTotalMarks > 0
      ? Number(((score / paperTotalMarks) * 100).toFixed(1))
      : 0;

  const insights = buildSummerCrashAreaInsights({
    questionResults,
  });
  const weakSubskills = insights.subskillInsights
    .filter((row) => row.weaknessPct > 0)
    .slice(0, 3);
  const weakTopics = insights.topicInsights
    .filter((row) => row.weaknessPct > 0)
    .slice(0, 5);
  const nextSteps = buildSummerCrashParentNextSteps({
    weakSubskills,
    weakTopics,
    overallAccuracyPct:
      overview.totalQuestions > 0
        ? Math.round((overview.correct / overview.totalQuestions) * 100)
        : 0,
    isUnlocked: courseAccess.isUnlocked,
  });

  return {
    student: normalizeText(enrollment?.studentName) || "Student",
    guardianName: normalizeText(enrollment?.guardianName),
    classBand:
      normalizeText(enrollment?.classBand) ||
      normalizeText(paper?.class?.name) ||
      "Summer Crash",
    paperTitle: normalizeText(paper?.title) || "Diagnostic Test",
    submittedAt: serializeDate(
      response?.submittedAt || enrollment?.diagnosticCompletedAt || response?.updatedAt,
    ),
    score,
    totalMarks: paperTotalMarks,
    percent,
    overview,
    strengths: insights.strengths,
    focusAreas: insights.focusAreas,
    weakSubskills,
    weakTopics,
    nextSteps,
    reviewQuestions,
    courseAccess,
    supportContact: normalizeText(campaign?.supportContact),
  };
}
