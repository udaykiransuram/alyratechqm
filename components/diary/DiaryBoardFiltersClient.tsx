"use client";

import { startTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  SearchableCommandSelect,
  type SearchableCommandOption,
} from "@/components/ui/searchable-command-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DiaryBoardFiltersClientProps = {
  date: string;
  defaultDate: string;
  classId?: string;
  classOptions?: SearchableCommandOption[];
  sectionId?: string;
  sectionOptions?: SearchableCommandOption[];
  subjectId?: string;
  subjectOptions: SearchableCommandOption[];
  status?: string;
  statusOptions?: SearchableCommandOption[];
  showClassFilter?: boolean;
  showSectionFilter?: boolean;
  showStatusFilter?: boolean;
  variant?: "embedded" | "panel";
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

export default function DiaryBoardFiltersClient({
  date,
  defaultDate,
  classId = "all",
  classOptions = [],
  sectionId = "all",
  sectionOptions = [],
  subjectId = "all",
  subjectOptions,
  status = "all",
  statusOptions = [],
  showClassFilter = false,
  showSectionFilter = false,
  showStatusFilter = false,
  variant = "panel",
}: DiaryBoardFiltersClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
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
    <div
      className={[
        "app-filter-panel app-filter-panel-tight",
        variant === "embedded" ? "app-filter-panel-embedded" : "",
      ].join(" ").trim()}
    >
      <div className="app-filter-panel-body space-y-4">
        <div className="app-filter-grid xl:grid-cols-5">
          <div className="app-field-group">
            <span className="app-field-label">Date</span>
            <Input
              type="date"
              value={date}
              onChange={(event) =>
                updateFilters({
                  entryDate: event.target.value || defaultDate,
                })
              }
            />
          </div>

          {showClassFilter ? (
            <div className="app-field-group">
              <span className="app-field-label">Class</span>
              <SearchableCommandSelect
                value={classId}
                options={[
                  {
                    value: "all",
                    label: "All classes",
                  },
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
          ) : null}

          {showSectionFilter ? (
            <div className="app-field-group">
              <span className="app-field-label">Section</span>
              <SearchableCommandSelect
                value={sectionId}
                options={[
                  {
                    value: "all",
                    label: "All sections",
                  },
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
          ) : null}

          <div className="app-field-group">
            <span className="app-field-label">Subject</span>
            <SearchableCommandSelect
              value={subjectId}
              options={[
                {
                  value: "all",
                  label: "All subjects",
                },
                ...subjectOptions,
              ]}
              onValueChange={(value) =>
                updateFilters({
                  subjectId: value,
                })
              }
              placeholder="All subjects"
              searchPlaceholder="Search subjects..."
              emptyText="No subjects found."
              onClear={() =>
                updateFilters({
                  subjectId: "all",
                })
              }
              showCloseAction
            />
          </div>

          {showStatusFilter ? (
            <div className="app-field-group">
              <span className="app-field-label">Status</span>
              <SearchableCommandSelect
                value={status}
                options={[
                  {
                    value: "all",
                    label: "All statuses",
                  },
                  ...statusOptions,
                ]}
                onValueChange={(value) =>
                  updateFilters({
                    status: value,
                  })
                }
                placeholder="All statuses"
                searchPlaceholder="Search statuses..."
                emptyText="No statuses found."
                onClear={() =>
                  updateFilters({
                    status: "all",
                  })
                }
                showCloseAction
              />
            </div>
          ) : null}
        </div>

        {variant === "panel" ? (
          <div className="app-filter-summary">
            <div className="app-filter-summary-copy">
              <p className="app-filter-summary-title">Date-first diary board</p>
              <p className="app-filter-summary-note">
                View one day at a time and narrow by class, section, subject, or status.
              </p>
            </div>
            <div className="app-filter-summary-actions">
              <Button
                type="button"
                variant="outline"
                className="app-button-filter"
                onClick={() =>
                  updateFilters({
                    entryDate: defaultDate,
                    classId: "all",
                    sectionId: "all",
                    subjectId: "all",
                    status: "all",
                  })
                }
              >
                Reset
              </Button>
            </div>
          </div>
        ) : (
          <div className="app-filter-embedded-actions">
            <Button
              type="button"
              variant="outline"
              className="app-button-filter"
              onClick={() =>
                updateFilters({
                  entryDate: defaultDate,
                  classId: "all",
                  sectionId: "all",
                  subjectId: "all",
                  status: "all",
                })
              }
            >
              Reset
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
