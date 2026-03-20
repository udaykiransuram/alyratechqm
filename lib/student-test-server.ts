import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

export async function getStudentTestModels(schoolKey: string) {
  await connectDB();

  return getTenantModels(schoolKey, [
    "QuestionPaper",
    "QuestionPaperResponse",
    "User",
    "Question",
    "Class",
    "Subject",
    "AcademicSection",
  ]);
}

export async function loadStudentUser(UserModel: any, studentId: string) {
  return UserModel.findOne({
    _id: studentId,
    role: "student",
    ...buildArchiveFilter(false),
  })
    .select("name email class academicSection rollNumber")
    .lean();
}

export async function loadOnlinePaperById(
  {
    QuestionPaper: QuestionPaperModel,
    Question: QuestionModel,
    Class: ClassModel,
    Subject: SubjectModel,
    AcademicSection: AcademicSectionModel,
  }: {
    QuestionPaper: any;
    Question: any;
    Class: any;
    Subject: any;
    AcademicSection: any;
  },
  paperId: string,
) {
  return QuestionPaperModel.findOne({
    _id: paperId,
    onlineEnabled: true,
    ...buildArchiveFilter(false),
  })
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({ path: "subject", model: SubjectModel, select: "name" })
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      select: "name class",
      populate: { path: "class", model: ClassModel, select: "name" },
    })
    .populate({
      path: "sections.questions.question",
      model: QuestionModel,
      select: "content options type answerIndexes matrixOptions matrixAnswers explanation",
    })
    .lean();
}
