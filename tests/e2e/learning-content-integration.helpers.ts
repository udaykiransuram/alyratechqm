import { connectDB } from "../../lib/db";
import { getTenantDb, getTenantModels } from "../../lib/db-tenant";
import { buildDiaryScopeKey } from "../../lib/diary/payload";
import School from "../../models/School";
import StudentNotificationJob from "../../models/StudentNotificationJob";

type CreatePaperOptions = {
  key: string;
  classDoc?: any;
  subjectDoc?: any;
  questionDoc?: any;
  assignedSections?: any[];
  title?: string;
  instructions?: string;
  duration?: number;
  onlineStartsAt?: Date;
  onlineEndsAt?: Date;
  examDate?: Date;
};

type CreateCourseOptions = {
  key: string;
  classDoc?: any;
  subjectDocs?: any[];
  assignedSections?: any[];
  title?: string;
  summary?: string;
  status?: "draft" | "published";
  blocks?: any[];
  allowNotes?: boolean;
  allowBookmarks?: boolean;
  enforceSequentialProgress?: boolean;
};

type CreateDiaryEntryOptions = {
  key: string;
  entryDate: string;
  classDoc?: any;
  subjectDoc?: any;
  assignedSections?: any[];
  title?: string;
  status?: "draft" | "published";
  lessonSummaryHtml?: string;
  homeworkHtml?: string;
  teacherNoteHtml?: string;
  resources?: any[];
};

type CreateStudentOptions = {
  key: string;
  classDoc?: any;
  sectionDoc?: any;
  name?: string;
};

type CreateCourseProgressOptions = {
  course: any;
  student: any;
  status?: "not_started" | "in_progress" | "completed";
  startedAt?: Date | null;
  lastViewedBlockId?: string | null;
  viewedBlockIds?: string[];
  completedBlockIds?: string[];
  bookmarkedBlockIds?: string[];
  notes?: Array<{
    blockId: string;
    text: string;
    updatedAt?: Date;
  }>;
  completionPercent?: number;
  completedAssessmentPaperIds?: any[];
  lastActivityAt?: Date | null;
  completedAt?: Date | null;
};

type CreateAttemptOptions = {
  paper: any;
  student: any;
  status?: "in_progress" | "submitted" | "auto_submitted";
  startedAt?: Date;
  lastSavedAt?: Date;
  submittedAt?: Date | null;
  totalMarksAwarded?: number;
  sectionAnswers?: any[];
};

export type LearningContentIntegrationSeed = {
  schoolKey: string;
  admin: any;
  teacherScoped: any;
  classAlpha: any;
  classBeta: any;
  sectionAlphaOne: any;
  sectionAlphaTwo: any;
  sectionBetaOne: any;
  subjectMath: any;
  subjectScience: any;
  questionMathAlpha: any;
  questionScienceAlpha: any;
  questionMathBeta: any;
  studentPrimary: any;
  models: Record<string, any>;
  createStudent: (options: CreateStudentOptions) => Promise<any>;
  createPaper: (options: CreatePaperOptions) => Promise<any>;
  createCourse: (options: CreateCourseOptions) => Promise<any>;
  createDiaryEntry: (options: CreateDiaryEntryOptions) => Promise<any>;
  createCourseProgress: (options: CreateCourseProgressOptions) => Promise<any>;
  createAttempt: (options: CreateAttemptOptions) => Promise<any>;
  cleanup: () => Promise<void>;
};

function buildNumericSuffix() {
  const timestampDigits = Date.now().toString().slice(-6);
  const randomDigits = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `${timestampDigits}${randomDigits}`;
}

export function toId(value: unknown) {
  if (!value) {
    return "";
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "_id" in (value as Record<string, unknown>)
  ) {
    return String((value as Record<string, unknown>)._id || "").trim();
  }

  return String(value || "").trim();
}

export function buildLessonBlock(id: string, title = "Lesson 1") {
  return {
    id,
    type: "lesson" as const,
    title,
    items: [
      {
        type: "text" as const,
        contentHtml: `<p>${title} content</p>`,
      },
    ],
  };
}

