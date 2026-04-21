import {
  evaluateQuestionAnswer,
  normalizeMatrixSelections,
  normalizeSelectedOptions,
} from "@/lib/question-paper/grading";
import { normalizeAnalyticsTagTypeName } from "@/lib/analytics/tag-resolution";
import { sanitizeRichTextHtml } from "@/lib/security/html-sanitize";

export type SummerCrashDiagnosticAreaKind =
  | "subskill"
  | "topic"
  | "subject"
  | "section";

export type SummerCrashDiagnosticAreaSummary = {
  kind: SummerCrashDiagnosticAreaKind;
  label: string;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracyPct: number;
  weaknessPct: number;
};

export type SummerCrashQuestionStatus =
  | "correct"
  | "incorrect"
  | "unattempted";

export type SummerCrashQuestionLabels = {
  subskillLabel: string;
  topicLabel: string;
  topicKind: Extract<
    SummerCrashDiagnosticAreaKind,
    "topic" | "subject" | "section"
  >;
  weakAreaLabel: string;
  subjectLabel: string;
};

type DiagnosticTagInput = {
  name?: unknown;
  value?: unknown;
  type?: {
    name?: unknown;
  } | unknown;
  typeName?: unknown;
};

type QuestionAnswerSummary = {
  studentAnswerSummary: string;
  correctAnswerSummary: string;
};

type DiagnosticRecommendationParams = {
  weakSubskills: SummerCrashDiagnosticAreaSummary[];
  weakTopics: SummerCrashDiagnosticAreaSummary[];
  overallAccuracyPct: number;
  isUnlocked: boolean;
};

