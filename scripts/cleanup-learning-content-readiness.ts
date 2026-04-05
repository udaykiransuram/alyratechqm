import fs from "node:fs/promises";
import mongoose from "mongoose";

type ParsedArgs = {
  schoolKey: string;
  metaFile: string;
  removeArtifacts: boolean;
};

type ReadinessMeta = {
  schoolKey?: string;
  studentsFile?: string;
};

function sanitizeSchoolKey(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
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

function parseArgs(argv: string[]): ParsedArgs {
  const argMap = new Map<string, string>();
  for (const rawArg of argv) {
    const arg = String(rawArg || "");
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    argMap.set(key, rest.join("="));
  }

  const schoolKey = sanitizeSchoolKey(argMap.get("school") || "");
  const metaFile = String(argMap.get("meta") || "").trim();
  const removeArtifacts = parseBoolean(argMap.get("remove-artifacts"), true);

  if (!schoolKey && !metaFile) {
    throw new Error("Provide --school=<schoolKey> or --meta=<metadataFile>.");
  }

  return {
    schoolKey,
    metaFile,
    removeArtifacts,
  };
}

async function readMeta(metaFile: string) {
  if (!metaFile) {
    return null;
  }

  const raw = await fs.readFile(metaFile, "utf8");
  return JSON.parse(raw) as ReadinessMeta;
}

async function removeFileIfPresent(filePath: string) {
  const normalizedPath = String(filePath || "").trim();
  if (!normalizedPath) {
    return false;
  }

  try {
    await fs.rm(normalizedPath, { force: true });
    return true;
  } catch {
    return false;
  }
}

async function cleanupLearningContentReadiness(args: ParsedArgs) {
  const [
    { connectDB },
    { getTenantDb, getTenantModels },
    { deleteExamRuntimeDataForSchool },
    redisModule,
    { invalidateStudentDashboardCacheForStudents },
    reportDispatchJobModule,
    schoolModule,
    studentNotificationJobModule,
  ] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db-tenant"),
    import("@/lib/exam-runtime"),
    import("@/lib/redis"),
    import("@/lib/server/student-dashboard-cache"),
    import("@/models/ReportDispatchJob"),
    import("@/models/School"),
    import("@/models/StudentNotificationJob"),
  ]);
  const { clearStudentLoginRateLimit, clearStudentSession } = redisModule;
  const ReportDispatchJob = reportDispatchJobModule.default;
  const School = schoolModule.default;
  const StudentNotificationJob = studentNotificationJobModule.default;
  const meta = await readMeta(args.metaFile);
  const schoolKey = sanitizeSchoolKey(args.schoolKey || meta?.schoolKey || "");
  if (!schoolKey) {
    throw new Error("Unable to resolve the school key for cleanup.");
  }

  await connectDB();

  const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
  const students = await UserModel.find({ role: "student" })
    .select("_id rollNumber")
    .lean()
    .catch(() => []);

  const studentIds = students
    .map((student: any) => String(student?._id || "").trim())
    .filter(Boolean);

  await Promise.all(
    students.flatMap((student: any) => {
      const studentId = String(student?._id || "").trim();
      const rollNumber = String(student?.rollNumber || "").trim();
      return [
        studentId ? clearStudentSession(schoolKey, studentId) : Promise.resolve(null),
        rollNumber
          ? clearStudentLoginRateLimit(schoolKey, rollNumber)
          : Promise.resolve(undefined),
      ];
    }),
  );

  await invalidateStudentDashboardCacheForStudents(schoolKey, studentIds).catch(
    () => undefined,
  );

  await Promise.all([
    StudentNotificationJob.deleteMany({ schoolKey }).catch(() => undefined),
    ReportDispatchJob.deleteMany({ schoolKey }).catch(() => undefined),
  ]);

  const runtimeCleanup = await deleteExamRuntimeDataForSchool(schoolKey);

  try {
    const tenantDb = await getTenantDb(schoolKey);
    await tenantDb.dropDatabase().catch(() => undefined);
  } catch {}

  const deletedSchool = await School.findOneAndDelete({ key: schoolKey })
    .select("key")
    .lean();

  const removedFiles = [];
  if (args.removeArtifacts) {
    const candidates = Array.from(
      new Set(
        [args.metaFile, String(meta?.studentsFile || "").trim()].filter(Boolean),
      ),
    );
    for (const filePath of candidates) {
      if (await removeFileIfPresent(filePath)) {
        removedFiles.push(filePath);
      }
    }
  }

  return {
    schoolKey,
    runtimeEnabled: runtimeCleanup.runtimeEnabled,
    deletedAttempts: runtimeCleanup.deletedAttempts,
    deletedSnapshots: runtimeCleanup.deletedSnapshots,
    deletedSchool: Boolean(deletedSchool?.key),
    removedFiles,
    studentCount: studentIds.length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summary = await cleanupLearningContentReadiness(args);

  console.log("[learning-content-readiness-cleanup] complete");
  console.log(`School: ${summary.schoolKey}`);
  console.log(`Students: ${summary.studentCount}`);
  console.log(`Runtime enabled: ${summary.runtimeEnabled ? "yes" : "no"}`);
  console.log(`Deleted runtime attempts: ${summary.deletedAttempts}`);
  console.log(`Deleted runtime snapshots: ${summary.deletedSnapshots}`);
  console.log(`Deleted school record: ${summary.deletedSchool ? "yes" : "no"}`);
  console.log(
    `Removed files: ${
      summary.removedFiles.length > 0 ? summary.removedFiles.join(", ") : "none"
    }`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
