import {
  normalizeCanonicalDiagnosticTagType,
  type CanonicalDiagnosticTagType,
} from "@/lib/question-import/diagnostic-tags";

export type DiagnosticObservationStatus =
  | "correct"
  | "incorrect"
  | "unattempted";

export type DiagnosticObservationTag = {
  type?: unknown;
  value?: unknown;
};

export type TagDrivenDiagnosticQuestionObservation = {
  questionId: string;
  questionNumber: number;
  status: DiagnosticObservationStatus;
  tags: DiagnosticObservationTag[];
};

export type DiagnosticMetricSummary = {
  key:
    | "foundations-readiness"
    | "concept-clarity"
    | "method-accuracy-fluency"
    | "reasoning-application"
    | "visual-data-interpretation"
    | "improvement-potential";
  label: string;
  score: number;
  evidenceCount: number;
  note: string;
  isVisible: boolean;
  isReportable: boolean;
};

export type DiagnosticPriorityArea = {
  kind:
    | "subskill"
    | "topic"
    | "subject"
    | "section"
    | "prerequisite";
  label: string;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracyPct: number;
  weaknessPct: number;
  evidenceCount: number;
  priorityScore: number;
  isWatchPoint: boolean;
};

export type DiagnosticMisconceptionPattern = {
  label: string;
  incorrect: number;
  evidenceCount: number;
  confidence: "headline" | "watch";
};

export type DiagnosticRootCauseSummary = {
  primaryBarrier: "concept" | "method" | "application" | "pace" | "mixed";
  headline: string;
  explanation: string;
};

export type TagDrivenDiagnosticSummary = {
  metrics: DiagnosticMetricSummary[];
  strengths: DiagnosticPriorityArea[];
  focusAreas: DiagnosticPriorityArea[];
  prerequisiteFocus: DiagnosticPriorityArea[];
  misconceptionPatterns: DiagnosticMisconceptionPattern[];
  rootCauseSummary: DiagnosticRootCauseSummary;
};

type NormalizedObservation = {
  questionId: string;
  questionNumber: number;
  status: DiagnosticObservationStatus;
  tagMap: Partial<Record<CanonicalDiagnosticTagType, string>>;
};

type AreaRowSeed = {
  kind: DiagnosticPriorityArea["kind"];
  label: string;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  foundationCoreMisses: number;
  prerequisiteHits: number;
};

