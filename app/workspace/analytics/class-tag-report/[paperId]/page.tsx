"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useState, useRef } from "react";
import LoadingState from "@/components/analytics/LoadingState";
import ErrorState from "@/components/analytics/ErrorState";
import ReportHeader from "@/components/analytics/ReportHeader";
import StatsTable from "@/components/analytics/StatsTable";
import {
  sortStatsRows,
  computeInsightsForLastTag,
} from "@/components/analytics/helpers";
import { Button } from "@/components/ui/button";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { ArrowLeft } from "lucide-react";
import {
  DEFAULT_BENCHMARK_VIEW_SETTINGS,
  type BenchmarkViewSettings,
} from "@/lib/analytics/benchmarkPresentation";
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";

const ChartView = dynamic(() => import("@/components/analytics/ChartView"), {
  ssr: false,
  loading: () => (
    <div className="analytics-card analytics-card-body">
      <p className="text-sm text-muted-foreground">Loading charts...</p>
    </div>
  ),
});

const AnalyticsExportControls = dynamic(
  () => import("@/components/analytics/AnalyticsExportControls"),
  {
    ssr: false,
    loading: () => (
      <div className="h-9 w-full rounded-xl border border-border/60 bg-muted/30 sm:w-56" />
    ),
  },
);

const QuestionListModal = dynamic(
  () => import("@/components/analytics/QuestionListModal"),
  {
    ssr: false,
    loading: () => null,
  },
);

const OptionTagModal = dynamic(
  () => import("@/components/analytics/OptionTagModal"),
  {
    ssr: false,
    loading: () => null,
  },
);

const ClassBenchmarkPanel = dynamic(
  () => import("@/components/analytics/ClassBenchmarkPanel"),
  {
    ssr: false,
    loading: () => (
      <div className="analytics-card analytics-card-body">
        <p className="text-sm text-muted-foreground">
          Loading benchmark view...
        </p>
      </div>
    ),
  },
);

type ReportFilterOption = {
  value: string;
  label: string;
};

