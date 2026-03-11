import * as XLSX from "xlsx";
import {
  formatBenchmarkSectionTieLabel,
  getProcessedBenchmarkDistractorRows,
  getRankedBenchmarkQuestionRows,
  getRankedBenchmarkTagRows,
  normalizeBenchmarkViewSettings,
  type BenchmarkViewSettings,
} from "@/lib/analytics/benchmarkPresentation";

export type BenchmarkExportOptions = {
  benchmarkViewSettings?: Partial<BenchmarkViewSettings> | null;
  baseUrl?: string | null;
};

function toNumber(value: any): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : null;
}

function toSafeNumber(value: any): number {
  return toNumber(value) ?? 0;
}

function toText(value: any, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function toPlainText(value: any, fallback = "—"): string {
  const text = String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

function toPercentText(value: any): string {
  const numeric = toNumber(value);
  return numeric === null ? "—" : `${numeric.toFixed(2)}%`;
}

function toSignedPointsText(value: any): string {
  const numeric = toNumber(value);
  if (numeric === null) return "—";
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${numeric.toFixed(2)} pts`;
}

function toMinutesText(value: any): string {
  const numeric = toNumber(value);
  return numeric === null ? "—" : `${numeric.toFixed(2)} min`;
}

function toSignedMinutesText(value: any): string {
  const numeric = toNumber(value);
  if (numeric === null) return "—";
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${numeric.toFixed(2)} min`;
}

function applyHyperlinks(
  sheet: XLSX.WorkSheet,
  rows: Record<string, any>[],
  header: string[],
  hyperlinkColumns: string[] = [],
) {
  hyperlinkColumns.forEach((columnName) => {
    const columnIndex = header.indexOf(columnName);
    if (columnIndex < 0) return;

    rows.forEach((row, rowIndex) => {
      const url = String(row?.[columnName] || "").trim();
      if (!/^https?:\/\//i.test(url)) return;
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex });
      if (!sheet[cellRef]) return;
      sheet[cellRef].l = { Target: url } as any;
    });
  });
}

function withAutoFilter(
  rows: Record<string, any>[],
  header: string[],
  hyperlinkColumns: string[] = [],
): XLSX.WorkSheet {
  const sheet = XLSX.utils.json_to_sheet(rows, { header });
  if (header.length > 0) {
    sheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: 0, c: Math.max(header.length - 1, 0) },
      }),
    } as any;
  }
  applyHyperlinks(sheet, rows, header, hyperlinkColumns);
  return sheet;
}

function getSelectedAcademicSectionIdForExport(benchmarkData: any) {
  const cohorts = Array.isArray(benchmarkData?.cohorts)
    ? benchmarkData.cohorts
    : [];
  if (cohorts.length === 1) {
    return String(cohorts[0]?.academicSectionId || "");
  }
  return "all";
}

function normalizeBaseUrl(baseUrl?: string | null) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

function buildQuestionUrl(questionId: any, baseUrl?: string | null) {
  const normalizedQuestionId = String(questionId || "").trim();
  if (!normalizedQuestionId) return "";
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const relativePath = `/questions/view/${encodeURIComponent(normalizedQuestionId)}`;
  return normalizedBaseUrl ? `${normalizedBaseUrl}${relativePath}` : relativePath;
}

function getDistractorSortLabel(
  sortBy: BenchmarkViewSettings["distractorSortBy"],
) {
  if (sortBy === "peak_gap") return "Highest gap";
  if (sortBy === "sections_affected") return "Most sections affected";
  return "Highest selected %";
}

function getRowTagLabel(row: any) {
  return Array.isArray(row?.optionTags) && row.optionTags.length > 0
    ? row.optionTags
        .map((tag: any) => `${tag.type}: ${tag.value}`)
        .join(" • ")
    : row?.questionLabel;
}

function getQuestionLabel(
  question: { id?: string; number?: number; section?: string },
  allQuestions: { id?: string; number?: number; section?: string }[],
) {
  const distinctSections = new Set(
    (Array.isArray(allQuestions) ? allQuestions : [])
      .map((item) => String(item?.section || "").trim())
      .filter(Boolean),
  );
  const questionNumber = Number(question?.number);
  const questionLabel = Number.isFinite(questionNumber)
    ? `Q${questionNumber}`
    : "Question";
  if (distinctSections.size <= 1) return questionLabel;
  const sectionLabel = String(question?.section || "").trim();
  return sectionLabel ? `${sectionLabel} ${questionLabel}` : questionLabel;
}