function normalizeText(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function hasStatusGap(status: DiagnosticObservationStatus) {
  return status === "incorrect" || status === "unattempted";
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computeAccuracyScore(observations: NormalizedObservation[]) {
  if (observations.length === 0) {
    return 0;
  }

  const correctCount = observations.filter(
    (observation) => observation.status === "correct",
  ).length;
  return clampScore((correctCount / observations.length) * 100);
}

function buildMetric(params: {
  key: DiagnosticMetricSummary["key"];
  label: DiagnosticMetricSummary["label"];
  observations: NormalizedObservation[];
  threshold: number;
  note: string;
  score: number;
}) {
  return {
    key: params.key,
    label: params.label,
    score: clampScore(params.score),
    evidenceCount: params.observations.length,
    note: params.note,
    isVisible: params.observations.length > 0,
    isReportable: params.observations.length >= params.threshold,
  } satisfies DiagnosticMetricSummary;
}

function buildTagMap(tags: DiagnosticObservationTag[]) {
  return (Array.isArray(tags) ? tags : []).reduce<
    Partial<Record<CanonicalDiagnosticTagType, string>>
  >((accumulator, tag) => {
    const type = normalizeCanonicalDiagnosticTagType(tag?.type);
    const value = normalizeText(tag?.value);
    if (!type || !value) {
      return accumulator;
    }

    accumulator[type] = value;
    return accumulator;
  }, {});
}

function normalizeObservations(
  observations: TagDrivenDiagnosticQuestionObservation[],
): NormalizedObservation[] {
  return (Array.isArray(observations) ? observations : []).map((observation) => {
    const normalizedStatus: DiagnosticObservationStatus =
      observation.status === "incorrect" || observation.status === "unattempted"
        ? observation.status
        : "correct";

    return {
      questionId: normalizeText(observation.questionId),
      questionNumber: Number(observation.questionNumber) || 0,
      status: normalizedStatus,
      tagMap: buildTagMap(observation.tags),
    };
  });
}

function trackAreaRow(
  rows: Map<string, AreaRowSeed>,
  params: {
    kind: DiagnosticPriorityArea["kind"];
    label: string;
    observation: NormalizedObservation;
  },
) {
  const normalizedLabel = normalizeText(params.label);
  if (!normalizedLabel) {
    return;
  }

  const key = `${params.kind}:${normalizedLabel.toLowerCase()}`;
  const current = rows.get(key) || {
    kind: params.kind,
    label: normalizedLabel,
    totalQuestions: 0,
    correct: 0,
    incorrect: 0,
    unattempted: 0,
    foundationCoreMisses: 0,
    prerequisiteHits: 0,
  };

  current.totalQuestions += 1;
  if (params.observation.status === "correct") {
    current.correct += 1;
  } else if (params.observation.status === "incorrect") {
    current.incorrect += 1;
  } else {
    current.unattempted += 1;
  }

  if (
    hasStatusGap(params.observation.status) &&
    params.observation.tagMap["foundation-role"] === "core"
  ) {
    current.foundationCoreMisses += 1;
  }

  if (normalizeText(params.observation.tagMap.prerequisite)) {
    current.prerequisiteHits += 1;
  }

  rows.set(key, current);
}

function buildPriorityArea(
  row: AreaRowSeed,
  kindWeight: number,
): DiagnosticPriorityArea {
  const accuracyPct =
    row.totalQuestions > 0 ? (row.correct / row.totalQuestions) * 100 : 0;
  const weaknessPct = Math.max(0, 100 - accuracyPct);
  const evidenceCount = row.totalQuestions;
  const isWatchPoint = evidenceCount < 2;
  const priorityScore =
    weaknessPct +
    evidenceCount * 12 +
    row.foundationCoreMisses * 10 +
    row.prerequisiteHits * 4 +
    kindWeight -
    (row.correct > 0 ? row.correct * 3 : 0);

  return {
    kind: row.kind,
    label: row.label,
    totalQuestions: row.totalQuestions,
    correct: row.correct,
    incorrect: row.incorrect,
    unattempted: row.unattempted,
    accuracyPct: clampScore(accuracyPct),
    weaknessPct: clampScore(weaknessPct),
    evidenceCount,
    priorityScore,
    isWatchPoint,
  };
}

function rankAreas(rows: Map<string, AreaRowSeed>) {
  const kindWeights: Record<DiagnosticPriorityArea["kind"], number> = {
    subskill: 16,
    topic: 8,
    subject: 4,
    section: 2,
    prerequisite: 10,
  };

  return [...rows.values()]
    .map((row) => buildPriorityArea(row, kindWeights[row.kind] || 0))
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }
      if (right.weaknessPct !== left.weaknessPct) {
        return right.weaknessPct - left.weaknessPct;
      }
      if (right.evidenceCount !== left.evidenceCount) {
        return right.evidenceCount - left.evidenceCount;
      }
      return left.label.localeCompare(right.label);
    });
}

function buildStrengths(
  observations: NormalizedObservation[],
  focusAreas: DiagnosticPriorityArea[],
) {
  const rows = new Map<string, AreaRowSeed>();

  observations.forEach((observation) => {
    const subskill = normalizeText(observation.tagMap.subskill);
    const topic =
      normalizeText(observation.tagMap.subtopic) ||
      normalizeText(observation.tagMap.topic);

    if (subskill) {
      trackAreaRow(rows, {
        kind: "subskill",
        label: subskill,
        observation,
      });
    } else if (topic) {
      trackAreaRow(rows, {
        kind: "topic",
        label: topic,
        observation,
      });
    }
  });

  const weakLabels = new Set(
    focusAreas.map((area) => `${area.kind}:${area.label.toLowerCase()}`),
  );

  return rankAreas(rows)
    .filter((area) => area.accuracyPct >= 60)
    .filter((area) => !weakLabels.has(`${area.kind}:${area.label.toLowerCase()}`))
    .sort((left, right) => {
      if (right.accuracyPct !== left.accuracyPct) {
        return right.accuracyPct - left.accuracyPct;
      }
      if (right.evidenceCount !== left.evidenceCount) {
        return right.evidenceCount - left.evidenceCount;
      }
      return left.label.localeCompare(right.label);
    })
    .slice(0, 3);
}

function buildPaceScore(params: {
  totalDurationSeconds: number;
  observations: NormalizedObservation[];
}) {
  const expectedDuration = params.observations.reduce((sum, observation) => {
    const timeTarget = Number(observation.tagMap["time-target-sec"]);
    return Number.isFinite(timeTarget) && timeTarget > 0 ? sum + timeTarget : sum;
  }, 0);

  if (expectedDuration <= 0 || !Number.isFinite(params.totalDurationSeconds)) {
    return 50;
  }

  const paceRatio = params.totalDurationSeconds / expectedDuration;
  if (paceRatio <= 1) {
    return 100;
  }

  return clampScore((1 / paceRatio) * 100);
}

