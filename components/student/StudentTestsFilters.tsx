"use client";

import {
  SearchableCommandSelect,
  type SearchableCommandOption,
} from "@/components/ui/searchable-command-select";

type StudentTestsFiltersProps = {
  testFilter: string;
  testOptions: SearchableCommandOption[];
  onTestFilterChange: (value: string) => void;
  subjectFilter: string;
  subjectOptions: Array<{ value: string; label: string }>;
  onSubjectFilterChange: (value: string) => void;
  allSubjectsValue: string;
};

export default function StudentTestsFilters({
  testFilter,
  testOptions,
  onTestFilterChange,
  subjectFilter,
  subjectOptions,
  onSubjectFilterChange,
  allSubjectsValue,
}: StudentTestsFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="space-y-2">
        <label className="app-field-label">Test</label>
        <SearchableCommandSelect
          value={testFilter}
          options={testOptions}
          onValueChange={onTestFilterChange}
          placeholder="All tests"
          searchPlaceholder="Search tests..."
          emptyText="No tests found."
          triggerClassName="app-student-filter-trigger"
          showCloseAction
        />
      </div>
      <div className="space-y-2">
        <label className="app-field-label">
          Subject
        </label>
        <SearchableCommandSelect
          value={subjectFilter}
          options={[
            {
              value: allSubjectsValue,
              label: "All subjects",
            },
            ...subjectOptions,
          ]}
          onValueChange={onSubjectFilterChange}
          placeholder="All subjects"
          searchPlaceholder="Search subjects..."
          emptyText="No subjects found."
          onClear={() => onSubjectFilterChange(allSubjectsValue)}
          showCloseAction
          triggerClassName="app-student-filter-trigger"
        />
      </div>
    </div>
  );
}
