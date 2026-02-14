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
} from "@/components/analytics/helpers";
import QuestionListModal from "@/components/analytics/QuestionListModal";
import AnalyticsExportControls from "@/components/analytics/AnalyticsExportControls";

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

  const tableRef = useRef<HTMLDivElement>(null);

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
    if (classLevel) searchParams.set("classLevel", "1");
    // Ensure we pass the tenant explicitly
    const sk = schoolKey || getSchoolFromCookie();
    if (!sk) {
      setLoading(false);
      setError("Please select a school in the navbar to load analytics.");
      return;
    }
    searchParams.set("school", sk);
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
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="container space-y-8">
        <ReportHeader student={student} rollNumber={rollNumber} paper={paper} />
        <div className="bg-white rounded-lg shadow-md border border-slate-200/80 p-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            Report Controls
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Analysis Mode */}
            <div>
              <label className="font-semibold text-slate-700 block mb-2">
                Analysis Mode
              </label>
              <div className="flex items-center gap-4 p-3 bg-slate-100 rounded-lg">
                <span className="text-slate-600">Single Student</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={classLevel}
                    onChange={() => setClassLevel((v) => !v)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                </label>
                <span className="text-slate-600">Class Level</span>
              </div>
            </div>

            {/* Group By */}
            <div>
              <label className="font-semibold text-slate-700 block mb-2">
                Group By (in order)
              </label>
              <p className="text-sm text-slate-500 mb-3">
                Select and drag fields to create a nested report.
              </p>
              <div className="p-4 border rounded-lg bg-slate-50/50 space-y-4">
                <div className="flex flex-wrap gap-2 mb-2">
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
                        className="inline-flex items-center justify-center px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-300 rounded-full cursor-pointer transition-colors hover:bg-slate-100 peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600"
                      >
                        {field.label}
                      </label>
                    </div>
                  ))}
                </div>
                {groupBy.length > 0 && (
                  <ul className="space-y-2">
                    {groupBy.map((fieldValue, idx) => {
                      const field = groupFields.find(
                        (f) => f.value === fieldValue,
                      );
                      if (!field) return null;
                      return (
                        <li
                          key={field.value}
                          className="flex items-center justify-between p-2 bg-white border rounded-md shadow-sm"
                        >
                          <span className="font-medium text-slate-700">
                            {idx + 1}. {field.label}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="p-1 rounded-full text-slate-500 hover:bg-slate-200"
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
                              className="p-1 rounded-full text-slate-500 hover:bg-slate-200"
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
                )}
              </div>
            </div>
          </div>

          {/* Tag/Option Columns & Submit */}
          <div className="flex flex-wrap items-center gap-6 mt-6">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={showTagsColumn}
                onChange={() => setShowTagsColumn((v) => !v)}
                className="form-checkbox"
              />
              <span className="ml-2 text-slate-700 font-medium">
                Show Tags Column
              </span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={showOptionTagsColumn}
                onChange={() => setShowOptionTagsColumn((v) => !v)}
                className="form-checkbox"
              />
              <span className="ml-2 text-slate-700 font-medium">
                Show Selected Option Tags Column
              </span>
            </label>
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="ml-auto px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              {loading ? "Loading..." : "Submit"}
            </button>
          </div>
        </div>
        <div className="flex justify-center bg-slate-200 p-1 rounded-lg max-w-xs mx-auto">
          <button
            onClick={() => setView("table")}
            className={`w-full px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
              view === "table"
                ? "bg-white text-blue-700 shadow"
                : "text-slate-600 hover:bg-slate-300/50"
            }`}
          >
            Table View
          </button>
          <button
            onClick={() => setView("charts")}
            className={`w-full px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
              view === "charts"
                ? "bg-white text-blue-700 shadow"
                : "text-slate-600 hover:bg-slate-300/50"
            }`}
          >
            Chart View
          </button>
        </div>
        {view === "table" ? (
          <div className="bg-white rounded-lg shadow-md border border-slate-200/80 overflow-hidden">
            <div className="p-6 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-800">
                Grouped Analytics
              </h2>
              {/* Use the new export controls component here */}
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
            {Object.keys(stats).length === 0 ? (
              <div className="text-slate-500 p-6 text-center">
                No tag data found for the selected criteria.
              </div>
            ) : (
              <div className="overflow-x-auto" ref={tableRef}>
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider">
                        Group / Tag
                      </th>
                      {showTagsColumn && (
                        <th className="px-4 py-3 text-center font-semibold text-slate-600 uppercase tracking-wider">
                          Tags
                        </th>
                      )}
                      <th
                        className="px-4 py-3 text-center font-semibold text-green-700 uppercase tracking-wider cursor-pointer select-none"
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
                        className="px-4 py-3 text-center font-semibold text-red-700 uppercase tracking-wider cursor-pointer select-none"
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
                        className="px-4 py-3 text-center font-semibold text-yellow-700 uppercase tracking-wider cursor-pointer select-none"
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
                        <th className="px-4 py-3 text-center font-semibold text-slate-600 uppercase tracking-wider">
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
