"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import ListPagination from "@/components/ui/list-pagination";
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
import { useReturnHrefBuilder } from "@/hooks/useReturnNavigation";

import {
  getPaperClassId,
  getPaperQuestionCount,
  getSectionClassId,
  type QuestionPaperDirectoryAcademicSectionItem,
  type QuestionPaperDirectoryClassItem,
  type QuestionPaperDirectoryPaper,
} from "./question-paper-directory-shared";

function QuestionPaperRowActionsFallback() {
  return (
    <div className="min-w-[26rem] space-y-2">
      <div className="h-9 rounded-md border border-border/40 bg-muted/40" />
      <div className="h-9 rounded-md border border-border/30 bg-muted/30" />
    </div>
  );
}

const QuestionPaperDirectoryRowActions = dynamic(
  () =>
    import(
      "@/components/workspace/question-papers/QuestionPaperDirectoryRowActions"
    ),
  {
    ssr: false,
    loading: QuestionPaperRowActionsFallback,
  },
);

type QuestionPapersDirectoryTableProps = {
  rows: QuestionPaperDirectoryPaper[];
  classes: QuestionPaperDirectoryClassItem[];
  academicSections: QuestionPaperDirectoryAcademicSectionItem[];
  basePath: string;
  totalPapers: number;
  page: number;
  pages: number;
  pageSize: number;
  sectionFilterId: string;
  selectedSectionLabel: string;
  selectedPaperIdSet: Set<string>;
  allVisibleChecked: boolean;
  selectedAcademicSectionIds: Record<string, string>;
  deletingId: string | null;
  sendingReportsPaperId: string | null;
  excelLoadingId: string | null;
  onPageChange: (
    nextPage: number,
    options?: { preserveScroll?: boolean },
  ) => void;
  onToggleVisibleSelection: (checked: boolean) => void;
  onTogglePaperSelection: (paperId: string, checked: boolean) => void;
  onAcademicSectionSelectionChange: (
    paperId: string,
    nextSectionId: string,
  ) => void;
  onSendReports: (paperId: string) => void;
  onDownloadExcel: (paperId: string) => void;
  onArchive: (paperId: string) => void;
};

