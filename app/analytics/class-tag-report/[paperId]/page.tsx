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
  computeInsightsForLastTag,
} from "@/components/analytics/helpers";
import QuestionListModal from "@/components/analytics/QuestionListModal";
import AnalyticsExportControls from "@/components/analytics/AnalyticsExportControls";

export default function ClassTagReportPage({
  params,
}: {
  params: { paperId: string };
}) {
  const [stats, setStats] = useState<any>({});
  const [paper, setPaper] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [groupFields, setGroupFields] = useState<
    { value: string; label: string }[]
  >([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
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
    [showTagsColumn ? "Tags" : null, showOptionTagsColumn ? "Option tags" : null]
      .filter(Boolean)
      .join(" • ") || "Core metrics only";

  // Explicit tenant handling
  const [schoolKey, setSchoolKey] = useState<string>("");
  function getSchoolFromCookie() {
    try {
      const m = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
      return m && m[1] ? decodeURIComponent(m[1]) : "";
    } catch {
      return "";
    }
  }

  useEffect(() => {
    const sk = getSchoolFromCookie();
    setSchoolKey(sk);
    if (!sk) {
      setLoading(false);
      setError("Please select a school in the navbar to load analytics.");
      return;
    }
    fetch(
      `/api/analytics/class-tag-report/${params.paperId}?groupFields=1&school=${encodeURIComponent(sk)}`,
    )
      .then((res) => res.json())
      .then((data: any) => {
        setGroupFields(data.fields || []);
        if (data.fields?.some((f: any) => f.value === "section")) {
          const sectionIdx = data.fields.findIndex(
            (f: any) => f.value === "section",
          );
          const selected = [
            data.fields[sectionIdx]?.value,
            data.fields[sectionIdx + 1]?.value,
            data.fields[sectionIdx + 2]?.value,
          ].filter(Boolean);
          setGroupBy(selected);
        } else if (data.fields?.length) {
          setGroupBy(data.fields.slice(0, 3).map((f: any) => f.value));
        }
      });
  }, [params.paperId]);

  useEffect(() => {
    if (groupBy.length && !hasFetchedOnce) {
      fetchAnalytics();
      setHasFetchedOnce(true);
    }
  }, [groupBy, hasFetchedOnce]);

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

  const fetchAnalytics = () => {
    setLoading(true);
    setError(null);
    const searchParams = new URLSearchParams();
    searchParams.set("json", "1");
    if (groupBy.length) searchParams.set("groupBy", groupBy.join(","));
    const sk = schoolKey || getSchoolFromCookie();
    if (!sk) {
      setLoading(false);
      setError("Please select a school in the navbar to load analytics.");
      return;
    }
    searchParams.set("school", sk);
    fetch(
      `/api/analytics/class-tag-report/${params.paperId}?${searchParams.toString()}`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStats(data.stats || {});
          setPaper(data.paper || "");
        } else {
          setError(data.message || "Failed to fetch tag report");
        }
      })
      .catch(() => setError("An unexpected network error occurred."))
      .finally(() => setLoading(false));
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="analytics-page">
      <div className="container space-y-6">
        <ReportHeader paper={paper} student="" rollNumber="" variant="class" />
        <div className="analytics-card overflow-hidden">
          <div className="analytics-card-header">
            <div className="analytics-toolbar-row gap-4">
              <div className="analytics-toolbar-copy">
                <h2 className="analytics-card-title">Report Controls</h2>
                <p className="analytics-card-description">
                  Pick how this report groups data, review the current setup,
                  and refresh the grouped results when you are ready.
                </p>
              </div>
              <div className="analytics-toolbar-meta">
                <span className="analytics-toolbar-chip">
                  {groupFields.length} available fields
                </span>
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
                    Keep the page lighter by opening the full setup only when you
                    need to change the grouping order.
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
                    onClick={fetchAnalytics}
                    disabled={loading}
                    className="app-button-primary h-9 px-3"
                  >
                    {loading ? "Refreshing report..." : "Refresh report"}
                  </button>
                </div>
              </div>
              <div className="analytics-toolbar-row">
                <div className="analytics-toolbar-meta">
                  <span className="analytics-toolbar-chip">
                    {groupFields.length} available fields
                  </span>
                  <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                    {view === "table" ? "Table view" : "Chart view"}
                  </span>
                  <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                    {groupingPreviewLabel}
                  </span>
                  <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                    {visibleColumnsLabel}
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
                      onChange={() => setShowOptionTagsColumn((value) => !value)}
                      className="analytics-inline-check"
                    />
                    <span>Show option tags column</span>
                  </label>
                </div>
              </div>
            </div>

            {showControls ? (
              <div className="analytics-controls-grid">
              <div className="analytics-control-panel xl:order-2">
                <div className="analytics-control-panel-header">
                  <p className="analytics-control-panel-title">
                    Group By (in order)
                  </p>
                  <p className="analytics-control-panel-note">
                    Select fields and reorder them to build the nested structure
                    used across the table, charts, and exports.
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
          <div className="analytics-card analytics-card-body">
            <div className="analytics-toolbar">
              <div className="analytics-toolbar-row">
                <div className="analytics-toolbar-copy">
                  <h2 className="analytics-card-title">
                    Insights (Class • {lastLabel})
                  </h2>
                  <p className="analytics-toolbar-note">
                    Highest-failure groupings for the current report setup.
                  </p>
                </div>
                <div className="analytics-toolbar-meta">
                  <span className="analytics-toolbar-chip">
                    {Math.min(insights.length, 12)} shown
                  </span>
                  <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                    Based on {lastLabel}
                  </span>
                </div>
              </div>
            </div>
            <div className="analytics-table-wrap">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="analytics-th">
                      {lastLabel}
                    </th>
                    <th className="analytics-th-center">
                      Fail (%)
                    </th>
                    <th className="analytics-th">
                      Category
                    </th>
                    <th className="analytics-th">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {insights.slice(0, 12).map((i) => (
                    <tr
                      key={i.tag}
                      className="analytics-row"
                    >
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
              {insights.length > 12 && (
                <p className="px-4 py-3 text-xs text-muted-foreground">
                  Showing top 12. Refine grouping to focus further.
                </p>
              )}
            </div>
          </div>
        )}
        <div className="analytics-toolbar">
          <div className="analytics-toolbar-row">
            <div className="analytics-toolbar-copy">
              <p className="analytics-toolbar-title">Choose a report view</p>
              <p className="analytics-toolbar-note">
                Switch between the grouped table and charts without losing your
                current report setup.
              </p>
            </div>
            <div className="analytics-toolbar-meta">
              <span className="analytics-toolbar-chip">
                {selectedGroupLabels.length > 0
                  ? `Group by ${selectedGroupLabels.join(" → ")}`
                  : "No grouping selected"}
              </span>
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
                  <h2 className="analytics-card-title">
                    Grouped Analytics
                  </h2>
                  <p className="analytics-toolbar-note">
                    Review grouped performance and export the exact table shown
                    below.
                  </p>
                </div>
                <div className="analytics-toolbar-meta">
                  <span className="analytics-toolbar-chip">
                    {selectedGroupLabels.length > 0
                      ? selectedGroupLabels.join(" → ")
                      : "No grouping selected"}
                  </span>
                  <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                    {activeSortLabel}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="analytics-toolbar-actions">
                  <span className="analytics-toolbar-chip">
                    {showTagsColumn ? "Tags visible" : "Tags hidden"}
                  </span>
                  <span className="analytics-toolbar-chip">
                    {showOptionTagsColumn
                      ? "Option tags visible"
                      : "Option tags hidden"}
                  </span>
                  {selectedTags.length > 0 && (
                    <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                      {selectedTags.length} highlighted tags
                    </span>
                  )}
                </div>
                <AnalyticsExportControls
                  stats={stats}
                  groupBy={groupBy}
                  groupFields={groupFields}
                  sortConfig={sortConfig}
                  tableRef={tableRef}
                  mode="class"
                  paperTitle={paper}
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
                      <th className="analytics-th">
                        Group / Tag
                      </th>
                      {showTagsColumn && (
                        <th className="analytics-th-center">
                          Tags
                        </th>
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
            mode="class"
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
