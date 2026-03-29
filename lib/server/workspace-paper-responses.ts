import mongoose from "mongoose";

import { hydrateResponsesWithStudents } from "@/lib/analytics/hydrateResponses";
import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { syncExamRuntimeMongoProjectionsForPaper } from "@/lib/exam-runtime";

export type WorkspacePaperResponseSection = {
  id: string;
  name: string;
};

export type WorkspacePaperResponseItem = {
  _id: string;
  submittedAt?: string;
  totalMarksAwarded?: number;
  student?: {
    name?: string;
    rollNumber?: string;
    academicSection?: {
      _id?: string;
      name?: string;
    } | null;
  } | null;
};

export type WorkspacePaperResponsesSummaryData = {
  responses: WorkspacePaperResponseItem[];
  academicSections: WorkspacePaperResponseSection[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

function normalizeDateString(value: unknown) {
  if (!value) return undefined;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

function normalizeAcademicSections(value: unknown): WorkspacePaperResponseSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((section: any) => ({
      id: normalizeId(section?.id || section?._id),
      name: String(section?.name || "").trim(),
    }))
    .filter((section) => Boolean(section.id));
}

function normalizeResponseItem(value: any): WorkspacePaperResponseItem {
  return {
    _id: normalizeId(value?._id),
    submittedAt: normalizeDateString(value?.submittedAt),
    totalMarksAwarded:
      typeof value?.totalMarksAwarded === "number" &&
      Number.isFinite(value.totalMarksAwarded)
        ? Number(value.totalMarksAwarded)
        : undefined,
    student: value?.student
      ? {
          name: String(value.student?.name || "").trim() || undefined,
          rollNumber: String(value.student?.rollNumber || "").trim() || undefined,
          academicSection: value.student?.academicSection
            ? {
                _id: normalizeId(value.student.academicSection?._id),
                name:
                  String(value.student.academicSection?.name || "").trim() ||
                  undefined,
              }
            : null,
        }
      : null,
  };
}

export async function getWorkspacePaperResponsesSummary({
  schoolKey,
  paperId,
  academicSectionId,
  page = 1,
  limit = 40,
}: {
  schoolKey: string;
  paperId: string;
  academicSectionId?: string;
  page?: number;
  limit?: number;
}): Promise<WorkspacePaperResponsesSummaryData> {
  if (!mongoose.Types.ObjectId.isValid(paperId)) {
    throw new Error("Invalid question paper ID.");
  }

  const resolvedAcademicSectionId = String(academicSectionId || "").trim();
  if (
    resolvedAcademicSectionId &&
    !mongoose.Types.ObjectId.isValid(resolvedAcademicSectionId)
  ) {
    throw new Error("Invalid academicSectionId.");
  }

  const resolvedLimit = Math.min(
    100,
    Math.max(Number.isFinite(limit) ? Math.floor(limit) : 40, 1),
  );
  const requestedPage = Math.max(
    1,
    Number.isFinite(page) ? Math.floor(page) : 1,
  );

  await connectDB();
  const {
    QuestionPaperResponse: QuestionPaperResponseModel,
    QuestionPaper: QuestionPaperModel,
    User: UserModel,
    AcademicSection: AcademicSectionModel,
    Class: ClassModel,
  } = await getTenantModels(schoolKey, [
    "QuestionPaperResponse",
    "QuestionPaper",
    "User",
    "AcademicSection",
    "Class",
  ]);

  const paper = await QuestionPaperModel.findById(paperId)
    .select("class assignedAcademicSections")
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      select: "name class",
    })
    .lean();

  if (!paper) {
    throw new Error("Question paper not found.");
  }

  await syncExamRuntimeMongoProjectionsForPaper(
    schoolKey,
    String(paperId || ""),
  ).catch((error) => {
    console.error(
      "Failed to sync exam runtime attempts into Mongo projections for question paper responses:",
      error,
    );
    return new Map<string, string>();
  });

  const resolvedAcademicSections = normalizeAcademicSections(
    Array.isArray((paper as any).assignedAcademicSections)
      ? (paper as any).assignedAcademicSections.map((section: any) => ({
          id: section?._id,
          name: section?.name,
        }))
      : [],
  );

  const academicSections =
    resolvedAcademicSections.length > 0
      ? resolvedAcademicSections
      : (paper as any).class
        ? await AcademicSectionModel.find({
            class: (paper as any).class,
            isActive: true,
            ...buildArchiveFilter(false),
          })
            .select("name")
            .sort({ name: 1 })
            .lean()
            .then((sections: any[]) =>
              normalizeAcademicSections(
                sections.map((section) => ({
                  id: section?._id,
                  name: section?.name,
                })),
              ),
            )
        : [];

  let filteredStudentIds: mongoose.Types.ObjectId[] | null = null;
  if (resolvedAcademicSectionId) {
    const studentsInSection = await UserModel.find({
      role: "student",
      academicSection: new mongoose.Types.ObjectId(resolvedAcademicSectionId),
    })
      .select("_id")
      .lean();
    filteredStudentIds = studentsInSection.map(
      (student: any) => student._id as mongoose.Types.ObjectId,
    );
  }

  const responseQuery: Record<string, unknown> = { paper: paperId };
  if (filteredStudentIds) {
    responseQuery.student = { $in: filteredStudentIds };
  }

  const totalCount = await QuestionPaperResponseModel.countDocuments(responseQuery);
  const pages = Math.max(1, Math.ceil(totalCount / resolvedLimit));
  const safePage = Math.min(requestedPage, pages);
  const skip = (safePage - 1) * resolvedLimit;

  const responses = await QuestionPaperResponseModel.find(responseQuery)
    .select("student submittedAt totalMarksAwarded createdAt")
    .sort({ submittedAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(resolvedLimit)
    .lean();

  const hydratedResponses = await hydrateResponsesWithStudents({
    responses,
    UserModel,
    AcademicSectionModel,
    ClassModel,
    studentSelect: "name rollNumber academicSection",
  });

  return {
    responses: Array.isArray(hydratedResponses)
      ? hydratedResponses.map(normalizeResponseItem)
      : [],
    total: Math.max(0, Number(totalCount) || 0),
    page: safePage,
    pages,
    limit: resolvedLimit,
    academicSections,
  };
}
