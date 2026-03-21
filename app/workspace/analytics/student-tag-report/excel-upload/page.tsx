"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import pLimit from "p-limit";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import PageLoadingState from "@/components/ui/page-loading-state";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { withSchool, withSchoolHeaders } from "@/lib/client/school";

type AssignedSection = {
  _id: string;
  name: string;
};

type QuestionDefinition = {
  header: string;
  questionId: string;
  questionNumber: number;
  type: string;
  optionCount: number;
};

type UploadMode = "skip_existing" | "overwrite_existing";

type UploadResult = {
  row: number;
  candidateId?: string;
  candidateName?: string;
  status: "created" | "updated" | "skipped" | "failed";
  message: string;
  responseId?: string | null;
  source: "validation" | "server";
  studentCreated?: boolean;
};

type UploadHistoryItem = {
  _id: string;
  createdAt?: string;
  fileName?: string;
  uploadMode?: UploadMode;
  status?: "completed" | "partial" | "failed";
  totalRows?: number;
  successCount?: number;
  failureCount?: number;
  skippedCount?: number;
  createdCount?: number;
  updatedCount?: number;
  validationIssueCount?: number;
  duplicateRowCount?: number;
  academicSection?: { name?: string } | null;
  initiatedByName?: string;
  initiatedByRole?: string;
};

type PreparedUploadRow = {
  rowNumber: number;
  candidateId: string;
  candidateName: string;
  issues: string[];
  payload?: Record<string, any>;
};

type WorkbookValidation = {
  rowCount: number;
  validRows: PreparedUploadRow[];
  invalidRows: PreparedUploadRow[];
  missingHeaders: string[];
  unknownQuestionHeaders: string[];
  mappedQuestionHeaders: string[];
  duplicateRowCount: number;
  globalIssues: string[];
};

const limit = pLimit(10);

const UploadCloudIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <path d="M12 12v9" />
    <path d="m16 16-4-4-4 4" />
  </svg>
);

const FileIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

function normalizeHeaderCell(value: any) {
  return String(value || "").trim().toUpperCase();
}

function isBlankCell(value: any) {
  return value === null || value === undefined || String(value).trim() === "";
}

function isQuestionHeader(value: string) {
  return /^Q\d+$/i.test(String(value || "").trim());
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
}

function formatUploadMode(mode?: UploadMode) {
  return mode === "overwrite_existing" ? "Overwrite existing" : "Skip existing";
}

function getStatusTone(status: UploadResult["status"] | UploadHistoryItem["status"]) {
  if (status === "created" || status === "updated" || status === "completed") {
    return "analytics-badge analytics-badge-success";
  }
  if (status === "skipped") {
    return "analytics-badge analytics-badge-warning";
  }
  return "analytics-badge analytics-badge-danger";
}

async function readJsonSafe(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      success: false,
      message: text?.startsWith("<!DOCTYPE")
        ? "Server returned an HTML error page instead of JSON."
        : "Invalid JSON response from server.",
    };
  }
}

function parseChoiceToken(token: string) {
  const normalized = String(token || "").trim().toUpperCase();
  if (!normalized) return null;
  if (/^[A-Z]$/.test(normalized)) {
    return normalized.charCodeAt(0) - 65;
  }
  if (/^-?\d+$/.test(normalized)) {
    return Number(normalized);
  }
  return Number.NaN;
}

function parseCellAnswer(rawValue: any, definition: QuestionDefinition) {
  if (isBlankCell(rawValue)) {
    return { ok: true, empty: true } as const;
  }

  if (definition.type === "descriptive") {
    return {
      ok: true,
      empty: false,
      answer: {
        question: definition.questionId,
        answerText: String(rawValue).trim(),
      },
    } as const;
  }

  if (definition.type === "matrix-match") {
    return {
      ok: false,
      message: `${definition.header} uses matrix-match and is not supported in Excel upload yet.`,
    } as const;
  }

  const tokens =
    typeof rawValue === "string"
      ? rawValue
          .split(/[;,/|]+/)
          .map((token) => token.trim())
          .filter(Boolean)
      : [String(rawValue).trim()];

  const selectedOptions: number[] = [];
  for (const token of tokens) {
    const parsed = parseChoiceToken(token);
    if (parsed === null) continue;
    if (Number.isNaN(parsed)) {
      return {
        ok: false,
        message: `${definition.header} has an invalid option value: ${token}`,
      } as const;
    }
    selectedOptions.push(parsed);
  }

  if (selectedOptions.length === 0) {
    return { ok: true, empty: true } as const;
  }

  if (definition.type === "single" && selectedOptions.length > 1) {
    return {
      ok: false,
      message: `${definition.header} accepts only one option.`,
    } as const;
  }

  const invalidOption = selectedOptions.find(
    (optionIndex) => optionIndex < 0 || optionIndex >= definition.optionCount,
  );
  if (invalidOption !== undefined) {
    return {
      ok: false,
      message: `${definition.header} option index ${invalidOption} is outside the paper question range.`,
    } as const;
  }

  return {
    ok: true,
    empty: false,
    answer: {
      question: definition.questionId,
      selectedOptions: Array.from(new Set(selectedOptions)),
    },
  } as const;
}

