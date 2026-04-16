import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { appendBenchmarkSheetsToWorkbook } from "@/lib/analytics/benchmarkExport";
import { requireTenantSession } from "@/lib/api-auth";
import { toBinaryResponseBody } from "@/lib/server/binary-response";
import { getTrustedInternalOrigin } from "@/lib/security/internal-origin";

export const dynamic = "force-dynamic";

type GroupField = {
  value: string;
  label: string;
};

const RESERVED_KEYS = new Set([
  "correct",
  "incorrect",
  "unattempted",
  "correctStudents",
  "incorrectStudents",
  "unattemptedStudents",
  "correctQuestionIds",
  "incorrectQuestionIds",
  "unattemptedQuestionIds",
  "optionTags",
  "id",
  "number",
  "section",
  "tags",
  "content",
  "answerIndexes",
  "options",
]);

function sanitizeFilePart(value: string) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function flattenStatsRows(
  stats: any,
  groupBy: string[],
  groupFields: GroupField[],
) {
  const rows: Record<string, any>[] = [];
  const headers = groupBy.map(
    (value) => groupFields.find((field) => field.value === value)?.label || value,
  );

  const walk = (node: any, groupPath: string[] = []) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;

    if (
      typeof node.correct === "number" &&
      typeof node.incorrect === "number" &&
      typeof node.unattempted === "number"
    ) {
      const total = node.correct + node.incorrect + node.unattempted;
      const row: Record<string, any> = {};
      headers.forEach((header, index) => {
        row[header] = groupPath[index] || "";
      });
      row.Correct = node.correct;
      row.Incorrect = node.incorrect;
      row.Unattempted = node.unattempted;
      row.Total = total;
      row["% Correct"] =
        total > 0 ? Number(((node.correct / total) * 100).toFixed(2)) : 0;
      row["% Incorrect"] =
        total > 0 ? Number(((node.incorrect / total) * 100).toFixed(2)) : 0;
      row["% Unattempted"] =
        total > 0 ? Number(((node.unattempted / total) * 100).toFixed(2)) : 0;
      rows.push(row);
    }

    Object.entries(node).forEach(([key, child]) => {
      if (RESERVED_KEYS.has(key)) return;
      if (child && typeof child === "object" && !Array.isArray(child)) {
        walk(child, [...groupPath, key]);
      }
    });
  };

  walk(stats, []);
  return rows;
}

function getConsolidatedStudentList(
  questionIds: any[] | undefined,
  key: "correctStudents" | "incorrectStudents" | "unattemptedStudents",
) {
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    return "";
  }

  const allStudents: { name: string; rollNumber: string }[] = [];
  questionIds.forEach((question) => {
    if (Array.isArray(question?.[key])) {
      allStudents.push(...question[key]);
    }
  });

  const consolidated = new Map<
    string,
    { name: string; rollNumber: string; count: number }
  >();
  allStudents.forEach((student) => {
    const mapKey = `${student.rollNumber}|${student.name}`;
    if (!consolidated.has(mapKey)) {
      consolidated.set(mapKey, {
        name: student.name,
        rollNumber: student.rollNumber,
        count: 1,
      });
      return;
    }

    consolidated.get(mapKey)!.count += 1;
  });

  return Array.from(consolidated.values())
    .map(
      (student) =>
        `${student.name} (${student.rollNumber}) x${student.count}`,
    )
    .join("; ");
}

