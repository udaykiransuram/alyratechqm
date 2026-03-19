import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { buildArchiveFilter } from "@/lib/archive";
import { requireTenantSession } from "@/lib/api-auth";
import { recordTenantAudit } from "@/lib/audit";

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
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) return auth.response;
  const schoolKey = auth.schoolKey;
  const actorId = auth.session.user.id;

  const {
    QuestionPaper: QPModel,
    AcademicSection: AcademicSectionModel,
  } = await getTenantModels(schoolKey, ["QuestionPaper", "AcademicSection"]);

  try {
    const { papers } = await req.json();

    if (!Array.isArray(papers) || papers.length === 0) {
      return NextResponse.json(
        { success: false, message: "No papers provided." },
        { status: 400 },
      );
    }

    const createdPapers: any[] = [];

    for (const [index, paperData] of papers.entries()) {
      const {
        title,
        instructions,
        classId,
        subjectId,
        totalMarks,
        sections,
        duration,
        passingMarks,
        examDate,
      } = paperData || {};

      const assignedAcademicSectionIds = normalizeIds(
        paperData?.assignedAcademicSections ??
          paperData?.assignedAcademicSectionIds ??
          paperData?.academicSectionIds,
      );

      if (
        !title ||
        !classId ||
        !subjectId ||
        !Array.isArray(sections) ||
        sections.length === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: `Missing required fields in paper #${index + 1}.`,
          },
          { status: 400 },
        );
      }

      for (const section of sections) {
        const sectionMarks =
          typeof section?.marks === "number" ? section.marks : section?.defaultMarks;
        if (
          !section?.name ||
          typeof sectionMarks !== "number" ||
          !Array.isArray(section?.questions)
        ) {
          return NextResponse.json(
            {
              success: false,
              message: `Invalid section data in paper #${index + 1}.`,
            },
            { status: 400 },
          );
        }

        const sectionQuestionMarks = section.questions.reduce(
          (sum: number, question: { marks?: number }) =>
            sum + (question?.marks ?? 0),
          0,
        );

        if (sectionMarks !== sectionQuestionMarks) {
          return NextResponse.json(
            {
              success: false,
              message: `Section "${section.name}" in paper #${index + 1} marks (${sectionMarks}) do not match total question marks (${sectionQuestionMarks}).`,
            },
            { status: 400 },
          );
        }

        for (const [questionIndex, question] of section.questions.entries()) {
          if (!question?.question || typeof question?.marks !== "number") {
            return NextResponse.json(
              {
                success: false,
                message: `Invalid question data in section "${section.name}" at index ${questionIndex} in paper #${index + 1}.`,
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

      const newPaper = await QPModel.create({
        title,
        instructions,
        class: classId,
        subject: subjectId,
        totalMarks,
        sections: sections.map((section: any) => ({
          ...section,
          marks:
            typeof section.marks === "number" ? section.marks : section.defaultMarks,
        })),
        duration,
        passingMarks,
        examDate,
        assignedAcademicSections: assignmentValidation.ids,
        createdBy: actorId,
      });

      await recordTenantAudit({
        schoolKey,
        req,
        entityType: "question_paper",
        entityId: String(newPaper._id),
        entityLabel: String(newPaper.title || title),
        action: "created",
        summary: `Created question paper copy ${newPaper.title || title}.`,
        details: { paperId: String(newPaper._id), source: "copy_multiple" },
      });

      createdPapers.push(newPaper);
    }

    return NextResponse.json({ success: true, papers: createdPapers }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error." },
      { status: 500 },
    );
  }
}