function buildWorkbookValidation({
  excelRows,
  questionDefinitions,
  paperId,
  paperClassId,
  selectedAcademicSectionId,
  sectionName,
  uploadMode,
}: {
  excelRows: any[];
  questionDefinitions: Record<string, QuestionDefinition>;
  paperId: string | null;
  paperClassId: string;
  selectedAcademicSectionId: string;
  sectionName: string;
  uploadMode: UploadMode;
}): WorkbookValidation {
  const rows = Array.isArray(excelRows) ? excelRows : [];
  const header = Array.isArray(rows[0]) ? rows[0].map(normalizeHeaderCell) : [];
  const dataRows = rows.slice(1).filter((row) => Array.isArray(row) && row.some((cell) => !isBlankCell(cell)));
  const rowCount = dataRows.length;

  const requiredHeaders = ["CANDIDATE ID", "CANDIDATE NAME"];
  const missingHeaders = requiredHeaders.filter((requiredHeader) => !header.includes(requiredHeader));
  const questionHeaders = header.filter((column) => isQuestionHeader(column));
  const mappedQuestionHeaders = questionHeaders.filter((column) => Boolean(questionDefinitions[column]));
  const unknownQuestionHeaders = questionHeaders.filter((column) => !questionDefinitions[column]);

  const globalIssues: string[] = [];
  if (rows.length > 0 && !paperId) globalIssues.push("Question paper is missing from the URL.");
  if (rows.length > 0 && !paperClassId) globalIssues.push("Paper class is not loaded yet.");
  if (rows.length > 0 && !sectionName) globalIssues.push("Paper section mapping is not loaded yet.");
  if (header.length > 0 && mappedQuestionHeaders.length === 0) {
    globalIssues.push("No mapped question columns were found in the workbook.");
  }
  if (header.length > 0 && missingHeaders.length > 0) {
    globalIssues.push(`Missing required workbook columns: ${missingHeaders.join(", ")}.`);
  }

  const headerIndexMap = new Map<string, number>();
  header.forEach((column, index) => {
    if (!headerIndexMap.has(column)) {
      headerIndexMap.set(column, index);
    }
  });

  const candidateIdCounts = new Map<string, number>();
  dataRows.forEach((row) => {
    const candidateIdIndex = headerIndexMap.get("CANDIDATE ID");
    if (candidateIdIndex === undefined) return;
    const candidateId = String(row[candidateIdIndex] || "").trim();
    if (!candidateId) return;
    candidateIdCounts.set(candidateId, (candidateIdCounts.get(candidateId) || 0) + 1);
  });

  const preparedRows: PreparedUploadRow[] = dataRows.map((row, index) => {
    const rowNumber = index + 2;
    const issues: string[] = [];
    const candidateIdIndex = headerIndexMap.get("CANDIDATE ID");
    const candidateNameIndex = headerIndexMap.get("CANDIDATE NAME");
    const candidateId = candidateIdIndex === undefined ? "" : String(row[candidateIdIndex] || "").trim();
    const candidateName = candidateNameIndex === undefined ? "" : String(row[candidateNameIndex] || "").trim();

    if (!candidateId) {
      issues.push("Candidate ID is required.");
    }
    if (!candidateName) {
      issues.push("Candidate name is required.");
    }
    if (candidateId && (candidateIdCounts.get(candidateId) || 0) > 1) {
      issues.push("Candidate ID is duplicated in this workbook.");
    }

    const answers: any[] = [];
    mappedQuestionHeaders.forEach((questionHeader) => {
      const columnIndex = headerIndexMap.get(questionHeader);
      if (columnIndex === undefined) return;
      const cellValue = row[columnIndex];
      const questionDefinition = questionDefinitions[questionHeader];
      if (!questionDefinition) return;

      const parsedCell = parseCellAnswer(cellValue, questionDefinition);
      if (!parsedCell.ok) {
        issues.push(parsedCell.message);
        return;
      }
      if (parsedCell.empty || !parsedCell.answer) return;
      answers.push(parsedCell.answer);
    });

    unknownQuestionHeaders.forEach((questionHeader) => {
      const columnIndex = headerIndexMap.get(questionHeader);
      if (columnIndex === undefined) return;
      if (!isBlankCell(row[columnIndex])) {
        issues.push(`${questionHeader} is not mapped to this paper section.`);
      }
    });

    if (answers.length === 0) {
      issues.push("No valid answers found in this row.");
    }

    const payload =
      issues.length === 0
        ? {
            paper: paperId,
            uploadMode,
            student: {
              name: candidateName,
              rollNumber: candidateId,
              classId: paperClassId,
              academicSectionId: selectedAcademicSectionId || undefined,
              mobileNumber: candidateId,
            },
            sectionAnswers: [
              {
                sectionName,
                answers,
              },
            ],
            submittedAt: new Date().toISOString(),
          }
        : undefined;

    return {
      rowNumber,
      candidateId,
      candidateName,
      issues,
      payload,
    };
  });

  const validRows = preparedRows.filter((row) => row.issues.length === 0 && row.payload);
  const invalidRows = preparedRows.filter((row) => row.issues.length > 0 || !row.payload);
  const duplicateRowCount = preparedRows.filter((row) => row.issues.some((issue) => issue.includes("duplicated"))).length;

  return {
    rowCount,
    validRows,
    invalidRows,
    missingHeaders,
    unknownQuestionHeaders,
    mappedQuestionHeaders,
    duplicateRowCount,
    globalIssues,
  };
}

