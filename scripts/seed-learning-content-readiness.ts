import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

type ParsedArgs = {
  schoolKey: string;
  studentCount: number;
  password: string;
  reset: boolean;
  studentsOut: string;
  metaOut: string;
};

const TENANT_DB_PREFIX = "school_db_";
const MAX_MONGODB_DB_NAME_LENGTH = 38;
const MAX_SCHOOL_KEY_LENGTH =
  MAX_MONGODB_DB_NAME_LENGTH - TENANT_DB_PREFIX.length;

function sanitizeSchoolKey(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
}

function buildDefaultSchoolKey() {
  return `lcg_${Date.now().toString(36)}`;
}

function assertTenantSafeSchoolKey(schoolKey: string) {
  if (!schoolKey) {
    throw new Error("School key cannot be empty.");
  }

  const dbNameLength = Buffer.byteLength(`${TENANT_DB_PREFIX}${schoolKey}`, "utf8");
  if (dbNameLength > MAX_MONGODB_DB_NAME_LENGTH) {
    throw new Error(
      `School key "${schoolKey}" is too long for tenant DB naming. Max key length is ${MAX_SCHOOL_KEY_LENGTH} characters.`,
    );
  }
}

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return defaultValue;
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  throw new Error(`Invalid boolean value: ${value}`);
}

