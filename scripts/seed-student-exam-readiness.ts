import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { getTenantDb, getTenantModels } from "@/lib/db-tenant";
import { syncExamPaperSnapshotForPaperId } from "@/lib/exam-runtime";
import School from "@/models/School";

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
  return `rg_${Date.now().toString(36)}`;
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
    path.resolve(`/tmp/student-exam-readiness-${schoolKey}.json`);
  const metaOut =
    String(argMap.get("meta-out") || "").trim() ||
    path.resolve(`/tmp/student-exam-readiness-meta-${schoolKey}.json`);

  return {
    schoolKey,
    studentCount,
    password,
    reset,
    studentsOut,
    metaOut,
  };
}

async function seedReadinessData(args: ParsedArgs) {
  await connectDB();

  await School.findOneAndUpdate(
    { key: args.schoolKey },
    {
      $setOnInsert: {
        key: args.schoolKey,
      },
      $set: {
        displayName: `Online Test Readiness ${args.schoolKey}`,
      },
    },
    { upsert: true, new: true },
  );

  if (args.reset) {
    const tenantDb = await getTenantDb(args.schoolKey);
    await tenantDb.dropDatabase().catch(() => undefined);
  }

  const {
    Class: ClassModel,
    AcademicSection: AcademicSectionModel,
    Subject: SubjectModel,
    Question: QuestionModel,
    QuestionPaper: QuestionPaperModel,
    User: UserModel,
  } = await getTenantModels(args.schoolKey, [
    "Class",
    "AcademicSection",
    "Subject",
    "Question",
    "QuestionPaper",
    "User",
    "QuestionPaperResponse",
  ]);

  const passwordHash = await bcrypt.hash(args.password, 10);
  const shortCode = args.schoolKey.slice(-6).toUpperCase().replace(/[^A-Z0-9]/g, "X");

  const classDoc = await ClassModel.create({
    name: `RG Class ${shortCode}`,
    description: "Readiness gate class",
  });
  const sectionDoc = await AcademicSectionModel.create({
    name: "Section A",
    class: classDoc._id,
    description: "Readiness section",
    isActive: true,
  });
  const subjectDoc = await SubjectModel.create({
    name: `RG Subject ${shortCode}`,
    code: `RGS-${shortCode}`,
  });
  const adminUser = await UserModel.create({
    name: "Readiness Admin",
    email: `readiness-admin-${args.schoolKey}@example.com`,
    passwordHash,
    mobileNumber: `9199${Math.floor(Math.random() * 1_000_000)
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

  const questionSingle = await QuestionModel.create({
    subject: subjectDoc._id,
    class: classDoc._id,
    tags: [],
    content: "<p>2 + 3 = ?</p>",
    type: "single",
    options: [{ content: "<p>5</p>" }, { content: "<p>6</p>" }],
    answerIndexes: [0],
    marks: 2,
    explanation: "Basic arithmetic.",
    createdBy: adminUser._id,
  });
  const questionMultiple = await QuestionModel.create({
    subject: subjectDoc._id,
    class: classDoc._id,
    tags: [],
    content: "<p>Select prime numbers.</p>",
    type: "multiple",
    options: [{ content: "<p>2</p>" }, { content: "<p>4</p>" }, { content: "<p>5</p>" }],
    answerIndexes: [0, 2],
    marks: 2,
    explanation: "Prime check.",
    createdBy: adminUser._id,
  });

  const now = new Date();
  const paper = await QuestionPaperModel.create({
    title: `Readiness Gate Paper ${shortCode}`,
    instructions: "Generated for online-test readiness gate.",
    class: classDoc._id,
    subject: subjectDoc._id,
    duration: 30,
    passingMarks: 1,
    totalMarks: 4,
    examDate: new Date(now.getTime() - 10 * 60 * 1000),
    onlineEnabled: true,
    onlineStartsAt: new Date(now.getTime() - 10 * 60 * 1000),
    onlineEndsAt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
    assignedAcademicSections: [sectionDoc._id],
    sections: [
      {
        name: "Section 1",
        description: "Readiness objective section",
        marks: 4,
        questions: [
          { question: questionSingle._id, marks: 2, negativeMarks: 0 },
          { question: questionMultiple._id, marks: 2, negativeMarks: 0 },
        ],
      },
    ],
    createdBy: adminUser._id,
  });

  await syncExamPaperSnapshotForPaperId(args.schoolKey, String(paper._id));

  const studentDocs = [];
  for (let index = 1; index <= args.studentCount; index += 1) {
    const rollNumber = `RG${shortCode}${index.toString().padStart(4, "0")}`;
    studentDocs.push({
      name: `RG Student ${index}`,
      passwordHash,
      mobileNumber: `9198${index.toString().padStart(6, "0")}`,
      role: "student",
      class: classDoc._id,
      academicSection: sectionDoc._id,
      rollNumber,
    });
  }
  await UserModel.insertMany(studentDocs, { ordered: true });

  const studentsPayload = {
    schoolKey: args.schoolKey,
    paperId: String(paper._id),
    students: studentDocs.map((student, index) => ({
      identifier: student.rollNumber,
      password: args.password,
      label: `Student ${index + 1}`,
    })),
  };

  await fs.mkdir(path.dirname(args.studentsOut), { recursive: true });
  await fs.writeFile(args.studentsOut, JSON.stringify(studentsPayload, null, 2), "utf8");

  const metadata = {
    generatedAt: new Date().toISOString(),
    schoolKey: args.schoolKey,
    paperId: String(paper._id),
    studentsFile: args.studentsOut,
    studentCount: args.studentCount,
    reset: args.reset,
  };
  await fs.mkdir(path.dirname(args.metaOut), { recursive: true });
  await fs.writeFile(args.metaOut, JSON.stringify(metadata, null, 2), "utf8");

  return metadata;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const metadata = await seedReadinessData(args);
  console.log("Readiness seed completed.");
  console.log(`School: ${metadata.schoolKey}`);
  console.log(`Paper: ${metadata.paperId}`);
  console.log(`Students: ${metadata.studentCount}`);
  console.log(`Students file: ${metadata.studentsFile}`);
  console.log(`Metadata file: ${args.metaOut}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
