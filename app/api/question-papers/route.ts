export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { buildArchiveFilter, resolveIncludeArchived } from "@/lib/archive";
import { requireTenantSession } from "@/lib/api-auth";
import { recordTenantAudit } from "@/lib/audit";
import {
  disableExamPaperSnapshotsForPaperId,
  syncExamPaperSnapshotForPaperId,
} from "@/lib/exam-runtime";
import { isOnlineQuestionType } from "@/lib/question-paper/grading";
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

function normalizeDate(value: unknown) {
  if (!value) return undefined;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function validateQuestionSelection(
  QuestionModel: any,
  sections: any[],
  onlineEnabled: boolean,
) {
  const questionIds = Array.from(
    new Set(
      (Array.isArray(sections) ? sections : []).flatMap((section: any) =>
        (Array.isArray(section?.questions) ? section.questions : []).map(
          (question: any) => String(question?.question || "").trim(),
        ),
      ),
    ),
  ).filter(Boolean);

  const questions = await QuestionModel.find({
    _id: { $in: questionIds },
    ...buildArchiveFilter(false),
  })
    .select("_id type")
    .lean();

  if (questions.length !== questionIds.length) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "One or more selected questions could not be found.",
        },
        { status: 400 },
      ),
    } as const;
  }

  if (onlineEnabled) {
    const unsupportedQuestion = questions.find(
      (question: any) => !isOnlineQuestionType(question?.type),
    );

    if (unsupportedQuestion) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            message:
              "This paper contains a question type that is not supported for online delivery.",
          },
          { status: 400 },
        ),
      } as const;
    }
  }

  return { ok: true } as const;
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
  const schoolKey = auth.schoolKey as string;
  const actorId = auth.session.user.id;

  try {
    const {
      QuestionPaper: QPModel,
      AcademicSection: AcademicSectionModel,
      Question: QuestionModel,
    } = await getTenantModels(schoolKey, [
      "QuestionPaper",
      "AcademicSection",
      "Question",
    ]);

    const body = await req.json();
    const {
      title,
      instructions,
      class: classId,
      subject,
      duration,
      passingMarks,
      examDate,
      onlineEnabled: rawOnlineEnabled,
      onlineStartsAt: rawOnlineStartsAt,
      onlineEndsAt: rawOnlineEndsAt,
      totalMarks,
      sections,
    } = body || {};
    const onlineEnabled = Boolean(rawOnlineEnabled);
    const onlineStartsAt = normalizeDate(rawOnlineStartsAt);
    const onlineEndsAt = normalizeDate(rawOnlineEndsAt);
    const effectiveOnlineStart = onlineStartsAt || normalizeDate(examDate);

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
    if (
      onlineEnabled &&
      effectiveOnlineStart &&
      onlineEndsAt &&
      onlineEndsAt.getTime() <= effectiveOnlineStart.getTime()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Online end time must be after the online start time.",
        },
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

    const questionValidation = await validateQuestionSelection(
      QuestionModel,
      sections,
      onlineEnabled,
    );
    if (!questionValidation.ok) {
      return questionValidation.response;
    }

    const paper = await QPModel.create({
      title,
      instructions,
      class: classId,
      subject,
      duration,
      passingMarks,
      examDate,
      onlineEnabled,
      onlineStartsAt,
      onlineEndsAt,
      totalMarks,
      sections,
      assignedAcademicSections: assignmentValidation.ids,
      createdBy: actorId,
    });

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: "question_paper",
      entityId: String(paper._id),
      entityLabel: String(paper.title || title),
      action: "created",
      summary: `Created question paper ${title}.`,
      details: { paperId: String(paper._id) },
    });

    if (onlineEnabled) {
      await syncExamPaperSnapshotForPaperId(
        schoolKey,
        String(paper._id),
      ).catch((error) => {
        console.error("Failed to sync exam paper snapshot after create:", error);
      });
    } else {
      await disableExamPaperSnapshotsForPaperId(
        schoolKey,
        String(paper._id),
      ).catch(() => undefined);
    }

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
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) return auth.response;
  const schoolKey = auth.schoolKey as string;

  try {
    const {
      QuestionPaper: QPModel,
      Class: ClassModel,
      Subject: SubjectModel,
      AcademicSection: AcademicSectionModel,
    } = await getTenantModels(schoolKey, [
      "QuestionPaper",
      "Class",
      "Subject",
      "AcademicSection",
    ]);

    const archiveFilter = buildArchiveFilter(resolveIncludeArchived(req.nextUrl));
    const pageParam = Number(req.nextUrl.searchParams.get("page") || "");
    const limitParam = Number(req.nextUrl.searchParams.get("limit") || "");
    const summaryMode = req.nextUrl.searchParams.get("summary") === "1";

    let total: number | undefined;
    let page: number | undefined;
    let pages: number | undefined;
    let limit: number | undefined;

    let cursor = QPModel.find(archiveFilter)
      .select(
        summaryMode
          ? "title class subject totalMarks sections.questions assignedAcademicSections duration examDate onlineEnabled onlineStartsAt onlineEndsAt createdAt updatedAt"
          : "title class subject totalMarks sections assignedAcademicSections duration examDate onlineEnabled onlineStartsAt onlineEndsAt createdAt updatedAt",
      )
      .populate({ path: "class", model: ClassModel, select: "name" })
      .populate({ path: "subject", model: SubjectModel, select: "name" })
      .populate({
        path: "assignedAcademicSections",
        model: AcademicSectionModel,
        select: "name class",
        populate: { path: "class", model: ClassModel, select: "name" },
      })
      .sort({ createdAt: -1 })
      .lean();

    if (pageParam && limitParam) {
      const totalCount = await QPModel.countDocuments(archiveFilter);
      total = totalCount;
      page = Math.max(1, pageParam);
      limit = Math.min(100, Math.max(1, limitParam));
      pages = Math.max(1, Math.ceil(totalCount / limit));
      const skip = (page - 1) * limit;
      cursor = cursor.skip(skip).limit(limit);
    }

    const rawPapers = await cursor;
    const papers = summaryMode
      ? rawPapers.map((paper: any) => {
          const questionCount = Array.isArray(paper?.sections)
            ? paper.sections.reduce(
                (total: number, section: any) =>
                  total +
                  (Array.isArray(section?.questions) ? section.questions.length : 0),
                0,
              )
            : 0;
          const { sections, ...paperSummary } = paper;

          return {
            ...paperSummary,
            questionCount,
          };
        })
      : rawPapers;

    return NextResponse.json({ success: true, papers, total, page, pages, limit });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error." },
      { status: 500 },
    );
  }
}