function normalizeText(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);?/g, (_match, num: string) =>
      String.fromCodePoint(Number.parseInt(num, 10)),
    )
    .replace(/&#x([0-9a-f]+);?/gi, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function stripHtmlToText(value: unknown) {
  const sanitized = sanitizeRichTextHtml(String(value || ""));
  const withBreaks = sanitized
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, " ");
  return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateText(value: unknown, maxLength = 180) {
  const normalized = stripHtmlToText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeTagTypeKey(value: unknown) {
  const normalized = normalizeAnalyticsTagTypeName(value);
  return normalized.replace(/[^a-z0-9]+/g, "");
}

function optionLabel(index: number) {
  if (!Number.isInteger(index) || index < 0) {
    return "Option";
  }

  return `Option ${String.fromCharCode(65 + (index % 26))}`;
}

function formatOptionSummary(question: any, indexes: number[]) {
  const options = Array.isArray(question?.options) ? question.options : [];
  const labels = indexes.map((index) => {
    const optionText = stripHtmlToText(options[index]?.content || "");
    return optionText || optionLabel(index);
  });

  return labels.filter(Boolean).join(", ");
}

function formatMatrixSummary(question: any, selections: number[][]) {
  const matrixOptions = Array.isArray(question?.matrixOptions)
    ? question.matrixOptions
    : [];
  const rightLabels = matrixOptions
    .map((option: any) => normalizeText(option?.right))
    .filter(Boolean);

  const parts = selections
    .map((rowSelections, rowIndex) => {
      if (!Array.isArray(rowSelections) || rowSelections.length === 0) {
        return "";
      }

      const leftLabel =
        normalizeText(matrixOptions[rowIndex]?.left) || `Row ${rowIndex + 1}`;
      const selectedLabels = rowSelections
        .map((index) => rightLabels[index] || `Column ${index + 1}`)
        .filter(Boolean)
        .join(", ");

      return selectedLabels ? `${leftLabel} -> ${selectedLabels}` : "";
    })
    .filter(Boolean);

  return parts.join(" | ");
}

export function buildSummerCrashAnswerSummary(params: {
  question: any;
  answer?: any;
}) : QuestionAnswerSummary {
  const question = params.question || {};
  const type = normalizeText(question?.type).toLowerCase();

  if (type === "single" || type === "multiple") {
    const studentIndexes = normalizeSelectedOptions(params.answer?.selectedOptions);
    const correctIndexes = normalizeSelectedOptions(question?.answerIndexes);

    return {
      studentAnswerSummary:
        studentIndexes.length > 0
          ? formatOptionSummary(question, studentIndexes)
          : "Not answered",
      correctAnswerSummary:
        correctIndexes.length > 0
          ? formatOptionSummary(question, correctIndexes)
          : "Answer key not available",
    };
  }

  if (type === "matrix-match") {
    const studentSelections = normalizeMatrixSelections(
      params.answer?.matrixSelections,
    );
    const correctSelections = normalizeMatrixSelections(question?.matrixAnswers);

    return {
      studentAnswerSummary:
        studentSelections.some((row) => row.length > 0)
          ? formatMatrixSummary(question, studentSelections)
          : "Not answered",
      correctAnswerSummary:
        correctSelections.some((row) => row.length > 0)
          ? formatMatrixSummary(question, correctSelections)
          : "Answer key not available",
    };
  }

  const answerText = normalizeText(params.answer?.answerText);
  return {
    studentAnswerSummary: answerText || "No written answer",
    correctAnswerSummary: "Teacher review needed",
  };
}

function pickTagLabel(
  tags: DiagnosticTagInput[],
  preferredTypes: string[],
) {
  const normalizedTypes = preferredTypes.map((type) => type.toLowerCase());

  for (const tag of tags) {
    const label = normalizeText(tag?.name ?? tag?.value);
    if (!label) {
      continue;
    }

    const typeName =
      normalizeTagTypeKey(tag?.typeName) ||
      normalizeTagTypeKey(
        typeof tag?.type === "object" && tag?.type !== null
          ? (tag.type as { name?: unknown }).name
          : tag?.type,
      );

    if (!typeName) {
      continue;
    }

    if (normalizedTypes.includes(typeName)) {
      return label;
    }
  }

  return "";
}

export function selectSummerCrashQuestionLabels(params: {
  question: any;
  fallbackSectionName?: string;
  fallbackSubjectName?: string;
}) : SummerCrashQuestionLabels {
  const question = params.question || {};
  const tags = (Array.isArray(question?.tags) ? question.tags : []) as DiagnosticTagInput[];
  const subjectLabel =
    normalizeText(question?.subject?.name) ||
    normalizeText(params.fallbackSubjectName);
  const sectionLabel = normalizeText(params.fallbackSectionName);

  const subskillLabel =
    pickTagLabel(tags, ["subskill", "subtopic", "skillfocus", "skill", "competency"]) ||
    "";

  const rawTopicLabel = pickTagLabel(tags, ["topic"]);
  const topicLabel = rawTopicLabel || subjectLabel || sectionLabel;
  const topicKind = rawTopicLabel
    ? "topic"
    : subjectLabel
      ? "subject"
      : "section";

  return {
    subskillLabel,
    topicLabel,
    topicKind,
    weakAreaLabel: subskillLabel || topicLabel || subjectLabel || sectionLabel,
    subjectLabel,
  };
}

function computeQuestionStatus(params: {
  spec: any;
  answer?: any;
}) : SummerCrashQuestionStatus {
  const evaluation = evaluateQuestionAnswer(params.spec, params.answer || null);
  if (!evaluation.attempted) {
    return "unattempted";
  }
  return evaluation.isCorrect ? "correct" : "incorrect";
}

function buildAreaSummaryRows(
  rows: Map<
    string,
    {
      kind: SummerCrashDiagnosticAreaKind;
      label: string;
      totalQuestions: number;
      correct: number;
      incorrect: number;
      unattempted: number;
    }
  >,
) {
  return [...rows.values()]
    .map((row) => {
      const accuracyPct =
        row.totalQuestions > 0
          ? Math.round((row.correct / row.totalQuestions) * 100)
          : 0;
      const weaknessPct = Math.max(0, 100 - accuracyPct);
      return {
        ...row,
        accuracyPct,
        weaknessPct,
      };
    })
    .sort((left, right) => {
      if (right.weaknessPct !== left.weaknessPct) {
        return right.weaknessPct - left.weaknessPct;
      }
      if (right.totalQuestions !== left.totalQuestions) {
        return right.totalQuestions - left.totalQuestions;
      }
      return left.label.localeCompare(right.label);
    });
}

export function buildSummerCrashAreaInsights(params: {
  questionResults: Array<{
    question: any;
    sectionName: string;
    fallbackSubjectName?: string;
    status: SummerCrashQuestionStatus;
  }>;
}) {
  const subskillRows = new Map<
    string,
    {
      kind: SummerCrashDiagnosticAreaKind;
      label: string;
      totalQuestions: number;
      correct: number;
      incorrect: number;
      unattempted: number;
    }
  >();
  const topicRows = new Map<
    string,
    {
      kind: SummerCrashDiagnosticAreaKind;
      label: string;
      totalQuestions: number;
      correct: number;
      incorrect: number;
      unattempted: number;
    }
  >();

  const trackRow = (
    store: typeof subskillRows,
    kind: SummerCrashDiagnosticAreaKind,
    label: string,
    status: SummerCrashQuestionStatus,
  ) => {
    const normalizedLabel = normalizeText(label);
    if (!normalizedLabel) {
      return;
    }

    const current = store.get(`${kind}:${normalizedLabel}`) || {
      kind,
      label: normalizedLabel,
      totalQuestions: 0,
      correct: 0,
      incorrect: 0,
      unattempted: 0,
    };

    current.totalQuestions += 1;
    if (status === "correct") {
      current.correct += 1;
    } else if (status === "incorrect") {
      current.incorrect += 1;
    } else {
      current.unattempted += 1;
    }

    store.set(`${kind}:${normalizedLabel}`, current);
  };

  params.questionResults.forEach((row) => {
    const labels = selectSummerCrashQuestionLabels({
      question: row.question,
      fallbackSectionName: row.sectionName,
      fallbackSubjectName: row.fallbackSubjectName,
    });

    if (labels.subskillLabel) {
      trackRow(subskillRows, "subskill", labels.subskillLabel, row.status);
    }

    trackRow(topicRows, labels.topicKind, labels.topicLabel, row.status);
  });

  const subskillInsights = buildAreaSummaryRows(subskillRows);
  const topicInsights = buildAreaSummaryRows(topicRows);
  const focusAreas = [
    ...subskillInsights.filter((row) => row.weaknessPct > 0).slice(0, 3),
    ...topicInsights.filter((row) => row.weaknessPct > 0).slice(0, 3),
  ];

  const strengths = [...subskillInsights, ...topicInsights]
    .filter((row) => row.accuracyPct >= 60)
    .sort((left, right) => {
      if (right.accuracyPct !== left.accuracyPct) {
        return right.accuracyPct - left.accuracyPct;
      }
      if (right.totalQuestions !== left.totalQuestions) {
        return right.totalQuestions - left.totalQuestions;
      }
      return left.label.localeCompare(right.label);
    })
    .slice(0, 3);

  return {
    subskillInsights,
    topicInsights,
    focusAreas,
    strengths,
  };
}

export function buildSummerCrashParentNextSteps(
  params: DiagnosticRecommendationParams,
) {
  const steps: string[] = [];
  const topSubskill = params.weakSubskills[0]?.label || "";
  const topTopic = params.weakTopics[0]?.label || "";

  if (topSubskill) {
    steps.push(
      `Spend 15 minutes revising ${topSubskill} with worked examples and ask your child to explain each step aloud.`,
    );
  }

  if (topTopic) {
    steps.push(
      `Revisit ${topTopic} in short practice sets of 4 to 6 questions over the next few days.`,
    );
  }

  if (params.overallAccuracyPct < 45) {
    steps.push(
      "Keep practice sessions short and consistent so the weak areas improve without feeling overwhelming.",
    );
  }

  if (params.isUnlocked) {
    steps.push(
      "Open the Summer Crash Course lessons and start with the areas shown above for guided support.",
    );
  } else {
    steps.push(
      "Join the Summer Crash Course to get guided lessons and practice focused on these weak areas.",
    );
  }

  return steps.filter(Boolean).slice(0, 3);
}

export function getSummerCrashQuestionStatus(params: {
  spec: any;
  answer?: any;
}) {
  return computeQuestionStatus(params);
}
