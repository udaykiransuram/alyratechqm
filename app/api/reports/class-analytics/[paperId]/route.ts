import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { appendBenchmarkSheetsToWorkbook } from "@/lib/analytics/benchmarkExport";

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

function resolveSchoolKey(req: NextRequest) {
  const url = new URL(req.url);
  const schoolFromHeader =
    req.headers.get("x-school-key") || req.headers.get("X-School-Key");
  const schoolFromQuery = url.searchParams.get("school");
  const schoolFromCookie = req.cookies?.get?.("schoolKey")?.value;
  return (schoolFromHeader || schoolFromQuery || schoolFromCookie || "")
    .toString()
    .trim();
}

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

export async function GET(
  req: NextRequest,
  { params }: { params: { paperId: string } },
) {
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  }

  try {
    const origin = new URL(req.url).origin;
    const academicSectionId =
      req.nextUrl.searchParams.get("academicSectionId")?.trim() || "";
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
    const sharedHeaders = { "x-school-key": schoolKey };

    const groupFieldsUrl = new URL(
      `/api/analytics/class-tag-report/${encodeURIComponent(params.paperId)}`,
      origin,
    );
    groupFieldsUrl.searchParams.set("groupFields", "1");
    groupFieldsUrl.searchParams.set("school", schoolKey);

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
      `/api/analytics/class-tag-report/${encodeURIComponent(params.paperId)}`,
      origin,
    );
    analyticsUrl.searchParams.set("json", "1");
    analyticsUrl.searchParams.set("school", schoolKey);
    if (selectedGroupBy.length > 0) {
      analyticsUrl.searchParams.set("groupBy", selectedGroupBy.join(","));
    }
    if (academicSectionId) {
      analyticsUrl.searchParams.set("academicSectionId", academicSectionId);
    }

    const analyticsRes = await fetch(analyticsUrl.toString(), {
      headers: sharedHeaders,
      cache: "no-store",
    });
    const analyticsData = await analyticsRes.json();
    if (!analyticsRes.ok || analyticsData?.success === false) {
      throw new Error(
        analyticsData?.message || "Failed to load class analytics data.",
      );
    }

    const benchmarkUrl = new URL(
      `/api/analytics/benchmark-report/${encodeURIComponent(params.paperId)}`,
      origin,
    );
    benchmarkUrl.searchParams.set("school", schoolKey);
    benchmarkUrl.searchParams.set("baseline", "class_average");
    if (selectedGroupBy.length > 0) {
      benchmarkUrl.searchParams.set("groupBy", selectedGroupBy.join(","));
    }
    if (academicSectionId) {
      benchmarkUrl.searchParams.set("academicSectionId", academicSectionId);
    }
    requestedTags.forEach((tag) => benchmarkUrl.searchParams.append("tag", tag));

    let benchmarkData: any = null;
    try {
      const benchmarkRes = await fetch(benchmarkUrl.toString(), {
        headers: sharedHeaders,
        cache: "no-store",
      });
      const data = await benchmarkRes.json();
      if (benchmarkRes.ok && data?.success !== false) {
        benchmarkData = data;
      }
    } catch {
      benchmarkData = null;
    }

    const academicSectionLabel = academicSectionId
      ? groupFieldsData?.filters?.academicSections?.find(
          (option: any) => String(option?.value || "") === academicSectionId,
        )?.label || "Selected class section"
      : "All class sections";

    const summaryRows = flattenStatsRows(
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

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        { Field: "Paper", Value: analyticsData?.paper || "Question Paper" },
        { Field: "Section Scope", Value: academicSectionLabel },
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
          Field: "Benchmark Tag Filters",
          Value:
            requestedTags.length > 0 ? requestedTags.join(" • ") : "None",
        },
        { Field: "Students", Value: students.length },
        { Field: "Generated At", Value: new Date().toISOString() },
      ]),
      "Overview",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        summaryRows.length > 0
          ? summaryRows
          : [
              {
                Summary: "No analytics data available for the selected paper scope.",
              },
            ],
      ),
      "Summary",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        studentRows.length > 0
          ? studentRows
          : [{ Students: "No students found for this paper scope." }],
      ),
      "Students",
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
    const safeSectionLabel = sanitizeFilePart(academicSectionLabel);
    const fileName = `${safePaperTitle || "class_analytics"}${
      safeSectionLabel ? `_${safeSectionLabel}` : ""
    }_class_analytics.xlsx`;

    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    }) as Buffer;

    return new NextResponse(buffer, {
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
