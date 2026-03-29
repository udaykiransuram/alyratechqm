"use client";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type StudentItem = {
  _id: string;
  name: string;
  fatherName?: string;
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

type StudentsGroupsSectionProps = {
  groups: StudentGroup[];
  pagesByGroup: Record<string, number>;
  perGroupPageSize: number;
  archiveLoading: boolean;
  buildStudentViewHref: (studentId: string) => string;
  onChangeGroupPage: (groupId: string, direction: 1 | -1) => void;
  onExportCsv: (group: StudentGroup) => void;
  onOpenEditModal: (student: StudentItem, groupClassId: string) => void;
  onDeleteStudent: (studentId: string) => Promise<void>;
};

const enrolledDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatEnrolledAt(value?: string) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return enrolledDateFormatter.format(parsed);
}

export default function StudentsGroupsSection({
  groups,
  pagesByGroup,
  perGroupPageSize,
  archiveLoading,
  buildStudentViewHref,
  onChangeGroupPage,
  onExportCsv,
  onOpenEditModal,
  onDeleteStudent,
}: StudentsGroupsSectionProps) {
  return (
    <div className="space-y-3">
      <Accordion type="multiple" className="space-y-3">
        {groups.map((group) => {
          const groupPageIndex = pagesByGroup[group.groupId] || 1;
          const start = (groupPageIndex - 1) * perGroupPageSize;
          const end = start + perGroupPageSize;
          const pageItems = group.students.slice(start, end);
          const maxPage = Math.max(
            1,
            Math.ceil(group.students.length / perGroupPageSize),
          );

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
                      <span>
                        {group.count} student{group.count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <span className="app-meta-chip">{group.groupName}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 px-4 pb-4 sm:px-5">
                  <div className="app-toolbar">
                    <div className="app-toolbar-row">
                      <div className="app-toolbar-copy">
                        <p className="app-toolbar-title">Section actions</p>
                        <p className="app-toolbar-note">
                          Page {groupPageIndex} of {maxPage}. Export uses the
                          same student grouping shown here.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="app-button-compact"
                          onClick={() => onChangeGroupPage(group.groupId, -1)}
                          disabled={groupPageIndex <= 1}
                        >
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="app-button-compact"
                          onClick={() => onChangeGroupPage(group.groupId, 1)}
                          disabled={groupPageIndex >= maxPage}
                        >
                          Next
                        </Button>
                        <Separator
                          orientation="vertical"
                          className="hidden h-6 sm:block"
                        />
                        <Button
                          size="sm"
                          className="app-button-compact"
                          onClick={() => onExportCsv(group)}
                        >
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
                            <TableCell
                              colSpan={5}
                              className="text-center text-muted-foreground"
                            >
                              No students on this page.
                            </TableCell>
                          </TableRow>
                        ) : (
                          pageItems.map((student) => (
                            <TableRow key={student._id}>
                              <TableCell className="font-medium">
                                {student.name}
                              </TableCell>
                              <TableCell>{student.rollNumber || "-"}</TableCell>
                              <TableCell>{student.email || "-"}</TableCell>
                              <TableCell>{formatEnrolledAt(student.enrolledAt)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="app-button-compact"
                                  >
                                    <AppPrefetchLink
                                      href={buildStudentViewHref(student._id)}
                                      relatedApiPrefetches={[
                                        `/api/users/${student._id}`,
                                        "/api/classes",
                                        "/api/sections",
                                        `/api/question-paper-response?student=${encodeURIComponent(student._id)}`,
                                      ]}
                                    >
                                      View
                                    </AppPrefetchLink>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="app-button-compact"
                                    onClick={() =>
                                      onOpenEditModal(student, group.classId)
                                    }
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="app-button-compact"
                                    disabled={archiveLoading}
                                    onClick={() => void onDeleteStudent(student._id)}
                                  >
                                    {archiveLoading ? "Archiving..." : "Archive"}
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
  );
}