function getTagQuestionRefs(row: any, baseUrl?: string | null) {
  const questions = Array.isArray(row?.questions) ? row.questions : [];
  return questions
    .map((question: any) => ({
      id: String(question?.id || "").trim(),
      label: getQuestionLabel(question, questions),
      url: buildQuestionUrl(question?.id, baseUrl),
    }))
    .filter((question: any) => question.id && question.label);
}

function getDistractorQuestionRef(row: any, baseUrl?: string | null) {
  const questionNumber = Number(row?.questionNumber);
  return {
    id: String(row?.questionId || "").trim(),
    label: Number.isFinite(questionNumber) ? `Q${questionNumber}` : "Question",
    url: buildQuestionUrl(row?.questionId, baseUrl),
  };
}

function getSectionBreakdown(row: any, focusedSectionOnly: boolean) {
  if (focusedSectionOnly) {
    const focus = row?.focus || row?.peakSection || null;
    if (!focus) return "—";
    return `${toText(focus?.academicSectionName)} ${toPercentText(
      focus?.metrics?.selectedPct,
    )} (${focus?.metrics?.selectedCount || 0})`;
  }

  const visibleSections = Array.isArray(row?.visibleSections)
    ? row.visibleSections
    : [];
  if (visibleSections.length === 0) return "—";
  return visibleSections
    .map(
      (cohort: any) =>
        `${toText(cohort?.academicSectionName)} ${toPercentText(
          cohort?.metrics?.selectedPct,
        )} (${cohort?.metrics?.selectedCount || 0})`,
    )
    .join(" • ");
}

export function buildBenchmarkOverviewRows(
  benchmarkData: any,
  options?: BenchmarkExportOptions,
) {
  const baseline = benchmarkData?.baseline || null;
  const questionScope = benchmarkData?.questionScope || {};
  const rosterMetrics = benchmarkData?.rosterMetrics || {};
  const selectedSection = benchmarkData?.cohorts?.length === 1
    ? benchmarkData.cohorts[0]
    : null;
  const benchmarkViewSettings = normalizeBenchmarkViewSettings(
    options?.benchmarkViewSettings,
  );

  if (!baseline) {
    return [{ Metric: "Benchmark", Value: "No benchmark data available" }];
  }

  return [
    { Metric: "Baseline", Value: "Compared with class average" },
    {
      Metric: "Question Scope",
      Value: `${questionScope.filteredQuestions || 0} / ${questionScope.totalQuestions || 0} questions`,
    },
    { Metric: "Eligible Students", Value: baseline.eligibleStudents || 0 },
    { Metric: "Respondents", Value: baseline.respondents || 0 },
    { Metric: "Coverage (%)", Value: toNumber(baseline.coveragePct) },
    { Metric: "Accuracy (%)", Value: toNumber(baseline.accuracyPct) },
    { Metric: "Incorrect (%)", Value: toNumber(baseline.incorrectPct) },
    { Metric: "Unattempted (%)", Value: toNumber(baseline.unattemptedPct) },
    { Metric: "Attempt Rate (%)", Value: toNumber(baseline.attemptRatePct) },
    { Metric: "Average Score (%)", Value: toNumber(baseline.avgScorePct) },
    { Metric: "Pass Rate (%)", Value: toNumber(baseline.passRatePct) },
    {
      Metric: "Median Completion (min)",
      Value: toNumber(baseline.medianCompletionMinutes),
    },
    {
      Metric: "Total Awarded Marks",
      Value: toNumber(baseline.totalAwardedMarks),
    },
    {
      Metric: "Total Possible Marks",
      Value: toNumber(baseline.totalPossibleMarks),
    },
    {
      Metric: "Academic Sections",
      Value: Array.isArray(rosterMetrics.academicSections)
        ? rosterMetrics.academicSections.length
        : 0,
    },
    selectedSection
      ? {
          Metric: "Focused Section",
          Value: toText(selectedSection.academicSectionName),
        }
      : null,
    {
      Metric: "Distractor Min Selected (%)",
      Value: benchmarkViewSettings.minDistractorPct,
    },
    {
      Metric: "Distractor Min Count",
      Value: benchmarkViewSettings.minDistractorCount,
    },
    {
      Metric: "Distractor Sort",
      Value: getDistractorSortLabel(benchmarkViewSettings.distractorSortBy),
    },
  ].filter((row): row is { Metric: string; Value: any } => !!row);
}

