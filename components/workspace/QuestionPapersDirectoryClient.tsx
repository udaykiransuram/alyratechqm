"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import type { SearchableCommandOption } from "@/components/ui/searchable-command-select";
import { fetchApiJson } from "@/lib/client/api";
import { announceNavigationStart } from "@/lib/client/navigation-feedback";

import QuestionPapersDirectoryFilters from "@/components/workspace/question-papers/QuestionPapersDirectoryFilters";
import QuestionPapersDirectoryTable from "@/components/workspace/question-papers/QuestionPapersDirectoryTable";
import {
  getPaperClassId,
  getSectionClassId,
  normalizeFilterValue,
  type QuestionPaperDirectoryAcademicSectionItem,
  type QuestionPaperDirectoryClassItem,
  type QuestionPaperDirectoryPaper,
} from "@/components/workspace/question-papers/question-paper-directory-shared";

type QuestionPapersDirectoryClientProps = {
  papers: QuestionPaperDirectoryPaper[];
  classes: QuestionPaperDirectoryClassItem[];
  academicSections: QuestionPaperDirectoryAcademicSectionItem[];
  schoolKey: string;
  totalPapers: number;
  page: number;
  pages: number;
  pageSize: number;
  initialClassFilterId: string;
  initialSectionFilterId: string;
  initialSearch: string;
  basePath: string;
};