function buildMisconceptionPatterns(
  observations: NormalizedObservation[],
): DiagnosticMisconceptionPattern[] {
  const rows = new Map<
    string,
    { label: string; incorrect: number; relatedGapCount: number }
  >();

  observations.forEach((observation) => {
    const label = normalizeText(observation.tagMap["misconception-family"]);
    if (!label || observation.status !== "incorrect") {
      return;
    }

    const current = rows.get(label.toLowerCase()) || {
      label,
      incorrect: 0,
      relatedGapCount: 0,
    };

    current.incorrect += 1;
    if (normalizeText(observation.tagMap.subskill) || normalizeText(observation.tagMap.topic)) {
      current.relatedGapCount += 1;
    }

    rows.set(label.toLowerCase(), current);
  });

  return [...rows.values()]
    .map(
      (row) =>
        ({
          label: row.label,
          incorrect: row.incorrect,
          evidenceCount: row.incorrect,
          confidence:
            row.incorrect >= 2 || row.relatedGapCount >= 2
              ? "headline"
              : "watch",
        }) satisfies DiagnosticMisconceptionPattern,
    )
    .filter((row) => row.confidence === "headline")
    .sort((left, right) => {
      if (right.evidenceCount !== left.evidenceCount) {
        return right.evidenceCount - left.evidenceCount;
      }
      return left.label.localeCompare(right.label);
    })
    .slice(0, 3);
}

function buildRootCauseSummary(params: {
  conceptScore: number;
  methodScore: number;
  reasoningScore: number;
  paceScore: number;
}) {
  if (
    params.conceptScore <= 45 &&
    (params.conceptScore <= params.methodScore || params.methodScore === 0)
  ) {
    return {
      primaryBarrier: "concept",
      headline: "The main barrier right now is concept understanding.",
      explanation:
        "The weaker questions mostly point to understanding the idea itself, so meaning should be rebuilt before speed drills.",
    } satisfies DiagnosticRootCauseSummary;
  }

  if (params.methodScore > 0 && params.methodScore <= 45) {
    return {
      primaryBarrier: "method",
      headline: "The main barrier right now is method accuracy.",
      explanation:
        "Your child seems to need more support carrying out the steps accurately and consistently once the method is known.",
    } satisfies DiagnosticRootCauseSummary;
  }

  if (params.reasoningScore > 0 && params.reasoningScore <= 45) {
    return {
      primaryBarrier: "application",
      headline: "The main barrier right now is applying ideas in unfamiliar questions.",
      explanation:
        "The score drops more on reasoning and setup questions, so guided practice should focus on translating the problem before solving it.",
    } satisfies DiagnosticRootCauseSummary;
  }

  if (params.paceScore <= 45) {
    return {
      primaryBarrier: "pace",
      headline: "The main barrier right now is pace.",
      explanation:
        "The overall timing suggests the work is taking longer than expected, so shorter timed practice can help after the weak concepts are clearer.",
    } satisfies DiagnosticRootCauseSummary;
  }

  return {
    primaryBarrier: "mixed",
    headline: "There is a mixed pattern of gaps across the attempt.",
    explanation:
      "The report suggests more than one kind of support is needed, so it is best to start with the weakest foundation area and build from there.",
  } satisfies DiagnosticRootCauseSummary;
}

