"use client";

import { useEffect, useMemo, useState } from "react";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import PageHero from "@/components/layout/PageHero";
import ListPagination from "@/components/ui/list-pagination";
import PageLoadingState from "@/components/ui/page-loading-state";
import { useReturnHrefBuilder } from "@/hooks/useReturnNavigation";

interface StudentItem {
  _id: string;
  name: string;
  email?: string;
  rollNumber?: string;
  enrolledAt?: string;
  academicSectionId?: string;
  academicSectionName?: string;
}

interface StudentGroup {
  groupId: string;
  classId: string;
  className: string;
  academicSectionId?: string;
  academicSectionName?: string;
  groupName: string;
  count: number;
  students: StudentItem[];
}

interface ClassItem {
  _id: string;
  name: string;
}

interface AcademicSectionItem {
  _id: string;
  name: string;
  class?: { _id: string; name: string } | string;
}

const STUDENT_GROUP_PAGE_SIZE = 8;

function getSectionClassId(section: AcademicSectionItem) {
  const rawClass = section.class as any;
  return typeof section.class === "string"
    ? section.class
    : String(rawClass?._id || rawClass || "");
}

export default function StudentsByClassPage() {
  const { buildReturnHref } = useReturnHrefBuilder("/workspace/students");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<StudentGroup[]>([]);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<AcademicSectionItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [groupPage, setGroupPage] = useState(1);
  const [groupPages, setGroupPages] = useState(1);
  const [totalGroups, setTotalGroups] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);

  const [pages, setPages] = useState<Record<string, number>>({});
  const pageSize = 10;

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteLoading, setArchiveLoading] = useState(false);
  const [editStudent, setEditStudent] = useState<{ _id: string; name: string } | null>(null);
  const [editClassId, setEditClassId] = useState<string>("");
  const [editAcademicSectionId, setEditAcademicSectionId] = useState<string>("");
  const [editRollNumber, setEditRollNumber] = useState<string>("");
  const [editEnrolledAt, setEditEnrolledAt] = useState<string>("");

  useEffect(() => {
    Promise.all([fetch("/api/classes"), fetch("/api/sections")])
      .then(async ([classesRes, sectionsRes]) => {
        const classesData = await classesRes.json();
        const sectionsData = await sectionsRes.json();
        if (classesData.success) setClasses(classesData.classes || []);
        if (sectionsData.success) setSections(sectionsData.sections || []);
      })
      .catch(() => {
        setError("Failed to load class or section filters.");
      });
  }, []);

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

  const fetchData = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const params = new URLSearchParams();
      if (selectedClass && selectedClass !== "all") params.set("classId", selectedClass);
      if (selectedSection && selectedSection !== "all") params.set("sectionId", selectedSection);
      if (appliedQuery) params.set("q", appliedQuery);
      if (includeEmpty) params.set("includeEmpty", "true");
      params.set("page", String(groupPage));
      params.set("limit", String(STUDENT_GROUP_PAGE_SIZE));
      const res = await fetch(`/api/users/students-by-class?${params.toString()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to load students");
      setGroups(data.data || []);
      setTotalStudents(Math.max(0, Number(data.totalStudents) || 0));
      setTotalGroups(Math.max(0, Number(data.totalGroups) || 0));
      setGroupPages(Math.max(1, Number(data.pages) || 1));
      setGroupPage(Math.max(1, Number(data.page) || 1));
      const initialPages: Record<string, number> = {};
      (data.data || []).forEach((group: StudentGroup) => {
        initialPages[group.groupId] = 1;
      });
      setPages(initialPages);
    } catch (e: any) {
      if (!silent) {
        setError(e.message);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, selectedSection, includeEmpty, appliedQuery, groupPage]);
  const selectedClassLabel = useMemo(() => {
    if (selectedClass === "all") return "All Classes";
    return classes.find((classItem) => classItem._id === selectedClass)?.name || "Selected Class";
  }, [classes, selectedClass]);
  const selectedSectionLabel = useMemo(() => {
    if (selectedSection === "all") return "All Sections";
    return (
      sections.find((section) => section._id === selectedSection)?.name ||
      "Selected Section"
    );
  }, [sections, selectedSection]);
  const activeFilterCount = [
    selectedClass !== "all",
    selectedSection !== "all",
    Boolean(appliedQuery),
    includeEmpty,
  ].filter(Boolean).length;
  const refreshing = loading && groups.length > 0;

  const onSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const nextQuery = query.trim();
    if (nextQuery === appliedQuery) {
      if (groupPage !== 1) {
        setGroupPage(1);
      } else {
        fetchData();
      }
      return;
    }
    setGroupPage(1);
    setAppliedQuery(nextQuery);
  };

  const changePage = (groupId: string, dir: 1 | -1) => {
    setPages((prev) => {
      const current = prev[groupId] || 1;
      const group = groups.find((item) => item.groupId === groupId);
      const maxPage = group
        ? Math.max(1, Math.ceil((group.students?.length || 0) / pageSize))
        : 1;
      const next = Math.min(maxPage, Math.max(1, current + dir));
      return { ...prev, [groupId]: next };
    });
  };

  const resetFilters = () => {
    setGroupPage(1);
    setSelectedClass("all");
    setSelectedSection("all");
    setQuery("");
    setAppliedQuery("");
    setIncludeEmpty(false);
  };

  const exportCSV = (group: StudentGroup) => {
    const headers = ["Name", "Class", "Section", "Roll Number", "Email", "Enrolled At"];
    const rows = group.students.map((student) => [
      escapeCSV(student.name || ""),
      escapeCSV(group.className || ""),
      escapeCSV(student.academicSectionName || group.academicSectionName || ""),
      escapeCSV(student.rollNumber || ""),
      escapeCSV(student.email || ""),
      escapeCSV(student.enrolledAt ? new Date(student.enrolledAt).toISOString().split("T")[0] : ""),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${group.groupName.replace(/\s+/g, "_")}_students.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const escapeCSV = (value: string) => {
    if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  };

  function openEditModal(student: StudentItem, groupClassId: string) {
    setEditStudent({ _id: student._id, name: student.name });
    setEditClassId(groupClassId);
    setEditAcademicSectionId(student.academicSectionId || "");
    setEditRollNumber(student.rollNumber || "");
    setEditEnrolledAt(
      student.enrolledAt ? new Date(student.enrolledAt).toISOString().split("T")[0] : "",
    );
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editStudent) return;
    try {
      setSaving(true);
      const body: any = {
        name: editStudent.name,
        role: "student",
        class: editClassId,
        academicSection: editAcademicSectionId,
        rollNumber: editRollNumber,
      };
      if (editEnrolledAt) body.enrolledAt = new Date(editEnrolledAt);
      const res = await fetch(`/api/users/${editStudent._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to update");
      setEditOpen(false);
      void fetchData({ silent: true });
    } catch (e: any) {
      alert(e.message || "Failed to update student");
    } finally {
      setSaving(false);
    }
  }

  async function deleteStudent(studentId: string) {
    if (!window.confirm("Archive this student?")) return;
    try {
      setArchiveLoading(true);
      const res = await fetch(`/api/users/${studentId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to archive");
      void fetchData({ silent: true });
    } catch (e: any) {
      alert(e.message || "Failed to archive student");
    } finally {
      setArchiveLoading(false);
    }
  }

  const editSections = useMemo(
    () => sections.filter((section) => getSectionClassId(section) === editClassId),
    [sections, editClassId],
  );

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="People"
        title="Students"
        description="Browse students by class and section, then update assignments from a consistent school workspace."
        actions={
          <AppPrefetchLink
            href="/workspace/students/create"
            prefetchOnMount
            relatedApiPrefetches={['/api/classes', '/api/sections']}
          >
            <Button>Create Student</Button>
          </AppPrefetchLink>
        }
        meta={
          <>
            <span className="app-meta-chip">{selectedClassLabel}</span>
            <span className="app-meta-chip">{selectedSectionLabel}</span>
            {includeEmpty ? <span className="app-meta-chip">Showing empty groups</span> : null}
            {refreshing ? <span className="app-meta-chip">Refreshing...</span> : null}
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
            meta: "Class and section groupings across all pages in the current result set.",
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
                Search across student groups, narrow by class and section, or include empty groups when reviewing setup coverage.
              </p>
            </div>
            <div className="app-filter-panel-chips">
              <span className="app-meta-chip">
                {activeFilterCount > 0 ? `${activeFilterCount} active filters` : "No active filters"}
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
            className="app-filter-grid xl:grid-cols-[minmax(0,1fr)_180px_180px_auto_auto]"
          >
            <Input
              placeholder="Search by name, email, or roll number"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select
              value={selectedClass}
              onValueChange={(value) => {
                setGroupPage(1);
                setSelectedClass(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((classItem) => (
                  <SelectItem key={classItem._id} value={classItem._id}>
                    {classItem.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedSection}
              onValueChange={(value) => {
                setGroupPage(1);
                setSelectedSection(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {availableSections.map((section) => (
                  <SelectItem key={section._id} value={section._id}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit">Apply</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setGroupPage(1);
                setIncludeEmpty((prev) => !prev);
              }}
            >
              {includeEmpty ? "Hide Empty" : "Show Empty"}
            </Button>
          </form>
          <div className="app-filter-summary">
            <div className="app-filter-summary-copy">
              <p className="app-filter-summary-title">
                {totalStudents} student{totalStudents === 1 ? "" : "s"} across {totalGroups} group{totalGroups === 1 ? "" : "s"}
              </p>
              <p className="app-filter-summary-note">
                Students remain grouped by class and section so exports and quick edits stay predictable.
              </p>
            </div>
            <div className="app-filter-summary-actions">
              <Button type="button" variant="outline" onClick={resetFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}

      {loading && groups.length === 0 ? (
        <PageLoadingState
          title="Loading students"
          description="Preparing grouped student results for the current class and section filters."
          className="px-0 py-0"
          contentClassName="max-w-none"
          dense
        />
      ) : groups.length === 0 ? (
        <div className="app-empty-state">No students found.</div>
      ) : (
        <div className="space-y-3">
          <ListPagination
            page={groupPage}
            totalPages={groupPages}
            totalItems={totalGroups}
            pageSize={STUDENT_GROUP_PAGE_SIZE}
            itemLabel="groups"
            onPageChange={setGroupPage}
            disabled={loading}
          />
          <Accordion type="multiple" className="space-y-3">
            {groups.map((group) => {
              const page = pages[group.groupId] || 1;
              const start = (page - 1) * pageSize;
              const end = start + pageSize;
              const pageItems = group.students.slice(start, end);
              const maxPage = Math.max(1, Math.ceil(group.students.length / pageSize));
              return (
                <AccordionItem
                  key={group.groupId}
                  value={group.groupId}
                  className="app-surface overflow-hidden"
                >
                  <AccordionTrigger className="px-4 py-4 no-underline hover:no-underline sm:px-5">
                    <div className="flex w-full items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1 text-left">
                        <span className="text-base font-semibold text-foreground">
                          {group.academicSectionName || "Unassigned Section"}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>Class: {group.className}</span>
                          <span>•</span>
                          <span>{group.count} student{group.count === 1 ? "" : "s"}</span>
                        </div>
                      </div>
                      <span className="app-meta-chip">{group.groupName}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 px-4 pb-4 sm:px-5">
                      <div className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">
                              Section actions
                            </p>
                            <p className="text-xs leading-5 text-muted-foreground">
                              Page {page} of {maxPage}. Export uses the same student grouping shown here.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="app-button-compact"
                              onClick={() => changePage(group.groupId, -1)}
                              disabled={page <= 1}
                            >
                              Prev
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="app-button-compact"
                              onClick={() => changePage(group.groupId, 1)}
                              disabled={page >= maxPage}
                            >
                              Next
                            </Button>
                            <Separator orientation="vertical" className="hidden h-6 sm:block" />
                            <Button size="sm" className="app-button-compact" onClick={() => exportCSV(group)}>
                              Export CSV
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="app-table-wrap">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Roll No.</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Enrolled</TableHead>
                              <TableHead className="w-[240px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pageItems.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                  No students on this page.
                                </TableCell>
                              </TableRow>
                            ) : (
                              pageItems.map((student) => (
                                <TableRow key={student._id}>
                                  <TableCell className="font-medium">{student.name}</TableCell>
                                  <TableCell>{student.rollNumber || "-"}</TableCell>
                                  <TableCell>{student.email || "-"}</TableCell>
                                  <TableCell>
                                    {student.enrolledAt
                                      ? new Date(student.enrolledAt).toLocaleDateString()
                                      : "-"}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <AppPrefetchLink
                                        href={buildReturnHref(`/workspace/students/${student._id}`)}
                                        relatedApiPrefetches={[
                                          `/api/users/${student._id}`,
                                          '/api/classes',
                                          '/api/sections',
                                          `/api/question-paper-response?student=${encodeURIComponent(student._id)}`,
                                        ]}
                                      >
                                        <Button variant="outline" size="sm" className="app-button-compact">View</Button>
                                      </AppPrefetchLink>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="app-button-compact"
                                        onClick={() => openEditModal(student, group.classId)}
                                      >
                                        Edit
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        className="app-button-compact"
                                        disabled={deleteLoading}
                                        onClick={() => deleteStudent(student._id)}
                                      >
                                        {deleteLoading ? "Archiving…" : "Archive"}
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" className="col-span-3" value={editStudent?.name || ""} onChange={(e) => setEditStudent((student) => student ? { ...student, name: e.target.value } : student)} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Class</Label>
              <div className="col-span-3">
                <Select value={editClassId} onValueChange={(value) => {
                  setEditClassId(value);
                  setEditAcademicSectionId("");
                }}>
                  <SelectTrigger className="app-control-compact">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((classItem) => (
                      <SelectItem key={classItem._id} value={classItem._id}>{classItem.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Section</Label>
              <div className="col-span-3">
                <Select value={editAcademicSectionId} onValueChange={setEditAcademicSectionId}>
                  <SelectTrigger className="app-control-compact">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {editSections.map((section) => (
                      <SelectItem key={section._id} value={section._id}>{section.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="roll" className="text-right">Roll No.</Label>
              <Input id="roll" className="col-span-3" value={editRollNumber} onChange={(e) => setEditRollNumber(e.target.value)} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="enrolled" className="text-right">Enrolled At</Label>
              <Input id="enrolled" className="col-span-3" type="date" value={editEnrolledAt} onChange={(e) => setEditEnrolledAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
