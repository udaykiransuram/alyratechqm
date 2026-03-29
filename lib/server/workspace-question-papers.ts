import mongoose from "mongoose";

import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { serializePaperSubjects } from "@/lib/question-paper/subjects";

type WorkspaceQuestionPapersListOptions = {
  schoolKey: string;
  includeArchived?: boolean;
  summary?: boolean;
  page?: number | null;
  limit?: number | null;
  classId?: string | null;
  sectionId?: string | null;
  search?: string | null;
};

type WorkspaceQuestionPaperSupportData = {
  classes: Array<{ _id: string; name: string }>;
  academicSections: Array<{
    _id: string;
    name: string;
    class: {
      _id: string;
      name: string;
    } | null;
  }>;
};

type WorkspaceQuestionPapersListResult = {
  papers: any[];
  total?: number;
  page?: number;
  pages?: number;
  limit?: number;
  resolvedClassId: string;
  resolvedSectionId: string;
};

const QUESTION_PAPER_SUPPORT_CACHE_TTL_MS = 60_000;

type SupportDataCacheEntry = {
  expiresAt: number;
  data: WorkspaceQuestionPaperSupportData;
};

function cloneForTransport<T>(value: T): T {
  if (typeof value === "undefined") {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function getQuestionPaperSupportDataCache() {
  const globalState = global as typeof globalThis & {
    __workspaceQuestionPaperSupportDataCache?: Map<string, SupportDataCacheEntry>;
  };

  if (!globalState.__workspaceQuestionPaperSupportDataCache) {
    globalState.__workspaceQuestionPaperSupportDataCache = new Map();
  }

  return globalState.__workspaceQuestionPaperSupportDataCache;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeObjectId(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized || !mongoose.Types.ObjectId.isValid(normalized)) {
    return "";
  }
  return normalized;
}

function normalizeForTransport<T>(value: T): T {
  if (value === null || typeof value === "undefined") {
    return value as T;
  }

  if (value instanceof Date) {
    return value.toISOString() as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForTransport(entry)) as T;
  }

  if (typeof value === "object") {
    const maybeObjectId = value as {
      _bsontype?: string;
      constructor?: { name?: string };
      toHexString?: () => string;
      toJSON?: () => unknown;
      toString?: () => string;
    };

    if (typeof maybeObjectId.toHexString === "function") {
      return maybeObjectId.toHexString() as T;
    }

    if (typeof maybeObjectId.toJSON === "function") {
      const serializedValue = maybeObjectId.toJSON();
      if (serializedValue !== value) {
        return normalizeForTransport(serializedValue as T);
      }
    }

    if (
      maybeObjectId &&
      (maybeObjectId._bsontype === "ObjectId" ||
        maybeObjectId._bsontype === "ObjectID" ||
        maybeObjectId.constructor?.name === "ObjectId" ||
        maybeObjectId.constructor?.name === "ObjectID") &&
      typeof maybeObjectId.toString === "function"
    ) {
      return maybeObjectId.toString() as T;
    }

    const normalized: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      normalized[key] = normalizeForTransport(entry);
    });
    return normalized as T;
  }

  return value;
}

function resolveListPage(value: number | null | undefined) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue) || numericValue < 1) {
    return null;
  }
  return Math.floor(numericValue);
}

function resolveListLimit(value: number | null | undefined) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue) || numericValue < 1) {
    return null;
  }
  return Math.min(100, Math.max(1, Math.floor(numericValue)));
}

async function resolveSectionContext({
  AcademicSectionModel,
  sectionId,
  includeArchived,
}: {
  AcademicSectionModel: any;
  sectionId: string;
  includeArchived: boolean;
}) {
  if (!sectionId) {
    return { sectionId: "", classId: "" };
  }

  const section = await AcademicSectionModel.findOne({
    _id: sectionId,
    ...buildArchiveFilter(includeArchived),
  })
    .select("_id class")
    .lean();

  if (!section?._id) {
    return { sectionId: "", classId: "" };
  }

  return {
    sectionId: String(section._id),
    classId: String(section.class || ""),
  };
}

function buildQuestionPapersQuery({
  includeArchived,
  classId,
  sectionId,
  sectionClassId,
  search,
}: {
  includeArchived: boolean;
  classId: string;
  sectionId: string;
  sectionClassId: string;
  search: string;
}) {
  const query: Record<string, unknown> = {
    ...buildArchiveFilter(includeArchived),
  };

  if (classId) {
    query.class = classId;
  }

  if (search) {
    query.title = {
      $regex: escapeRegExp(search),
      $options: "i",
    };
  }

  if (!sectionId) {
    return query;
  }

  if (sectionClassId) {
    query.class = sectionClassId;
  }

  query.$or = [
    { assignedAcademicSections: sectionId },
    { assignedAcademicSections: { $exists: false } },
    { assignedAcademicSections: { $size: 0 } },
  ];

  return query;
}