function ExcelStudentResponseUploadPageContent() {
  const { navigateBack } = useBackNavigation("/workspace/question-papers");
  const searchParams = useSearchParams();
  const paperId = searchParams.get("paperId");
  const preselectedAcademicSectionId = searchParams.get("academicSectionId") || "";

  const [excelRows, setExcelRows] = useState<any[]>([]);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [paperClassId, setPaperClassId] = useState("");
  const [paperClassName, setPaperClassName] = useState("");
  const [assignedAcademicSections, setAssignedAcademicSections] = useState<AssignedSection[]>([]);
  const [selectedAcademicSectionId, setSelectedAcademicSectionId] = useState("");
  const [questionDefinitions, setQuestionDefinitions] = useState<Record<string, QuestionDefinition>>({});
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadMode, setUploadMode] = useState<UploadMode>("skip_existing");
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [paperContextError, setPaperContextError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const workbookValidation = useMemo(
    () =>
      buildWorkbookValidation({
        excelRows,
        questionDefinitions,
        paperId,
        paperClassId,
        selectedAcademicSectionId,
        sectionName,
        uploadMode,
      }),
    [
      excelRows,
      paperId,
      paperClassId,
      questionDefinitions,
      sectionName,
      selectedAcademicSectionId,
      uploadMode,
    ],
  );

  const loadUploadHistory = useCallback(async () => {
    if (!paperId) {
      setUploadHistory([]);
      return;
    }

    try {
      setHistoryLoading(true);
      const params = new URLSearchParams({ paperId, limit: "8" });
      if (selectedAcademicSectionId) {
        params.set("academicSectionId", selectedAcademicSectionId);
      }
      const response = await fetch(
        withSchool(`/api/question-paper-response/upload-history?${params.toString()}`),
        { cache: "no-store" },
      );
      const data = await readJsonSafe(response);
      if (!data.success) {
        throw new Error(data.message || "Failed to load upload history.");
      }
      setUploadHistory(Array.isArray(data.histories) ? data.histories : []);
    } catch {
      setUploadHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [paperId, selectedAcademicSectionId]);

  useEffect(() => {
    async function fetchPaperContext() {
      if (!paperId) return;
      try {
        setPaperContextError(null);
        const response = await fetch(withSchool(`/api/question-papers/${paperId}`), {
          cache: "no-store",
        });
        const data = await readJsonSafe(response);
        if (!data.success || !data.paper) {
          throw new Error(data.message || "Failed to load paper context.");
        }

        const paper = data.paper;
        const nextPaperClassId = String(paper.class?._id || paper.class || "");
        setPaperClassId(nextPaperClassId);
        setPaperClassName(String(paper.class?.name || ""));

        const firstSection = Array.isArray(paper.sections) ? paper.sections[0] : null;
        if (firstSection) {
          setSectionName(String(firstSection.name || ""));
          const nextDefinitions: Record<string, QuestionDefinition> = {};
          (Array.isArray(firstSection.questions) ? firstSection.questions : []).forEach(
            (entry: any, index: number) => {
              const questionId = String(entry?.question?._id || entry?.question || "");
              if (!questionId) return;
              const header = `Q${index + 1}`;
              nextDefinitions[header] = {
                header,
                questionId,
                questionNumber: index + 1,
                type: String(entry?.question?.type || "single"),
                optionCount: Array.isArray(entry?.question?.options)
                  ? entry.question.options.length
                  : 0,
              };
            },
          );
          setQuestionDefinitions(nextDefinitions);
        } else {
          setSectionName("");
          setQuestionDefinitions({});
        }

        let nextAssignedSections = (paper.assignedAcademicSections || []).map(
          (section: any) => ({
            _id: String(section?._id || section),
            name: String(section?.name || ""),
          }),
        );

        if (nextAssignedSections.length === 0 && nextPaperClassId) {
          const sectionResponse = await fetch(
            withSchool(`/api/sections?classId=${encodeURIComponent(nextPaperClassId)}`),
            { cache: "no-store" },
          );
          const sectionData = await readJsonSafe(sectionResponse);
          if (sectionData.success) {
            nextAssignedSections = (sectionData.sections || []).map((section: any) => ({
              _id: String(section?._id || section),
              name: String(section?.name || ""),
            }));
          }
        }

        setAssignedAcademicSections(nextAssignedSections);
        setSelectedAcademicSectionId((current) => {
          if (
            preselectedAcademicSectionId &&
            nextAssignedSections.some(
              (section: AssignedSection) => section._id === preselectedAcademicSectionId,
            )
          ) {
            return preselectedAcademicSectionId;
          }
          if (
            current &&
            nextAssignedSections.some((section: AssignedSection) => section._id === current)
          ) {
            return current;
          }
          return nextAssignedSections[0]?._id || "";
        });
      } catch (error: any) {
        setPaperContextError(error?.message || "Failed to load paper context.");
        setQuestionDefinitions({});
      }
    }

    void fetchPaperContext();
  }, [paperId, preselectedAcademicSectionId]);

  useEffect(() => {
    void loadUploadHistory();
  }, [loadUploadHistory]);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults([]);
    setExcelRows([]);
    setProgress(0);

    const reader = new FileReader();
    reader.onload = (fileEvent) => {
      const workbook = XLSX.read(fileEvent.target?.result, { type: "binary" });
      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      setExcelRows(Array.isArray(rows) ? rows : []);
    };
    reader.readAsBinaryString(file);
  };

  const clearSelectedFile = () => {
    setFileName(null);
    setExcelRows([]);
    setResults([]);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const saveUploadHistory = useCallback(
    async (completedResults: UploadResult[], startedAt: string, completedAt: string) => {
      if (!paperId) return;

      const successCount = completedResults.filter((result) => result.status !== "failed").length;
      const failureCount = completedResults.filter((result) => result.status === "failed").length;
      const skippedCount = completedResults.filter((result) => result.status === "skipped").length;
      const createdCount = completedResults.filter((result) => result.status === "created").length;
      const updatedCount = completedResults.filter((result) => result.status === "updated").length;
      const validationIssueCount = completedResults.filter((result) => result.source === "validation").length;
      const duplicateRowCount = workbookValidation.duplicateRowCount;

      const summaryParts = [
        `${createdCount} created`,
        `${updatedCount} updated`,
        `${skippedCount} skipped`,
        `${failureCount} failed`,
      ];

      await fetch(
        withSchool("/api/question-paper-response/upload-history"),
        withSchoolHeaders({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paperId,
            academicSectionId: selectedAcademicSectionId || undefined,
            fileName,
            uploadMode,
            totalRows: workbookValidation.rowCount,
            successCount,
            failureCount,
            skippedCount,
            createdCount,
            updatedCount,
            validationIssueCount,
            duplicateRowCount,
            results: completedResults.map((result) => ({
              row: result.row,
              candidateId: result.candidateId,
              candidateName: result.candidateName,
              status: result.status,
              message: result.message,
              responseId: result.responseId,
            })),
            summary: summaryParts.join(" • "),
            startedAt,
            completedAt,
          }),
        }),
      );
    },
    [
      fileName,
      paperId,
      selectedAcademicSectionId,
      uploadMode,
      workbookValidation.duplicateRowCount,
      workbookValidation.rowCount,
    ],
  );

  const handleUpload = async () => {
    if (assignedAcademicSections.length > 0 && !selectedAcademicSectionId) {
      alert("Select a class section before uploading.");
      return;
    }

    if (workbookValidation.globalIssues.length > 0) {
      alert(workbookValidation.globalIssues[0]);
      return;
    }

    setLoading(true);
    setProgress(0);

    const startedAt = new Date().toISOString();
    const serverResults = await Promise.all(
      workbookValidation.validRows.map((preparedRow, index) =>
        limit(async () => {
          try {
            const response = await fetch(
              withSchool("/api/question-paper-response"),
              withSchoolHeaders({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(preparedRow.payload),
              }),
            );
            const data = await readJsonSafe(response);
            setProgress((current) => current + 100 / Math.max(workbookValidation.validRows.length, 1));
            return {
              row: preparedRow.rowNumber,
              candidateId: preparedRow.candidateId,
              candidateName: preparedRow.candidateName,
              status:
                data.success &&
                (data.responseAction === "created" ||
                  data.responseAction === "updated" ||
                  data.responseAction === "skipped")
                  ? data.responseAction
                  : data.success
                    ? "created"
                    : "failed",
              message: String(data.message || (data.success ? "Uploaded successfully." : "Upload failed.")),
              responseId: data.response?._id || null,
              source: "server" as const,
              studentCreated: Boolean(data.studentCreated),
            } satisfies UploadResult;
          } catch (error: any) {
            setProgress((current) => current + 100 / Math.max(workbookValidation.validRows.length, 1));
            return {
              row: preparedRow.rowNumber,
              candidateId: preparedRow.candidateId,
              candidateName: preparedRow.candidateName,
              status: "failed",
              message: error?.message || "Failed to upload row.",
              source: "server" as const,
            } satisfies UploadResult;
          }
        }),
      ),
    );

    const validationResults: UploadResult[] = workbookValidation.invalidRows.map((preparedRow) => ({
      row: preparedRow.rowNumber,
      candidateId: preparedRow.candidateId,
      candidateName: preparedRow.candidateName,
      status: "failed",
      message: preparedRow.issues.join(" • "),
      source: "validation",
    }));

    const completedResults = [...validationResults, ...serverResults].sort(
      (left, right) => left.row - right.row,
    );
    setResults(completedResults);
    setLoading(false);
    setProgress(100);

    const completedAt = new Date().toISOString();
    try {
      await saveUploadHistory(completedResults, startedAt, completedAt);
      await loadUploadHistory();
    } catch {
    }
  };

  const rowCount = workbookValidation.rowCount;
  const validRowCount = workbookValidation.validRows.length;
  const invalidRowCount = workbookValidation.invalidRows.length;
  const mappedQuestionCount = Object.keys(questionDefinitions).length;
  const uploadStatusLabel = loading
    ? "Uploading"
    : rowCount > 0
      ? validRowCount > 0
        ? "Ready to upload"
        : "Validation required"
      : fileName
        ? "No data rows found"
        : "Waiting for file";

  const resultSummary = useMemo(() => {
    return {
      created: results.filter((result) => result.status === "created").length,
      updated: results.filter((result) => result.status === "updated").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      failed: results.filter((result) => result.status === "failed").length,
    };
  }, [results]);

  const sampleValidationIssues = workbookValidation.invalidRows.slice(0, 8);

  return (
    <div className="analytics-page">
      <div className="container max-w-6xl space-y-6">
        <div className="analytics-card">
          <div className="analytics-card-header">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="analytics-toolbar-copy">
                <h1 className="analytics-card-title">Student Response Bulk Upload</h1>
                <p className="analytics-card-description">
                  Validate workbook rows before upload, choose how existing responses behave, and review recent upload history.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={navigateBack} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </div>
            </div>
            <div className="analytics-toolbar mt-4">
              <div className="analytics-toolbar-row">
                <div className="analytics-toolbar-meta flex-wrap">
                  {paperId ? (
                    <span className="analytics-toolbar-chip">Paper ID: {paperId}</span>
                  ) : null}
                  {sectionName ? (
                    <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                      Paper Section: {sectionName}
                    </span>
                  ) : null}
                  <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                    Class: {paperClassName || "Waiting for paper data"}
                  </span>
                </div>
              </div>
              {paperContextError ? (
                <div className="app-feedback app-feedback-danger mt-3">{paperContextError}</div>
              ) : null}
            </div>
          </div>
          <div className="analytics-card-body space-y-6">
            <div className="analytics-info-grid">
              <div className="analytics-info-card">
                <p className="analytics-info-label">Selected file</p>
                <p className="analytics-info-value">{fileName || "No file selected"}</p>
              </div>
              <div className="analytics-info-card">
                <p className="analytics-info-label">Workbook rows</p>
                <p className="analytics-info-value">{rowCount}</p>
              </div>
              <div className="analytics-info-card">
                <p className="analytics-info-label">Valid rows</p>
                <p className="analytics-info-value">{validRowCount}</p>
              </div>
              <div className="analytics-info-card">
                <p className="analytics-info-label">Invalid rows</p>
                <p className="analytics-info-value">{invalidRowCount}</p>
              </div>
              <div className="analytics-info-card">
                <p className="analytics-info-label">Mapped questions</p>
                <p className="analytics-info-value">{mappedQuestionCount}</p>
              </div>
              <div className="analytics-info-card">
                <p className="analytics-info-label">Upload mode</p>
                <p className="analytics-info-value">{formatUploadMode(uploadMode)}</p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
              <div className="analytics-subsection space-y-4">
                <div className="analytics-toolbar-copy">
                  <p className="analytics-toolbar-title">Select workbook</p>
                </div>
                <label htmlFor="file-upload" className="block cursor-pointer">
                  <div className="flex h-56 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/70 bg-background text-center transition-colors hover:bg-muted/20">
                    <UploadCloudIcon className="mb-3 h-10 w-10 text-muted-foreground" />
                    <span className="text-base font-semibold text-foreground">
                      {fileName ? "Replace selected workbook" : "Choose workbook"}
                    </span>
                    <span className="mt-1 text-sm text-muted-foreground">
                      Drag and drop or click to browse
                    </span>
                    <p className="mt-3 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      XLSX • XLS
                    </p>
                  </div>
                </label>
                <input
                  ref={fileInputRef}
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handleFile}
                />
                <div className="analytics-toolbar-actions">
                  <label htmlFor="file-upload" className="app-button-secondary cursor-pointer">
                    {fileName ? "Change file" : "Choose file"}
                  </label>
                  {fileName ? (
                    <button
                      type="button"
                      className="app-button-secondary"
                      onClick={clearSelectedFile}
                      disabled={loading}
                    >
                      Clear file
                    </button>
                  ) : null}
                </div>
                {fileName ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg border border-primary/20 bg-background p-2 text-primary">
                        <FileIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{fileName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {rowCount} workbook row{rowCount === 1 ? "" : "s"} detected.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="app-empty-state">Choose a workbook to enable upload.</div>
                )}
              </div>

              <div className="analytics-toolbar space-y-4">
                <div className="analytics-toolbar-copy">
                  <p className="analytics-toolbar-title">Upload options</p>
                </div>
                <label className="app-field-group">
                  <span className="app-field-label">Class section</span>
                  <select
                    className="app-form-input"
                    value={selectedAcademicSectionId}
                    onChange={(event) => setSelectedAcademicSectionId(event.target.value)}
                    disabled={loading || assignedAcademicSections.length === 0}
                  >
                    {assignedAcademicSections.length === 0 ? (
                      <option value="">No assigned sections</option>
                    ) : (
                      <>
                        <option value="">Select a class section</option>
                        {assignedAcademicSections.map((section) => (
                          <option key={section._id} value={section._id}>
                            {section.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </label>
                <label className="app-field-group">
                  <span className="app-field-label">Existing responses</span>
                  <select
                    className="app-form-input"
                    value={uploadMode}
                    onChange={(event) => setUploadMode(event.target.value as UploadMode)}
                    disabled={loading}
                  >
                    <option value="skip_existing">Skip existing responses</option>
                    <option value="overwrite_existing">Overwrite existing responses</option>
                  </select>
                </label>
                <div className="analytics-toolbar-actions">
                  <button
                    onClick={handleUpload}
                    className="app-button-primary flex w-full items-center justify-center gap-2 sm:w-auto"
                    disabled={
                      loading ||
                      validRowCount <= 0 ||
                      workbookValidation.globalIssues.length > 0 ||
                      (assignedAcademicSections.length > 0 && !selectedAcademicSectionId)
                    }
                  >
                    {loading ? (
                      <>
                        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                        </svg>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <span>
                        Upload {validRowCount} valid response{validRowCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </button>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                  {invalidRowCount > 0
                    ? `${invalidRowCount} invalid row${invalidRowCount === 1 ? "" : "s"} will be skipped locally.`
                    : "All detected rows are ready for upload."}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="analytics-toolbar">
                <div className="analytics-toolbar-row">
                  <div className="analytics-toolbar-copy">
                    <p className="analytics-toolbar-title">Upload progress</p>
                  </div>
                  <span className="analytics-toolbar-chip">{Math.round(progress)}% complete</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted">
                  <div
                    className="h-2.5 rounded-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
          <div className="analytics-card">
            <div className="analytics-card-body space-y-4">
              <div className="analytics-toolbar-row">
                <div className="analytics-toolbar-copy">
                  <h2 className="analytics-card-title">Workbook Validation</h2>
                </div>
                <div className="analytics-toolbar-meta">
                  <span className="analytics-toolbar-chip">{uploadStatusLabel}</span>
                </div>
              </div>
              {workbookValidation.globalIssues.length > 0 ? (
                <div className="app-feedback app-feedback-danger">
                  {workbookValidation.globalIssues[0]}
                </div>
              ) : null}
              <div className="analytics-toolbar-actions flex-wrap">
                <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                  {workbookValidation.mappedQuestionHeaders.length} mapped columns
                </span>
                <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                  {workbookValidation.unknownQuestionHeaders.length} unmapped question columns
                </span>
                <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                  {workbookValidation.duplicateRowCount} duplicate row{workbookValidation.duplicateRowCount === 1 ? "" : "s"}
                </span>
              </div>
              {workbookValidation.missingHeaders.length > 0 ? (
                <div className="app-feedback app-feedback-danger">
                  Missing columns: {workbookValidation.missingHeaders.join(", ")}
                </div>
              ) : null}
              {workbookValidation.unknownQuestionHeaders.length > 0 ? (
                <div className="app-feedback app-feedback-info">
                  Unmapped question columns: {workbookValidation.unknownQuestionHeaders.join(", ")}
                </div>
              ) : null}
              {sampleValidationIssues.length > 0 ? (
                <div className="analytics-table-wrap">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="analytics-th">Row</th>
                        <th className="analytics-th">Candidate</th>
                        <th className="analytics-th">Validation issue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sampleValidationIssues.map((row) => (
                        <tr key={row.rowNumber} className="analytics-row align-top">
                          <td className="analytics-td font-medium text-muted-foreground">{row.rowNumber}</td>
                          <td className="analytics-td">
                            <div className="font-medium text-foreground">{row.candidateName || "—"}</div>
                            <div className="text-xs text-muted-foreground">{row.candidateId || "No candidate ID"}</div>
                          </td>
                          <td className="analytics-td text-muted-foreground">{row.issues.join(" • ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="app-empty-state">No row-level validation issues detected.</div>
              )}
            </div>
          </div>

          <div className="analytics-card">
            <div className="analytics-card-body space-y-4">
              <div className="analytics-toolbar-row">
                <div className="analytics-toolbar-copy">
                  <h2 className="analytics-card-title">Recent Upload History</h2>
                </div>
                <div className="analytics-toolbar-meta">
                  <button type="button" className="app-button-secondary h-9 px-3" onClick={() => void loadUploadHistory()} disabled={historyLoading}>
                    {historyLoading ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
              </div>
              {uploadHistory.length > 0 ? (
                <div className="analytics-table-wrap">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="analytics-th">When</th>
                        <th className="analytics-th">File</th>
                        <th className="analytics-th">Status</th>
                        <th className="analytics-th">Counts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadHistory.map((history) => (
                        <tr key={history._id} className="analytics-row align-top">
                          <td className="analytics-td text-muted-foreground">
                            <div>{formatDateTime(history.createdAt)}</div>
                            <div className="text-xs">{history.academicSection?.name || "All sections"}</div>
                          </td>
                          <td className="analytics-td">
                            <div className="font-medium text-foreground">{history.fileName || "Workbook upload"}</div>
                            <div className="text-xs text-muted-foreground">{formatUploadMode(history.uploadMode)}</div>
                          </td>
                          <td className="analytics-td">
                            <span className={getStatusTone(history.status)}>{history.status || "failed"}</span>
                          </td>
                          <td className="analytics-td text-muted-foreground">
                            <div>{history.createdCount || 0} created • {history.updatedCount || 0} updated • {history.skippedCount || 0} skipped</div>
                            <div className="text-xs">{history.failureCount || 0} failed • {history.validationIssueCount || 0} validation issues</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="app-empty-state">No upload history found for this paper scope yet.</div>
              )}
            </div>
          </div>
        </div>

        {results.length > 0 ? (
          <div className="analytics-card">
            <div className="analytics-card-body space-y-4">
              <div className="analytics-toolbar-row">
                <div className="analytics-toolbar-copy">
                  <h2 className="analytics-card-title">Upload Results</h2>
                </div>
                <div className="analytics-toolbar-meta flex-wrap">
                  <span className="analytics-toolbar-chip">{results.length} processed</span>
                  <span className="analytics-badge analytics-badge-success">{resultSummary.created} created</span>
                  <span className="analytics-badge analytics-badge-success">{resultSummary.updated} updated</span>
                  <span className="analytics-badge analytics-badge-warning">{resultSummary.skipped} skipped</span>
                  <span className="analytics-badge analytics-badge-danger">{resultSummary.failed} failed</span>
                </div>
              </div>
              <div className="analytics-table-wrap">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="analytics-th">Row</th>
                      <th className="analytics-th">Candidate</th>
                      <th className="analytics-th">Status</th>
                      <th className="analytics-th">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result) => (
                      <tr key={`${result.row}-${result.candidateId || result.message}`} className="analytics-row align-top">
                        <td className="analytics-td font-medium text-muted-foreground">{result.row}</td>
                        <td className="analytics-td">
                          <div className="font-medium text-foreground">{result.candidateName || "—"}</div>
                          <div className="text-xs text-muted-foreground">{result.candidateId || "No candidate ID"}</div>
                        </td>
                        <td className="analytics-td">
                          <span className={getStatusTone(result.status)}>
                            {result.status === "failed" ? (
                              <AlertCircleIcon className="h-4 w-4" />
                            ) : (
                              <CheckCircleIcon className="h-4 w-4" />
                            )}
                            {result.status}
                          </span>
                        </td>
                        <td className="analytics-td text-muted-foreground">
                          {result.message}
                          {result.studentCreated ? (
                            <span className="ml-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              Student created
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        <div className="analytics-subsection">
          <div className="analytics-toolbar-copy">
            <p className="analytics-toolbar-title">Excel format guide</p>
          </div>
          <div className="analytics-toolbar-actions">
            {["CANDIDATE ID", "CANDIDATE NAME", "FATHER", "GROUP", "Q1", "Q2", "..."]
              .map((label) => (
                <span key={label} className="analytics-toolbar-chip">
                  {label}
                </span>
              ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Question columns such as <span className="font-mono">Q1</span> and <span className="font-mono">Q2</span> accept letters like <span className="font-mono">A</span>/<span className="font-mono">B</span> or numeric option indexes such as <span className="font-mono">0</span>, <span className="font-mono">1</span>, and <span className="font-mono">2</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            When the selected paper already has section assignments, uploads are limited to the chosen class section.
          </p>
        </div>
      </div>
    </div>
  );
}

function ExcelUploadPageFallback() {
  const { navigateBack } = useBackNavigation("/workspace/question-papers");

  return (
    <div className="analytics-page">
      <div className="container max-w-5xl space-y-6">
        <PageLoadingState
          title="Student response bulk upload"
          description="Preparing the upload workspace, workbook validation, and recent history."
          actions={
            <Button variant="outline" onClick={navigateBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          }
          className="px-0 py-0"
          contentClassName="max-w-none"
          dense
        />
      </div>
    </div>
  );
}

export default function ExcelStudentResponseUploadPage() {
  return (
    <Suspense fallback={<ExcelUploadPageFallback />}>
      <ExcelStudentResponseUploadPageContent />
    </Suspense>
  );
}