export function buildBenchmarkCohortRows(benchmarkData: any) {
  const cohorts = Array.isArray(benchmarkData?.cohorts)
    ? benchmarkData.cohorts
    : [];

  return cohorts.map((cohort: any) => ({
    Section: toText(cohort?.academicSectionName),
    "Eligible Students": cohort?.metrics?.eligibleStudents || 0,
    Respondents: cohort?.metrics?.respondents || 0,
    "Coverage (%)": toNumber(cohort?.metrics?.coveragePct),
    "Accuracy (%)": toNumber(cohort?.metrics?.accuracyPct),
    "Accuracy Gap": toSignedPointsText(cohort?.gap?.accuracyPct),
    "Incorrect (%)": toNumber(cohort?.metrics?.incorrectPct),
    "Incorrect Gap": toSignedPointsText(cohort?.gap?.incorrectPct),
    "Unattempted (%)": toNumber(cohort?.metrics?.unattemptedPct),
    "Unattempted Gap": toSignedPointsText(cohort?.gap?.unattemptedPct),
    "Attempt Rate (%)": toNumber(cohort?.metrics?.attemptRatePct),
    "Attempt Rate Gap": toSignedPointsText(cohort?.gap?.attemptRatePct),
    "Average Score (%)": toNumber(cohort?.metrics?.avgScorePct),
    "Average Score Gap": toSignedPointsText(cohort?.gap?.avgScorePct),
    "Pass Rate (%)": toNumber(cohort?.metrics?.passRatePct),
    "Pass Rate Gap": toSignedPointsText(cohort?.gap?.passRatePct),
    "Median Completion (min)": toNumber(
      cohort?.metrics?.medianCompletionMinutes,
    ),
    "Median Time Gap": toSignedMinutesText(
      cohort?.gap?.medianCompletionMinutes,
    ),
    "Total Awarded Marks": toNumber(cohort?.metrics?.totalAwardedMarks),
    "Total Possible Marks": toNumber(cohort?.metrics?.totalPossibleMarks),
  }));
}


export function buildBenchmarkQuestionRows(
  benchmarkData: any,
  options?: BenchmarkExportOptions,
) {
  const selectedAcademicSectionId =
    getSelectedAcademicSectionIdForExport(benchmarkData);
  const focusedSectionOnly = selectedAcademicSectionId !== "all";
  const questionRows = getRankedBenchmarkQuestionRows(
    benchmarkData,
    selectedAcademicSectionId,
  );

  return questionRows.map((row: any) => {
    const questionRef = getDistractorQuestionRef(row, options?.baseUrl);
    if (focusedSectionOnly) {
      return {
        "Q No": questionRef.label,
        "Question URL": questionRef.url,
        Question: row.previewText,
        Marks: toNumber(row?.marks),
        Section: toText(row?.focus?.academicSectionName),
        "Section Accuracy (%)": toNumber(row?.focus?.metrics?.accuracyPct),
        "Accuracy Gap": toSignedPointsText(row?.focus?.gap?.accuracyPct),
        "Section Skip (%)": toNumber(row?.focus?.metrics?.unattemptedPct),
        "Class Accuracy (%)": toNumber(row?.baseline?.accuracyPct),
        "Class Skip (%)": toNumber(row?.baseline?.unattemptedPct),
      };
    }

    return {
      "Q No": questionRef.label,
      "Question URL": questionRef.url,
      Question: row.previewText,
      Marks: toNumber(row?.marks),
      "Class Accuracy (%)": toNumber(row?.baseline?.accuracyPct),
      "Class Skip (%)": toNumber(row?.baseline?.unattemptedPct),
      "Sections Below Baseline": row?.affectedSectionsCount || 0,
      "Lowest Section(s)": toText(formatBenchmarkSectionTieLabel(row?.worstGapSections)),
      "Worst Gap": toSignedPointsText(row?.worstGapSection?.gap?.accuracyPct),
      "Peak Skip (%)": toNumber(row?.worstSkipSection?.metrics?.unattemptedPct),
    };
  });
}

