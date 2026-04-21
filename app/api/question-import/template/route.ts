export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { buildQuestionImportTemplateDocx } from "@/lib/question-import/template";
import { buildDiagnosticQuestionWorkbookTemplateBuffer } from "@/lib/question-import/xlsx";
import { toBinaryResponseBody } from "@/lib/server/binary-response";

export async function GET(req: NextRequest) {
  const format = String(req.nextUrl.searchParams.get("format") || "docx")
    .trim()
    .toLowerCase();

  if (format !== "docx" && format !== "xlsx") {
    return NextResponse.json(
      {
        success: false,
        message: "Supported template formats are DOCX and XLSX.",
      },
      { status: 400 },
    );
  }

  const fileBuffer =
    format === "xlsx"
      ? buildDiagnosticQuestionWorkbookTemplateBuffer()
      : await buildQuestionImportTemplateDocx();

  return new NextResponse(toBinaryResponseBody(fileBuffer), {
    status: 200,
    headers: {
      "Content-Type":
        format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition":
        format === "xlsx"
          ? 'attachment; filename="diagnostic-question-import-template.xlsx"'
          : 'attachment; filename="teacher-master-import-template.docx"',
      "Cache-Control": "no-store",
    },
  });
}