function collectWorkbookBreakdownRows(
  stats: any,
  groupBy: string[],
  groupFields: GroupField[],
) {
  const groupHeaders = groupBy.map(
    (value) =>
      groupFields.find((field) => field.value === value)?.label || value,
  );
  const consolidatedRows: Record<string, any>[] = [];
  const detailedRows: Record<string, any>[] = [];
  const studentSummaryMap: Record<
    string,
    {
      Name: string;
      RollNumber: string;
      Correct: number;
      Incorrect: number;
      Unattempted: number;
      Attempted: number;
      Total: number;
    }
  > = {};

  const walk = (node: any, groupPath: string[] = []) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;

    if (
      typeof node.correct === "number" &&
      typeof node.incorrect === "number" &&
      typeof node.unattempted === "number"
    ) {
      const totalQuestions = node.correct + node.incorrect + node.unattempted;
      const groupRow = groupPath.reduce<Record<string, string>>(
        (accumulator, value, index) => ({
          ...accumulator,
          [groupHeaders[index]]: value,
        }),
        {},
      );

      consolidatedRows.push({
        ...groupRow,
        Correct: node.correct,
        Incorrect: node.incorrect,
        Unattempted: node.unattempted,
        "% Correct":
          totalQuestions > 0
            ? Number(((node.correct / totalQuestions) * 100).toFixed(2))
            : 0,
        "% Incorrect":
          totalQuestions > 0
            ? Number(((node.incorrect / totalQuestions) * 100).toFixed(2))
            : 0,
        "% Unattempted":
          totalQuestions > 0
            ? Number(((node.unattempted / totalQuestions) * 100).toFixed(2))
            : 0,
        CorrectStudents: getConsolidatedStudentList(
          node.correctQuestionIds,
          "correctStudents",
        ),
        IncorrectStudents: getConsolidatedStudentList(
          node.incorrectQuestionIds,
          "incorrectStudents",
        ),
        UnattemptedStudents: getConsolidatedStudentList(
          node.unattemptedQuestionIds,
          "unattemptedStudents",
        ),
      });

      const statuses = [
        {
          key: "correctStudents" as const,
          label: "Correct",
          questionIds: node.correctQuestionIds,
        },
        {
          key: "incorrectStudents" as const,
          label: "Incorrect",
          questionIds: node.incorrectQuestionIds,
        },
        {
          key: "unattemptedStudents" as const,
          label: "Unattempted",
          questionIds: node.unattemptedQuestionIds,
        },
      ];

      statuses.forEach(({ key, label, questionIds }) => {
        const allStudents: { name: string; rollNumber: string }[] = [];
        if (Array.isArray(questionIds)) {
          questionIds.forEach((question: any) => {
            if (Array.isArray(question?.[key])) {
              allStudents.push(...question[key]);
            }
          });
        }

        const groupedStudents = new Map<
          string,
          { name: string; rollNumber: string; count: number }
        >();

        allStudents.forEach((student) => {
          const mapKey = `${student.rollNumber}|${student.name}`;
          if (!groupedStudents.has(mapKey)) {
            groupedStudents.set(mapKey, {
              ...student,
              count: 1,
            });
            return;
          }

          groupedStudents.get(mapKey)!.count += 1;
        });

        Array.from(groupedStudents.values()).forEach((student) => {
          detailedRows.push({
            ...groupRow,
            Status: label,
            Name: student.name,
            RollNumber: student.rollNumber,
            Count: student.count,
          });
        });

        allStudents.forEach((student) => {
          const studentKey = `${student.rollNumber}|${student.name}`;
          if (!studentSummaryMap[studentKey]) {
            studentSummaryMap[studentKey] = {
              Name: student.name,
              RollNumber: student.rollNumber,
              Correct: 0,
              Incorrect: 0,
              Unattempted: 0,
              Attempted: 0,
              Total: 0,
            };
          }

          if (label === "Correct") {
            studentSummaryMap[studentKey].Correct += 1;
            studentSummaryMap[studentKey].Attempted += 1;
          } else if (label === "Incorrect") {
            studentSummaryMap[studentKey].Incorrect += 1;
            studentSummaryMap[studentKey].Attempted += 1;
          } else {
            studentSummaryMap[studentKey].Unattempted += 1;
          }

          studentSummaryMap[studentKey].Total += 1;
        });
      });
    }

    Object.entries(node).forEach(([key, child]) => {
      if (RESERVED_KEYS.has(key)) return;
      if (child && typeof child === "object" && !Array.isArray(child)) {
        walk(child, [...groupPath, key]);
      }
    });
  };

  walk(stats, []);

  const studentSummaryRows = Object.values(studentSummaryMap).map((student) => {
    const totalQuestions =
      student.Correct + student.Incorrect + student.Unattempted;
    return {
      Name: student.Name,
      RollNumber: student.RollNumber,
      "Correct (%)":
        totalQuestions > 0
          ? Number(((student.Correct / totalQuestions) * 100).toFixed(2))
          : 0,
      "Incorrect (%)":
        totalQuestions > 0
          ? Number(((student.Incorrect / totalQuestions) * 100).toFixed(2))
          : 0,
      "Unattempted (%)":
        totalQuestions > 0
          ? Number(((student.Unattempted / totalQuestions) * 100).toFixed(2))
          : 0,
      "Total Questions": totalQuestions,
      Attempted: student.Attempted,
      Correct: student.Correct,
      Incorrect: student.Incorrect,
      Unattempted: student.Unattempted,
    };
  });

  return {
    groupHeaders,
    consolidatedRows,
    detailedRows,
    studentSummaryRows,
  };
}

