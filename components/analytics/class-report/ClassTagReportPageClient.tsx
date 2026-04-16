"use client";

import React, { useEffect, useState, useRef } from "react";
import LoadingState from "@/components/analytics/LoadingState";
import ErrorState from "@/components/analytics/ErrorState";
import OptionTagsDisplay from "@/components/analytics/OptionTagsDisplay";
import ReportHeader from "@/components/analytics/ReportHeader";
import StatsTable from "@/components/analytics/StatsTable";
import FailInsightsCard from "@/components/analytics/insights/FailInsightsCard";
import {
  AnalyticsChartView,
  AnalyticsClassBenchmarkPanel,
  AnalyticsClassTagReportSetupControls,
  AnalyticsExportControls,
  AnalyticsOptionTagModal,
  AnalyticsQuestionListModal,
} from "@/components/analytics/report-client-lazy";
import {
  computeInsightsForLastTag,
  flattenStatsRows,
} from "@/components/analytics/helpers";
import { Button } from "@/components/ui/button";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { ArrowLeft } from "lucide-react";
import {
  DEFAULT_BENCHMARK_VIEW_SETTINGS,
  type BenchmarkViewSettings,
} from "@/lib/analytics/benchmarkPresentation";
import { reconcileAnalyticsGroupBy } from "@/lib/analytics/group-by";
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";

const REPORT_CACHE_TTL_MS = 15_000;
const REPORT_SETUP_CACHE_TTL_MS = 60_000;

type ReportFilterOption = {
  value: string;
  label: string;
};

type SelectedTag = {
  type: string;
  value: string;
};

type ClassTagReportPageClientProps = {
  paperId: string;
  initialGroupFields?: { value: string; label: string }[];
  initialClassOptions?: ReportFilterOption[];
  initialAcademicSectionOptions?: ReportFilterOption[];
  initialSubjectOptions?: ReportFilterOption[];
  initialGroupBy?: string[];
  initialSelectedClassId?: string;
  initialSelectedAcademicSectionId?: string;
  initialSelectedSubjectId?: string;
  initialStats?: any;
  initialPaperTitle?: string;
  initialLoadError?: string | null;
};

function isSameSelectedTag(left: SelectedTag, right: SelectedTag): boolean {
  return left.type === right.type && left.value === right.value;
}

function toggleSelectedTagList(
  current: SelectedTag[],
  nextTag: SelectedTag,
): SelectedTag[] {
  return current.some((tag) => isSameSelectedTag(tag, nextTag))
    ? current.filter((tag) => !isSameSelectedTag(tag, nextTag))
    : [...current, nextTag];
}

function reconcileGroupBy(
  current: string[],
  fields: { value: string; label: string }[],
  options?: {
    requiredFieldValues?: string[];
  },
) {
  return reconcileAnalyticsGroupBy(current, fields, options);
}

