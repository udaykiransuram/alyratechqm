"use client";

import { startTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SearchableCommandSelect } from "@/components/ui/searchable-command-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FilterOption = {
  value: string;
  label: string;
};

type ProgressUpdatesFiltersClientProps = {
  date: string;
  defaultDate: string;
  classId: string;
  classOptions: FilterOption[];
  sectionId: string;
  sectionOptions: FilterOption[];
  query: string;
};

function setOrDeleteParam(
  searchParams: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  if (!value || value === "all") {
    searchParams.delete(key);
    return;
  }

  searchParams.set(key, value);
}

export default function ProgressUpdatesFiltersClient({
  date,
  defaultDate,
  classId,
  classOptions,
  sectionId,
  sectionOptions,
  query,
}: ProgressUpdatesFiltersClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (key === "date") {
        if (value) {
          nextSearchParams.set(key, value);
        } else {
          nextSearchParams.delete(key);
        }
        return;
      }
      setOrDeleteParam(nextSearchParams, key, value);
    });

    const nextQuery = nextSearchParams.toString();

    startTransition(() => {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    });
  };

  return (
    <div className="app-filter-panel app-filter-panel-tight">
      <div className="app-filter-panel-body space-y-4">
        <div className="app-filter-grid xl:grid-cols-4">
          <div className="app-field-group">
            <span className="app-field-label">Date</span>
            <Input
              type="date"
              value={date}
              onChange={(event) =>
                updateFilters({
                  date: event.target.value,
                })
              }
            />
          </div>
          <div className="app-field-group">
            <span className="app-field-label">Class</span>
            <SearchableCommandSelect
              value={classId}
              options={[
                { value: "all", label: "All classes" },
                ...classOptions,
              ]}
              onValueChange={(value) =>
                updateFilters({
                  classId: value,
                  sectionId: "all",
                })
              }
              placeholder="All classes"
              searchPlaceholder="Search classes..."
              emptyText="No classes found."
              onClear={() =>
                updateFilters({
                  classId: "all",
                  sectionId: "all",
                })
              }
              showCloseAction
            />
          </div>
          <div className="app-field-group">
            <span className="app-field-label">Section</span>
            <SearchableCommandSelect
              value={sectionId}
              options={[
                { value: "all", label: "All sections" },
                ...sectionOptions,
              ]}
              onValueChange={(value) =>
                updateFilters({
                  sectionId: value,
                })
              }
              placeholder="All sections"
              searchPlaceholder="Search sections..."
              emptyText="No sections found."
              onClear={() =>
                updateFilters({
                  sectionId: "all",
                })
              }
              showCloseAction
            />
          </div>
          <div className="app-field-group">
            <span className="app-field-label">Student</span>
            <Input
              value={query}
              placeholder="Search by name or roll number..."
              onChange={(event) =>
                updateFilters({
                  q: event.target.value,
                })
              }
            />
          </div>
        </div>

        <div className="app-filter-summary">
          <div className="app-filter-summary-copy">
            <p className="app-filter-summary-title">Progress update filters</p>
            <p className="app-filter-summary-note">
              Filter by date, class, section, or student name.
            </p>
          </div>
          <div className="app-filter-summary-actions">
            <Button
              type="button"
              variant="outline"
              className="app-button-filter"
              onClick={() =>
                updateFilters({
                  date: defaultDate,
                  classId: "all",
                  sectionId: "all",
                  q: "",
                })
              }
            >
              Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