function appendWorkbookSheet(
  workbook: XLSX.WorkBook,
  name: string,
  rows: Record<string, any>[],
  headers?: string[],
  emptyMessage?: string,
) {
  const hasRows = Array.isArray(rows) && rows.length > 0;
  const sheet = hasRows
    ? XLSX.utils.json_to_sheet(rows, headers ? { header: headers } : undefined)
    : XLSX.utils.json_to_sheet([
        {
          [name]:
            emptyMessage || `No ${name.toLowerCase()} data is available.`,
        },
      ]);

  if (hasRows && Array.isArray(headers) && headers.length > 0) {
    sheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: 0, c: headers.length - 1 },
      }),
    };
  }

  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ paperId: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;
  const { paperId } = await params;

  try {
    const origin = getTrustedInternalOrigin();
    const classId = req.nextUrl.searchParams.get("classId")?.trim() || "";
    const academicSectionId =
      req.nextUrl.searchParams.get("academicSectionId")?.trim() || "";
    const subjectId = req.nextUrl.searchParams.get("subjectId")?.trim() || "";
    const requestedGroupBy = req.nextUrl.searchParams
      .get("groupBy")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) || [];
    const requestedTags = req.nextUrl.searchParams
      .getAll("tag")
      .map((value) => value.trim())
      .filter(Boolean);
    const requestedNumTags = Number(
      req.nextUrl.searchParams.get("numTags") || "5",
    );
    const benchmarkMinDistractorPct = Math.max(
      0,
      Number(req.nextUrl.searchParams.get("benchmarkMinDistractorPct") || "10") || 0,
    );
    const benchmarkMinDistractorCount = Math.max(
      1,
      Math.floor(
        Number(
          req.nextUrl.searchParams.get("benchmarkMinDistractorCount") || "1",
        ) || 1,
      ),
    );
    const rawBenchmarkDistractorSortBy =
      req.nextUrl.searchParams.get("benchmarkDistractorSortBy")?.trim() ||
      "peak_selected";
    const benchmarkDistractorSortBy =
      rawBenchmarkDistractorSortBy === "peak_gap" ||
      rawBenchmarkDistractorSortBy === "sections_affected"
        ? rawBenchmarkDistractorSortBy
        : "peak_selected";
    const sharedHeaders: Record<string, string> = {
      "x-school-key": schoolKey,
    };
    const requestCookie = req.headers.get("cookie");
    if (requestCookie) {
      sharedHeaders.cookie = requestCookie;
    }
    const groupFieldsUrl = new URL(
      `/api/analytics/class-tag-report/${encodeURIComponent(paperId)}`,
      origin,
    );
    groupFieldsUrl.searchParams.set("groupFields", "1");
    groupFieldsUrl.searchParams.set("school", schoolKey);
    if (classId) {
      groupFieldsUrl.searchParams.set("classId", classId);
    }
    if (subjectId) {
      groupFieldsUrl.searchParams.set("subjectId", subjectId);
    }

    const groupFieldsRes = await fetch(groupFieldsUrl.toString(), {
      headers: sharedHeaders,
      cache: "no-store",
    });
    const groupFieldsData = await groupFieldsRes.json();
    if (!groupFieldsRes.ok) {
      throw new Error(
        groupFieldsData?.message || "Failed to load class analytics fields.",
      );
    }

    const allGroupFields: GroupField[] = Array.isArray(groupFieldsData?.fields)
      ? groupFieldsData.fields
      : [];
    const fallbackGroupCount = Number.isFinite(requestedNumTags) && requestedNumTags > 0
      ? Math.min(Math.floor(requestedNumTags), allGroupFields.length || requestedNumTags)
      : 5;
    const validGroupFieldSet = new Set(allGroupFields.map((field) => String(field?.value || "")));
    const selectedGroupBy =
      requestedGroupBy.length > 0
        ? requestedGroupBy.filter((value) => validGroupFieldSet.has(value))
        : allGroupFields
            .slice(0, fallbackGroupCount)
            .map((field) => String(field?.value || ""))
            .filter(Boolean);

    const analyticsUrl = new URL(
      `/api/analytics/class-tag-report/${encodeURIComponent(paperId)}`,
      origin,
    );
    analyticsUrl.searchParams.set("json", "1");
    analyticsUrl.searchParams.set("school", schoolKey);
    if (selectedGroupBy.length > 0) {
      analyticsUrl.searchParams.set("groupBy", selectedGroupBy.join(","));
    }
    if (classId) {
      analyticsUrl.searchParams.set("classId", classId);
    }
    if (academicSectionId) {
      analyticsUrl.searchParams.set("academicSectionId", academicSectionId);
    }
    if (subjectId) {
      analyticsUrl.searchParams.set("subjectId", subjectId);
    }
    requestedTags.forEach((tag) => analyticsUrl.searchParams.append("tag", tag));

    const benchmarkUrl = new URL(
      `/api/analytics/benchmark-report/${encodeURIComponent(paperId)}`,
      origin,
    );
    benchmarkUrl.searchParams.set("school", schoolKey);
    benchmarkUrl.searchParams.set("baseline", "class_average");
    if (selectedGroupBy.length > 0) {
      benchmarkUrl.searchParams.set("groupBy", selectedGroupBy.join(","));
    }
    if (classId) {
      benchmarkUrl.searchParams.set("classId", classId);
    }
    if (academicSectionId) {
      benchmarkUrl.searchParams.set("academicSectionId", academicSectionId);
    }
    if (subjectId) {
      benchmarkUrl.searchParams.set("subjectId", subjectId);
    }
    requestedTags.forEach((tag) => benchmarkUrl.searchParams.append("tag", tag));

    const [analyticsData, benchmarkData] = await Promise.all([
      (async () => {
        const analyticsRes = await fetch(analyticsUrl.toString(), {
          headers: sharedHeaders,
          cache: "no-store",
        });
        const data = await analyticsRes.json();
        if (!analyticsRes.ok || data?.success === false) {
          throw new Error(
            data?.message || "Failed to load class analytics data.",
          );
        }
        return data;
      })(),
      (async () => {
        try {
          const benchmarkRes = await fetch(benchmarkUrl.toString(), {
            headers: sharedHeaders,
            cache: "no-store",
          });
          const data = await benchmarkRes.json();
          if (benchmarkRes.ok && data?.success !== false) {
            return data;
          }
        } catch {}

        return null;
      })(),
    ]);

    const academicSectionLabel = academicSectionId
      ? groupFieldsData?.filters?.academicSections?.find(
          (option: any) => String(option?.value || "") === academicSectionId,
        )?.label || "Selected class section"
      : "All class sections";
    const classLabel = classId
      ? groupFieldsData?.filters?.classes?.find(
          (option: any) => String(option?.value || "") === classId,
        )?.label || "Selected class"
      : "All classes";
    const subjectLabel = subjectId
      ? groupFieldsData?.filters?.subjects?.find(
          (option: any) => String(option?.value || "") === subjectId,
        )?.label || "Selected subject"
      : "All subjects";

    const summaryRows = flattenStatsRows(
      analyticsData?.stats || {},
      selectedGroupBy,
      allGroupFields,
    );
    const {
      groupHeaders,
      consolidatedRows,
      detailedRows,
      studentSummaryRows,
    } = collectWorkbookBreakdownRows(
      analyticsData?.stats || {},
      selectedGroupBy,
      allGroupFields,
    );
    const students = Array.isArray(analyticsData?.students)
      ? analyticsData.students
      : [];
    const studentRows = students.map((student: any) => ({
      Name: student?.name || "",
      "Roll Number": student?.rollNumber || "",
      Section:
        student?.academicSection?.name ||
        student?.academicSectionName ||
        "",
    }));

    const workbook = XLSX.utils.book_new();

    appendWorkbookSheet(
      workbook,
      "Consolidated",
      consolidatedRows,
      [
        ...groupHeaders,
        "Correct",
        "Incorrect",
        "Unattempted",
        "% Correct",
        "% Incorrect",
        "% Unattempted",
        "CorrectStudents",
        "IncorrectStudents",
        "UnattemptedStudents",
      ],
      "No grouped analytics breakdown is available for the selected filters.",
    );

    appendWorkbookSheet(
      workbook,
      "Detailed",
      detailedRows,
      [...groupHeaders, "Status", "Name", "RollNumber", "Count"],
      "No student-level grouped rows are available for the selected filters.",
    );

    appendWorkbookSheet(
      workbook,
      "Student Summary",
      studentSummaryRows,
      [
        "Name",
        "RollNumber",
        "Correct (%)",
        "Incorrect (%)",
        "Unattempted (%)",
        "Total Questions",
        "Attempted",
        "Correct",
        "Incorrect",
        "Unattempted",
      ],
      "No student summary is available for the selected filters.",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        { Field: "Paper", Value: analyticsData?.paper || "Question Paper" },
        { Field: "Class Scope", Value: classLabel },
        { Field: "Section Scope", Value: academicSectionLabel },
        { Field: "Subject Scope", Value: subjectLabel },
        {
          Field: "Grouping",
          Value:
            selectedGroupBy
              .map(
                (value) =>
                  allGroupFields.find((field) => field.value === value)?.label ||
                  value,
              )
              .join(" • ") || "Overall",
        },
        {
          Field: "Applied Tag Filters",
          Value:
            requestedTags.length > 0 ? requestedTags.join(" • ") : "None",
        },
        { Field: "Students", Value: students.length },
        { Field: "Generated At", Value: new Date().toISOString() },
      ]),
      "Overview",
    );

    appendWorkbookSheet(
      workbook,
      "Summary",
      summaryRows,
      [
        ...groupHeaders,
        "Correct",
        "Incorrect",
        "Unattempted",
        "Total",
        "% Correct",
        "% Incorrect",
        "% Unattempted",
      ],
      "No analytics data is available for the selected paper scope.",
    );

    appendWorkbookSheet(
      workbook,
      "Students",
      studentRows,
      ["Name", "Roll Number", "Section"],
      "No students found for this paper scope.",
    );

    appendBenchmarkSheetsToWorkbook(workbook, benchmarkData, {
      benchmarkViewSettings: {
        minDistractorPct: benchmarkMinDistractorPct,
        minDistractorCount: benchmarkMinDistractorCount,
        distractorSortBy: benchmarkDistractorSortBy,
      },
      baseUrl: origin,
    });

    const safePaperTitle = sanitizeFilePart(
      String(analyticsData?.paper || "class_analytics"),
    );
    const safeClassLabel = sanitizeFilePart(classLabel);
    const safeSectionLabel = sanitizeFilePart(academicSectionLabel);
    const fileName = `${safePaperTitle || "class_analytics"}${
      safeClassLabel ? `_${safeClassLabel}` : ""
    }${
      safeSectionLabel ? `_${safeSectionLabel}` : ""
    }_class_analytics.xlsx`;

    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    }) as Buffer;

    return new NextResponse(toBinaryResponseBody(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to generate class analytics file.",
      },
      { status: 500 },
    );
  }
}