export default function QuestionPapersDirectoryClient({
  papers,
  classes,
  academicSections,
  schoolKey,
  totalPapers,
  page,
  pages,
  pageSize,
  initialClassFilterId,
  initialSectionFilterId,
  initialSearch,
  basePath,
}: QuestionPapersDirectoryClientProps) {
  const router = useRouter();
  const pathname = basePath;

  const [rows, setRows] = useState<QuestionPaperDirectoryPaper[]>(papers);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [numTags, setNumTags] = useState<number>(5);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [selectedAcademicSectionIds, setSelectedAcademicSectionIds] = useState<
    Record<string, string>
  >({});
  const [classFilterId, setClassFilterId] = useState<string>(
    initialClassFilterId || "all",
  );
  const [sectionFilterId, setSectionFilterId] = useState<string>(
    initialSectionFilterId || "all",
  );
  const [searchInput, setSearchInput] = useState(initialSearch || "");
  const [zipLoading, setZipLoading] = useState(false);
  const [excelLoadingId, setExcelLoadingId] = useState<string | null>(null);
  const [sendingReportsPaperId, setSendingReportsPaperId] = useState<
    string | null
  >(null);
  const [pageNotice, setPageNotice] = useState<{
    variant: "success" | "error" | "info" | "warning";
    message: string;
  } | null>(null);

  useEffect(() => {
    setRows(papers);
    setSelectedPaperIds([]);
    setClassFilterId(initialClassFilterId || "all");
    setSectionFilterId(initialSectionFilterId || "all");
    setSearchInput(initialSearch || "");
  }, [initialClassFilterId, initialSearch, initialSectionFilterId, papers]);

  const classFilterOptions = useMemo<SearchableCommandOption[]>(
    () => [
      {
        value: "all",
        label: "All classes",
        description: "Browse papers across every class.",
      },
      ...classes.map((classItem) => ({
        value: classItem._id,
        label: classItem.name,
      })),
    ],
    [classes],
  );

  const sectionFilterOptions = useMemo(() => {
    return academicSections
      .filter((section) => {
        const sectionClassId = String(section.class?._id || "");
        return classFilterId === "all" || sectionClassId === classFilterId;
      })
      .map((section) => {
        const className = String(section.class?.name || "Unknown class");
        const label =
          classFilterId === "all"
            ? `${className} • ${section.name}`
            : section.name;
        return {
          _id: section._id,
          label,
        };
      });
  }, [academicSections, classFilterId]);

  const searchableSectionFilterOptions = useMemo<SearchableCommandOption[]>(
    () => [
      {
        value: "all",
        label: "All sections",
        description: "Keep the paper list scoped to every section.",
      },
      ...sectionFilterOptions.map((section) => ({
        value: section._id,
        label: section.label,
      })),
    ],
    [sectionFilterOptions],
  );

  useEffect(() => {
    if (
      sectionFilterId !== "all" &&
      !sectionFilterOptions.some((section) => section._id === sectionFilterId)
    ) {
      setSectionFilterId("all");
    }
  }, [sectionFilterId, sectionFilterOptions]);

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

  const getSelectedAcademicSectionName = useCallback(
    (paper: QuestionPaperDirectoryPaper) => {
      const selectedAcademicSectionId = getSelectedAcademicSectionId(paper);
      if (selectedAcademicSectionId === "all") {
        return "";
      }

      return (
        getPaperSectionOptions(paper).find(
          (section: any) => section._id === selectedAcademicSectionId,
        )?.name || ""
      );
    },
    [getPaperSectionOptions, getSelectedAcademicSectionId],
  );

  const selectedSectionLabel =
    sectionFilterId === "all"
      ? ""
      : sectionFilterOptions.find((item) => item._id === sectionFilterId)
          ?.label || "Selected section";

  const hasActiveFilters =
    classFilterId !== "all" ||
    sectionFilterId !== "all" ||
    searchInput.trim().length > 0;

  const selectedPaperIdSet = useMemo(
    () => new Set(selectedPaperIds),
    [selectedPaperIds],
  );

  const allVisibleChecked =
    rows.length > 0 &&
    rows.every((paper) => selectedPaperIdSet.has(String(paper._id)));

  const selectedPaperCount = selectedPaperIds.length;

  const buildListHref = useCallback(
    (nextPage: number, overrides?: Partial<Record<string, string>>) => {
      const params = new URLSearchParams();
      const nextClass = overrides?.class ?? classFilterId;
      const nextSection = overrides?.section ?? sectionFilterId;
      const nextSearch = overrides?.search ?? searchInput;

      if (normalizeFilterValue(nextClass)) {
        params.set("class", nextClass);
      }
      if (normalizeFilterValue(nextSection)) {
        params.set("academicSectionId", nextSection);
      }
      if (String(nextSearch || "").trim()) {
        params.set("search", String(nextSearch || "").trim());
      }
      if (nextPage > 1) {
        params.set("page", String(nextPage));
      }

      const query = params.toString();
      return `${pathname}${query ? `?${query}` : ""}`;
    },
    [classFilterId, pathname, searchInput, sectionFilterId],
  );

  const navigateToHref = useCallback(
    (href: string, options?: { preserveScroll?: boolean }) => {
      announceNavigationStart(href);
      router.push(href, { scroll: !options?.preserveScroll });
    },
    [router],
  );

  const applyFilters = useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault();
      navigateToHref(buildListHref(1));
    },
    [buildListHref, navigateToHref],
  );

  const handleClassFilterChange = useCallback(
    (nextClassId: string) => {
      const normalizedClassId = nextClassId || "all";
      const nextSectionId =
        sectionFilterId !== "all" &&
        !academicSections.some((section) => {
          const classId = String(section.class?._id || "");
          return (
            section._id === sectionFilterId && classId === normalizedClassId
          );
        })
          ? "all"
          : sectionFilterId;

      setClassFilterId(normalizedClassId);
      setSectionFilterId(nextSectionId);
      navigateToHref(
        buildListHref(1, {
          class: normalizedClassId,
          section: nextSectionId,
        }),
      );
    },
    [academicSections, buildListHref, navigateToHref, sectionFilterId],
  );

  const handleSectionFilterChange = useCallback(
    (nextSectionId: string) => {
      const normalizedSectionId = nextSectionId || "all";
      setSectionFilterId(normalizedSectionId);
      navigateToHref(
        buildListHref(1, {
          section: normalizedSectionId,
        }),
      );
    },
    [buildListHref, navigateToHref],
  );

  const resetFilters = useCallback(() => {
    setClassFilterId("all");
    setSectionFilterId("all");
    setSearchInput("");
    navigateToHref(pathname);
  }, [navigateToHref, pathname]);

  const clearSelection = useCallback(() => {
    setSelectedPaperIds([]);
  }, []);

  const handleToggleVisibleSelection = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedPaperIds((previousIds) =>
          Array.from(
            new Set([
              ...previousIds,
              ...rows.map((paper) => String(paper._id)),
            ]),
          ),
        );
        return;
      }

      const visiblePaperIds = new Set(rows.map((paper) => String(paper._id)));
      setSelectedPaperIds((previousIds) =>
        previousIds.filter((paperId) => !visiblePaperIds.has(paperId)),
      );
    },
    [rows],
  );

  const handleTogglePaperSelection = useCallback(
    (paperId: string, checked: boolean) => {
      setSelectedPaperIds((previousIds) =>
        checked
          ? Array.from(new Set([...previousIds, paperId]))
          : previousIds.filter(
              (selectedPaperId) => selectedPaperId !== paperId,
            ),
      );
    },
    [],
  );

  const handleArchive = useCallback(
    async (id: string) => {
      if (
        !window.confirm(
          "Are you sure you want to archive this question paper?",
        )
      ) {
        return;
      }

      setPageNotice(null);
      setDeletingId(id);

      try {
        await fetchApiJson(`/api/question-papers/${id}`, {
          method: "DELETE",
          schoolKey,
          fallbackMessage: "We couldn't archive this question paper.",
        });
        setRows((currentRows) => currentRows.filter((paper) => paper._id !== id));
        setSelectedPaperIds((currentIds) =>
          currentIds.filter((paperId) => paperId !== id),
        );
        setPageNotice({
          variant: "success",
          message: "Question paper archived.",
        });
      } catch (deleteError: any) {
        setPageNotice({
          variant: "error",
          message:
            deleteError?.message ||
            "We couldn't archive that question paper. Please try again.",
        });
      } finally {
        setDeletingId(null);
      }
    },
    [schoolKey],
  );

  const loadDefaultClassAnalyticsDownloader = useCallback(async () => {
    const analyticsHelpers = await import("@/components/analytics/helpers");
    return analyticsHelpers.downloadDefaultClassAnalyticsExcel;
  }, []);

  const handleDownloadExcel = useCallback(
    async (paperId: string) => {
      setPageNotice(null);
      setExcelLoadingId(paperId);
      const paper = rows.find((item) => String(item._id) === paperId);

      if (!paper) {
        setPageNotice({
          variant: "error",
          message: "We couldn't find that paper's details.",
        });
        setExcelLoadingId(null);
        return;
      }

      const selectedAcademicSectionId = getSelectedAcademicSectionId(paper);
      const selectedAcademicSectionName = getSelectedAcademicSectionName(paper);
      const safeTitle =
        paper.title?.replace(/[^a-zA-Z0-9_\-]/g, "_") || `paper_${paperId}`;
      const safeSectionName = selectedAcademicSectionName.replace(
        /[^a-zA-Z0-9_\-]/g,
        "_",
      );
      const suggestedFilename = `${safeTitle}${safeSectionName ? `_${safeSectionName}` : ""}.xlsx`;
      const fileName = window.prompt(
        "Enter file name for the Excel download:",
        suggestedFilename,
      );

      if (fileName) {
        try {
          const downloadDefaultClassAnalyticsExcel =
            await loadDefaultClassAnalyticsDownloader();
          const excelBlob = await downloadDefaultClassAnalyticsExcel(
            paperId,
            numTags,
            true,
            {
              academicSectionId:
                selectedAcademicSectionId !== "all"
                  ? selectedAcademicSectionId
                  : undefined,
            },
          );

          if (excelBlob) {
            const url = URL.createObjectURL(excelBlob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
            setPageNotice({
              variant: "success",
              message: `Excel download started for "${paper.title || "the selected paper"}".`,
            });
          } else {
            setPageNotice({
              variant: "error",
              message: "We couldn't generate the Excel file. Please try again.",
            });
          }
        } catch (error: any) {
          setPageNotice({
            variant: "error",
            message:
              error?.message ||
              "We couldn't generate the Excel file. Please try again.",
          });
        }
      }

      setExcelLoadingId(null);
    },
    [
      getSelectedAcademicSectionId,
      getSelectedAcademicSectionName,
      loadDefaultClassAnalyticsDownloader,
      numTags,
      rows,
    ],
  );

  const handleDownloadAllZip = useCallback(async () => {
    if (selectedPaperIds.length === 0) {
      setPageNotice({
        variant: "error",
        message: "Select at least one question paper before downloading a ZIP.",
      });
      return;
    }

    const suggestedName = "question_papers_excel.zip";
    let finalZipName = window.prompt(
      "Enter the name for the ZIP file:",
      suggestedName,
    );
    if (!finalZipName) {
      return;
    }

    if (!finalZipName.toLowerCase().endsWith(".zip")) {
      finalZipName += ".zip";
    }

    setPageNotice(null);
    setZipLoading(true);

    try {
      const downloadDefaultClassAnalyticsExcel =
        await loadDefaultClassAnalyticsDownloader();
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const failedDownloads: string[] = [];

      for (const paperId of selectedPaperIds) {
        const paper = rows.find((item) => String(item._id) === paperId);
        const selectedAcademicSectionId = paper
          ? getSelectedAcademicSectionId(paper)
          : "all";
        const selectedAcademicSectionName = paper
          ? getSelectedAcademicSectionName(paper)
          : "";
        const safeTitle =
          paper?.title?.replace(/[^a-zA-Z0-9_\-]/g, "_") || `paper_${paperId}`;
        const safeSectionName = selectedAcademicSectionName.replace(
          /[^a-zA-Z0-9_\-]/g,
          "_",
        );

        try {
          const excelBlob = await downloadDefaultClassAnalyticsExcel(
            paperId,
            numTags,
            true,
            {
              academicSectionId:
                selectedAcademicSectionId !== "all"
                  ? selectedAcademicSectionId
                  : undefined,
            },
          );

          if (excelBlob) {
            zip.file(
              `${safeTitle}${safeSectionName ? `_${safeSectionName}` : ""}.xlsx`,
              excelBlob,
            );
          } else {
            failedDownloads.push(safeTitle);
          }
        } catch {
          failedDownloads.push(safeTitle);
        }
      }

      if (Object.keys(zip.files).length === 0) {
        setPageNotice({
          variant: "error",
          message:
            "We couldn't generate any Excel files for the selected papers.",
        });
        return;
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = finalZipName;
      anchor.click();
      URL.revokeObjectURL(url);

      setPageNotice(
        failedDownloads.length > 0
          ? {
              variant: "warning",
              message: `ZIP download started, but ${failedDownloads.length} paper${
                failedDownloads.length === 1 ? "" : "s"
              } could not be generated. Retry those individually if needed.`,
            }
          : {
              variant: "success",
              message: `ZIP download started for ${selectedPaperIds.length} question paper${
                selectedPaperIds.length === 1 ? "" : "s"
              }.`,
            },
      );
    } catch (error: any) {
      setPageNotice({
        variant: "error",
        message:
          error?.message || "We couldn't prepare the ZIP download right now.",
      });
    } finally {
      setZipLoading(false);
    }
  }, [
    getSelectedAcademicSectionId,
    getSelectedAcademicSectionName,
    loadDefaultClassAnalyticsDownloader,
    numTags,
    rows,
    selectedPaperIds,
  ]);

  const handleSendExamReports = useCallback(
    async (paperId: string) => {
      try {
        setPageNotice(null);
        setSendingReportsPaperId(paperId);
        const paper = rows.find((item) => String(item._id) === paperId);
        const selectedAcademicSectionId = paper
          ? getSelectedAcademicSectionId(paper)
          : "all";
        const selectedAcademicSectionName = paper
          ? getSelectedAcademicSectionName(paper)
          : "";
        const searchParams = new URLSearchParams();

        if (schoolKey) {
          searchParams.set("school", schoolKey);
        }
        if (selectedAcademicSectionId !== "all") {
          searchParams.set("academicSectionId", selectedAcademicSectionId);
        }

        const queryString = searchParams.toString();
        const data = await fetchApiJson<any>(
          `/api/reports/send/exam/${paperId}${queryString ? `?${queryString}` : ""}`,
          {
            method: "POST",
            schoolKey,
            includeSchoolQuery: false,
            fallbackMessage: "We couldn't queue exam reports.",
          },
        );

        const summaryLines = [
          `Students: ${data.studentQueued || 0} queued`,
          `Teachers: ${data.teacherQueued || 0} queued`,
          `Admins: ${data.adminQueued || 0} queued`,
        ];
        if (data.alreadyQueued) {
          summaryLines.push(`Already queued: ${data.alreadyQueued}`);
        }
        if (data.failedCount) {
          summaryLines.push(`Failed: ${data.failedCount}`);
        }

        setPageNotice({
          variant: "success",
          message: `Queued ${data.queued} report(s)${
            selectedAcademicSectionName
              ? ` for ${selectedAcademicSectionName}`
              : ""
          }. ${summaryLines.join(" • ")}`,
        });
      } catch (error: any) {
        setPageNotice({
          variant: "error",
          message:
            error?.message ||
            "We couldn't queue the exam reports. Please try again.",
        });
      } finally {
        setSendingReportsPaperId(null);
      }
    },
    [getSelectedAcademicSectionId, getSelectedAcademicSectionName, rows, schoolKey],
  );

  return (
    <div className="space-y-4">
      {pageNotice ? (
        <FeedbackNotice variant={pageNotice.variant}>
          {pageNotice.message}
        </FeedbackNotice>
      ) : null}

      <QuestionPapersDirectoryFilters
        classFilterId={classFilterId}
        sectionFilterId={sectionFilterId}
        searchInput={searchInput}
        numTags={numTags}
        totalPapers={totalPapers}
        hasActiveFilters={hasActiveFilters}
        classFilterOptions={classFilterOptions}
        sectionFilterOptions={searchableSectionFilterOptions}
        onSearchInputChange={setSearchInput}
        onClassFilterChange={handleClassFilterChange}
        onSectionFilterChange={handleSectionFilterChange}
        onNumTagsChange={setNumTags}
        onApplyFilters={applyFilters}
        onResetFilters={resetFilters}
      />

      {selectedPaperCount > 0 ? (
        <div className="app-toolbar">
          <div className="app-toolbar-row">
            <div className="flex flex-wrap items-center gap-2">
              <span className="app-meta-chip">
                {selectedPaperCount} selected
              </span>
              {selectedSectionLabel ? (
                <span className="app-meta-chip">{selectedSectionLabel}</span>
              ) : null}
            </div>
            <div className="app-toolbar-actions">
              <Button onClick={handleDownloadAllZip} disabled={zipLoading}>
                {zipLoading
                  ? "Zipping..."
                  : `Download Selected (${selectedPaperCount})`}
              </Button>
              <Button variant="outline" onClick={clearSelection}>
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <QuestionPapersDirectoryTable
        rows={rows}
        classes={classes}
        academicSections={academicSections}
        basePath={basePath}
        totalPapers={totalPapers}
        page={page}
        pages={pages}
        pageSize={pageSize}
        sectionFilterId={sectionFilterId}
        selectedSectionLabel={selectedSectionLabel}
        selectedPaperIdSet={selectedPaperIdSet}
        allVisibleChecked={allVisibleChecked}
        selectedAcademicSectionIds={selectedAcademicSectionIds}
        deletingId={deletingId}
        sendingReportsPaperId={sendingReportsPaperId}
        excelLoadingId={excelLoadingId}
        onPageChange={(nextPage, options) =>
          navigateToHref(buildListHref(nextPage), {
            preserveScroll: Boolean(options?.preserveScroll),
          })
        }
        onToggleVisibleSelection={handleToggleVisibleSelection}
        onTogglePaperSelection={handleTogglePaperSelection}
        onAcademicSectionSelectionChange={(paperId, nextSectionId) =>
          setSelectedAcademicSectionIds((current) => ({
            ...current,
            [paperId]: nextSectionId,
          }))
        }
        onSendReports={handleSendExamReports}
        onDownloadExcel={handleDownloadExcel}
        onArchive={handleArchive}
      />
    </div>
  );
}
