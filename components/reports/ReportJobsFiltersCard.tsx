"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

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
  const academicSectionFilterOptions = useMemo<SearchableCommandOption[]>(
    () => [
      {
        value: "all",
        label: "All class sections",
      },
      ...academicSectionOptions,
    ],
    [academicSectionOptions],
  );

  return (
    <Card className="app-filter-panel">
      <CardHeader className="app-filter-panel-header">
        <div className="app-filter-panel-heading">
          <div className="app-filter-panel-copy">
            <CardTitle className="app-filter-panel-title">Report Filters</CardTitle>
          </div>
          <div className="app-filter-panel-chips">
            <span className="app-meta-chip">
              {totalJobs} matching job{totalJobs === 1 ? "" : "s"}
            </span>
            <span className="app-meta-chip">
              {failedCount} failed
            </span>
            <span className="app-meta-chip">
              {awaitingAckCount} waiting ack
            </span>
            <span className="app-meta-chip">
              {getFilterLabel(STATUS_FILTER_OPTIONS, statusFilter)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="app-filter-panel-body">
        <div className="app-filter-grid xl:grid-cols-4">
          <div className="app-field-group">
            <span className="app-field-label">Dispatch status</span>
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
          <div className="app-field-group">
            <span className="app-field-label">Recipients</span>
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
          <div className="app-field-group">
            <span className="app-field-label">Report scope</span>
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
          <div className="app-field-group">
            <span className="app-field-label">Class section</span>
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

        <div className="app-filter-summary">
          <div className="app-filter-summary-copy">
            <p className="app-filter-summary-title">
              {hasActiveFilters ? "Filtered queue" : "All report jobs"}
            </p>
            <p className="app-filter-summary-note">
              {hasActiveFilters
                ? `${totalJobs} job${totalJobs === 1 ? "" : "s"} match the current filters.`
                : `${totalJobs} job${totalJobs === 1 ? "" : "s"} in the full queue.`}
            </p>
          </div>
          <div className="app-filter-summary-actions">
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                className="app-button-filter"
                onClick={onClearFilters}
              >
                Clear Filters
              </Button>
            ) : null}
            <span className="app-meta-chip">
              {getFilterLabel(RECIPIENT_FILTER_OPTIONS, typeFilter)}
            </span>
            <span className="app-meta-chip">
              {getFilterLabel(REPORT_SCOPE_FILTER_OPTIONS, reportScopeFilter)}
            </span>
            <span className="app-meta-chip">
              {getFilterLabel(academicSectionFilterOptions, academicSectionFilter)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
