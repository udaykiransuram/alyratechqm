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
import {
  formatSummerCrashPrice,
  resolveSummerCrashSupportHref,
} from "@/lib/summer-crash/shared";
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
  supportHref: string;
  whatsappSummaryText: string;
};

function getWhatsappWeakAreaBadge(weaknessPct: number) {
  return weaknessPct >= 70 ? "❌" : "⚠️";
}

function buildWhatsappTopAreas(params: {
  weakSubskills: SummerCrashDiagnosticAreaSummary[];
  weakTopics: SummerCrashDiagnosticAreaSummary[];
}) {
  const seen = new Set<string>();
  const items: Array<{ label: string; weaknessPct: number }> = [];

  [...params.weakSubskills, ...params.weakTopics].forEach((area) => {
    const label = normalizeText(area.label);
    if (!label || seen.has(label.toLowerCase())) {
      return;
    }

    seen.add(label.toLowerCase());
    items.push({
      label,
      weaknessPct: Number(area.weaknessPct || 0),
    });
  });

  return items.slice(0, 3);
}

function buildWhatsappMeaningLine(params: {
  percent: number;
  topAreaLabel: string;
}) {
  const topAreaLabel = normalizeText(params.topAreaLabel);
  const weakAreaSuffix = topAreaLabel
    ? `, especially in ${topAreaLabel},`
    : "";

  if (params.percent < 25) {
    return `There are clear foundation gaps${weakAreaSuffix}. Starting guided practice now can make later maths topics much easier.`;
  }

  if (params.percent < 50) {
    return `Some important foundations still need support${weakAreaSuffix}. A short structured plan can improve confidence and accuracy.`;
  }

  return `Your child has a base to build on, but the areas above still need focused support for stronger consistency.`;
}

function buildSummerCrashWhatsappSummaryText(params: {
  student: string;
  guardianName: string;
  classBand: string;
  paperTitle: string;
  score: number;
  totalMarks: number;
  percent: number;
  overview: SummerCrashDiagnosticOverview;
  weakSubskills: SummerCrashDiagnosticAreaSummary[];
  weakTopics: SummerCrashDiagnosticAreaSummary[];
  nextSteps: string[];
  courseAccess: Awaited<
    ReturnType<typeof getSummerCrashCourseAccessForStudent>
  >["courseAccess"];
  supportContact: string;
}) {
  const guardianName = normalizeText(params.guardianName) || "Parent";
  const studentName = normalizeText(params.student) || "your child";
  const classBand = normalizeText(params.classBand);
  const paperTitle = normalizeText(params.paperTitle);
  const topAreas = buildWhatsappTopAreas({
    weakSubskills: params.weakSubskills,
    weakTopics: params.weakTopics,
  });
  const topAreaLabel = topAreas[0]?.label || "";
  const totalMarksLabel =
    params.totalMarks > 0 ? `${params.score}/${params.totalMarks}` : String(params.score);
  const nextStepLines = params.nextSteps
    .filter(Boolean)
    .slice(0, 3)
    .map((step) => `• ${step}`);
  const lines = [
    "📊 Your Child's Math Diagnostic Report",
    "",
    `Hi ${guardianName},`,
    `We've completed ${studentName}'s assessment${paperTitle ? ` (${paperTitle})` : ""}. Here's a quick summary 👇`,
    "",
    "🔴 Overall Performance:",
    `👉 Score: ${totalMarksLabel} (${params.percent}%)`,
    `👉 Correct: ${params.overview.correct} | Incorrect: ${params.overview.incorrect} | Skipped: ${params.overview.unattempted}`,
    classBand ? `👉 Level checked for: ${classBand}` : "",
    "",
    "📌 Top Areas to Improve:",
    ...(topAreas.length > 0
      ? topAreas.map(
          (area) => `${getWhatsappWeakAreaBadge(area.weaknessPct)} ${area.label}`,
        )
      : ["⚠️ Review the incorrect and skipped questions in the report."]),
    "",
    "⚠️ What this means:",
    buildWhatsappMeaningLine({
      percent: params.percent,
      topAreaLabel,
    }),
    "",
    "✅ Good news:",
    "These gaps are fixable with consistent practice and the right guidance.",
    "",
    "🧠 Recommended next steps:",
    ...(nextStepLines.length > 0
      ? nextStepLines
      : ["• Start with the weakest topic and keep practice short and consistent."]),
    "",
    "🎯 Next step:",
    params.courseAccess.isUnlocked
      ? "Open the Summer Course and begin with the weakest area first."
      : params.courseAccess.requiresPayment
        ? `Join the structured Summer Crash Course at ${formatSummerCrashPrice(
            params.courseAccess.price,
            params.courseAccess.currency,
          )} to get guided support on these weak areas.`
        : "The Summer Crash Course is currently free, so you can open it and start right away.",
    params.supportContact
      ? `Support: ${normalizeText(params.supportContact)}`
      : "",
  ];

  return lines
    .filter((line, index, source) => {
      if (line !== "") {
        return true;
      }

      const previousLine = source[index - 1];
      const nextLine = source[index + 1];
      return previousLine !== "" && nextLine !== undefined;
    })
    .join("\n");
}

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
  const supportContact = normalizeText(campaign?.supportContact);
  const supportHref = resolveSummerCrashSupportHref({
    supportContact,
    whatsappGroupUrl: normalizeText(campaign?.whatsappGroupUrl),
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
    supportContact,
    supportHref,
    whatsappSummaryText: buildSummerCrashWhatsappSummaryText({
      student: normalizeText(enrollment?.studentName) || "Student",
      guardianName: normalizeText(enrollment?.guardianName),
      classBand:
        normalizeText(enrollment?.classBand) ||
        normalizeText(paper?.class?.name) ||
        "Summer Crash",
      paperTitle: normalizeText(paper?.title) || "Diagnostic Test",
      score,
      totalMarks: paperTotalMarks,
      percent,
      overview,
      weakSubskills,
      weakTopics,
      nextSteps,
      courseAccess,
      supportContact,
    }),
  };
}
