import Link from "next/link";
import React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  formatBenchmarkDistractorTieBreakdown,
  formatBenchmarkSectionTieBreakdown,
  formatBenchmarkSectionTieLabel,
  getFocusBenchmarkCohort,
  getProcessedBenchmarkDistractorRows,
  getRankedBenchmarkQuestionRows,
  getRankedBenchmarkTagRows,
  getSortedBenchmarkCohorts,
  type BenchmarkDistractorSortBy,
  type BenchmarkViewSettings,
} from "@/lib/analytics/benchmarkPresentation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type SelectedTag = {
  type: string;
  value: string;
};

type ClassBenchmarkPanelProps = {
  benchmarkData: any;
  loading: boolean;
  error: string | null;
  activeAcademicSectionLabel: string;
  selectedAcademicSectionId: string;
  selectedGroupLabels: string[];
  selectedTags: SelectedTag[];
  benchmarkViewSettings: BenchmarkViewSettings;
  onBenchmarkViewSettingsChange: (next: BenchmarkViewSettings) => void;
  onRemoveTag: (tag: SelectedTag) => void;
  onClearTags: () => void;
};

const TAG_PAGE_SIZE_OPTIONS = [10, 25, 50, 100, -1];
const DISTRACTOR_PAGE_SIZE_OPTIONS = [8, 25, 50, 100, -1];
const DISTRACTOR_PCT_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 40];
const DISTRACTOR_COUNT_OPTIONS = [1, 3, 5, 10];
const QUESTION_PAGE_SIZE_OPTIONS = [10, 25, 50, 100, -1];

function formatPercent(value: any) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return `${Number(value).toFixed(2)}%`;
}

function formatSignedPercent(value: any) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  const numeric = Number(value);
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${numeric.toFixed(2)} pts`;
}

function formatMinutes(value: any) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return `${Number(value).toFixed(2)} min`;
}

function formatSignedMinutes(value: any) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  const numeric = Number(value);
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${numeric.toFixed(2)} min`;
}

function formatCoverage(metrics: any) {
  if (!metrics) return "—";
  return `${metrics.respondents || 0} / ${metrics.eligibleStudents || 0}`;
}

function getToneClass(value: any, negativeIsGood = false) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "text-muted-foreground";
  }
  const numeric = Number(value);
  if (numeric === 0) return "text-muted-foreground";
  const positiveClass = negativeIsGood ? "text-emerald-600" : "text-rose-600";
  const negativeClass = negativeIsGood ? "text-rose-600" : "text-emerald-600";
  return numeric > 0 ? positiveClass : negativeClass;
}

function getBadgeTone(value: any, invert = false) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "bg-muted/40 text-muted-foreground";
  }
  const numeric = Number(value);
  if (invert) {
    if (numeric >= 0) return "bg-rose-100 text-rose-700";
    return "bg-emerald-100 text-emerald-700";
  }
  if (numeric >= 0) return "bg-emerald-100 text-emerald-700";
  return "bg-rose-100 text-rose-700";
}

function getSeverityBadgeClass(value: any) {
  const severity = String(value || "").trim().toLowerCase();
  if (severity === "high") return "bg-rose-100 text-rose-700";
  if (severity === "medium") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

function getAccuracyToneClass(value: any) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "text-muted-foreground";
  }
  const numeric = Number(value);
  if (numeric < 40) return "text-rose-600";
  if (numeric < 60) return "text-amber-700";
  return "text-emerald-600";
}

function getSkipToneClass(value: any) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "text-muted-foreground";
  }
  const numeric = Number(value);
  if (numeric >= 30) return "text-rose-600";
  if (numeric >= 15) return "text-amber-700";
  return "text-emerald-600";
}

function compactText(value: any, fallback = "—") {
  const text = String(value || "").trim();
  return text || fallback;
}

