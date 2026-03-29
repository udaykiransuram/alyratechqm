"use client";

import React, { useEffect, useState, useRef } from "react";
import LoadingState from "@/components/analytics/LoadingState";
import ErrorState from "@/components/analytics/ErrorState";
import ReportHeader from "@/components/analytics/ReportHeader";
import StatsTable from "@/components/analytics/StatsTable";
import ComparisonInsightsCard from "@/components/analytics/insights/ComparisonInsightsCard";
import FailInsightsCard from "@/components/analytics/insights/FailInsightsCard";
import {
  AnalyticsChartView,
  AnalyticsExportControls,
  AnalyticsOptionTagModal,
  AnalyticsQuestionListModal,
  AnalyticsStudentTagReportSetupControls,
} from "@/components/analytics/report-client-lazy";
import {
  computeInsightsForLastTag,
  buildStudentAreaMetrics,
} from "@/components/analytics/helpers";
import { Button } from "@/components/ui/button";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { ArrowLeft } from "lucide-react";
import { reconcileAnalyticsGroupBy } from "@/lib/analytics/group-by";
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";
import type { StudentTagReportPageBootstrap } from "@/lib/analytics/student-tag-report-page";

const REPORT_CACHE_TTL_MS = 15_000;
const REPORT_SETUP_CACHE_TTL_MS = 60_000;

type ReportFilterOption = {
  value: string;
  label: string;
};

type StudentTagReportPageProps = {
  params: { responseId: string };
  portalMode?: "admin" | "student";
  defaultBackHref?: string;
  initialBootstrap?: StudentTagReportPageBootstrap | null;
};

function reconcileGroupBy(
  current: string[],
  fields: { value: string; label: string }[],
  options?: {
    requiredFieldValues?: string[];
  },
) {
  return reconcileAnalyticsGroupBy(current, fields, options);
}

