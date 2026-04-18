import {
  formatBenchmarkSectionTieLabel,
  getRankedBenchmarkQuestionRows,
  getRankedBenchmarkTagRows,
  getWorstDistractorGapSections,
} from "@/lib/analytics/benchmarkPresentation";
import {
  getStudentAcademicSectionId,
  toIdString,
} from "@/lib/analytics/hydrateResponses";
import {
  resolveAnalyticsTags,
  type AnalyticsTagLookup,
} from "@/lib/analytics/tag-resolution";
import {
  analyticsTagValuesMatchFilters,
  buildAnalyticsTagValuesByType,
  parseAnalyticsTagFilters,
  type AnalyticsTagFilter,
} from "@/lib/analytics/tag-filters";
import { arraysEqual, matricesEqual } from "@/lib/question-paper/grading";
import { getLegacyPaperSubject } from "@/lib/question-paper/subjects";

type QuestionMeta = {
  key: string;
  questionId: string;
  questionNumber: number;
  paperSectionName: string;
  marks: number;
  negativeMarks: number;
  type: string;
  answerIndexes: number[];
  matrixAnswers: number[][];
  options: any[];
  question: any;
  tags: { type: string; value: string }[];
  tagsByType: Record<string, string[]>;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
};

type QuestionOpportunity = {
  questionKey: string;
  questionId: string;
  questionNumber: number;
  paperSectionName: string;
  questionLabel: string;
  groupKey: string;
  groupLabel: string;
  groupPath: { field: string; value: string }[];
  marks: number;
  negativeMarks: number;
  scoreAwarded: number;
  attempted: boolean;
  isCorrect: boolean;
  isIncorrect: boolean;
  isUnattempted: boolean;
  selectedOptions: number[];
  answerIndexes: number[];
  tags: { type: string; value: string }[];
  options: any[];
};

type ResponseContext = {
  response: any;
  student: any;
  studentId: string;
  academicSectionId: string;
  academicSectionName: string;
  completionMinutes: number | null;
  filteredScore: number;
  opportunities: QuestionOpportunity[];
};

type BenchmarkMetrics = {
  eligibleStudents: number;
  respondents: number;
  coveragePct: number;
  questionCount: number;
  opportunityCount: number;
  possibleMarks: number;
  passThresholdMarks: number | null;
  totalAwardedMarks: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  attemptedCount: number;
  accuracyPct: number;
  incorrectPct: number;
  unattemptedPct: number;
  attemptRatePct: number;
  avgScorePct: number | null;
  passRatePct: number | null;
  medianCompletionMinutes: number | null;
};

type BenchmarkGap = {
  accuracyPct: number;
  incorrectPct: number;
  unattemptedPct: number;
  attemptRatePct: number;
  avgScorePct: number;
  passRatePct: number;
  coveragePct: number;
  medianCompletionMinutes: number;
};

type CohortSummary = {
  academicSectionId: string;
  academicSectionName: string;
  className: string;
  metrics: BenchmarkMetrics;
  gap: BenchmarkGap;
};

function describeLargestGap(worstGapSections: any[], worstGap: number) {
  if (!Array.isArray(worstGapSections) || worstGapSections.length === 0) {
    return "";
  }

  const sectionLabel = formatBenchmarkSectionTieLabel(worstGapSections, {
    maxInlineNames: 2,
  });
  const gapLabel = `${roundTo(Math.abs(worstGap), 2)} points`;

  if (worstGapSections.length === 1) {
    return `, with the largest gap at ${gapLabel} in ${sectionLabel}`;
  }

  return `, with the largest gap of ${gapLabel} shared by ${sectionLabel}`;
}

function roundTo(value: number, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toPercent(part: number, total: number) {
  if (!total) return 0;
  return roundTo((part / total) * 100, 2);
}

function median(values: number[]) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return roundTo((sorted[middle - 1] + sorted[middle]) / 2, 2);
  }
  return roundTo(sorted[middle], 2);
}