type SelectedTag = {
  type: string;
  value: string;
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

export default function ClassTagReportPage({
  params,
}: {
  params: { paperId: string };
}) {
  const { navigateBack } = useBackNavigation("/workspace/question-papers");
  const [stats, setStats] = useState<any>({});
  const [paper, setPaper] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [groupFields, setGroupFields] = useState<
    { value: string; label: string }[]
  >([]);
  const [academicSectionOptions, setAcademicSectionOptions] = useState<
    ReportFilterOption[]
  >([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [selectedAcademicSectionId, setSelectedAcademicSectionId] =
    useState("all");
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
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [benchmarkData, setBenchmarkData] = useState<any>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [benchmarkViewSettings, setBenchmarkViewSettings] =
    useState<BenchmarkViewSettings>(DEFAULT_BENCHMARK_VIEW_SETTINGS);
  const [insPage, setInsPage] = useState(1);
  const [insPageSize, setInsPageSize] = useState(12);
  const [insShowAll, setInsShowAll] = useState(false);

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

  const hasActiveAcademicSectionFilter = selectedAcademicSectionId !== "all";

  const activeAcademicSectionLabel =
    selectedAcademicSectionId !== "all"
      ? academicSectionOptions.find(
          (option) => option.value === selectedAcademicSectionId,
        )?.label || "Filtered section"
      : "All class sections";

  // Explicit tenant handling
  const [schoolKey, setSchoolKey] = useState<string>("");

  useEffect(() => {
    const sk = resolveClientSchoolKey();
    const initialAcademicSectionId =
      typeof window !== "undefined"
        ? new URL(window.location.href).searchParams.get("academicSectionId")?.trim() ||
          "all"
        : "all";

    setSchoolKey(sk);
    if (!sk) {
      setLoading(false);
      setError("Please select a school in the navbar to load analytics.");
      return;
    }

    void (async () => {
      try {
        const data = await fetchApiJson<any>(
          `/api/analytics/class-tag-report/${params.paperId}?groupFields=1`,
          {
            cache: "no-store",
            schoolKey: sk,
            fallbackMessage: "Failed to load report setup.",
          },
        );

        const nextFields = Array.isArray(data?.fields) ? data.fields : [];
        const nextAcademicSections = Array.isArray(data?.filters?.academicSections)
          ? data.filters.academicSections
          : [];

        if (nextFields.length === 0) {
          throw new Error("No analytics fields are available for this paper yet.");
        }

        setGroupFields(nextFields);
        setAcademicSectionOptions(nextAcademicSections);
        setSelectedAcademicSectionId(
          initialAcademicSectionId !== "all" &&
            nextAcademicSections.some(
              (option: any) => option.value === initialAcademicSectionId,
            )
            ? initialAcademicSectionId
            : "all",
        );

        if (nextFields.some((field: any) => field.value === "section")) {
          const sectionIdx = nextFields.findIndex(
            (field: any) => field.value === "section",
          );
          const selected = [
            nextFields[sectionIdx]?.value,
            nextFields[sectionIdx + 1]?.value,
            nextFields[sectionIdx + 2]?.value,
          ].filter(Boolean);
          setGroupBy(selected);
        } else {
          setGroupBy(nextFields.slice(0, 3).map((field: any) => field.value));
        }
      } catch (setupError: any) {
        setLoading(false);
        setError(setupError?.message || "Failed to load report setup.");
      }
    })();
  }, [params.paperId]);

  const handleOpenModal = (
    title: string,
    questionIds: any[],
    groupNode?: any,
  ) => setModalData({ isOpen: true, title, questionIds, groupNode });

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
    setOptionTagModal({ isOpen: true, option, tag, isCorrect, students });
  };

  const handleCloseOptionTagModal = () => setOptionTagModal(null);

  const fetchBenchmark = React.useCallback(
    async (overrides?: {
      academicSectionId?: string;
      tags?: SelectedTag[];
    }) => {
      const resolvedAcademicSectionId =
        overrides?.academicSectionId ?? selectedAcademicSectionId;
      const resolvedTags = overrides?.tags ?? selectedTags;
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
      if (groupBy.length) searchParams.set("groupBy", groupBy.join(","));
      if (resolvedAcademicSectionId !== "all") {
        searchParams.set("academicSectionId", resolvedAcademicSectionId);
      }
      resolvedTags.forEach((tag) => {
        searchParams.append("tag", `${tag.type}:${tag.value}`);
      });

      setBenchmarkLoading(true);
      setBenchmarkError(null);
      setBenchmarkData(null);

      try {
        const data = await fetchApiJson<any>(
          `/api/analytics/benchmark-report/${params.paperId}?${searchParams.toString()}`,
          {
            cache: "no-store",
            schoolKey: sk,
            fallbackMessage: "Failed to load benchmark report.",
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
    [groupBy, params.paperId, schoolKey, selectedAcademicSectionId, selectedTags],
  );

  const fetchAnalytics = React.useCallback(
    async (overrides?: {
      academicSectionId?: string;
    }) => {
      setLoading(true);
      setError(null);
      const resolvedAcademicSectionId =
        overrides?.academicSectionId ?? selectedAcademicSectionId;
      const searchParams = new URLSearchParams();
      searchParams.set("json", "1");
      if (groupBy.length) searchParams.set("groupBy", groupBy.join(","));
      if (resolvedAcademicSectionId !== "all") {
        searchParams.set("academicSectionId", resolvedAcademicSectionId);
      }
      const sk = schoolKey || resolveClientSchoolKey();
      if (!sk) {
        setLoading(false);
        setError("Please select a school in the navbar to load analytics.");
        return;
      }

      try {
        const data = await fetchApiJson<any>(
          `/api/analytics/class-tag-report/${params.paperId}?${searchParams.toString()}`,
          {
            cache: "no-store",
            schoolKey: sk,
            fallbackMessage: "Failed to fetch tag report.",
          },
        );

        setStats(data.stats || {});
        setPaper(data.paper || "");
        void fetchBenchmark({
          academicSectionId: resolvedAcademicSectionId,
        });
      } catch (fetchError: any) {
        setError(fetchError?.message || "An unexpected network error occurred.");
      } finally {
        setLoading(false);
      }
    },
    [fetchBenchmark, groupBy, params.paperId, schoolKey, selectedAcademicSectionId],
  );

  useEffect(() => {
    if (groupBy.length && !hasFetchedOnce) {
      void fetchAnalytics();
      setHasFetchedOnce(true);
    }
  }, [fetchAnalytics, groupBy.length, hasFetchedOnce]);

  const handleTagToggle = (tag: SelectedTag) => {
    const nextTags = toggleSelectedTagList(selectedTags, tag);
    setSelectedTags(nextTags);
    if (hasFetchedOnce) {
      void fetchBenchmark({ tags: nextTags });
    }
  };

  React.useEffect(() => {
    setInsPage(1);
  }, [groupBy, insights.length, insPageSize, insShowAll]);

  const handleRemoveSelectedTag = (tagToRemove: SelectedTag) => {
    const nextTags = selectedTags.filter(
      (tag) => !isSameSelectedTag(tag, tagToRemove),
    );
    setSelectedTags(nextTags);
    if (hasFetchedOnce) {
      void fetchBenchmark({ tags: nextTags });
    }
  };

  const handleClearSelectedTags = () => {
    if (selectedTags.length === 0) return;
    setSelectedTags([]);
    if (hasFetchedOnce) {
      void fetchBenchmark({ tags: [] });
    }
  };

  const backAction = (
    <Button variant="outline" onClick={navigateBack} className="gap-2">
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );

  if (loading) return <LoadingState actions={backAction} />;
  if (error) return <ErrorState message={error} actions={backAction} />;

  return (
    <div className="analytics-page">
      <div className="w-full space-y-4 px-4 sm:space-y-5 sm:px-5 lg:px-6">
        <ReportHeader paper={paper} student="" rollNumber="" variant="class" actions={backAction} />
        <div className="analytics-card overflow-hidden">
          <div className="analytics-card-header">
            <div className="analytics-toolbar-row gap-4">
              <div className="analytics-toolbar-copy">
                <h2 className="analytics-card-title">Report Controls</h2>
                <p className="analytics-card-description">Controls</p>
              </div>
              <div className="analytics-toolbar-meta">
                <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                  {groupingPreviewLabel}
                </span>
                <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                  {activeAcademicSectionLabel}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-3 p-3 sm:p-4">
            <div className="analytics-toolbar">
              <div className="analytics-setup-bar">
                <div className="analytics-toolbar-copy">
                  <p className="analytics-toolbar-title">Quick setup</p>
                  <p className="analytics-toolbar-note">
                    Review the active view, visible metrics, and class-section
                    scope before refreshing the report.
                  </p>
                </div>
                <div className="analytics-setup-actions">
                  <button
                    type="button"
                    onClick={() => setShowControls((value) => !value)}
                    aria-expanded={showControls}
                    className="app-button-secondary h-9 w-full px-3 sm:w-auto"
                  >
                    {showControls ? "Hide setup" : "Setup"}
                  </button>
                  <button
                    type="button"
                    onClick={() => fetchAnalytics()}
                    disabled={loading}
                    className="app-button-primary h-9 w-full px-3 sm:w-auto"
                  >
                    {loading ? "Refreshing report..." : "Refresh report"}
                  </button>
                </div>
              </div>
              <div className="analytics-setup-grid">
                <div className="analytics-setup-summary-grid">
                  <div className="analytics-setup-summary-card">
                    <p className="analytics-setup-summary-label">View</p>
                    <div className="analytics-setup-summary-value">
                      <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                        {activeViewLabel}
                      </span>
                    </div>
                  </div>
                  <div className="analytics-setup-summary-card">
                    <p className="analytics-setup-summary-label">
                      Visible metrics
                    </p>
                    <div className="analytics-setup-summary-value">
                      <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                        {visibleColumnsLabel}
                      </span>
                    </div>
                  </div>
                  <div className="analytics-setup-summary-card">
                    <p className="analytics-setup-summary-label">
                      Class section
                    </p>
                    <div className="analytics-setup-summary-value">
                      <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                        {activeAcademicSectionLabel}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="analytics-setup-toggle-grid">
                  <label className="analytics-checkbox-card analytics-checkbox-card-split">
                    <span className="analytics-checkbox-card-copy">
                      <span className="analytics-checkbox-card-label">
                        Show tags column
                      </span>
                      <span className="analytics-checkbox-card-note">
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
                  <label className="analytics-checkbox-card analytics-checkbox-card-split">
                    <span className="analytics-checkbox-card-copy">
                      <span className="analytics-checkbox-card-label">
                        Show option tags column
                      </span>
                      <span className="analytics-checkbox-card-note">
                        Expose option-level tag groupings when reviewing table
                        details.
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={showOptionTagsColumn}
                      onChange={() =>
                        setShowOptionTagsColumn((value) => !value)
                      }
                      className="analytics-inline-check shrink-0"
                    />
                  </label>
                </div>
              </div>
            </div>

            {selectedTags.length > 0 ? (
              <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3">
                <div className="analytics-toolbar-row gap-3">
                  <div className="analytics-toolbar-copy">
                    <p className="analytics-toolbar-title">Active tag filters</p>
                  </div>
                  <div className="analytics-toolbar-actions">
                    {selectedTags.map((tag) => (
                      <button
                        key={`${tag.type}:${tag.value}`}
                        type="button"
                        onClick={() => handleRemoveSelectedTag(tag)}
                        className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
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
                      className="app-button-secondary h-8 px-3 text-xs"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {showControls ? (
              <div className="analytics-controls-grid">
                <div className="analytics-control-panel xl:order-1">
                  <div className="analytics-control-panel-header">
                    <p className="analytics-control-panel-title">
                      Academic section filter
                    </p>
                  </div>
                  <div className="app-field-group">
                    <label className="app-field-label">Class section</label>
                    <select
                      className="analytics-select w-full"
                      value={selectedAcademicSectionId}
                      onChange={(event) =>
                        setSelectedAcademicSectionId(event.target.value)
                      }
                    >
                      <option value="all">All class sections</option>
                      {academicSectionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="analytics-toolbar-chip">
                      {activeAcademicSectionLabel}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        fetchAnalytics({
                          academicSectionId: selectedAcademicSectionId,
                        })
                      }
                      disabled={loading}
                      className="app-button-secondary h-9 px-3"
                    >
                      {loading ? "Applying..." : "Apply filter"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAcademicSectionId("all");
                        fetchAnalytics({ academicSectionId: "all" });
                      }}
                      disabled={loading || !hasActiveAcademicSectionFilter}
                      className="app-button-secondary h-9 px-3"
                    >
                      Clear filter
                    </button>
                  </div>
                </div>
                <div className="analytics-control-panel xl:order-2">
                  <div className="analytics-control-panel-header">
                    <p className="analytics-control-panel-title">
                      Group By (in order)
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {groupFields.map((field) => (
                      <div key={field.value}>
                        <input
                          type="checkbox"
                          id={`field-${field.value}`}
                          checked={groupBy.includes(field.value)}
                          onChange={() =>
                            setGroupBy((prev) =>
                              prev.includes(field.value)
                                ? prev.filter((f) => f !== field.value)
                                : [...prev, field.value],
                            )
                          }
                          className="hidden peer"
                        />
                        <label
                          htmlFor={`field-${field.value}`}
                          className="analytics-filter-chip peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground"
                        >
                          {field.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  {groupBy.length > 0 ? (
                    <ul className="space-y-2">
                      {groupBy.map((fieldValue, idx) => {
                        const field = groupFields.find(
                          (f) => f.value === fieldValue,
                        );
                        if (!field) return null;
                        return (
                          <li
                            key={field.value}
                            className="analytics-order-item"
                          >
                            <span className="font-medium text-foreground">
                              {idx + 1}. {field.label}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
                                disabled={idx === 0}
                                onClick={() => {
                                  setGroupBy((prev) => {
                                    const arr = [...prev];
                                    [arr[idx - 1], arr[idx]] = [
                                      arr[idx],
                                      arr[idx - 1],
                                    ];
                                    return arr;
                                  });
                                }}
                                title="Move up"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
                                disabled={idx === groupBy.length - 1}
                                onClick={() => {
                                  setGroupBy((prev) => {
                                    const arr = [...prev];
                                    [arr[idx], arr[idx + 1]] = [
                                      arr[idx + 1],
                                      arr[idx],
                                    ];
                                    return arr;
                                  });
                                }}
                                title="Move down"
                              >
                                ▼
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="app-empty-state py-6">
                      Select at least one field to define the report grouping.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {insights && insights.length > 0 && (
          <div className="analytics-card analytics-card-body border-l-4 border-rose-400">
            <div className="analytics-toolbar">
              <div className="analytics-toolbar-row">
                <div className="analytics-toolbar-copy">
                  <h2 className="analytics-card-title">
                    Insights (Class • {lastLabel})
                  </h2>
                </div>
                <div className="analytics-toolbar-meta">
                  <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                    Based on {lastLabel}
                  </span>
                </div>
              </div>
            </div>
            <div className="analytics-table-wrap">
              {(() => {
                const total = insights.length;
                const maxPage = Math.max(1, Math.ceil(total / insPageSize));
                const safePage = Math.min(insPage, maxPage);
                const start = (safePage - 1) * insPageSize;
                const end = Math.min(total, start + insPageSize);
                const visible = insShowAll ? insights : insights.slice(start, end);
                const rangeLabel = insShowAll
                  ? `Showing all ${total}`
                  : `Showing ${total === 0 ? 0 : start + 1}–${end} of ${total}`;

                return (
                  <>
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="analytics-th">{lastLabel}</th>
                          <th className="analytics-th-center">Fail (%)</th>
                          <th className="analytics-th">Category</th>
                          <th className="analytics-th">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((i) => (
                          <tr key={i.tag} className="analytics-row">
                            <td className="analytics-td">{i.tag}</td>
                            <td className="analytics-td-center font-medium text-rose-600">
                              {i.failPct}
                            </td>
                            <td className="analytics-td">{i.category}</td>
                            <td className="analytics-td">{i.action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="border-t border-border/60 bg-muted/20 p-4">
                      <div className="analytics-toolbar-row">
                        <div className="analytics-toolbar-actions">
                          <label className="analytics-checkbox-card">
                            <input
                              type="checkbox"
                              className="analytics-inline-check"
                              checked={insShowAll}
                              onChange={() => {
                                setInsShowAll((value) => !value);
                                setInsPage(1);
                              }}
                            />
                            <span>Show all rows</span>
                          </label>
                          {!insShowAll && total > 0 && (
                            <label className="analytics-checkbox-card">
                              <span className="text-muted-foreground">Rows per page</span>
                              <select
                                className="analytics-select h-8"
                                value={insPageSize}
                                onChange={(event) => {
                                  setInsPageSize(Number(event.target.value));
                                  setInsPage(1);
                                }}
                              >
                                {[10, 12, 25, 50].map((count) => (
                                  <option key={count} value={count}>
                                    {count}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                        <div className="analytics-toolbar-actions">
                          <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                            {rangeLabel}
                          </span>
                          {!insShowAll && total > insPageSize && (
                            <>
                              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                                Page {safePage} of {maxPage}
                              </span>
                              <button
                                type="button"
                                className="analytics-pagination-button"
                                onClick={() => setInsPage((page) => Math.max(1, page - 1))}
                                disabled={safePage <= 1}
                              >
                                Previous
                              </button>
                              <button
                                type="button"
                                className="analytics-pagination-button"
                                onClick={() => setInsPage((page) => Math.min(maxPage, page + 1))}
                                disabled={safePage >= maxPage}
                              >
                                Next
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
        <div className="analytics-toolbar border border-border/60 bg-card/70">
          <div className="analytics-toolbar-row">
            <div className="analytics-toolbar-copy">
              <p className="analytics-toolbar-title">Report view</p>
            </div>
            <div className="analytics-toolbar-meta">
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                {activeSortLabel}
              </span>
            </div>
          </div>
          <div className="analytics-toggle">
            <button
              onClick={() => setView("table")}
              className={`w-full px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                view === "table"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/70"
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setView("charts")}
              className={`w-full px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                view === "charts"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/70"
              }`}
            >
              Chart View
            </button>
            <button
              onClick={() => setView("benchmark")}
              className={`w-full px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                view === "benchmark"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/70"
              }`}
            >
              Benchmark View
            </button>
          </div>
        </div>
        {view === "table" ? (
          <div className="analytics-table-shell">
            <div className="border-b border-border/60 bg-muted/20 p-4 sm:p-5">
              <div className="analytics-toolbar-row gap-4">
                <div className="analytics-toolbar-copy">
                  <h2 className="analytics-card-title">Grouped Analytics</h2>
                </div>
                <div className="analytics-toolbar-meta">
                  <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                    {activeSortLabel}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="analytics-toolbar-actions" />
                <AnalyticsExportControls
                  stats={stats}
                  groupBy={groupBy}
                  groupFields={groupFields}
                  sortConfig={sortConfig}
                  tableRef={tableRef}
                  mode="class"
                  paperTitle={paper}
                  paperId={params.paperId}
                  academicSectionId={selectedAcademicSectionId}
                  selectedTags={selectedTags}
                  benchmarkData={benchmarkData}
                  benchmarkViewSettings={benchmarkViewSettings}
                />
              </div>
            </div>
            {Object.keys(stats).length === 0 ? (
              <div className="app-empty-state m-6">
                No tag data found for the selected criteria.
              </div>
            ) : (
              <div className="analytics-table-wrap" ref={tableRef}>
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="analytics-th">Group / Tag</th>
                      {showTagsColumn && (
                        <th className="analytics-th-center">Tags</th>
                      )}
                      <th
                        className="analytics-th-center cursor-pointer select-none text-emerald-700"
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
                        Correct{" "}
                        {sortConfig.key === "correct"
                          ? sortConfig.direction === "asc"
                            ? "▲"
                            : "▼"
                          : ""}
                      </th>
                      <th
                        className="analytics-th-center cursor-pointer select-none text-rose-700"
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
                        Incorrect{" "}
                        {sortConfig.key === "incorrect"
                          ? sortConfig.direction === "asc"
                            ? "▲"
                            : "▼"
                          : ""}
                      </th>
                      <th
                        className="analytics-th-center cursor-pointer select-none text-amber-700"
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
                        Unattempted{" "}
                        {sortConfig.key === "unattempted"
                          ? sortConfig.direction === "asc"
                            ? "▲"
                            : "▼"
                          : ""}
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
            )}
          </div>
        ) : view === "charts" ? (
          <ChartView
            stats={stats}
            groupBy={groupBy}
            groupFields={groupFields}
            paperTitle={paper}
            mode="class"
          />
        ) : (
          <ClassBenchmarkPanel
            benchmarkData={benchmarkData}
            loading={benchmarkLoading}
            error={benchmarkError}
            activeAcademicSectionLabel={activeAcademicSectionLabel}
            selectedAcademicSectionId={selectedAcademicSectionId}
            selectedGroupLabels={selectedGroupLabels}
            selectedTags={selectedTags}
            benchmarkViewSettings={benchmarkViewSettings}
            onBenchmarkViewSettingsChange={setBenchmarkViewSettings}
            onRemoveTag={handleRemoveSelectedTag}
            onClearTags={handleClearSelectedTags}
          />
        )}
        <QuestionListModal
          isOpen={modalData.isOpen}
          onClose={handleCloseModal}
          title={modalData.title}
          questionIds={modalData.questionIds}
          groupNode={modalData.groupNode}
        />
        <OptionTagModal
          isOpen={!!optionTagModal}
          onClose={handleCloseOptionTagModal}
          option={optionTagModal?.option || ""}
          tag={optionTagModal?.tag || ""}
          isCorrect={optionTagModal?.isCorrect || false}
          students={optionTagModal?.students || []}
        />
      </div>
    </div>
  );
}
