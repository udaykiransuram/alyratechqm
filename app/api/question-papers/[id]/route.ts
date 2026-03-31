export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  buildArchiveFilter,
  buildArchivedUpdate,
  resolveIncludeArchived,
} from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";
import { requireTenantSession } from "@/lib/api-auth";
import {
  disableExamPaperSnapshotsForPaperId,
  syncExamPaperSnapshotForPaperId,
} from "@/lib/exam-runtime";
import { invalidateStudentTestResourceCache } from "@/lib/student-test-server";
import {
  buildStoredPaperSubjectFields,
  derivePaperSubjectIdsFromQuestions,
  serializePaperSubjects,
} from "@/lib/question-paper/subjects";
import {
  calculateSectionTotalMarks,
  deriveSectionDefaultMarks,
  deriveSectionDefaultNegativeMarks,
} from "@/lib/question-paper/sections";
import { isOnlineQuestionType } from "@/lib/question-paper/grading";
import { resolveTeacherPaperScope } from "@/lib/question-paper/access";

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

function toIdString(value: unknown) {
  if (!value) return "";
  if (typeof value === "object" && value !== null && "_id" in (value as any)) {
    return String((value as any)._id || "").trim();
  }
  return String(value || "").trim();
}

function normalizeSectionsPayload(sections: any[]) {
  return (Array.isArray(sections) ? sections : []).map((section: any) => {
    const normalizedQuestions = (
      Array.isArray(section?.questions) ? section.questions : []
    ).map((question: any) => ({
      question: toIdString(question?.question),
      marks: Number(question?.marks || 0),
      negativeMarks: Number(question?.negativeMarks || 0),
    }));

    return {
      name: String(section?.name || "").trim(),
      description: String(section?.description || ""),
      instructions: String(section?.instructions || ""),
      defaultMarks: deriveSectionDefaultMarks({
        ...section,
        questions: normalizedQuestions,
      }),
      defaultNegativeMarks: deriveSectionDefaultNegativeMarks({
        ...section,
        questions: normalizedQuestions,
      }),
      marks: calculateSectionTotalMarks({ questions: normalizedQuestions }),
      questions: normalizedQuestions,
    };
  });
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
    .select("_id type subject")
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

  return {
    ok: true,
    subjectIds: derivePaperSubjectIdsFromQuestions(questions),
  } as const;
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
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) return auth.response;
  const schoolKey = auth.schoolKey as string;
  const { id } = await params;

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

    const paper = await QPModel.findOne({
      _id: id,
      ...buildArchiveFilter(resolveIncludeArchived(req.nextUrl)),
    })
      .populate({ path: "class", model: ClassModel })
      .populate({ path: "subject", model: SubjectModel })
      .populate({ path: "subjectIds", model: SubjectModel, select: "name" })
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
      select: "subject class tags content answerIndexes options type matrixOptions matrixAnswers",
      populate: [
        {
          path: "tags",
          model: Tag,
          populate: { path: "type", model: TagType, select: "name" },
        },
        { path: "subject", model: SubjectModel, select: "name" },
        { path: "class", model: ClassModel, select: "name" },
      ],
    });

    const paperObject = paper?.toObject?.() ?? paper;

    return NextResponse.json(
      {
        success: true,
        paper: {
          ...paperObject,
          ...serializePaperSubjects(paperObject),
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error." },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) return auth.response;
  const schoolKey = auth.schoolKey as string;
  const { id } = await params;

  try {
    const {
      QuestionPaper: QPModel,
      AcademicSection: AcademicSectionModel,
      Question: QuestionModel,
      User: UserModel,
    } = await getTenantModels(schoolKey, [
      "QuestionPaper",
      "AcademicSection",
      "Question",
      "User",
    ]);
    const existingPaper = await QPModel.findOne({
      _id: id,
      ...buildArchiveFilter(false),
    })
      .select("class")
      .lean();

    const data = await req.json();
    const {
      title,
      instructions,
      class: classId,
      duration,
      passingMarks,
      examDate,
      onlineEnabled: rawOnlineEnabled,
      onlineStartsAt: rawOnlineStartsAt,
      onlineEndsAt: rawOnlineEndsAt,
      sections,
    } = data || {};
    const normalizedSections = normalizeSectionsPayload(sections);
    const normalizedTotalMarks = normalizedSections.reduce(
      (sum, section) => sum + section.marks,
      0,
    );
    const onlineEnabled = Boolean(rawOnlineEnabled);
    const onlineStartsAt = normalizeDate(rawOnlineStartsAt);
    const onlineEndsAt = normalizeDate(rawOnlineEndsAt);
    const effectiveOnlineStart = onlineStartsAt || normalizeDate(examDate);

    const assignedAcademicSectionIds = normalizeIds(
      data?.assignedAcademicSections ??
        data?.assignedAcademicSectionIds ??
        data?.academicSectionIds,
    );

    if (
      !title ||
      !classId ||
      normalizedSections.length === 0 ||
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

    for (const section of normalizedSections) {
      if (
        !section?.name ||
        typeof section?.defaultMarks !== "number" ||
        section.defaultMarks <= 0 ||
        typeof section?.defaultNegativeMarks !== "number" ||
        section.defaultNegativeMarks < 0 ||
        !Array.isArray(section?.questions)
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid section data." },
          { status: 400 },
        );
      }

      if (section.questions.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Section "${section.name}" must include at least one question.`,
          },
          { status: 400 },
        );
      }

      for (const [questionIndex, question] of section.questions.entries()) {
        if (
          !question?.question ||
          typeof question?.marks !== "number" ||
          Number.isNaN(question.marks) ||
          question.marks < 0 ||
          typeof question?.negativeMarks !== "number" ||
          Number.isNaN(question.negativeMarks) ||
          question.negativeMarks < 0
        ) {
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
        normalizedSections,
        onlineEnabled,
      );
    if (!questionValidation.ok) {
      return questionValidation.response;
    }

    const subjectFields = buildStoredPaperSubjectFields(
      questionValidation.subjectIds,
    );

    if (auth.session.user.role === "teacher") {
      const scopedUser = await UserModel.findById(auth.session.user.id)
        .select(
          "hasAllClasses classIds hasAllSubjects subjectIds hasAllSections academicSectionIds",
        )
        .lean();

      const teacherScope = resolveTeacherPaperScope(
        scopedUser,
        toIdString(classId),
        subjectFields.subjectIds,
        assignmentValidation.ids,
      );

      if (
        !teacherScope.hasClassAccess ||
        !teacherScope.hasSubjectAccess ||
        !teacherScope.hasSectionAccess
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "You can only update papers inside your assigned class, subject, and section scope.",
          },
          { status: 403 },
        );
      }

      if (
        teacherScope.allowedSectionIds !== null &&
        assignmentValidation.ids.length === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Teachers with section-scoped access must assign at least one section to a question paper.",
          },
          { status: 400 },
        );
      }

      if (teacherScope.allowedSectionIds !== null) {
        const outOfScopeSections = assignmentValidation.ids.filter(
          (sectionId) => !teacherScope.allowedSectionIds!.includes(sectionId),
        );
        if (outOfScopeSections.length > 0) {
          return NextResponse.json(
            {
              success: false,
              message:
                "One or more assigned sections are outside your access scope.",
            },
            { status: 403 },
          );
        }
      }

      if (!Boolean(scopedUser?.hasAllSubjects)) {
        const scopedSubjectIds = Array.isArray(scopedUser?.subjectIds)
          ? scopedUser.subjectIds.map((subjectId: any) => toIdString(subjectId))
          : [];
        const outOfScopeSubjects = subjectFields.subjectIds.filter(
          (subjectId) => !scopedSubjectIds.includes(subjectId),
        );
        if (outOfScopeSubjects.length > 0) {
          return NextResponse.json(
            {
              success: false,
              message:
                "One or more question subjects are outside your access scope.",
            },
            { status: 403 },
          );
        }
      }
    }

    const updated = await QPModel.findOneAndUpdate(
      { _id: id, ...buildArchiveFilter(false) },
      {
        title,
        instructions: String(instructions || ""),
        class: classId,
        duration,
        passingMarks,
        examDate,
        ...subjectFields,
        onlineEnabled,
        onlineStartsAt,
        onlineEndsAt,
        totalMarks: normalizedTotalMarks,
        sections: normalizedSections,
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

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: "question_paper",
      entityId: String(updated._id),
      entityLabel: String(updated.title || title),
      action: "updated",
      summary: `Updated question paper ${updated.title || title}.`,
      details: { paperId: String(updated._id) },
    });

    if (onlineEnabled) {
      await syncExamPaperSnapshotForPaperId(
        schoolKey,
        String(updated._id),
      ).catch((error) => {
        console.error("Failed to sync exam paper snapshot after update:", error);
      });
    } else {
      await disableExamPaperSnapshotsForPaperId(
        schoolKey,
        String(updated._id),
      ).catch(() => undefined);
    }

    const previousClassId = toIdString(existingPaper?.class);
    const nextClassId = toIdString((updated?.toObject?.() ?? updated)?.class);
    invalidateStudentTestResourceCache({
      schoolKey,
      paperId: String(updated._id),
      classId: nextClassId || previousClassId || undefined,
    });
    if (
      previousClassId &&
      nextClassId &&
      previousClassId !== nextClassId
    ) {
      invalidateStudentTestResourceCache({
        schoolKey,
        classId: previousClassId,
      });
    }

    const updatedObject = updated?.toObject?.() ?? updated;

    return NextResponse.json({
      success: true,
      paper: {
        ...updatedObject,
        ...serializePaperSubjects(updatedObject),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const auth = await requireTenantSession(req, { allowRoles: ["admin"] });
  if (!auth.ok) return auth.response;
  const schoolKey = auth.schoolKey as string;
  const { id } = await params;

  const { QuestionPaper: QPModel } = await getTenantModels(schoolKey, [
    "QuestionPaper",
  ]);

  try {
    const archived = await QPModel.findOneAndUpdate(
      { _id: id, ...buildArchiveFilter(false) },
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
      entityType: "question_paper",
      entityId: String(archived._id),
      entityLabel: String(archived.title || ""),
      action: "archived",
      summary: `Archived question paper ${archived.title}.`,
      details: { paperId: String(archived._id) },
    });

    await disableExamPaperSnapshotsForPaperId(
      schoolKey,
      String(archived._id),
    ).catch(() => undefined);

    invalidateStudentTestResourceCache({
      schoolKey,
      paperId: String(archived._id),
      classId: toIdString((archived?.toObject?.() ?? archived)?.class),
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
