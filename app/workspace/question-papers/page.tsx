"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { downloadDefaultClassAnalyticsExcel } from "@/components/analytics/helpers";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageHero from "@/components/layout/PageHero";
import FeedbackNotice from "@/components/ui/feedback-notice";
import ListPagination from "@/components/ui/list-pagination";
import PageLoadingState from "@/components/ui/page-loading-state";
import { MessageCircle } from "lucide-react";
import { useReturnHrefBuilder } from "@/hooks/useReturnNavigation";
import { buildPartialLoadMessage, fetchApiJson } from "@/lib/client/api";
import { getSchoolKeyFromCookie } from "@/lib/client/school";

const NO_SCHOOL_PAPERS_MESSAGE = "Select a school to load question papers.";
const PAPERS_INITIAL_PAGE_SIZE = 20;
const PAPERS_PAGE_SIZE = PAPERS_INITIAL_PAGE_SIZE;
const PAPERS_BACKGROUND_BATCH_SIZE = 3;

function mergePapersById(current: any[], next: any[]) {
  if (next.length === 0) {
    return current;
  }

  const merged = new Map<string, any>();
  current.forEach((paper) => {
    merged.set(String(paper?._id || ""), paper);
  });
  next.forEach((paper) => {
    merged.set(String(paper?._id || ""), paper);
  });
  return Array.from(merged.values());
}

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException
      ? error.name === "AbortError"
      : typeof error === "object" &&
          error !== null &&
          "name" in error &&
          (error as { name?: string }).name === "AbortError"
  );
}

function getPaperQuestionCount(paper: any) {
  if (typeof paper?.questionCount === "number" && Number.isFinite(paper.questionCount)) {
    return Math.max(0, Number(paper.questionCount));
  }
  return Array.isArray(paper?.sections)
    ? paper.sections.reduce(
        (total: number, section: any) =>
          total +
          (Array.isArray(section?.questions) ? section.questions.length : 0),
        0,
      )
    : 0;
}

function getPaperClassId(paper: any) {
  return String(paper?.class?._id || paper?.class || "");
}

function getSectionClassId(section: any) {
  return String(section?.class?._id || section?.class || "");
}

