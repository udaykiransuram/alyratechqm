import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { serializePaperSubjects } from "@/lib/question-paper/subjects";

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
    const maybeObjectId = value as { _bsontype?: string; toString?: () => string };
    if (
      maybeObjectId &&
      maybeObjectId._bsontype === "ObjectId" &&
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

export async function getWorkspaceQuestionById(
  schoolKey: string,
  id: string,
) {
  await connectDB();
  const { Question: QuestionModel, TagType } = await getTenantModels(schoolKey, [
    "Question",
    "TagType",
  ]);

  const question = await QuestionModel.findOne({
    _id: id,
    ...buildArchiveFilter(false),
  })
    .populate("subject", "name code")
    .populate("class", "name")
    .populate({
      path: "tags",
      populate: { path: "type", model: TagType, select: "name" },
    })
    .lean();

  return question ? normalizeForTransport(question) : null;
}

export async function getWorkspaceQuestionPaperById(
  schoolKey: string,
  id: string,
) {
  await connectDB();
  const {
    QuestionPaper: QuestionPaperModel,
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

  const paper = await QuestionPaperModel.findOne({
    _id: id,
    ...buildArchiveFilter(false),
  })
    .populate({ path: "class", model: ClassModel })
    .populate({ path: "subject", model: SubjectModel })
    .populate({ path: "subjectIds", model: SubjectModel, select: "name" })
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      populate: { path: "class", model: ClassModel, select: "name" },
    })
    .populate({
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
    })
    .lean();

  return paper
    ? normalizeForTransport({ ...paper, ...serializePaperSubjects(paper) })
    : null;
}