function toPlainText(value: any, fallback = "—") {
  const text = String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

function getPageSizeLabel(value: number) {
  return value === -1 ? "All" : String(value);
}

function getPageRows<T>(rows: T[], page: number, pageSize: number) {
  if (pageSize === -1) {
    return rows;
  }
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

function getRangeLabel(total: number, page: number, pageSize: number) {
  if (total === 0) return "0 of 0";
  if (pageSize === -1) return `1-${total} of ${total}`;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `${start}-${end} of ${total}`;
}

function getQuestionChipLabel(
  question: { id?: string; number?: number; section?: string },
  allQuestions: { id?: string; number?: number; section?: string }[],
) {
  const sections = new Set(
    (Array.isArray(allQuestions) ? allQuestions : [])
      .map((item) => String(item?.section || "").trim())
      .filter(Boolean),
  );
  const questionLabel = Number.isFinite(Number(question?.number))
    ? `Q${Number(question?.number)}`
    : "Question";
  if (sections.size <= 1) return questionLabel;
  const sectionLabel = String(question?.section || "").trim();
  return sectionLabel ? `${sectionLabel} ${questionLabel}` : questionLabel;
}

function LowestSectionsCell({ row }: { row: any }) {
  const sections = Array.isArray(row?.worstGapSections) ? row.worstGapSections : [];
  if (sections.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const label = formatBenchmarkSectionTieLabel(sections);
  const breakdown = formatBenchmarkSectionTieBreakdown(sections, { separator: "\n" });
  const gapValue = sections[0]?.gap?.accuracyPct;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={breakdown}
          className={`inline-flex rounded-full border border-border/60 px-2.5 py-1 text-xs font-medium shadow-sm transition-colors hover:opacity-90 ${getBadgeTone(
            gapValue,
          )}`}
        >
          {compactText(label)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {sections.length > 1 ? "Lowest sections" : "Lowest section"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {sections.length > 1 ? "These sections share" : "This section has"} the lowest accuracy gap for this question.
            </p>
          </div>
          <div className="space-y-2">
            {sections.map((section: any, index: number) => (
              <div
                key={String(section?.academicSectionId || `${section?.academicSectionName || "section"}-${index}`)}
                className="rounded-xl border border-border/60 bg-background p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {compactText(section?.academicSectionName)}
                  </p>
                  <span className={`text-xs font-semibold ${getToneClass(section?.gap?.accuracyPct, true)}`}>
                    {formatSignedPercent(section?.gap?.accuracyPct)}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>Accuracy {formatPercent(section?.metrics?.accuracyPct)}</span>
                  <span>Skip {formatPercent(section?.metrics?.unattemptedPct)}</span>
                  <span>Coverage {formatCoverage(section?.metrics)}</span>
                  <span>Respondents {section?.metrics?.respondents || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MostAffectedSectionsCell({ row }: { row: any }) {
  const sections = Array.isArray(row?.worstGapSections) ? row.worstGapSections : [];
  if (sections.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const label = formatBenchmarkSectionTieLabel(sections);
  const breakdown = formatBenchmarkDistractorTieBreakdown(sections, { separator: "\n" });
  const gapValue = sections[0]?.gapSelectedPct;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={breakdown}
          className={`inline-flex rounded-full border border-border/60 px-2.5 py-1 text-xs font-medium shadow-sm transition-colors hover:opacity-90 ${getBadgeTone(
            gapValue,
            true,
          )}`}
        >
          {compactText(label)}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {sections.length > 1 ? "Most affected sections" : "Most affected section"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {sections.length > 1 ? "These sections share" : "This section has"} the largest distractor selection gap for this option.
            </p>
          </div>
          <div className="space-y-2">
            {sections.map((section: any, index: number) => (
              <div
                key={String(section?.academicSectionId || `${section?.academicSectionName || "section"}-${index}`)}
                className="rounded-xl border border-border/60 bg-background p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {compactText(section?.academicSectionName)}
                  </p>
                  <span className={`text-xs font-semibold ${getToneClass(section?.gapSelectedPct, false)}`}>
                    {formatSignedPercent(section?.gapSelectedPct)}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>Selected {formatPercent(section?.metrics?.selectedPct)}</span>
                  <span>Selected count {section?.metrics?.selectedCount || 0}</span>
                  <span>Respondents {section?.metrics?.respondents || 0}</span>
                  <span>Gap {formatSignedPercent(section?.gapSelectedPct)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function ClassBenchmarkPanel({
  benchmarkData,
  loading,
  error,
  activeAcademicSectionLabel,
  selectedAcademicSectionId,
  selectedGroupLabels,
  selectedTags,
  benchmarkViewSettings,
  onBenchmarkViewSettingsChange,
  onRemoveTag,
  onClearTags,
}: ClassBenchmarkPanelProps) {
  const [tagPageSize, setTagPageSize] = React.useState(10);
  const [tagPage, setTagPage] = React.useState(1);
  const [questionPageSize, setQuestionPageSize] = React.useState(10);
  const [questionPage, setQuestionPage] = React.useState(1);
  const [distractorPageSize, setDistractorPageSize] = React.useState(8);
  const [distractorPage, setDistractorPage] = React.useState(1);
  const [insightsPageSize, setInsightsPageSize] = React.useState(6);
  const [insightsPage, setInsightsPage] = React.useState(1);
  const [insightsShowAll, setInsightsShowAll] = React.useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const questionReturnTo = React.useMemo(() => {
    const query = searchParams?.toString();
    if (!pathname) return '/workspace/questions';
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const getQuestionHref = React.useCallback(
    (questionId?: string | number) => {
      if (!questionId) return '/workspace/questions';
      const params = new URLSearchParams();
      if (questionReturnTo) params.set('returnTo', questionReturnTo);
      const questionPath = `/workspace/questions/view/${encodeURIComponent(String(questionId))}`;
      return params.size > 0 ? `${questionPath}?${params.toString()}` : questionPath;
    },
    [questionReturnTo],
  );

  const { minDistractorPct, minDistractorCount, distractorSortBy } =
    benchmarkViewSettings;

  const updateBenchmarkViewSettings = React.useCallback(
    (updates: Partial<BenchmarkViewSettings>) => {
      onBenchmarkViewSettingsChange({
        ...benchmarkViewSettings,
        ...updates,
      });
    },
    [benchmarkViewSettings, onBenchmarkViewSettingsChange],
  );

  const baseline = benchmarkData?.baseline || null;
  const cohorts = Array.isArray(benchmarkData?.cohorts)
    ? benchmarkData.cohorts
    : [];
  const tagBenchmarks = React.useMemo(
    () =>
      Array.isArray(benchmarkData?.tagBenchmarks)
        ? benchmarkData.tagBenchmarks
        : [],
    [benchmarkData],
  );
  const distractorBenchmarks = Array.isArray(benchmarkData?.distractorBenchmarks)
    ? benchmarkData.distractorBenchmarks
    : [];
  const questionBenchmarks = Array.isArray(benchmarkData?.questionBenchmarks)
    ? benchmarkData.questionBenchmarks
    : [];
  const insights = React.useMemo(
    () =>
      Array.isArray(benchmarkData?.insights)
        ? benchmarkData.insights
        : [],
    [benchmarkData],
  );
  const questionScope = benchmarkData?.questionScope || {};
  const focusCohort = React.useMemo(
    () => getFocusBenchmarkCohort(benchmarkData, selectedAcademicSectionId),
    [benchmarkData, selectedAcademicSectionId],
  );
  const isWholeClassView = !focusCohort;

  const sortedCohorts = React.useMemo(
    () => getSortedBenchmarkCohorts(benchmarkData),
    [benchmarkData],
  );

  const rankedTagRows = React.useMemo(
    () => getRankedBenchmarkTagRows(benchmarkData, selectedAcademicSectionId),
    [benchmarkData, selectedAcademicSectionId],
  );

  const processedDistractors = React.useMemo(
    () =>
      getProcessedBenchmarkDistractorRows(
        benchmarkData,
        selectedAcademicSectionId,
        benchmarkViewSettings,
      ),
    [benchmarkData, benchmarkViewSettings, selectedAcademicSectionId],
  );


  const rankedQuestionRows = React.useMemo(
    () => getRankedBenchmarkQuestionRows(benchmarkData, selectedAcademicSectionId),
    [benchmarkData, selectedAcademicSectionId],
  );

  const skipRiskRow = React.useMemo(() => {
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
        const affectedSectionsCount = cohortRows.filter(
          (cohort: any) =>
            Number(cohort?.metrics?.unattemptedPct || 0) >
            Number(row?.baseline?.unattemptedPct || 0),
        ).length;
        const skipGap = focus
          ? Number(focus?.metrics?.unattemptedPct || 0) - Number(row?.baseline?.unattemptedPct || 0)
          : 0;

        return {
          ...row,
          focus,
          affectedSectionsCount,
          rankUnattempted: focus
            ? Number(focus?.metrics?.unattemptedPct || 0)
            : Number(row?.baseline?.unattemptedPct || 0),
          skipGap,
        };
      })
      .sort((left: any, right: any) => {
        const skipDiff = Number(right?.rankUnattempted || 0) - Number(left?.rankUnattempted || 0);
        if (skipDiff !== 0) return skipDiff;
        if (focusCohort) {
          return Number(left?.focus?.gap?.accuracyPct || 0) - Number(right?.focus?.gap?.accuracyPct || 0);
        }
        return Number(right?.affectedSectionsCount || 0) - Number(left?.affectedSectionsCount || 0);
      })[0] || null;
  }, [focusCohort, tagBenchmarks]);

  const strongestSection = React.useMemo(
    () =>
      [...sortedCohorts].sort(
        (left: any, right: any) =>
          Number(right?.metrics?.accuracyPct || 0) -
          Number(left?.metrics?.accuracyPct || 0),
      )[0] || null,
    [sortedCohorts],
  );

  const questionHotspot = React.useMemo(() => rankedQuestionRows[0] || null, [rankedQuestionRows]);

  const widespreadDistractor = React.useMemo(
    () =>
      [...processedDistractors].sort((left: any, right: any) => {
        const sectionDiff = right.affectedSectionsCount - left.affectedSectionsCount;
        if (sectionDiff !== 0) return sectionDiff;
        return right.rankGap - left.rankGap;
      })[0] || null,
    [processedDistractors],
  );

  const insightScopeLabel = React.useMemo(
    () =>
      isWholeClassView
        ? "Class • Question Difficulty"
        : `${activeAcademicSectionLabel} • Question Gaps`,
    [activeAcademicSectionLabel, isWholeClassView],
  );

  const insightTotalPages =
    insightsPageSize === -1 ? 1 : Math.max(1, Math.ceil(insights.length / insightsPageSize));
  const safeInsightsPage = clampPage(insightsPage, insightTotalPages);
  const displayedInsights = React.useMemo(
    () => getPageRows(insights, safeInsightsPage, insightsPageSize),
    [insights, insightsPageSize, safeInsightsPage],
  );

  const teacherActionCards = React.useMemo(() => {
    const weakestTagRow = rankedTagRows[0] || null;
    return [
      weakestTagRow
        ? {
            label: "Reteach first",
            title: compactText(weakestTagRow.label),
            tone: focusCohort
              ? getToneClass(weakestTagRow.rankGap, true)
              : getAccuracyToneClass(weakestTagRow?.baseline?.accuracyPct),
            note: focusCohort
              ? `${formatSignedPercent(weakestTagRow.rankGap)} vs class baseline`
              : `${formatPercent(weakestTagRow?.baseline?.accuracyPct)} class accuracy`,
          }
        : null,
      skipRiskRow
        ? {
            label: "Skip risk",
            title: compactText(skipRiskRow.label),
            tone: getSkipToneClass(
              focusCohort
                ? skipRiskRow?.focus?.metrics?.unattemptedPct
                : skipRiskRow?.baseline?.unattemptedPct,
            ),
            note: focusCohort
              ? `${formatPercent(skipRiskRow?.focus?.metrics?.unattemptedPct)} unattempted, ${formatSignedPercent(skipRiskRow?.skipGap)} vs class skip`
              : `${formatPercent(skipRiskRow?.baseline?.unattemptedPct)} class skip`,
          }
        : null,
      questionHotspot
        ? {
            label: "Question hotspot",
            title: compactText(questionHotspot.questionLabel),
            tone: focusCohort
              ? getToneClass(questionHotspot.rankGap, true)
              : getAccuracyToneClass(questionHotspot?.baseline?.accuracyPct),
            note: focusCohort
              ? `${formatSignedPercent(questionHotspot.rankGap)} vs class baseline`
              : `${formatPercent(questionHotspot?.baseline?.accuracyPct)} class accuracy${Array.isArray(questionHotspot?.worstGapSections) && questionHotspot.worstGapSections.length > 1 ? ` • ${questionHotspot.worstGapSections.length} sections tied lowest` : ""}`,
          }
        : null,
      widespreadDistractor
        ? {
            label: "Misconception",
            title: compactText(widespreadDistractor.questionLabel),
            tone: getToneClass(widespreadDistractor.rankGap, false),
            note: focusCohort
              ? `${formatPercent(widespreadDistractor.rankSelectedPct)} selected ${compactText(widespreadDistractor.optionLabel)}, ${formatSignedPercent(widespreadDistractor.rankGap)} vs class`
              : `${widespreadDistractor.affectedSectionsCount} sections cross threshold${Array.isArray(widespreadDistractor?.worstGapSections) && widespreadDistractor.worstGapSections.length > 1 ? ` • ${widespreadDistractor.worstGapSections.length} tied most affected` : ""}`,
          }
        : null,
      strongestSection
        ? {
            label: "Model section",
            title: compactText(strongestSection.academicSectionName),
            tone: "text-emerald-700",
            note: focusCohort
              ? `${formatSignedPercent(focusCohort?.gap?.accuracyPct)} vs class baseline`
              : `${formatPercent(strongestSection.metrics?.accuracyPct)} accuracy`,
          }
        : null,
    ].filter(Boolean);
  }, [
    focusCohort,
    rankedTagRows,
    skipRiskRow,
    questionHotspot,
    strongestSection,
    widespreadDistractor,
  ]);

  const questionTotalPages =
    questionPageSize === -1 ? 1 : Math.max(1, Math.ceil(rankedQuestionRows.length / questionPageSize));
  const safeQuestionPage = clampPage(questionPage, questionTotalPages);
  const displayedQuestionRows = React.useMemo(
    () => getPageRows(rankedQuestionRows, safeQuestionPage, questionPageSize),
    [questionPageSize, rankedQuestionRows, safeQuestionPage],
  );

  const tagTotalPages =
    tagPageSize === -1 ? 1 : Math.max(1, Math.ceil(rankedTagRows.length / tagPageSize));
  const safeTagPage = clampPage(tagPage, tagTotalPages);
  const displayedTagRows = React.useMemo(
    () => getPageRows(rankedTagRows, safeTagPage, tagPageSize),
    [rankedTagRows, safeTagPage, tagPageSize],
  );

  const distractorTotalPages =
    distractorPageSize === -1
      ? 1
      : Math.max(1, Math.ceil(processedDistractors.length / distractorPageSize));
  const safeDistractorPage = clampPage(distractorPage, distractorTotalPages);
  const displayedDistractors = React.useMemo(
    () => getPageRows(processedDistractors, safeDistractorPage, distractorPageSize),
    [distractorPageSize, processedDistractors, safeDistractorPage],
  );

  React.useEffect(() => {
    setQuestionPage(1);
  }, [selectedAcademicSectionId, questionPageSize, questionBenchmarks.length, selectedTags.length]);

  React.useEffect(() => {
    setTagPage(1);
  }, [selectedAcademicSectionId, tagPageSize, tagBenchmarks.length, selectedTags.length]);

  React.useEffect(() => {
    setDistractorPage(1);
  }, [
    selectedAcademicSectionId,
    minDistractorPct,
    minDistractorCount,
    distractorSortBy,
    distractorPageSize,
    distractorBenchmarks.length,
    selectedTags.length,
  ]);

  React.useEffect(() => {
    if (questionPage !== safeQuestionPage) {
      setQuestionPage(safeQuestionPage);
    }
  }, [questionPage, safeQuestionPage]);

  React.useEffect(() => {
    if (tagPage !== safeTagPage) {
      setTagPage(safeTagPage);
    }
  }, [safeTagPage, tagPage]);

  React.useEffect(() => {
    if (distractorPage !== safeDistractorPage) {
      setDistractorPage(safeDistractorPage);
    }
  }, [distractorPage, safeDistractorPage]);

  React.useEffect(() => {
    setInsightsPage(1);
  }, [selectedAcademicSectionId, insights.length, insightsPageSize, insightsShowAll, selectedTags.length]);

  React.useEffect(() => {
    if (insightsPage !== safeInsightsPage) {
      setInsightsPage(safeInsightsPage);
    }
  }, [insightsPage, safeInsightsPage]);

  if (loading && !benchmarkData) {
    return (
      <div className="analytics-card analytics-card-body">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm"
            >
              <div className="h-4 w-24 animate-pulse rounded bg-muted/70" />
              <div className="mt-3 h-8 w-20 animate-pulse rounded bg-muted/60" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-muted/50" />
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
          <div className="h-5 w-40 animate-pulse rounded bg-muted/70" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-[1.6fr_repeat(4,minmax(0,1fr))]">
                <div className="h-10 animate-pulse rounded-xl bg-muted/60" />
                <div className="h-10 animate-pulse rounded-xl bg-muted/50" />
                <div className="h-10 animate-pulse rounded-xl bg-muted/50" />
                <div className="h-10 animate-pulse rounded-xl bg-muted/50" />
                <div className="h-10 animate-pulse rounded-xl bg-muted/50" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !benchmarkData) {
    return (
      <div className="analytics-card analytics-card-body border-l-4 border-rose-400">
        <div className="app-empty-state py-10 text-left">
          <p className="text-sm font-semibold text-rose-700">Benchmark unavailable</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!baseline) {
    return (
      <div className="analytics-card analytics-card-body">
        <div className="app-empty-state py-10">
          No benchmark data found for the selected class scope.
        </div>
      </div>
    );
  }

  const overviewCards = [
    {
      label: "Class accuracy",
      value: formatPercent(baseline.accuracyPct),
      note: `${baseline.correctCount || 0} correct across ${baseline.opportunityCount || 0} opportunities`,
    },
    {
      label: "Average score",
      value: formatPercent(baseline.avgScorePct),
      note: `${baseline.totalAwardedMarks || 0} awarded marks`,
    },
    {
      label: "Pass rate",
      value: formatPercent(baseline.passRatePct),
      note:
        baseline.passThresholdMarks !== null && baseline.passThresholdMarks !== undefined
          ? `Pass threshold: ${baseline.passThresholdMarks} marks`
          : "Pass threshold unavailable",
    },
    {
      label: "Coverage",
      value: formatPercent(baseline.coveragePct),
      note: `${baseline.respondents || 0} of ${baseline.eligibleStudents || 0} eligible students`,
    },
    {
      label: "Attempt rate",
      value: formatPercent(baseline.attemptRatePct),
      note: `${baseline.attemptedCount || 0} attempted responses`,
    },
    {
      label: "Median completion",
      value: formatMinutes(baseline.medianCompletionMinutes),
      note: compactText(activeAcademicSectionLabel, "Class scope"),
    },
  ];

  const sectionSnapshotCards = focusCohort
    ? [
        {
          label: "Section accuracy",
          value: formatPercent(focusCohort?.metrics?.accuracyPct),
          tone: "text-foreground",
          note: `${focusCohort?.metrics?.correctCount || 0} correct across ${focusCohort?.metrics?.opportunityCount || 0} opportunities`,
        },
        {
          label: "Gap vs class",
          value: formatSignedPercent(focusCohort?.gap?.accuracyPct),
          tone: getToneClass(focusCohort?.gap?.accuracyPct, true),
          note: "Compared with class accuracy",
        },
        {
          label: "Avg score",
          value: formatPercent(focusCohort?.metrics?.avgScorePct),
          tone: "text-foreground",
          note: `${formatSignedPercent(focusCohort?.gap?.avgScorePct)} vs class average score`,
        },
        {
          label: "Pass rate",
          value: formatPercent(focusCohort?.metrics?.passRatePct),
          tone: "text-foreground",
          note: `${formatSignedPercent(focusCohort?.gap?.passRatePct)} vs class pass rate`,
        },
        {
          label: "Coverage",
          value: formatPercent(focusCohort?.metrics?.coveragePct),
          tone: "text-foreground",
          note: formatCoverage(focusCohort?.metrics),
        },
        {
          label: "Median time",
          value: formatMinutes(focusCohort?.metrics?.medianCompletionMinutes),
          tone: "text-foreground",
          note: `${formatSignedMinutes(focusCohort?.gap?.medianCompletionMinutes)} vs class median`,
        },
      ]
    : [];

  const distractorNote = focusCohort
    ? minDistractorPct === 0 && minDistractorCount <= 1
      ? `Showing all wrong options selected at least once in ${focusCohort.academicSectionName}.`
      : `Showing wrong options for ${focusCohort.academicSectionName} with ≥ ${minDistractorPct}% selected and ≥ ${minDistractorCount} students.`
    : minDistractorPct === 0 && minDistractorCount <= 1
      ? "Showing all wrong options with at least one section selection."
      : `Showing wrong options where at least one section has ≥ ${minDistractorPct}% selected and ≥ ${minDistractorCount} students.`;


  const questionPanelTitle = isWholeClassView ? "Hardest Questions" : "Question Hotspots";
  const questionPanelDescription = isWholeClassView
    ? "Lowest whole-class accuracy, with section spread context. Sorted by class accuracy → class skip → sections below baseline → lowest gap."
    : "";
  const questionEmptyState =
    Number(questionScope?.filteredQuestions || 0) === 0
      ? "No questions match the current benchmark filters."
      : isWholeClassView
        ? "No class-level question hotspots for the current filters."
        : "No section-vs-class question hotspots for the current filters.";

  const sectionSnapshotBlock = sectionSnapshotCards.length > 0 ? (
    <div className="analytics-card analytics-card-body">
      <div className="analytics-toolbar-row gap-4">
        <div className="analytics-toolbar-copy">
          <h2 className="analytics-card-title">Section Snapshot</h2>
          <p className="analytics-card-description">
            Current section performance against the class baseline for this paper.
          </p>
        </div>
        <div className="analytics-toolbar-meta">
          <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
            {compactText(focusCohort?.academicSectionName)}
          </span>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sectionSnapshotCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border/60 bg-background p-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {card.label}
            </p>
            <p className={`mt-2 text-2xl font-semibold ${card.tone}`}>
              {card.value}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {card.note}
            </p>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const sectionRankingBlock = isWholeClassView && sortedCohorts.length > 0 ? (
    <div className="analytics-card analytics-card-body">
      <div className="analytics-toolbar-row gap-4">
        <div className="analytics-toolbar-copy">
          <h2 className="analytics-card-title">Section Ranking</h2>
        </div>
        {loading ? (
          <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
            Refreshing…
          </span>
        ) : null}
      </div>
      <div className="analytics-table-wrap mt-4">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="analytics-th">Section</th>
              <th className="analytics-th-center">Coverage</th>
              <th className="analytics-th-center">Accuracy</th>
              <th className="analytics-th-center">Gap</th>
              <th className="analytics-th-center">Avg score</th>
              <th className="analytics-th-center">Gap</th>
              <th className="analytics-th-center">Pass rate</th>
              <th className="analytics-th-center">Gap</th>
              <th className="analytics-th-center">Median time</th>
            </tr>
          </thead>
          <tbody>
            {sortedCohorts.map((cohort: any) => (
              <tr key={cohort.academicSectionId} className="analytics-row">
                <td className="analytics-td">
                  <div className="font-medium text-foreground">
                    {compactText(cohort.academicSectionName)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatCoverage(cohort.metrics)}
                  </div>
                </td>
                <td className="analytics-td-center font-medium text-foreground">
                  {formatPercent(cohort.metrics?.coveragePct)}
                </td>
                <td className="analytics-td-center font-medium text-foreground">
                  {formatPercent(cohort.metrics?.accuracyPct)}
                </td>
                <td className={`analytics-td-center font-medium ${getToneClass(cohort.gap?.accuracyPct, true)}`}>
                  {formatSignedPercent(cohort.gap?.accuracyPct)}
                </td>
                <td className="analytics-td-center font-medium text-foreground">
                  {formatPercent(cohort.metrics?.avgScorePct)}
                </td>
                <td className={`analytics-td-center font-medium ${getToneClass(cohort.gap?.avgScorePct, true)}`}>
                  {formatSignedPercent(cohort.gap?.avgScorePct)}
                </td>
                <td className="analytics-td-center font-medium text-foreground">
                  {formatPercent(cohort.metrics?.passRatePct)}
                </td>
                <td className={`analytics-td-center font-medium ${getToneClass(cohort.gap?.passRatePct, true)}`}>
                  {formatSignedPercent(cohort.gap?.passRatePct)}
                </td>
                <td className="analytics-td-center font-medium text-foreground">
                  {formatMinutes(cohort.metrics?.medianCompletionMinutes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <div className="analytics-card overflow-hidden">
        <div className="analytics-card-header">
          <div className="analytics-toolbar-row gap-4">
            <div className="analytics-toolbar-copy">
              <h2 className="analytics-card-title">Benchmark Overview</h2>
              <p className="analytics-card-description">
                Compared with class average for the same paper.
              </p>
            </div>
            <div className="analytics-toolbar-meta">
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                {activeAcademicSectionLabel}
              </span>
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                {selectedGroupLabels.length > 0
                  ? selectedGroupLabels.join(" → ")
                  : "Default grouping"}
              </span>
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                {questionScope?.filteredQuestions || 0} / {questionScope?.totalQuestions || 0} questions
              </span>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="analytics-toolbar-chip">Compared with class average</span>
            {selectedTags.length > 0 ? (
              <>
                {selectedTags.map((tag) => (
                  <button
                    key={`${tag.type}:${tag.value}`}
                    type="button"
                    onClick={() => onRemoveTag(tag)}
                    className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                    title="Remove tag filter"
                  >
                    <span>
                      {tag.type}: {tag.value}
                    </span>
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onClearTags}
                  className="app-button-secondary h-8 px-3 text-xs"
                >
                  Clear tag filters
                </button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                No benchmark tag filters applied.
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {overviewCards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-border/60 bg-background p-4 shadow-sm"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {card.value}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {card.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {sectionSnapshotBlock}

      <div className="analytics-card analytics-card-body">
        <div className="analytics-toolbar-row gap-4">
          <div className="analytics-toolbar-copy">
            <h2 className="analytics-card-title">Teacher Actions</h2>
          </div>
          <div className="analytics-toolbar-meta">
            <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
              {teacherActionCards.length} action cues
            </span>
          </div>
        </div>
        {teacherActionCards.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {teacherActionCards.map((card: any) => (
              <div
                key={card.label}
                className="rounded-xl border border-border/60 bg-background p-4 shadow-sm"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </p>
                <p className={`mt-2 text-lg font-semibold ${card.tone}`}>
                  {card.title}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {card.note}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="app-empty-state mt-4">
            No teacher actions available.
          </div>
        )}
      </div>

      <div className="analytics-card analytics-card-body">
        <div className="analytics-toolbar-row gap-4">
          <div className="analytics-toolbar-copy">
            <h2 className="analytics-card-title">{questionPanelTitle}</h2>
            {isWholeClassView ? (
              <p className="analytics-card-description">{questionPanelDescription}</p>
            ) : null}
          </div>
          <div className="analytics-toolbar-meta">
            <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
              {getRangeLabel(rankedQuestionRows.length, safeQuestionPage, questionPageSize)}
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="analytics-toolbar-actions flex-wrap">
            <label className="app-field-group min-w-[140px]">
              <span className="app-field-label">Rows</span>
              <select
                className="analytics-select h-9 w-full"
                value={String(questionPageSize)}
                onChange={(event) => setQuestionPageSize(Number(event.target.value))}
              >
                {QUESTION_PAGE_SIZE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {getPageSizeLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="analytics-toolbar-actions">
            <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
              Page {safeQuestionPage} of {questionTotalPages}
            </span>
            <button
              type="button"
              onClick={() => setQuestionPage((current) => Math.max(current - 1, 1))}
              disabled={safeQuestionPage <= 1}
              className="app-button-secondary h-9 px-3"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setQuestionPage((current) => Math.min(current + 1, questionTotalPages))}
              disabled={safeQuestionPage >= questionTotalPages}
              className="app-button-secondary h-9 px-3"
            >
              Next
            </button>
          </div>
        </div>
        {displayedQuestionRows.length === 0 ? (
          <div className="app-empty-state mt-4">{questionEmptyState}</div>
        ) : (
          <div className="analytics-table-wrap mt-4">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="analytics-th-center">Q No</th>
                  <th className="analytics-th">Question</th>
                  <th className="analytics-th-center">Marks</th>
                  {focusCohort ? (
                    <>
                      <th className="analytics-th-center">Section accuracy</th>
                      <th className="analytics-th-center">Gap</th>
                      <th className="analytics-th-center">Section skip</th>
                      <th className="analytics-th-center">Class accuracy</th>
                      <th className="analytics-th-center">Class skip</th>
                    </>
                  ) : (
                    <>
                      <th className="analytics-th-center">Class accuracy</th>
                      <th className="analytics-th-center">Class skip</th>
                      <th className="analytics-th-center">Sections below baseline</th>
                      <th className="analytics-th">Lowest section(s)</th>
                      <th className="analytics-th-center">Worst gap</th>
                      <th className="analytics-th-center">Peak skip</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayedQuestionRows.map((row: any) => (
                  <tr key={row.key} className="analytics-row align-top">
                    <td className="analytics-td-center">
                      {row.questionId ? (
                        <Link
                          href={getQuestionHref(row.questionId)}
                          className="inline-flex rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs font-medium text-primary shadow-sm transition-colors hover:bg-primary/10"
                        >
                          {Number.isFinite(Number(row.questionNumber))
                            ? `Q${Number(row.questionNumber)}`
                            : 'View'}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="analytics-td">
                      <div className="font-medium text-foreground">{compactText(row.questionLabel)}</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground line-clamp-3">
                        {row.previewText}
                      </div>
                    </td>
                    <td className="analytics-td-center font-medium text-foreground">
                      {Number(row.marks || 0).toFixed(2)}
                    </td>
                    {focusCohort ? (
                      <>
                        <td className="analytics-td-center font-medium text-foreground">
                          {formatPercent(row.focus?.metrics?.accuracyPct)}
                        </td>
                        <td className={`analytics-td-center font-medium ${getToneClass(row.focus?.gap?.accuracyPct, true)}`}>
                          {formatSignedPercent(row.focus?.gap?.accuracyPct)}
                        </td>
                        <td className="analytics-td-center font-medium text-foreground">
                          {formatPercent(row.focus?.metrics?.unattemptedPct)}
                        </td>
                        <td className="analytics-td-center font-medium text-foreground">
                          {formatPercent(row.baseline?.accuracyPct)}
                        </td>
                        <td className="analytics-td-center font-medium text-foreground">
                          {formatPercent(row.baseline?.unattemptedPct)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="analytics-td-center font-medium text-foreground">
                          {formatPercent(row.baseline?.accuracyPct)}
                        </td>
                        <td className="analytics-td-center font-medium text-foreground">
                          {formatPercent(row.baseline?.unattemptedPct)}
                        </td>
                        <td className="analytics-td-center font-medium text-foreground">
                          {row.affectedSectionsCount} / {sortedCohorts.length}
                        </td>
                        <td className="analytics-td">
                          <LowestSectionsCell row={row} />
                        </td>
                        <td className={`analytics-td-center font-medium ${getToneClass(row.worstGapSection?.gap?.accuracyPct, true)}`}>
                          {formatSignedPercent(row.worstGapSection?.gap?.accuracyPct)}
                        </td>
                        <td className="analytics-td-center font-medium text-foreground">
                          {formatPercent(row.peakSkipSection?.metrics?.unattemptedPct)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sectionRankingBlock}

      <div className="analytics-card analytics-card-body">
        <div className="analytics-toolbar-row gap-4">
          <div className="analytics-toolbar-copy">
            <h2 className="analytics-card-title">Tag Benchmark Matrix</h2>
          </div>
          <div className="analytics-toolbar-meta">
            <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
              {getRangeLabel(rankedTagRows.length, safeTagPage, tagPageSize)}
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="analytics-toolbar-actions flex-wrap">
            <label className="app-field-group min-w-[140px]">
              <span className="app-field-label">Rows</span>
              <select
                className="analytics-select h-9 w-full"
                value={String(tagPageSize)}
                onChange={(event) => setTagPageSize(Number(event.target.value))}
              >
                {TAG_PAGE_SIZE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {getPageSizeLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="analytics-toolbar-actions">
            <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
              Page {safeTagPage} of {tagTotalPages}
            </span>
            <button
              type="button"
              onClick={() => setTagPage((current) => Math.max(current - 1, 1))}
              disabled={safeTagPage <= 1}
              className="app-button-secondary h-9 px-3"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setTagPage((current) => Math.min(current + 1, tagTotalPages))}
              disabled={safeTagPage >= tagTotalPages}
              className="app-button-secondary h-9 px-3"
            >
              Next
            </button>
          </div>
        </div>
        {displayedTagRows.length === 0 ? (
          <div className="app-empty-state mt-4">
            No grouped benchmark data found for the selected filters.
          </div>
        ) : (
          <div className="analytics-table-wrap mt-4">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="analytics-th">Bucket</th>
                  <th className="analytics-th">Q Nos</th>
                  <th className="analytics-th-center">Questions</th>
                  <th className="analytics-th-center">Class accuracy</th>
                  {sortedCohorts.map((cohort: any) => (
                    <th key={cohort.academicSectionId} className="analytics-th-center">
                      {cohort.academicSectionName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedTagRows.map((row: any) => (
                  <tr key={row.key} className="analytics-row align-top">
                    <td className="analytics-td">
                      <div className="font-medium text-foreground">{compactText(row.label)}</div>
                    </td>
                    <td className="analytics-td">
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(row.questions) && row.questions.length > 0 ? (
                          row.questions.map((question: any) => (
                            <Link
                              key={`${row.key}-${question.id}`}
                              href={getQuestionHref(question.id)}
                              className="inline-flex rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs font-medium text-primary shadow-sm transition-colors hover:bg-primary/10"
                              title={String(question?.section || "")}
                            >
                              {getQuestionChipLabel(question, row.questions)}
                            </Link>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="analytics-td-center font-medium text-foreground">
                      {Array.isArray(row.questions) ? row.questions.length : 0}
                    </td>
                    <td className="analytics-td-center">
                      <div className="font-medium text-foreground">
                        {formatPercent(row.baseline?.accuracyPct)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatPercent(row.baseline?.avgScorePct)} score
                      </div>
                    </td>
                    {sortedCohorts.map((cohort: any) => {
                      const cohortCell = Array.isArray(row.cohorts)
                        ? row.cohorts.find(
                            (candidate: any) =>
                              String(candidate?.academicSectionId || "") ===
                              String(cohort?.academicSectionId || ""),
                          )
                        : null;
                      return (
                        <td key={`${row.key}-${cohort.academicSectionId}`} className="analytics-td-center">
                          <div className="font-medium text-foreground">
                            {formatPercent(cohortCell?.metrics?.accuracyPct)}
                          </div>
                          <div className={`text-xs ${getToneClass(cohortCell?.gap?.accuracyPct, true)}`}>
                            {formatSignedPercent(cohortCell?.gap?.accuracyPct)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="analytics-card analytics-card-body">
        <div className="analytics-toolbar-row gap-4">
          <div className="analytics-toolbar-copy">
            <h2 className="analytics-card-title">Distractor Hotspots</h2>
          </div>
          <div className="analytics-toolbar-meta">
            <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
              {getRangeLabel(
                processedDistractors.length,
                safeDistractorPage,
                distractorPageSize,
              )}
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="analytics-toolbar-actions flex-wrap">
            <label className="app-field-group min-w-[140px]">
              <span className="app-field-label">Min selected %</span>
              <select
                className="analytics-select h-9 w-full"
                value={String(minDistractorPct)}
                onChange={(event) => updateBenchmarkViewSettings({ minDistractorPct: Number(event.target.value) })}
              >
                {DISTRACTOR_PCT_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value === 0 ? "0% (All)" : `${value}%`}
                  </option>
                ))}
              </select>
            </label>
            <label className="app-field-group min-w-[140px]">
              <span className="app-field-label">Min count</span>
              <select
                className="analytics-select h-9 w-full"
                value={String(minDistractorCount)}
                onChange={(event) => updateBenchmarkViewSettings({ minDistractorCount: Number(event.target.value) })}
              >
                {DISTRACTOR_COUNT_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="app-field-group min-w-[180px]">
              <span className="app-field-label">Sort by</span>
              <select
                className="analytics-select h-9 w-full"
                value={distractorSortBy}
                onChange={(event) =>
                  updateBenchmarkViewSettings({
                    distractorSortBy: event.target.value as BenchmarkDistractorSortBy,
                  })
                }
              >
                <option value="peak_selected">Highest selected %</option>
                <option value="peak_gap">Highest gap</option>
                <option value="sections_affected">Most sections affected</option>
              </select>
            </label>
            <label className="app-field-group min-w-[140px]">
              <span className="app-field-label">Rows</span>
              <select
                className="analytics-select h-9 w-full"
                value={String(distractorPageSize)}
                onChange={(event) => setDistractorPageSize(Number(event.target.value))}
              >
                {DISTRACTOR_PAGE_SIZE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {getPageSizeLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="analytics-toolbar-actions">
            <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
              Page {safeDistractorPage} of {distractorTotalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setDistractorPage((current) => Math.max(current - 1, 1))
              }
              disabled={safeDistractorPage <= 1}
              className="app-button-secondary h-9 px-3"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() =>
                setDistractorPage((current) =>
                  Math.min(current + 1, distractorTotalPages),
                )
              }
              disabled={safeDistractorPage >= distractorTotalPages}
              className="app-button-secondary h-9 px-3"
            >
              Next
            </button>
          </div>
        </div>
        {displayedDistractors.length === 0 ? (
          <div className="app-empty-state mt-4">
            No distractor rows match the current threshold.
          </div>
        ) : (
          <div className="analytics-table-wrap mt-4">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30">
                {focusCohort ? (
                  <tr>
                    <th className="analytics-th-center">Q No</th>
                    <th className="analytics-th">Question</th>
                    <th className="analytics-th">Option</th>
                    <th className="analytics-th-center">Class selected</th>
                    <th className="analytics-th-center">Section selected</th>
                    <th className="analytics-th-center">Gap</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="analytics-th-center">Q No</th>
                    <th className="analytics-th">Question</th>
                    <th className="analytics-th">Option</th>
                    <th className="analytics-th-center">Class selected</th>
                    <th className="analytics-th-center">Sections affected</th>
                    <th className="analytics-th">Most affected section(s)</th>
                    <th className="analytics-th-center">Peak selected</th>
                    <th className="analytics-th">Section breakdown</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {displayedDistractors.map((row: any) => (
                  <tr key={row.key} className="analytics-row align-top">
                    <td className="analytics-td-center">
                      {row.questionId ? (
                        <Link
                          href={getQuestionHref(row.questionId)}
                          className="inline-flex rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs font-medium text-primary shadow-sm transition-colors hover:bg-primary/10"
                        >
                          {Number.isFinite(Number(row.questionNumber))
                            ? `Q${Number(row.questionNumber)}`
                            : "View"}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="analytics-td">
                      <div className="font-medium text-foreground">
                        {compactText(row.questionLabel)}
                      </div>
                      {Array.isArray(row.optionTags) && row.optionTags.length > 0 ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {row.optionTags
                            .map((tag: any) => `${tag.type}: ${tag.value}`)
                            .join(" • ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="analytics-td">
                      <div className="font-medium text-foreground">{row.optionLabel}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {compactText(row.optionText, "No option text")}
                      </div>
                    </td>
                    <td className="analytics-td-center font-medium text-foreground">
                      {formatPercent(row.baseline?.selectedPct)}
                    </td>
                    {focusCohort ? (
                      <>
                        <td className="analytics-td-center font-medium text-foreground">
                          {formatPercent(row.focus?.metrics?.selectedPct)}
                        </td>
                        <td className={`analytics-td-center font-medium ${getToneClass(row.focus?.gapSelectedPct, false)}`}>
                          {formatSignedPercent(row.focus?.gapSelectedPct)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="analytics-td-center font-medium text-foreground">
                          {row.affectedSectionsCount} / {sortedCohorts.length}
                        </td>
                        <td className="analytics-td">
                          <MostAffectedSectionsCell row={row} />
                        </td>
                        <td className="analytics-td-center font-medium text-foreground">
                          {formatPercent(row.peakSection?.metrics?.selectedPct)}
                        </td>
                        <td className="analytics-td">
                          <div className="flex flex-wrap gap-2">
                            {row.visibleSections.map((cohort: any) => (
                              <span
                                key={`${row.key}-${cohort.academicSectionId}`}
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getBadgeTone(cohort?.gapSelectedPct, true)}`}
                              >
                                {compactText(cohort.academicSectionName)} {formatPercent(cohort.metrics?.selectedPct)}
                              </span>
                            ))}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {insights.length > 0 ? (
        <div className="analytics-card analytics-card-body border-l-4 border-primary/60">
          <div className="analytics-toolbar-row gap-4">
            <div className="analytics-toolbar-copy">
              <h2 className="analytics-card-title">Benchmark Insights</h2>
            </div>
            <div className="analytics-toolbar-meta">
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                {insightScopeLabel}
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="analytics-toolbar-actions">
              <label className="analytics-checkbox-card">
                <input
                  type="checkbox"
                  className="analytics-inline-check"
                  checked={insightsShowAll}
                  onChange={() => {
                    setInsightsShowAll((value) => !value);
                    setInsightsPage(1);
                    setInsightsPageSize((current) => (current === -1 ? 6 : current));
                  }}
                />
                <span>Show all insights</span>
              </label>
              {!insightsShowAll && insights.length > 0 ? (
                <label className="analytics-checkbox-card">
                  <span className="text-muted-foreground">Cards per page</span>
                  <select
                    className="analytics-select h-8"
                    value={String(insightsPageSize)}
                    onChange={(event) => {
                      setInsightsPageSize(Number(event.target.value));
                      setInsightsPage(1);
                    }}
                  >
                    {[4, 6, 10, 20, -1].map((count) => (
                      <option key={count} value={count}>
                        {getPageSizeLabel(count)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <div className="analytics-toolbar-actions">
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                {insightsShowAll
                  ? `Showing all ${insights.length}`
                  : getRangeLabel(insights.length, safeInsightsPage, insightsPageSize)}
              </span>
              {!insightsShowAll && insights.length > insightsPageSize && insightsPageSize !== -1 ? (
                <>
                  <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                    Page {safeInsightsPage} of {insightTotalPages}
                  </span>
                  <button
                    type="button"
                    className="analytics-pagination-button"
                    onClick={() => setInsightsPage((page) => Math.max(1, page - 1))}
                    disabled={safeInsightsPage <= 1}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="analytics-pagination-button"
                    onClick={() => setInsightsPage((page) => Math.min(insightTotalPages, page + 1))}
                    disabled={safeInsightsPage >= insightTotalPages}
                  >
                    Next
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {(insightsShowAll ? insights : displayedInsights).map((insight: any, index: number) => (
              <div
                key={`${insight.type}-${index}`}
                className="rounded-xl border border-border/60 bg-background p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {compactText(insight.title)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {compactText(insight.description)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getSeverityBadgeClass(
                      insight.severity,
                    )}`}
                  >
                    {compactText(insight.severity)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