function serializePaperSummary(paper: any) {
  const serializedPaper = {
    ...paper,
    ...serializePaperSubjects(paper),
  };
  const questionCount = Array.isArray(paper?.sections)
    ? paper.sections.reduce(
        (total: number, section: any) =>
          total +
          (Array.isArray(section?.questions) ? section.questions.length : 0),
        0,
      )
    : 0;
  const { sections, ...paperSummary } = serializedPaper;
  const normalizedPaperSummary = normalizeForTransport(paperSummary);

  return {
    ...normalizedPaperSummary,
    questionCount,
  };
}

export async function listWorkspaceQuestionPapers({
  schoolKey,
  includeArchived = false,
  summary = true,
  page,
  limit,
  classId,
  sectionId,
  search,
}: WorkspaceQuestionPapersListOptions): Promise<WorkspaceQuestionPapersListResult> {
  await connectDB();
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

  const normalizedClassId = normalizeObjectId(classId);
  const normalizedSectionId = normalizeObjectId(sectionId);
  const normalizedSearch = String(search || "").trim();

  const sectionContext = await resolveSectionContext({
    AcademicSectionModel,
    sectionId: normalizedSectionId,
    includeArchived,
  });

  if (
    normalizedClassId &&
    sectionContext.classId &&
    sectionContext.classId !== normalizedClassId
  ) {
    return {
      papers: [],
      total: 0,
      page: 1,
      pages: 1,
      limit: resolveListLimit(limit) || undefined,
      resolvedClassId: normalizedClassId,
      resolvedSectionId: "",
    };
  }

  const resolvedClassId = sectionContext.classId || normalizedClassId;
  const resolvedSectionId = sectionContext.sectionId;

  const query = buildQuestionPapersQuery({
    includeArchived,
    classId: resolvedClassId,
    sectionId: resolvedSectionId,
    sectionClassId: sectionContext.classId,
    search: normalizedSearch,
  });

  const requestedPage = resolveListPage(page);
  const requestedLimit = resolveListLimit(limit);

  let total: number | undefined;
  let safePage: number | undefined;
  let totalPages: number | undefined;
  let safeLimit: number | undefined;

  let cursor = QPModel.find(query)
    .select(
      summary
        ? "title class subject subjectIds totalMarks sections.questions.question assignedAcademicSections duration examDate onlineEnabled onlineStartsAt onlineEndsAt createdAt updatedAt"
        : "title class subject subjectIds totalMarks sections assignedAcademicSections duration examDate onlineEnabled onlineStartsAt onlineEndsAt createdAt updatedAt",
    )
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({ path: "subject", model: SubjectModel, select: "name" })
    .populate({ path: "subjectIds", model: SubjectModel, select: "name" })
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      select: "name class",
      populate: { path: "class", model: ClassModel, select: "name" },
    })
    .sort({ createdAt: -1 })
    .lean();

  if (requestedPage && requestedLimit) {
    const totalCount = await QPModel.countDocuments(query);
    total = totalCount;
    safeLimit = requestedLimit;
    totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));
    safePage = Math.min(requestedPage, totalPages);
    cursor = cursor.skip((safePage - 1) * safeLimit).limit(safeLimit);
  }

  const rawPapers = await cursor;
  const papers = summary
    ? rawPapers.map(serializePaperSummary)
    : rawPapers.map((paper: any) =>
        normalizeForTransport({
          ...paper,
          ...serializePaperSubjects(paper),
        }),
      );

  return {
    papers,
    total,
    page: safePage,
    pages: totalPages,
    limit: safeLimit,
    resolvedClassId,
    resolvedSectionId,
  };
}

export async function getWorkspaceQuestionPaperSupportData({
  schoolKey,
}: {
  schoolKey: string;
}): Promise<WorkspaceQuestionPaperSupportData> {
  const shouldUseCache = process.env.NODE_ENV === "production";
  const cache = getQuestionPaperSupportDataCache();
  const cachedEntry = shouldUseCache ? cache.get(schoolKey) : undefined;
  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return cloneForTransport(cachedEntry.data);
  }

  await connectDB();
  const {
    Class: ClassModel,
    AcademicSection: AcademicSectionModel,
  } = await getTenantModels(schoolKey, ["Class", "AcademicSection"]);

  const [classesRaw, sectionsRaw] = await Promise.all([
    ClassModel.find(buildArchiveFilter(false)).select("_id name").sort({ name: 1 }).lean(),
    AcademicSectionModel.find(buildArchiveFilter(false))
      .select("_id name class")
      .sort({ name: 1 })
      .populate({ path: "class", model: ClassModel, select: "name" })
      .lean(),
  ]);

  const classes = classesRaw.map((classItem: any) => ({
    _id: String(classItem?._id || ""),
    name: String(classItem?.name || ""),
  }));

  const academicSections = sectionsRaw.map((section: any) => ({
    _id: String(section?._id || ""),
    name: String(section?.name || ""),
    class: section?.class
      ? {
          _id: String(section.class?._id || section.class || ""),
          name: String(section.class?.name || ""),
        }
      : null,
  }));

  const data = {
    classes,
    academicSections,
  };
  const normalizedData = cloneForTransport(data);

  if (shouldUseCache) {
    cache.set(schoolKey, {
      expiresAt: Date.now() + QUESTION_PAPER_SUPPORT_CACHE_TTL_MS,
      data: normalizedData,
    });
  }

  return normalizedData;
}