function fallbackLabel(field: string) {
  return field
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const parseBenchmarkTagFilters = parseAnalyticsTagFilters;

function getQuestionTags(question: any, tagLookup?: AnalyticsTagLookup) {
  return resolveAnalyticsTags(question?.tags || [], tagLookup)
    .map((tag) => ({
      type: String(tag?.type?.name || "").trim().toLowerCase(),
      value: String(tag?.name || "").trim(),
    }))
    .filter((tag: { type: string; value: string }) => tag.type && tag.value);
}

function buildQuestionMetas(
  paperSections: any[],
  paperDefaultSubject?: { _id: string; name: string } | null,
  tagLookup?: AnalyticsTagLookup,
) {
  const metas: QuestionMeta[] = [];

  (Array.isArray(paperSections) ? paperSections : []).forEach((paperSection: any) => {
    let questionNumber = 1;
    (Array.isArray(paperSection?.questions) ? paperSection.questions : []).forEach(
      (qWrap: any) => {
        const question = qWrap?.question;
        const questionId = toIdString(question);
        if (!questionId) {
          questionNumber += 1;
          return;
        }
        const tags = getQuestionTags(question, tagLookup);
        const tagsByType = buildAnalyticsTagValuesByType(tags);
        const subject = question?.subject || paperDefaultSubject || null;
        metas.push({
          key: `${String(paperSection?.name || "")}::${questionId}`,
          questionId,
          questionNumber,
          paperSectionName: String(paperSection?.name || "Unknown Section"),
          marks: Number(qWrap?.marks || 0),
          negativeMarks: Number(qWrap?.negativeMarks || 0),
          type: String(question?.type || ""),
          answerIndexes: Array.isArray(question?.answerIndexes)
            ? question.answerIndexes.map((value: any) => Number(value)).filter(Number.isFinite)
            : [],
          matrixAnswers: Array.isArray(question?.matrixAnswers)
            ? question.matrixAnswers.map((row: any) =>
                Array.isArray(row)
                  ? row.map((value: any) => Number(value)).filter(Number.isFinite)
                  : [],
              )
            : [],
          options: Array.isArray(question?.options) ? question.options : [],
          question,
          tags,
          tagsByType,
          subjectId: toIdString(subject),
          subjectName: String(subject?.name || "Unknown Subject"),
          classId: toIdString(question?.class),
          className: String(question?.class?.name || "Unknown Class"),
        });
        questionNumber += 1;
      },
    );
  });

  return metas;
}

function questionMatchesTagFilters(
  meta: QuestionMeta,
  tagFilters: AnalyticsTagFilter[],
) {
  return analyticsTagValuesMatchFilters(meta.tagsByType, tagFilters);
}

function getGroupValue(meta: QuestionMeta, field: string) {
  const normalizedField = String(field || "").trim().toLowerCase();
  if (normalizedField === "section") return meta.paperSectionName || "Unknown Section";
  if (normalizedField === "class") return meta.className || "Unknown Class";
  if (normalizedField === "subject") return meta.subjectName || "Unknown Subject";
  if (normalizedField === "tagtype") {
    return meta.tags.length > 0
      ? meta.tags
          .map((tag: { type: string; value: string }) => `${fallbackLabel(tag.type)}: ${tag.value}`)
          .sort((left, right) => left.localeCompare(right))
          .join(" • ")
      : "No Tags";
  }

  const tagValues = meta.tagsByType[normalizedField] || [];
  if (tagValues.length === 0) {
    return `Unknown ${fallbackLabel(normalizedField)}`;
  }
  return tagValues.join(" / ");
}

function buildQuestionGroups(questionMetas: QuestionMeta[], groupBy: string[]) {
  const normalizedGroupBy = Array.isArray(groupBy)
    ? groupBy.map((field) => String(field || "").trim()).filter(Boolean)
    : [];

  const groups = new Map<string, {
    key: string;
    label: string;
    path: { field: string; value: string }[];
    questionKeys: string[];
    questions: { id: string; number: number; section: string }[];
    possibleMarks: number;
  }>();

  questionMetas.forEach((meta) => {
    const path = normalizedGroupBy.map((field) => ({
      field,
      value: getGroupValue(meta, field),
    }));
    const key = path.length > 0
      ? path.map((entry) => `${entry.field}:${entry.value}`).join("||")
      : "overall";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: path.length > 0 ? path.map((entry) => entry.value).join(" • ") : "Overall",
        path,
        questionKeys: [],
        questions: [],
        possibleMarks: 0,
      });
    }

    const current = groups.get(key)!;
    if (!current.questionKeys.includes(meta.key)) {
      current.questionKeys.push(meta.key);
      current.questions.push({
        id: meta.questionId,
        number: meta.questionNumber,
        section: meta.paperSectionName,
      });
      current.possibleMarks += Number(meta.marks || 0);
    }
  });

  return Array.from(groups.values()).sort((left, right) => left.label.localeCompare(right.label));
}

function getCompletionMinutes(response: any) {
  const startedAt = response?.startedAt ? new Date(response.startedAt).getTime() : NaN;
  const submittedAt = response?.submittedAt ? new Date(response.submittedAt).getTime() : NaN;
  if (!Number.isFinite(startedAt) || !Number.isFinite(submittedAt) || submittedAt < startedAt) {
    return null;
  }
  return roundTo((submittedAt - startedAt) / 60000, 2);
}

function buildAnswerMap(response: any) {
  const answerMap = new Map<string, any>();
  (Array.isArray(response?.sectionAnswers) ? response.sectionAnswers : []).forEach(
    (sectionAnswer: any) => {
      const sectionName = String(sectionAnswer?.sectionName || "");
      (Array.isArray(sectionAnswer?.answers) ? sectionAnswer.answers : []).forEach(
        (answer: any) => {
          const questionId = toIdString(answer?.question);
          if (!sectionName || !questionId) return;
          answerMap.set(`${sectionName}::${questionId}`, answer);
        },
      );
    },
  );
  return answerMap;
}

function evaluateOpportunity(meta: QuestionMeta, answer: any) {
  const selectedOptions = Array.isArray(answer?.selectedOptions)
    ? answer.selectedOptions
        .map((value: any) => Number(value))
        .filter((value: number) => Number.isFinite(value))
    : [];
  const matrixSelections = Array.isArray(answer?.matrixSelections)
    ? answer.matrixSelections.map((row: any) =>
        Array.isArray(row)
          ? row.map((value: any) => Number(value)).filter((value: number) => Number.isFinite(value))
          : [],
      )
    : [];
  const hasMatrixSelections = matrixSelections.some((row: number[]) => row.length > 0);
  const hasAnswerText = typeof answer?.answerText === "string" && answer.answerText.trim().length > 0;
  const hasMarksAwarded = Number.isFinite(Number(answer?.marksAwarded));
  const attempted =
    selectedOptions.length > 0 ||
    hasMatrixSelections ||
    hasAnswerText ||
    hasMarksAwarded;
  const awardedMarks = hasMarksAwarded ? Number(answer?.marksAwarded) : null;

  let isCorrect = false;
  if (meta.type === "matrix-match" && hasMatrixSelections) {
    isCorrect = matricesEqual(matrixSelections, meta.matrixAnswers);
  } else if (meta.answerIndexes.length > 0 && selectedOptions.length > 0) {
    isCorrect = arraysEqual(selectedOptions, meta.answerIndexes);
  } else if (awardedMarks !== null) {
    isCorrect = awardedMarks >= Number(meta.marks || 0);
  }

  const scoreAwarded = awardedMarks !== null
    ? awardedMarks
    : !attempted
      ? 0
      : meta.type === "descriptive"
        ? 0
      : isCorrect
        ? Number(meta.marks || 0)
        : -Math.abs(Number(meta.negativeMarks || 0));

  return {
    selectedOptions,
    attempted,
    isCorrect,
    isIncorrect: attempted && !isCorrect,
    isUnattempted: !attempted,
    scoreAwarded,
  };
}

