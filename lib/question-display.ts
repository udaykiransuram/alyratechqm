export type QuestionDisplayType =
  | "single"
  | "multiple"
  | "matrix-match"
  | "descriptive"
  | (string & {});

export type QuestionDisplayTag = {
  _id?: string | number | null;
  name?: string | null;
  type?: {
    name?: string | null;
  } | null;
};

const TAG_TYPE_LABEL_OVERRIDES: Record<string, string> = {
  templateid: "Template ID",
  difficultylevel: "Difficulty",
};

function toDisplayText(value: unknown) {
  return String(value || "").trim();
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeLabelKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function formatLabelPart(part: string) {
  const normalizedPart = part.toLowerCase();

  if (normalizedPart === "id") {
    return "ID";
  }

  return normalizedPart.charAt(0).toUpperCase() + normalizedPart.slice(1);
}

export function getQuestionTypeLabel(type: QuestionDisplayType | undefined) {
  switch (type) {
    case "single":
      return "Single choice";
    case "multiple":
      return "Multiple choice";
    case "matrix-match":
      return "Matrix match";
    case "descriptive":
      return "Descriptive";
    default: {
      const normalized = toDisplayText(type).replace(/[-_]+/g, " ");
      return normalized ? toTitleCase(normalized) : "Unknown type";
    }
  }
}

export function formatQuestionTagTypeLabel(type: unknown, fallback = "Other") {
  const rawType = toDisplayText(type);

  if (!rawType) {
    return fallback;
  }

  const override = TAG_TYPE_LABEL_OVERRIDES[normalizeLabelKey(rawType)];
  if (override) {
    return override;
  }

  return rawType
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => formatLabelPart(part))
    .join(" ");
}

export function formatQuestionTagLabel(
  tag: QuestionDisplayTag | null | undefined,
  options?: {
    showType?: boolean;
  },
) {
  const tagName = toDisplayText(tag?.name);
  const typeName = toDisplayText(tag?.type?.name);
  const showType = options?.showType !== false;
  const formattedTypeName = formatQuestionTagTypeLabel(typeName, "");

  if (showType && formattedTypeName && tagName) {
    return `${formattedTypeName}: ${tagName}`;
  }

  return tagName || formattedTypeName || "-";
}
