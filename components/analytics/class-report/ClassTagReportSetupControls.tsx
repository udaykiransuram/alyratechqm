"use client";

import type { Dispatch, SetStateAction } from "react";

import { Button } from "@/components/ui/button";
import { SearchableCommandSelect } from "@/components/ui/searchable-command-select";

type ReportFilterOption = {
  value: string;
  label: string;
  description?: string;
};

type GroupField = {
  value: string;
  label: string;
};

type ClassTagReportSetupControlsProps = {
  loading: boolean;
  hasActiveFilters: boolean;
  searchableClassOptions: ReportFilterOption[];
  searchableAcademicSectionOptions: ReportFilterOption[];
  searchableSubjectOptions: ReportFilterOption[];
  selectedClassId: string;
  selectedAcademicSectionId: string;
  selectedSubjectId: string;
  activeClassLabel: string;
  activeAcademicSectionLabel: string;
  activeSubjectLabel: string;
  groupFields: GroupField[];
  groupBy: string[];
  setSelectedClassId: (value: string) => void;
  setSelectedAcademicSectionId: (value: string) => void;
  setSelectedSubjectId: (value: string) => void;
  setGroupBy: Dispatch<SetStateAction<string[]>>;
  onApplyFilters: () => Promise<void>;
  onClearFilters: () => Promise<void>;
};

export default function ClassTagReportSetupControls({
  loading,
  hasActiveFilters,
  searchableClassOptions,
  searchableAcademicSectionOptions,
  searchableSubjectOptions,
  selectedClassId,
  selectedAcademicSectionId,
  selectedSubjectId,
  activeClassLabel,
  activeAcademicSectionLabel,
  activeSubjectLabel,
  groupFields,
  groupBy,
  setSelectedClassId,
  setSelectedAcademicSectionId,
  setSelectedSubjectId,
  setGroupBy,
  onApplyFilters,
  onClearFilters,
}: ClassTagReportSetupControlsProps) {
  return (
    <div className="analytics-controls-grid">
      <div className="analytics-control-panel xl:order-1">
        <div className="analytics-control-panel-header">
          <p className="analytics-control-panel-title">Report filters</p>
          <p className="analytics-control-panel-note">
            Narrow the question scope before reloading the report data.
          </p>
        </div>
        <div className="app-report-filter-layout">
          <div className="app-report-filter-grid">
            <div className="app-report-filter-card">
              <p className="app-report-filter-label">Class filter</p>
              <div className="app-report-filter-control">
                <SearchableCommandSelect
                  value={selectedClassId}
                  options={searchableClassOptions}
                  onValueChange={setSelectedClassId}
                  placeholder="All classes"
                  searchPlaceholder="Search classes..."
                  emptyText="No classes found."
                  onClear={() => setSelectedClassId("all")}
                  showCloseAction
                />
              </div>
            </div>
            <div className="app-report-filter-card">
              <p className="app-report-filter-label">Class section</p>
              <div className="app-report-filter-control">
                <SearchableCommandSelect
                  value={selectedAcademicSectionId}
                  options={searchableAcademicSectionOptions}
                  onValueChange={setSelectedAcademicSectionId}
                  placeholder="All class sections"
                  searchPlaceholder="Search class sections..."
                  emptyText="No class sections found."
                  onClear={() => setSelectedAcademicSectionId("all")}
                  showCloseAction
                />
              </div>
            </div>
            <div className="app-report-filter-card">
              <p className="app-report-filter-label">Subject filter</p>
              <div className="app-report-filter-control">
                <SearchableCommandSelect
                  value={selectedSubjectId}
                  options={searchableSubjectOptions}
                  onValueChange={setSelectedSubjectId}
                  placeholder="All subjects"
                  searchPlaceholder="Search subjects..."
                  emptyText="No subjects found."
                  onClear={() => setSelectedSubjectId("all")}
                  showCloseAction
                />
              </div>
            </div>
          </div>
          <div className="app-report-filter-footer">
            <div className="app-report-filter-summary">
              <span className="analytics-toolbar-chip">
                {selectedClassId === "all" ? "All classes" : `Class: ${activeClassLabel}`}
              </span>
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                {activeAcademicSectionLabel}
              </span>
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                {activeSubjectLabel}
              </span>
            </div>
            <div className="app-report-filter-actions">
              <Button
                type="button"
                className="app-button-filter"
                onClick={() => void onApplyFilters()}
                disabled={loading}
              >
                {loading ? "Applying..." : "Apply filters"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="app-button-filter"
                onClick={() => void onClearFilters()}
                disabled={loading || !hasActiveFilters}
              >
                Clear filters
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="analytics-control-panel xl:order-2">
        <div className="analytics-control-panel-header">
          <p className="analytics-control-panel-title">Grouping order</p>
          <p className="analytics-control-panel-note">
            Choose the nesting order used across tables, charts, and benchmark
            views.
          </p>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {groupFields.map((field) => (
            <div key={field.value}>
              <input
                type="checkbox"
                id={`field-${field.value}`}
                checked={groupBy.includes(field.value)}
                onChange={() =>
                  setGroupBy((prev) =>
                    prev.includes(field.value)
                      ? prev.filter((item) => item !== field.value)
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
            {groupBy.map((fieldValue, index) => {
              const field = groupFields.find((item) => item.value === fieldValue);
              if (!field) return null;
              return (
                <li key={field.value} className="analytics-order-item">
                  <span className="font-medium text-foreground">
                    {index + 1}. {field.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="analytics-action-button-icon"
                      disabled={index === 0}
                      onClick={() => {
                        setGroupBy((prev) => {
                          const next = [...prev];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          return next;
                        });
                      }}
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="analytics-action-button-icon"
                      disabled={index === groupBy.length - 1}
                      onClick={() => {
                        setGroupBy((prev) => {
                          const next = [...prev];
                          [next[index], next[index + 1]] = [next[index + 1], next[index]];
                          return next;
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
  );
}
