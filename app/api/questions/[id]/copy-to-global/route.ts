import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { requireTenantSession } from "@/lib/api-auth";
import { getTenantModels } from "@/lib/db-tenant";
import {
  sanitizeQuestionForApiResponse,
  sanitizeQuestionOptions,
  sanitizeRichTextHtml,
} from "@/lib/security/html-sanitize";
import GlobalQuestion from "@/models/GlobalQuestion";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const schoolKey = auth.schoolKey;

  await connectDB();
  const { Question: QuestionModel } = await getTenantModels(schoolKey, [
    "Question",
  ]);

  const question = await QuestionModel.findById(id)
    .populate("subject", "name")
    .populate("class", "name")
    .populate({ path: "tags", populate: { path: "type", select: "name" } })
    .lean();

  if (!question) {
    return NextResponse.json(
      { success: false, message: "Question not found." },
      { status: 404 },
    );
  }

  const normalized = sanitizeQuestionForApiResponse(question);
  const subjectName = String(normalized?.subject?.name || "").trim();
  const className = String(normalized?.class?.name || "").trim();

  if (!subjectName || !className) {
    return NextResponse.json(
      {
        success: false,
        message: "Question must have both subject and class to copy globally.",
      },
      { status: 400 },
    );
  }

  const tags = Array.isArray(normalized?.tags)
    ? normalized.tags
        .map((tag: any) => ({
          name: String(tag?.name || "").trim(),
          typeName: String(tag?.type?.name || "").trim().toLowerCase(),
        }))
        .filter((tag: any) => tag.name && tag.typeName)
    : [];

  const payload = {
    sourceSchoolKey: schoolKey,
    sourceQuestionId: String(normalized?._id || ""),
    subjectName,
    className,
    tags,
    content: sanitizeRichTextHtml(normalized?.content || ""),
    options: sanitizeQuestionOptions(normalized?.options || []),
    answerIndexes: Array.isArray(normalized?.answerIndexes)
      ? normalized.answerIndexes
      : [],
    matrixOptions: Array.isArray(normalized?.matrixOptions)
      ? normalized.matrixOptions
      : undefined,
    matrixAnswers: Array.isArray(normalized?.matrixAnswers)
      ? normalized.matrixAnswers
      : undefined,
    explanation: sanitizeRichTextHtml(normalized?.explanation || ""),
    marks: Number(normalized?.marks || 0),
    type: String(normalized?.type || ""),
    createdBy: auth.session.user.id,
  };

  const existing = await GlobalQuestion.findOne({
    sourceSchoolKey: schoolKey,
    sourceQuestionId: payload.sourceQuestionId,
  }).lean();

  if (existing?._id) {
    return NextResponse.json({ success: true, id: String(existing._id) });
  }

  const created = await GlobalQuestion.create(payload);

  return NextResponse.json({ success: true, id: String(created._id) });
}
