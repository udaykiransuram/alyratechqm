import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { isStudentResultReleasedForPaper } from "@/lib/student-tests";
import type {
  StudentAccountProfile,
  StudentAccountReleasedReport,
} from "@/lib/student-account/types";

type StudentProfileModels = {
  User: any;
  Class: any;
  AcademicSection: any;
};

type ReleasedReportsModels = {
  QuestionPaperResponse: any;
  QuestionPaper: any;
  Subject: any;
};

type StudentAccountPageModels = StudentProfileModels & ReleasedReportsModels;

export type StudentAccountBootstrapData = {
  student: StudentAccountProfile | null;
  reports: StudentAccountReleasedReport[];
  studentError: string | null;
  reportsError: string | null;
};

function serializeStudentProfile(student: any): StudentAccountProfile {
  return {
    _id: String(student._id),
    name: String(student.name || ""),
    email: student.email ? String(student.email) : "",
    rollNumber: student.rollNumber ? String(student.rollNumber) : "",
    mobileNumber: student.mobileNumber ? String(student.mobileNumber) : "",
    className:
      typeof student.class === "object" && student.class?.name
        ? String(student.class.name)
        : "",
    academicSectionName:
      typeof student.academicSection === "object" && student.academicSection?.name
        ? String(student.academicSection.name)
        : "",
  };
}

export async function getStudentProfileForAccount(
  schoolKey: string,
  studentId: string,
): Promise<StudentAccountProfile | null> {
  await connectDB();

  const models = await getTenantModels(schoolKey, ["User", "Class", "AcademicSection"]);

  return getStudentProfileForAccountFromModels(models, studentId);
}

async function getStudentProfileForAccountFromModels(
  models: StudentProfileModels,
  studentId: string,
): Promise<StudentAccountProfile | null> {
  const {
    User: UserModel,
    Class: ClassModel,
    AcademicSection: AcademicSectionModel,
  } = models;

  const student = await UserModel.findById(studentId)
    .select("name email rollNumber mobileNumber class academicSection")
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({
      path: "academicSection",
      model: AcademicSectionModel,
      select: "name",
    })
    .lean();

  if (!student) {
    return null;
  }

  return serializeStudentProfile(student);
}

function pickPrimarySubject(paper: any) {
  const explicitSubjects = Array.isArray(paper?.subjectIds) ? paper.subjectIds : [];
  if (paper?.subject) {
    return {
      _id: String(paper.subject?._id || paper.subject),
      name: String(paper.subject?.name || ""),
    };
  }
  if (explicitSubjects.length > 0) {
    const first = explicitSubjects[0];
    return {
      _id: String(first?._id || first),
      name: String(first?.name || ""),
    };
  }
  return null;
}

export async function listReleasedStudentAccountReports(params: {
  schoolKey: string;
  studentId: string;
  now?: Date;
}): Promise<StudentAccountReleasedReport[]> {
  const now = params.now || new Date();
  await connectDB();

  const models = await getTenantModels(params.schoolKey, [
    "QuestionPaperResponse",
    "QuestionPaper",
    "Subject",
  ]);

  return listReleasedStudentAccountReportsFromModels(
    models,
    params.studentId,
    now,
  );
}

async function listReleasedStudentAccountReportsFromModels(
  models: ReleasedReportsModels,
  studentId: string,
  now: Date,
): Promise<StudentAccountReleasedReport[]> {
  const {
    QuestionPaperResponse: QuestionPaperResponseModel,
    QuestionPaper: QuestionPaperModel,
    Subject: SubjectModel,
  } = models;

  const submittedAttempts = await QuestionPaperResponseModel.find({
    student: studentId,
    status: { $in: ["submitted", "auto_submitted"] },
  })
    .select("paper submittedAt status totalMarksAwarded")
    .sort({ submittedAt: -1, _id: -1 })
    .lean();

  if (!Array.isArray(submittedAttempts) || submittedAttempts.length === 0) {
    return [];
  }

  const latestAttemptByPaperId = new Map<string, any>();
  for (const attempt of submittedAttempts) {
    const paperId = String(attempt?.paper || "").trim();
    if (!paperId || latestAttemptByPaperId.has(paperId)) {
      continue;
    }
    latestAttemptByPaperId.set(paperId, attempt);
  }

  const paperIds = Array.from(latestAttemptByPaperId.keys());
  if (paperIds.length === 0) {
    return [];
  }

  const papers = await QuestionPaperModel.find({
    _id: { $in: paperIds },
  })
    .select("title subject subjectIds onlineEndsAt examDate")
    .populate({ path: "subject", model: SubjectModel, select: "name" })
    .populate({ path: "subjectIds", model: SubjectModel, select: "name" })
    .lean();

  const paperById = new Map<string, any>(
    (Array.isArray(papers) ? papers : []).map((paper: any) => [
      String(paper?._id || ""),
      paper,
    ]),
  );

  const reports: StudentAccountReleasedReport[] = [];
  for (const [paperId, attempt] of latestAttemptByPaperId.entries()) {
    const paper = paperById.get(paperId);
    if (!paper) {
      continue;
    }

    if (!isStudentResultReleasedForPaper(paper, now)) {
      continue;
    }

    reports.push({
      _id: String(paper._id || ""),
      title: String(paper.title || ""),
      status: String(attempt?.status || "submitted"),
      subject: pickPrimarySubject(paper),
      onlineEndsAt: paper.onlineEndsAt || null,
      attempt: {
        _id: String(attempt?._id || ""),
        submittedAt: attempt?.submittedAt || null,
        status: String(attempt?.status || "submitted"),
        totalMarksAwarded:
          typeof attempt?.totalMarksAwarded === "number"
            ? attempt.totalMarksAwarded
            : 0,
      },
    });
  }

  return reports;
}

export async function getStudentAccountBootstrapData(params: {
  schoolKey: string;
  studentId: string;
  now?: Date;
}): Promise<StudentAccountBootstrapData> {
  await connectDB();

  const models = await getTenantModels(params.schoolKey, [
    "User",
    "Class",
    "AcademicSection",
    "QuestionPaperResponse",
    "QuestionPaper",
    "Subject",
  ]);

  const [studentResult, reportsResult] = await Promise.allSettled([
    getStudentProfileForAccountFromModels(models as StudentAccountPageModels, params.studentId),
    listReleasedStudentAccountReportsFromModels(
      models as StudentAccountPageModels,
      params.studentId,
      params.now || new Date(),
    ),
  ]);

  return {
    student: studentResult.status === "fulfilled" ? studentResult.value : null,
    reports: reportsResult.status === "fulfilled" ? reportsResult.value : [],
    studentError:
      studentResult.status === "rejected"
        ? studentResult.reason?.message || "Failed to load your student account."
        : null,
    reportsError:
      reportsResult.status === "rejected"
        ? reportsResult.reason?.message ||
          "Failed to load your online-test reports."
        : null,
  };
}