function buildResponseContexts({
  responses,
  filteredQuestionMetas,
  groupBy,
}: {
  responses: any[];
  filteredQuestionMetas: QuestionMeta[];
  groupBy: string[];
}) {
  return (Array.isArray(responses) ? responses : []).map((response: any) => {
    const answerMap = buildAnswerMap(response);
    const opportunities: QuestionOpportunity[] = filteredQuestionMetas.map((meta) => {
      const evaluation = evaluateOpportunity(meta, answerMap.get(meta.key));
      const groupPath = (Array.isArray(groupBy) ? groupBy : [])
        .map((field) => ({ field, value: getGroupValue(meta, field) }));
      return {
        questionKey: meta.key,
        questionId: meta.questionId,
        questionNumber: meta.questionNumber,
        paperSectionName: meta.paperSectionName,
        questionLabel: `${meta.paperSectionName} Q${meta.questionNumber}`,
        groupKey: groupPath.length > 0
          ? groupPath.map((entry) => `${entry.field}:${entry.value}`).join("||")
          : "overall",
        groupLabel: groupPath.length > 0
          ? groupPath.map((entry) => entry.value).join(" • ")
          : "Overall",
        groupPath,
        marks: meta.marks,
        negativeMarks: meta.negativeMarks,
        scoreAwarded: evaluation.scoreAwarded,
        attempted: evaluation.attempted,
        isCorrect: evaluation.isCorrect,
        isIncorrect: evaluation.isIncorrect,
        isUnattempted: evaluation.isUnattempted,
        selectedOptions: evaluation.selectedOptions,
        answerIndexes: meta.answerIndexes,
        tags: meta.tags,
        options: meta.options,
      };
    });

    return {
      response,
      student: response?.student || null,
      studentId: toIdString(response?.student),
      academicSectionId: getStudentAcademicSectionId(response?.student),
      academicSectionName: String(response?.student?.academicSection?.name || "Unassigned"),
      completionMinutes: getCompletionMinutes(response),
      filteredScore: roundTo(
        opportunities.reduce((sum, opportunity) => sum + Number(opportunity.scoreAwarded || 0), 0),
        2,
      ),
      opportunities,
    } as ResponseContext;
  });
}

function buildMetrics({
  contexts,
  eligibleStudentsCount,
  questionCount,
  possibleMarksPerResponse,
  paperPassingMarks,
  paperTotalMarks,
}: {
  contexts: ResponseContext[];
  eligibleStudentsCount: number;
  questionCount: number;
  possibleMarksPerResponse: number;
  paperPassingMarks: number;
  paperTotalMarks: number;
}): BenchmarkMetrics {
  const normalizedContexts = Array.isArray(contexts) ? contexts : [];
  const respondents = normalizedContexts.length;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;
  let totalAwardedMarks = 0;
  const completionValues: number[] = [];
  let passCount = 0;

  const scaledPassThreshold =
    possibleMarksPerResponse > 0 && paperTotalMarks > 0
      ? roundTo((Number(paperPassingMarks || 0) / Number(paperTotalMarks || 0)) * possibleMarksPerResponse, 2)
      : null;

  normalizedContexts.forEach((context) => {
    context.opportunities.forEach((opportunity) => {
      if (opportunity.isCorrect) correctCount += 1;
      else if (opportunity.isIncorrect) incorrectCount += 1;
      else unattemptedCount += 1;
    });
    totalAwardedMarks += Number(context.filteredScore || 0);
    if (context.completionMinutes !== null) {
      completionValues.push(context.completionMinutes);
    }
    if (scaledPassThreshold !== null && context.filteredScore >= scaledPassThreshold) {
      passCount += 1;
    }
  });

  const opportunityCount = respondents * questionCount;
  const attemptedCount = correctCount + incorrectCount;
  const possibleMarks = roundTo(respondents * possibleMarksPerResponse, 2);

  return {
    eligibleStudents: eligibleStudentsCount,
    respondents,
    coveragePct: toPercent(respondents, eligibleStudentsCount),
    questionCount,
    opportunityCount,
    possibleMarks: roundTo(possibleMarksPerResponse, 2),
    passThresholdMarks: scaledPassThreshold,
    totalAwardedMarks: roundTo(totalAwardedMarks, 2),
    correctCount,
    incorrectCount,
    unattemptedCount,
    attemptedCount,
    accuracyPct: toPercent(correctCount, opportunityCount),
    incorrectPct: toPercent(incorrectCount, opportunityCount),
    unattemptedPct: toPercent(unattemptedCount, opportunityCount),
    attemptRatePct: toPercent(attemptedCount, opportunityCount),
    avgScorePct:
      possibleMarks > 0 ? roundTo((totalAwardedMarks / possibleMarks) * 100, 2) : null,
    passRatePct:
      scaledPassThreshold !== null ? toPercent(passCount, respondents) : null,
    medianCompletionMinutes: median(completionValues),
  };
}

function buildGap(metrics: BenchmarkMetrics, baseline: BenchmarkMetrics): BenchmarkGap {
  const subtract = (left: number | null, right: number | null) =>
    roundTo(Number(left || 0) - Number(right || 0), 2);

  return {
    accuracyPct: subtract(metrics.accuracyPct, baseline.accuracyPct),
    incorrectPct: subtract(metrics.incorrectPct, baseline.incorrectPct),
    unattemptedPct: subtract(metrics.unattemptedPct, baseline.unattemptedPct),
    attemptRatePct: subtract(metrics.attemptRatePct, baseline.attemptRatePct),
    avgScorePct: subtract(metrics.avgScorePct, baseline.avgScorePct),
    passRatePct: subtract(metrics.passRatePct, baseline.passRatePct),
    coveragePct: subtract(metrics.coveragePct, baseline.coveragePct),
    medianCompletionMinutes: subtract(metrics.medianCompletionMinutes, baseline.medianCompletionMinutes),
  };
}