export default function QuestionPapersDirectoryTable({
  rows,
  classes,
  academicSections,
  basePath,
  totalPapers,
  page,
  pages,
  pageSize,
  sectionFilterId,
  selectedSectionLabel,
  selectedPaperIdSet,
  allVisibleChecked,
  selectedAcademicSectionIds,
  deletingId,
  sendingReportsPaperId,
  excelLoadingId,
  onPageChange,
  onToggleVisibleSelection,
  onTogglePaperSelection,
  onAcademicSectionSelectionChange,
  onSendReports,
  onDownloadExcel,
  onArchive,
}: QuestionPapersDirectoryTableProps) {
  const { buildReturnHref } = useReturnHrefBuilder(basePath);
  const [mountRowActions, setMountRowActions] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMountRowActions(true);
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const getClassNameById = useCallback(
    (classId: string) => {
      if (!classId) {
        return "";
      }

      return (
        classes.find(
          (classItem) => String(classItem?._id || "") === String(classId),
        )?.name || ""
      );
    },
    [classes],
  );

  const getPaperClassName = useCallback(
    (paper: QuestionPaperDirectoryPaper) => {
      if (typeof paper?.class === "object" && paper?.class?.name) {
        return String(paper.class.name);
      }

      const paperClassId = getPaperClassId(paper);
      return (
        getClassNameById(paperClassId) ||
        (paperClassId ? "Unknown class" : "-")
      );
    },
    [getClassNameById],
  );

  const getSectionClassName = useCallback(
    (section: any, fallbackClassId = "") => {
      if (typeof section?.class === "object" && section?.class?.name) {
        return String(section.class.name);
      }

      const classId = getSectionClassId(section) || fallbackClassId;
      return getClassNameById(classId) || "";
    },
    [getClassNameById],
  );

  const getPaperSectionOptions = useCallback(
    (paper: QuestionPaperDirectoryPaper) => {
      const paperClassId = getPaperClassId(paper);
      const paperClassName = getPaperClassName(paper);
      const assignedSections = Array.isArray(paper?.assignedAcademicSections)
        ? paper.assignedAcademicSections
            .map((section: any) => ({
              _id: String(section?._id || section || ""),
              name: String(section?.name || ""),
              classId: getSectionClassId(section) || paperClassId,
              className:
                getSectionClassName(section, paperClassId) || paperClassName,
            }))
            .filter((section: any) => section._id)
        : [];

      if (assignedSections.length > 0) {
        return assignedSections;
      }

      if (!paperClassId) {
        return [];
      }

      return academicSections
        .filter((section) => String(section.class?._id || "") === paperClassId)
        .map((section) => ({
          _id: String(section._id || ""),
          name: String(section.name || ""),
          classId: paperClassId,
          className:
            getSectionClassName(section, paperClassId) || paperClassName,
        }))
        .filter((section) => section._id);
    },
    [academicSections, getPaperClassName, getSectionClassName],
  );

  const getSelectedAcademicSectionId = useCallback(
    (paper: QuestionPaperDirectoryPaper) => {
      if (
        sectionFilterId !== "all" &&
        getPaperSectionOptions(paper).some(
          (section: any) => section._id === sectionFilterId,
        )
      ) {
        return sectionFilterId;
      }

      const selectedAcademicSectionId =
        selectedAcademicSectionIds[String(paper._id)] || "all";

      return selectedAcademicSectionId !== "all" &&
        getPaperSectionOptions(paper).some(
          (section: any) => section._id === selectedAcademicSectionId,
        )
        ? selectedAcademicSectionId
        : "all";
    },
    [getPaperSectionOptions, sectionFilterId, selectedAcademicSectionIds],
  );

  const getPaperSubjects = (paper: QuestionPaperDirectoryPaper) =>
    Array.isArray(paper.subjects)
      ? paper.subjects
      : paper.subject
        ? [paper.subject]
        : [];

  return (
    <div className="app-surface overflow-hidden">
      <div className="app-section-body border-b border-border/60 bg-muted/10">
        <ListPagination
          page={page}
          totalPages={pages}
          totalItems={totalPapers}
          pageSize={pageSize}
          itemLabel="papers"
          onPageChange={onPageChange}
        />
      </div>

      <div className="app-table-wrap rounded-none border-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allVisibleChecked}
                  onCheckedChange={(checked) =>
                    onToggleVisibleSelection(Boolean(checked))
                  }
                  aria-label="Select all visible papers"
                />
              </TableHead>
              <TableHead className="w-[15rem]">Paper</TableHead>
              <TableHead className="w-[14rem]">Scope</TableHead>
              <TableHead className="w-[120px]">Questions</TableHead>
              <TableHead className="w-[120px]">Marks</TableHead>
              <TableHead className="w-[140px]">Created</TableHead>
              <TableHead className="min-w-[28rem]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  No papers match the current search or scope.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((paper) => {
                const paperId = String(paper._id);
                const paperSectionOptions = getPaperSectionOptions(paper);
                const selectedAcademicSectionId =
                  getSelectedAcademicSectionId(paper);
                const uploadHref = `/workspace/analytics/student-tag-report/excel-upload?paperId=${paperId}${
                  selectedAcademicSectionId !== "all"
                    ? `&academicSectionId=${encodeURIComponent(selectedAcademicSectionId)}`
                    : ""
                }`;
                const responsesHref = `/workspace/question-papers/${paperId}/responses${
                  selectedAcademicSectionId !== "all"
                    ? `?academicSectionId=${encodeURIComponent(selectedAcademicSectionId)}`
                    : ""
                }`;
                const classAnalyticsHref = `/workspace/analytics/class-tag-report/${paperId}${
                  selectedAcademicSectionId !== "all"
                    ? `?academicSectionId=${encodeURIComponent(selectedAcademicSectionId)}`
                    : ""
                }`;
                const paperQuestionCount = getPaperQuestionCount(paper);
                const paperSubjects = getPaperSubjects(paper);
                const showGlobalSectionScope = sectionFilterId !== "all";

                return (
                  <TableRow key={paperId}>
                    <TableCell>
                      <Checkbox
                        checked={selectedPaperIdSet.has(paperId)}
                        onCheckedChange={(checked) =>
                          onTogglePaperSelection(paperId, Boolean(checked))
                        }
                        aria-label={`Select ${paper.title}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="min-w-[13rem] space-y-2">
                        <div className="font-medium leading-5">
                          {paper.title}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge
                            variant={
                              paper.onlineEnabled ? "secondary" : "outline"
                            }
                            className={
                              paper.onlineEnabled
                                ? "bg-primary/10 text-primary"
                                : ""
                            }
                          >
                            {paper.onlineEnabled ? "Online" : "Offline"}
                          </Badge>
                          {paperSubjects.slice(0, 3).map((subject: any) => (
                            <Badge
                              key={subject?._id || subject?.name}
                              variant="outline"
                            >
                              {subject?.name ||
                                subject?._id ||
                                "Unknown Subject"}
                            </Badge>
                          ))}
                          {paperSubjects.length > 3 ? (
                            <Badge variant="outline">
                              +{paperSubjects.length - 3} more
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-[12rem] space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline">
                            {getPaperClassName(paper)}
                          </Badge>
                          <Badge variant="outline">
                            {paperSectionOptions.length} section
                            {paperSectionOptions.length === 1 ? "" : "s"}
                          </Badge>
                        </div>
                        {paperSectionOptions.length > 0 ? (
                          showGlobalSectionScope ? (
                            <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-foreground">
                              {selectedSectionLabel}
                            </div>
                          ) : paperSectionOptions.length === 1 ? (
                            <div className="rounded-xl border border-border/60 bg-background px-3 py-2 text-sm font-medium text-foreground">
                              {paperSectionOptions[0].name}
                            </div>
                          ) : (
                            <Select
                              value={selectedAcademicSectionId}
                              onValueChange={(value) =>
                                onAcademicSectionSelectionChange(paperId, value)
                              }
                            >
                              <SelectTrigger className="app-control-compact w-full">
                                <SelectValue placeholder="All class sections" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">
                                  All class sections
                                </SelectItem>
                                {paperSectionOptions.map((section: any) => (
                                  <SelectItem
                                    key={section._id}
                                    value={section._id}
                                  >
                                    {section.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )
                        ) : (
                          <div className="rounded-xl border border-dashed border-border/60 px-3 py-2 text-sm text-muted-foreground">
                            No sections
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {paperQuestionCount}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {paperQuestionCount === 1 ? "question" : "questions"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {paper.totalMarks}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          marks
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {paper.createdAt
                        ? new Date(paper.createdAt).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {mountRowActions ? (
                        <QuestionPaperDirectoryRowActions
                          paperId={paperId}
                          selectedAcademicSectionId={selectedAcademicSectionId}
                          responsesHref={responsesHref}
                          uploadHref={uploadHref}
                          classAnalyticsHref={classAnalyticsHref}
                          buildReturnHref={buildReturnHref}
                          isSendingReports={sendingReportsPaperId === paperId}
                          isExcelLoading={excelLoadingId === paperId}
                          isDeleting={deletingId === paperId}
                          onSendReports={() => onSendReports(paperId)}
                          onDownloadExcel={() => onDownloadExcel(paperId)}
                          onArchive={() => onArchive(paperId)}
                        />
                      ) : (
                        <QuestionPaperRowActionsFallback />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
