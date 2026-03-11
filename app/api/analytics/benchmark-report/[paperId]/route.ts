export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  hydrateResponsesWithStudents,
  hydrateUsersWithAcademicContext,
  toIdString,
} from "@/lib/analytics/hydrateResponses";
import {
  buildBenchmarkReport,
  parseBenchmarkTagFilters,
} from "@/lib/analytics/benchmarkReport";
import {
  objectIdSchema,
  parseOr400,
  schoolKeySchema,
} from "@/lib/validation";
import "@/models/User";
import "@/models/Class";
import "@/models/Subject";
import "@/models/AcademicSection";
import "@/models/Question";
import "@/models/QuestionPaper";
import "@/models/QuestionPaperResponse";
import "@/models/Tag";
import "@/models/TagType";

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

export async function GET(
  req: NextRequest,
  { params }: { params: { paperId: string } },
) {
  const schoolKey = resolveSchoolKey(req);
  const parsedSchool = parseOr400(z.object({ schoolKey: schoolKeySchema }), {
    schoolKey,
  });
  if (!parsedSchool.ok) {
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  }

  const groupByParam = req.nextUrl.searchParams.get("groupBy");
  const groupBy = groupByParam
    ? groupByParam
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
  const rawAcademicSectionId =
    req.nextUrl.searchParams.get("academicSectionId")?.trim() || "";
  if (
    rawAcademicSectionId &&
    !mongoose.Types.ObjectId.isValid(rawAcademicSectionId)
  ) {
    return NextResponse.json(
      { success: false, message: "Invalid academicSectionId" },
      { status: 400 },
    );
  }

  const baselineMode =
    req.nextUrl.searchParams.get("baseline")?.trim() || "class_average";
  if (baselineMode !== "class_average") {
    return NextResponse.json(
      { success: false, message: "Only baseline=class_average is supported." },
      { status: 400 },
    );
  }

  const parsedQuery = parseOr400(
    z.object({
      paperId: objectIdSchema,
      academicSectionId: objectIdSchema.optional(),
      groupBy: z.array(z.string()).max(5).optional(),
      baseline: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
    {
      paperId: params.paperId,
      academicSectionId: rawAcademicSectionId || undefined,
      groupBy,
      baseline: baselineMode,
      tags: req.nextUrl.searchParams.getAll("tag"),
    },
  );
  void parsedQuery;

  try {
    await connectDB();

    const {
      QuestionPaper: QuestionPaperModel,
      QuestionPaperResponse: QPRModel,
      User: UserModel,
      AcademicSection: AcademicSectionModel,
      Class: ClassModel,
      Subject: SubjectModel,
    } = await getTenantModels(schoolKey, [
      "QuestionPaper",
      "QuestionPaperResponse",
      "Question",
      "Tag",
      "TagType",
      "User",
      "AcademicSection",
      "Class",
      "Subject",
    ]);

    const paper = await QuestionPaperModel.findById(params.paperId)
      .populate({ path: "class", model: ClassModel, select: "name" })
      .populate({ path: "subject", model: SubjectModel, select: "name" })
      .populate({
        path: "sections.questions.question",
        select: "tags content answerIndexes options subject class type",
        populate: [
          {
            path: "tags",
            populate: { path: "type", select: "name" },
          },
          { path: "subject", model: SubjectModel, select: "name" },
          { path: "class", model: ClassModel, select: "name" },
        ],
      })
      .populate({
        path: "assignedAcademicSections",
        model: AcademicSectionModel,
        select: "name class",
        populate: { path: "class", model: ClassModel, select: "name" },
      })
      .lean();

    if (!paper || (Array.isArray(paper) && paper.length === 0)) {
      return NextResponse.json(
        { success: false, message: "Paper not found" },
        { status: 404 },
      );
    }

    const paperObj: any = Array.isArray(paper) ? paper[0] : paper;
    const paperClassId = toIdString(paperObj?.class);
    const assignedAcademicSectionIds = Array.isArray(paperObj?.assignedAcademicSections)
      ? paperObj.assignedAcademicSections
          .map((section: any) => toIdString(section))
          .filter(Boolean)
      : [];
    let selectedSectionDoc: any = null;

    if (rawAcademicSectionId) {
      selectedSectionDoc = await AcademicSectionModel.findById(rawAcademicSectionId)
        .select("name class")
        .populate({ path: "class", model: ClassModel, select: "name" })
        .lean();
      if (!selectedSectionDoc) {
        return NextResponse.json(
          { success: false, message: "Academic section not found" },
          { status: 404 },
        );
      }
      if (paperClassId && toIdString(selectedSectionDoc?.class) !== paperClassId) {
        return NextResponse.json(
          {
            success: false,
            message: "Selected academic section does not belong to this paper's class.",
          },
          { status: 400 },
        );
      }
      if (
        assignedAcademicSectionIds.length > 0 &&
        !assignedAcademicSectionIds.includes(rawAcademicSectionId)
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Selected academic section is not assigned to this paper.",
          },
          { status: 400 },
        );
      }
      if (
        !assignedAcademicSectionIds.includes(rawAcademicSectionId) &&
        (!Array.isArray(paperObj?.assignedAcademicSections) ||
          !paperObj.assignedAcademicSections.some(
            (section: any) => toIdString(section) === rawAcademicSectionId,
          ))
      ) {
        paperObj.assignedAcademicSections = [
          ...(Array.isArray(paperObj?.assignedAcademicSections)
            ? paperObj.assignedAcademicSections
            : []),
          selectedSectionDoc,
        ];
      }
    }

    const eligibleStudentQuery: Record<string, any> = { role: "student" };
    if (assignedAcademicSectionIds.length > 0) {
      eligibleStudentQuery.academicSection = {
        $in: assignedAcademicSectionIds.map(
          (id: string) => new mongoose.Types.ObjectId(id),
        ),
      };
    } else if (paperClassId) {
      eligibleStudentQuery.class = new mongoose.Types.ObjectId(paperClassId);
    }

    const rawEligibleStudents = await UserModel.find(eligibleStudentQuery)
      .select("name rollNumber class academicSection")
      .lean();
    const eligibleStudents = await hydrateUsersWithAcademicContext({
      users: rawEligibleStudents,
      AcademicSectionModel,
      ClassModel,
    });

    const eligibleStudentIdSet = new Set(
      eligibleStudents.map((student: any) => toIdString(student)),
    );

    const rawResponses = await QPRModel.find({ paper: params.paperId })
      .select("paper student startedAt submittedAt totalMarksAwarded sectionAnswers")
      .lean();
    const hydratedResponses = await hydrateResponsesWithStudents({
      responses: rawResponses,
      UserModel,
      AcademicSectionModel,
      ClassModel,
      studentSelect: "name rollNumber class academicSection",
    });
    const scopedResponses = hydratedResponses.filter((response: any) =>
      eligibleStudentIdSet.has(toIdString(response?.student)),
    );

    const tagFilters = parseBenchmarkTagFilters(
      req.nextUrl.searchParams.getAll("tag"),
    );

    const report = buildBenchmarkReport({
      paper: paperObj,
      eligibleStudents,
      responses: scopedResponses,
      groupBy,
      tagFilters,
      selectedAcademicSectionId: rawAcademicSectionId || undefined,
    });

    return NextResponse.json({
      success: true,
      baseline: report.baseline,
      baselineMode: report.baselineMode,
      cohorts: report.cohorts,
      tagBenchmarks: report.tagBenchmarks,
      distractorBenchmarks: report.distractorBenchmarks,
      questionBenchmarks: report.questionBenchmarks,
      rosterMetrics: report.rosterMetrics,
      insights: report.insights,
      questionScope: report.questionScope,
      paper: {
        _id: toIdString(paperObj),
        title: String(paperObj?.title || ""),
        classId: paperClassId || undefined,
        className: String(paperObj?.class?.name || ""),
        subjectId: toIdString(paperObj?.subject) || undefined,
        subjectName: String(paperObj?.subject?.name || ""),
        totalMarks: Number(paperObj?.totalMarks || 0),
        passingMarks: Number(paperObj?.passingMarks || 0),
        duration: Number(paperObj?.duration || 0),
      },
      filters: {
        academicSections: report.rosterMetrics.academicSections,
      },
    });
  } catch (error: any) {
    console.error("Error in benchmark report route:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Server error" },
      { status: 500 },
    );
  }
}
