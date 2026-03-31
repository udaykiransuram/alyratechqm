import mongoose from "mongoose";

import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { sanitizeQuestionForApiResponse } from "@/lib/security/html-sanitize";
import {
  getWorkspaceClasses,
  getWorkspaceTags,
} from "@/lib/server/workspace-support-data";

type WorkspaceQuestionsFilterOptions = {
  schoolKey: string;
  page?: number | null;
  limit?: number | null;
  classId?: string | null;
  subjectId?: string | null;
  search?: string | null;
  tagIds?: string[];
  tagsMode?: "and" | "or";
};

type WorkspaceQuestionSupportDataOptions = {
  schoolKey: string;
  classId?: string | null;
};

export type WorkspaceQuestionsListResult = {
  questions: any[];
  total: number;
  page: number;
  pages: number;
  limit: number;
  resolvedClassId: string;
  resolvedSubjectId: string;
  resolvedSearch: string;
  resolvedTagIds: string[];
  resolvedTagsMode: "all" | "any";
};

export type WorkspaceQuestionSupportData = {
  classes: Array<{ _id: string; name: string }>;
  tags: Array<{
    _id: string;
    name: string;
    type?: { _id: string; name: string } | null;
  }>;
  subjects: Array<{ _id: string; name: string }>;
};

function normalizeObjectId(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized || !mongoose.Types.ObjectId.isValid(normalized)) {
    return "";
  }
  return normalized;
}

function resolveListPage(value: number | null | undefined) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue) || numericValue < 1) {
    return 1;
  }
  return Math.floor(numericValue);
}