function AnalyticsMobileMetricButton({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "warning";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-700"
      : tone === "danger"
        ? "border-rose-200/80 bg-rose-50/80 text-rose-700"
        : "border-amber-200/80 bg-amber-50/80 text-amber-700";

  const content = (
    <>
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
        {label}
      </span>
      <span className="mt-1 text-base font-semibold leading-none">{value}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex min-h-[4.25rem] w-full flex-col items-start justify-center rounded-[0.95rem] border px-3 py-2 text-left transition hover:-translate-y-px hover:shadow-sm ${toneClass}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={`flex min-h-[4.25rem] w-full flex-col items-start justify-center rounded-[0.95rem] border px-3 py-2 text-left ${toneClass}`}
    >
      {content}
    </div>
  );
}

export default function ClassTagReportPageClient({
  paperId,
  initialGroupFields = [],
  initialClassOptions = [],
  initialAcademicSectionOptions = [],
  initialSubjectOptions = [],
  initialGroupBy = [],
  initialSelectedClassId = "all",
  initialSelectedAcademicSectionId = "all",
  initialSelectedSubjectId = "all",
  initialStats = {},
  initialPaperTitle = "",
  initialLoadError = null,
}: ClassTagReportPageClientProps) {
  const { navigateBack } = useBackNavigation("/workspace/question-papers");
  const hasInitialReportData =
    Boolean(initialPaperTitle) ||
    (initialStats &&
      typeof initialStats === "object" &&
      Object.keys(initialStats).length > 0);
  const [stats, setStats] = useState<any>(initialStats || {});
  const [paper, setPaper] = useState<string>(initialPaperTitle || "");
  const [loading, setLoading] = useState(
    () => !hasInitialReportData && !initialLoadError,
  );
  const [error, setError] = useState<string | null>(initialLoadError);

  const [groupFields, setGroupFields] = useState<
    { value: string; label: string }[]
  >(initialGroupFields);
  const [classOptions, setClassOptions] = useState<ReportFilterOption[]>(
    initialClassOptions,
  );
  const [academicSectionOptions, setAcademicSectionOptions] = useState<
    ReportFilterOption[]
  >(initialAcademicSectionOptions);
  const [subjectOptions, setSubjectOptions] = useState<ReportFilterOption[]>(
    initialSubjectOptions,
  );
  const [groupBy, setGroupBy] = useState<string[]>(initialGroupBy);
  const [selectedClassId, setSelectedClassId] = useState(
    initialSelectedClassId,
  );
  const [selectedAcademicSectionId, setSelectedAcademicSectionId] = useState(
    initialSelectedAcademicSectionId,
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    initialSelectedSubjectId,
  );
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "", direction: "desc" });
  const [showTagsColumn, setShowTagsColumn] = useState<boolean>(false);
  const [showOptionTagsColumn, setShowOptionTagsColumn] =
    useState<boolean>(false);
  const [view, setView] = useState<"table" | "charts" | "benchmark">(
    "table",
  );
  const [shouldMountExportControls, setShouldMountExportControls] =
    useState(false);
  const [hasOpenedQuestionModal, setHasOpenedQuestionModal] = useState(false);
  const [hasOpenedOptionTagModal, setHasOpenedOptionTagModal] = useState(false);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(
    () => Boolean(hasInitialReportData || initialLoadError),
  );
  const [showControls, setShowControls] = useState(false);
  const [benchmarkData, setBenchmarkData] = useState<any>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [benchmarkViewSettings, setBenchmarkViewSettings] =
    useState<BenchmarkViewSettings>(DEFAULT_BENCHMARK_VIEW_SETTINGS);

  const [modalData, setModalData] = useState<{
    isOpen: boolean;
    title: string;
    questionIds: any[];
    groupNode?: any; // <-- add this line
  }>({
    isOpen: false,
    title: "",
    questionIds: [],
    groupNode: undefined, // <-- add this line
  });

  const [optionTagModal, setOptionTagModal] = useState<{
    isOpen: boolean;
    option: string;
    tag: string;
    isCorrect: boolean;
    students: { name: string; rollNumber: string }[];
  } | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);

  // Derived insights for last selected tag
  const insights = React.useMemo(
    () =>
      stats && Array.isArray(groupBy) && groupBy.length
        ? computeInsightsForLastTag(stats, groupBy, groupFields)
        : [],
    [stats, groupBy, groupFields],
  );

  const lastLabel = React.useMemo(() => {
    if (!Array.isArray(groupBy) || groupBy.length === 0) return "Tag";
    const last = groupBy[groupBy.length - 1];
    return groupFields.find((f) => f.value === last)?.label || last || "Tag";
  }, [groupBy, groupFields]);

  const selectedGroupLabels = React.useMemo(
    () =>
      groupBy
        .map(
          (value) =>
            groupFields.find((field) => field.value === value)?.label || value,
        )
        .filter(Boolean),
    [groupBy, groupFields],
  );

  const activeSortLabel = React.useMemo(() => {
    if (!sortConfig.key) return "Default row order";
    const metric =
      sortConfig.key.charAt(0).toUpperCase() + sortConfig.key.slice(1);
    return `${metric} • ${sortConfig.direction === "asc" ? "Low to high" : "High to low"}`;
  }, [sortConfig]);

  const groupingPreviewLabel =
    selectedGroupLabels.length > 0
      ? selectedGroupLabels.join(" → ")
      : "Choose grouping order";

  const visibleColumnsLabel =
    [
      showTagsColumn ? "Tags" : null,
      showOptionTagsColumn ? "Option tags" : null,
    ]
      .filter(Boolean)
      .join(" • ") || "Core metrics only";

  const activeViewLabel =
    view === "table" ? "Table" : view === "charts" ? "Charts" : "Benchmark";
  const hasStatsData =
    stats && typeof stats === "object" && Object.keys(stats).length > 0;
  const mobileStatsRows = React.useMemo(
    () => flattenStatsRows(stats, groupBy, sortConfig),
    [groupBy, sortConfig, stats],
  );

  const hasActiveFilters =
    selectedClassId !== "all" ||
    selectedAcademicSectionId !== "all" ||
    selectedSubjectId !== "all";
  const searchableClassOptions = React.useMemo(
    () => [
      {
        value: "all",
        label: "All classes",
        description: "Review the report across every question class.",
      },
      ...classOptions,
    ],
    [classOptions],
  );
  const searchableAcademicSectionOptions = React.useMemo(
    () => [
      {
        value: "all",
        label: "All class sections",
        description: "Review all academic sections together.",
      },
      ...academicSectionOptions,
    ],
    [academicSectionOptions],
  );
  const searchableSubjectOptions = React.useMemo(
    () => [
      {
        value: "all",
        label: "All subjects",
        description: "Keep the class report scoped to every subject.",
      },
      ...subjectOptions,
    ],
    [subjectOptions],
  );

  const activeClassLabel =
    selectedClassId !== "all"
      ? classOptions.find((option) => option.value === selectedClassId)?.label ||
        "Filtered class"
      : "All classes";

  const activeAcademicSectionLabel =
    selectedAcademicSectionId !== "all"
      ? academicSectionOptions.find(
          (option) => option.value === selectedAcademicSectionId,
        )?.label || "Filtered section"
      : "All class sections";

  const activeSubjectLabel =
    selectedSubjectId !== "all"
      ? subjectOptions.find((option) => option.value === selectedSubjectId)
          ?.label || "Filtered subject"
      : "All subjects";

  const activeFiltersLabel =
    [
      selectedClassId !== "all" ? `Class: ${activeClassLabel}` : null,
      selectedAcademicSectionId !== "all"
        ? `Section: ${activeAcademicSectionLabel}`
        : null,
      selectedSubjectId !== "all" ? `Subject: ${activeSubjectLabel}` : null,
    ]
      .filter(Boolean)
      .join(" • ") || "All questions and sections";

  const headerSummaryBadges = [groupingPreviewLabel, activeFiltersLabel];
  const outputTitle =
    view === "table"
      ? "Grouped Analytics"
      : view === "charts"
        ? "Chart View"
        : "Benchmark View";
  const outputNote =
    view === "table"
      ? "Switch views, keep sort context visible, and export the current report from one place."
      : view === "charts"
        ? "Scan the same grouped data visually without leaving the report."
        : "Review benchmark comparisons and distractor signals for the current scope.";
  const outputMetaLabel =
    view === "table" ? activeSortLabel : groupingPreviewLabel;

  // Explicit school handling
  const [schoolKey, setSchoolKey] = useState<string>(() =>
    resolveClientSchoolKey(),
  );

  const loadReportSetup = React.useCallback(
    async (overrides?: {
      schoolKey?: string;
      classId?: string;
      subjectId?: string;
    }) => {
      const resolvedSchoolKey =
        overrides?.schoolKey || schoolKey || resolveClientSchoolKey();

      if (!resolvedSchoolKey) {
        throw new Error("Please select a school in the navbar to load analytics.");
      }

      const searchParams = new URLSearchParams();
      searchParams.set("groupFields", "1");
      const resolvedClassId = overrides?.classId ?? selectedClassId;
      const resolvedSubjectId = overrides?.subjectId ?? selectedSubjectId;
      if (resolvedClassId && resolvedClassId !== "all") {
        searchParams.set("classId", resolvedClassId);
      }
      if (resolvedSubjectId && resolvedSubjectId !== "all") {
        searchParams.set("subjectId", resolvedSubjectId);
      }

      const data = await fetchApiJson<any>(
        `/api/analytics/class-tag-report/${paperId}?${searchParams.toString()}`,
        {
          cache: "no-store",
          schoolKey: resolvedSchoolKey,
          fallbackMessage: "Failed to load report setup.",
          clientCacheTtlMs: REPORT_SETUP_CACHE_TTL_MS,
          preferClientCache: true,
        },
      );

      const nextFields = Array.isArray(data?.fields) ? data.fields : [];
      const nextClassOptions = Array.isArray(data?.filters?.classes)
        ? data.filters.classes
        : [];
      const nextAcademicSections = Array.isArray(data?.filters?.academicSections)
        ? data.filters.academicSections
        : [];
      const nextSubjects = Array.isArray(data?.filters?.subjects)
        ? data.filters.subjects
        : [];

      if (nextFields.length === 0) {
        throw new Error("No analytics fields are available for this paper yet.");
      }

      const baseGroupBy =
        resolvedSubjectId === "all" && nextSubjects.length > 1 ? [] : groupBy;
      const nextGroupBy = reconcileGroupBy(baseGroupBy, nextFields, {
        requiredFieldValues:
          resolvedSubjectId === "all" && nextSubjects.length > 1
            ? ["subject"]
            : [],
      });
      setGroupFields(nextFields);
      setClassOptions(nextClassOptions);
      setAcademicSectionOptions(nextAcademicSections);
      setSubjectOptions(nextSubjects);
      setSelectedClassId((currentValue) =>
        currentValue !== "all" &&
        !nextClassOptions.some(
          (option: ReportFilterOption) => option.value === currentValue,
        )
          ? "all"
          : currentValue,
      );
      setSelectedAcademicSectionId((currentValue) =>
        currentValue !== "all" &&
        !nextAcademicSections.some(
          (option: ReportFilterOption) => option.value === currentValue,
        )
          ? "all"
          : currentValue,
      );
      setSelectedSubjectId((currentValue) =>
        currentValue !== "all" &&
        !nextSubjects.some(
          (option: ReportFilterOption) => option.value === currentValue,
        )
          ? "all"
          : currentValue,
      );
      setGroupBy(nextGroupBy);

      return {
        nextGroupBy,
      };
    },
    [groupBy, paperId, schoolKey, selectedClassId, selectedSubjectId],
  );

  useEffect(() => {
    const sk = resolveClientSchoolKey();
    setSchoolKey(sk);
    if (!sk) {
      setLoading(false);
      setError("Please select a school in the navbar to load analytics.");
      return;
    }

    if (initialGroupFields.length > 0) {
      return;
    }

    void (async () => {
      try {
        const searchParams = new URLSearchParams();
        searchParams.set("groupFields", "1");
        if (initialSelectedClassId && initialSelectedClassId !== "all") {
          searchParams.set("classId", initialSelectedClassId);
        }
        if (
          initialSelectedSubjectId &&
          initialSelectedSubjectId !== "all"
        ) {
          searchParams.set("subjectId", initialSelectedSubjectId);
        }

        const data = await fetchApiJson<any>(
          `/api/analytics/class-tag-report/${paperId}?${searchParams.toString()}`,
          {
            cache: "no-store",
            schoolKey: sk,
            fallbackMessage: "Failed to load report setup.",
            clientCacheTtlMs: REPORT_SETUP_CACHE_TTL_MS,
            preferClientCache: true,
          },
        );

        const nextFields = Array.isArray(data?.fields) ? data.fields : [];
        const nextClassOptions = Array.isArray(data?.filters?.classes)
          ? data.filters.classes
          : [];
        const nextAcademicSections = Array.isArray(
          data?.filters?.academicSections,
        )
          ? data.filters.academicSections
          : [];
        const nextSubjects = Array.isArray(data?.filters?.subjects)
          ? data.filters.subjects
          : [];

        if (nextFields.length === 0) {
          throw new Error("No analytics fields are available for this paper yet.");
        }

        setGroupFields(nextFields);
        setClassOptions(nextClassOptions);
        setAcademicSectionOptions(nextAcademicSections);
        setSubjectOptions(nextSubjects);
        setSelectedClassId(
          initialSelectedClassId !== "all" &&
            nextClassOptions.some(
              (option: ReportFilterOption) =>
                option.value === initialSelectedClassId,
            )
            ? initialSelectedClassId
            : "all",
        );
        setSelectedAcademicSectionId(
          initialSelectedAcademicSectionId !== "all" &&
            nextAcademicSections.some(
              (option: ReportFilterOption) =>
                option.value === initialSelectedAcademicSectionId,
            )
            ? initialSelectedAcademicSectionId
            : "all",
        );
        setSelectedSubjectId(
          initialSelectedSubjectId !== "all" &&
            nextSubjects.some(
              (option: ReportFilterOption) =>
                option.value === initialSelectedSubjectId,
            )
            ? initialSelectedSubjectId
            : "all",
        );
        setGroupBy(
          reconcileGroupBy(initialGroupBy, nextFields, {
            requiredFieldValues:
              initialSelectedSubjectId === "all" && nextSubjects.length > 1
                ? ["subject"]
                : [],
          }),
        );
      } catch (setupError: any) {
        setLoading(false);
        setError(setupError?.message || "Failed to load report setup.");
      }
    })();
  }, [
    initialGroupBy,
    initialGroupFields.length,
    initialSelectedClassId,
    initialSelectedAcademicSectionId,
    initialSelectedSubjectId,
    paperId,
  ]);

  const handleOpenModal = (
    title: string,
    questionIds: any[],
    groupNode?: any,
  ) => {
    setHasOpenedQuestionModal(true);
    setModalData({ isOpen: true, title, questionIds, groupNode });
  };

  const handleCloseModal = () =>
    setModalData({
      isOpen: false,
      title: "",
      questionIds: [],
      groupNode: undefined,
    });

  const handleOptionTagClick = (
    option: string,
    tag: string,
    isCorrect: boolean,
    students: { name: string; rollNumber: string }[],
  ) => {
    setHasOpenedOptionTagModal(true);
    setOptionTagModal({ isOpen: true, option, tag, isCorrect, students });
  };

  const handleCloseOptionTagModal = () => setOptionTagModal(null);

  const fetchBenchmark = React.useCallback(
    async (overrides?: {
      classId?: string;
      academicSectionId?: string;
      subjectId?: string;
      tags?: SelectedTag[];
      groupBy?: string[];
    }) => {
      const resolvedClassId = overrides?.classId ?? selectedClassId;
      const resolvedAcademicSectionId =
        overrides?.academicSectionId ?? selectedAcademicSectionId;
      const resolvedSubjectId = overrides?.subjectId ?? selectedSubjectId;
      const resolvedTags = overrides?.tags ?? selectedTags;
      const resolvedGroupBy = overrides?.groupBy ?? groupBy;
      const normalizedGroupBy = reconcileGroupBy(resolvedGroupBy, groupFields, {
        requiredFieldValues:
          resolvedSubjectId === "all" && subjectOptions.length > 1
            ? ["subject"]
            : [],
      });
      const sk = schoolKey || resolveClientSchoolKey();

      if (!sk) {
        setBenchmarkData(null);
        setBenchmarkLoading(false);
        setBenchmarkError(
          "Please select a school in the navbar to load analytics.",
        );
        return;
      }

      const searchParams = new URLSearchParams();
      searchParams.set("baseline", "class_average");
      if (normalizedGroupBy.length) {
        searchParams.set("groupBy", normalizedGroupBy.join(","));
      }
      if (resolvedClassId !== "all") {
        searchParams.set("classId", resolvedClassId);
      }
      if (resolvedAcademicSectionId !== "all") {
        searchParams.set("academicSectionId", resolvedAcademicSectionId);
      }
      if (resolvedSubjectId !== "all") {
        searchParams.set("subjectId", resolvedSubjectId);
      }
      resolvedTags.forEach((tag) => {
        searchParams.append("tag", `${tag.type}:${tag.value}`);
      });

      setBenchmarkLoading(true);
      setBenchmarkError(null);
      setBenchmarkData(null);
      if (normalizedGroupBy.join(",") !== resolvedGroupBy.join(",")) {
        setGroupBy(normalizedGroupBy);
      }

      try {
        const data = await fetchApiJson<any>(
          `/api/analytics/benchmark-report/${paperId}?${searchParams.toString()}`,
          {
            cache: "no-store",
            schoolKey: sk,
            fallbackMessage: "Failed to load benchmark report.",
            clientCacheTtlMs: REPORT_CACHE_TTL_MS,
            preferClientCache: true,
          },
        );
        setBenchmarkData(data);
      } catch (benchmarkFetchError: any) {
        setBenchmarkError(
          benchmarkFetchError?.message ||
            "An unexpected network error occurred while loading benchmark data.",
        );
      } finally {
        setBenchmarkLoading(false);
      }
    },
    [
      groupBy,
      groupFields,
      paperId,
      schoolKey,
      selectedClassId,
      selectedAcademicSectionId,
      selectedSubjectId,
      subjectOptions.length,
      selectedTags,
    ],
  );

  const fetchAnalytics = React.useCallback(
    async (overrides?: {
      classId?: string;
      academicSectionId?: string;
      subjectId?: string;
      groupBy?: string[];
      tags?: SelectedTag[];
    }) => {
      setLoading(true);
      setError(null);
      const resolvedClassId = overrides?.classId ?? selectedClassId;
      const resolvedAcademicSectionId =
        overrides?.academicSectionId ?? selectedAcademicSectionId;
      const resolvedSubjectId = overrides?.subjectId ?? selectedSubjectId;
      const resolvedGroupBy = overrides?.groupBy ?? groupBy;
      const resolvedTags = overrides?.tags ?? selectedTags;
      const normalizedGroupBy = reconcileGroupBy(resolvedGroupBy, groupFields, {
        requiredFieldValues:
          resolvedSubjectId === "all" && subjectOptions.length > 1
            ? ["subject"]
            : [],
      });
      const searchParams = new URLSearchParams();
      searchParams.set("json", "1");
      if (normalizedGroupBy.length) {
        searchParams.set("groupBy", normalizedGroupBy.join(","));
      }
      if (resolvedClassId !== "all") {
        searchParams.set("classId", resolvedClassId);
      }
      if (resolvedAcademicSectionId !== "all") {
        searchParams.set("academicSectionId", resolvedAcademicSectionId);
      }
      if (resolvedSubjectId !== "all") {
        searchParams.set("subjectId", resolvedSubjectId);
      }
      resolvedTags.forEach((tag) => {
        searchParams.append("tag", `${tag.type}:${tag.value}`);
      });
      const sk = schoolKey || resolveClientSchoolKey();
      if (!sk) {
        setLoading(false);
        setError("Please select a school in the navbar to load analytics.");
        return;
      }

      if (normalizedGroupBy.join(",") !== resolvedGroupBy.join(",")) {
        setGroupBy(normalizedGroupBy);
      }

      try {
        const data = await fetchApiJson<any>(
          `/api/analytics/class-tag-report/${paperId}?${searchParams.toString()}`,
          {
            cache: "no-store",
            schoolKey: sk,
            fallbackMessage: "Failed to fetch tag report.",
            clientCacheTtlMs: REPORT_CACHE_TTL_MS,
            preferClientCache: true,
          },
        );

        setStats(data.stats || {});
        setPaper(data.paper || "");
        setBenchmarkData(null);
        setBenchmarkError(null);
        if (view === "benchmark") {
          void fetchBenchmark({
            classId: resolvedClassId,
            academicSectionId: resolvedAcademicSectionId,
            subjectId: resolvedSubjectId,
            tags: resolvedTags,
            groupBy: normalizedGroupBy,
          });
        }
      } catch (fetchError: any) {
        setError(fetchError?.message || "An unexpected network error occurred.");
      } finally {
        setLoading(false);
      }
    },
    [
      fetchBenchmark,
      groupBy,
      groupFields,
      paperId,
      schoolKey,
      selectedClassId,
      selectedAcademicSectionId,
      selectedSubjectId,
      selectedTags,
      subjectOptions.length,
      view,
    ],
  );

  useEffect(() => {
    if (groupBy.length && !hasFetchedOnce) {
      void fetchAnalytics();
      setHasFetchedOnce(true);
    }
  }, [fetchAnalytics, groupBy.length, hasFetchedOnce]);

  useEffect(() => {
    if (
      view === "benchmark" &&
      hasFetchedOnce &&
      groupBy.length > 0 &&
      !benchmarkData &&
      !benchmarkLoading &&
      !benchmarkError
    ) {
      void fetchBenchmark();
    }
  }, [
    benchmarkData,
    benchmarkError,
    benchmarkLoading,
    fetchBenchmark,
    groupBy.length,
    hasFetchedOnce,
    view,
  ]);

  useEffect(() => {
    if (view !== "table" || shouldMountExportControls) return;
    const timeoutId = window.setTimeout(() => {
      setShouldMountExportControls(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [shouldMountExportControls, view]);

  const handleTagToggle = (tag: SelectedTag) => {
    const nextTags = toggleSelectedTagList(selectedTags, tag);
    setSelectedTags(nextTags);
    if (hasFetchedOnce) {
      void fetchAnalytics({ tags: nextTags });
    }
  };

  const handleRemoveSelectedTag = (tagToRemove: SelectedTag) => {
    const nextTags = selectedTags.filter(
      (tag) => !isSameSelectedTag(tag, tagToRemove),
    );
    setSelectedTags(nextTags);
    if (hasFetchedOnce) {
      void fetchAnalytics({ tags: nextTags });
    }
  };

  const handleClearSelectedTags = () => {
    if (selectedTags.length === 0) return;
    setSelectedTags([]);
    if (hasFetchedOnce) {
      void fetchAnalytics({ tags: [] });
    }
  };

  const handleApplyFilters = React.useCallback(async () => {
    try {
      const { nextGroupBy } = await loadReportSetup({
        classId: selectedClassId,
        subjectId: selectedSubjectId,
      });
      await fetchAnalytics({
        classId: selectedClassId,
        academicSectionId: selectedAcademicSectionId,
        subjectId: selectedSubjectId,
        groupBy: nextGroupBy,
      });
    } catch (setupError: any) {
      setError(setupError?.message || "Failed to load report setup.");
    }
  }, [
    fetchAnalytics,
    loadReportSetup,
    selectedAcademicSectionId,
    selectedClassId,
    selectedSubjectId,
  ]);

  const handleClearFilters = React.useCallback(async () => {
    setSelectedClassId("all");
    setSelectedAcademicSectionId("all");
    setSelectedSubjectId("all");
    try {
      const { nextGroupBy } = await loadReportSetup({
        classId: "all",
        subjectId: "all",
      });
      await fetchAnalytics({
        classId: "all",
        academicSectionId: "all",
        subjectId: "all",
        groupBy: nextGroupBy,
      });
    } catch (setupError: any) {
      setError(setupError?.message || "Failed to load report setup.");
    }
  }, [fetchAnalytics, loadReportSetup]);

  const backAction = (
    <Button variant="outline" onClick={navigateBack} className="app-button-back">
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );

  if (loading) return <LoadingState actions={backAction} />;
  if (error) return <ErrorState message={error} actions={backAction} />;

  return (
    <div className="analytics-page">
      <div className="analytics-page-shell">
        <ReportHeader
          paper={paper}
          student=""
          rollNumber=""
          variant="class"
          actions={backAction}
          summaryBadges={headerSummaryBadges}
        />
        <div className="analytics-card analytics-card-body">
          <div className="analytics-setup-bar">
            <div className="analytics-toolbar-copy">
              <h2 className="analytics-card-title">Setup</h2>
              <p className="analytics-card-description">
                Keep scope, grouping, and visible columns aligned before you
                review the class report.
              </p>
            </div>
            <div className="analytics-setup-actions">
              <button
                type="button"
                onClick={() => setShowControls((value) => !value)}
                aria-expanded={showControls}
                className="analytics-action-button-secondary w-full sm:w-auto"
              >
                {showControls ? "Hide setup" : "Edit setup"}
              </button>
              <button
                type="button"
                onClick={() => fetchAnalytics()}
                disabled={loading}
                className="analytics-action-button-primary w-full sm:w-auto"
              >
                {loading ? "Refreshing report..." : "Refresh report"}
              </button>
            </div>
          </div>

          <div className="analytics-setup-summary-strip">
            <div className="analytics-setup-summary-item">
              <p className="analytics-setup-summary-item-label">Report view</p>
              <div className="analytics-setup-summary-item-value">
                <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                  {activeViewLabel}
                </span>
              </div>
            </div>
            <div className="analytics-setup-summary-item">
              <p className="analytics-setup-summary-item-label">
                Visible metrics
              </p>
              <div className="analytics-setup-summary-item-value">
                <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                  {visibleColumnsLabel}
                </span>
              </div>
            </div>
            <div className="analytics-setup-summary-item">
              <p className="analytics-setup-summary-item-label">
                Current scope
              </p>
              <div className="analytics-setup-summary-item-value">
                <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                  {activeFiltersLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="analytics-setup-toggle-row">
            <label className="analytics-setup-toggle-compact">
              <span className="analytics-setup-toggle-compact-copy">
                <span className="analytics-setup-toggle-compact-label">
                  Tags column
                </span>
                <span className="analytics-setup-toggle-compact-note">
                  Keep grouped tag labels visible beside each metric row.
                </span>
              </span>
              <input
                type="checkbox"
                checked={showTagsColumn}
                onChange={() => setShowTagsColumn((value) => !value)}
                className="analytics-inline-check shrink-0"
              />
            </label>
            <label className="analytics-setup-toggle-compact">
              <span className="analytics-setup-toggle-compact-copy">
                <span className="analytics-setup-toggle-compact-label">
                  Option tags column
                </span>
                <span className="analytics-setup-toggle-compact-note">
                  Show option-level tag groupings when you need deeper review.
                </span>
              </span>
              <input
                type="checkbox"
                checked={showOptionTagsColumn}
                onChange={() => setShowOptionTagsColumn((value) => !value)}
                className="analytics-inline-check shrink-0"
              />
            </label>
          </div>

          {selectedTags.length > 0 ? (
            <div className="analytics-active-filter-strip">
              <div className="analytics-active-filter-strip-copy">
                <p className="analytics-active-filter-strip-title">
                  Active tag filters
                </p>
                <p className="analytics-active-filter-strip-note">
                  Clear these chips to stop carrying them into benchmark
                  comparisons.
                </p>
              </div>
              <div className="analytics-active-filter-strip-actions">
                {selectedTags.map((tag) => (
                  <button
                    key={`${tag.type}:${tag.value}`}
                    type="button"
                    onClick={() => handleRemoveSelectedTag(tag)}
                    className="analytics-active-filter-tag"
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
                  onClick={handleClearSelectedTags}
                  className="analytics-action-button-compact"
                >
                  Clear all
                </button>
              </div>
            </div>
          ) : null}

          {showControls ? (
            <AnalyticsClassTagReportSetupControls
              loading={loading}
              hasActiveFilters={hasActiveFilters}
              searchableClassOptions={searchableClassOptions}
              searchableAcademicSectionOptions={searchableAcademicSectionOptions}
              searchableSubjectOptions={searchableSubjectOptions}
              selectedClassId={selectedClassId}
              selectedAcademicSectionId={selectedAcademicSectionId}
              selectedSubjectId={selectedSubjectId}
              activeClassLabel={activeClassLabel}
              activeAcademicSectionLabel={activeAcademicSectionLabel}
              activeSubjectLabel={activeSubjectLabel}
              groupFields={groupFields}
              groupBy={groupBy}
              setSelectedClassId={setSelectedClassId}
              setSelectedAcademicSectionId={setSelectedAcademicSectionId}
              setSelectedSubjectId={setSelectedSubjectId}
              setGroupBy={setGroupBy}
              onApplyFilters={handleApplyFilters}
              onClearFilters={handleClearFilters}
            />
          ) : null}
        </div>

        <FailInsightsCard
          title={`Insights (Class • ${lastLabel})`}
          lastLabel={lastLabel}
          rows={insights}
        />
        <div className="analytics-output-bar">
          <div className="analytics-output-primary">
            <div className="analytics-toolbar-copy">
              <h2 className="analytics-card-title">{outputTitle}</h2>
              <p className="analytics-card-description">{outputNote}</p>
            </div>
            <div className="analytics-toggle mx-0">
              <button
                onClick={() => setView("table")}
                className={`analytics-view-toggle-button ${
                  view === "table"
                    ? "analytics-view-toggle-button-active"
                    : "hover:bg-background/70"
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setView("charts")}
                className={`analytics-view-toggle-button ${
                  view === "charts"
                    ? "analytics-view-toggle-button-active"
                    : "hover:bg-background/70"
                }`}
              >
                Charts
              </button>
              <button
                onClick={() => setView("benchmark")}
                className={`analytics-view-toggle-button ${
                  view === "benchmark"
                    ? "analytics-view-toggle-button-active"
                    : "hover:bg-background/70"
                }`}
              >
                Benchmark
              </button>
            </div>
          </div>
          <div className="analytics-output-actions">
            <div className="analytics-output-action-row">
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                {outputMetaLabel}
              </span>
            </div>
            {view === "table" ? (
              <div className="analytics-output-action-row">
                {shouldMountExportControls ? (
                  <AnalyticsExportControls
                    stats={stats}
                    groupBy={groupBy}
                    groupFields={groupFields}
                    sortConfig={sortConfig}
                    tableRef={tableRef}
                    mode="class"
                    paperTitle={paper}
                    paperId={paperId}
                    classId={selectedClassId}
                    academicSectionId={selectedAcademicSectionId}
                    subjectId={selectedSubjectId}
                    selectedTags={selectedTags}
                    benchmarkData={benchmarkData}
                    benchmarkViewSettings={benchmarkViewSettings}
                  />
                ) : (
                  <div className="h-10 w-full rounded-xl border border-border/60 bg-muted/30 sm:w-[25rem]" />
                )}
              </div>
            ) : null}
          </div>
        </div>
        {view === "table" ? (
          <div className="analytics-table-shell">
            {!hasStatsData ? (
              <div className="app-empty-state m-6">
                No tag data found for the selected criteria.
              </div>
            ) : (
              <>
                <div className="space-y-2.5 md:hidden">
                  {mobileStatsRows.map((entry) => (
                    <article
                      key={entry.path.join("::")}
                      className="rounded-[1.05rem] border border-border/68 bg-background/92 px-3.5 py-3.5 shadow-sm"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            {entry.level > 0 ? (
                              <p className="truncate text-[11px] text-muted-foreground">
                                {entry.path.slice(0, -1).join(" → ")}
                              </p>
                            ) : null}
                            <p className="text-sm font-semibold text-foreground">
                              {entry.label}
                            </p>
                          </div>
                          <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Level {entry.level + 1}
                          </span>
                        </div>

                        {showTagsColumn ? (
                          <div className="flex flex-wrap gap-1.5">
                            {Array.isArray(entry.row.tags) && entry.row.tags.length > 0 ? (
                              entry.row.tags.map(
                                (tag: { type: string; value: string }, index: number) => {
                                  const isSelected = selectedTags.some(
                                    (selected) =>
                                      selected.type === tag.type &&
                                      selected.value === tag.value,
                                  );

                                  return (
                                    <button
                                      key={`${entry.path.join("::")}-${tag.type}-${tag.value}-${index}`}
                                      type="button"
                                      className={`analytics-chip-button ${
                                        isSelected
                                          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                                          : "border-border/60 bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
                                      }`}
                                      onClick={() => handleTagToggle(tag)}
                                    >
                                      {tag.type}: {tag.value}
                                    </button>
                                  );
                                },
                              )
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                No tags on this row.
                              </span>
                            )}
                          </div>
                        ) : null}

                        <div className="grid grid-cols-3 gap-2">
                          <AnalyticsMobileMetricButton
                            label="Correct"
                            value={entry.row.correct || 0}
                            tone="success"
                            onClick={
                              Array.isArray(entry.row.correctQuestionIds) &&
                              entry.row.correctQuestionIds.length > 0
                                ? () =>
                                    handleOpenModal(
                                      "Correct Questions",
                                      entry.row.correctQuestionIds,
                                      entry.row,
                                    )
                                : undefined
                            }
                          />
                          <AnalyticsMobileMetricButton
                            label="Incorrect"
                            value={entry.row.incorrect || 0}
                            tone="danger"
                            onClick={
                              Array.isArray(entry.row.incorrectQuestionIds) &&
                              entry.row.incorrectQuestionIds.length > 0
                                ? () =>
                                    handleOpenModal(
                                      "Incorrect Questions",
                                      entry.row.incorrectQuestionIds,
                                      entry.row,
                                    )
                                : undefined
                            }
                          />
                          <AnalyticsMobileMetricButton
                            label="Unattempted"
                            value={entry.row.unattempted || 0}
                            tone="warning"
                            onClick={
                              Array.isArray(entry.row.unattemptedQuestionIds) &&
                              entry.row.unattemptedQuestionIds.length > 0
                                ? () =>
                                    handleOpenModal(
                                      "Unattempted Questions",
                                      entry.row.unattemptedQuestionIds,
                                      entry.row,
                                    )
                                : undefined
                            }
                          />
                        </div>

                        {showOptionTagsColumn ? (
                          <div className="rounded-[0.95rem] border border-border/60 bg-background/75 px-3 py-2.5">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              Selected Option Tags
                            </p>
                            <OptionTagsDisplay
                              optionTags={entry.row.optionTags}
                              onTagClick={handleOptionTagClick}
                            />
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="analytics-table-wrap hidden md:block" ref={tableRef}>
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="analytics-th">Group / Tag</th>
                        {showTagsColumn && (
                          <th className="analytics-th-center">Tags</th>
                        )}
                        <th className="analytics-th-center text-emerald-700">
                          <button
                            type="button"
                            className={`analytics-sort-button ${
                              sortConfig.key === "correct"
                                ? "analytics-sort-button-active"
                                : ""
                            }`}
                            onClick={() =>
                              setSortConfig({
                                key: "correct",
                                direction:
                                  sortConfig.key === "correct" &&
                                  sortConfig.direction === "asc"
                                    ? "desc"
                                    : "asc",
                              })
                            }
                          >
                            <span>Correct</span>
                            <span className="analytics-sort-indicator" aria-hidden="true">
                              {sortConfig.key === "correct"
                                ? sortConfig.direction === "asc"
                                  ? "▲"
                                  : "▼"
                                : "↕"}
                            </span>
                          </button>
                        </th>
                        <th className="analytics-th-center text-rose-700">
                          <button
                            type="button"
                            className={`analytics-sort-button ${
                              sortConfig.key === "incorrect"
                                ? "analytics-sort-button-active"
                                : ""
                            }`}
                            onClick={() =>
                              setSortConfig({
                                key: "incorrect",
                                direction:
                                  sortConfig.key === "incorrect" &&
                                  sortConfig.direction === "asc"
                                    ? "desc"
                                    : "asc",
                              })
                            }
                          >
                            <span>Incorrect</span>
                            <span className="analytics-sort-indicator" aria-hidden="true">
                              {sortConfig.key === "incorrect"
                                ? sortConfig.direction === "asc"
                                  ? "▲"
                                  : "▼"
                                : "↕"}
                            </span>
                          </button>
                        </th>
                        <th className="analytics-th-center text-amber-700">
                          <button
                            type="button"
                            className={`analytics-sort-button ${
                              sortConfig.key === "unattempted"
                                ? "analytics-sort-button-active"
                                : ""
                            }`}
                            onClick={() =>
                              setSortConfig({
                                key: "unattempted",
                                direction:
                                  sortConfig.key === "unattempted" &&
                                  sortConfig.direction === "asc"
                                    ? "desc"
                                    : "asc",
                              })
                            }
                          >
                            <span>Unattempted</span>
                            <span className="analytics-sort-indicator" aria-hidden="true">
                              {sortConfig.key === "unattempted"
                                ? sortConfig.direction === "asc"
                                  ? "▲"
                                  : "▼"
                                : "↕"}
                            </span>
                          </button>
                        </th>
                        {showOptionTagsColumn && (
                          <th className="analytics-th-center">
                            Selected Option Tags
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      <StatsTable
                        stats={stats}
                        handleOpenModal={handleOpenModal}
                        handleOptionTagClick={handleOptionTagClick}
                        selectedTags={selectedTags}
                        handleTagSelect={handleTagToggle}
                        sortConfig={sortConfig}
                        setSortConfig={setSortConfig}
                        showTagsColumn={showTagsColumn}
                        showOptionTagsColumn={showOptionTagsColumn}
                        groupBy={groupBy}
                      />
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        ) : view === "charts" ? (
          <AnalyticsChartView
            stats={stats}
            groupBy={groupBy}
            groupFields={groupFields}
            paperTitle={paper}
            mode="class"
          />
        ) : (
          <AnalyticsClassBenchmarkPanel
            benchmarkData={benchmarkData}
            loading={benchmarkLoading}
            error={benchmarkError}
            activeAcademicSectionLabel={activeFiltersLabel}
            selectedAcademicSectionId={selectedAcademicSectionId}
            selectedGroupLabels={selectedGroupLabels}
            selectedTags={selectedTags}
            benchmarkViewSettings={benchmarkViewSettings}
            onBenchmarkViewSettingsChange={setBenchmarkViewSettings}
            onRemoveTag={handleRemoveSelectedTag}
            onClearTags={handleClearSelectedTags}
          />
        )}
        {hasOpenedQuestionModal ? (
          <AnalyticsQuestionListModal
            isOpen={modalData.isOpen}
            onClose={handleCloseModal}
            title={modalData.title}
            questionIds={modalData.questionIds}
            groupNode={modalData.groupNode}
          />
        ) : null}
        {hasOpenedOptionTagModal ? (
          <AnalyticsOptionTagModal
            isOpen={!!optionTagModal}
            onClose={handleCloseOptionTagModal}
            option={optionTagModal?.option || ""}
            tag={optionTagModal?.tag || ""}
            isCorrect={optionTagModal?.isCorrect || false}
            students={optionTagModal?.students || []}
          />
        ) : null}
      </div>
    </div>
  );
}