export function buildTextBlock(id: string, content = "Reference text") {
  return {
    id,
    type: "text" as const,
    contentHtml: `<p>${content}</p>`,
  };
}

export function buildAssessmentBlock(id: string, paperId: string) {
  return {
    id,
    type: "assessment" as const,
    questionPaper: paperId,
    required: true,
  };
}

export function cloneForAssertions<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function withPatchedMethod<T>(
  target: Record<string, any>,
  methodName: string,
  patch: (originalMethod: (...args: any[]) => any) => (...args: any[]) => any,
  run: () => Promise<T>,
) {
  const originalMethod = target[methodName];
  target[methodName] = patch(originalMethod.bind(target));

  try {
    return await run();
  } finally {
    target[methodName] = originalMethod;
  }
}

export async function createLearningContentIntegrationSeed(): Promise<LearningContentIntegrationSeed> {
  await connectDB();

  const numericSuffix = buildNumericSuffix();
  const schoolKey = `learning_content_it_${numericSuffix}`.toLowerCase();

  await School.findOneAndUpdate(
    { key: schoolKey },
    {
      $setOnInsert: {
        key: schoolKey,
        displayName: `Learning Content IT ${numericSuffix}`,
      },
    },
    { upsert: true, new: true },
  );

  const models = await getTenantModels(schoolKey, [
    "AcademicSection",
    "AuditLog",
    "Class",
    "Course",
    "CourseProgress",
    "DiaryEntry",
    "DiaryStudentState",
    "Question",
    "QuestionPaper",
    "QuestionPaperResponse",
    "StudentNotification",
    "Subject",
    "User",
  ]);

  const {
    AcademicSection: AcademicSectionModel,
    Class: ClassModel,
    Course: CourseModel,
    CourseProgress: CourseProgressModel,
    DiaryEntry: DiaryEntryModel,
    Question: QuestionModel,
    QuestionPaper: QuestionPaperModel,
    QuestionPaperResponse: QuestionPaperResponseModel,
    Subject: SubjectModel,
    User: UserModel,
  } = models;

  const classAlpha = await ClassModel.create({
    name: `Integration Class Alpha ${numericSuffix}`,
    description: "Learning content integration class alpha",
  });
  const classBeta = await ClassModel.create({
    name: `Integration Class Beta ${numericSuffix}`,
    description: "Learning content integration class beta",
  });

  const sectionAlphaOne = await AcademicSectionModel.create({
    name: "Alpha Section 1",
    class: classAlpha._id,
    isActive: true,
  });
  const sectionAlphaTwo = await AcademicSectionModel.create({
    name: "Alpha Section 2",
    class: classAlpha._id,
    isActive: true,
  });
  const sectionBetaOne = await AcademicSectionModel.create({
    name: "Beta Section 1",
    class: classBeta._id,
    isActive: true,
  });

  const subjectMath = await SubjectModel.create({
    name: `Mathematics ${numericSuffix}`,
    code: `MATH-${numericSuffix.slice(-4)}`,
  });
  const subjectScience = await SubjectModel.create({
    name: `Science ${numericSuffix}`,
    code: `SCI-${numericSuffix.slice(-4)}`,
  });

  const admin = await UserModel.create({
    name: "Learning Content Admin",
    mobileNumber: `91${numericSuffix.slice(0, 10)}`,
    role: "admin",
    hasAllClasses: true,
    hasAllSections: true,
    hasAllSubjects: true,
    classIds: [],
    academicSectionIds: [],
    subjectIds: [],
  });

  const teacherScoped = await UserModel.create({
    name: "Scoped Teacher",
    mobileNumber: `92${numericSuffix.slice(0, 10)}`,
    role: "teacher",
    classIds: [classAlpha._id],
    academicSectionIds: [sectionAlphaOne._id],
    subjectIds: [subjectMath._id],
    hasAllSections: false,
  });

  const questionMathAlpha = await QuestionModel.create({
    subject: subjectMath._id,
    class: classAlpha._id,
    tags: [],
    content: "<p>2 + 2 = ?</p>",
    type: "single",
    options: [{ content: "<p>4</p>" }, { content: "<p>5</p>" }],
    answerIndexes: [0],
    marks: 2,
    explanation: "Basic arithmetic.",
    createdBy: admin._id,
  });
  const questionScienceAlpha = await QuestionModel.create({
    subject: subjectScience._id,
    class: classAlpha._id,
    tags: [],
    content: "<p>Water boils at?</p>",
    type: "single",
    options: [{ content: "<p>100 C</p>" }, { content: "<p>80 C</p>" }],
    answerIndexes: [0],
    marks: 2,
    explanation: "Basic science.",
    createdBy: admin._id,
  });
  const questionMathBeta = await QuestionModel.create({
    subject: subjectMath._id,
    class: classBeta._id,
    tags: [],
    content: "<p>5 + 5 = ?</p>",
    type: "single",
    options: [{ content: "<p>10</p>" }, { content: "<p>11</p>" }],
    answerIndexes: [0],
    marks: 2,
    explanation: "Basic arithmetic.",
    createdBy: admin._id,
  });

  const createStudent = async (options: CreateStudentOptions) => {
    const normalizedKey = String(options.key || "student").trim() || "student";
    const mobileTail = buildNumericSuffix().slice(0, 10);
    const student = await UserModel.create({
      name: options.name || `Student ${normalizedKey}`,
      mobileNumber: `93${mobileTail}`,
      role: "student",
      class: (options.classDoc || classAlpha)._id,
      academicSection: (options.sectionDoc || sectionAlphaOne)._id,
      rollNumber: `${normalizedKey.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "STD"}${mobileTail.slice(-4)}`.toUpperCase(),
    });

    return student;
  };

  const studentPrimary = await createStudent({
    key: "primary",
    classDoc: classAlpha,
    sectionDoc: sectionAlphaOne,
    name: "Primary Student",
  });

  const createPaper = async (options: CreatePaperOptions) => {
    const classDoc = options.classDoc || classAlpha;
    const subjectDoc = options.subjectDoc || subjectMath;
    const questionDoc =
      options.questionDoc ||
      (toId(classDoc) === toId(classBeta)
        ? questionMathBeta
        : toId(subjectDoc) === toId(subjectScience)
          ? questionScienceAlpha
          : questionMathAlpha);
    const now = new Date();

    return QuestionPaperModel.create({
      title: options.title || `Paper ${options.key}`,
      instructions: options.instructions || "Answer every question.",
      class: classDoc._id,
      subject: subjectDoc._id,
      subjectIds: [subjectDoc._id],
      duration: options.duration || 30,
      passingMarks: 1,
      totalMarks: 2,
      examDate: options.examDate || new Date(now.getTime() - 10 * 60 * 1000),
      onlineEnabled: true,
      onlineStartsAt:
        options.onlineStartsAt || new Date(now.getTime() - 10 * 60 * 1000),
      onlineEndsAt:
        options.onlineEndsAt || new Date(now.getTime() + 60 * 60 * 1000),
      assignedAcademicSections: (options.assignedSections || [sectionAlphaOne]).map(
        (section) => section._id,
      ),
      sections: [
        {
          name: "Section 1",
          description: "",
          instructions: "",
          marks: 2,
          questions: [{ question: questionDoc._id, marks: 2, negativeMarks: 0 }],
        },
      ],
      createdBy: admin._id,
    });
  };

  const createCourse = async (options: CreateCourseOptions) => {
    const status = options.status || "published";
    const course = await CourseModel.create({
      title: options.title || `Course ${options.key}`,
      summary: options.summary || "",
      class: (options.classDoc || classAlpha)._id,
      subjectIds: (options.subjectDocs || [subjectMath]).map((subject) => subject._id),
      assignedAcademicSections: (options.assignedSections || [sectionAlphaOne]).map(
        (section) => section._id,
      ),
      status,
      blocks:
        options.blocks ||
        [buildLessonBlock(`lesson-${options.key}`, `Lesson ${options.key}`)],
      createdBy: admin._id,
      publishedAt: status === "published" ? new Date() : null,
      enforceSequentialProgress: options.enforceSequentialProgress || false,
      allowNotes: options.allowNotes !== false,
      allowBookmarks: options.allowBookmarks !== false,
      isTemplate: false,
    });

    return course;
  };

  const createDiaryEntry = async (options: CreateDiaryEntryOptions) => {
    const classDoc = options.classDoc || classAlpha;
    const subjectDoc = options.subjectDoc || subjectMath;
    const assignedSections = options.assignedSections || [sectionAlphaOne];
    const status = options.status || "published";

    return DiaryEntryModel.create({
      title: options.title || `Diary ${options.key}`,
      entryDate: options.entryDate,
      class: classDoc._id,
      assignedAcademicSections: assignedSections.map((section) => section._id),
      subject: subjectDoc._id,
      status,
      scopeKey: buildDiaryScopeKey({
        entryDate: options.entryDate,
        classId: toId(classDoc),
        subjectId: toId(subjectDoc),
        assignedAcademicSectionIds: assignedSections.map((section) => toId(section)),
      }),
      lessonSummaryHtml:
        options.lessonSummaryHtml || `<p>Lesson summary for ${options.key}</p>`,
      homeworkHtml: options.homeworkHtml || "",
      teacherNoteHtml: options.teacherNoteHtml || "",
      resources: options.resources || [],
      createdBy: admin._id,
      updatedBy: admin._id,
      publishedAt: status === "published" ? new Date() : null,
    });
  };

  const createCourseProgress = async (options: CreateCourseProgressOptions) => {
    return CourseProgressModel.create({
      course: options.course._id || options.course,
      student: options.student._id || options.student,
      status: options.status || "in_progress",
      startedAt:
        typeof options.startedAt === "undefined" ? new Date() : options.startedAt,
      lastViewedBlockId:
        typeof options.lastViewedBlockId === "undefined"
          ? null
          : options.lastViewedBlockId,
      viewedBlockIds: options.viewedBlockIds || [],
      completedBlockIds: options.completedBlockIds || [],
      bookmarkedBlockIds: options.bookmarkedBlockIds || [],
      notes: (options.notes || []).map((note) => ({
        blockId: note.blockId,
        text: note.text,
        updatedAt: note.updatedAt || new Date(),
      })),
      completionPercent:
        typeof options.completionPercent === "number"
          ? options.completionPercent
          : 0,
      completedAssessmentPaperIds: options.completedAssessmentPaperIds || [],
      lastActivityAt:
        typeof options.lastActivityAt === "undefined"
          ? new Date()
          : options.lastActivityAt,
      completedAt:
        typeof options.completedAt === "undefined" ? null : options.completedAt,
    });
  };

  const createAttempt = async (options: CreateAttemptOptions) => {
    const startedAt = options.startedAt || new Date(Date.now() - 2 * 60 * 60 * 1000);

    return QuestionPaperResponseModel.create({
      paper: options.paper._id || options.paper,
      student: options.student._id || options.student,
      startedAt,
      submittedAt:
        typeof options.submittedAt === "undefined" ? undefined : options.submittedAt,
      status: options.status || "in_progress",
      lastSavedAt: options.lastSavedAt || startedAt,
      totalMarksAwarded:
        typeof options.totalMarksAwarded === "number"
          ? options.totalMarksAwarded
          : 0,
      sectionAnswers: options.sectionAnswers || [],
    });
  };

  return {
    schoolKey,
    admin,
    teacherScoped,
    classAlpha,
    classBeta,
    sectionAlphaOne,
    sectionAlphaTwo,
    sectionBetaOne,
    subjectMath,
    subjectScience,
    questionMathAlpha,
    questionScienceAlpha,
    questionMathBeta,
    studentPrimary,
    models,
    createStudent,
    createPaper,
    createCourse,
    createDiaryEntry,
    createCourseProgress,
    createAttempt,
    cleanup: async () => {
      await StudentNotificationJob.deleteMany({ schoolKey }).catch(() => undefined);
      const tenantDb = await getTenantDb(schoolKey);
      await tenantDb.dropDatabase().catch(() => undefined);
      await School.deleteMany({ key: schoolKey }).catch(() => undefined);
    },
  };
}
