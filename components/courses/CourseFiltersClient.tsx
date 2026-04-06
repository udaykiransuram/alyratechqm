"use client";

import { startTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { CourseFiltersProps } from "@/components/courses/course-filters.types";
import {
  SearchableCommandSelect,
} from "@/components/ui/searchable-command-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type { CourseFiltersProps };

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

export default function CourseFiltersClient({
  classId = "all",
  classOptions = [],
  sectionId = "all",
  sectionOptions = [],
  subjectId = "all",
  subjectOptions = [],
  query = "",
  showClassFilter = true,
  showSectionFilter = true,
  showSubjectFilter = true,
  variant = "panel",
}: CourseFiltersProps) {
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
      ]
        .join(" ")
        .trim()}
    >
      <div className="app-filter-panel-body space-y-4">
        <div className="app-filter-grid xl:grid-cols-4">
          {showClassFilter ? (
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
          ) : null}

          {showSectionFilter ? (
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
          ) : null}

          {showSubjectFilter ? (
            <div className="app-field-group">
              <span className="app-field-label">Subject</span>
              <SearchableCommandSelect
                value={subjectId}
                options={[
                  { value: "all", label: "All subjects" },
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
          ) : null}

          <div className="app-field-group">
            <span className="app-field-label">Course name</span>
            <Input
              value={query}
              placeholder="Search courses..."
              onChange={(event) =>
                updateFilters({
                  q: event.target.value,
                })
              }
            />
          </div>
        </div>

        <div className={variant === "panel" ? "app-filter-summary" : "app-filter-embedded-actions"}>
          {variant === "panel" ? (
            <>
              <div className="app-filter-summary-copy">
                <p className="app-filter-summary-title">Course filters</p>
                <p className="app-filter-summary-note">
                  Narrow by class, section, subject, or course name.
                </p>
              </div>
              <div className="app-filter-summary-actions">
                <Button
                  type="button"
                  variant="outline"
                  className="app-button-filter"
                  onClick={() =>
                    updateFilters({
                      classId: "all",
                      sectionId: "all",
                      subjectId: "all",
                      q: "",
                    })
                  }
                >
                  Reset
                </Button>
              </div>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="app-button-filter"
              onClick={() =>
                updateFilters({
                  classId: "all",
                  sectionId: "all",
                  subjectId: "all",
                  q: "",
                })
              }
            >
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
