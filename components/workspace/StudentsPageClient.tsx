"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchableCommandOption } from "@/components/ui/searchable-command-select";
import ListPagination from "@/components/ui/list-pagination";
import { useReturnHrefBuilder } from "@/hooks/useReturnNavigation";

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

const StudentsGroupsSection = dynamic(
  () => import("@/components/workspace/students/StudentsGroupsSection"),
);
const StudentEditDialog = dynamic(
  () => import("@/components/workspace/students/StudentEditDialog"),
  { ssr: false },
);

type StudentItem = {
  _id: string;
  name: string;
  email?: string;
  rollNumber?: string;
  enrolledAt?: string;
  academicSectionId?: string;
  academicSectionName?: string;
};

type StudentGroup = {
  groupId: string;
  classId: string;
  className: string;
  academicSectionId?: string;
  academicSectionName?: string;
  groupName: string;
  count: number;
  students: StudentItem[];
};

type ClassItem = {
  _id: string;
  name: string;
};

type AcademicSectionItem = {
  _id: string;
  name: string;
  class?: { _id: string; name: string } | string;
};

type StudentEditDraft = {
  _id: string;
  name: string;
  classId: string;
  academicSectionId: string;
  rollNumber: string;
  enrolledAt: string;
};

type StudentsPageClientProps = {
  classes: ClassItem[];
  sections: AcademicSectionItem[];
  groups: StudentGroup[];
  totalStudents: number;
  totalGroups: number;
  groupPage: number;
  groupPages: number;
  initialClassFilter: string;
  initialSectionFilter: string;
  initialQuery: string;
  includeEmpty: boolean;
  loadError?: string | null;
};

function getSectionClassId(section: AcademicSectionItem) {
  const rawClass = section.class as any;
  return typeof section.class === "string"
    ? section.class
    : String(rawClass?._id || rawClass || "");
}

