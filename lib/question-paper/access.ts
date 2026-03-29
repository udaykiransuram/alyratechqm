function normalizeId(value: unknown) {
  if (!value) return "";

  if (typeof value === "object" && value !== null) {
    if ("_id" in (value as Record<string, unknown>)) {
      return String((value as Record<string, unknown>)._id || "").trim();
    }
  }

  return String(value || "").trim();
}

function toUniqueIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return Array.from(
    new Set(value.map((item) => normalizeId(item)).filter(Boolean)),
  );
}

export function normalizeScopeId(value: unknown) {
  return normalizeId(value);
}

export function toUniqueScopeIds(value: unknown) {
  return toUniqueIds(value);
}

export function resolveScopedPaperAccess(
  user: any,
  paperClassId: string,
  paperSubjectIds: string[],
) {
  const normalizedPaperClassId = String(paperClassId || "").trim();
  const normalizedPaperSubjectIds = Array.from(
    new Set(
      (Array.isArray(paperSubjectIds) ? paperSubjectIds : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );

  const hasClassAccess =
    !normalizedPaperClassId ||
    Boolean(user?.hasAllClasses) ||
    toUniqueIds(user?.classIds).includes(normalizedPaperClassId);

  const subjectScopeIds = toUniqueIds(user?.subjectIds);
  const allowedSubjectIds = Boolean(user?.hasAllSubjects)
    ? normalizedPaperSubjectIds
    : normalizedPaperSubjectIds.filter((subjectId) =>
        subjectScopeIds.includes(subjectId),
      );

  const hasSubjectAccess =
    normalizedPaperSubjectIds.length === 0 ||
    Boolean(user?.hasAllSubjects) ||
    allowedSubjectIds.length > 0;

  return {
    hasClassAccess,
    hasSubjectAccess,
    allowedSubjectIds,
    requiresSubjectIntersection:
      normalizedPaperSubjectIds.length > 0 && !Boolean(user?.hasAllSubjects),
  };
}

export function resolveTeacherPaperScope(
  user: any,
  paperClassId: string,
  paperSubjectIds: string[],
  paperAssignedSectionIds: string[] = [],
) {
  const baseScope = resolveScopedPaperAccess(user, paperClassId, paperSubjectIds);
  const normalizedPaperSectionIds = Array.from(
    new Set(
      (Array.isArray(paperAssignedSectionIds) ? paperAssignedSectionIds : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
  const scopedSectionIds = toUniqueIds(user?.academicSectionIds);
  const hasAllSections = Boolean(user?.hasAllSections);

  let allowedSectionIds: string[] | null = null;
  if (hasAllSections) {
    allowedSectionIds =
      normalizedPaperSectionIds.length > 0 ? normalizedPaperSectionIds : null;
  } else if (normalizedPaperSectionIds.length > 0) {
    allowedSectionIds = normalizedPaperSectionIds.filter((sectionId) =>
      scopedSectionIds.includes(sectionId),
    );
  } else {
    allowedSectionIds = scopedSectionIds;
  }

  return {
    ...baseScope,
    hasAllSections,
    allowedSectionIds,
    hasSectionAccess:
      allowedSectionIds === null ? true : allowedSectionIds.length > 0,
    requiresSectionIntersection: !hasAllSections,
  };
}

export function isSectionInScope(
  sectionId: unknown,
  allowedSectionIds: string[] | null,
) {
  const normalizedSectionId = normalizeId(sectionId);
  if (!normalizedSectionId) {
    return false;
  }

  if (allowedSectionIds === null) {
    return true;
  }

  return allowedSectionIds.includes(normalizedSectionId);
}

export function filterItemsByScopedSection<T>(
  items: T[],
  getSectionId: (item: T) => unknown,
  allowedSectionIds: string[] | null,
) {
  if (allowedSectionIds === null) {
    return Array.isArray(items) ? items : [];
  }

  return (Array.isArray(items) ? items : []).filter((item) =>
    isSectionInScope(getSectionId(item), allowedSectionIds),
  );
}
