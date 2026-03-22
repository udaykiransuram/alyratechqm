"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useState, useRef } from "react";
import LoadingState from "@/components/analytics/LoadingState";
import ErrorState from "@/components/analytics/ErrorState";
import ReportHeader from "@/components/analytics/ReportHeader";
import StatsTable from "@/components/analytics/StatsTable";
import {
  sortStatsRows,
  getConsolidatedStudentList,
  computeInsightsForLastTag,
  buildStudentAreaMetrics,
} from "@/components/analytics/helpers";
import { Button } from "@/components/ui/button";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { ArrowLeft } from "lucide-react";
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";

const REPORT_CACHE_TTL_MS = 15_000;
const REPORT_SETUP_CACHE_TTL_MS = 60_000;

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

type ReportFilterOption = {
  value: string;
  label: string;
};

type StudentTagReportPageProps = {
  params: { responseId: string };
  portalMode?: "admin" | "student";
  defaultBackHref?: string;
};

export function StudentTagReportPageView({
  params,
  portalMode = "admin",
  defaultBackHref,
}: StudentTagReportPageProps) {
  const isStudentPortal = portalMode === "student";
  const fallbackBackHref = defaultBackHref || (isStudentPortal ? "/student/account" : "/workspace/students");
  const { navigateBack } = useBackNavigation(fallbackBackHref);
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
  const [academicSectionOptions, setAcademicSectionOptions] = useState<
    ReportFilterOption[]
  >([]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [selectedSubjectId, setSelectedSubjectId] = useState("all");
  const [selectedAcademicSectionId, setSelectedAcademicSectionId] =
    useState("all");

  // Track tenant (school) explicitly to make API calls DB-specific
  const [schoolKey, setSchoolKey] = useState<string>("");

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

  const activeModeLabel = classLevel ? "Class mode" : "Student mode";

  const activeViewLabel = view === "table" ? "Table" : "Charts";

  const hasActiveFilters =
    selectedClassId !== "all" ||
    selectedSubjectId !== "all" ||
    selectedAcademicSectionId !== "all";

  const activeFiltersLabel =
    [
      selectedClassId !== "all"
        ? `Class: ${
            classOptions.find((option) => option.value === selectedClassId)
              ?.label || "Filtered class"
          }`
        : null,
      selectedSubjectId !== "all"
        ? `Subject: ${
            subjectOptions.find((option) => option.value === selectedSubjectId)
              ?.label || "Filtered subject"
          }`
        : null,
      selectedAcademicSectionId !== "all"
        ? `Section: ${
            academicSectionOptions.find(
              (option) => option.value === selectedAcademicSectionId,
            )?.label || "Filtered section"
          }`
        : null,
    ]
      .filter(Boolean)
      .join(" • ") || "All questions and sections";

  useEffect(() => {
    if (isStudentPortal && classLevel) {
      setClassLevel(false);
    }
  }, [classLevel, isStudentPortal]);

  useEffect(() => {
    void (async () => {
      const sk = resolveClientSchoolKey();
      setSchoolKey(sk);
      if (!sk) {
        setLoading(false);
        setError("Please select a school in the navbar to load analytics.");
        return;
      }
      try {
        const data = await fetchApiJson<any>(
          `/api/analytics/student-tag-report/${params.responseId}?groupFields=1`,
          {
            cache: "no-store",
            schoolKey: sk,
            fallbackMessage: "Failed to load report setup.",
            clientCacheTtlMs: REPORT_SETUP_CACHE_TTL_MS,
            preferClientCache: true,
          },
        );
        setGroupFields(Array.isArray(data?.fields) ? data.fields : []);
        setClassOptions(
          Array.isArray(data?.filters?.classes) ? data.filters.classes : [],
        );
        setSubjectOptions(
          Array.isArray(data?.filters?.subjects) ? data.filters.subjects : [],
        );
        setAcademicSectionOptions(
          Array.isArray(data?.filters?.academicSections)
            ? data.filters.academicSections
            : [],
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
        } else {
          throw new Error("No analytics fields are available for this response yet.");
        }
      } catch (e: any) {
        console.error("[student-tag-report] failed to load groupFields", e);
        setGroupFields([]);
        setClassOptions([]);
        setSubjectOptions([]);
        setAcademicSectionOptions([]);
        setLoading(false);
        setError(e?.message || "Failed to load report setup.");
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
  }, [groupBy, classLevel, selectedClassId, selectedSubjectId, selectedAcademicSectionId]);

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

  const fetchAnalytics = async (overrides?: {
    classId?: string;
    subjectId?: string;
    academicSectionId?: string;
  }) => {
    setLoading(true);
    setError(null);
    const resolvedClassId = overrides?.classId ?? selectedClassId;
    const resolvedSubjectId = overrides?.subjectId ?? selectedSubjectId;
    const resolvedAcademicSectionId =
      overrides?.academicSectionId ?? selectedAcademicSectionId;
    const searchParams = new URLSearchParams();
    searchParams.set("json", "1");
    if (groupBy.length) searchParams.set("groupBy", groupBy.join(","));
    if (classLevel) searchParams.set("classLevel", "1");
    if (resolvedClassId !== "all") searchParams.set("classId", resolvedClassId);
    if (resolvedSubjectId !== "all") {
      searchParams.set("subjectId", resolvedSubjectId);
    }
    if (classLevel && resolvedAcademicSectionId !== "all") {
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
        `/api/analytics/student-tag-report/${params.responseId}?${searchParams.toString()}`,
        {
          cache: "no-store",
          schoolKey: sk,
          fallbackMessage: "Failed to fetch tag report.",
          clientCacheTtlMs: REPORT_CACHE_TTL_MS,
          preferClientCache: true,
        },
      );
      setStats(data.stats || {});
      setStudent(data.student || "");
      setRollNumber(data.rollNumber || "");
      setPaper(data.paper || "");
    } catch (fetchError: any) {
      setError(fetchError?.message || "An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }

    if (isStudentPortal) {
      setClassStatsCompare({});
      return;
    }

    try {
      const classParams = new URLSearchParams();
      classParams.set("json", "1");
      if (groupBy.length) classParams.set("groupBy", groupBy.join(","));
      classParams.set("classLevel", "1");
      if (resolvedClassId !== "all") {
        classParams.set("classId", resolvedClassId);
      }
      if (resolvedSubjectId !== "all") {
        classParams.set("subjectId", resolvedSubjectId);
      }
      if (resolvedAcademicSectionId !== "all") {
        classParams.set("academicSectionId", resolvedAcademicSectionId);
      }
      const compareData = await fetchApiJson<any>(
        `/api/analytics/student-tag-report/${params.responseId}?${classParams.toString()}`,
        {
          cache: "no-store",
          schoolKey: sk,
          fallbackMessage: "Failed to load class comparison.",
          clientCacheTtlMs: REPORT_CACHE_TTL_MS,
          preferClientCache: true,
        },
      );
      setClassStatsCompare(compareData.stats || {});
    } catch {
      setClassStatsCompare({});
    }
  };

  const backAction = (
    <Button variant="outline" onClick={navigateBack} className="gap-2">
      <ArrowLeft className="h-4 w-4" />
      {isStudentPortal ? "Back to Account" : "Back"}
    </Button>
  );

  if (loading) return <LoadingState actions={backAction} />;
  if (error) return <ErrorState message={error} actions={backAction} />;

  return (
    <div className="analytics-page">
      <div className="w-full space-y-4 px-4 sm:space-y-5 sm:px-5 lg:px-6">
        <ReportHeader
          student={student}
          rollNumber={rollNumber}
          paper={paper}
          variant={classLevel ? "class" : "student"}
          actions={backAction}
        />
        <div className="analytics-card overflow-hidden">
          <div className="analytics-card-header">
            <div className="analytics-toolbar-row gap-4">
              <div className="analytics-toolbar-copy">
                <h2 className="analytics-card-title">Report Controls</h2>
                <p className="analytics-card-description">
                  Align setup, grouping, and filters before reviewing the
                  student report.
                </p>
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
              <div className="analytics-setup-bar">
                <div className="analytics-toolbar-copy">
                  <p className="analytics-toolbar-title">Quick setup</p>
                  <p className="analytics-toolbar-note">
                    Review the active mode, visible metrics, and current
                    question scope before refreshing the report.
                  </p>
                </div>
                <div className="analytics-setup-actions">
                  <button
                    type="button"
                    onClick={() => setShowControls((value) => !value)}
                    aria-expanded={showControls}
                    className="analytics-action-button-secondary w-full sm:w-auto"
                  >
                    {showControls ? "Hide setup" : "Setup"}
                  </button>
                  <button
                    type="button"
                    onClick={() => fetchAnalytics()}
                    disabled={loading}
                    className="analytics-action-button-primary w-full sm:w-auto"
                  >
                    {loading
                      ? "Refreshing report..."
                      : classLevel
                        ? "Refresh class report"
                        : "Refresh student report"}
                  </button>
                </div>
              </div>
              <div className="analytics-setup-grid">
                <div className="analytics-setup-summary-grid">
                  <div className="analytics-setup-summary-card">
                    <p className="analytics-setup-summary-label">
                      Report mode
                    </p>
                    <div className="analytics-setup-summary-value">
                      <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                        {activeModeLabel}
                      </span>
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
                      Current scope
                    </p>
                    <div className="analytics-setup-summary-value">
                      <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                        {activeFiltersLabel}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="analytics-setup-toggle-grid">
                  <label className="analytics-setup-toggle-card analytics-checkbox-card-split">
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
                  <label className="analytics-setup-toggle-card analytics-checkbox-card-split">
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

            {showControls ? (
              <div className="analytics-controls-grid">
                <div className="analytics-control-stack">
                  {!isStudentPortal ? (
                    <div className="analytics-control-panel">
                      <div className="analytics-control-panel-header">
                        <p className="analytics-control-panel-title">
                          Analysis Mode
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
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="analytics-control-panel">
                    <div className="analytics-control-panel-header">
                      <p className="analytics-control-panel-title">
                        Report filters
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                      <div className="app-field-group">
                        <label className="app-field-label">
                          Academic section filter
                        </label>
                        <select
                          className="analytics-select w-full"
                          value={selectedAcademicSectionId}
                          onChange={(event) =>
                            setSelectedAcademicSectionId(event.target.value)
                          }
                        >
                          <option value="all">All sections</option>
                          {academicSectionOptions.map((option) => (
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
                      <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                        {selectedAcademicSectionId === "all"
                          ? "All sections"
                          : `Section: ${
                              academicSectionOptions.find(
                                (option) =>
                                  option.value === selectedAcademicSectionId,
                              )?.label || "Filtered section"
                            }`}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fetchAnalytics()}
                        disabled={loading}
                        className="analytics-action-button-secondary"
                      >
                        {loading ? "Applying..." : "Apply question filters"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClassId("all");
                          setSelectedSubjectId("all");
                          setSelectedAcademicSectionId("all");
                          fetchAnalytics({
                            classId: "all",
                            subjectId: "all",
                            academicSectionId: "all",
                          });
                        }}
                        disabled={loading || !hasActiveFilters}
                        className="analytics-action-button-secondary"
                      >
                        Clear filters
                      </button>
                    </div>
                  </div>
                </div>

                <div className="analytics-control-panel">
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
                                className="analytics-action-button-icon"
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
                                className="analytics-action-button-icon"
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

        {!isStudentPortal && !classLevel && compareRows.length > 0 && (
          <div className="analytics-card analytics-card-body border-l-4 border-[hsl(var(--accent-blue))]">
            <div className="analytics-toolbar">
              <div className="analytics-toolbar-row">
                <div className="analytics-toolbar-copy">
                  <h2 className="analytics-card-title">
                    Insights (Student • {lastLabel})
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
                                className="analytics-select-compact"
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
                                className="analytics-select-compact"
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

        <div className="analytics-toolbar">
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