function filterContextsByAcademicSection(contexts: ResponseContext[], academicSectionId: string) {
  return (Array.isArray(contexts) ? contexts : []).filter(
    (context) => String(context.academicSectionId || "") === String(academicSectionId || ""),
  );
}

function buildCohortMetrics({
  cohortSection,
  contexts,
  eligibleStudents,
  questionCount,
  possibleMarksPerResponse,
  paperPassingMarks,
  paperTotalMarks,
  baseline,
}: {
  cohortSection: any;
  contexts: ResponseContext[];
  eligibleStudents: any[];
  questionCount: number;
  possibleMarksPerResponse: number;
  paperPassingMarks: number;
  paperTotalMarks: number;
  baseline: BenchmarkMetrics;
}): CohortSummary {
  const academicSectionId = toIdString(cohortSection);
  const academicSectionName = String(cohortSection?.name || "Unassigned");
  const className = String(cohortSection?.class?.name || "");
  const cohortContexts = academicSectionId
    ? filterContextsByAcademicSection(contexts, academicSectionId)
    : [];
  const cohortEligibleStudents = (Array.isArray(eligibleStudents) ? eligibleStudents : []).filter(
    (student: any) => getStudentAcademicSectionId(student) === academicSectionId,
  );
  const metrics = buildMetrics({
    contexts: cohortContexts,
    eligibleStudentsCount: cohortEligibleStudents.length,
    questionCount,
    possibleMarksPerResponse,
    paperPassingMarks,
    paperTotalMarks,
  });

  return {
    academicSectionId,
    academicSectionName,
    className,
    metrics,
    gap: buildGap(metrics, baseline),
  };
}

function buildTagBenchmarks({
  groups,
  contexts,
  cohorts,
  eligibleStudents,
  paperPassingMarks,
  paperTotalMarks,
}: {
  groups: ReturnType<typeof buildQuestionGroups>;
  contexts: ResponseContext[];
  cohorts: any[];
  eligibleStudents: any[];
  paperPassingMarks: number;
  paperTotalMarks: number;
}) {
  return groups.map((group) => {
    const questionKeySet = new Set(group.questionKeys);
    const baselineContexts = contexts.map((context) => ({
      ...context,
      opportunities: context.opportunities.filter((opportunity) => questionKeySet.has(opportunity.questionKey)),
      filteredScore: roundTo(
        context.opportunities
          .filter((opportunity) => questionKeySet.has(opportunity.questionKey))
          .reduce((sum, opportunity) => sum + Number(opportunity.scoreAwarded || 0), 0),
        2,
      ),
    }));

    const baseline = buildMetrics({
      contexts: baselineContexts,
      eligibleStudentsCount: Array.isArray(eligibleStudents) ? eligibleStudents.length : 0,
      questionCount: group.questionKeys.length,
      possibleMarksPerResponse: roundTo(group.possibleMarks, 2),
      paperPassingMarks,
      paperTotalMarks,
    });

    return {
      key: group.key,
      label: group.label,
      path: group.path,
      questionCount: group.questions.length,
      questions: group.questions,
      baseline,
      cohorts: (Array.isArray(cohorts) ? cohorts : []).map((cohort: any) => {
        const cohortContexts = baselineContexts.filter(
          (context) => context.academicSectionId === String(cohort.academicSectionId || ""),
        );
        const cohortEligibleStudents = (Array.isArray(eligibleStudents) ? eligibleStudents : []).filter(
          (student: any) => getStudentAcademicSectionId(student) === String(cohort.academicSectionId || ""),
        );
        const metrics = buildMetrics({
          contexts: cohortContexts,
          eligibleStudentsCount: cohortEligibleStudents.length,
          questionCount: group.questionKeys.length,
          possibleMarksPerResponse: roundTo(group.possibleMarks, 2),
          paperPassingMarks,
          paperTotalMarks,
        });
        return {
          academicSectionId: cohort.academicSectionId,
          academicSectionName: cohort.academicSectionName,
          metrics,
          gap: buildGap(metrics, baseline),
        };
      }),
    };
  });
}

function buildQuestionBenchmarks({
  filteredQuestionMetas,
  contexts,
  cohorts,
  eligibleStudents,
  paperPassingMarks,
  paperTotalMarks,
}: {
  filteredQuestionMetas: QuestionMeta[];
  contexts: ResponseContext[];
  cohorts: any[];
  eligibleStudents: any[];
  paperPassingMarks: number;
  paperTotalMarks: number;
}) {
  return filteredQuestionMetas.map((meta) => {
    const baselineContexts = contexts.map((context) => {
      const relevantOpportunities = context.opportunities.filter(
        (opportunity) => opportunity.questionKey === meta.key,
      );
      return {
        ...context,
        opportunities: relevantOpportunities,
        filteredScore: roundTo(
          relevantOpportunities.reduce(
            (sum, opportunity) => sum + Number(opportunity.scoreAwarded || 0),
            0,
          ),
          2,
        ),
      };
    });

    const baseline = buildMetrics({
      contexts: baselineContexts,
      eligibleStudentsCount: Array.isArray(eligibleStudents) ? eligibleStudents.length : 0,
      questionCount: 1,
      possibleMarksPerResponse: roundTo(Number(meta.marks || 0), 2),
      paperPassingMarks,
      paperTotalMarks,
    });

    return {
      key: meta.key,
      questionId: meta.questionId,
      questionNumber: meta.questionNumber,
      questionSection: meta.paperSectionName,
      questionLabel: `${meta.paperSectionName} Q${meta.questionNumber}`,
      questionText: String(meta.question?.content || ""),
      subjectName: String(meta.subjectName || ""),
      className: String(meta.className || ""),
      type: meta.question?.type,
      marks: Number(meta.marks || 0),
      tags: meta.tags,
      answerIndexes: Array.isArray(meta.answerIndexes) ? meta.answerIndexes : [],
      options: Array.isArray(meta.options) ? meta.options : [],
      baseline,
      cohorts: (Array.isArray(cohorts) ? cohorts : []).map((cohort: any) => {
        const cohortContexts = baselineContexts.filter(
          (context) => context.academicSectionId === String(cohort.academicSectionId || ""),
        );
        const cohortEligibleStudents = (Array.isArray(eligibleStudents) ? eligibleStudents : []).filter(
          (student: any) => getStudentAcademicSectionId(student) === String(cohort.academicSectionId || ""),
        );
        const metrics = buildMetrics({
          contexts: cohortContexts,
          eligibleStudentsCount: cohortEligibleStudents.length,
          questionCount: 1,
          possibleMarksPerResponse: roundTo(Number(meta.marks || 0), 2),
          paperPassingMarks,
          paperTotalMarks,
        });
        return {
          academicSectionId: cohort.academicSectionId,
          academicSectionName: cohort.academicSectionName,
          metrics,
          gap: buildGap(metrics, baseline),
        };
      }),
    };
  });
}

