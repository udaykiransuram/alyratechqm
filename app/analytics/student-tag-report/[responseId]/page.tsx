"use client";

import React, { useEffect, useState, useRef } from "react";
import LoadingState from "@/components/analytics/LoadingState";
import ErrorState from "@/components/analytics/ErrorState";
import ReportHeader from "@/components/analytics/ReportHeader";
import OptionTagModal from "@/components/analytics/OptionTagModal";
import StatsTable from "@/components/analytics/StatsTable";
import ChartView from "@/components/analytics/ChartView";
import {
  sortStatsRows,
  getConsolidatedStudentList,
  computeInsightsForLastTag,
  buildStudentAreaMetrics,
} from "@/components/analytics/helpers";
import QuestionListModal from "@/components/analytics/QuestionListModal";
import AnalyticsExportControls from "@/components/analytics/AnalyticsExportControls";

type ReportFilterOption = {
  value: string;
  label: string;
};

export default function StudentTagReportPage({
  params,
}: {
  params: { responseId: string };
}) {
  const [stats, setStats] = useState<any>({});
  const [student, setStudent] = useState<string>("");
  const [rollNumber, setRollNumber] = useState<string>("");
  const [paper, setPaper] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [groupFields, setGroupFields] = useState<
    { value: string; label: string }[]
  >([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [classLevel, setClassLevel] = useState(false);
  const [classOptions, setClassOptions] = useState<ReportFilterOption[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<ReportFilterOption[]>(
    [],
  );
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [selectedSubjectId, setSelectedSubjectId] = useState("all");

  // Track tenant (school) explicitly to make API calls DB-specific
  const [schoolKey, setSchoolKey] = useState<string>("");

  function getSchoolFromCookie() {
    try {
      const m = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
      return m && m[1] ? decodeURIComponent(m[1]) : "";
    } catch {
      return "";
    }
  }

  const [modalData, setModalData] = useState<{
    isOpen: boolean;
    title: string;
    questionIds: any[];
    groupNode?: any;
  }>({
    isOpen: false,
    title: "",
    questionIds: [],
    groupNode: undefined,
  });

  const [optionTagModal, setOptionTagModal] = useState<{
    isOpen: boolean;
    option: string;
    tag: string;
    isCorrect: boolean;
    students: { name: string; rollNumber: string }[];
  } | null>(null);

  const [selectedTags, setSelectedTags] = useState<
    { type: string; value: string }[]
  >([]);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  }>({ key: "", direction: "desc" });
  const [showTagsColumn, setShowTagsColumn] = useState<boolean>(false);
  const [showOptionTagsColumn, setShowOptionTagsColumn] =
    useState<boolean>(false);
  const [view, setView] = useState<"table" | "charts">("table");
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);

  // For student vs class comparison
  const [classStatsCompare, setClassStatsCompare] = useState<any>({});
  // Pagination state: comparison table (student vs class)
  const [cmpPage, setCmpPage] = useState(1);
  const [cmpPageSize, setCmpPageSize] = useState(12);
  const [cmpShowAll, setCmpShowAll] = useState(false);
  // Pagination state: fallback/class-only insights table
  const [insPage, setInsPage] = useState(1);
  const [insPageSize, setInsPageSize] = useState(12);
  const [insShowAll, setInsShowAll] = useState(false);

  // Derived insights for panel (student vs class level)
  const insights = React.useMemo(() => {
    if (!stats || !Array.isArray(groupBy) || groupBy.length === 0)
      return [] as Array<{
        tag: string;
        failPct: number;
        category: string;
        action: string;
      }>;

    if (classLevel) {
      // Class insights using helper
      return computeInsightsForLastTag(stats, groupBy, groupFields);
    }

    // Per-student insights derived from student area metrics
    try {
      const lastTag = groupBy[groupBy.length - 1];
      const headerLabel =
        groupFields.find((f) => f.value === lastTag)?.label || lastTag;
      const metrics = buildStudentAreaMetrics(
        stats,
        groupBy,
        groupFields,
        { key: "", direction: "desc" },
        { singleStudent: { name: student, roll: rollNumber } },
      );
      const key = `${rollNumber}|${student}`;
      const entry = metrics.get(key);
      const rows = entry?.rows || [];
      const map = new Map<string, { total: number; fail: number }>();
      for (const r of rows) {
        const parts = String((r as any).area || "")
          .split("/")
          .map((s) => s.trim());
        const lastPart = parts[parts.length - 1] || "";
        const m = lastPart.match(/^([^:]+):\s*(.+)$/);
        const val = m && m[1].trim() === headerLabel ? m[2].trim() : lastPart;
        const agg = map.get(val) || { total: 0, fail: 0 };
        agg.total += (r as any).total || 0;
        const incorrect = (r as any).incorrect || 0;
        const unattempted = (r as any).unattempted || 0;
        agg.fail += incorrect + unattempted;
        map.set(val, agg);
      }
      const rowsOut = Array.from(map.entries()).map(([tag, v]) => {
        const pct =
          v.total > 0 ? Number(((v.fail / v.total) * 100).toFixed(2)) : 0;
        const category =
          pct < 25
            ? "Healthy"
            : pct < 40
              ? "Needs Attention"
              : pct < 50
                ? "Re-teach Recommended"
                : "Re-teach Mandatory";
        const action =
          category === "Healthy"
            ? "No re-teach; offer enrichment or quick doubt clearing."
            : category === "Needs Attention"
              ? "Targeted revision; revisit tricky steps and misconceptions."
              : category === "Re-teach Recommended"
                ? "Partial re-teach; try different explanations and more examples."
                : "Full re-teach; restart fundamentals with visuals/analogies.";
        return { tag, failPct: pct, category, action };
      });
      rowsOut.sort((a, b) => b.failPct - a.failPct);
      return rowsOut;
    } catch {
      return [] as any[];
    }
  }, [stats, groupBy, groupFields, classLevel, student, rollNumber]);

  const lastLabel = React.useMemo(() => {
    if (!Array.isArray(groupBy) || groupBy.length === 0) return "Tag";
    const last = groupBy[groupBy.length - 1];
    return groupFields.find((f) => f.value === last)?.label || last || "Tag";
  }, [groupBy, groupFields]);

  // Compute class-only insights (for comparison when viewing a single student)
  const classInsights = React.useMemo(() => {
    if (!classStatsCompare || !Array.isArray(groupBy) || groupBy.length === 0)
      return [] as Array<{ tag: string; failPct: number }>;
    try {
      return computeInsightsForLastTag(classStatsCompare, groupBy, groupFields);
    } catch {
      return [] as any[];
    }
  }, [classStatsCompare, groupBy, groupFields]);

  // Merge student vs class for comparison table (only in single-student mode)
  const compareRows = React.useMemo(() => {
    if (classLevel)
      return [] as Array<{
        tag: string;
        studentCorrect: number | null;
        classCorrect: number | null;
        gap: number | null;
        category: string;
        action: string;
      }>;
    const clsMap = new Map<string, number>(); // tag -> class fail %
    (classInsights || []).forEach((c) => clsMap.set(c.tag, c.failPct));
    const rows = (insights || []).map((s: any) => {
      const studentCorrect = Number((100 - (s.failPct || 0)).toFixed(2));
      const cFail = clsMap.has(s.tag) ? (clsMap.get(s.tag) as number) : null;
      const classCorrect =
        cFail === null ? null : Number((100 - cFail).toFixed(2));
      const gap =
        classCorrect === null
          ? null
          : Number((studentCorrect - classCorrect).toFixed(2));
      return {
        tag: s.tag as string,
        studentCorrect,
        classCorrect,
        gap,
        category: s.category as string,
        action: s.action as string,
      };
    });
    // Sort worst gap first (most negative)
    rows.sort((a, b) => {
      const ag = a.gap ?? Infinity;
      const bg = b.gap ?? Infinity;
      return ag - bg;
    });
    return rows;
  }, [classLevel, classInsights, insights]);

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

  const hasActiveQuestionFilters =
    selectedClassId !== "all" || selectedSubjectId !== "all";

  const activeFiltersLabel =
    [
      selectedClassId !== "all"
        ? classOptions.find((option) => option.value === selectedClassId)
            ?.label || "Filtered class"
        : null,
      selectedSubjectId !== "all"
        ? subjectOptions.find((option) => option.value === selectedSubjectId)
            ?.label || "Filtered subject"
        : null,
    ]
      .filter(Boolean)
      .join(" • ") || "All questions";

  useEffect(() => {
    (async () => {
      const sk = getSchoolFromCookie();
      setSchoolKey(sk);
      if (!sk) {
        setLoading(false);
        setError("Please select a school in the navbar to load analytics.");
        return;
      }
      try {
        const res = await fetch(
          `/api/analytics/student-tag-report/${params.responseId}?groupFields=1&school=${encodeURIComponent(sk)}`,
          { cache: "no-store" },
        );
        if (!res.ok)
          throw new Error(`groupFields fetch failed: HTTP ${res.status}`);
        const data: any = await res.json().catch(() => ({}));
        setGroupFields(Array.isArray(data?.fields) ? data.fields : []);
        setClassOptions(
          Array.isArray(data?.filters?.classes) ? data.filters.classes : [],
        );
        setSubjectOptions(
          Array.isArray(data?.filters?.subjects) ? data.filters.subjects : [],
        );
        if (
          Array.isArray(data?.fields) &&
          data.fields.some((f: any) => f.value === "section")
        ) {
          const sectionIdx = data.fields.findIndex(
            (f: any) => f.value === "section",
          );
          const selected = [
            data.fields[sectionIdx]?.value,
            data.fields[sectionIdx + 1]?.value,
            data.fields[sectionIdx + 2]?.value,
          ].filter(Boolean);
          setGroupBy(selected);
        } else if (Array.isArray(data?.fields) && data.fields.length) {
          setGroupBy(data.fields.slice(0, 3).map((f: any) => f.value));
        }
      } catch (e) {
        console.error("[student-tag-report] failed to load groupFields", e);
        setGroupFields([]);
        setClassOptions([]);
        setSubjectOptions([]);
      }
    })();
  }, [params.responseId]);

  // Fetch analytics only after groupBy is set for the first time
  useEffect(() => {
    // Only fetch if groupBy is set and we haven't fetched yet
    if (groupBy.length && !hasFetchedOnce) {
      fetchAnalytics();
      setHasFetchedOnce(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy, hasFetchedOnce]);

  // Reset pagination on key changes
  useEffect(() => {
    setCmpPage(1);
    setInsPage(1);
  }, [groupBy, classLevel, selectedClassId, selectedSubjectId]);

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

  const fetchAnalytics = (overrides?: {
    classId?: string;
    subjectId?: string;
  }) => {
    setLoading(true);
    setError(null);
    const resolvedClassId = overrides?.classId ?? selectedClassId;
    const resolvedSubjectId = overrides?.subjectId ?? selectedSubjectId;
    const searchParams = new URLSearchParams();
    searchParams.set("json", "1");
    if (groupBy.length) searchParams.set("groupBy", groupBy.join(","));
    if (classLevel) searchParams.set("classLevel", "1");
    if (resolvedClassId !== "all") searchParams.set("classId", resolvedClassId);
    if (resolvedSubjectId !== "all")
      searchParams.set("subjectId", resolvedSubjectId);
    // Ensure we pass the tenant explicitly
    const sk = schoolKey || getSchoolFromCookie();
    if (!sk) {
      setLoading(false);
      setError("Please select a school in the navbar to load analytics.");
      return;
    }
    searchParams.set("school", sk);
    // Primary fetch (student or class depending on toggle)
    fetch(
      `/api/analytics/student-tag-report/${params.responseId}?${searchParams.toString()}`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStats(data.stats || {});
          setStudent(data.student || "");
          setRollNumber(data.rollNumber || "");
          setPaper(data.paper || "");
        } else {
          setError(data.message || "Failed to fetch tag report");
        }
      })
      .catch(() => setError("An unexpected network error occurred."))
      .finally(() => setLoading(false));

    // Always prefetch class-level stats for comparison when in single-student mode
    try {
      const classParams = new URLSearchParams();
      classParams.set("json", "1");
      if (groupBy.length) classParams.set("groupBy", groupBy.join(","));
      classParams.set("classLevel", "1");
      if (resolvedClassId !== "all")
        classParams.set("classId", resolvedClassId);
      if (resolvedSubjectId !== "all")
        classParams.set("subjectId", resolvedSubjectId);
      classParams.set("school", sk);
      fetch(
        `/api/analytics/student-tag-report/${params.responseId}?${classParams.toString()}`,
      )
        .then((res) => res.json())
        .then((data) => {
          if (data?.success) setClassStatsCompare(data.stats || {});
          else setClassStatsCompare({});
        })
        .catch(() => setClassStatsCompare({}));
    } catch {
      setClassStatsCompare({});
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="analytics-page">
      <div className="container space-y-4 sm:space-y-5">
        <ReportHeader
          student={student}
          rollNumber={rollNumber}
          paper={paper}
          variant={classLevel ? "class" : "student"}
        />
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
              </div>
            </div>
          </div>
          <div className="space-y-3 p-3 sm:p-4">
            <div className="analytics-toolbar">
              <div className="analytics-toolbar-row">
                <div className="analytics-toolbar-copy">
                  <p className="analytics-toolbar-title">Quick setup</p>
                  <p className="analytics-toolbar-note">
                    Adjust filters, grouping, and mode.
                  </p>
                </div>
                <div className="analytics-toolbar-actions">
                  <button
                    type="button"
                    onClick={() => setShowControls((value) => !value)}
                    aria-expanded={showControls}
                    className="app-button-secondary h-9 px-3"
                  >
                    {showControls ? "Hide full setup" : "Adjust setup"}
                  </button>
                  <button
                    type="button"
                    onClick={() => fetchAnalytics()}
                    disabled={loading}
                    className="app-button-primary h-9 px-3"
                  >
                    {loading
                      ? "Refreshing report..."
                      : classLevel
                        ? "Refresh class report"
                        : "Refresh student report"}
                  </button>
                </div>
              </div>
              <div className="analytics-toolbar-row">
                <div className="analytics-toolbar-meta">
                  <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                    {classLevel ? "Class mode" : "Student mode"}
                  </span>
                  <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                    {view === "table" ? "Table" : "Charts"}
                  </span>
                  <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                    {activeFiltersLabel}
                  </span>
                </div>
                <div className="analytics-toolbar-actions">
                  <label className="analytics-checkbox-card w-full justify-between sm:w-auto sm:justify-start">
                    <input
                      type="checkbox"
                      checked={showTagsColumn}
                      onChange={() => setShowTagsColumn((value) => !value)}
                      className="analytics-inline-check"
                    />
                    <span>Show tags column</span>
                  </label>
                  <label className="analytics-checkbox-card w-full justify-between sm:w-auto sm:justify-start">
                    <input
                      type="checkbox"
                      checked={showOptionTagsColumn}
                      onChange={() =>
                        setShowOptionTagsColumn((value) => !value)
                      }
                      className="analytics-inline-check"
                    />
                    <span>Show option tags column</span>
                  </label>
                </div>
              </div>
            </div>

            {showControls ? (
              <div className="analytics-controls-grid">
                <div className="analytics-control-stack">
                  <div className="analytics-control-panel">
                    <div className="analytics-control-panel-header">
                      <p className="analytics-control-panel-title">
                        Analysis Mode
                      </p>
                      <p className="analytics-control-panel-note">
                        Choose student or class mode.
                      </p>
                    </div>
                    <div className="analytics-mode-grid">
                      <button
                        type="button"
                        onClick={() => setClassLevel(false)}
                        className={`analytics-mode-card ${
                          !classLevel ? "analytics-mode-card-active" : ""
                        }`}
                      >
                        <p className="text-sm font-semibold text-foreground">
                          Single student
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Focus on one response and compare it against the
                          class.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setClassLevel(true)}
                        className={`analytics-mode-card ${
                          classLevel ? "analytics-mode-card-active" : ""
                        }`}
                      >
                        <p className="text-sm font-semibold text-foreground">
                          Class level
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Review the full class without the individual
                          comparison layer.
                        </p>
                      </button>
                    </div>
                  </div>

                  <div className="analytics-control-panel">
                    <div className="analytics-control-panel-header">
                      <p className="analytics-control-panel-title">
                        Question filters
                      </p>
                      <p className="analytics-control-panel-note">
                        Filter by class or subject.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="app-field-group">
                        <label className="app-field-label">Class filter</label>
                        <select
                          className="analytics-select w-full"
                          value={selectedClassId}
                          onChange={(event) =>
                            setSelectedClassId(event.target.value)
                          }
                        >
                          <option value="all">All classes</option>
                          {classOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="app-field-group">
                        <label className="app-field-label">
                          Subject filter
                        </label>
                        <select
                          className="analytics-select w-full"
                          value={selectedSubjectId}
                          onChange={(event) =>
                            setSelectedSubjectId(event.target.value)
                          }
                        >
                          <option value="all">All subjects</option>
                          {subjectOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="analytics-toolbar-chip">
                        {selectedClassId === "all"
                          ? "All classes"
                          : `Class: ${
                              classOptions.find(
                                (option) => option.value === selectedClassId,
                              )?.label || "Filtered class"
                            }`}
                      </span>
                      <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                        {selectedSubjectId === "all"
                          ? "All subjects"
                          : `Subject: ${
                              subjectOptions.find(
                                (option) => option.value === selectedSubjectId,
                              )?.label || "Filtered subject"
                            }`}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fetchAnalytics()}
                        disabled={loading}
                        className="app-button-secondary h-9 px-3"
                      >
                        {loading ? "Applying..." : "Apply question filters"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClassId("all");
                          setSelectedSubjectId("all");
                          fetchAnalytics({ classId: "all", subjectId: "all" });
                        }}
                        disabled={loading || !hasActiveQuestionFilters}
                        className="app-button-secondary h-9 px-3"
                      >
                        Clear filters
                      </button>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      Active filters: {activeFiltersLabel}
                    </p>
                  </div>
                </div>

                <div className="analytics-control-panel">
                  <div className="analytics-control-panel-header">
                    <p className="analytics-control-panel-title">
                      Group By (in order)
                    </p>
                    <p className="analytics-control-panel-note">
                      Select and reorder fields.
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

        {!classLevel && compareRows.length > 0 && (
          <div className="analytics-card analytics-card-body border-l-4 border-[hsl(var(--accent-blue))]">
            <div className="analytics-toolbar">
              <div className="analytics-toolbar-row">
                <div className="analytics-toolbar-copy">
                  <h2 className="analytics-card-title">
                    Insights (Student • {lastLabel})
                  </h2>
                  <p className="analytics-toolbar-note">
                    Student vs class comparison.
                  </p>
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
                const total = compareRows.length;
                const maxPage = Math.max(1, Math.ceil(total / cmpPageSize));
                const safePage = Math.min(cmpPage, maxPage);
                const start = (safePage - 1) * cmpPageSize;
                const end = Math.min(total, start + cmpPageSize);
                const visible = cmpShowAll
                  ? compareRows
                  : compareRows.slice(start, end);
                const rangeLabel = cmpShowAll
                  ? `Showing all ${total}`
                  : `Showing ${total === 0 ? 0 : start + 1}–${end} of ${total}`;
                return (
                  <>
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="analytics-th">{lastLabel}</th>
                          <th className="analytics-th-center">
                            Student Correct (%)
                          </th>
                          <th className="analytics-th-center">
                            Class Correct (%)
                          </th>
                          <th className="analytics-th-center">Gap (%)</th>
                          <th className="analytics-th">Category</th>
                          <th className="analytics-th">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((r) => {
                          const gapClass =
                            r.gap == null
                              ? "text-muted-foreground"
                              : r.gap > 0
                                ? "text-emerald-600"
                                : r.gap < 0
                                  ? "text-rose-600"
                                  : "text-foreground";
                          return (
                            <tr key={r.tag} className="analytics-row">
                              <td className="analytics-td">{r.tag}</td>
                              <td className="analytics-td-center">
                                {r.studentCorrect?.toFixed(2)}
                              </td>
                              <td className="analytics-td-center">
                                {r.classCorrect == null
                                  ? "-"
                                  : r.classCorrect.toFixed(2)}
                              </td>
                              <td
                                className={`analytics-td-center font-medium ${gapClass}`}
                              >
                                {r.gap == null ? "-" : r.gap.toFixed(2)}
                              </td>
                              <td className="analytics-td">{r.category}</td>
                              <td className="analytics-td">{r.action}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="border-t border-border/60 bg-muted/20 p-4">
                      <div className="analytics-toolbar-row">
                        <div className="analytics-toolbar-actions">
                          <label className="analytics-checkbox-card">
                            <input
                              type="checkbox"
                              className="analytics-inline-check"
                              checked={cmpShowAll}
                              onChange={() => {
                                setCmpShowAll((v) => !v);
                                setCmpPage(1);
                              }}
                            />
                            <span>Show all rows</span>
                          </label>
                          {!cmpShowAll && total > 0 && (
                            <label className="analytics-checkbox-card">
                              <span className="text-muted-foreground">
                                Rows per page
                              </span>
                              <select
                                className="analytics-select h-8"
                                value={cmpPageSize}
                                onChange={(e) => {
                                  setCmpPageSize(Number(e.target.value));
                                  setCmpPage(1);
                                }}
                              >
                                {[10, 12, 25, 50].map((n) => (
                                  <option key={n} value={n}>
                                    {n}
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
                          {!cmpShowAll && total > cmpPageSize && (
                            <>
                              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                                Page {safePage} of {maxPage}
                              </span>
                              <button
                                type="button"
                                className="analytics-pagination-button"
                                onClick={() =>
                                  setCmpPage((p) => Math.max(1, p - 1))
                                }
                                disabled={safePage <= 1}
                              >
                                Previous
                              </button>
                              <button
                                type="button"
                                className="analytics-pagination-button"
                                onClick={() =>
                                  setCmpPage((p) => Math.min(maxPage, p + 1))
                                }
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

        {((classLevel && insights && insights.length > 0) ||
          (!classLevel &&
            compareRows.length === 0 &&
            insights &&
            insights.length > 0)) && (
          <div className="analytics-card analytics-card-body border-l-4 border-rose-400">
            <div className="analytics-toolbar">
              <div className="analytics-toolbar-row">
                <div className="analytics-toolbar-copy">
                  <h2 className="analytics-card-title">
                    Insights ({classLevel ? "Class" : "Student"} • {lastLabel})
                  </h2>
                  <p className="analytics-toolbar-note">Weakest areas first.</p>
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
                const visible = insShowAll
                  ? insights
                  : insights.slice(start, end);
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
                                setInsShowAll((v) => !v);
                                setInsPage(1);
                              }}
                            />
                            <span>Show all rows</span>
                          </label>
                          {!insShowAll && total > 0 && (
                            <label className="analytics-checkbox-card">
                              <span className="text-muted-foreground">
                                Rows per page
                              </span>
                              <select
                                className="analytics-select h-8"
                                value={insPageSize}
                                onChange={(e) => {
                                  setInsPageSize(Number(e.target.value));
                                  setInsPage(1);
                                }}
                              >
                                {[10, 12, 25, 50].map((n) => (
                                  <option key={n} value={n}>
                                    {n}
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
                                onClick={() =>
                                  setInsPage((p) => Math.max(1, p - 1))
                                }
                                disabled={safePage <= 1}
                              >
                                Previous
                              </button>
                              <button
                                type="button"
                                className="analytics-pagination-button"
                                onClick={() =>
                                  setInsPage((p) => Math.min(maxPage, p + 1))
                                }
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
              <p className="analytics-toolbar-note">
                Switch between table and charts.
              </p>
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
          </div>
        </div>
        {view === "table" ? (
          <div className="analytics-table-shell">
            <div className="border-b border-border/60 bg-muted/20 p-4 sm:p-5">
              <div className="analytics-toolbar-row gap-4">
                <div className="analytics-toolbar-copy">
                  <h2 className="analytics-card-title">Grouped Analytics</h2>
                  <p className="analytics-toolbar-note">
                    Grouped performance summary.
                  </p>
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
                  mode={classLevel ? "class" : "student"}
                  paperTitle={paper}
                  studentName={student}
                  rollNumber={rollNumber}
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
                      handleTagSelect={(tag: { type: string; value: string }) =>
                        setSelectedTags((prev) =>
                          prev.some(
                            (t) => t.type === tag.type && t.value === tag.value,
                          )
                            ? prev.filter(
                                (t) =>
                                  !(
                                    t.type === tag.type && t.value === tag.value
                                  ),
                              )
                            : [...prev, tag],
                        )
                      }
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
        ) : (
          <ChartView
            stats={stats}
            groupBy={groupBy}
            groupFields={groupFields}
            paperTitle={paper}
            mode={classLevel ? "class" : "student"}
            studentName={student}
            rollNumber={rollNumber}
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
