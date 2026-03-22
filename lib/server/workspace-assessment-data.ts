import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

  return question ? toPlain(question) : null;
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
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      populate: { path: "class", model: ClassModel, select: "name" },
    })
    .populate({
      path: "sections.questions.question",
      model: QuestionModel,
      populate: {
        path: "tags",
        model: Tag,
        populate: { path: "type", model: TagType, select: "name" },
      },
    })
    .lean();

  return paper ? toPlain(paper) : null;
}