function buildDistractorBenchmarks({
  filteredQuestionMetas,
  contexts,
  cohorts,
}: {
  filteredQuestionMetas: QuestionMeta[];
  contexts: ResponseContext[];
  cohorts: any[];
}) {
  const rows: any[] = [];

  filteredQuestionMetas.forEach((meta) => {
    const optionCount = Array.isArray(meta.options) ? meta.options.length : 0;
    for (let optionIndex = 0; optionIndex < optionCount; optionIndex += 1) {
      const optionLetter = String.fromCharCode(65 + optionIndex);
      const optionTagType = `option ${optionLetter.toLowerCase()}`;
      const optionTags = meta.tags.filter(
        (tag) => String(tag.type || "").toLowerCase() === optionTagType,
      );

      const computeSelected = (candidateContexts: ResponseContext[]) => {
        const respondents = candidateContexts.length;
        const selectedCount = candidateContexts.reduce((sum, context) => {
          const opportunity = context.opportunities.find(
            (item) => item.questionKey === meta.key,
          );
          return sum + (opportunity?.selectedOptions.includes(optionIndex) ? 1 : 0);
        }, 0);
        return {
          respondents,
          selectedCount,
          selectedPct: toPercent(selectedCount, respondents),
        };
      };

      const baseline = computeSelected(contexts);
      const cohortRows = (Array.isArray(cohorts) ? cohorts : []).map((cohort: any) => {
        const cohortContexts = contexts.filter(
          (context) => context.academicSectionId === String(cohort.academicSectionId || ""),
        );
        const metrics = computeSelected(cohortContexts);
        return {
          academicSectionId: cohort.academicSectionId,
          academicSectionName: cohort.academicSectionName,
          metrics,
          gapSelectedPct: roundTo(metrics.selectedPct - baseline.selectedPct, 2),
        };
      });

      const hasSignal = baseline.selectedCount > 0 || cohortRows.some((cohortRow) => cohortRow.metrics.selectedCount > 0);
      if (!hasSignal) continue;

      rows.push({
        key: `${meta.key}::${optionIndex}`,
        questionId: meta.questionId,
        questionNumber: meta.questionNumber,
        questionSection: meta.paperSectionName,
        questionLabel: `${meta.paperSectionName} Q${meta.questionNumber}`,
        optionIndex,
        optionLabel: `Option ${optionLetter}`,
        optionText: String(meta.options?.[optionIndex]?.content || ""),
        optionTags,
        isCorrectOption: meta.answerIndexes.includes(optionIndex),
        baseline,
        cohorts: cohortRows,
      });
    }
  });

  return rows.sort((left, right) => {
    const leftPeak = Math.max(
      left.baseline?.selectedPct || 0,
      ...left.cohorts.map((cohort: any) => cohort.metrics?.selectedPct || 0),
    );
    const rightPeak = Math.max(
      right.baseline?.selectedPct || 0,
      ...right.cohorts.map((cohort: any) => cohort.metrics?.selectedPct || 0),
    );
    if (rightPeak !== leftPeak) return rightPeak - leftPeak;
    return String(left.questionLabel || "").localeCompare(String(right.questionLabel || ""));
  });
}