export function buildTagDrivenDiagnosticSummary(params: {
  totalDurationSeconds?: number;
  questions: TagDrivenDiagnosticQuestionObservation[];
}): TagDrivenDiagnosticSummary {
  const observations = normalizeObservations(params.questions);
  const totalDurationSeconds = Number(params.totalDurationSeconds) || 0;

  const foundationsObservations = observations.filter(
    (observation) => observation.tagMap["foundation-role"] === "core",
  );
  const conceptObservations = observations.filter((observation) => {
    const load = normalizeText(observation.tagMap["conceptual-procedural-load"]).toLowerCase();
    return (
      load === "concept-heavy" ||
      load === "conceptheavy" ||
      load === "c-heavy" ||
      load === "conceptual-heavy"
    );
  });
  const procedureObservations = observations.filter((observation) => {
    const load = normalizeText(observation.tagMap["conceptual-procedural-load"]).toLowerCase();
    return (
      load === "procedure-heavy" ||
      load === "procedural-heavy" ||
      load === "p-heavy" ||
      load === "procedural"
    );
  });
  const reasoningObservations = observations.filter((observation) => {
    const competency = normalizeText(observation.tagMap.competency).toLowerCase();
    const process = normalizeText(observation.tagMap.process).toLowerCase();
    return (
      competency === "reasoning" ||
      competency === "problem-solving" ||
      competency === "problemsolving" ||
      process === "formulate" ||
      process === "interpret"
    );
  });
  const visualObservations = observations.filter((observation) => {
    const representation = normalizeText(
      observation.tagMap["representation-mode"],
    ).toLowerCase();
    return (
      representation === "diagram" ||
      representation === "graph" ||
      representation === "table" ||
      representation === "number-line" ||
      representation === "numberline" ||
      representation === "mixed"
    );
  });

  const foundationsScore = computeAccuracyScore(foundationsObservations);
  const conceptScore = computeAccuracyScore(conceptObservations);
  const procedureAccuracyScore = computeAccuracyScore(procedureObservations);
  const reasoningScore = computeAccuracyScore(reasoningObservations);
  const visualScore = computeAccuracyScore(visualObservations);
  const paceScore = buildPaceScore({
    totalDurationSeconds,
    observations,
  });
  const methodScore =
    procedureObservations.length > 0
      ? clampScore((procedureAccuracyScore + paceScore) / 2)
      : paceScore;

  const focusRows = new Map<string, AreaRowSeed>();
  const prerequisiteRows = new Map<string, AreaRowSeed>();
  observations.forEach((observation) => {
    const subskill = normalizeText(observation.tagMap.subskill);
    const topic =
      normalizeText(observation.tagMap.subtopic) ||
      normalizeText(observation.tagMap.topic);
    const prerequisite = normalizeText(observation.tagMap.prerequisite);

    if (subskill) {
      trackAreaRow(focusRows, {
        kind: "subskill",
        label: subskill,
        observation,
      });
    } else if (topic) {
      trackAreaRow(focusRows, {
        kind: "topic",
        label: topic,
        observation,
      });
    }

    if (topic) {
      trackAreaRow(focusRows, {
        kind: "topic",
        label: topic,
        observation,
      });
    }

    if (prerequisite) {
      trackAreaRow(prerequisiteRows, {
        kind: "prerequisite",
        label: prerequisite,
        observation,
      });
    }
  });

  const focusAreas = rankAreas(focusRows)
    .filter((area) => area.weaknessPct > 0)
    .slice(0, 5);
  const prerequisiteFocus = rankAreas(prerequisiteRows)
    .filter((area) => area.weaknessPct > 0)
    .filter((area) => area.evidenceCount >= 2 || area.isWatchPoint)
    .slice(0, 3);

  const totalQuestions = observations.length;
  const attemptedQuestions = observations.filter(
    (observation) => observation.status !== "unattempted",
  );
  const easyObservations = observations.filter((observation) => {
    const difficulty = normalizeText(observation.tagMap.difficulty).toLowerCase();
    return difficulty === "easy" || difficulty === "low";
  });
  const totalGapCount = observations.filter((observation) =>
    hasStatusGap(observation.status),
  ).length;
  const topGapCoverage =
    totalGapCount > 0
      ? focusAreas
          .slice(0, 2)
          .reduce(
            (sum, area) => sum + area.incorrect + area.unattempted,
            0,
          ) / totalGapCount
      : 1;
  const improvementPotentialScore =
    (attemptedQuestions.length / Math.max(totalQuestions, 1)) * 25 +
    (computeAccuracyScore(easyObservations) / 100) * 25 +
    topGapCoverage * 30 +
    (paceScore / 100) * 20;

  const metrics: DiagnosticMetricSummary[] = [
    buildMetric({
      key: "foundations-readiness",
      label: "Foundations Readiness",
      observations: foundationsObservations,
      threshold: 3,
      note: "How secure the core foundations look from the tagged questions.",
      score: foundationsScore,
    }),
    buildMetric({
      key: "concept-clarity",
      label: "Concept Clarity",
      observations: conceptObservations,
      threshold: 3,
      note: "Whether the child seems to understand the idea, not just the steps.",
      score: conceptScore,
    }),
    buildMetric({
      key: "method-accuracy-fluency",
      label: "Method Accuracy & Fluency",
      observations:
        procedureObservations.length > 0 ? procedureObservations : observations,
      threshold: 3,
      note: "Method accuracy blended with a simple pace check against expected time.",
      score: methodScore,
    }),
    buildMetric({
      key: "reasoning-application",
      label: "Reasoning & Application",
      observations: reasoningObservations,
      threshold: 3,
      note: "How the child handles setup, reasoning, and less direct questions.",
      score: reasoningScore,
    }),
    buildMetric({
      key: "visual-data-interpretation",
      label: "Visual & Data Interpretation",
      observations: visualObservations,
      threshold: 2,
      note: "Comfort with graphs, tables, number lines, and other visual formats.",
      score: visualScore,
    }),
    buildMetric({
      key: "improvement-potential",
      label: "Improvement Potential",
      observations,
      threshold: 4,
      note: "A simple estimate based on attempt rate, easy-item accuracy, error concentration, and pace.",
      score: improvementPotentialScore,
    }),
  ];

  return {
    metrics,
    strengths: buildStrengths(observations, focusAreas),
    focusAreas,
    prerequisiteFocus,
    misconceptionPatterns: buildMisconceptionPatterns(observations),
    rootCauseSummary: buildRootCauseSummary({
      conceptScore,
      methodScore,
      reasoningScore,
      paceScore,
    }),
  };
}
