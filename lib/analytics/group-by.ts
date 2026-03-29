type AnalyticsGroupField = {
  value: string;
  label: string;
};

function dedupeValues(values: string[]) {
  return values.filter(
    (value, index, allValues) => value && allValues.indexOf(value) === index,
  );
}

export function resolveDefaultAnalyticsGroupBy(
  fields: AnalyticsGroupField[],
) {
  if (fields.some((field) => field.value === "section")) {
    const sectionIndex = fields.findIndex((field) => field.value === "section");
    return [
      fields[sectionIndex]?.value,
      fields[sectionIndex + 1]?.value,
      fields[sectionIndex + 2]?.value,
    ].filter(Boolean) as string[];
  }

  return fields.slice(0, 3).map((field) => field.value).filter(Boolean);
}

export function reconcileAnalyticsGroupBy(
  current: string[],
  fields: AnalyticsGroupField[],
  options?: {
    requiredFieldValues?: string[];
  },
) {
  const allowedValues = new Set(
    fields.map((field) => String(field.value || "").trim()).filter(Boolean),
  );
  const preserved = (Array.isArray(current) ? current : []).filter((value) =>
    allowedValues.has(value),
  );
  const fallback = resolveDefaultAnalyticsGroupBy(fields);
  const extras = fields
    .map((field) => field.value)
    .filter((value) => value && !preserved.includes(value));
  const targetLength =
    preserved.length > 0
      ? Math.min(
          Math.max(Array.isArray(current) ? current.length : 0, preserved.length),
          fields.length,
        )
      : fallback.length;

  let nextGroupBy = dedupeValues([...preserved, ...fallback, ...extras]).slice(
    0,
    targetLength,
  );

  if (nextGroupBy.length === 0) {
    nextGroupBy = fallback;
  }

  const requiredFieldValues = dedupeValues(
    Array.isArray(options?.requiredFieldValues)
      ? options.requiredFieldValues.filter((value) => allowedValues.has(value))
      : [],
  );

  if (requiredFieldValues.length === 0) {
    return nextGroupBy;
  }

  const desiredLength = Math.max(
    1,
    Math.min(nextGroupBy.length || fallback.length || fields.length, fields.length),
  );

  requiredFieldValues.forEach((requiredFieldValue) => {
    if (nextGroupBy.includes(requiredFieldValue)) {
      return;
    }

    const insertionIndex =
      nextGroupBy.includes("section") && requiredFieldValue !== "section"
        ? 1
        : 0;
    const reordered = nextGroupBy.filter(
      (value) => value !== requiredFieldValue,
    );

    reordered.splice(Math.min(insertionIndex, reordered.length), 0, requiredFieldValue);
    nextGroupBy = dedupeValues(reordered).slice(0, desiredLength);

    if (!nextGroupBy.includes(requiredFieldValue)) {
      nextGroupBy = dedupeValues([requiredFieldValue, ...nextGroupBy]).slice(
        0,
        desiredLength,
      );
    }
  });

  return nextGroupBy;
}