function buildInsights({
  baseline,
  cohorts,
  tagBenchmarks,
  distractorBenchmarks,
  questionBenchmarks,
  selectedAcademicSectionId,
}: {
  baseline: BenchmarkMetrics;
  cohorts: CohortSummary[];
  tagBenchmarks: any[];
  distractorBenchmarks: any[];
  questionBenchmarks: any[];
  selectedAcademicSectionId: string;
}) {
  const insights: Array<{
    type: string;
    severity: string;
    title: string;
    description: string;
  }> = [];

  const sortedCohorts = [...(Array.isArray(cohorts) ? cohorts : [])].sort(
    (left, right) => Number(left?.gap?.accuracyPct || 0) - Number(right?.gap?.accuracyPct || 0),
  );
  const selectedCohort = selectedAcademicSectionId
    ? sortedCohorts.find(
        (cohort) =>
          String(cohort?.academicSectionId || "") ===
          String(selectedAcademicSectionId || ""),
      ) || null
    : null;
  const totalSections = sortedCohorts.length;
  const sectionCount = Math.max(totalSections, 1);
  const rankedTagRows = getRankedBenchmarkTagRows(
    { cohorts, tagBenchmarks },
    selectedAcademicSectionId,
  );
  const rankedQuestionRows = getRankedBenchmarkQuestionRows(
    { cohorts, questionBenchmarks },
    selectedAcademicSectionId,
  );

  if (baseline.coveragePct < 70) {
    insights.push({
      type: "coverage",
      severity: baseline.coveragePct < 40 ? "high" : "medium",
      title: "Response coverage is low",
      description: `Only ${baseline.coveragePct}% of eligible students have responses for this paper scope.`,
    });
  }

  if (selectedCohort) {
    insights.push({
      type: "section_gap",
      severity: Number(selectedCohort?.gap?.accuracyPct || 0) < 0 ? "high" : "low",
      title: `${selectedCohort.academicSectionName} vs class average`,
      description: `${selectedCohort.academicSectionName} is ${roundTo(Math.abs(Number(selectedCohort?.gap?.accuracyPct || 0)), 2)} points ${Number(selectedCohort?.gap?.accuracyPct || 0) < 0 ? "below" : "above"} class accuracy for the selected scope.`,
    });

    rankedTagRows
      .filter((row: any) => !!row.focus)
      .slice(0, 3)
      .forEach((row: any, index: number) => {
        const focusGap = Number(row?.focus?.gap?.accuracyPct || 0);
        insights.push({
          type: `weak_tag_${index + 1}`,
          severity: focusGap < -10 ? "high" : focusGap < 0 ? "medium" : "low",
          title: `${index === 0 ? "Weakest benchmark bucket" : "Benchmark bucket"}: ${row.label}`,
          description: `${row.focus.academicSectionName} is ${roundTo(Math.abs(focusGap), 2)} points ${focusGap < 0 ? "below" : "above"} class accuracy in ${row.label}.`,
        });
      });

    rankedQuestionRows
      .filter((row: any) => !!row.focus)
      .slice(0, 3)
      .forEach((row: any, index: number) => {
        const focusGap = Number(row?.focus?.gap?.accuracyPct || 0);
        insights.push({
          type: `question_hotspot_${index + 1}`,
          severity: focusGap < -10 ? "high" : focusGap < 0 ? "medium" : "low",
          title: `Question hotspot: ${row.questionLabel}`,
          description: `${row.focus.academicSectionName} is ${roundTo(Math.abs(focusGap), 2)} points ${focusGap < 0 ? "below" : "above"} class accuracy on this question.`,
        });
      });

    rankedQuestionRows
      .filter(
        (row: any) => !!row.focus && Number(row?.focus?.metrics?.unattemptedPct || 0) > 0,
      )
      .sort(
        (left: any, right: any) =>
          Number(right?.focus?.metrics?.unattemptedPct || 0) -
          Number(left?.focus?.metrics?.unattemptedPct || 0),
      )
      .slice(0, 2)
      .forEach((row: any, index: number) => {
        const skipPct = roundTo(Number(row?.focus?.metrics?.unattemptedPct || 0), 2);
        insights.push({
          type: `question_skip_hotspot_${index + 1}`,
          severity: skipPct >= 30 ? "high" : "medium",
          title: `Skip hotspot: ${row.questionLabel}`,
          description: `${skipPct}% of ${row.focus.academicSectionName} left this question unattempted.`,
        });
      });
  } else {
    rankedTagRows.slice(0, 3).forEach((row: any, index: number) => {
      const classAccuracy = roundTo(Number(row?.baseline?.accuracyPct || 0), 2);
      const worstGap = Number(row?.worstGapSection?.gap?.accuracyPct || 0);
      const largestGapDescription = describeLargestGap(row?.worstGapSections, worstGap);
      insights.push({
        type: `aggregate_weak_tag_${index + 1}`,
        severity:
          classAccuracy < 40 ||
          Number(row?.affectedSectionsCount || 0) >= Math.max(2, Math.ceil(totalSections / 2))
            ? "high"
            : "medium",
        title: `${index === 0 ? "Weakest benchmark bucket" : "Benchmark bucket"}: ${row.label}`,
        description: `${row.label} has ${classAccuracy}% class accuracy; ${row.affectedSectionsCount} of ${sectionCount} sections are below this benchmark${largestGapDescription}.`,
      });
    });

    rankedQuestionRows.slice(0, 3).forEach((row: any) => {
      const classAccuracy = roundTo(Number(row?.baseline?.accuracyPct || 0), 2);
      const worstGap = Number(row?.worstGapSection?.gap?.accuracyPct || 0);
      const largestGapDescription = describeLargestGap(row?.worstGapSections, worstGap);
      insights.push({
        type: `aggregate_question_hotspot_${row.key}`,
        severity:
          classAccuracy < 40 ||
          Number(row?.affectedSectionsCount || 0) >= Math.max(2, Math.ceil(totalSections / 2))
            ? "high"
            : "medium",
        title: `Question hotspot: ${row.questionLabel}`,
        description: `${row.questionLabel} has ${classAccuracy}% class accuracy; ${row.affectedSectionsCount} of ${sectionCount} sections are below this benchmark${largestGapDescription}.`,
      });
    });

    rankedQuestionRows
      .filter((row: any) => Number(row?.baseline?.unattemptedPct || 0) > 0)
      .sort((left: any, right: any) => {
        const classSkipDiff =
          Number(right?.baseline?.unattemptedPct || 0) -
          Number(left?.baseline?.unattemptedPct || 0);
        if (classSkipDiff !== 0) return classSkipDiff;
        return (
          Number(right?.skipAffectedSectionsCount || 0) -
          Number(left?.skipAffectedSectionsCount || 0)
        );
      })
      .slice(0, 2)
      .forEach((row: any) => {
        const classSkip = roundTo(Number(row?.baseline?.unattemptedPct || 0), 2);
        const peakSkip = roundTo(Number(row?.peakSkipSection?.metrics?.unattemptedPct || 0), 2);
        insights.push({
          type: `aggregate_skip_hotspot_${row.key}`,
          severity:
            classSkip >= 30 ||
            Number(row?.skipAffectedSectionsCount || 0) >= Math.max(2, Math.ceil(totalSections / 2))
              ? "high"
              : "medium",
          title: `Skip hotspot: ${row.questionLabel}`,
          description: `${row.questionLabel} has ${classSkip}% class skip; ${row.skipAffectedSectionsCount} of ${sectionCount} sections exceed this skip rate${row?.peakSkipSection?.academicSectionName ? `, with peak skip at ${peakSkip}% in ${row.peakSkipSection.academicSectionName}` : ""}.`,
        });
      });

    if (sortedCohorts.length > 0) {
      const belowBaselineSections = sortedCohorts.filter(
        (cohort) => Number(cohort?.gap?.accuracyPct || 0) < 0,
      );
      const weakestSection = sortedCohorts[0] || null;
      const strongestSection = [...sortedCohorts].sort(
        (left, right) => Number(right?.metrics?.accuracyPct || 0) - Number(left?.metrics?.accuracyPct || 0),
      )[0] || null;

      if (belowBaselineSections.length > 0 && weakestSection) {
        insights.push({
          type: "section_spread",
          severity:
            belowBaselineSections.length === sortedCohorts.length ? "high" : "medium",
          title: "Section spread below baseline",
          description: `${belowBaselineSections.length} of ${sortedCohorts.length} sections are below class accuracy; ${weakestSection.academicSectionName} is furthest at ${roundTo(Math.abs(Number(weakestSection?.gap?.accuracyPct || 0)), 2)} points below.`,
        });
      } else if (strongestSection) {
        insights.push({
          type: "section_spread",
          severity: "low",
          title: "Section spread is healthy",
          description: `All ${sortedCohorts.length} sections are at or above class accuracy for this paper scope; ${strongestSection.academicSectionName} currently leads at ${roundTo(Number(strongestSection?.gap?.accuracyPct || 0), 2)} points above baseline.`,
        });
      }
    }
  }

  const distractorRows = (Array.isArray(distractorBenchmarks) ? distractorBenchmarks : [])
    .filter((row) => !row?.isCorrectOption)
    .map((row) => {
      const cohortRows = Array.isArray(row?.cohorts) ? row.cohorts : [];
      const focus = selectedCohort
        ? cohortRows.find(
            (cohort: any) =>
              String(cohort?.academicSectionId || "") ===
              String(selectedCohort?.academicSectionId || ""),
          ) || null
        : null;
      const affectedSections = cohortRows.filter(
        (cohort: any) => Number(cohort?.gapSelectedPct || 0) > 0,
      );
      const peakSelectedSection =
        cohortRows.length > 0
          ? [...cohortRows].sort(
              (left: any, right: any) =>
                Number(right?.metrics?.selectedPct || 0) - Number(left?.metrics?.selectedPct || 0),
            )[0] || null
          : null;

      const worstGapSections = getWorstDistractorGapSections(cohortRows);
      const worstGapSection = worstGapSections[0] || null;

      return {
        ...row,
        focus,
        affectedSectionsCount: affectedSections.length,
        peakSelectedSection,
        worstGapSection,
        worstGapSections,
      };
    });

  if (selectedCohort) {
    distractorRows
      .filter((row) => !!row.focus && Number(row?.focus?.metrics?.selectedPct || 0) > 0)
      .sort(
        (left, right) => Number(right?.focus?.metrics?.selectedPct || 0) - Number(left?.focus?.metrics?.selectedPct || 0),
      )
      .slice(0, 2)
      .forEach((row, index) => {
        const selectedPct = roundTo(Number(row?.focus?.metrics?.selectedPct || 0), 2);
        const selectedGap = Number(row?.focus?.gapSelectedPct || 0);
        insights.push({
          type: `distractor_${index + 1}`,
          severity: selectedPct >= 30 ? "high" : "medium",
          title: `Distractor hotspot: ${row.questionLabel}`,
          description: `${selectedPct}% of ${row.focus.academicSectionName} selected ${row.optionLabel}, ${roundTo(Math.abs(selectedGap), 2)} points ${selectedGap >= 0 ? "above" : "below"} class selection.`,
        });
      });
  } else {
    distractorRows
      .filter((row) => Number(row?.affectedSectionsCount || 0) > 0)
      .sort((left, right) => {
        const affectedDiff = Number(right?.affectedSectionsCount || 0) - Number(left?.affectedSectionsCount || 0);
        if (affectedDiff !== 0) return affectedDiff;
        return Number(right?.peakSelectedSection?.metrics?.selectedPct || 0) - Number(left?.peakSelectedSection?.metrics?.selectedPct || 0);
      })
      .slice(0, 2)
      .forEach((row) => {
        const peakSelectedPct = roundTo(Number(row?.peakSelectedSection?.metrics?.selectedPct || 0), 2);
        const largestGap = Number(row?.worstGapSection?.gapSelectedPct || 0);
        const largestGapDescription = describeLargestGap(row?.worstGapSections, largestGap);
        insights.push({
          type: `aggregate_distractor_${row.key}`,
          severity:
            Number(row?.affectedSectionsCount || 0) >= Math.max(2, Math.ceil(totalSections / 2))
              ? "high"
              : "medium",
          title: `Distractor hotspot: ${row.questionLabel}`,
          description: `${row.optionLabel} is above the class selection rate in ${row.affectedSectionsCount} of ${sectionCount} sections; peak selection is ${peakSelectedPct}%${largestGapDescription}.`,
        });
      });
  }

  return insights;
}