function parsePositiveInt(value: string | undefined, defaultValue: number) {
  const normalized = String(value || "").trim();
  if (!normalized) return defaultValue;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer: ${value}`);
  }
  return Math.floor(parsed);
}

function parseArgs(argv: string[]): ParsedArgs {
  const argMap = new Map<string, string>();
  for (const rawArg of argv) {
    const arg = String(rawArg || "");
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    argMap.set(key, rest.join("="));
  }

  const defaultSchoolKey = buildDefaultSchoolKey();
  const schoolKey = sanitizeSchoolKey(argMap.get("school") || defaultSchoolKey);
  assertTenantSafeSchoolKey(schoolKey);
  const studentCount = parsePositiveInt(argMap.get("students"), 100);
  const password = String(argMap.get("password") || "Stress123!").trim();
  if (!password) {
    throw new Error("Password cannot be empty.");
  }
  const reset = parseBoolean(argMap.get("reset"), true);
  const studentsOut =
    String(argMap.get("students-out") || "").trim() ||
    path.resolve(`/tmp/learning-content-readiness-${schoolKey}.students.json`);
  const metaOut =
    String(argMap.get("meta-out") || "").trim() ||
    path.resolve(`/tmp/learning-content-readiness-${schoolKey}.meta.json`);

  return {
    schoolKey,
    studentCount,
    password,
    reset,
    studentsOut,
    metaOut,
  };
}

async function seedLearningContentReadiness(args: ParsedArgs) {
  const [
    { connectDB },
    { getTenantDb, getTenantModels },
    { buildDiaryScopeKey },
    { syncExamPaperSnapshotForPaperId },
    schoolModule,
  ] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db-tenant"),
    import("@/lib/diary/payload"),
    import("@/lib/exam-runtime"),
    import("@/models/School"),
  ]);
  const School = schoolModule.default;
  await connectDB();

  await School.findOneAndUpdate(
    { key: args.schoolKey },
    {
      $setOnInsert: {
        key: args.schoolKey,
      },
      $set: {
        displayName: `Learning Content Readiness ${args.schoolKey}`,
      },
    },
    { upsert: true, new: true },
  );

  if (args.reset) {
    const tenantDb = await getTenantDb(args.schoolKey);
    await tenantDb.dropDatabase().catch(() => undefined);
  }

  const {
    AcademicSection: AcademicSectionModel,
    Class: ClassModel,
    Course: CourseModel,
    DiaryEntry: DiaryEntryModel,
    Question: QuestionModel,
    QuestionPaper: QuestionPaperModel,
    StudentNotification: StudentNotificationModel,
    Subject: SubjectModel,
    User: UserModel,
  } = await getTenantModels(args.schoolKey, [
    "AcademicSection",
    "Class",
    "Course",
    "DiaryEntry",
    "Question",
    "QuestionPaper",
    "StudentNotification",
    "Subject",
    "User",
  ]);

  const passwordHash = await bcrypt.hash(args.password, 10);
  const shortCode = args.schoolKey.slice(-6).toUpperCase().replace(/[^A-Z0-9]/g, "X");
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const classDoc = await ClassModel.create({
    name: `LCG Class ${shortCode}`,
    description: "Learning content readiness gate class",
  });
  const sectionDoc = await AcademicSectionModel.create({
    name: "Section A",
    class: classDoc._id,
    description: "Learning content readiness section",
    isActive: true,
  });
  const subjectDoc = await SubjectModel.create({
    name: `LCG Subject ${shortCode}`,
    code: `LCG-${shortCode}`,
  });
  const adminUser = await UserModel.create({
    name: "Learning Content Admin",
    email: `learning-content-admin-${args.schoolKey}@example.com`,
    passwordHash,
    mobileNumber: `9177${Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0")}`,
    role: "admin",
    hasAllClasses: true,
    hasAllSections: true,
    hasAllSubjects: true,
    classIds: [],
    academicSectionIds: [],
    subjectIds: [],
  });

  const questionDoc = await QuestionModel.create({
    subject: subjectDoc._id,
    class: classDoc._id,
    tags: [],
    content: "<p>What is 0.4 × 0.5?</p>",
    type: "single",
    options: [
      { content: "<p>0.2</p>" },
      { content: "<p>0.9</p>" },
      { content: "<p>2</p>" },
    ],
    answerIndexes: [0],
    marks: 2,
    explanation: "Multiplying decimals keeps place value.",
    createdBy: adminUser._id,
  });

  const paper = await QuestionPaperModel.create({
    title: `LCG Quick Check ${shortCode}`,
    instructions: "Answer the decimal question.",
    class: classDoc._id,
    subject: subjectDoc._id,
    subjectIds: [subjectDoc._id],
    duration: 20,
    passingMarks: 1,
    totalMarks: 2,
    examDate: new Date(now.getTime() - 10 * 60 * 1000),
    onlineEnabled: true,
    onlineStartsAt: new Date(now.getTime() - 10 * 60 * 1000),
    onlineEndsAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
    assignedAcademicSections: [sectionDoc._id],
    sections: [
      {
        name: "Section 1",
        description: "Learning content assessment section",
        marks: 2,
        questions: [
          {
            question: questionDoc._id,
            marks: 2,
            negativeMarks: 0,
          },
        ],
      },
    ],
    createdBy: adminUser._id,
  });

  await syncExamPaperSnapshotForPaperId(args.schoolKey, String(paper._id)).catch(
    () => undefined,
  );

  const lessonBlockId = `lesson-${shortCode.toLowerCase()}`;
  const textBlockId = `text-${shortCode.toLowerCase()}`;
  const imageBlockId = `image-${shortCode.toLowerCase()}`;
  const resourceBlockId = `resource-${shortCode.toLowerCase()}`;
  const assessmentBlockId = `assessment-${shortCode.toLowerCase()}`;

  const mainCourse = await CourseModel.create({
    title: `Multiply Decimals ${shortCode}`,
    summary: "Starter video, worked examples, references, and a quick assessment.",
    class: classDoc._id,
    subjectIds: [subjectDoc._id],
    assignedAcademicSections: [sectionDoc._id],
    status: "published",
    startsAt: new Date(now.getTime() - 60 * 60 * 1000),
    dueAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
    completionBadgeLabel: "Decimals Ready",
    enforceSequentialProgress: false,
    allowNotes: true,
    allowBookmarks: true,
    isTemplate: false,
    blocks: [
      {
        id: lessonBlockId,
        type: "lesson",
        title: "Starter lesson",
        summary: "Begin with the teacher video and the visual model.",
        estimatedMinutes: 12,
        items: [
          {
            type: "text",
            contentHtml:
              "<p>Multiply the whole numbers first, then place the decimal using total decimal places.</p>",
          },
          {
            type: "youtube",
            videoId: "dQw4w9WgXcQ",
            title: "Starter video",
          },
          {
            type: "image",
            imageUrl:
              "https://images.unsplash.com/photo-1456406644174-8ddd4cd52a06?auto=format&fit=crop&w=1200&q=80",
            altText: "Notebook and calculator on a desk",
            caption: "Visual cue for worked decimal examples",
            imageFit: "cover",
            imageWidth: "full",
            imageHeight: "medium",
          },
        ],
      },
      {
        id: textBlockId,
        type: "text",
        title: "Worked example",
        contentHtml:
          "<p>Example: 0.4 × 0.5 = 4 × 5 = 20, then place two decimal digits: 0.20.</p>",
      },
      {
        id: imageBlockId,
        type: "image",
        title: "Decimal grid",
        imageUrl:
          "https://images.unsplash.com/photo-1509228627152-72ae9ae6848d?auto=format&fit=crop&w=1200&q=80",
        altText: "Graph paper and handwritten decimal notes",
        caption: "Keep the decimal point visible while practicing.",
        imageFit: "cover",
        imageWidth: "standard",
        imageHeight: "medium",
      },
      {
        id: resourceBlockId,
        type: "resource",
        title: "Practice sheet",
        fileUrl: "https://example.com/learning-content/decimal-practice-sheet.pdf",
        fileName: "decimal-practice-sheet.pdf",
      },
      {
        id: assessmentBlockId,
        type: "assessment",
        titleOverride: "Quick check",
        questionPaper: paper._id,
        required: true,
        minimumScorePct: 0,
      },
    ],
    createdBy: adminUser._id,
    publishedAt: now,
  });

  await CourseModel.create({
    title: `Decimal Review ${shortCode}`,
    summary: "A lighter supporting course to make list payloads more realistic.",
    class: classDoc._id,
    subjectIds: [subjectDoc._id],
    assignedAcademicSections: [sectionDoc._id],
    status: "published",
    startsAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    dueAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
    enforceSequentialProgress: false,
    allowNotes: true,
    allowBookmarks: true,
    isTemplate: false,
    blocks: [
      {
        id: `review-${shortCode.toLowerCase()}`,
        type: "text",
        contentHtml:
          "<p>Review decimal multiplication with one extra worked example.</p>",
      },
    ],
    createdBy: adminUser._id,
    publishedAt: now,
  });

  const mainDiary = await DiaryEntryModel.create({
    title: `Decimal Diary ${shortCode}`,
    entryDate: today,
    class: classDoc._id,
    assignedAcademicSections: [sectionDoc._id],
    subject: subjectDoc._id,
    status: "published",
    scopeKey: buildDiaryScopeKey({
      entryDate: today,
      classId: String(classDoc._id),
      subjectId: String(subjectDoc._id),
      assignedAcademicSectionIds: [String(sectionDoc._id)],
    }),
    lessonSummaryHtml:
      "<p>We learned how to multiply decimals using whole-number multiplication first.</p>",
    homeworkHtml:
      "<p>Complete the decimal practice sheet and re-watch the starter video.</p>",
    teacherNoteHtml:
      "<p>Focus on aligning place value carefully before placing the decimal.</p>",
    resources: [
      {
        id: `diary-video-${shortCode.toLowerCase()}`,
        type: "youtube",
        videoId: "dQw4w9WgXcQ",
        caption: "Starter recap",
      },
      {
        id: `diary-image-${shortCode.toLowerCase()}`,
        type: "image",
        url: "https://example.com/learning-content/decimal-grid.png",
        altText: "Decimal practice grid",
        caption: "Use this while solving homework.",
      },
      {
        id: `diary-file-${shortCode.toLowerCase()}`,
        type: "file",
        url: "https://example.com/learning-content/decimal-homework.pdf",
        fileName: "decimal-homework.pdf",
      },
    ],
    createdBy: adminUser._id,
    updatedBy: adminUser._id,
    publishedAt: now,
  });

  await DiaryEntryModel.create({
    title: `Decimal Recall ${shortCode}`,
    entryDate: yesterday,
    class: classDoc._id,
    assignedAcademicSections: [sectionDoc._id],
    subject: subjectDoc._id,
    status: "published",
    scopeKey: buildDiaryScopeKey({
      entryDate: yesterday,
      classId: String(classDoc._id),
      subjectId: String(subjectDoc._id),
      assignedAcademicSectionIds: [String(sectionDoc._id)],
    }),
    lessonSummaryHtml:
      "<p>Yesterday we revised how to compare decimal numbers.</p>",
    resources: [],
    createdBy: adminUser._id,
    updatedBy: adminUser._id,
    publishedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
  });

  const studentPayloads = [];
  for (let index = 1; index <= args.studentCount; index += 1) {
    const rollNumber = `LC${shortCode}${index.toString().padStart(4, "0")}`;
    studentPayloads.push({
      name: `LC Student ${index}`,
      passwordHash,
      mobileNumber: `9196${index.toString().padStart(6, "0")}`,
      role: "student",
      class: classDoc._id,
      academicSection: sectionDoc._id,
      rollNumber,
    });
  }

  const studentDocs = await UserModel.insertMany(studentPayloads, {
    ordered: true,
  });

  await StudentNotificationModel.insertMany(
    studentDocs.flatMap((student: any, index: number) => [
      {
        studentId: student._id,
        type: "course_assigned",
        title: "New course assigned",
        message: `Open ${mainCourse.title} and complete the quick check.`,
        linkUrl: `/student/courses/${mainCourse._id}`,
        entityId: String(mainCourse._id),
        entityType: "course",
        createdAt: new Date(now.getTime() - index * 1000),
        updatedAt: new Date(now.getTime() - index * 1000),
      },
      {
        studentId: student._id,
        type: "diary_update",
        title: "Diary updated",
        message: `Today's diary for ${subjectDoc.name} is ready.`,
        linkUrl: `/student/diary/${mainDiary._id}`,
        entityId: String(mainDiary._id),
        entityType: "diary",
        readAt: new Date(now.getTime() - 30 * 60 * 1000),
        createdAt: new Date(now.getTime() - 10 * 60 * 1000 - index * 1000),
        updatedAt: new Date(now.getTime() - 10 * 60 * 1000 - index * 1000),
      },
    ]),
    { ordered: true },
  );

  const studentsPayload = {
    schoolKey: args.schoolKey,
    courseId: String(mainCourse._id),
    diaryEntryId: String(mainDiary._id),
    students: studentDocs.map((student: any, index: number) => ({
      identifier: String(student.rollNumber || ""),
      password: args.password,
      label: `Student ${index + 1}`,
    })),
  };

  const metadata = {
    generatedAt: new Date().toISOString(),
    schoolKey: args.schoolKey,
    classId: String(classDoc._id),
    academicSectionId: String(sectionDoc._id),
    subjectId: String(subjectDoc._id),
    paperId: String(paper._id),
    courseId: String(mainCourse._id),
    diaryEntryId: String(mainDiary._id),
    studentsFile: args.studentsOut,
    studentCount: studentDocs.length,
    courseProgress: {
      viewedBlockId: lessonBlockId,
      completedBlockId: textBlockId,
      bookmarkedBlockId: imageBlockId,
      noteBlockId: lessonBlockId,
      assessmentBlockId,
    },
    diaryState: {
      entryId: String(mainDiary._id),
    },
  };

  await fs.mkdir(path.dirname(args.studentsOut), { recursive: true });
  await fs.mkdir(path.dirname(args.metaOut), { recursive: true });
  await fs.writeFile(
    args.studentsOut,
    JSON.stringify(studentsPayload, null, 2),
    "utf8",
  );
  await fs.writeFile(args.metaOut, JSON.stringify(metadata, null, 2), "utf8");

  return {
    schoolKey: args.schoolKey,
    studentCount: studentDocs.length,
    courseId: String(mainCourse._id),
    diaryEntryId: String(mainDiary._id),
    paperId: String(paper._id),
    studentsOut: args.studentsOut,
    metaOut: args.metaOut,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await seedLearningContentReadiness(args);

  console.log("[learning-content-readiness-seed] complete");
  console.log(`School: ${summary.schoolKey}`);
  console.log(`Students: ${summary.studentCount}`);
  console.log(`Course: ${summary.courseId}`);
  console.log(`Diary entry: ${summary.diaryEntryId}`);
  console.log(`Assessment paper: ${summary.paperId}`);
  console.log(`Students file: ${summary.studentsOut}`);
  console.log(`Metadata file: ${summary.metaOut}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
