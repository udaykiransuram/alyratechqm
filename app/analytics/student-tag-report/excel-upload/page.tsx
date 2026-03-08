"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import {
  withSchool,
  withSchoolHeaders,
  getSchoolKeyFromCookie,
} from "@/lib/client/school";
import * as XLSX from "xlsx";
import { useSearchParams } from "next/navigation";
import pLimit from "p-limit";

// --- Icons (can be moved to a separate file) ---
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

const limit = pLimit(10);

function ExcelStudentResponseUploadPageContent() {
  const [excelRows, setExcelRows] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sectionName, setSectionName] = useState<string>("");
  const [questionMap, setQuestionMap] = useState<{ [key: string]: string }>({});
  const searchParams = useSearchParams();
  const paperId = searchParams.get("paperId");
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch section name from QuestionPaper when paperId changes
  useEffect(() => {
    async function fetchSectionNameAndQuestions() {
      if (!paperId) return;
      const res = await fetch(withSchool(`/api/question-papers/${paperId}`));
      const data = await res.json();
      if (data.success && data.paper && data.paper.sections.length > 0) {
        setSectionName(data.paper.sections[0].name);
        // Build a map: Q1 -> question._id, Q2 -> question._id, etc.
        const map: { [key: string]: string } = {};
        data.paper.sections[0].questions.forEach((q: any, idx: number) => {
          map[`Q${idx + 1}`] = q.question._id; // assumes order matches Excel
        });
        setQuestionMap(map);
      }
    }
    fetchSectionNameAndQuestions();
  }, [paperId]);

  // Parse Excel file
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults([]);
    setExcelRows([]);
    setProgress(0);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      setExcelRows(data);
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

  // Add this cache outside the function so it persists during the upload
  const classIdCache: { [name: string]: string } = {};

  // Helper to get or create class and return its ID
  async function getOrCreateClassId(className: string, description?: string) {
    if (classIdCache[className]) return classIdCache[className];
    const res = await fetch(
      withSchool("/api/classes"),
      withSchoolHeaders({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: className, description }),
      }),
    );
    const data = await res.json();
    const id = data.classId || (data.class && data.class._id);
    if (!id) throw new Error(data.message || "Failed to get class ID");
    classIdCache[className] = id;
    return id;
  }

  // Helper to get or create student and return their user ID
  async function getOrCreateStudent({
    name,
    rollNumber,
    classId,
    fatherName,
  }: {
    name: string;
    rollNumber: string;
    classId: string;
    fatherName?: string;
  }) {
    // Check if student exists (by rollNumber and class)
    const searchUrl = withSchool(
      `/api/users?role=student&rollNumber=${encodeURIComponent(rollNumber)}&classId=${encodeURIComponent(classId)}`,
    );
    const res = await fetch(searchUrl);
    const data = await res.json();
    if (data.success && data.users && data.users.length > 0) {
      return data.users[0]._id;
    }

    // If not, create the student
    const createRes = await fetch(
      withSchool("/api/users"),
      withSchoolHeaders({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role: "student",
          rollNumber,
          class: classId,
          fatherName,
        }),
      }),
    );
    const createData = await createRes.json();
    if (createData.success && createData.user && createData.user._id) {
      return createData.user._id;
    }
    throw new Error(createData.message || "Failed to create student");
  }

  // Map Excel row to API payload (async)
  async function mapRowToPayloadAsync(row: any, header: string[]) {
    const rowData: { [key: string]: any } = {};
    header.forEach((key, idx) => {
      rowData[key] = row[idx];
    });

    const answers: any[] = [];
    // Updated optionMap for letters; numbers are handled separately
    const optionMap: { [key: string]: number } = {
      A: 0,
      B: 1,
      C: 2,
      D: 3,
    };

    for (const key in rowData) {
      if (key.toUpperCase().startsWith("Q")) {
        const questionId = questionMap[key]; // Use ObjectId, not "Q1"
        const option = rowData[key];
        let index: number | undefined;

        if (option !== null && option !== undefined) {
          if (typeof option === "number") {
            index = option; // Direct number as index (e.g., 25 -> 25)
          } else if (typeof option === "string") {
            const upper = option.toUpperCase();
            if (optionMap[upper] !== undefined) {
              index = optionMap[upper]; // Letter to index (e.g., 'A' -> 0)
            } else if (!isNaN(Number(upper))) {
              index = Number(upper); // String number to index (e.g., '12' -> 12)
            }
          }
        }

        if (questionId && index !== undefined) {
          answers.push({
            question: questionId,
            selectedOptions: [index],
          });
        }
      }
    }

    // --- Create the class first (or skip if missing) ---
    let classId: string | undefined = undefined;
    const className =
      `${rowData["FATHER"] || ""} ${rowData["GROUP"] || ""}`.trim();

    if (className) {
      classId = await getOrCreateClassId(className);
    } else if (rowData["CANDIDATE ID"]) {
      // Try to find student by roll number only
      const existingStudentRes = await fetch(
        `/api/users?role=student&rollNumber=${encodeURIComponent(rowData["CANDIDATE ID"])}`,
      );
      const existingStudentData = await existingStudentRes.json();
      if (
        existingStudentData.success &&
        existingStudentData.users &&
        existingStudentData.users.length > 0
      ) {
        classId = existingStudentData.users[0].class;
      } else {
        throw new Error(
          "Class name is empty and student not found for row: " +
            JSON.stringify(rowData),
        );
      }
    } else {
      throw new Error(
        "Class name is empty for row: " + JSON.stringify(rowData),
      );
    }

    // --- Then create/get the student ---
    if (!rowData["CANDIDATE ID"]) {
      throw new Error(
        "Student roll number is required for row: " + JSON.stringify(rowData),
      );
    }
    if (!classId) {
      throw new Error(
        "Class ID is undefined for row: " + JSON.stringify(rowData),
      );
    }
    const studentId = await getOrCreateStudent({
      name: rowData["CANDIDATE NAME"],
      rollNumber: rowData["CANDIDATE ID"],
      classId,
      fatherName: rowData["FATHER"],
    });

    // --- Use the fetched section name here ---
    if (!sectionName) throw new Error("Section name not found for this paper.");

    const payload: any = {
      paper: paperId,
      student: studentId,
      sectionAnswers: [
        {
          sectionName,
          answers: answers,
        },
      ],
      submittedAt: new Date().toISOString(),
    };

    return payload;
  }

  // POST each row to /api/question-paper-response
  const handleUpload = async () => {
    setLoading(true);
    setProgress(0);
    const header = excelRows[0];
    const rowsToUpload = excelRows
      .slice(1)
      .filter((row) => row && row.length > 0);
    const uploadPromises = [];

    for (let i = 0; i < rowsToUpload.length; i++) {
      const row = rowsToUpload[i];
      uploadPromises.push(
        limit(async () => {
          try {
            const payload = await mapRowToPayloadAsync(row, header);
            const res = await fetch(
              withSchool("/api/question-paper-response"),
              withSchoolHeaders({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              }),
            );
            const data = await res.json();
            // Update progress after each successful or failed upload
            setProgress((prev) => prev + (1 / rowsToUpload.length) * 100);
            return {
              row: i + 2,
              success: data.success,
              message: data.message || "",
              id: data.response?._id,
            };
          } catch (e: any) {
            setProgress((prev) => prev + (1 / rowsToUpload.length) * 100);
            return {
              row: i + 2,
              success: false,
              message: e.message || "Failed to upload",
            };
          }
        }),
      );
    }
    const outResults = await Promise.all(uploadPromises);
    setResults(outResults);
    setLoading(false);
  };

  const rowCount = Math.max(excelRows.length - 1, 0);
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;
  const mappedQuestionCount = Object.keys(questionMap).length;
  const uploadStatusLabel = loading
    ? "Uploading"
    : rowCount > 0
      ? "Ready to upload"
      : fileName
        ? "No data rows found"
        : "Waiting for file";

  return (
    <div className="analytics-page">
      <div className="container max-w-5xl space-y-6">
        <div className="analytics-card">
          <div className="analytics-card-header">
            <div className="analytics-toolbar-row gap-4">
              <div className="analytics-toolbar-copy">
                <h1 className="analytics-card-title">
                  Student Response Bulk Upload
                </h1>
                <p className="analytics-card-description">
                  Upload an Excel file to create student responses for a test
                  paper.
                </p>
              </div>
              <div className="analytics-toolbar-meta">
                {paperId && (
                  <span className="analytics-toolbar-chip">
                    Paper ID: {paperId}
                  </span>
                )}
                {sectionName && (
                  <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                    Section: {sectionName}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="analytics-card-body">
            <div className="analytics-toolbar">
              <div className="analytics-toolbar-row">
                <div className="analytics-toolbar-copy">
                  <p className="analytics-toolbar-title">Upload checklist</p>
                  <p className="analytics-toolbar-note">
                    Select a workbook, verify the detected rows, then start the
                    import. Row-level results appear below as each response is
                    processed.
                  </p>
                </div>
                <div className="analytics-toolbar-meta">
                  <span className="analytics-toolbar-chip">
                    {uploadStatusLabel}
                  </span>
                  <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                    {mappedQuestionCount} mapped questions
                  </span>
                </div>
              </div>
              <div className="analytics-info-grid">
                <div className="analytics-info-card">
                  <p className="analytics-info-label">Selected file</p>
                  <p className="analytics-info-value">
                    {fileName || "No file selected"}
                  </p>
                </div>
                <div className="analytics-info-card">
                  <p className="analytics-info-label">Detected rows</p>
                  <p className="analytics-info-value">{rowCount}</p>
                </div>
                <div className="analytics-info-card">
                  <p className="analytics-info-label">Target section</p>
                  <p className="analytics-info-value">
                    {sectionName || "Waiting for paper data"}
                  </p>
                </div>
                <div className="analytics-info-card">
                  <p className="analytics-info-label">Upload status</p>
                  <p className="analytics-info-value">{uploadStatusLabel}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.15fr,0.95fr]">
              <div className="analytics-subsection">
                <div className="analytics-toolbar-copy">
                  <p className="analytics-toolbar-title">Select workbook</p>
                  <p className="analytics-toolbar-note">
                    The importer reads the first sheet in the workbook.
                    Supported file types: XLSX and XLS.
                  </p>
                </div>
                <label htmlFor="file-upload" className="block cursor-pointer">
                  <div className="flex h-56 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/70 bg-background text-center transition-colors hover:bg-muted/20">
                    <UploadCloudIcon className="mb-3 h-10 w-10 text-muted-foreground" />
                    <span className="text-base font-semibold text-foreground">
                      {fileName ? "Replace selected workbook" : "Choose an Excel workbook"}
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
                  <label
                    htmlFor="file-upload"
                    className="app-button-secondary cursor-pointer"
                  >
                    {fileName ? "Choose another file" : "Choose file"}
                  </label>
                  {fileName && (
                    <button
                      type="button"
                      className="app-button-secondary"
                      onClick={clearSelectedFile}
                      disabled={loading}
                    >
                      Clear file
                    </button>
                  )}
                </div>
              </div>

              <div className="analytics-toolbar">
                <div className="analytics-toolbar-copy">
                  <p className="analytics-toolbar-title">Run bulk import</p>
                  <p className="analytics-toolbar-note">
                    Each populated row becomes one student response. Any failed
                    rows stay listed below so they can be fixed and retried.
                  </p>
                </div>

                {fileName ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg border border-primary/20 bg-background p-2 text-primary">
                        <FileIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {fileName}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {rowCount} response rows detected and ready for import.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="app-empty-state">
                    Choose a workbook to enable the upload action.
                  </div>
                )}

                <div className="analytics-toolbar-actions">
                  <button
                    onClick={handleUpload}
                    className="app-button-primary flex w-full items-center justify-center gap-2 sm:w-auto"
                    disabled={loading || rowCount <= 0}
                  >
                    {loading ? (
                      <>
                        <svg
                          className="h-5 w-5 animate-spin"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8z"
                          ></path>
                        </svg>
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <span>
                        {rowCount > 0
                          ? `Upload ${rowCount} response${rowCount === 1 ? "" : "s"}`
                          : "Upload responses"}
                      </span>
                    )}
                  </button>
                </div>
                <p className="analytics-toolbar-note">
                  {fileName
                    ? rowCount > 0
                      ? "The upload uses the active paper from the URL and the section mapping shown above."
                      : "Your sheet needs a header row and at least one student response row."
                    : "Columns are validated against the active paper before each response is created."}
                </p>
              </div>
            </div>

            {loading && (
              <div className="analytics-toolbar">
                <div className="analytics-toolbar-row">
                  <div className="analytics-toolbar-copy">
                    <p className="analytics-toolbar-title">Upload progress</p>
                    <p className="analytics-toolbar-note">
                      Responses are processed concurrently and the progress bar
                      updates as each row completes.
                    </p>
                  </div>
                  <span className="analytics-toolbar-chip">
                    {Math.round(progress)}% complete
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted">
                  <div
                    className="h-2.5 rounded-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {results.length > 0 && (
          <div className="analytics-card">
            <div className="analytics-card-body">
              <div className="analytics-toolbar">
                <div className="analytics-toolbar-row">
                  <div className="analytics-toolbar-copy">
                    <h2 className="analytics-card-title">Upload Results</h2>
                    <p className="analytics-toolbar-note">
                      Review each processed row below. Failed entries can be
                      fixed in Excel and uploaded again.
                    </p>
                  </div>
                  <div className="analytics-toolbar-meta">
                    <span className="analytics-toolbar-chip">
                      {results.length} processed
                    </span>
                    <span className="analytics-badge analytics-badge-success">
                      {successCount} succeeded
                    </span>
                    <span className="analytics-badge analytics-badge-danger">
                      {failureCount} failed
                    </span>
                  </div>
                </div>
              </div>
              <div className="analytics-table-wrap">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="analytics-th">Row</th>
                      <th className="analytics-th">Status</th>
                      <th className="analytics-th">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, idx) => (
                      <tr key={idx} className="analytics-row">
                        <td className="analytics-td font-medium text-muted-foreground">
                          {r.row}
                        </td>
                        <td className="analytics-td">
                          {r.success ? (
                            <span className="analytics-badge analytics-badge-success">
                              <CheckCircleIcon className="h-4 w-4" /> Success
                            </span>
                          ) : (
                            <span className="analytics-badge analytics-badge-danger">
                              <AlertCircleIcon className="h-4 w-4" /> Error
                            </span>
                          )}
                        </td>
                        <td className="analytics-td text-muted-foreground">
                          {r.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="analytics-subsection">
          <div className="analytics-toolbar-copy">
            <p className="analytics-toolbar-title">Excel format guide</p>
            <p className="analytics-toolbar-note">
              Use these columns exactly so the importer can match students,
              classes, and answers correctly.
            </p>
          </div>
          <div className="analytics-toolbar-actions">
            {[
              "CANDIDATE ID",
              "CANDIDATE NAME",
              "FATHER",
              "GROUP",
              "Q1",
              "Q2",
              "...",
            ].map((label) => (
              <span key={label} className="analytics-toolbar-chip">
                {label}
              </span>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Question columns like <span className="font-mono">Q1</span> and{" "}
            <span className="font-mono">Q2</span> accept option letters such
            as <span className="font-mono">A</span>/<span className="font-mono">B</span>/<span className="font-mono">C</span>/<span className="font-mono">D</span> or numeric option indexes like <span className="font-mono">1</span>, <span className="font-mono">2</span>, <span className="font-mono">12</span>, and <span className="font-mono">25</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            The active paper is taken from the URL, and uploads use the first
            section mapping loaded above.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ExcelStudentResponseUploadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          Loading...
        </div>
      }
    >
      <ExcelStudentResponseUploadPageContent />
    </Suspense>
  );
}