export function buildBenchmarkReport({
  paper,
  eligibleStudents,
  responses,
  groupBy,
  tagFilters,
  selectedClassId,
  selectedAcademicSectionId,
  selectedSubjectId,
  allowedSubjectIds,
  tagLookup,
}: {
  paper: any;
  eligibleStudents: any[];
  responses: any[];
  groupBy: string[];
  tagFilters: AnalyticsTagFilter[];
  selectedClassId?: string;
  selectedAcademicSectionId?: string;
  selectedSubjectId?: string;
  allowedSubjectIds?: string[];
  tagLookup?: AnalyticsTagLookup;
}) {
  const paperObj = paper || {};
  const paperSections = Array.isArray(paperObj?.sections) ? paperObj.sections : [];
  const questionMetas = buildQuestionMetas(
    paperSections,
    getLegacyPaperSubject(paperObj),
    tagLookup,
  );
  const allowedSubjectIdSet = new Set(
    (Array.isArray(allowedSubjectIds) ? allowedSubjectIds : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );
  const normalizedSelectedClassId = String(selectedClassId || "").trim();
  const normalizedSelectedSubjectId = String(selectedSubjectId || "").trim();
  const filteredQuestionMetas = questionMetas.filter((meta) => {
    if (
      normalizedSelectedClassId &&
      String(meta.classId || "").trim() !== normalizedSelectedClassId
    ) {
      return false;
    }

    if (
      allowedSubjectIdSet.size > 0 &&
      !allowedSubjectIdSet.has(String(meta.subjectId || "").trim())
    ) {
      return false;
    }

    if (
      normalizedSelectedSubjectId &&
      String(meta.subjectId || "").trim() !== normalizedSelectedSubjectId
    ) {
      return false;
    }

    return questionMatchesTagFilters(meta, tagFilters);
  });
  const effectiveGroupBy = Array.isArray(groupBy) && groupBy.length > 0 ? groupBy : ["section"];

  const eligibleSectionMap = new Map<string, any>();
  (Array.isArray(paperObj?.assignedAcademicSections) ? paperObj.assignedAcademicSections : []).forEach(
    (section: any) => {
      const sectionId = toIdString(section);
      if (!sectionId) return;
      eligibleSectionMap.set(sectionId, section);
    },
  );
  (Array.isArray(eligibleStudents) ? eligibleStudents : []).forEach((student: any) => {
    const section = student?.academicSection;
    const sectionId = toIdString(section);
    if (!sectionId || eligibleSectionMap.has(sectionId)) return;
    eligibleSectionMap.set(sectionId, section);
  });
  (Array.isArray(responses) ? responses : []).forEach((response: any) => {
    const section = response?.student?.academicSection;
    const sectionId = toIdString(section);
    if (!sectionId || eligibleSectionMap.has(sectionId)) return;
    eligibleSectionMap.set(sectionId, section);
  });

  const eligibleSections = Array.from(eligibleSectionMap.values())
    .filter(Boolean)
    .sort((left: any, right: any) => String(left?.name || "").localeCompare(String(right?.name || "")));

  const filteredResponses = (Array.isArray(responses) ? responses : []).filter((response: any) => !!response?.student);
  const responseContexts = buildResponseContexts({
    responses: filteredResponses,
    filteredQuestionMetas,
    groupBy: effectiveGroupBy,
  });

  const possibleMarksPerResponse = roundTo(
    filteredQuestionMetas.reduce((sum, meta) => sum + Number(meta.marks || 0), 0),
    2,
  );
  const paperTotalMarks = Number(
    paperObj?.totalMarks || questionMetas.reduce((sum, meta) => sum + Number(meta.marks || 0), 0),
  );
  const paperPassingMarks = Number(paperObj?.passingMarks || 0);

  const baseline = buildMetrics({
    contexts: responseContexts,
    eligibleStudentsCount: Array.isArray(eligibleStudents) ? eligibleStudents.length : 0,
    questionCount: filteredQuestionMetas.length,
    possibleMarksPerResponse,
    paperPassingMarks,
    paperTotalMarks,
  });

  const cohortSections = selectedAcademicSectionId
    ? eligibleSections.filter(
        (section: any) => toIdString(section) === String(selectedAcademicSectionId || ""),
      )
    : eligibleSections;

  const cohorts = cohortSections.map((cohortSection: any) =>
    buildCohortMetrics({
      cohortSection,
      contexts: responseContexts,
      eligibleStudents,
      questionCount: filteredQuestionMetas.length,
      possibleMarksPerResponse,
      paperPassingMarks,
      paperTotalMarks,
      baseline,
    }),
  );

  const questionGroups = buildQuestionGroups(filteredQuestionMetas, effectiveGroupBy);
  const tagBenchmarks = buildTagBenchmarks({
    groups: questionGroups,
    contexts: responseContexts,
    cohorts,
    eligibleStudents,
    paperPassingMarks,
    paperTotalMarks,
  });
  const distractorBenchmarks = buildDistractorBenchmarks({
    filteredQuestionMetas,
    contexts: responseContexts,
    cohorts,
  });
  const questionBenchmarks = buildQuestionBenchmarks({
    filteredQuestionMetas,
    contexts: responseContexts,
    cohorts,
    eligibleStudents,
    paperPassingMarks,
    paperTotalMarks,
  });

  return {
    baselineMode: "class_average",
    baseline,
    cohorts,
    tagBenchmarks,
    distractorBenchmarks,
    questionBenchmarks,
    rosterMetrics: {
      classId: toIdString(paperObj?.class),
      className: String(paperObj?.class?.name || "Unknown Class"),
      paperAssignedSectionCount: Array.isArray(paperObj?.assignedAcademicSections)
        ? paperObj.assignedAcademicSections.length
        : 0,
      eligibleStudents: Array.isArray(eligibleStudents) ? eligibleStudents.length : 0,
      respondents: responseContexts.length,
      coveragePct: baseline.coveragePct,
      academicSections: eligibleSections.map((section: any) => ({
        value: toIdString(section),
        label: section?.class?.name
          ? `${section.class.name} • ${section.name}`
          : String(section?.name || "Unknown Section"),
      })),
    },
    insights: buildInsights({
      baseline,
      cohorts,
      tagBenchmarks,
      distractorBenchmarks,
      questionBenchmarks,
      selectedAcademicSectionId: String(selectedAcademicSectionId || ""),
    }),
    questionScope: {
      totalQuestions: questionMetas.length,
      filteredQuestions: filteredQuestionMetas.length,
      possibleMarksPerResponse,
      groupBy: effectiveGroupBy,
      tagFilters: tagFilters.map((filter) => ({
        type: filter.type,
        values: filter.values,
      })),
    },
  };
}
