"use client";

import dynamic from "next/dynamic";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SearchableCommandOption } from "@/components/ui/searchable-command-select";

const SearchableCommandSelect = dynamic(
  () =>
    import("@/components/ui/searchable-command-select").then(
      (module) => module.SearchableCommandSelect,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-11 rounded-xl border border-border/60 bg-muted/30" />
    ),
  },
);

type QuestionPapersDirectoryFiltersProps = {
  classFilterId: string;
  sectionFilterId: string;
  searchInput: string;
  numTags: number;
  totalPapers: number;
  hasActiveFilters: boolean;
  classFilterOptions: SearchableCommandOption[];
  sectionFilterOptions: SearchableCommandOption[];
  onSearchInputChange: (value: string) => void;
  onClassFilterChange: (value: string) => void;
  onSectionFilterChange: (value: string) => void;
  onNumTagsChange: (value: number) => void;
  onApplyFilters: (event?: FormEvent) => void;
  onResetFilters: () => void;
};

export default function QuestionPapersDirectoryFilters({
  classFilterId,
  sectionFilterId,
  searchInput,
  numTags,
  totalPapers,
  hasActiveFilters,
  classFilterOptions,
  sectionFilterOptions,
  onSearchInputChange,
  onClassFilterChange,
  onSectionFilterChange,
  onNumTagsChange,
  onApplyFilters,
  onResetFilters,
}: QuestionPapersDirectoryFiltersProps) {
  return (
    <div className="app-filter-panel">
      <div className="app-filter-panel-header">
        <div className="app-filter-panel-heading">
          <div className="app-filter-panel-copy">
            <p className="app-filter-panel-title">Paper Filters</p>
            <p className="app-filter-panel-note">
              Search papers by title and narrow by class or section before
              opening responses, analytics, or report actions.
            </p>
          </div>
          <div className="app-filter-panel-chips">
            <span className="app-meta-chip">
              {hasActiveFilters ? "Filtered view" : "Full paper directory"}
            </span>
            <span className="app-meta-chip">
              {totalPapers} paper{totalPapers === 1 ? "" : "s"} matched
            </span>
          </div>
        </div>
      </div>

      <form
        className="app-filter-panel-body space-y-4"
        onSubmit={onApplyFilters}
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_180px_180px_7.5rem] xl:items-end">
          <div className="space-y-2">
            <p className="app-field-label">Search</p>
            <Input
              value={searchInput}
              onChange={(event) => onSearchInputChange(event.target.value)}
              placeholder="Search by paper title"
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <p className="app-field-label">Class</p>
            <SearchableCommandSelect
              value={classFilterId}
              options={classFilterOptions}
              onValueChange={onClassFilterChange}
              placeholder="All classes"
              searchPlaceholder="Search classes..."
              emptyText="No classes found."
              onClear={() => onClassFilterChange("all")}
              showCloseAction
            />
          </div>
          <div className="space-y-2">
            <p className="app-field-label">Section</p>
            <SearchableCommandSelect
              value={sectionFilterId}
              options={sectionFilterOptions}
              onValueChange={onSectionFilterChange}
              placeholder="All sections"
              searchPlaceholder="Search sections..."
              emptyText="No sections found."
              onClear={() => onSectionFilterChange("all")}
              showCloseAction
            />
          </div>
          <div className="space-y-2">
            <p className="app-field-label">Excel Tags</p>
            <Input
              type="number"
              min={1}
              max={10}
              value={numTags}
              onChange={(event) =>
                onNumTagsChange(Number(event.target.value || 1))
              }
              className="w-full"
            />
          </div>
        </div>

        <div className="app-filter-summary">
          <div className="app-filter-summary-copy">
            <p className="app-filter-summary-title">
              {totalPapers} paper{totalPapers === 1 ? "" : "s"} in view
            </p>
            <p className="app-filter-summary-note">
              Filters now run server-side so each page loads only the current
              results.
            </p>
          </div>
          <div className="app-filter-summary-actions">
            <Button type="submit" className="app-button-filter">
              Apply Filters
            </Button>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                className="app-button-filter"
                onClick={onResetFilters}
              >
                Clear Filters
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}