export default function QuestionPapersListPage() {
  const { buildReturnHref } = useReturnHrefBuilder("/workspace/question-papers");
  const [papers, setPapers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [academicSections, setAcademicSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [numTags, setNumTags] = useState<number>(5);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [selectedAcademicSectionIds, setSelectedAcademicSectionIds] = useState<
    Record<string, string>
  >({});
  const [classFilterId, setClassFilterId] = useState<string>("all");
  const [sectionFilterId, setSectionFilterId] = useState<string>("all");
  const [zipLoading, setZipLoading] = useState(false);
  const [excelLoadingId, setExcelLoadingId] = useState<string | null>(null);
  const [sendingReportsPaperId, setSendingReportsPaperId] = useState<
    string | null
  >(null);
  const [search, setSearch] = useState("");
  const [paperPage, setPaperPage] = useState(1);
  const [schoolKey, setSchoolKey] = useState("");
  const [supportDataNotice, setSupportDataNotice] = useState<string | null>(null);
  const [backgroundLoadNotice, setBackgroundLoadNotice] = useState<string | null>(null);
  const [totalPaperCount, setTotalPaperCount] = useState(0);
  const [pageNotice, setPageNotice] = useState<{
    variant: "success" | "error" | "info" | "warning";
    message: string;
  } | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let active = true;

    const loadPageData = async () => {
      const cookieSchoolKey = getSchoolKeyFromCookie();
      setSchoolKey(cookieSchoolKey);
      setLoading(true);
      setBackgroundLoading(false);
      setError(null);
      setSupportDataNotice(null);
      setBackgroundLoadNotice(null);
      setPageNotice(null);

      if (!cookieSchoolKey) {
        setLoading(false);
        setError(NO_SCHOOL_PAPERS_MESSAGE);
        return;
      }

      void Promise.allSettled([
        fetchApiJson<any>("/api/sections", {
          cache: "no-store",
          schoolKey: cookieSchoolKey,
          fallbackMessage: "We couldn't load section filters.",
          signal: abortController.signal,
        }),
        fetchApiJson<any>("/api/classes", {
          cache: "no-store",
          schoolKey: cookieSchoolKey,
          fallbackMessage: "We couldn't load class filters.",
          signal: abortController.signal,
        }),
      ]).then(([sectionResult, classResult]) => {
        if (!active || abortController.signal.aborted) {
          return;
        }

        if (sectionResult.status === "fulfilled") {
          setAcademicSections(
            Array.isArray(sectionResult.value.sections) ? sectionResult.value.sections : [],
          );
        } else {
          setAcademicSections([]);
        }

        if (classResult.status === "fulfilled") {
          setClasses(Array.isArray(classResult.value.classes) ? classResult.value.classes : []);
        } else {
          setClasses([]);
        }

        setSupportDataNotice(
          buildPartialLoadMessage(
            [
              ...(sectionResult.status === "rejected" ? ["Section filters"] : []),
              ...(classResult.status === "rejected" ? ["Class filters"] : []),
            ],
            "Filters and row actions may be limited until you refresh.",
          ),
        );
      });

      try {
        const initialPaperData = await fetchApiJson<any>(
          `/api/question-papers?page=1&limit=${PAPERS_INITIAL_PAGE_SIZE}&summary=1`,
          {
            cache: "no-store",
            schoolKey: cookieSchoolKey,
            fallbackMessage: "We couldn't load question papers.",
            signal: abortController.signal,
          },
        );

        if (!active || abortController.signal.aborted) {
          return;
        }

        const initialPapers = Array.isArray(initialPaperData.papers)
          ? initialPaperData.papers
          : [];
        const totalPages = Math.max(1, Number(initialPaperData.pages) || 1);
        const nextTotalPaperCount = Math.max(
          initialPapers.length,
          Number(initialPaperData.total) || initialPapers.length,
        );

        startTransition(() => {
          setPapers(initialPapers);
        });
        setTotalPaperCount(nextTotalPaperCount);
        setLoading(false);

        if (totalPages <= 1) {
          return;
        }

        setBackgroundLoading(true);

        void (async () => {
          try {
            for (let page = 2; page <= totalPages; page += PAPERS_BACKGROUND_BATCH_SIZE) {
              const batchPages = Array.from(
                { length: Math.min(PAPERS_BACKGROUND_BATCH_SIZE, totalPages - page + 1) },
                (_, index) => page + index,
              );

              const batchResults = await Promise.all(
                batchPages.map(async (pageNumber) => {
                  const pageData = await fetchApiJson<any>(
                    `/api/question-papers?page=${pageNumber}&limit=${PAPERS_INITIAL_PAGE_SIZE}&summary=1`,
                    {
                      cache: "no-store",
                      schoolKey: cookieSchoolKey,
                      fallbackMessage: "We couldn't load question papers.",
                      signal: abortController.signal,
                    },
                  );
                  return Array.isArray(pageData.papers) ? pageData.papers : [];
                }),
              );

              if (!active || abortController.signal.aborted) {
                return;
              }

              const nextPapers = batchResults.flat();
              if (nextPapers.length > 0) {
                startTransition(() => {
                  setPapers((currentPapers) => mergePapersById(currentPapers, nextPapers));
                });
              }
            }
          } catch (backgroundError) {
            if (!isAbortError(backgroundError) && active) {
              setBackgroundLoadNotice(
                "Some papers are still loading in the background. Refresh to retry.",
              );
            }
          } finally {
            if (active && !abortController.signal.aborted) {
              setBackgroundLoading(false);
            }
          }
        })();
      } catch (paperError: any) {
        if (isAbortError(paperError)) {
          return;
        }
        setPapers([]);
        setTotalPaperCount(0);
        setLoading(false);
        setError(paperError?.message || "We couldn't load question papers.");
      }
    };

    void loadPageData();

    return () => {
      active = false;
      abortController.abort();
    };
  }, []);

  const getClassNameById = useCallback(
    (classId: string) => {
      if (!classId) return "";
      return (
        classes.find(
          (classItem: any) => String(classItem?._id || "") === String(classId),
        )?.name || ""
      );
    },
    [classes],
  );

  const getPaperClassName = useCallback(
    (paper: any) => {
      if (typeof paper?.class === "object" && paper?.class?.name) {
        return String(paper.class.name);
      }
      const paperClassId = getPaperClassId(paper);
      return getClassNameById(paperClassId) || (paperClassId ? "Unknown class" : "-");
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

  const getPaperSectionOptions = useCallback((paper: any) => {
    const paperClassId = getPaperClassId(paper);
    const paperClassName = getPaperClassName(paper);
    const assignedSections = Array.isArray(paper?.assignedAcademicSections)
      ? paper.assignedAcademicSections
          .map((section: any) => ({
            _id: String(section?._id || section || ""),
            name: String(section?.name || ""),
            classId: getSectionClassId(section) || paperClassId,
            className: getSectionClassName(section, paperClassId) || paperClassName,
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
      .filter((section: any) => getSectionClassId(section) === paperClassId)
      .map((section: any) => ({
        _id: String(section?._id || ""),
        name: String(section?.name || ""),
        classId: paperClassId,
        className: getSectionClassName(section, paperClassId) || paperClassName,
      }))
      .filter((section: any) => section._id);
  }, [academicSections, getPaperClassName, getSectionClassName]);

  const getSelectedAcademicSectionId = useCallback((paper: any) => {
    if (
      sectionFilterId !== "all" &&
      getPaperSectionOptions(paper).some(
        (section: any) => section._id === sectionFilterId,
      )
    ) {
      return sectionFilterId;
    }

    const selectedAcademicSectionId =
      selectedAcademicSectionIds[paper._id] || "all";
    return selectedAcademicSectionId !== "all" &&
      getPaperSectionOptions(paper).some(
        (section: any) => section._id === selectedAcademicSectionId,
      )
      ? selectedAcademicSectionId
      : "all";
  }, [getPaperSectionOptions, sectionFilterId, selectedAcademicSectionIds]);

  const getSelectedAcademicSectionName = useCallback((paper: any) => {
    const selectedAcademicSectionId = getSelectedAcademicSectionId(paper);
    if (selectedAcademicSectionId === "all") {
      return "";
    }
    return (
      getPaperSectionOptions(paper).find(
        (section: any) => section._id === selectedAcademicSectionId,
      )?.name || ""
    );
  }, [getPaperSectionOptions, getSelectedAcademicSectionId]);

  const handleArchive = async (id: string) => {
    if (!window.confirm("Are you sure you want to archive this question paper?"))
      return;
    setPageNotice(null);
    setDeletingId(id);
    try {
      await fetchApiJson(`/api/question-papers/${id}`, {
        method: "DELETE",
        schoolKey,
        fallbackMessage: "We couldn't archive this question paper.",
      });
      setPapers((currentPapers) => currentPapers.filter((p) => p._id !== id));
      setTotalPaperCount((currentTotal) => Math.max(0, currentTotal - 1));
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
  };

  const handleDownloadExcel = async (paperId: string) => {
    setPageNotice(null);
    setExcelLoadingId(paperId);
    const paper = papers.find((p) => p._id === paperId);
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
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
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
  };

  const handleDownloadAllZip = async () => {
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

    if (!finalZipName) return;

    if (!finalZipName.toLowerCase().endsWith(".zip")) {
      finalZipName += ".zip";
    }

    setPageNotice(null);
    setZipLoading(true);

    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const failedDownloads: string[] = [];

      for (const paperId of selectedPaperIds) {
        const paper = papers.find((p) => p._id === paperId);
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
            console.warn(`Failed to generate Excel for paper: ${safeTitle}`);
          }
        } catch (error: any) {
          failedDownloads.push(safeTitle);
          console.warn(
            `Failed to generate Excel for paper: ${safeTitle}`,
            error?.message || error,
          );
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
      const a = document.createElement("a");
      a.href = url;
      a.download = finalZipName;
      a.click();
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
  };

  const handleSendExamReports = async (paperId: string) => {
    try {
      setPageNotice(null);
      setSendingReportsPaperId(paperId);
      const paper = papers.find((item) => item._id === paperId);
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
          selectedAcademicSectionName ? ` for ${selectedAcademicSectionName}` : ""
        }. ${summaryLines.join(" • ")}`,
      });
    } catch (error: any) {
      setPageNotice({
        variant: "error",
        message:
          error?.message || "We couldn't queue the exam reports. Please try again.",
      });
    } finally {
      setSendingReportsPaperId(null);
    }
  };

  const paperClassIds = useMemo(
    () => new Set(papers.map((paper) => getPaperClassId(paper)).filter(Boolean)),
    [papers],
  );

  const classOptions = useMemo(() => {
    const optionMap = new Map<string, { _id: string; name: string }>();

    papers.forEach((paper) => {
      const classId = getPaperClassId(paper);
      const className = getPaperClassName(paper);
      if (classId && className && className !== "-") {
        optionMap.set(classId, { _id: classId, name: className });
      }
    });

    classes.forEach((classItem: any) => {
      const classId = String(classItem?._id || "");
      const className = String(classItem?.name || "");
      if (classId && className && paperClassIds.has(classId)) {
        optionMap.set(classId, { _id: classId, name: className });
      }
    });

    return Array.from(optionMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [classes, getPaperClassName, paperClassIds, papers]);

  const sectionFilterOptions = useMemo(() => {
    const optionMap = new Map<
      string,
      {
        _id: string;
        name: string;
        classId: string;
        className: string;
        label: string;
      }
    >();

    papers.forEach((paper) => {
      const paperClassId = getPaperClassId(paper);
      const paperClassName = getPaperClassName(paper) || "Unknown class";

      (Array.isArray(paper?.assignedAcademicSections)
        ? paper.assignedAcademicSections
        : []
      ).forEach((section: any) => {
        const sectionId = String(section?._id || section || "");
        const sectionName = String(section?.name || "");
        const sectionClassId = getSectionClassId(section) || paperClassId;
        const sectionClassName =
          getSectionClassName(section, paperClassId) || paperClassName;

        if (!sectionId || !sectionName || !sectionClassId) {
          return;
        }
        if (classFilterId !== "all" && sectionClassId !== classFilterId) {
          return;
        }

        optionMap.set(sectionId, {
          _id: sectionId,
          name: sectionName,
          classId: sectionClassId,
          className: sectionClassName,
          label:
            classFilterId === "all"
              ? `${sectionClassName} • ${sectionName}`
              : sectionName,
        });
      });
    });

    academicSections.forEach((section: any) => {
      const sectionId = String(section?._id || "");
      const sectionName = String(section?.name || "");
      const sectionClassId = getSectionClassId(section);
      const sectionClassName =
        getSectionClassName(section, sectionClassId) || "Unknown class";

      if (!sectionId || !sectionName || !sectionClassId) {
        return;
      }
      if (!paperClassIds.has(sectionClassId)) {
        return;
      }
      if (classFilterId !== "all" && sectionClassId !== classFilterId) {
        return;
      }

      optionMap.set(sectionId, {
        _id: sectionId,
        name: sectionName,
        classId: sectionClassId,
        className: sectionClassName,
        label:
          classFilterId === "all"
            ? `${sectionClassName} • ${sectionName}`
            : sectionName,
      });
    });

    return Array.from(optionMap.values()).sort(
      (a, b) =>
        a.className.localeCompare(b.className) || a.name.localeCompare(b.name),
    );
  }, [
    academicSections,
    classFilterId,
    getPaperClassName,
    getSectionClassName,
    paperClassIds,
    papers,
  ]);

  useEffect(() => {
    if (
      sectionFilterId !== "all" &&
      !sectionFilterOptions.some((section) => section._id === sectionFilterId)
    ) {
      setSectionFilterId("all");
    }
  }, [sectionFilterId, sectionFilterOptions]);

  const filteredPapers = useMemo(() => {
    let list =
      classFilterId === "all"
        ? papers
        : papers.filter((paper) => getPaperClassId(paper) === classFilterId);

    if (sectionFilterId !== "all") {
      list = list.filter((paper) =>
        getPaperSectionOptions(paper).some(
          (section: any) => section._id === sectionFilterId,
        ),
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((paper) => (paper.title || "").toLowerCase().includes(q));
    }

    return list;
  }, [classFilterId, getPaperSectionOptions, papers, search, sectionFilterId]);

  const filteredPaperPages = useMemo(
    () => Math.max(1, Math.ceil(filteredPapers.length / PAPERS_PAGE_SIZE)),
    [filteredPapers.length],
  );
  const visiblePapers = useMemo(() => {
    const startIndex = (paperPage - 1) * PAPERS_PAGE_SIZE;
    return filteredPapers.slice(startIndex, startIndex + PAPERS_PAGE_SIZE);
  }, [filteredPapers, paperPage]);

  useEffect(() => {
    setPaperPage(1);
  }, [classFilterId, sectionFilterId, search]);

  useEffect(() => {
    setPaperPage((currentPage) => Math.min(currentPage, filteredPaperPages));
  }, [filteredPaperPages]);

  const allVisibleChecked =
    visiblePapers.length > 0 &&
    visiblePapers.every((paper) => selectedPaperIds.includes(paper._id));
  const hasActiveFilters =
    classFilterId !== "all" || sectionFilterId !== "all" || search.trim().length > 0;
  const totalQuestionCount = useMemo(
    () => papers.reduce((total, paper) => total + getPaperQuestionCount(paper), 0),
    [papers],
  );
  const filteredQuestionCount = useMemo(
    () =>
      filteredPapers.reduce(
        (total, paper) => total + getPaperQuestionCount(paper),
        0,
      ),
    [filteredPapers],
  );
  const onlineEnabledCount = useMemo(
    () => papers.filter((paper) => paper?.onlineEnabled).length,
    [papers],
  );
  const filteredOnlineEnabledCount = useMemo(
    () => filteredPapers.filter((paper) => paper?.onlineEnabled).length,
    [filteredPapers],
  );
  const selectedPaperCount = selectedPaperIds.length;
  const selectedClassLabel =
    classFilterId === "all"
      ? ""
      : classOptions.find((item) => item._id === classFilterId)?.name ||
        "Selected class";
  const selectedSectionLabel =
    sectionFilterId === "all"
      ? ""
      : sectionFilterOptions.find((item) => item._id === sectionFilterId)?.label ||
        "Selected section";

  const resetFilters = () => {
    setClassFilterId("all");
    setSectionFilterId("all");
    setSearch("");
  };

  const clearSelection = () => {
    setSelectedPaperIds([]);
  };

  const handleToggleVisibleSelection = (checked: boolean) => {
    if (checked) {
      setSelectedPaperIds((previousIds) =>
        Array.from(new Set([...previousIds, ...visiblePapers.map((paper) => paper._id)])),
      );
      return;
    }

    const visiblePaperIds = new Set(visiblePapers.map((paper) => paper._id));
    setSelectedPaperIds((previousIds) =>
      previousIds.filter((paperId) => !visiblePaperIds.has(paperId)),
    );
  };

  const handleTogglePaperSelection = (paperId: string, checked: boolean) => {
    setSelectedPaperIds((previousIds) =>
      checked
        ? Array.from(new Set([...previousIds, paperId]))
        : previousIds.filter((selectedPaperId) => selectedPaperId !== paperId),
    );
  };

  if (loading) {
    return (
      <PageLoadingState
        title="Loading question papers"
        description="Loading papers."
      />
    );
  }
  if (error) {
    return (
      <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
        <FeedbackNotice
          variant={error === NO_SCHOOL_PAPERS_MESSAGE ? "info" : "error"}
        >
          {error}
        </FeedbackNotice>
      </div>
    );
  }
  if (!papers.length) {
    return (
      <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
        <div className="app-empty-state">No question papers found.</div>
      </div>
    );
  }

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="Assessments"
        title="Papers"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AppPrefetchLink
              href="/workspace/question-papers/create"
              prefetchOnMount
              relatedApiPrefetches={[
                '/api/classes',
                '/api/sections',
                '/api/subjects',
                '/api/tags/with-subjects',
              ]}
            >
              <Button>Create Paper</Button>
            </AppPrefetchLink>
          </div>
        }
      />

      {pageNotice ? (
        <FeedbackNotice variant={pageNotice.variant}>
          {pageNotice.message}
        </FeedbackNotice>
      ) : null}
      {supportDataNotice ? (
        <FeedbackNotice variant="warning">{supportDataNotice}</FeedbackNotice>
      ) : null}
      {backgroundLoadNotice ? (
        <FeedbackNotice variant="warning">{backgroundLoadNotice}</FeedbackNotice>
      ) : null}

      <div className="app-toolbar space-y-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_180px_180px_7.5rem] xl:items-end">
          <div className="space-y-2">
            <p className="app-field-label">Search</p>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by paper title"
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <p className="app-field-label">Class</p>
            <Select value={classFilterId} onValueChange={setClassFilterId}>
              <SelectTrigger>
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classOptions.map((classItem) => (
                  <SelectItem key={classItem._id} value={classItem._id}>
                    {classItem.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="app-field-label">Section</p>
            <Select value={sectionFilterId} onValueChange={setSectionFilterId}>
              <SelectTrigger>
                <SelectValue placeholder="All Sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {sectionFilterOptions.map((section) => (
                  <SelectItem key={section._id} value={section._id}>
                    {section.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="app-field-label">Excel Tags</p>
            <Input
              type="number"
              min={1}
              max={10}
              value={numTags}
              onChange={(e) => setNumTags(Number(e.target.value || 1))}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="app-meta-chip">
              {backgroundLoading && !hasActiveFilters && totalPaperCount > filteredPapers.length
                ? `${filteredPapers.length}/${totalPaperCount}`
                : filteredPapers.length}{" "}
              paper{filteredPapers.length === 1 ? "" : "s"}
            </span>
            <span className="app-meta-chip">
              {(hasActiveFilters ? filteredQuestionCount : totalQuestionCount)} question
              {(hasActiveFilters ? filteredQuestionCount : totalQuestionCount) === 1 ? "" : "s"}
            </span>
            <span className="app-meta-chip">
              {(hasActiveFilters ? filteredOnlineEnabledCount : onlineEnabledCount)} online
            </span>
            {backgroundLoading ? (
              <span className="app-meta-chip">Loading more...</span>
            ) : null}
            {selectedClassLabel ? <span className="app-meta-chip">{selectedClassLabel}</span> : null}
            {selectedSectionLabel ? <span className="app-meta-chip">{selectedSectionLabel}</span> : null}
          </div>
          {hasActiveFilters ? (
            <Button variant="outline" onClick={resetFilters}>
              Clear Filters
            </Button>
          ) : null}
        </div>
      </div>

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
                {zipLoading ? "Zipping..." : `Download Selected (${selectedPaperCount})`}
              </Button>
              <Button variant="outline" onClick={clearSelection}>
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Card className="app-surface overflow-hidden">
        {filteredPapers.length > PAPERS_PAGE_SIZE ? (
          <div className="app-section-body border-b border-border/60 bg-muted/10">
            <ListPagination
              page={paperPage}
              totalPages={filteredPaperPages}
              totalItems={filteredPapers.length}
              pageSize={PAPERS_PAGE_SIZE}
              itemLabel="papers"
              onPageChange={setPaperPage}
            />
          </div>
        ) : null}
        <div className="app-table-wrap rounded-none border-0">
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allVisibleChecked}
                      onCheckedChange={(checked) =>
                        handleToggleVisibleSelection(Boolean(checked))
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
                {filteredPapers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No papers match the current search or scope.
                    </TableCell>
                  </TableRow>
                ) : (
                  visiblePapers.map((paper) => {
                    const paperSectionOptions = getPaperSectionOptions(paper);
                    const selectedAcademicSectionId =
                      getSelectedAcademicSectionId(paper);
                    const uploadHref = `/workspace/analytics/student-tag-report/excel-upload?paperId=${paper._id}${
                      selectedAcademicSectionId !== "all"
                        ? `&academicSectionId=${encodeURIComponent(selectedAcademicSectionId)}`
                        : ""
                    }`;
                    const responsesHref = `/workspace/question-papers/${paper._id}/responses${
                      selectedAcademicSectionId !== "all"
                        ? `?academicSectionId=${encodeURIComponent(selectedAcademicSectionId)}`
                        : ""
                    }`;
                    const classAnalyticsHref = `/workspace/analytics/class-tag-report/${paper._id}${
                      selectedAcademicSectionId !== "all"
                        ? `?academicSectionId=${encodeURIComponent(selectedAcademicSectionId)}`
                        : ""
                    }`;
                    const paperQuestionCount = getPaperQuestionCount(paper);
                    const showGlobalSectionScope = sectionFilterId !== "all";

                    return (
                      <TableRow key={paper._id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedPaperIds.includes(paper._id)}
                            onCheckedChange={(checked) =>
                              handleTogglePaperSelection(paper._id, Boolean(checked))
                            }
                            aria-label={`Select ${paper.title}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[13rem] space-y-2">
                            <div className="font-medium leading-5">{paper.title}</div>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge
                                variant={paper.onlineEnabled ? "secondary" : "outline"}
                                className={paper.onlineEnabled ? "bg-primary/10 text-primary" : ""}
                              >
                                {paper.onlineEnabled ? "Online" : "Offline"}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[12rem] space-y-2">
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="outline">{getPaperClassName(paper)}</Badge>
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
                                    setSelectedAcademicSectionIds((current) => ({
                                      ...current,
                                      [paper._id]: value,
                                    }))
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
                                      <SelectItem key={section._id} value={section._id}>
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
                            <div className="text-sm font-medium">{paperQuestionCount}</div>
                            <div className="text-xs text-muted-foreground">
                              {paperQuestionCount === 1 ? "question" : "questions"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{paper.totalMarks}</div>
                            <div className="text-xs text-muted-foreground">marks</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {paper.createdAt
                            ? new Date(paper.createdAt).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[26rem] space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <AppPrefetchLink
                                href={buildReturnHref(`/workspace/question-papers/view/${paper._id}`)}
                                relatedApiPrefetches={[`/api/question-papers/${paper._id}`]}
                              >
                                <Button variant="outline" size="sm" className="app-button-compact">
                                  Open
                                </Button>
                              </AppPrefetchLink>
                              <AppPrefetchLink
                                href={buildReturnHref(`/workspace/question-papers/edit/${paper._id}`)}
                                relatedApiPrefetches={[
                                  `/api/question-papers/${paper._id}`,
                                  '/api/classes',
                                  '/api/sections',
                                  '/api/subjects',
                                ]}
                              >
                                <Button variant="outline" size="sm" className="app-button-compact">
                                  Edit
                                </Button>
                              </AppPrefetchLink>
                              <AppPrefetchLink
                                href={buildReturnHref(responsesHref)}
                                relatedApiPrefetches={[
                                  `/api/question-paper-response?paper=${encodeURIComponent(
                                    paper._id,
                                  )}&summary=1&page=1&limit=40${
                                    selectedAcademicSectionId !== 'all'
                                      ? `&academicSectionId=${encodeURIComponent(selectedAcademicSectionId)}`
                                      : ''
                                  }`,
                                ]}
                              >
                                <Button variant="outline" size="sm" className="app-button-compact">
                                  Responses
                                </Button>
                              </AppPrefetchLink>
                              <AppPrefetchLink href={buildReturnHref(uploadHref)}>
                                <Button variant="outline" size="sm" className="app-button-compact">
                                  Upload Excel
                                </Button>
                              </AppPrefetchLink>
                              <AppPrefetchLink
                                href={buildReturnHref(classAnalyticsHref)}
                                relatedApiPrefetches={[
                                  `/api/analytics/class-tag-report/${paper._id}?groupFields=1${
                                    selectedAcademicSectionId !== 'all'
                                      ? `&academicSectionId=${encodeURIComponent(selectedAcademicSectionId)}`
                                      : ''
                                  }`,
                                ]}
                              >
                                <Button size="sm" className="app-button-compact">Analytics</Button>
                              </AppPrefetchLink>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="app-button-compact app-button-compact-success"
                                onClick={() => handleSendExamReports(paper._id)}
                                disabled={sendingReportsPaperId === paper._id}
                              >
                                <MessageCircle className="h-4 w-4 mr-1" />
                                {sendingReportsPaperId === paper._id
                                  ? "Sending…"
                                  : "Send Reports"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="app-button-compact"
                                onClick={() => handleDownloadExcel(paper._id)}
                                disabled={excelLoadingId === paper._id}
                              >
                                {excelLoadingId === paper._id
                                  ? "Downloading…"
                                  : "Download Excel"}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="app-button-compact"
                                onClick={() => handleArchive(paper._id)}
                                disabled={deletingId === paper._id}
                              >
                                {deletingId === paper._id ? "Archiving…" : "Archive"}
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
      </Card>
    </div>
  );
}
