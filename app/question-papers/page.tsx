"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { downloadDefaultClassAnalyticsExcel } from "@/components/analytics/helpers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import PageLoadingState from "@/components/ui/page-loading-state";
import { MessageCircle } from "lucide-react";
import { useReturnHrefBuilder } from "@/hooks/useReturnNavigation";
import { buildPartialLoadMessage, fetchApiJson } from "@/lib/client/api";
import { getSchoolKeyFromCookie } from "@/lib/client/school";

const NO_SCHOOL_PAPERS_MESSAGE = "Select a school workspace to load question papers.";

function getPaperQuestionCount(paper: any) {
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
  const { buildReturnHref } = useReturnHrefBuilder("/question-papers");
  const [papers, setPapers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [academicSections, setAcademicSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [schoolKey, setSchoolKey] = useState("");
  const [supportDataNotice, setSupportDataNotice] = useState<string | null>(null);

  useEffect(() => {
    const loadPageData = async () => {
      const cookieSchoolKey = getSchoolKeyFromCookie();
      setSchoolKey(cookieSchoolKey);
      setLoading(true);
      setError(null);
      setSupportDataNotice(null);

      if (!cookieSchoolKey) {
        setLoading(false);
        setError(NO_SCHOOL_PAPERS_MESSAGE);
        return;
      }

      const [paperResult, sectionResult, classResult] = await Promise.allSettled([
        fetchApiJson<any>("/api/question-papers", {
          cache: "no-store",
          schoolKey: cookieSchoolKey,
          fallbackMessage: "Failed to fetch question papers.",
        }),
        fetchApiJson<any>("/api/sections", {
          cache: "no-store",
          schoolKey: cookieSchoolKey,
          fallbackMessage: "Failed to fetch sections.",
        }),
        fetchApiJson<any>("/api/classes", {
          cache: "no-store",
          schoolKey: cookieSchoolKey,
          fallbackMessage: "Failed to fetch classes.",
        }),
      ]);

      if (paperResult.status === "fulfilled") {
        setPapers(Array.isArray(paperResult.value.papers) ? paperResult.value.papers : []);
      } else {
        setError(paperResult.reason?.message || "Failed to fetch question papers.");
      }

      if (sectionResult.status === "fulfilled") {
        setAcademicSections(Array.isArray(sectionResult.value.sections) ? sectionResult.value.sections : []);
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
          'Filters and row actions may be limited until you refresh.',
        ),
      );

      setLoading(false);
    };

    void loadPageData();
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
    setDeletingId(id);
    try {
      await fetchApiJson(`/api/question-papers/${id}`, {
        method: "DELETE",
        schoolKey,
        fallbackMessage: "Failed to archive question paper.",
      });
      setPapers((currentPapers) => currentPapers.filter((p) => p._id !== id));
    } catch (deleteError: any) {
      alert(deleteError?.message || "Failed to archive question paper");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadExcel = async (paperId: string) => {
    setExcelLoadingId(paperId);
    const paper = papers.find((p) => p._id === paperId);
    if (!paper) {
      alert("Could not find paper details.");
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
        } else {
          alert("Failed to generate Excel file.");
        }
      } catch (error: any) {
        alert(error?.message || "Failed to generate Excel file.");
      }
    }
    setExcelLoadingId(null);
  };

  const handleDownloadAllZip = async () => {
    if (selectedPaperIds.length === 0) {
      alert("Please select at least one question paper to download.");
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

    setZipLoading(true);
    const zip = new JSZip();
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
          console.warn(`Failed to generate Excel for paper: ${safeTitle}`);
        }
      } catch (error: any) {
        console.warn(
          `Failed to generate Excel for paper: ${safeTitle}`,
          error?.message || error,
        );
      }
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = finalZipName;
    a.click();
    URL.revokeObjectURL(url);
    setZipLoading(false);
  };

  const handleSendExamReports = async (paperId: string) => {
    try {
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
          fallbackMessage: "Failed to queue exam reports.",
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
      alert(
        `Queued ${data.queued} report(s)${selectedAcademicSectionName ? ` for ${selectedAcademicSectionName}` : ""}.\n${summaryLines.join("\n")}`,
      );
    } catch {
      alert("Failed to queue exam reports");
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
  }, [academicSections, classFilterId, getSectionClassName, paperClassIds]);

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

  const allFilteredChecked =
    filteredPapers.length > 0 &&
    filteredPapers.every((paper) => selectedPaperIds.includes(paper._id));
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

  const resetFilters = () => {
    setClassFilterId("all");
    setSectionFilterId("all");
    setSearch("");
  };

  if (loading) {
    return (
      <PageLoadingState
        title="Loading question papers"
        description="Preparing papers, class filters, section filters, and report actions."
      />
    );
  }
  if (error) {
    return (
      <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
        <div
          className={
            error === NO_SCHOOL_PAPERS_MESSAGE
              ? "app-feedback app-feedback-info"
              : "app-feedback app-feedback-error"
          }
        >
          {error}
        </div>
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
        title="Question Papers"
        description="Browse, filter, and act on papers by class and section from one standardized assessment workspace."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/question-papers/create">
              <Button>Create</Button>
            </Link>
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">
              {classFilterId === "all"
                ? "All classes"
                : classOptions.find((item) => item._id === classFilterId)?.name ||
                  "Selected class"}
            </span>
            <span className="app-meta-chip">
              {sectionFilterId === "all"
                ? "All sections"
                : sectionFilterOptions.find((item) => item._id === sectionFilterId)?.label ||
                  "Selected section"}
            </span>
          </>
        }
        stats={[
          {
            label: "Total papers",
            value: String(papers.length),
            meta: "All question papers available for the current school.",
          },
          {
            label: "Filtered papers",
            value: String(filteredPapers.length),
            meta: "Current result set after class, section, and search filters.",
          },
          {
            label: "Online ready",
            value: String(onlineEnabledCount),
            meta: "Papers currently marked for student online delivery.",
          },
          {
            label: "Selected for ZIP",
            value: String(selectedPaperIds.length),
            meta: "Papers queued for batch Excel export.",
          },
        ]}
      />

      {supportDataNotice ? <div className="app-feedback app-feedback-info">{supportDataNotice}</div> : null}

      <div className="app-spotlight-grid">
        <div className="app-spotlight-card app-spotlight-card-strong">
          <p className="app-spotlight-label">Assessment operations</p>
          <h2 className="app-spotlight-title">
            Filter once, then move cleanly into analytics, responses, and delivery
          </h2>
          <p className="app-spotlight-copy">
            Use class and section scope to keep downloads, report sends, and
            analytics tied to the exact paper group you mean to operate on.
          </p>
          <div className="app-inline-stat-grid">
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Questions in library</p>
              <p className="app-inline-stat-value">{totalQuestionCount}</p>
              <p className="app-inline-stat-copy">
                Objective and offline papers still live in the same library.
              </p>
            </div>
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Questions in view</p>
              <p className="app-inline-stat-value">{filteredQuestionCount}</p>
              <p className="app-inline-stat-copy">
                This updates as you narrow by class, section, or title search.
              </p>
            </div>
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Excel tag depth</p>
              <p className="app-inline-stat-value">{numTags}</p>
              <p className="app-inline-stat-copy">
                Current tag count used for analytics spreadsheet generation.
              </p>
            </div>
          </div>
        </div>

        <div className="app-surface app-surface-body">
          <p className="app-spotlight-label">Working rhythm</p>
          <h2 className="text-lg font-semibold text-foreground">
            Keep paper review and downstream actions predictable
          </h2>
          <div className="app-flow-list">
            <div className="app-flow-item">
              <div className="app-flow-index">1</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">Pick the academic scope</p>
                <p className="app-flow-note">
                  Use the filters first so section-level downloads and report sends stay precise.
                </p>
              </div>
            </div>
            <div className="app-flow-item">
              <div className="app-flow-index">2</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">Open the next workflow from the same row</p>
                <p className="app-flow-note">
                  Jump straight to view, responses, analytics, Excel upload, or report delivery.
                </p>
              </div>
            </div>
            <div className="app-flow-item">
              <div className="app-flow-index">3</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">Use batch export only after final selection</p>
                <p className="app-flow-note">
                  ZIP export follows the paper checkboxes and respects your current section targeting.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Filters & Actions</CardTitle>
              <CardDescription>
                Narrow the paper list, then export, upload, review, or queue report delivery from the same workspace.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{filteredPapers.length} visible</Badge>
              <Badge variant="outline">{selectedPaperIds.length} selected</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="app-section-body space-y-3">
          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_7.5rem] xl:items-end">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Class
                </p>
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
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Section
                </p>
                <Select value={sectionFilterId} onValueChange={setSectionFilterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Class Sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Class Sections</SelectItem>
                    {sectionFilterOptions.map((section) => (
                      <SelectItem key={section._id} value={section._id}>
                        {section.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Search
                </p>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title..."
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Excel tags
                </p>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={numTags}
                  onChange={(e) => setNumTags(Number(e.target.value || 1))}
                  className="w-full sm:w-24"
                />
              </div>
            </div>

            <div className="app-section space-y-3 2xl:self-start">
              <div>
                <p className="app-spotlight-label">Current scope</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="app-meta-chip">
                    {classFilterId === "all"
                      ? "All classes"
                      : classOptions.find((item) => item._id === classFilterId)?.name ||
                        "Selected class"}
                  </span>
                  <span className="app-meta-chip">
                    {sectionFilterId === "all"
                      ? "All sections"
                      : sectionFilterOptions.find((item) => item._id === sectionFilterId)
                          ?.label || "Selected section"}
                  </span>
                  <span className="app-meta-chip">
                    {search.trim() ? `Search: ${search.trim()}` : "No title search"}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleDownloadAllZip}
                  disabled={zipLoading || selectedPaperIds.length === 0}
                >
                  {zipLoading
                    ? "Zipping..."
                    : `Download Selected (${selectedPaperIds.length})`}
                </Button>
                {hasActiveFilters ? (
                  <Button variant="outline" onClick={resetFilters}>
                    Clear filters
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {sectionFilterId !== "all"
                  ? "Selected section also applies to row actions and Excel output."
                  : "Pick a section when you want row actions and exports to target a narrower academic scope."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Paper Library</CardTitle>
              <CardDescription>
                Open the right downstream workflow for each paper without leaving the assessment list.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{papers.length} total</Badge>
              <Badge variant="outline">{filteredPapers.length} in view</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="app-table-wrap rounded-none border-x-0 border-b-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allFilteredChecked}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPaperIds((prev) =>
                            Array.from(
                              new Set([
                                ...prev,
                                ...filteredPapers.map((p) => p._id),
                              ]),
                            ),
                          );
                        } else {
                          const filteredIds = new Set(
                            filteredPapers.map((p) => p._id),
                          );
                          setSelectedPaperIds((prev) =>
                            prev.filter((id) => !filteredIds.has(id)),
                          );
                        }
                      }}
                      aria-label="Select all filtered papers"
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Total Marks</TableHead>
                  <TableHead>Questions Count</TableHead>
                  <TableHead className="w-[280px]">Class Sections</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[520px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPapers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No question papers match the selected class, section, or search filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPapers.map((paper) => {
                    const paperSectionOptions = getPaperSectionOptions(paper);
                    const selectedAcademicSectionId =
                      getSelectedAcademicSectionId(paper);
                    const selectedAcademicSectionName =
                      getSelectedAcademicSectionName(paper);
                    const uploadHref = `/analytics/student-tag-report/excel-upload?paperId=${paper._id}${
                      selectedAcademicSectionId !== "all"
                        ? `&academicSectionId=${encodeURIComponent(selectedAcademicSectionId)}`
                        : ""
                    }`;
                    const responsesHref = `/question-papers/${paper._id}/responses${
                      selectedAcademicSectionId !== "all"
                        ? `?academicSectionId=${encodeURIComponent(selectedAcademicSectionId)}`
                        : ""
                    }`;
                    const classAnalyticsHref = `/analytics/class-tag-report/${paper._id}${
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
                            onCheckedChange={(checked) => {
                              setSelectedPaperIds((ids) =>
                                checked
                                  ? [...ids, paper._id]
                                  : ids.filter((id) => id !== paper._id),
                              );
                            }}
                            aria-label={`Select ${paper.title}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="font-medium">{paper.title}</div>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge
                                variant={paper.onlineEnabled ? "secondary" : "outline"}
                                className={paper.onlineEnabled ? "bg-primary/10 text-primary" : ""}
                              >
                                {paper.onlineEnabled ? "Online enabled" : "Offline/manual"}
                              </Badge>
                              <Badge variant="outline">
                                {paperSectionOptions.length} section
                                {paperSectionOptions.length === 1 ? "" : "s"}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getPaperClassName(paper)}</TableCell>
                        <TableCell>{paper.totalMarks}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm font-medium">{paperQuestionCount}</div>
                            <div className="text-xs text-muted-foreground">
                              {paperQuestionCount === 1 ? "question" : "questions"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            {paperSectionOptions.length > 0 ? (
                              <>
                                <div className="text-xs text-muted-foreground">
                                  {paperSectionOptions.length} class sections
                                </div>
                                <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                                  {paperSectionOptions.map((section: any) => {
                                    const isActiveSection =
                                      selectedAcademicSectionId !== "all" &&
                                      selectedAcademicSectionId === section._id;

                                    return (
                                      <div
                                        key={section._id}
                                        className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
                                          isActiveSection
                                            ? "border-primary/50 bg-primary/5"
                                            : "border-border/60 bg-background"
                                        }`}
                                      >
                                        <span className="truncate font-medium">
                                          {section.name}
                                        </span>
                                        {isActiveSection ? (
                                          <Badge variant="default" className="shrink-0">
                                            {showGlobalSectionScope ? "Filtered" : "Selected"}
                                          </Badge>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            ) : (
                              <div className="rounded-md border border-dashed border-border/60 px-3 py-2 text-sm text-muted-foreground">
                                No class sections yet
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {paper.createdAt
                            ? new Date(paper.createdAt).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-3">
                            {paperSectionOptions.length > 0 ? (
                              showGlobalSectionScope ? null : (
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                  <div className="min-w-[220px]">
                                    <Select
                                      value={selectedAcademicSectionId}
                                      onValueChange={(value) =>
                                        setSelectedAcademicSectionIds((current) => ({
                                          ...current,
                                          [paper._id]: value,
                                        }))
                                      }
                                    >
                                      <SelectTrigger className="h-8 w-full">
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
                                  </div>
                                </div>
                              )
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                No sections for this class yet.
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <Link href={buildReturnHref(`/question-papers/view/${paper._id}`)}>
                                <Button variant="outline" size="sm">
                                  View
                                </Button>
                              </Link>
                              <Link href={buildReturnHref(`/question-papers/edit/${paper._id}`)}>
                                <Button variant="outline" size="sm">
                                  Edit
                                </Button>
                              </Link>
                              <Link href={buildReturnHref(responsesHref)}>
                                <Button variant="outline" size="sm">
                                  Responses
                                </Button>
                              </Link>
                              <Link href={buildReturnHref(uploadHref)}>
                                <Button variant="outline" size="sm">
                                  Upload Excel
                                </Button>
                              </Link>
                              <Link href={buildReturnHref(classAnalyticsHref)} prefetch={false}>
                                <Button size="sm">Class Analytics</Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSendExamReports(paper._id)}
                                disabled={sendingReportsPaperId === paper._id}
                                className="text-green-700 border-green-300"
                              >
                                <MessageCircle className="h-4 w-4 mr-1" />
                                {sendingReportsPaperId === paper._id
                                  ? "Sending…"
                                  : "Send Reports"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
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
        </CardContent>
      </Card>
    </div>
  );
}