export function buildBenchmarkTagRows(
  benchmarkData: any,
  options?: BenchmarkExportOptions,
) {
  const selectedAcademicSectionId =
    getSelectedAcademicSectionIdForExport(benchmarkData);
  const tagBenchmarks = getRankedBenchmarkTagRows(
    benchmarkData,
    selectedAcademicSectionId,
  );

  return tagBenchmarks.flatMap((row: any) => {
    const questionRefs = getTagQuestionRefs(row, options?.baseUrl);
    const qNos = questionRefs.length > 0
      ? questionRefs.map((question: any) => question.label).join(" • ")
      : "—";
    const cohorts = Array.isArray(row?.cohorts) ? row.cohorts : [];

    if (cohorts.length === 0) {
      return [
        {
          Group: toText(
            Array.isArray(row?.path) && row.path.length > 1
              ? row.path.slice(0, -1).join(" → ")
              : "Overall",
          ),
          Tag: toText(row?.label),
          "Q Nos": qNos,
          Section: "—",
          "Baseline Accuracy (%)": toNumber(row?.baseline?.accuracyPct),
          "Section Accuracy (%)": null,
          "Accuracy Gap": "—",
          "Opportunity Count": row?.baseline?.opportunityCount || 0,
          "Correct Count": row?.baseline?.correctCount || 0,
          "Incorrect Count": row?.baseline?.incorrectCount || 0,
          "Unattempted Count": row?.baseline?.unattemptedCount || 0,
        },
      ];
    }

    return cohorts.map((cohort: any) => ({
      Group: toText(
        Array.isArray(row?.path) && row.path.length > 1
          ? row.path.slice(0, -1).join(" → ")
          : "Overall",
      ),
      Tag: toText(row?.label),
      "Q Nos": qNos,
      Section: toText(cohort?.academicSectionName),
      "Baseline Accuracy (%)": toNumber(row?.baseline?.accuracyPct),
      "Section Accuracy (%)": toNumber(cohort?.metrics?.accuracyPct),
      "Accuracy Gap": toSignedPointsText(cohort?.gap?.accuracyPct),
      "Opportunity Count": cohort?.metrics?.opportunityCount || 0,
      "Correct Count": cohort?.metrics?.correctCount || 0,
      "Incorrect Count": cohort?.metrics?.incorrectCount || 0,
      "Unattempted Count": cohort?.metrics?.unattemptedCount || 0,
    }));
  });
}

export function buildBenchmarkDistractorRows(
  benchmarkData: any,
  options?: BenchmarkExportOptions,
) {
  const selectedAcademicSectionId =
    getSelectedAcademicSectionIdForExport(benchmarkData);
  const focusedSectionOnly = selectedAcademicSectionId !== "all";
  const distractorRows = getProcessedBenchmarkDistractorRows(
    benchmarkData,
    selectedAcademicSectionId,
    options?.benchmarkViewSettings,
  );

  return distractorRows.flatMap((row: any) => {
    const questionRef = getDistractorQuestionRef(row, options?.baseUrl);
    const common = {
      Group: toText(row?.questionLabel),
      "Q No": questionRef.label,
      "Question URL": questionRef.url,
      Tag: toText(getRowTagLabel(row)),
      Option: toText(row?.optionLabel),
      Correct: row?.isCorrectOption ? "Yes" : "No",
    };

    if (focusedSectionOnly) {
      const focus = row?.focus || row?.peakSection || null;
      return [
        {
          ...common,
          Section: toText(focus?.academicSectionName),
          "Baseline Selected (%)": toNumber(row?.baseline?.selectedPct),
          "Section Selected (%)": toNumber(focus?.metrics?.selectedPct),
          "Selection Gap": toSignedPointsText(focus?.gapSelectedPct),
          "Selected Count": focus?.metrics?.selectedCount || 0,
          "Sections Affected": focus ? 1 : 0,
          "Peak Selected (%)": toNumber(focus?.metrics?.selectedPct),
          "Most Affected Section(s)": toText(focus?.academicSectionName),
          "Section Breakdown": getSectionBreakdown(row, true),
        },
      ];
    }

    const visibleSections =
      Array.isArray(row?.visibleSections) && row.visibleSections.length > 0
        ? row.visibleSections
        : [];

    return visibleSections.map((cohort: any) => ({
      ...common,
      Section: toText(cohort?.academicSectionName),
      "Baseline Selected (%)": toNumber(row?.baseline?.selectedPct),
      "Section Selected (%)": toNumber(cohort?.metrics?.selectedPct),
      "Selection Gap": toSignedPointsText(cohort?.gapSelectedPct),
      "Selected Count": cohort?.metrics?.selectedCount || 0,
      "Sections Affected": row?.affectedSectionsCount || 0,
      "Peak Selected (%)": toNumber(row?.peakSection?.metrics?.selectedPct),
      "Most Affected Section(s)": toText(formatBenchmarkSectionTieLabel(row?.worstGapSections)),
      "Section Breakdown": getSectionBreakdown(row, false),
    }));
  });
}

