"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchableCommandOption } from "@/components/ui/searchable-command-select";

import type {
  ReportFilterOption,
  ReportScopeFilter,
  TypeFilter,
} from "./report-jobs-types";

const SearchableCommandSelect = dynamic(
  () =>
    import("@/components/ui/searchable-command-select").then(
      (module) => module.SearchableCommandSelect,
    ),
  {
    ssr: false,
    loading: () => <div className="h-11 rounded-xl border border-border/60 bg-muted/30" />,
  },
);

const STATUS_FILTER_OPTIONS: SearchableCommandOption[] = [
  {
    value: "all",
    label: "All statuses",
    description: "See queued, processing, sent, and failed jobs together.",
  },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
];

const RECIPIENT_FILTER_OPTIONS: SearchableCommandOption[] = [
  {
    value: "all",
    label: "All recipients",
    description: "Review student, teacher, admin, and exam dispatches together.",
  },
  { value: "student", label: "Students" },
  { value: "teacher", label: "Teachers" },
  { value: "admin", label: "Admins" },
  { value: "exam", label: "Exam team" },
];

const REPORT_SCOPE_FILTER_OPTIONS: SearchableCommandOption[] = [
  {
    value: "all",
    label: "All report scopes",
    description: "Include both benchmark and student report jobs.",
  },
  { value: "benchmark", label: "Benchmark reports" },
  { value: "student", label: "Student reports" },
];

type ReportJobsFiltersCardProps = {
  totalJobs: number;
  failedCount: number;
  awaitingAckCount: number;
  hasActiveFilters: boolean;
  statusFilter: string;
  typeFilter: TypeFilter;
  reportScopeFilter: ReportScopeFilter;
  academicSectionFilter: string;
  academicSectionOptions: ReportFilterOption[];
  onStatusChange: (value: string) => void;
  onTypeChange: (value: TypeFilter) => void;
  onReportScopeChange: (value: ReportScopeFilter) => void;
  onAcademicSectionChange: (value: string) => void;
  onClearFilters: () => void;
};

function getFilterLabel(options: SearchableCommandOption[], value: string) {
  return options.find((option) => option.value === value)?.label || "All";
}

function FilterControlShell({
  label,
  preview,
}: {
  label: string;
  preview: string;
}) {
  return (
    <div className="app-report-filter-card">
      <p className="app-report-filter-label">{label}</p>
      <div className="app-report-filter-control">
        <div className="app-report-filter-preview">
          {preview}
        </div>
      </div>
    </div>
  );
}

export default function ReportJobsFiltersCard({
  totalJobs,
  failedCount,
  awaitingAckCount,
  hasActiveFilters,
  statusFilter,
  typeFilter,
  reportScopeFilter,
  academicSectionFilter,
  academicSectionOptions,
  onStatusChange,
  onTypeChange,
  onReportScopeChange,
  onAcademicSectionChange,
  onClearFilters,
}: ReportJobsFiltersCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showInteractiveControls, setShowInteractiveControls] = useState(false);

  useEffect(() => {
    if (showInteractiveControls) return;

    const root = containerRef.current;
    if (!root) return;

    if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") {
      setShowInteractiveControls(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShowInteractiveControls(true);
          observer.disconnect();
        }
      },
      { rootMargin: "140px 0px" },
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [showInteractiveControls]);

  const academicSectionFilterOptions = useMemo<SearchableCommandOption[]>(
    () => [
      {
        value: "all",
        label: "All class sections",
        description: "Keep the queue scoped to every class section.",
      },
      ...academicSectionOptions,
    ],
    [academicSectionOptions],
  );

  return (
    <Card className="analytics-card overflow-hidden">
      <CardHeader className="analytics-card-header analytics-card-header-highlight">
        <div className="analytics-toolbar-row gap-4">
          <div className="analytics-toolbar-copy">
            <CardTitle className="analytics-card-title">Filters & Actions</CardTitle>
            <p className="analytics-card-description">
              Narrow the delivery queue by dispatch state, recipient type, report scope, and
              class-section context.
            </p>
          </div>
          <div className="analytics-toolbar-meta">
            <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
              {totalJobs} matching
            </span>
            <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
              {failedCount} failed
            </span>
            <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
              {awaitingAckCount} waiting ack
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="analytics-toolbar">
          <div ref={containerRef} className="app-report-filter-layout">
            <div className="app-report-filter-grid">
              {showInteractiveControls ? (
                <>
                  <div className="app-report-filter-card">
                    <p className="app-report-filter-label">Dispatch status</p>
                    <div className="app-report-filter-control">
                      <SearchableCommandSelect
                        value={statusFilter}
                        options={STATUS_FILTER_OPTIONS}
                        onValueChange={onStatusChange}
                        placeholder="All statuses"
                        searchPlaceholder="Search statuses..."
                        emptyText="No statuses found."
                        onClear={() => onStatusChange("all")}
                        showCloseAction
                      />
                    </div>
                  </div>
                  <div className="app-report-filter-card">
                    <p className="app-report-filter-label">Recipients</p>
                    <div className="app-report-filter-control">
                      <SearchableCommandSelect
                        value={typeFilter}
                        options={RECIPIENT_FILTER_OPTIONS}
                        onValueChange={(value) => onTypeChange(value as TypeFilter)}
                        placeholder="All recipients"
                        searchPlaceholder="Search recipient types..."
                        emptyText="No recipient types found."
                        onClear={() => onTypeChange("all")}
                        showCloseAction
                      />
                    </div>
                  </div>
                  <div className="app-report-filter-card">
                    <p className="app-report-filter-label">Report scope</p>
                    <div className="app-report-filter-control">
                      <SearchableCommandSelect
                        value={reportScopeFilter}
                        options={REPORT_SCOPE_FILTER_OPTIONS}
                        onValueChange={(value) => onReportScopeChange(value as ReportScopeFilter)}
                        placeholder="All report scopes"
                        searchPlaceholder="Search report scopes..."
                        emptyText="No report scopes found."
                        onClear={() => onReportScopeChange("all")}
                        showCloseAction
                      />
                    </div>
                  </div>
                  <div className="app-report-filter-card">
                    <p className="app-report-filter-label">Class section</p>
                    <div className="app-report-filter-control">
                      <SearchableCommandSelect
                        value={academicSectionFilter}
                        options={academicSectionFilterOptions}
                        onValueChange={onAcademicSectionChange}
                        placeholder="All class sections"
                        searchPlaceholder="Search class sections..."
                        emptyText="No class sections found."
                        onClear={() => onAcademicSectionChange("all")}
                        showCloseAction
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <FilterControlShell
                    label="Dispatch status"
                    preview={getFilterLabel(STATUS_FILTER_OPTIONS, statusFilter)}
                  />
                  <FilterControlShell
                    label="Recipients"
                    preview={getFilterLabel(RECIPIENT_FILTER_OPTIONS, typeFilter)}
                  />
                  <FilterControlShell
                    label="Report scope"
                    preview={getFilterLabel(REPORT_SCOPE_FILTER_OPTIONS, reportScopeFilter)}
                  />
                  <FilterControlShell
                    label="Class section"
                    preview={getFilterLabel(academicSectionFilterOptions, academicSectionFilter)}
                  />
                </>
              )}
            </div>
            <div className="app-report-filter-footer">
              <p className="app-report-filter-hint">
                Filters refresh the queue directly from the server so each page stays lighter
                and quicker to open.
              </p>
              {hasActiveFilters ? (
                <div className="app-filter-summary-actions">
                  <Button
                    type="button"
                    variant="outline"
                    className="app-button-filter"
                    onClick={onClearFilters}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
