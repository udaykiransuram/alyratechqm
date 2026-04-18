import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { requireTenantSession } from "@/lib/api-auth";
import { getTenantModels } from "@/lib/db-tenant";
import {
  sanitizeQuestionOptions,
  sanitizeRichTextHtml,
} from "@/lib/security/html-sanitize";
import GlobalQuestion from "@/models/GlobalQuestion";

export const runtime = "nodejs";

function normalizeName(value: string) {
  return String(value || "").trim().toLowerCase();
}

type IdOnlyDoc = {
  _id: unknown;
};

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
  const globalQuestion = await GlobalQuestion.findById(id).lean();
  if (!globalQuestion) {
    return NextResponse.json(
      { success: false, message: "Global question not found." },
      { status: 404 },
    );
  }

  const { Question, Subject, Class: ClassModel, Tag, TagType } =
    await getTenantModels(schoolKey, [
      "Question",
      "Subject",
      "Class",
      "Tag",
      "TagType",
    ]);

  const className = String(globalQuestion.className || "").trim();
  const subjectName = String(globalQuestion.subjectName || "").trim();

  const classDoc = await ClassModel.findOne({
    name: new RegExp(`^${className}$`, "i"),
  }).lean<IdOnlyDoc | null>();
  const classId = classDoc?._id ?? (await ClassModel.create({ name: className }))._id;

  const subjectDoc = await Subject.findOne({
    name: new RegExp(`^${subjectName}$`, "i"),
  }).lean<IdOnlyDoc | null>();
  const subjectId =
    subjectDoc?._id ??
    (
      await Subject.create({
      name: subjectName,
      tags: [],
      })
    )._id;

  const tagIds: string[] = [];
  for (const tag of globalQuestion.tags || []) {
    const tagName = String(tag?.name || "").trim();
    const typeName = String(tag?.typeName || "").trim().toLowerCase();
    if (!tagName || !typeName) continue;

    const tagType = await TagType.findOne({
      name: new RegExp(`^${typeName}$`, "i"),
    }).lean<IdOnlyDoc | null>();
    const tagTypeId = tagType?._id ?? (await TagType.create({ name: typeName }))._id;

    const tagDoc = await Tag.findOne({
      name: new RegExp(`^${tagName}$`, "i"),
      type: tagTypeId,
    }).lean<IdOnlyDoc | null>();
    const tagId = tagDoc?._id ?? (await Tag.create({ name: tagName, type: tagTypeId }))._id;

    tagIds.push(String(tagId));
  }

  if (tagIds.length > 0) {
    await Subject.updateOne(
      { _id: subjectId },
      { $addToSet: { tags: { $each: tagIds } } },
    );
  }

  const created = await Question.create({
    subject: subjectId,
    class: classId,
    tags: tagIds,
    content: sanitizeRichTextHtml(globalQuestion.content || ""),
    options: sanitizeQuestionOptions(globalQuestion.options || []),
    answerIndexes: Array.isArray(globalQuestion.answerIndexes)
      ? globalQuestion.answerIndexes
      : [],
    matrixOptions: Array.isArray(globalQuestion.matrixOptions)
      ? globalQuestion.matrixOptions
      : undefined,
    matrixAnswers: Array.isArray(globalQuestion.matrixAnswers)
      ? globalQuestion.matrixAnswers
      : undefined,
    explanation: sanitizeRichTextHtml(globalQuestion.explanation || ""),
    marks: Number(globalQuestion.marks || 1),
    type: String(globalQuestion.type || "single"),
    createdBy: auth.session.user.id,
  });

  return NextResponse.json({ success: true, id: String(created._id) });
}