export function buildBenchmarkQuestionLinkRows(
  benchmarkData: any,
  options?: BenchmarkExportOptions,
) {
  const selectedAcademicSectionId =
    getSelectedAcademicSectionIdForExport(benchmarkData);
  const tagBenchmarks = getRankedBenchmarkTagRows(
    benchmarkData,
    selectedAcademicSectionId,
  );
  const distractorRows = getProcessedBenchmarkDistractorRows(
    benchmarkData,
    selectedAcademicSectionId,
    options?.benchmarkViewSettings,
  );

  const rows: Record<string, any>[] = [];

  const questionHotspotRows = getRankedBenchmarkQuestionRows(
    benchmarkData,
    selectedAcademicSectionId,
  );
  const questionSourceLabel =
    selectedAcademicSectionId === "all" ? "Hardest Questions" : "Question Hotspots";

  questionHotspotRows.forEach((row: any) => {
    const questionRef = getDistractorQuestionRef(row, options?.baseUrl);
    rows.push({
      Source: questionSourceLabel,
      Context: toText(row?.questionLabel),
      "Q No": questionRef.label,
      "Question URL": questionRef.url,
    });
  });

  tagBenchmarks.forEach((row: any) => {
    getTagQuestionRefs(row, options?.baseUrl).forEach((question: any) => {
      rows.push({
        Source: "Tag Benchmark Matrix",
        Context: toText(row?.label),
        "Q No": question.label,
        "Question URL": question.url,
      });
    });
  });

  distractorRows.forEach((row: any) => {
    const questionRef = getDistractorQuestionRef(row, options?.baseUrl);
    rows.push({
      Source: "Distractor Analysis",
      Context: `${toText(row?.questionLabel)} • ${toText(row?.optionLabel)}`,
      "Q No": questionRef.label,
      "Question URL": questionRef.url,
    });
  });

  return rows;
}

function buildBenchmarkPdfDistractorSection(
  benchmarkData: any,
  options?: BenchmarkExportOptions,
) {
  const selectedAcademicSectionId =
    getSelectedAcademicSectionIdForExport(benchmarkData);
  const focusedSectionOnly = selectedAcademicSectionId !== "all";
  const distractorRows = getProcessedBenchmarkDistractorRows(
    benchmarkData,
    selectedAcademicSectionId,
    options?.benchmarkViewSettings,
  );

  if (focusedSectionOnly) {
    return {
      head: [["Q No", "Distractor", "Option", "Section", "Selected", "Gap"]],
      rows: distractorRows.map((row: any) => {
        const questionRef = getDistractorQuestionRef(row, options?.baseUrl);
        return [
          questionRef.label,
          toText(getRowTagLabel(row)),
          toText(row?.optionLabel),
          toText(row?.focus?.academicSectionName),
          toPercentText(row?.focus?.metrics?.selectedPct),
          toSignedPointsText(row?.focus?.gapSelectedPct),
        ];
      }),
    };
  }

  return {
    head: [[
      "Q No",
      "Distractor",
      "Option",
      "Sections",
      "Most Affected Section(s)",
      "Peak Selected",
      "Breakdown",
    ]],
    rows: distractorRows.map((row: any) => {
      const questionRef = getDistractorQuestionRef(row, options?.baseUrl);
      return [
        questionRef.label,
        toText(getRowTagLabel(row)),
        toText(row?.optionLabel),
        String(row?.affectedSectionsCount || 0),
        toText(formatBenchmarkSectionTieLabel(row?.worstGapSections)),
        toPercentText(row?.peakSection?.metrics?.selectedPct),
        getSectionBreakdown(row, false),
      ];
    }),
  };
}

