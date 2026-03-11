export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { buildArchiveFilter, buildArchivedUpdate, resolveIncludeArchived } from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";

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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const {
      QuestionPaper: QPModel,
      Question: QuestionModel,
      Tag,
      TagType,
      Class: ClassModel,
      Subject: SubjectModel,
      AcademicSection: AcademicSectionModel,
    } = await getTenantModels(schoolKey, [
      "QuestionPaper",
      "Question",
      "Tag",
      "TagType",
      "Class",
      "Subject",
      "AcademicSection",
    ]);

    const paper = await QPModel.findOne({ _id: params.id, ...buildArchiveFilter(resolveIncludeArchived(req.nextUrl)) })
      .populate({ path: "class", model: ClassModel })
      .populate({ path: "subject", model: SubjectModel })
      .populate({
        path: "assignedAcademicSections",
        model: AcademicSectionModel,
        populate: { path: "class", model: ClassModel, select: "name" },
      });

    if (!paper) {
      return NextResponse.json(
        { success: false, message: "Paper not found." },
        { status: 404 },
      );
    }

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

    const assignedAcademicSectionIds = normalizeIds(
      data?.assignedAcademicSections ??
        data?.assignedAcademicSectionIds ??
        data?.academicSectionIds,
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

    const updated = await QPModel.findOneAndUpdate(
      { _id: params.id, ...buildArchiveFilter(false) },
      {
        ...data,
        assignedAcademicSections: assignmentValidation.ids,
      },
      { new: true },
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Question paper not found." },
        { status: 404 },
      );
    }

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

  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  }

  const { QuestionPaper: QPModel } =
    await getTenantModels(schoolKey, ["QuestionPaper"]);

  try {
    const archived = await QPModel.findOneAndUpdate(
      { _id: params.id, ...buildArchiveFilter(false) },
      buildArchivedUpdate(),
      { new: true, runValidators: true },
    );
    if (!archived) {
      return NextResponse.json(
        { success: false, message: "Question paper not found." },
        { status: 404 },
      );
    }

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: 'question_paper',
      entityId: String(archived._id),
      entityLabel: String(archived.title || ''),
      action: 'archived',
      summary: `Archived question paper ${archived.title}.`,
      details: { paperId: String(archived._id) },
    });

    return NextResponse.json({
      success: true,
      message: "Question paper archived successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}
