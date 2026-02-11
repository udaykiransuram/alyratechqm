import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  // Build a simple template with headers matching the converter expectations
  const headers = [
    "Subject",
    "Class",
    "Question",
    "Option A",
    "Option B",
    "Option C",
    "Option D",
    "Option E",
    "Correct (letter)",
    "Correct (text)"
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ImportTemplate");
  const wbout = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(wbout, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=question_import_template.xlsx"
    }
  });
}
