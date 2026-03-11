export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { buildArchiveFilter, resolveIncludeArchived } from "@/lib/archive";
import "@/models/QuestionPaperResponse";
import "@/models/Class";
import "@/models/Subject";
import "@/models/TagType";
import "@/models/Tag";
import "@/models/AcademicSection";

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

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return Array.from(
    new Set(value.map((item) => String(item || "").trim()).filter(Boolean)),
  );
}

async function validateAssignedAcademicSections(
  AcademicSectionModel: any,
  classId: string,
  assignedAcademicSectionIds: string[],
) {
  if (!assignedAcademicSectionIds.length) {
    return { ok: true, ids: [] as string[] } as const;
  }

  const sections = await AcademicSectionModel.find({
    _id: { $in: assignedAcademicSectionIds },
    class: classId,
    isActive: true,
    ...buildArchiveFilter(false),
  })
    .select("_id")
    .lean();

  if (sections.length !== assignedAcademicSectionIds.length) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message:
            "Assigned sections must exist, be active, and belong to the selected class.",
        },
        { status: 400 },
      ),
    } as const;
  }

  return { ok: true, ids: assignedAcademicSectionIds } as const;
}

export async function POST(req: NextRequest) {
  await connectDB();

  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  }

  try {
    const {
      QuestionPaper: QPModel,
      AcademicSection: AcademicSectionModel,
    } = await getTenantModels(schoolKey, ["QuestionPaper", "AcademicSection"]);

    const body = await req.json();
    const {
      title,
      instructions,
      class: classId,
      subject,
      duration,
      passingMarks,
      examDate,
      totalMarks,
      sections,
    } = body || {};

    const assignedAcademicSectionIds = normalizeIds(
      body?.assignedAcademicSections ??
        body?.assignedAcademicSectionIds ??
        body?.academicSectionIds,
    );

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
        (sum: number, question: { marks?: number }) =>
          sum + (question?.marks ?? 0),
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

      for (const [questionIndex, question] of section.questions.entries()) {
        if (!question?.question || typeof question?.marks !== "number") {
          return NextResponse.json(
            {
              success: false,
              message: `Invalid question data in section "${section.name}" at index ${questionIndex}.`,
            },
            { status: 400 },
          );
        }
      }
    }

    const assignmentValidation = await validateAssignedAcademicSections(
      AcademicSectionModel,
      classId,
      assignedAcademicSectionIds,
    );
    if (!assignmentValidation.ok) {
      return assignmentValidation.response;
    }

    const paper = await QPModel.create({
      title,
      instructions,
      class: classId,
      subject,
      duration,
      passingMarks,
      examDate,
      totalMarks,
      sections,
      assignedAcademicSections: assignmentValidation.ids,
    });

    return NextResponse.json({ success: true, paper }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error." },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  await connectDB();

  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  }

  try {
    const {
      QuestionPaper: QPModel,
      Class: ClassModel,
      AcademicSection: AcademicSectionModel,
    } = await getTenantModels(schoolKey, [
      "QuestionPaper",
      "Class",
      "AcademicSection",
    ]);

    const papers = await QPModel.find(buildArchiveFilter(resolveIncludeArchived(req.nextUrl)))
      .select(
        "title class totalMarks sections assignedAcademicSections createdAt updatedAt",
      )
      .populate({ path: "class", model: ClassModel, select: "name" })
      .populate({
        path: "assignedAcademicSections",
        model: AcademicSectionModel,
        select: "name class",
        populate: { path: "class", model: ClassModel, select: "name" },
      })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, papers });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error." },
      { status: 500 },
    );
  }
}