export function buildBenchmarkInsightRows(benchmarkData: any) {
  const insights = Array.isArray(benchmarkData?.insights)
    ? benchmarkData.insights
    : [];
  return insights.map((insight: any) => ({
    Type: toText(insight?.type),
    Severity: toText(insight?.severity),
    Title: toText(insight?.title),
    Description: toText(insight?.description),
  }));
}

export function appendBenchmarkSheetsToWorkbook(
  workbook: XLSX.WorkBook,
  benchmarkData: any,
  options?: BenchmarkExportOptions,
) {
  const overviewRows = buildBenchmarkOverviewRows(benchmarkData, options);
  const cohortRows = buildBenchmarkCohortRows(benchmarkData);
  const tagRows = buildBenchmarkTagRows(benchmarkData, options);
  const questionRows = buildBenchmarkQuestionRows(benchmarkData, options);
  const distractorRows = buildBenchmarkDistractorRows(benchmarkData, options);
  const insightRows = buildBenchmarkInsightRows(benchmarkData);
  const questionLinkRows = buildBenchmarkQuestionLinkRows(benchmarkData, options);

  XLSX.utils.book_append_sheet(
    workbook,
    withAutoFilter(overviewRows, ["Metric", "Value"]),
    "Benchmark Summary",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    withAutoFilter(
      cohortRows.length > 0
        ? cohortRows
        : [{ Section: "No benchmark cohorts available" }],
      [
        "Section",
        "Eligible Students",
        "Respondents",
        "Coverage (%)",
        "Accuracy (%)",
        "Accuracy Gap",
        "Incorrect (%)",
        "Incorrect Gap",
        "Unattempted (%)",
        "Unattempted Gap",
        "Attempt Rate (%)",
        "Attempt Rate Gap",
        "Average Score (%)",
        "Average Score Gap",
        "Pass Rate (%)",
        "Pass Rate Gap",
        "Median Completion (min)",
        "Median Time Gap",
        "Total Awarded Marks",
        "Total Possible Marks",
      ],
    ),
    "Section Deep Dive",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    withAutoFilter(
      tagRows.length > 0 ? tagRows : [{ Tag: "No tag benchmark rows available" }],
      [
        "Group",
        "Tag",
        "Q Nos",
        "Section",
        "Baseline Accuracy (%)",
        "Section Accuracy (%)",
        "Accuracy Gap",
        "Opportunity Count",
        "Correct Count",
        "Incorrect Count",
        "Unattempted Count",
      ],
    ),
    "Tag Benchmark Matrix",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    withAutoFilter(
      questionRows.length > 0
        ? questionRows
        : [{ Question: "No question hotspot rows available" }],
      getSelectedAcademicSectionIdForExport(benchmarkData) !== "all"
        ? [
            "Q No",
            "Question URL",
            "Question",
            "Marks",
            "Section",
            "Section Accuracy (%)",
            "Accuracy Gap",
            "Section Skip (%)",
            "Class Accuracy (%)",
            "Class Skip (%)",
          ]
        : [
            "Q No",
            "Question URL",
            "Question",
            "Marks",
            "Class Accuracy (%)",
            "Class Skip (%)",
            "Sections Below Baseline",
            "Lowest Section(s)",
            "Worst Gap",
            "Peak Skip (%)",
          ],
      ["Question URL"],
    ),
    getSelectedAcademicSectionIdForExport(benchmarkData) !== "all"
      ? "Question Hotspots"
      : "Hardest Questions",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    withAutoFilter(
      distractorRows.length > 0
        ? distractorRows
        : [{ Tag: "No distractor benchmark rows available" }],
      [
        "Group",
        "Q No",
        "Question URL",
        "Tag",
        "Option",
        "Correct",
        "Section",
        "Baseline Selected (%)",
        "Section Selected (%)",
        "Selection Gap",
        "Selected Count",
        "Sections Affected",
        "Peak Selected (%)",
        "Most Affected Section(s)",
        "Section Breakdown",
      ],
      ["Question URL"],
    ),
    "Distractor Analysis",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    withAutoFilter(
      questionLinkRows.length > 0
        ? questionLinkRows
        : [{ Source: "No benchmark question links available" }],
      ["Source", "Context", "Q No", "Question URL"],
      ["Question URL"],
    ),
    "Benchmark Questions",
  );

  if (insightRows.length > 0) {
    XLSX.utils.book_append_sheet(
      workbook,
      withAutoFilter(insightRows, ["Type", "Severity", "Title", "Description"]),
      "Benchmark Insights",
    );
  }
}

