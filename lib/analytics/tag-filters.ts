import { normalizeAnalyticsTagTypeName } from "@/lib/analytics/tag-resolution";

export type AnalyticsTagFilter = {
  type: string;
  values: string[];
};

function normalizeTagValue(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function parseAnalyticsTagFilters(values: string[]) {
  const grouped = new Map<string, Set<string>>();

  (Array.isArray(values) ? values : []).forEach((value) => {
    const raw = String(value || "").trim();
    if (!raw) return;

    const separatorIndex = raw.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex === raw.length - 1) return;

    const type = normalizeAnalyticsTagTypeName(raw.slice(0, separatorIndex));
    const tagValue = normalizeTagValue(raw.slice(separatorIndex + 1));

    if (!type || !tagValue) return;
    if (!grouped.has(type)) grouped.set(type, new Set<string>());
    grouped.get(type)?.add(tagValue);
  });

  return Array.from(grouped.entries()).map(([type, groupValues]) => ({
    type,
    values: Array.from(groupValues.values()).sort(),
  }));
}

export function buildAnalyticsTagValuesByType(
  tags: Array<{ type?: unknown; value?: unknown }>,
) {
  return (Array.isArray(tags) ? tags : []).reduce<Record<string, string[]>>(
    (accumulator, tag) => {
      const key = normalizeAnalyticsTagTypeName(tag?.type);
      const value = String(tag?.value || "").trim();

      if (!key || !value) {
        return accumulator;
      }

      if (!Array.isArray(accumulator[key])) {
        accumulator[key] = [];
      }

      if (!accumulator[key].includes(value)) {
        accumulator[key].push(value);
        accumulator[key].sort((left, right) => left.localeCompare(right));
      }

      return accumulator;
    },
    {},
  );
}

export function analyticsTagValuesMatchFilters(
  tagsByType: Record<string, string[]>,
  tagFilters: AnalyticsTagFilter[],
) {
  if (!Array.isArray(tagFilters) || tagFilters.length === 0) {
    return true;
  }

  return tagFilters.every((filter) => {
    const filterType = normalizeAnalyticsTagTypeName(filter.type);
    const candidateValues = Array.isArray(tagsByType?.[filterType])
      ? tagsByType[filterType]
      : [];

    if (candidateValues.length === 0) {
      return false;
    }

    const normalizedCandidates = candidateValues.map((value) =>
      normalizeTagValue(value),
    );

    return (Array.isArray(filter.values) ? filter.values : []).some((value) =>
      normalizedCandidates.includes(normalizeTagValue(value)),
    );
  });
}