function escapeCSV(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function buildInitialGroupPages(groups: StudentGroup[]) {
  const pages: Record<string, number> = {};
  groups.forEach((group) => {
    pages[group.groupId] = 1;
  });
  return pages;
}

export default function StudentsPageClient({
  classes,
  sections,
  groups,
  totalStudents,
  totalGroups,
  groupPage,
  groupPages,
  initialClassFilter,
  initialSectionFilter,
  initialQuery,
  includeEmpty,
  loadError = null,
}: StudentsPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { buildReturnHref } = useReturnHrefBuilder("/workspace/students");

  const [selectedClass, setSelectedClass] = useState(initialClassFilter);
  const [selectedSection, setSelectedSection] = useState(initialSectionFilter);
  const [query, setQuery] = useState(initialQuery);
  const [appliedQuery, setAppliedQuery] = useState(initialQuery);
  const [includeEmptyGroups, setIncludeEmptyGroups] = useState(includeEmpty);

  const [pages, setPages] = useState<Record<string, number>>(() =>
    buildInitialGroupPages(groups),
  );
  const perGroupPageSize = 10;
  const hasInitializedPages = useRef(false);

  const [archiveLoading, setArchiveLoading] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentEditDraft | null>(null);

  useEffect(() => {
    setSelectedClass(initialClassFilter);
    setSelectedSection(initialSectionFilter);
    setQuery(initialQuery);
    setAppliedQuery(initialQuery);
    setIncludeEmptyGroups(includeEmpty);
  }, [includeEmpty, initialClassFilter, initialQuery, initialSectionFilter]);

  useEffect(() => {
    if (!hasInitializedPages.current) {
      hasInitializedPages.current = true;
      return;
    }
    setPages(buildInitialGroupPages(groups));
  }, [groups]);

  const availableSections = useMemo(() => {
    if (selectedClass === "all") return sections;
    return sections.filter((section) => getSectionClassId(section) === selectedClass);
  }, [sections, selectedClass]);

  useEffect(() => {
    if (
      selectedSection !== "all" &&
      !availableSections.some((section) => section._id === selectedSection)
    ) {
      setSelectedSection("all");
    }
  }, [availableSections, selectedSection]);

  const classFilterOptions = useMemo<SearchableCommandOption[]>(
    () => [
      {
        value: "all",
        label: "All classes",
        description: "View students grouped across every class.",
      },
      ...classes.map((classItem) => ({
        value: classItem._id,
        label: classItem.name,
      })),
    ],
    [classes],
  );

  const sectionFilterOptions = useMemo<SearchableCommandOption[]>(
    () => [
      {
        value: "all",
        label: "All sections",
        description: "Keep the grouped student list scoped to every section.",
      },
      ...availableSections.map((section) => ({
        value: section._id,
        label: section.name,
      })),
    ],
    [availableSections],
  );

  const selectedClassLabel = useMemo(() => {
    if (selectedClass === "all") return "All Classes";
    return classes.find((classItem) => classItem._id === selectedClass)?.name || "Selected Class";
  }, [classes, selectedClass]);

  const selectedSectionLabel = useMemo(() => {
    if (selectedSection === "all") return "All Sections";
    return sections.find((section) => section._id === selectedSection)?.name || "Selected Section";
  }, [sections, selectedSection]);

  const activeFilterCount = [
    selectedClass !== "all",
    selectedSection !== "all",
    Boolean(appliedQuery),
    includeEmptyGroups,
  ].filter(Boolean).length;

  const navigateWithFilters = ({
    nextClass = selectedClass,
    nextSection = selectedSection,
    nextQuery = appliedQuery,
    nextIncludeEmpty = includeEmptyGroups,
    nextPage = 1,
    preserveScroll = false,
  }: {
    nextClass?: string;
    nextSection?: string;
    nextQuery?: string;
    nextIncludeEmpty?: boolean;
    nextPage?: number;
    preserveScroll?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (nextClass && nextClass !== "all") params.set("classId", nextClass);
    if (nextSection && nextSection !== "all") params.set("sectionId", nextSection);
    if (nextQuery) params.set("q", nextQuery);
    if (nextIncludeEmpty) params.set("includeEmpty", "true");
    if (nextPage > 1) params.set("page", String(nextPage));
    params.set("limit", "8");

    const href = params.toString()
      ? `/workspace/students?${params.toString()}`
      : "/workspace/students";

    startTransition(() => {
      router.push(href, { scroll: !preserveScroll });
    });
  };

  const onSearch = (event?: React.FormEvent) => {
    event?.preventDefault();
    const nextQuery = query.trim();
    setAppliedQuery(nextQuery);
    navigateWithFilters({
      nextClass: selectedClass,
      nextSection: selectedSection,
      nextQuery,
      nextIncludeEmpty: includeEmptyGroups,
      nextPage: 1,
    });
  };

  const resetFilters = () => {
    setSelectedClass("all");
    setSelectedSection("all");
    setQuery("");
    setAppliedQuery("");
    setIncludeEmptyGroups(false);
    startTransition(() => {
      router.push("/workspace/students");
    });
  };

  const exportCSV = (group: StudentGroup) => {
    const headers = ["Name", "Class", "Section", "Roll Number", "Email", "Enrolled At"];
    const rows = group.students.map((student) => [
      escapeCSV(student.name || ""),
      escapeCSV(group.className || ""),
      escapeCSV(student.academicSectionName || group.academicSectionName || ""),
      escapeCSV(student.rollNumber || ""),
      escapeCSV(student.email || ""),
      escapeCSV(
        student.enrolledAt ? new Date(student.enrolledAt).toISOString().split("T")[0] : "",
      ),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${group.groupName.replace(/\s+/g, "_")}_students.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const changeGroupPage = (groupId: string, direction: 1 | -1) => {
    setPages((previous) => {
      const current = previous[groupId] || 1;
      const group = groups.find((item) => item.groupId === groupId);
      const maxPage = group
        ? Math.max(1, Math.ceil((group.students?.length || 0) / perGroupPageSize))
        : 1;
      const nextPage = Math.min(maxPage, Math.max(1, current + direction));
      return { ...previous, [groupId]: nextPage };
    });
  };

  const openEditModal = (student: StudentItem, groupClassId: string) => {
    setEditStudent({
      _id: student._id,
      name: student.name,
      classId: groupClassId,
      academicSectionId: student.academicSectionId || "",
      rollNumber: student.rollNumber || "",
      enrolledAt: student.enrolledAt
        ? new Date(student.enrolledAt).toISOString().split("T")[0]
        : "",
    });
  };

  const deleteStudent = async (studentId: string) => {
    if (!window.confirm("Archive this student?")) return;
    try {
      setArchiveLoading(true);
      const response = await fetch(`/api/users/${studentId}`, { method: "DELETE" });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to archive");
      }
      router.refresh();
    } catch (error: any) {
      alert(error.message || "Failed to archive student");
    } finally {
      setArchiveLoading(false);
    }
  };

  return (
    <PageShell width="wide" padding="standard">
      <PageHero
        variant="directory"
        eyebrow="People"
        title="Students"
        description="Browse students by class and section, then update assignments and enrollment details from one learner directory."
        actions={
          <Button asChild className="app-button-page">
            <AppPrefetchLink
              href="/workspace/students/create"
              prefetchOnMount
              relatedApiPrefetches={["/api/classes", "/api/sections"]}
            >
              Create Student
            </AppPrefetchLink>
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">{selectedClassLabel}</span>
            <span className="app-meta-chip">{selectedSectionLabel}</span>
            {includeEmptyGroups ? (
              <span className="app-meta-chip">Showing empty groups</span>
            ) : null}
            {isPending ? <span className="app-meta-chip">Refreshing...</span> : null}
          </>
        }
        stats={[
          {
            label: "Total students",
            value: String(totalStudents),
            meta: "Students currently returned by the active filters.",
          },
          {
            label: "Visible groups",
            value: String(totalGroups),
            meta: "Class and section groupings on the active page window.",
          },
          {
            label: "Search query",
            value: appliedQuery || "None",
            meta: "Name, email, and roll-number search across student groups.",
          },
          {
            label: "Edit mode",
            value: "Inline ready",
            meta: "View, edit, export, and archive directly from the grouped list.",
          },
        ]}
      />

      <Card className="app-filter-panel">
        <CardHeader className="app-filter-panel-header">
          <div className="app-filter-panel-heading">
            <div className="app-filter-panel-copy">
              <CardTitle className="app-filter-panel-title">Student Filters</CardTitle>
              <p className="app-filter-panel-note">
                Search across student groups, narrow by class and section, or include empty
                groups when reviewing setup coverage.
              </p>
            </div>
            <div className="app-filter-panel-chips">
              <span className="app-meta-chip">
                {activeFilterCount > 0
                  ? `${activeFilterCount} active filters`
                  : "No active filters"}
              </span>
              <span className="app-meta-chip">
                {totalGroups} grouped result{totalGroups === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="app-filter-panel-body">
          <form
            onSubmit={onSearch}
            className="app-filter-grid xl:grid-cols-[minmax(0,1fr)_11rem_minmax(18rem,1.35fr)_auto_auto]"
          >
            <Input
              placeholder="Search by name, email, or roll number"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <SearchableCommandSelect
              value={selectedClass}
              options={classFilterOptions}
              onValueChange={setSelectedClass}
              placeholder="Filter class"
              searchPlaceholder="Search classes..."
              emptyText="No classes found."
              onClear={() => setSelectedClass("all")}
              showCloseAction
            />
            <SearchableCommandSelect
              value={selectedSection}
              options={sectionFilterOptions}
              onValueChange={setSelectedSection}
              placeholder="Filter section"
              searchPlaceholder="Search sections..."
              emptyText="No sections found."
              triggerClassName="xl:min-w-[18rem]"
              onClear={() => setSelectedSection("all")}
              showCloseAction
            />
            <Button type="submit" className="app-button-filter" disabled={isPending}>
              Apply
            </Button>
            <Button
              type="button"
              variant="outline"
              className="app-button-filter"
              disabled={isPending}
              onClick={() => {
                const nextIncludeEmpty = !includeEmptyGroups;
                setIncludeEmptyGroups(nextIncludeEmpty);
                navigateWithFilters({
                  nextClass: selectedClass,
                  nextSection: selectedSection,
                  nextQuery: appliedQuery,
                  nextIncludeEmpty,
                  nextPage: 1,
                });
              }}
            >
              {includeEmptyGroups ? "Hide Empty" : "Show Empty"}
            </Button>
          </form>
          <div className="app-filter-summary">
            <div className="app-filter-summary-copy">
              <p className="app-filter-summary-title">
                {totalStudents} student{totalStudents === 1 ? "" : "s"} across {totalGroups} group
                {totalGroups === 1 ? "" : "s"}
              </p>
              <p className="app-filter-summary-note">
                Students remain grouped by class and section so exports and quick edits stay
                predictable.
              </p>
            </div>
            <div className="app-filter-summary-actions">
              <Button
                type="button"
                variant="outline"
                className="app-button-filter"
                onClick={resetFilters}
                disabled={isPending}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loadError ? <div className="app-feedback app-feedback-error">{loadError}</div> : null}

      {groups.length === 0 ? (
        <div className="app-empty-state">
          <p>No students found for the current filters.</p>
          <div className="mt-4 flex justify-center">
            <Button asChild variant="outline" className="app-button-page">
              <AppPrefetchLink
                href="/workspace/students/create"
                relatedApiPrefetches={["/api/classes", "/api/sections"]}
              >
                Create student
              </AppPrefetchLink>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <ListPagination
            page={groupPage}
            totalPages={groupPages}
            totalItems={totalGroups}
            pageSize={8}
            itemLabel="groups"
            onPageChange={(nextPage, options) =>
              navigateWithFilters({
                nextClass: selectedClass,
                nextSection: selectedSection,
                nextQuery: appliedQuery,
                nextIncludeEmpty: includeEmptyGroups,
                nextPage,
                preserveScroll: Boolean(options?.preserveScroll),
              })
            }
            disabled={isPending}
          />
          <StudentsGroupsSection
            groups={groups}
            pagesByGroup={pages}
            perGroupPageSize={perGroupPageSize}
            archiveLoading={archiveLoading}
            buildStudentViewHref={(studentId) =>
              buildReturnHref(`/workspace/students/${studentId}`)
            }
            onChangeGroupPage={changeGroupPage}
            onExportCsv={exportCSV}
            onOpenEditModal={openEditModal}
            onDeleteStudent={deleteStudent}
          />
        </div>
      )}

      {editStudent ? (
        <StudentEditDialog
          open={Boolean(editStudent)}
          student={editStudent}
          classes={classes}
          sections={sections}
          onClose={() => setEditStudent(null)}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </PageShell>
  );
}
