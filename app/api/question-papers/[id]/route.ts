export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader =
    req.headers.get("x-school-key") || req.headers.get("X-School-Key");
  const schoolFromQuery = url.searchParams.get("school");
  const schoolFromCookie = req.cookies?.get?.("schoolKey")?.value;
  const schoolKey = (
    schoolFromHeader ||
    schoolFromQuery ||
    schoolFromCookie ||
    ""
  )
    .toString()
    .trim();
  if (!schoolKey)
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  try {
    const {
      QuestionPaper: QPModel,
      Question: QuestionModel,
      Tag,
      TagType,
      Class: ClassModel,
      Subject: SubjectModel,
    } = await getTenantModels(schoolKey, [
      "QuestionPaper",
      "Question",
      "Tag",
      "TagType",
      "Class",
      "Subject",
    ]);
    let paper = await QPModel.findById(params.id)
      .populate({ path: "class", model: ClassModel })
      .populate({ path: "subject", model: SubjectModel });
    if (!paper)
      return NextResponse.json(
        { success: false, message: "Paper not found." },
        { status: 404 },
      );
    await paper.populate({
      path: "sections.questions.question",
      model: QuestionModel,
      populate: {
        path: "tags",
        model: Tag,
        populate: { path: "type", model: TagType, select: "name" },
      },
    });
    return NextResponse.json({ success: true, paper }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error." },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader =
    req.headers.get("x-school-key") || req.headers.get("X-School-Key");
  const schoolFromQuery = url.searchParams.get("school");
  const schoolFromCookie = req.cookies?.get?.("schoolKey")?.value;
  const schoolKey = (
    schoolFromHeader ||
    schoolFromQuery ||
    schoolFromCookie ||
    ""
  )
    .toString()
    .trim();
  if (!schoolKey)
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  const { QuestionPaper: QPModel } = await getTenantModels(schoolKey, [
    "QuestionPaper",
  ]);

  try {
    const data = await req.json();

    const {
      title,
      class: classId,
      subject,
      duration,
      passingMarks,
      examDate,
      sections,
    } = data || {};

    if (
      !title ||
      !classId ||
      !subject ||
      !sections ||
      !Array.isArray(sections) ||
      sections.length === 0 ||
      typeof duration !== "number" ||
      duration <= 0 ||
      typeof passingMarks !== "number" ||
      passingMarks < 0 ||
      !examDate
    ) {
      return NextResponse.json(
        { success: false, message: "Missing required fields." },
        { status: 400 },
      );
    }

    for (const section of sections) {
      if (
        !section?.name ||
        typeof section?.marks !== "number" ||
        !Array.isArray(section?.questions)
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid section data." },
          { status: 400 },
        );
      }

      const sectionQuestionMarks = section.questions.reduce(
        (sum: number, q: { marks?: number }) => sum + (q?.marks ?? 0),
        0,
      );

      if (section.marks !== sectionQuestionMarks) {
        return NextResponse.json(
          {
            success: false,
            message: `Section "${section.name}" marks (${section.marks}) do not match total question marks (${sectionQuestionMarks}).`,
          },
          { status: 400 },
        );
      }

      for (const [qi, q] of section.questions.entries()) {
        if (!q?.question || typeof q?.marks !== "number") {
          return NextResponse.json(
            {
              success: false,
              message: `Invalid question data in section "${section.name}" at index ${qi}.`,
            },
            { status: 400 },
          );
        }
      }
    }

    const updated = await QPModel.findByIdAndUpdate(params.id, data, {
      new: true,
    });
    if (!updated)
      return NextResponse.json(
        { success: false, message: "Question paper not found." },
        { status: 404 },
      );
    return NextResponse.json({ success: true, paper: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader =
    req.headers.get("x-school-key") || req.headers.get("X-School-Key");
  const schoolFromQuery = url.searchParams.get("school");
  const schoolFromCookie = req.cookies?.get?.("schoolKey")?.value;
  const schoolKey = (
    schoolFromHeader ||
    schoolFromQuery ||
    schoolFromCookie ||
    ""
  )
    .toString()
    .trim();
  if (!schoolKey)
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  const { QuestionPaper: QPModel, QuestionPaperResponse: QPRModel } =
    await getTenantModels(schoolKey, [
      "QuestionPaper",
      "QuestionPaperResponse",
    ]);

  try {
    const deleted = await QPModel.findByIdAndDelete(params.id);
    if (!deleted)
      return NextResponse.json(
        { success: false, message: "Question paper not found." },
        { status: 404 },
      );
    await QPRModel.deleteMany({ paper: params.id });
    return NextResponse.json({
      success: true,
      message: "Question paper and its responses deleted.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}