function resolveListLimit(value: number | null | undefined) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue) || numericValue < 1) {
    return 24;
  }
  return Math.min(100, Math.max(1, Math.floor(numericValue)));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildStableQuestionSort(
  primaryField: string,
  primaryOrder: 1 | -1,
) {
  if (!primaryField || primaryField === "_id") {
    return { _id: primaryOrder };
  }

  return {
    [primaryField]: primaryOrder,
    _id: primaryOrder,
  };
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

function serializeNamedEntity(
  value: unknown,
  fallbackName = "",
): { _id: string; name: string } {
  const normalizedValue = normalizeForTransport(value) as
    | Record<string, unknown>
    | null;

  if (!normalizedValue || Array.isArray(normalizedValue)) {
    return {
      _id: "",
      name: fallbackName,
    };
  }

  return {
    _id: String(normalizedValue._id || ""),
    name: String(normalizedValue.name || fallbackName),
  };
}

function serializeQuestionOption(option: unknown) {
  const normalizedOption = normalizeForTransport(option);
  if (!normalizedOption || typeof normalizedOption !== "object" || Array.isArray(normalizedOption)) {
    return {
      content: String(normalizedOption || ""),
    };
  }

  return {
    ...(normalizedOption as Record<string, unknown>),
    content: String(
      (normalizedOption as Record<string, unknown>).content || "",
    ),
  };
}

function serializeWorkspaceQuestion(question: unknown) {
  const normalizedQuestion = normalizeForTransport(
    sanitizeQuestionForApiResponse(question),
  ) as Record<string, unknown> | null;

  if (!normalizedQuestion) {
    return null;
  }

  return {
    _id: String(normalizedQuestion._id || ""),
    content: String(normalizedQuestion.content || ""),
    explanation:
      typeof normalizedQuestion.explanation === "string"
        ? normalizedQuestion.explanation
        : "",
    subject: serializeNamedEntity(normalizedQuestion.subject),
    class: serializeNamedEntity(normalizedQuestion.class),
    tags: Array.isArray(normalizedQuestion.tags)
      ? normalizedQuestion.tags.map((tag) => {
          const normalizedTag =
            tag && typeof tag === "object" && !Array.isArray(tag)
              ? (tag as Record<string, unknown>)
              : null;

          return {
            _id: String(normalizedTag?._id || ""),
            name: String(normalizedTag?.name || ""),
            type: serializeNamedEntity(normalizedTag?.type, "Tag"),
          };
        })
      : [],
    options: Array.isArray(normalizedQuestion.options)
      ? normalizedQuestion.options.map((option) => serializeQuestionOption(option))
      : [],
    answerIndexes: Array.isArray(normalizedQuestion.answerIndexes)
      ? normalizedQuestion.answerIndexes
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
      : [],
    matrixOptions: Array.isArray(normalizedQuestion.matrixOptions)
      ? normalizedQuestion.matrixOptions.map((option) =>
          normalizeForTransport(option),
        )
      : [],
    matrixAnswers: Array.isArray(normalizedQuestion.matrixAnswers)
      ? normalizedQuestion.matrixAnswers.map((answer) =>
          normalizeForTransport(answer),
        )
      : [],
    marks: Number(normalizedQuestion.marks || 0),
    type: String(normalizedQuestion.type || ""),
    createdAt: String(normalizedQuestion.createdAt || ""),
  };
}

export async function listWorkspaceQuestions({
  schoolKey,
  page,
  limit,
  classId,
  subjectId,
  search,
  tagIds,
  tagsMode,
}: WorkspaceQuestionsFilterOptions): Promise<WorkspaceQuestionsListResult> {
  await connectDB();

  const { Question: QuestionModel } = await getTenantModels(schoolKey, [
    "Question",
    "Tag",
    "TagType",
    "Class",
    "Subject",
  ]);

  const resolvedClassId = normalizeObjectId(classId);
  const resolvedSubjectId = normalizeObjectId(subjectId);
  const resolvedSearch = String(search || "").trim();
  const resolvedTagIds = Array.from(
    new Set((Array.isArray(tagIds) ? tagIds : []).map((id) => normalizeObjectId(id)).filter(Boolean)),
  );
  const resolvedTagsMode = tagsMode === "and" ? "all" : "any";
  const safePage = resolveListPage(page);
  const safeLimit = resolveListLimit(limit);

  const query: any = {
    ...buildArchiveFilter(false),
  };

  if (resolvedClassId) {
    query.class = resolvedClassId;
  }
  if (resolvedSubjectId) {
    query.subject = resolvedSubjectId;
  }
  if (resolvedTagIds.length > 0) {
    query.tags =
      resolvedTagsMode === "all"
        ? { $all: resolvedTagIds }
        : { $in: resolvedTagIds };
  }
  if (resolvedSearch) {
    query.content = { $regex: escapeRegExp(resolvedSearch), $options: "i" };
  }

  const total = await QuestionModel.countDocuments(query);
  const pages = Math.max(1, Math.ceil(total / safeLimit));
  const pageWithinBounds = Math.min(safePage, pages);

  const questions = await QuestionModel.find(query)
    .select(
      "subject class tags content marks type createdAt options answerIndexes matrixOptions matrixAnswers explanation",
    )
    .populate("subject", "name")
    .populate("class", "name")
    .populate({ path: "tags", populate: { path: "type", select: "name" } })
    .sort(buildStableQuestionSort("createdAt", -1))
    .skip((pageWithinBounds - 1) * safeLimit)
    .limit(safeLimit)
    .lean();

  return {
    questions: Array.isArray(questions)
      ? questions
          .map((question) => serializeWorkspaceQuestion(question))
          .filter(Boolean)
      : [],
    total,
    page: pageWithinBounds,
    pages,
    limit: safeLimit,
    resolvedClassId,
    resolvedSubjectId,
    resolvedSearch,
    resolvedTagIds,
    resolvedTagsMode,
  };
}

async function getWorkspaceSubjectsForClass({
  schoolKey,
  classId,
}: {
  schoolKey: string;
  classId: string;
}) {
  if (!classId) {
    return [] as Array<{ _id: string; name: string }>;
  }

  await connectDB();
  const { Subject: SubjectModel, Question: QuestionModel } = await getTenantModels(
    schoolKey,
    ["Subject", "Question"],
  );

  const subjectIds = await QuestionModel.distinct("subject", {
    class: classId,
    ...buildArchiveFilter(false),
  });

  if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
    return [];
  }

  const subjects = await SubjectModel.find({
    _id: { $in: subjectIds },
    ...buildArchiveFilter(false),
  })
    .select("_id name")
    .sort({ name: 1 })
    .lean();

  return Array.isArray(subjects)
    ? subjects.map((subject: any) => ({
        _id: String(subject?._id || ""),
        name: String(subject?.name || ""),
      }))
    : [];
}

export async function getWorkspaceQuestionSupportData({
  schoolKey,
  classId,
}: WorkspaceQuestionSupportDataOptions): Promise<WorkspaceQuestionSupportData> {
  const resolvedClassId = normalizeObjectId(classId);
  const [classes, tags, subjects] = await Promise.all([
    getWorkspaceClasses(schoolKey),
    getWorkspaceTags(schoolKey),
    getWorkspaceSubjectsForClass({
      schoolKey,
      classId: resolvedClassId,
    }),
  ]);

  return {
    classes: classes.map((classItem) => ({
      _id: String(classItem._id || ""),
      name: String(classItem.name || ""),
    })),
    tags: tags.map((tag) => ({
      _id: String(tag._id || ""),
      name: String(tag.name || ""),
      type: tag.type
        ? {
            _id: String(tag.type._id || ""),
            name: String(tag.type.name || ""),
          }
        : null,
    })),
    subjects,
  };
}
