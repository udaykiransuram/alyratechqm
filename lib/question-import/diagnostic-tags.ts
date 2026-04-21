import type {
  QuestionImportQuestionMetadata,
  QuestionImportTagPair,
} from "@/lib/question-import/types";

export type CanonicalDiagnosticTagType =
  | "difficulty"
  | "topic"
  | "subtopic"
  | "subskill"
  | "competency"
  | "process"
  | "prerequisite"
  | "representation-mode"
  | "conceptual-procedural-load"
  | "calculation-load"
  | "foundation-role"
  | "time-target-sec"
  | "misconception-family"
  | "option-a-misconception"
  | "option-b-misconception"
  | "option-c-misconception"
  | "option-d-misconception"
  | "option-e-misconception"
  | "context"
  | "multi-step-depth"
  | "precision-units-demand"
  | "structure-generalisation"
  | "estimation-sense-check"
  | "templateid";

type DiagnosticTagConfig = {
  type: CanonicalDiagnosticTagType;
  label: string;
  aliases?: string[];
  metadataField?: "difficulty" | "topic" | "templateId";
};

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeTagKey(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[_\s/]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const DIAGNOSTIC_TAG_CONFIGS: DiagnosticTagConfig[] = [
  {
    type: "difficulty",
    label: "Difficulty",
    metadataField: "difficulty",
    aliases: ["difficulty-level", "level-of-difficulty"],
  },
  {
    type: "topic",
    label: "Topic",
    metadataField: "topic",
    aliases: ["chapter", "chapter-name", "chapter-title"],
  },
  {
    type: "subtopic",
    label: "Subtopic",
    aliases: ["sub-topic", "sub-topic-title", "subtopic-title"],
  },
  {
    type: "subskill",
    label: "Subskill",
    aliases: [
      "skill",
      "skill-focus",
      "skill-focus-area",
      "skillfocus",
      "sub-skill",
    ],
  },
  { type: "competency", label: "Competency" },
  { type: "process", label: "Process" },
  {
    type: "prerequisite",
    label: "Prerequisite",
    aliases: ["dependency", "prerequisite-dependency"],
  },
  {
    type: "representation-mode",
    label: "Representation Mode",
    aliases: ["representation", "representationmode"],
  },
  {
    type: "conceptual-procedural-load",
    label: "Conceptual-Procedural Load",
    aliases: [
      "conceptual-procedural",
      "conceptual-procedural-balance",
      "conceptualproceduralload",
    ],
  },
  {
    type: "calculation-load",
    label: "Calculation Load",
    aliases: ["calculationload"],
  },
  {
    type: "foundation-role",
    label: "Foundation Role",
    aliases: ["foundation", "foundationrole"],
  },
  {
    type: "time-target-sec",
    label: "Time Target Sec",
    aliases: [
      "time-target",
      "time-target-seconds",
      "time-target-secs",
      "time-target-secconds",
      "timetargetsec",
      "expected-time-sec",
    ],
  },
  {
    type: "misconception-family",
    label: "Misconception Family",
    aliases: ["misconception", "misconceptionfamily"],
  },
  { type: "option-a-misconception", label: "Option A Misconception" },
  { type: "option-b-misconception", label: "Option B Misconception" },
  { type: "option-c-misconception", label: "Option C Misconception" },
  { type: "option-d-misconception", label: "Option D Misconception" },
  { type: "option-e-misconception", label: "Option E Misconception" },
  { type: "context", label: "Context" },
  {
    type: "multi-step-depth",
    label: "Multi-Step Depth",
    aliases: ["multistepdepth"],
  },
  {
    type: "precision-units-demand",
    label: "Precision Units Demand",
    aliases: [
      "precision-units",
      "precision-and-units-demand",
      "precisionunitsdemand",
    ],
  },
  {
    type: "structure-generalisation",
    label: "Structure Generalisation",
    aliases: [
      "structure-generalization",
      "structure",
      "structuregeneralisation",
      "structuregeneralization",
    ],
  },
  {
    type: "estimation-sense-check",
    label: "Estimation Sense Check",
    aliases: [
      "estimation",
      "sense-check",
      "sensecheck",
      "estimationsensecheck",
    ],
  },
  {
    type: "templateid",
    label: "Template ID",
    metadataField: "templateId",
    aliases: ["template-id"],
  },
];

const DIAGNOSTIC_TAG_CONFIG_BY_TYPE = new Map<
  CanonicalDiagnosticTagType,
  DiagnosticTagConfig
>(DIAGNOSTIC_TAG_CONFIGS.map((config) => [config.type, config]));

const DIAGNOSTIC_TAG_ALIAS_MAP = new Map<string, CanonicalDiagnosticTagType>();
DIAGNOSTIC_TAG_CONFIGS.forEach((config) => {
  DIAGNOSTIC_TAG_ALIAS_MAP.set(config.type, config.type);
  (Array.isArray(config.aliases) ? config.aliases : []).forEach((alias) => {
    DIAGNOSTIC_TAG_ALIAS_MAP.set(normalizeTagKey(alias), config.type);
  });
});

export const QUESTION_IMPORT_DIAGNOSTIC_TAGS = DIAGNOSTIC_TAG_CONFIGS;

export const QUESTION_IMPORT_REVIEW_DIAGNOSTIC_TAGS = DIAGNOSTIC_TAG_CONFIGS.filter(
  (config) =>
    config.type !== "difficulty" &&
    config.type !== "topic" &&
    config.type !== "templateid",
);

export function normalizeQuestionImportDiagnosticTagType(value: unknown) {
  const normalizedKey = normalizeTagKey(value);
  if (!normalizedKey) {
    return "";
  }

  return DIAGNOSTIC_TAG_ALIAS_MAP.get(normalizedKey) || "";
}

export function normalizeCanonicalDiagnosticTagType(value: unknown) {
  return normalizeQuestionImportDiagnosticTagType(value);
}

export function getQuestionImportDiagnosticTagConfig(
  value: unknown,
): DiagnosticTagConfig | null {
  const normalizedType = normalizeQuestionImportDiagnosticTagType(value);
  if (!normalizedType) {
    return null;
  }

  return DIAGNOSTIC_TAG_CONFIG_BY_TYPE.get(normalizedType) || null;
}

export function getQuestionImportDiagnosticTagLabel(value: unknown) {
  return getQuestionImportDiagnosticTagConfig(value)?.label || normalizeText(value);
}

function isNonEmptyTagPair(pair: Partial<QuestionImportTagPair> | null | undefined) {
  return Boolean(normalizeText(pair?.type) && normalizeText(pair?.value));
}

function pruneCanonicalCustomTags(
  metadata: QuestionImportQuestionMetadata,
  canonicalType: CanonicalDiagnosticTagType,
) {
  metadata.customTags = (Array.isArray(metadata.customTags) ? metadata.customTags : [])
    .filter((tag) => {
      const normalizedType = normalizeQuestionImportDiagnosticTagType(tag?.type);
      return normalizedType !== canonicalType;
    })
    .filter(isNonEmptyTagPair) as QuestionImportTagPair[];
}

function setExplicitMetadataField(
  metadata: QuestionImportQuestionMetadata,
  field: DiagnosticTagConfig["metadataField"],
  value: string,
) {
  if (!field) {
    return false;
  }

  if (field === "difficulty") {
    metadata.difficulty = value || undefined;
    return true;
  }
  if (field === "topic") {
    metadata.topic = value || undefined;
    return true;
  }
  if (field === "templateId") {
    metadata.templateId = value || undefined;
    return true;
  }
  return false;
}

export function createEmptyQuestionImportMetadata(): QuestionImportQuestionMetadata {
  return {
    customTags: [],
  };
}

export function buildQuestionImportMetadataTagMap(
  metadata: QuestionImportQuestionMetadata | null | undefined,
): Partial<Record<CanonicalDiagnosticTagType, string>> {
  const tagMap: Partial<Record<CanonicalDiagnosticTagType, string>> = {};

  if (!metadata) {
    return tagMap;
  }

  if (normalizeText(metadata.difficulty)) {
    tagMap.difficulty = normalizeText(metadata.difficulty);
  }
  if (normalizeText(metadata.topic)) {
    tagMap.topic = normalizeText(metadata.topic);
  }
  if (normalizeText(metadata.templateId)) {
    tagMap.templateid = normalizeText(metadata.templateId);
  }

  (Array.isArray(metadata.customTags) ? metadata.customTags : []).forEach((tag) => {
    const normalizedType = normalizeQuestionImportDiagnosticTagType(tag?.type);
    const normalizedValue = normalizeText(tag?.value);
    if (!normalizedType || !normalizedValue) {
      return;
    }

    tagMap[normalizedType] = normalizedValue;
  });

  return tagMap;
}

export function getQuestionImportMetadataTagValue(
  metadata: QuestionImportQuestionMetadata | null | undefined,
  value: unknown,
) {
  const normalizedType = normalizeQuestionImportDiagnosticTagType(value);
  if (!normalizedType) {
    return "";
  }

  return buildQuestionImportMetadataTagMap(metadata)[normalizedType] || "";
}

export function getQuestionImportMetadataOtherTags(
  metadata: QuestionImportQuestionMetadata | null | undefined,
) {
  return (Array.isArray(metadata?.customTags) ? metadata?.customTags : [])
    .filter(isNonEmptyTagPair)
    .filter(
      (tag) => !normalizeQuestionImportDiagnosticTagType(tag.type),
    ) as QuestionImportTagPair[];
}

export function buildQuestionImportMetadataTagPairs(
  metadata: QuestionImportQuestionMetadata | null | undefined,
) {
  const canonicalTagMap = buildQuestionImportMetadataTagMap(metadata);
  const canonicalPairs: QuestionImportTagPair[] = QUESTION_IMPORT_DIAGNOSTIC_TAGS.flatMap((config) => {
    const value = canonicalTagMap[config.type];
    return value
      ? [
          {
            type: config.type,
            value,
          },
        ]
      : [];
  });

  return [...canonicalPairs, ...getQuestionImportMetadataOtherTags(metadata)];
}

export function setQuestionImportMetadataTagValue(
  metadata: QuestionImportQuestionMetadata,
  rawType: unknown,
  rawValue: unknown,
) {
  const normalizedValue = normalizeText(rawValue);
  const canonicalType = normalizeQuestionImportDiagnosticTagType(rawType);
  const normalizedRawType = normalizeText(rawType);

  if (!Array.isArray(metadata.customTags)) {
    metadata.customTags = [];
  }

  if (!canonicalType) {
    metadata.customTags = metadata.customTags.filter(
      (tag) =>
        normalizeTagKey(tag.type) !== normalizeTagKey(normalizedRawType) &&
        isNonEmptyTagPair(tag),
    );

    if (normalizedRawType && normalizedValue) {
      metadata.customTags.push({
        type: normalizedRawType,
        value: normalizedValue,
      });
    }
    return;
  }

  const config = DIAGNOSTIC_TAG_CONFIG_BY_TYPE.get(canonicalType);
  pruneCanonicalCustomTags(metadata, canonicalType);
  if (config?.metadataField) {
    setExplicitMetadataField(metadata, config.metadataField, normalizedValue);
    return;
  }

  if (!normalizedValue) {
    return;
  }

  metadata.customTags.push({
    type: canonicalType,
    value: normalizedValue,
  });
}

export function removeQuestionImportMetadataTagValue(
  metadata: QuestionImportQuestionMetadata,
  rawType: unknown,
) {
  setQuestionImportMetadataTagValue(metadata, rawType, "");
}

export function appendQuestionImportMetadataTagPair(
  metadata: QuestionImportQuestionMetadata,
  pair: Partial<QuestionImportTagPair> | null | undefined,
) {
  if (!isNonEmptyTagPair(pair)) {
    return;
  }

  setQuestionImportMetadataTagValue(
    metadata,
    normalizeText(pair?.type),
    normalizeText(pair?.value),
  );
}

export function appendQuestionImportMetadataTagPairs(
  metadata: QuestionImportQuestionMetadata,
  pairs: Array<Partial<QuestionImportTagPair> | null | undefined>,
) {
  (Array.isArray(pairs) ? pairs : []).forEach((pair) =>
    appendQuestionImportMetadataTagPair(metadata, pair),
  );
}