export function buildBenchmarkPdfBundle(
  benchmarkData: any,
  options?: BenchmarkExportOptions,
) {
  const baseline = benchmarkData?.baseline || null;
  const questionScope = benchmarkData?.questionScope || {};
  const cohorts = Array.isArray(benchmarkData?.cohorts)
    ? benchmarkData.cohorts
    : [];
  const insights = Array.isArray(benchmarkData?.insights)
    ? benchmarkData.insights
    : [];
  const benchmarkViewSettings = normalizeBenchmarkViewSettings(
    options?.benchmarkViewSettings,
  );
  const tagRows = buildBenchmarkTagRows(benchmarkData, options);
  const distractorSection = buildBenchmarkPdfDistractorSection(
    benchmarkData,
    options,
  );
  const questionLinkRows = buildBenchmarkQuestionLinkRows(benchmarkData, options);

  return {
    hasData: !!baseline,
    overviewRows: baseline
      ? [
          ["Metric", "Value"],
          [
            "Question scope",
            `${questionScope.filteredQuestions || 0} / ${questionScope.totalQuestions || 0}`,
          ],
          ["Class accuracy", toPercentText(baseline.accuracyPct)],
          ["Average score", toPercentText(baseline.avgScorePct)],
          ["Pass rate", toPercentText(baseline.passRatePct)],
          ["Coverage", toPercentText(baseline.coveragePct)],
          [
            "Median completion",
            toMinutesText(baseline.medianCompletionMinutes),
          ],
          [
            "Distractor min selected",
            `${benchmarkViewSettings.minDistractorPct}%`,
          ],
          [
            "Distractor min count",
            String(benchmarkViewSettings.minDistractorCount),
          ],
          [
            "Distractor sort",
            getDistractorSortLabel(benchmarkViewSettings.distractorSortBy),
          ],
        ]
      : [],
    cohortRows: cohorts.map((cohort: any) => [
      toText(cohort?.academicSectionName),
      toPercentText(cohort?.metrics?.accuracyPct),
      toSignedPointsText(cohort?.gap?.accuracyPct),
      toPercentText(cohort?.metrics?.avgScorePct),
      toSignedPointsText(cohort?.gap?.avgScorePct),
      toPercentText(cohort?.metrics?.passRatePct),
      toSignedPointsText(cohort?.gap?.passRatePct),
    ]),
    insightRows: insights.map((insight: any) => [
      toText(insight?.title),
      toText(insight?.description),
      toText(insight?.severity),
    ]),
    tagRows: tagRows.map((row: any) => [
      toText(row?.["Q Nos"]),
      toText(row?.Tag),
      toText(row?.Section),
      toPercentText(row?.["Section Accuracy (%)"]),
      toText(row?.["Accuracy Gap"]),
    ]),
    distractorHead: distractorSection.head,
    distractorRows: distractorSection.rows,
    questionLinkHead: [["Source", "Context", "Q No", "Question Link"]],
    questionLinkRows: questionLinkRows.map((row: any) => ({
      cells: [
        toText(row?.Source),
        toText(row?.Context),
        toText(row?.["Q No"]),
        row?.["Question URL"] ? "Open question" : "—",
      ],
      url: toText(row?.["Question URL"], ""),
    })),
  };
}
