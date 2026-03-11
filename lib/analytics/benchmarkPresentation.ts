export type BenchmarkDistractorSortBy =
  | "peak_selected"
  | "peak_gap"
  | "sections_affected";

export type BenchmarkQuestionRankingMode =
  | "class_difficulty"
  | "section_gap";

export type BenchmarkViewSettings = {
  minDistractorPct: number;
  minDistractorCount: number;
  distractorSortBy: BenchmarkDistractorSortBy;
};

export const DEFAULT_BENCHMARK_VIEW_SETTINGS: BenchmarkViewSettings = {
  minDistractorPct: 10,
  minDistractorCount: 1,
  distractorSortBy: "peak_selected",
};

const TIE_EPSILON = 0.001;

function toNumeric(value: any) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toPlainText(value: any, fallback = "—") {
  const text = String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

function toPercentText(value: any) {
  return `${toNumeric(value).toFixed(2)}%`;
}

function toSignedPointsText(value: any) {
  const numeric = toNumeric(value);
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${numeric.toFixed(2)} pts`;
}

function toCoverageText(metrics: any) {
  return `${metrics?.respondents || 0} / ${metrics?.eligibleStudents || 0}`;
}

function sortSectionsByName<T>(rows: T[]) {
  return [...(Array.isArray(rows) ? rows : [])].sort((left: any, right: any) =>
    String(left?.academicSectionName || left?.name || "").localeCompare(
      String(right?.academicSectionName || right?.name || ""),
    ),
  );
}

function getRowsAtExtreme<T>(
  rows: T[],
  selector: (row: T) => number,
  mode: "min" | "max",
) {
  const normalizedRows = sortSectionsByName(rows).filter(Boolean);
  if (normalizedRows.length === 0) return [];

  const numericValues = normalizedRows.map((row) => selector(row));
  const extremeValue =
    mode === "min"
      ? Math.min(...numericValues)
      : Math.max(...numericValues);

  return normalizedRows.filter(
    (row) => Math.abs(selector(row) - extremeValue) <= TIE_EPSILON,
  );
}

export function normalizeBenchmarkViewSettings(
  value?: Partial<BenchmarkViewSettings> | null,
): BenchmarkViewSettings {
  const sortBy = value?.distractorSortBy;
  return {
    minDistractorPct: Math.max(0, toNumeric(value?.minDistractorPct)),
    minDistractorCount: Math.max(1, Math.floor(toNumeric(value?.minDistractorCount) || 1)),
    distractorSortBy:
      sortBy === "peak_gap" ||
      sortBy === "sections_affected" ||
      sortBy === "peak_selected"
        ? sortBy
        : DEFAULT_BENCHMARK_VIEW_SETTINGS.distractorSortBy,
  };
}

export function getBenchmarkCohorts(benchmarkData: any) {
  return Array.isArray(benchmarkData?.cohorts) ? benchmarkData.cohorts : [];
}

export function getFocusBenchmarkCohort(
  benchmarkData: any,
  selectedAcademicSectionId: string,
) {
  if (!selectedAcademicSectionId || selectedAcademicSectionId === "all") {
    return null;
  }

  return (
    getBenchmarkCohorts(benchmarkData).find(
      (cohort: any) =>
        String(cohort?.academicSectionId || "") ===
        String(selectedAcademicSectionId || ""),
    ) || null
  );
}

export function getSortedBenchmarkCohorts(benchmarkData: any) {
  return [...getBenchmarkCohorts(benchmarkData)].sort(
    (left: any, right: any) =>
      toNumeric(left?.gap?.accuracyPct) - toNumeric(right?.gap?.accuracyPct),
  );
}

export function getBenchmarkQuestionRankingMode(
  selectedAcademicSectionId: string,
): BenchmarkQuestionRankingMode {
  return !selectedAcademicSectionId || selectedAcademicSectionId === "all"
    ? "class_difficulty"
    : "section_gap";
}

export function getWorstGapSections(cohortRows: any[]) {
  return getRowsAtExtreme(
    cohortRows,
    (cohort: any) => toNumeric(cohort?.gap?.accuracyPct),
    "min",
  );
}

export function getWorstDistractorGapSections(cohortRows: any[]) {
  return getRowsAtExtreme(
    cohortRows,
    (cohort: any) => toNumeric(cohort?.gapSelectedPct),
    "max",
  );
}

export function formatBenchmarkDistractorTieBreakdown(
  sections: any[],
  options?: { separator?: string },
) {
  const separator = options?.separator ?? " • ";
  const rows = sortSectionsByName(sections);
  if (rows.length === 0) return "—";

  return rows
    .map(
      (section: any) =>
        `${String(section?.academicSectionName || section?.name || "Unknown Section")}: ${toPercentText(section?.metrics?.selectedPct)} selected, ${toSignedPointsText(section?.gapSelectedPct)} gap, ${toNumeric(section?.metrics?.selectedCount)} selected, ${toNumeric(section?.metrics?.respondents)} respondents`,
    )
    .join(separator);
}

export function formatBenchmarkSectionTieLabel(
  sections: any[],
  options?: { maxInlineNames?: number },
) {
  const names = sortSectionsByName(sections)
    .map((section: any) => String(section?.academicSectionName || section?.name || "").trim())
    .filter(Boolean);

  if (names.length === 0) return "—";
  if (names.length <= (options?.maxInlineNames ?? 3)) return names.join(", ");
  return `${names[0]} +${names.length - 1} more`;
}

export function formatBenchmarkSectionTieBreakdown(
  sections: any[],
  options?: { separator?: string },
) {
  const separator = options?.separator ?? " • ";
  const rows = sortSectionsByName(sections);
  if (rows.length === 0) return "—";

  return rows
    .map(
      (section: any) =>
        `${String(section?.academicSectionName || section?.name || "Unknown Section")}: ${toPercentText(section?.metrics?.accuracyPct)} accuracy, ${toSignedPointsText(section?.gap?.accuracyPct)} gap, ${toPercentText(section?.metrics?.unattemptedPct)} skip, ${toCoverageText(section?.metrics)} coverage`,
    )
    .join(separator);
}

export function getRankedBenchmarkTagRows(
  benchmarkData: any,
  selectedAcademicSectionId: string,
) {
  const focusCohort = getFocusBenchmarkCohort(
    benchmarkData,
    selectedAcademicSectionId,
  );
  const tagBenchmarks = Array.isArray(benchmarkData?.tagBenchmarks)
    ? benchmarkData.tagBenchmarks
    : [];

  return [...tagBenchmarks]
    .map((row: any) => {
      const cohortRows = Array.isArray(row?.cohorts) ? row.cohorts : [];
      const focus = focusCohort
        ? cohortRows.find(
            (cohort: any) =>
              String(cohort?.academicSectionId || "") ===
                String(focusCohort?.academicSectionId || ""),
          ) || null
        : null;
      const worstGapSections = getWorstGapSections(cohortRows);
      const worstGapSection = worstGapSections[0] || null;
      const affectedSectionsCount = cohortRows.filter(
        (cohort: any) => toNumeric(cohort?.gap?.accuracyPct) < 0,
      ).length;

      return {
        ...row,
        focus,
        worstGapSection,
        worstGapSections,
        affectedSectionsCount,
        rankGap: focus
          ? toNumeric(focus?.gap?.accuracyPct)
          : toNumeric(worstGapSection?.gap?.accuracyPct),
        rankClassAccuracy: toNumeric(row?.baseline?.accuracyPct),
        rankClassUnattempted: toNumeric(row?.baseline?.unattemptedPct),
      };
    })
    .sort((left: any, right: any) => {
      if (focusCohort) {
        const gapDiff = left.rankGap - right.rankGap;
        if (gapDiff !== 0) return gapDiff;
        return left.rankClassAccuracy - right.rankClassAccuracy;
      }

      const classAccuracyDiff = left.rankClassAccuracy - right.rankClassAccuracy;
      if (classAccuracyDiff !== 0) return classAccuracyDiff;

      const classSkipDiff = right.rankClassUnattempted - left.rankClassUnattempted;
      if (classSkipDiff !== 0) return classSkipDiff;

      const affectedDiff =
        toNumeric(right?.affectedSectionsCount) - toNumeric(left?.affectedSectionsCount);
      if (affectedDiff !== 0) return affectedDiff;

      return left.rankGap - right.rankGap;
    });
}

export function getRankedBenchmarkQuestionRows(
  benchmarkData: any,
  selectedAcademicSectionId: string,
) {
  const focusCohort = getFocusBenchmarkCohort(
    benchmarkData,
    selectedAcademicSectionId,
  );
  const rankingMode = getBenchmarkQuestionRankingMode(selectedAcademicSectionId);
  const questionBenchmarks = Array.isArray(benchmarkData?.questionBenchmarks)
    ? benchmarkData.questionBenchmarks
    : [];

  return [...questionBenchmarks]
    .map((row: any) => {
      const cohortRows = Array.isArray(row?.cohorts) ? row.cohorts : [];
      const focus = focusCohort
        ? cohortRows.find(
            (cohort: any) =>
              String(cohort?.academicSectionId || "") ===
                String(focusCohort?.academicSectionId || ""),
          ) || null
        : null;
      const worstGapSections = getWorstGapSections(cohortRows);
      const worstGapSection = worstGapSections[0] || null;
      const peakSkipSection =
        cohortRows.length > 0
          ? [...cohortRows].sort(
              (left: any, right: any) =>
                toNumeric(right?.metrics?.unattemptedPct) -
                toNumeric(left?.metrics?.unattemptedPct),
            )[0] || null
          : null;
      const affectedSectionsCount = cohortRows.filter(
        (cohort: any) => toNumeric(cohort?.gap?.accuracyPct) < 0,
      ).length;
      const skipAffectedSectionsCount = cohortRows.filter(
        (cohort: any) =>
          toNumeric(cohort?.metrics?.unattemptedPct) >
          toNumeric(row?.baseline?.unattemptedPct),
      ).length;

      return {
        ...row,
        focus,
        worstGapSection,
        worstGapSections,
        worstSkipSection: peakSkipSection,
        peakSkipSection,
        affectedSectionsCount,
        skipAffectedSectionsCount,
        rankGap: focus
          ? toNumeric(focus?.gap?.accuracyPct)
          : toNumeric(worstGapSection?.gap?.accuracyPct),
        rankUnattempted: focus
          ? toNumeric(focus?.metrics?.unattemptedPct)
          : toNumeric(peakSkipSection?.metrics?.unattemptedPct),
        rankClassAccuracy: toNumeric(row?.baseline?.accuracyPct),
        rankClassUnattempted: toNumeric(row?.baseline?.unattemptedPct),
        previewText: toPlainText(row?.questionText),
        rankingMode,
      };
    })
    .sort((left: any, right: any) => {
      if (rankingMode === "section_gap") {
        const gapDiff = left.rankGap - right.rankGap;
        if (gapDiff !== 0) return gapDiff;

        const skipDiff = right.rankUnattempted - left.rankUnattempted;
        if (skipDiff !== 0) return skipDiff;

        const classAccuracyDiff = left.rankClassAccuracy - right.rankClassAccuracy;
        if (classAccuracyDiff !== 0) return classAccuracyDiff;

        return toNumeric(left?.questionNumber) - toNumeric(right?.questionNumber);
      }

      const classAccuracyDiff = left.rankClassAccuracy - right.rankClassAccuracy;
      if (classAccuracyDiff !== 0) return classAccuracyDiff;

      const classSkipDiff = right.rankClassUnattempted - left.rankClassUnattempted;
      if (classSkipDiff !== 0) return classSkipDiff;

      const affectedDiff =
        toNumeric(right?.affectedSectionsCount) - toNumeric(left?.affectedSectionsCount);
      if (affectedDiff !== 0) return affectedDiff;

      const worstGapDiff =
        toNumeric(left?.worstGapSection?.gap?.accuracyPct) -
        toNumeric(right?.worstGapSection?.gap?.accuracyPct);
      if (worstGapDiff !== 0) return worstGapDiff;

      return toNumeric(left?.questionNumber) - toNumeric(right?.questionNumber);
    });
}

export function getProcessedBenchmarkDistractorRows(
  benchmarkData: any,
  selectedAcademicSectionId: string,
  settings?: Partial<BenchmarkViewSettings> | null,
) {
  const normalized = normalizeBenchmarkViewSettings(settings);
  const focusCohort = getFocusBenchmarkCohort(
    benchmarkData,
    selectedAcademicSectionId,
  );
  const distractorBenchmarks = Array.isArray(benchmarkData?.distractorBenchmarks)
    ? benchmarkData.distractorBenchmarks
    : [];

  const rows = distractorBenchmarks
    .filter((row: any) => !row?.isCorrectOption)
    .map((row: any) => {
      const cohortRows = Array.isArray(row?.cohorts) ? row.cohorts : [];
      const sortedBySelected = [...cohortRows].sort((left: any, right: any) => {
        const selectedDiff =
          toNumeric(right?.metrics?.selectedPct) -
          toNumeric(left?.metrics?.selectedPct);
        if (selectedDiff !== 0) return selectedDiff;
        return toNumeric(right?.gapSelectedPct) - toNumeric(left?.gapSelectedPct);
      });
      const focus = focusCohort
        ? cohortRows.find(
            (cohort: any) =>
              String(cohort?.academicSectionId || "") ===
                String(focusCohort?.academicSectionId || ""),
          ) || null
        : sortedBySelected[0] || null;
      const visibleSections = sortedBySelected.filter(
        (cohort: any) =>
          toNumeric(cohort?.metrics?.selectedPct) >=
            normalized.minDistractorPct &&
          toNumeric(cohort?.metrics?.selectedCount) >=
            normalized.minDistractorCount,
      );
      const passesThreshold = focusCohort
        ? !!focus &&
          toNumeric(focus?.metrics?.selectedPct) >=
            normalized.minDistractorPct &&
          toNumeric(focus?.metrics?.selectedCount) >=
            normalized.minDistractorCount
        : visibleSections.length > 0;

      const worstGapSections = getWorstDistractorGapSections(cohortRows);
      const worstGapSection = worstGapSections[0] || null;

      return {
        ...row,
        focus,
        peakSection: sortedBySelected[0] || null,
        worstGapSection,
        worstGapSections,
        visibleSections,
        affectedSectionsCount: visibleSections.length,
        rankSelectedPct: focusCohort
          ? toNumeric(focus?.metrics?.selectedPct)
          : toNumeric(sortedBySelected[0]?.metrics?.selectedPct),
        rankGap: focusCohort
          ? toNumeric(focus?.gapSelectedPct)
          : toNumeric(worstGapSection?.gapSelectedPct),
        passesThreshold,
      };
    })
    .filter((row: any) => row.passesThreshold);

  return rows.sort((left: any, right: any) => {
    if (normalized.distractorSortBy === "sections_affected") {
      const sectionDiff =
        toNumeric(right?.affectedSectionsCount) -
        toNumeric(left?.affectedSectionsCount);
      if (sectionDiff !== 0) return sectionDiff;
      return toNumeric(right?.rankSelectedPct) - toNumeric(left?.rankSelectedPct);
    }

    if (normalized.distractorSortBy === "peak_gap") {
      const gapDiff = toNumeric(right?.rankGap) - toNumeric(left?.rankGap);
      if (gapDiff !== 0) return gapDiff;
      return toNumeric(right?.rankSelectedPct) - toNumeric(left?.rankSelectedPct);
    }

    const selectedDiff =
      toNumeric(right?.rankSelectedPct) - toNumeric(left?.rankSelectedPct);
    if (selectedDiff !== 0) return selectedDiff;
    return toNumeric(right?.rankGap) - toNumeric(left?.rankGap);
  });
}
