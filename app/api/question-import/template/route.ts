export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { buildQuestionImportTemplateDocx } from "@/lib/question-import/template";

export async function GET(req: NextRequest) {
  const format = String(req.nextUrl.searchParams.get("format") || "docx")
    .trim()
    .toLowerCase();

  if (format !== "docx") {
    return NextResponse.json(
      {
        success: false,
        message: "Only the DOCX teacher-master template is supported.",
      },
      { status: 400 },
    );
  }

  const fileBuffer = await buildQuestionImportTemplateDocx();

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition":
        'attachment; filename="teacher-master-import-template.docx"',
      "Cache-Control": "no-store",
    },
  });
}