export function StudentTagReportPageView({
  params,
  portalMode = "admin",
  defaultBackHref,
  initialBootstrap = null,
}: StudentTagReportPageProps) {
  const isStudentPortal = portalMode === "student";
  const fallbackBackHref = defaultBackHref || (isStudentPortal ? "/student/account" : "/workspace/students");
  const { navigateBack } = useBackNavigation(fallbackBackHref);
  const [stats, setStats] = useState<any>(initialBootstrap?.stats || {});
  const [student, setStudent] = useState<string>(initialBootstrap?.student || "");
  const [rollNumber, setRollNumber] = useState<string>(initialBootstrap?.rollNumber || "");
  const [paper, setPaper] = useState<string>(initialBootstrap?.paper || "");
  const [loading, setLoading] = useState(!initialBootstrap);
  const [error, setError] = useState<string | null>(initialBootstrap?.error || null);

  const [groupFields, setGroupFields] = useState<
    { value: string; label: string }[]
  >(initialBootstrap?.groupFields || []);
  const [groupBy, setGroupBy] = useState<string[]>(initialBootstrap?.groupBy || []);
  const [classLevel, setClassLevel] = useState(false);
  const [classOptions, setClassOptions] = useState<ReportFilterOption[]>(
    initialBootstrap?.classOptions || [],
  );
  const [subjectOptions, setSubjectOptions] = useState<ReportFilterOption[]>(
    initialBootstrap?.subjectOptions || [],
  );
  const [academicSectionOptions, setAcademicSectionOptions] = useState<
    ReportFilterOption[]
  >(initialBootstrap?.academicSectionOptions || []);
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
  const [hasFetchedOnce, setHasFetchedOnce] = useState(
    Boolean(initialBootstrap && !initialBootstrap.error && initialBootstrap.groupBy.length > 0),
  );
  const [showControls, setShowControls] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);

  // For student vs class comparison
  const [classStatsCompare, setClassStatsCompare] = useState<any>(
    initialBootstrap?.classStatsCompare || {},
  );

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
  const searchableClassOptions = React.useMemo(
    () => [
      {
        value: "all",
        label: "All classes",
        description: "Review report data across every class.",
      },
      ...classOptions,
    ],
    [classOptions],
  );
  const searchableSubjectOptions = React.useMemo(
    () => [
      {
        value: "all",
        label: "All subjects",
        description: "Keep the report scoped to every subject.",
      },
      ...subjectOptions,
    ],
    [subjectOptions],
  );
  const searchableAcademicSectionOptions = React.useMemo(
    () => [
      {
        value: "all",
        label: "All sections",
        description: "Review every academic section together.",
      },
      ...academicSectionOptions,
    ],
    [academicSectionOptions],
  );

  const activeClassLabel =
    selectedClassId !== "all"
      ? classOptions.find((option) => option.value === selectedClassId)?.label ||
        "Filtered class"
      : "All classes";
  const activeSubjectLabel =
    selectedSubjectId !== "all"
      ? subjectOptions.find((option) => option.value === selectedSubjectId)
          ?.label || "Filtered subject"
      : "All subjects";
  const activeAcademicSectionLabel =
    selectedAcademicSectionId !== "all"
      ? academicSectionOptions.find(
          (option) => option.value === selectedAcademicSectionId,
        )?.label || "Filtered section"
      : "All class sections";

  const activeFiltersLabel =
    [
      selectedClassId !== "all" ? `Class: ${activeClassLabel}` : null,
      selectedSubjectId !== "all" ? `Subject: ${activeSubjectLabel}` : null,
      selectedAcademicSectionId !== "all"
        ? `Section: ${activeAcademicSectionLabel}`
        : null,
    ]
      .filter(Boolean)
      .join(" • ") || "All questions and sections";

  const headerSummaryBadges = [
    activeModeLabel,
    groupingPreviewLabel,
    activeFiltersLabel,
  ];
  const outputTitle = view === "table" ? "Grouped Analytics" : "Chart View";
  const outputNote =
    view === "table"
      ? "Switch views, keep sort context visible, and export the current report from one place."
      : "Scan the same grouped data visually without leaving the report.";
  const outputMetaLabel =
    view === "table" ? activeSortLabel : groupingPreviewLabel;

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
        `/api/analytics/student-tag-report/${params.responseId}?${searchParams.toString()}`,
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
      const nextSubjectOptions = Array.isArray(data?.filters?.subjects)
        ? data.filters.subjects
        : [];
      const nextAcademicSectionOptions = Array.isArray(
        data?.filters?.academicSections,
      )
        ? data.filters.academicSections
        : [];

      if (nextFields.length === 0) {
        throw new Error("No analytics fields are available for this response yet.");
      }

      const baseGroupBy =
        resolvedSubjectId === "all" && nextSubjectOptions.length > 1
          ? []
          : groupBy;
      const nextGroupBy = reconcileGroupBy(baseGroupBy, nextFields, {
        requiredFieldValues:
          resolvedSubjectId === "all" && nextSubjectOptions.length > 1
            ? ["subject"]
            : [],
      });
      setGroupFields(nextFields);
      setClassOptions(nextClassOptions);
      setSubjectOptions(nextSubjectOptions);
      setAcademicSectionOptions(nextAcademicSectionOptions);
      setSelectedClassId((currentValue) =>
        currentValue !== "all" &&
        !nextClassOptions.some(
          (option: ReportFilterOption) => option.value === currentValue,
        )
          ? "all"
          : currentValue,
      );
      setSelectedSubjectId((currentValue) =>
        currentValue !== "all" &&
        !nextSubjectOptions.some(
          (option: ReportFilterOption) => option.value === currentValue,
        )
          ? "all"
          : currentValue,
      );
      setSelectedAcademicSectionId((currentValue) =>
        currentValue !== "all" &&
        !nextAcademicSectionOptions.some(
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
    [groupBy, params.responseId, schoolKey, selectedClassId, selectedSubjectId],
  );

  useEffect(() => {
    if (!initialBootstrap) {
      return;
    }

    setStats(initialBootstrap.stats || {});
    setStudent(initialBootstrap.student || "");
    setRollNumber(initialBootstrap.rollNumber || "");
    setPaper(initialBootstrap.paper || "");
    setError(initialBootstrap.error || null);
    setLoading(false);
    setGroupFields(initialBootstrap.groupFields || []);
    setGroupBy(initialBootstrap.groupBy || []);
    setClassOptions(initialBootstrap.classOptions || []);
    setSubjectOptions(initialBootstrap.subjectOptions || []);
    setAcademicSectionOptions(initialBootstrap.academicSectionOptions || []);
    setSelectedClassId("all");
    setSelectedSubjectId("all");
    setSelectedAcademicSectionId("all");
    setClassStatsCompare(initialBootstrap.classStatsCompare || {});
    setHasFetchedOnce(
      !initialBootstrap.error && initialBootstrap.groupBy.length > 0,
    );
  }, [initialBootstrap, params.responseId]);

  useEffect(() => {
    if (isStudentPortal && classLevel) {
      setClassLevel(false);
    }
  }, [classLevel, isStudentPortal]);

  useEffect(() => {
    const sk = resolveClientSchoolKey();
    setSchoolKey(sk);

    if (initialBootstrap) {
      setLoading(false);
      return;
    }

    void (async () => {
      if (!sk) {
        setLoading(false);
        setError("Please select a school in the navbar to load analytics.");
        return;
      }
      try {
        const searchParams = new URLSearchParams();
        searchParams.set("groupFields", "1");

        const data = await fetchApiJson<any>(
          `/api/analytics/student-tag-report/${params.responseId}?${searchParams.toString()}`,
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
        const nextSubjectOptions = Array.isArray(data?.filters?.subjects)
          ? data.filters.subjects
          : [];
        const nextAcademicSectionOptions = Array.isArray(
          data?.filters?.academicSections,
        )
          ? data.filters.academicSections
          : [];

        if (nextFields.length === 0) {
          throw new Error("No analytics fields are available for this response yet.");
        }

        setGroupFields(nextFields);
        setClassOptions(nextClassOptions);
        setSubjectOptions(nextSubjectOptions);
        setAcademicSectionOptions(nextAcademicSectionOptions);
        setGroupBy(
          reconcileGroupBy([], nextFields, {
            requiredFieldValues:
              nextSubjectOptions.length > 1 ? ["subject"] : [],
          }),
        );
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
  }, [initialBootstrap, params.responseId]);

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

  const fetchAnalytics = React.useCallback(
    async (overrides?: {
      classId?: string;
      subjectId?: string;
      academicSectionId?: string;
      groupBy?: string[];
    }) => {
      setLoading(true);
      setError(null);
      const resolvedClassId = overrides?.classId ?? selectedClassId;
      const resolvedSubjectId = overrides?.subjectId ?? selectedSubjectId;
      const resolvedAcademicSectionId =
        overrides?.academicSectionId ?? selectedAcademicSectionId;
      const resolvedGroupBy = overrides?.groupBy ?? groupBy;
      const normalizedGroupBy = reconcileGroupBy(
        resolvedGroupBy,
        groupFields,
        {
          requiredFieldValues:
            resolvedSubjectId === "all" && subjectOptions.length > 1
              ? ["subject"]
              : [],
        },
      );
      const searchParams = new URLSearchParams();
      searchParams.set("json", "1");
      if (normalizedGroupBy.length) {
        searchParams.set("groupBy", normalizedGroupBy.join(","));
      }
      if (classLevel) searchParams.set("classLevel", "1");
      if (resolvedClassId !== "all") {
        searchParams.set("classId", resolvedClassId);
      }
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

      if (normalizedGroupBy.join(",") !== resolvedGroupBy.join(",")) {
        setGroupBy(normalizedGroupBy);
      }

      let reportData: any = null;
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
        reportData = data;
        setStats(data.stats || {});
        setStudent(data.student || "");
        setRollNumber(data.rollNumber || "");
        setPaper(data.paper || "");
      } catch (fetchError: any) {
        setError(
          fetchError?.message || "An unexpected network error occurred.",
        );
      } finally {
        setLoading(false);
      }

      if (isStudentPortal) {
        setClassStatsCompare({});
        return;
      }

      if (classLevel && reportData?.stats) {
        setClassStatsCompare(reportData.stats || {});
        return;
      }

      try {
        const classParams = new URLSearchParams();
        classParams.set("json", "1");
        if (normalizedGroupBy.length) {
          classParams.set("groupBy", normalizedGroupBy.join(","));
        }
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
    },
    [
      classLevel,
      groupBy,
      groupFields,
      isStudentPortal,
      params.responseId,
      schoolKey,
      selectedAcademicSectionId,
      selectedClassId,
      selectedSubjectId,
      subjectOptions.length,
    ],
  );

  // Fetch analytics only after groupBy is set for the first time.
  useEffect(() => {
    if (groupBy.length && !hasFetchedOnce) {
      void fetchAnalytics();
      setHasFetchedOnce(true);
    }
  }, [fetchAnalytics, groupBy, hasFetchedOnce]);

  const handleApplyFilters = React.useCallback(async () => {
    try {
      const { nextGroupBy } = await loadReportSetup({
        classId: selectedClassId,
        subjectId: selectedSubjectId,
      });
      await fetchAnalytics({
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        academicSectionId: selectedAcademicSectionId,
        groupBy: nextGroupBy,
      });
    } catch (setupError: any) {
      setError(setupError?.message || "Failed to load report setup.");
    }
  }, [
    fetchAnalytics,
    loadReportSetup,
    selectedClassId,
    selectedSubjectId,
    selectedAcademicSectionId,
  ]);

  const handleClearFilters = React.useCallback(async () => {
    setSelectedClassId("all");
    setSelectedSubjectId("all");
    setSelectedAcademicSectionId("all");
    try {
      const { nextGroupBy } = await loadReportSetup({
        classId: "all",
        subjectId: "all",
      });
      await fetchAnalytics({
        classId: "all",
        subjectId: "all",
        academicSectionId: "all",
        groupBy: nextGroupBy,
      });
    } catch (setupError: any) {
      setError(setupError?.message || "Failed to load report setup.");
    }
  }, [fetchAnalytics, loadReportSetup]);

  const backAction = (
    <Button variant="outline" onClick={navigateBack} className="app-button-back">
      <ArrowLeft className="h-4 w-4" />
      {isStudentPortal ? "Back to Account" : "Back"}
    </Button>
  );

  if (loading) return <LoadingState actions={backAction} />;
  if (error) return <ErrorState message={error} actions={backAction} />;

  return (
    <div className="analytics-page">
      <div className="analytics-page-shell">
        <ReportHeader
          student={student}
          rollNumber={rollNumber}
          paper={paper}
          variant={classLevel ? "class" : "student"}
          actions={backAction}
          summaryBadges={headerSummaryBadges}
        />
        <div className="analytics-card analytics-card-body">
          <div className="analytics-setup-bar">
            <div className="analytics-toolbar-copy">
              <h2 className="analytics-card-title">Setup</h2>
              <p className="analytics-card-description">
                Keep mode, scope, grouping, and visible columns aligned before
                you review the report.
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
                {loading
                  ? "Refreshing report..."
                  : classLevel
                    ? "Refresh class report"
                    : "Refresh student report"}
              </button>
            </div>
          </div>

          <div className="analytics-setup-summary-strip">
            <div className="analytics-setup-summary-item">
              <p className="analytics-setup-summary-item-label">Report mode</p>
              <div className="analytics-setup-summary-item-value">
                <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                  {activeModeLabel}
                </span>
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
                onChange={() =>
                  setShowOptionTagsColumn((value) => !value)
                }
                className="analytics-inline-check shrink-0"
              />
            </label>
          </div>

          {showControls ? (
            <AnalyticsStudentTagReportSetupControls
              isStudentPortal={isStudentPortal}
              classLevel={classLevel}
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
              setClassLevel={setClassLevel}
              setSelectedClassId={setSelectedClassId}
              setSelectedAcademicSectionId={setSelectedAcademicSectionId}
              setSelectedSubjectId={setSelectedSubjectId}
              setGroupBy={setGroupBy}
              onApplyFilters={handleApplyFilters}
              onClearFilters={handleClearFilters}
            />
          ) : null}
        </div>

        {!isStudentPortal && !classLevel ? (
          <ComparisonInsightsCard
            title={`Insights (Student • ${lastLabel})`}
            lastLabel={lastLabel}
            rows={compareRows}
          />
        ) : null}

        {classLevel || compareRows.length === 0 ? (
          <FailInsightsCard
            title={`Insights (${classLevel ? "Class" : "Student"} • ${lastLabel})`}
            lastLabel={lastLabel}
            rows={insights}
          />
        ) : null}

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
            ) : null}
          </div>
        </div>
        {view === "table" ? (
          <div className="analytics-table-shell">
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
          <AnalyticsChartView
            stats={stats}
            groupBy={groupBy}
            groupFields={groupFields}
            paperTitle={paper}
            mode={classLevel ? "class" : "student"}
            studentName={student}
            rollNumber={rollNumber}
          />
        )}
        {modalData.isOpen ? (
          <AnalyticsQuestionListModal
            isOpen={modalData.isOpen}
            onClose={handleCloseModal}
            title={modalData.title}
            questionIds={modalData.questionIds}
            groupNode={modalData.groupNode}
          />
        ) : null}
        {optionTagModal?.isOpen ? (
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
