import React from "react";
import { toPng } from "html-to-image";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  getConsolidatedStudentList,
  sortStatsRows,
  buildStudentAreaMetrics,
  computeInsightsForLastTag,
} from "@/components/analytics/helpers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  appendBenchmarkSheetsToWorkbook,
  buildBenchmarkPdfBundle,
} from "@/lib/analytics/benchmarkExport";
import type { BenchmarkViewSettings } from "@/lib/analytics/benchmarkPresentation";

interface AnalyticsExportControlsProps {
  stats: any;
  groupBy: string[];
  groupFields: { value: string; label: string }[];
  sortConfig: { key: string; direction: "asc" | "desc" };
  tableRef: React.RefObject<HTMLDivElement>;
  mode?: "class" | "student";
  paperTitle?: string;
  studentName?: string;
  rollNumber?: string;
  benchmarkData?: any;
  paperId?: string;
  academicSectionId?: string;
  selectedTags?: { type: string; value: string }[];
  benchmarkViewSettings?: BenchmarkViewSettings;
}

const AnalyticsExportControls: React.FC<AnalyticsExportControlsProps> = ({
  stats,
  groupBy,
  groupFields,
  sortConfig,
  tableRef,
  mode = "class",
  paperTitle,
  studentName,
  rollNumber,
  benchmarkData,
  paperId,
  academicSectionId,
  selectedTags = [],
  benchmarkViewSettings,
}) => {
  const hasData = React.useMemo(
    () => !!stats && Object.keys(stats).length > 0,
    [stats],
  );

  const exportModeLabel =
    mode === "student" ? "Student exports" : "Class exports";
  const exportGroupingLabel =
    groupBy.length > 0
      ? `${groupBy.length} grouping levels`
      : "No grouping selected";

  function getFilenameFromDisposition(headerValue: string | null) {
    if (!headerValue) return "analytics_report.xlsx";
    const match = headerValue.match(/filename="?([^";]+)"?/i);
    return match?.[1] || "analytics_report.xlsx";
  }

  function triggerBlobDownload(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleDownloadTableImage() {
    if (tableRef.current) {
      const dataUrl = await toPng(tableRef.current, { cacheBust: true });
      const link = document.createElement("a");
      link.download = "analytics_table.png";
      link.href = dataUrl;
      link.click();
    }
  }

  // CSV export removed per requirements

  async function handleDownloadExcel() {
    if (mode === "class" && paperId) {
      const searchParams = new URLSearchParams();
      if (academicSectionId && academicSectionId !== "all") {
        searchParams.set("academicSectionId", academicSectionId);
      }
      if (groupBy.length > 0) {
        searchParams.set("groupBy", groupBy.join(","));
      }
      selectedTags.forEach((tag) => {
        searchParams.append("tag", `${tag.type}:${tag.value}`);
      });
      if (benchmarkViewSettings) {
        searchParams.set(
          "benchmarkMinDistractorPct",
          String(benchmarkViewSettings.minDistractorPct),
        );
        searchParams.set(
          "benchmarkMinDistractorCount",
          String(benchmarkViewSettings.minDistractorCount),
        );
        searchParams.set(
          "benchmarkDistractorSortBy",
          benchmarkViewSettings.distractorSortBy,
        );
      }

      try {
        const response = await fetch(
          `/api/reports/class-analytics/${paperId}?${searchParams.toString()}`,
          {
            cache: "no-store",
          },
        );

        if (response.ok) {
          const blob = await response.blob();
          const fileName = getFilenameFromDisposition(
            response.headers.get("content-disposition"),
          );
          triggerBlobDownload(blob, fileName);
          return;
        }

        let message = "Failed to generate Excel workbook.";
        try {
          const data = await response.json();
          if (typeof data?.message === "string" && data.message.trim()) {
            message = data.message.trim();
          }
        } catch {}
        throw new Error(message);
      } catch (error: any) {
        console.error("[analytics-export] class workbook download failed", error);
      }
    }

    const consolidatedRows: any[] = [];
    const detailedRows: any[] = [];
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
    function walk(node: any, groupPath: string[] = []) {
      if (!node || typeof node !== "object") return;
      if (
        node.correct !== undefined &&
        node.incorrect !== undefined &&
        node.unattempted !== undefined
      ) {
        const groupHeaders = groupBy.map((g) => {
          const field = groupFields.find((f) => f.value === g);
          return field ? field.label : g;
        });
        const totalQuestions = node.correct + node.incorrect + node.unattempted;
        const percentCorrect =
          totalQuestions > 0 ? (node.correct / totalQuestions) * 100 : 0;
        const percentIncorrect =
          totalQuestions > 0 ? (node.incorrect / totalQuestions) * 100 : 0;
        const percentUnattempted =
          totalQuestions > 0 ? (node.unattempted / totalQuestions) * 100 : 0;
        consolidatedRows.push({
          ...groupPath.reduce(
            (acc, val, idx) => ({ ...acc, [groupHeaders[idx]]: val }),
            {},
          ),
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
            key: "correctStudents",
            label: "Correct",
            questionIds: node.correctQuestionIds,
          },
          {
            key: "incorrectStudents",
            label: "Incorrect",
            questionIds: node.incorrectQuestionIds,
          },
          {
            key: "unattemptedStudents",
            label: "Unattempted",
            questionIds: node.unattemptedQuestionIds,
          },
        ];
        statuses.forEach(({ key, label, questionIds }) => {
          const all: { name: string; rollNumber: string }[] = [];
          if (questionIds) {
            questionIds.forEach((q: any) => {
              if (q[key]) all.push(...q[key]);
            });
          }
          const map = new Map<
            string,
            { name: string; rollNumber: string; count: number }
          >();
          all.forEach((s) => {
            const k = `${s.rollNumber}|${s.name}`;
            if (!map.has(k)) map.set(k, { ...s, count: 1 });
            else map.get(k)!.count += 1;
          });
          Array.from(map.values()).forEach((s) => {
            detailedRows.push({
              ...groupPath.reduce(
                (acc, val, idx) => ({ ...acc, [groupHeaders[idx]]: val }),
                {},
              ),
              Status: label,
              Name: s.name,
              RollNumber: s.rollNumber,
              Count: s.count,
            });
          });
        });
      }
      const statuses = [
        {
          key: "correctStudents",
          label: "Correct",
          questionIds: node.correctQuestionIds,
        },
        {
          key: "incorrectStudents",
          label: "Incorrect",
          questionIds: node.incorrectQuestionIds,
        },
        {
          key: "unattemptedStudents",
          label: "Unattempted",
          questionIds: node.unattemptedQuestionIds,
        },
      ];
      statuses.forEach(({ key, label, questionIds }) => {
        const all: { name: string; rollNumber: string }[] = [];
        if (questionIds) {
          questionIds.forEach((q: any) => {
            if (q[key]) all.push(...q[key]);
          });
        }
        all.forEach((s) => {
          const studentKey = `${s.rollNumber}|${s.name}`;
          if (!studentSummaryMap[studentKey]) {
            studentSummaryMap[studentKey] = {
              Name: s.name,
              RollNumber: s.rollNumber,
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
          }
          if (label === "Incorrect") {
            studentSummaryMap[studentKey].Incorrect += 1;
            studentSummaryMap[studentKey].Attempted += 1;
          }
          if (label === "Unattempted") {
            studentSummaryMap[studentKey].Unattempted += 1;
          }
          studentSummaryMap[studentKey].Total += 1;
        });
      });
      const rows = Object.entries(node)
        .filter(([key, value]) => typeof value === "object" && value !== null)
        .map(([key, value]) => ({ key, ...(value as Record<string, any>) }));
      const sortedRows = sortStatsRows(
        rows,
        sortConfig.key,
        sortConfig.direction,
      );
      for (const row of sortedRows) {
        const childNode = node[row.key];
        walk(childNode, [...groupPath, row.key]);
      }
    }
    if (stats && typeof stats === "object" && Object.keys(stats).length > 0) {
      walk(stats, []);
    }
    const groupHeaders = groupBy.map((g) => {
      const field = groupFields.find((f) => f.value === g);
      return field ? field.label : g;
    });
    const fixedHeaders = [
      "Correct",
      "Incorrect",
      "Unattempted",
      "% Correct",
      "% Incorrect",
      "% Unattempted",
      "CorrectStudents",
      "IncorrectStudents",
      "UnattemptedStudents",
    ];
    const consolidatedHeaders = [...groupHeaders, ...fixedHeaders];
    const detailedHeaders = [
      ...groupHeaders,
      "Status",
      "Name",
      "RollNumber",
      "Count",
    ];
    const consolidatedSheet = XLSX.utils.json_to_sheet(consolidatedRows, {
      header: consolidatedHeaders,
    });
    consolidatedSheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: 0, c: consolidatedHeaders.length - 1 },
      }),
    };
    const detailedSheet = XLSX.utils.json_to_sheet(detailedRows, {
      header: detailedHeaders,
    });
    detailedSheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: 0, c: detailedHeaders.length - 1 },
      }),
    };
    const studentSummaryRows = Object.values(studentSummaryMap).map((s) => {
      const total = s.Correct + s.Incorrect + s.Unattempted;
      return {
        Name: s.Name,
        RollNumber: s.RollNumber,
        "Correct (%)":
          total > 0 ? Number(((s.Correct / total) * 100).toFixed(2)) : 0,
        "Incorrect (%)":
          total > 0 ? Number(((s.Incorrect / total) * 100).toFixed(2)) : 0,
        "Unattempted (%)":
          total > 0 ? Number(((s.Unattempted / total) * 100).toFixed(2)) : 0,
        "Total Questions": total,
        Attempted: s.Attempted,
        Correct: s.Correct,
        Incorrect: s.Incorrect,
        Unattempted: s.Unattempted,
      };
    });
    const studentSummaryHeaders = [
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
    ];
    const studentSummarySheet = XLSX.utils.json_to_sheet(studentSummaryRows, {
      header: studentSummaryHeaders,
    });
    studentSummarySheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: 0, c: studentSummaryHeaders.length - 1 },
      }),
    };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, consolidatedSheet, "Consolidated");
    XLSX.utils.book_append_sheet(workbook, detailedSheet, "Detailed");
    XLSX.utils.book_append_sheet(
      workbook,
      studentSummarySheet,
      "Student Summary",
    );
    // Insights sheet (last selected tag only)
    try {
      const insightsHeaders = ["Tag", "Fail (%)", "Category", "Action"];
      let insightsRows: Array<{
        Tag: string;
        "Fail (%)": number;
        Category: string;
        Action: string;
      }> = [];
      const lastTag =
        groupBy && groupBy.length > 0 ? groupBy[groupBy.length - 1] : undefined;
      if (stats && lastTag) {
        if (mode === "student" && studentName && rollNumber) {
          // Build per-student insights from metrics, filtering rows by last header label
          const headerLabel =
            groupFields.find((f) => f.value === lastTag)?.label || lastTag;
          const metrics = buildStudentAreaMetrics(
            stats,
            groupBy,
            groupFields,
            { key: "", direction: "desc" },
            { singleStudent: { name: studentName, roll: rollNumber } },
          );
          const key = `${rollNumber}|${studentName}`;
          const entry = metrics.get(key);
          const rows = entry?.rows || [];
          const map = new Map<string, { total: number; fail: number }>();
          for (const r of rows) {
            // area format like "Header1: X / Header2: Y" -> extract last header value
            const parts = String(r.area || "")
              .split("/")
              .map((s) => s.trim());
            const lastPart = parts[parts.length - 1] || "";
            const m = lastPart.match(/^([^:]+):\s*(.+)$/);
            const val =
              m && m[1].trim() === headerLabel ? m[2].trim() : lastPart;
            const agg = map.get(val) || { total: 0, fail: 0 };
            agg.total += r.total || 0;
            const incorrect = (r as any).incorrect || 0;
            const unattempted = (r as any).unattempted || 0;
            agg.fail += incorrect + unattempted;
            map.set(val, agg);
          }
          for (const [tag, v] of map.entries()) {
            const pct =
              v.total > 0 ? Number(((v.fail / v.total) * 100).toFixed(2)) : 0;
            const category =
              pct < 25
                ? "Healthy"
                : pct < 40
                  ? "Needs Attention"
                  : pct < 50
                    ? "Re-teach Recommended"
                    : "Re-teach Mandatory";
            const action =
              category === "Healthy"
                ? "No re-teach; enrichment optional."
                : category === "Needs Attention"
                  ? "Targeted revision."
                  : category === "Re-teach Recommended"
                    ? "Partial re-teach."
                    : "Full re-teach.";
            insightsRows.push({
              Tag: tag,
              "Fail (%)": pct,
              Category: category,
              Action: action,
            });
          }
        } else {
          // Class insights
          const insights = computeInsightsForLastTag(
            stats,
            groupBy,
            groupFields,
          );
          insightsRows = insights.map((i) => ({
            Tag: i.tag,
            "Fail (%)": i.failPct,
            Category: i.category,
            Action: i.action,
          }));
        }
      }
      const insightsSheet = XLSX.utils.json_to_sheet(insightsRows, {
        header: insightsHeaders,
      });
      insightsSheet["!autofilter"] = {
        ref: XLSX.utils.encode_range({
          s: { r: 0, c: 0 },
          e: { r: 0, c: insightsHeaders.length - 1 },
        }),
      } as any;
      XLSX.utils.book_append_sheet(workbook, insightsSheet, "Insights");
    } catch {}

    if (mode === "class" && benchmarkData) {
      appendBenchmarkSheetsToWorkbook(workbook, benchmarkData, {
        benchmarkViewSettings,
        baseUrl: typeof window !== "undefined" ? window.location.origin : "",
      });
    }

    XLSX.writeFile(workbook, "analytics_report.xlsx");
  }

  type InsightRow = {
    Tag: string;
    "Fail (%)": number;
    Category: string;
    Action: string;
  };

  function generateRemedialDocForStudent(
    name: string,
    roll: string,
    rows: {
      area: string;
      correct: number;
      incorrect: number;
      unattempted: number;
      total: number;
      percent: number;
    }[],
    paperTitle?: string,
    insights?: InsightRow[],
  ) {
    const doc = new jsPDF();
    if (paperTitle) {
      doc.setFontSize(14);
      doc.text(`Paper: ${paperTitle}`, 14, 16);
    }
    doc.setFontSize(16);
    doc.text(`Remedial Sheet - ${name} (${roll})`, 14, paperTitle ? 26 : 18);
    let y = paperTitle ? 34 : 26;

    // Insights (optional) at the top
    if (insights && insights.length > 0) {
      autoTable(doc, {
        head: [["Insights (Last Tag)"]],
        body: [],
        startY: y,
        styles: { fontSize: 12 },
        theme: "plain",
        margin: { left: 14, right: 14 },
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 2;
      autoTable(doc, {
        head: [["Tag", "Fail (%)", "Category", "Action"]],
        body: insights.map((r) => [
          r.Tag,
          String(r["Fail (%)"]),
          r.Category,
          r.Action,
        ]),
        startY: y,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [99, 102, 241] },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 6;
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }
    }
    rows.forEach((r, idx) => {
      autoTable(doc, {
        head: [
          ["Area", "Correct", "Incorrect", "Unattempted", "Total", "% Correct"],
        ],
        body: [
          [
            r.area || "Overall",
            String(r.correct),
            String(r.incorrect),
            String(r.unattempted),
            String(r.total),
            `${r.percent}%`,
          ],
        ],
        startY: y,
        styles: { fontSize: 11 },
        headStyles: { fillColor: [34, 197, 94] },
        columnStyles: { 0: { cellWidth: 110 } },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
      // Update y to continue after the last table
      // @ts-ignore - jspdf-autotable adds lastAutoTable
      y = (doc as any).lastAutoTable.finalY + 6;
      // Page break if near bottom
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }
    });
    return doc;
  }

  async function handleDownloadRemedials() {
    const singleStudent =
      mode === "student"
        ? { name: studentName || "", roll: rollNumber || "" }
        : undefined;
    const metrics = buildStudentAreaMetrics(
      stats,
      groupBy,
      groupFields,
      { key: "", direction: "desc" },
      singleStudent ? { singleStudent } : undefined,
    );
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const paper = paperTitle ? `${paperTitle}-` : "";
    if (mode === "student") {
      const key = `${rollNumber || ""}|${studentName || ""}`;
      const entry = metrics.get(key);
      const rows = entry?.rows || [];
      // Build per-student insights for last selected tag
      let insightsRows: InsightRow[] = [];
      try {
        const lastTag =
          groupBy && groupBy.length > 0
            ? groupBy[groupBy.length - 1]
            : undefined;
        if (lastTag) {
          const headerLabel =
            groupFields.find((f) => f.value === lastTag)?.label || lastTag;
          const map = new Map<string, { total: number; fail: number }>();
          for (const r of rows) {
            const parts = String(r.area || "")
              .split("/")
              .map((s) => s.trim());
            const lastPart = parts[parts.length - 1] || "";
            const m = lastPart.match(/^([^:]+):\s*(.+)$/);
            const val =
              m && m[1].trim() === headerLabel ? m[2].trim() : lastPart;
            const agg = map.get(val) || { total: 0, fail: 0 };
            agg.total += r.total || 0;
            const incorrect = (r as any).incorrect || 0;
            const unattempted = (r as any).unattempted || 0;
            agg.fail += incorrect + unattempted;
            map.set(val, agg);
          }
          for (const [tag, v] of map.entries()) {
            const pct =
              v.total > 0 ? Number(((v.fail / v.total) * 100).toFixed(2)) : 0;
            const category =
              pct < 25
                ? "Healthy"
                : pct < 40
                  ? "Needs Attention"
                  : pct < 50
                    ? "Re-teach Recommended"
                    : "Re-teach Mandatory";
            const action =
              category === "Healthy"
                ? "No re-teach; enrichment optional."
                : category === "Needs Attention"
                  ? "Targeted revision."
                  : category === "Re-teach Recommended"
                    ? "Partial re-teach."
                    : "Full re-teach.";
            insightsRows.push({
              Tag: tag,
              "Fail (%)": pct,
              Category: category,
              Action: action,
            });
          }
          // Sort worst-first
          insightsRows.sort((a, b) => b["Fail (%)"] - a["Fail (%)"]);
        }
      } catch {}

      const doc = generateRemedialDocForStudent(
        studentName || "Student",
        rollNumber || "",
        rows,
        paperTitle,
        insightsRows,
      );
      doc.save(`${paper}${studentName || "student"}-remedial-${ts}.pdf`);
    } else {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      // Class-level insights summary PDF (last selected tag)
      try {
        const insights = computeInsightsForLastTag(stats, groupBy, groupFields);
        if (insights && insights.length > 0) {
          const doc = new jsPDF();
          doc.setFontSize(16);
          if (paperTitle) {
            doc.text(`Paper: ${paperTitle}`, 14, 16);
            doc.setFontSize(18);
            doc.text(`Insights Summary (Last Tag)`, 14, 28);
            autoTable(doc, {
              head: [["Tag", "Fail (%)", "Category", "Action"]],
              body: insights.map((i) => [
                i.tag,
                String(i.failPct),
                i.category,
                i.action,
              ]),
              startY: 36,
              styles: { fontSize: 11 },
              headStyles: { fillColor: [99, 102, 241] },
              theme: "grid",
              margin: { left: 14, right: 14 },
            });
          } else {
            doc.text(`Insights Summary (Last Tag)`, 14, 18);
            autoTable(doc, {
              head: [["Tag", "Fail (%)", "Category", "Action"]],
              body: insights.map((i) => [
                i.tag,
                String(i.failPct),
                i.category,
                i.action,
              ]),
              startY: 26,
              styles: { fontSize: 11 },
              headStyles: { fillColor: [99, 102, 241] },
              theme: "grid",
              margin: { left: 14, right: 14 },
            });
          }
          const blob = doc.output("blob");
          zip.file(`${paper || ""}Insights-Summary-${ts}.pdf`, blob as any);
        }
      } catch {}

      for (const [, v] of metrics.entries()) {
        const doc = generateRemedialDocForStudent(
          v.name,
          v.roll,
          v.rows,
          paperTitle,
        );
        const blob = doc.output("blob");
        const filename = `${paper}${v.name}-remedial-${ts}.pdf`;
        zip.file(filename, blob as any);
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${paper}remedials-${ts}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  async function handleDownloadBenchmarkPdf() {
    if (mode !== "class") return;

    const bundle = buildBenchmarkPdfBundle(benchmarkData, {
      benchmarkViewSettings,
      baseUrl: typeof window !== "undefined" ? window.location.origin : "",
    });
    if (!bundle.hasData) {
      alert("Benchmark data is not available for this report yet.");
      return;
    }

    const doc = new jsPDF();
    let y = 18;
    const title = paperTitle ? `${paperTitle} • Benchmark Summary` : "Benchmark Summary";
    doc.setFontSize(16);
    doc.text(title, 14, y);
    y += 8;

    if (bundle.overviewRows.length > 1) {
      autoTable(doc, {
        head: [bundle.overviewRows[0]],
        body: bundle.overviewRows.slice(1),
        startY: y,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [34, 197, 94] },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (bundle.cohortRows.length > 0) {
      autoTable(doc, {
        head: [["Section", "Accuracy", "Acc Gap", "Avg Score", "Score Gap", "Pass Rate", "Pass Gap"]],
        body: bundle.cohortRows,
        startY: y,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (bundle.insightRows.length > 0) {
      if (y > doc.internal.pageSize.getHeight() - 70) {
        doc.addPage();
        y = 18;
      }
      autoTable(doc, {
        head: [["Insight", "Description", "Severity"]],
        body: bundle.insightRows,
        startY: y,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [99, 102, 241] },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (bundle.tagRows.length > 0) {
      if (y > doc.internal.pageSize.getHeight() - 70) {
        doc.addPage();
        y = 18;
      }
      autoTable(doc, {
        head: [["Q Nos", "Tag", "Section", "Accuracy", "Gap"]],
        body: bundle.tagRows,
        startY: y,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [244, 114, 182] },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (bundle.distractorRows.length > 0) {
      if (y > doc.internal.pageSize.getHeight() - 70) {
        doc.addPage();
        y = 18;
      }
      autoTable(doc, {
        head: bundle.distractorHead,
        body: bundle.distractorRows,
        startY: y,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [245, 158, 11] },
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (bundle.questionLinkRows.length > 0) {
      if (y > doc.internal.pageSize.getHeight() - 70) {
        doc.addPage();
        y = 18;
      }
      autoTable(doc, {
        head: bundle.questionLinkHead,
        body: bundle.questionLinkRows.map((row: any) => row.cells),
        startY: y,
        styles: { fontSize: 8.5 },
        headStyles: { fillColor: [14, 165, 233] },
        theme: "grid",
        margin: { left: 14, right: 14 },
        didDrawCell: (data: any) => {
          if (data.section !== "body" || data.column.index !== 3) return;
          const url = String(bundle.questionLinkRows?.[data.row.index]?.url || "").trim();
          if (!/^https?:\/\//i.test(url)) return;
          doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, {
            url,
          });
        },
      });
    }

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const safeTitle = (paperTitle || "benchmark_summary").replace(/[^a-zA-Z0-9_\-]+/g, "_");
    doc.save(`${safeTitle}-benchmark-${ts}.pdf`);
  }

  return (
    <div className="w-full xl:max-w-[34rem]">
      <div className="analytics-toolbar">
        <div className="analytics-toolbar-row">
          <div className="analytics-toolbar-copy">
            <p className="analytics-toolbar-title">Export current report</p>
          </div>
          <div className="analytics-toolbar-meta">
            <span className="analytics-toolbar-chip">{exportModeLabel}</span>
            <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
              {exportGroupingLabel}
            </span>
          </div>
        </div>
        <div className="analytics-toolbar-actions">
          <Button
            onClick={handleDownloadTableImage}
            variant="outline"
            size="sm"
            disabled={!hasData}
            className="min-w-[9.5rem] justify-center"
          >
            Table image
          </Button>
          <Button
            onClick={handleDownloadExcel}
            variant="outline"
            size="sm"
            disabled={!hasData}
            className="min-w-[9.5rem] justify-center"
          >
            Excel workbook
          </Button>
          {mode === "class" ? (
            <Button
              onClick={handleDownloadBenchmarkPdf}
              variant="outline"
              size="sm"
              disabled={!benchmarkData?.baseline}
              className="min-w-[9.5rem] justify-center"
            >
              Benchmark PDF
            </Button>
          ) : null}
          {mode === "student" ? (
            <Button
              onClick={handleDownloadRemedials}
              variant="outline"
              size="sm"
              disabled={!hasData}
              className="min-w-[10rem] justify-center"
            >
              Remedial PDF
            </Button>
          ) : (
            <Button
              onClick={handleDownloadRemedials}
              variant="outline"
              size="sm"
              disabled={!hasData}
              className="min-w-[10rem] justify-center"
            >
              Remedial ZIP
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export function generateClassAnalyticsExcel(
  stats: any,
  groupBy: string[],
  groupFields: { value: string; label: string }[],
  sortConfig: { key: string; direction: "asc" | "desc" },
  fileName: string = "analytics_report.xlsx",
) {
  const consolidatedRows: any[] = [];
  const detailedRows: any[] = [];
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
  function walk(node: any, groupPath: string[] = []) {
    if (!node || typeof node !== "object") return;
    if (
      node.correct !== undefined &&
      node.incorrect !== undefined &&
      node.unattempted !== undefined
    ) {
      const groupHeaders = groupBy.map((g) => {
        const field = groupFields.find((f) => f.value === g);
        return field ? field.label : g;
      });
      const totalQuestions = node.correct + node.incorrect + node.unattempted;
      const percentCorrect =
        totalQuestions > 0 ? (node.correct / totalQuestions) * 100 : 0;
      const percentIncorrect =
        totalQuestions > 0 ? (node.incorrect / totalQuestions) * 100 : 0;
      const percentUnattempted =
        totalQuestions > 0 ? (node.unattempted / totalQuestions) * 100 : 0;
      consolidatedRows.push({
        ...groupPath.reduce(
          (acc, val, idx) => ({ ...acc, [groupHeaders[idx]]: val }),
          {},
        ),
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
          key: "correctStudents",
          label: "Correct",
          questionIds: node.correctQuestionIds,
        },
        {
          key: "incorrectStudents",
          label: "Incorrect",
          questionIds: node.incorrectQuestionIds,
        },
        {
          key: "unattemptedStudents",
          label: "Unattempted",
          questionIds: node.unattemptedQuestionIds,
        },
      ];
      statuses.forEach(({ key, label, questionIds }) => {
        const all: { name: string; rollNumber: string }[] = [];
        if (questionIds) {
          questionIds.forEach((q: any) => {
            if (q[key]) all.push(...q[key]);
          });
        }
        const map = new Map<
          string,
          { name: string; rollNumber: string; count: number }
        >();
        all.forEach((s) => {
          const k = `${s.rollNumber}|${s.name}`;
          if (!map.has(k)) map.set(k, { ...s, count: 1 });
          else map.get(k)!.count += 1;
        });
        Array.from(map.values()).forEach((s) => {
          detailedRows.push({
            ...groupPath.reduce(
              (acc, val, idx) => ({ ...acc, [groupHeaders[idx]]: val }),
              {},
            ),
            Status: label,
            Name: s.name,
            RollNumber: s.rollNumber,
            Count: s.count,
          });
        });
      });
    }
    const statuses = [
      {
        key: "correctStudents",
        label: "Correct",
        questionIds: node.correctQuestionIds,
      },
      {
        key: "incorrectStudents",
        label: "Incorrect",
        questionIds: node.incorrectQuestionIds,
      },
      {
        key: "unattemptedStudents",
        label: "Unattempted",
        questionIds: node.unattemptedQuestionIds,
      },
    ];
    statuses.forEach(({ key, label, questionIds }) => {
      const all: { name: string; rollNumber: string }[] = [];
      if (questionIds) {
        questionIds.forEach((q: any) => {
          if (q[key]) all.push(...q[key]);
        });
      }
      all.forEach((s) => {
        const studentKey = `${s.rollNumber}|${s.name}`;
        if (!studentSummaryMap[studentKey]) {
          studentSummaryMap[studentKey] = {
            Name: s.name,
            RollNumber: s.rollNumber,
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
        }
        if (label === "Incorrect") {
          studentSummaryMap[studentKey].Incorrect += 1;
          studentSummaryMap[studentKey].Attempted += 1;
        }
        if (label === "Unattempted") {
          studentSummaryMap[studentKey].Unattempted += 1;
        }
        studentSummaryMap[studentKey].Total += 1;
      });
    });
    const rows = Object.entries(node)
      .filter(([key, value]) => typeof value === "object" && value !== null)
      .map(([key, value]) => ({ key, ...(value as Record<string, any>) }));
    const sortedRows = sortStatsRows(
      rows,
      sortConfig.key,
      sortConfig.direction,
    );
    for (const row of sortedRows) {
      const childNode = node[row.key];
      walk(childNode, [...groupPath, row.key]);
    }
  }
  if (stats && typeof stats === "object" && Object.keys(stats).length > 0) {
    walk(stats, []);
  }
  const groupHeaders = groupBy.map((g) => {
    const field = groupFields.find((f) => f.value === g);
    return field ? field.label : g;
  });
  const fixedHeaders = [
    "Correct",
    "Incorrect",
    "Unattempted",
    "% Correct",
    "% Incorrect",
    "% Unattempted",
    "CorrectStudents",
    "IncorrectStudents",
    "UnattemptedStudents",
  ];
  const consolidatedHeaders = [...groupHeaders, ...fixedHeaders];
  const detailedHeaders = [
    ...groupHeaders,
    "Status",
    "Name",
    "RollNumber",
    "Count",
  ];
  const consolidatedSheet = XLSX.utils.json_to_sheet(consolidatedRows, {
    header: consolidatedHeaders,
  });
  consolidatedSheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: 0, c: consolidatedHeaders.length - 1 },
    }),
  };
  const detailedSheet = XLSX.utils.json_to_sheet(detailedRows, {
    header: detailedHeaders,
  });
  detailedSheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: 0, c: detailedHeaders.length - 1 },
    }),
  };
  const studentSummaryRows = Object.values(studentSummaryMap).map((s) => {
    const total = s.Correct + s.Incorrect + s.Unattempted;
    return {
      Name: s.Name,
      RollNumber: s.RollNumber,
      "Correct (%)":
        total > 0 ? Number(((s.Correct / total) * 100).toFixed(2)) : 0,
      "Incorrect (%)":
        total > 0 ? Number(((s.Incorrect / total) * 100).toFixed(2)) : 0,
      "Unattempted (%)":
        total > 0 ? Number(((s.Unattempted / total) * 100).toFixed(2)) : 0,
      "Total Questions": total,
      Attempted: s.Attempted,
      Correct: s.Correct,
      Incorrect: s.Incorrect,
      Unattempted: s.Unattempted,
    };
  });
  const studentSummaryHeaders = [
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
  ];
  const studentSummarySheet = XLSX.utils.json_to_sheet(studentSummaryRows, {
    header: studentSummaryHeaders,
  });
  studentSummarySheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: 0, c: studentSummaryHeaders.length - 1 },
    }),
  };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, consolidatedSheet, "Consolidated");
  XLSX.utils.book_append_sheet(workbook, detailedSheet, "Detailed");
  XLSX.utils.book_append_sheet(
    workbook,
    studentSummarySheet,
    "Student Summary",
  );
  // XLSX.writeFile(workbook, fileName);
  return workbook;
}

export default AnalyticsExportControls;
