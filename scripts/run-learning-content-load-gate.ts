import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import mongoose from "mongoose";

type ParsedArgs = {
  metaFile: string;
  baseUrl: string;
  outFile: string;
  gateOutFile: string;
  concurrency: number;
  rounds: number;
  roundDelayMs: number;
  jitterMs: number;
  timeoutMs: number;
  sampleSize: number;
  maxFailureRatePct: number;
  maxP95PageMs: number;
  maxP99PageMs: number;
  maxP95DashboardMs: number;
  maxP99DashboardMs: number;
  maxP95CourseListMs: number;
  maxP99CourseListMs: number;
  maxP95CourseDetailMs: number;
  maxP99CourseDetailMs: number;
  maxP95CourseProgressMs: number;
  maxP99CourseProgressMs: number;
  maxP95DiaryListMs: number;
  maxP99DiaryListMs: number;
  maxP95DiaryDetailMs: number;
  maxP99DiaryDetailMs: number;
  maxP95DiaryStateMs: number;
  maxP99DiaryStateMs: number;
  maxP95NotificationsMs: number;
  maxP99NotificationsMs: number;
};

type StressRequestSummaryRow = {
  step: string;
  count: number;
  failures: number;
  avgMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  maxMs: number | null;
  sampleFailure?: {
    status: number;
    message: string;
  } | null;
};

type StressResult = {
  student: string;
  identifier: string;
  studentId?: string;
  ok: boolean;
  error?: string;
  totalDurationMs?: number;
};

type StressOutput = {
  generatedAt?: string;
  config?: {
    baseUrl?: string;
    concurrency?: number;
    rounds?: number;
    roundDelayMs?: number;
    jitterMs?: number;
    timeoutMs?: number;
    metaFile?: string;
    schoolKey?: string;
    courseId?: string;
    diaryEntryId?: string;
  };
  summary: {
    students: number;
    succeeded: number;
    failed: number;
    totalDurationMs: number;
  };
  requestSummary: StressRequestSummaryRow[];
  results: StressResult[];
};

type LearningContentMeta = {
  schoolKey: string;
  courseId: string;
  diaryEntryId: string;
  studentsFile: string;
  courseProgress: {
    viewedBlockId: string;
    completedBlockId: string;
    bookmarkedBlockId: string;
    noteBlockId: string;
  };
};

type AuditRow = {
  identifier: string;
  ok: boolean;
  message: string;
};

type CheckResult = {
  name: string;
  pass: boolean;
  actual: string;
  expected: string;
};

function printHelp() {
  console.log(
    [
      "Usage: npm run gate:learning-content:load -- --meta=<jsonFile> [options]",
      "",
      "Required:",
      "  --meta=<jsonFile>                 Metadata file from gate:learning-content:seed",
      "",
      "Options:",
      "  --base=<url>                     App base URL (default: http://127.0.0.1:3000)",
      "  --out=<jsonFile>                 Raw stress summary output path",
      "  --gate-out=<jsonFile>            Gate report output path",
      "  --concurrency=<n>                Concurrent student flows (default: 60)",
      "  --rounds=<n>                     Interaction rounds per student (default: 2)",
      "  --round-delay-ms=<ms>            Delay between rounds (default: 150)",
      "  --jitter-ms=<ms>                 Random round jitter (default: 75)",
      "  --timeout-ms=<ms>                Per-request timeout (default: 15000)",
      "  --sample-size=<n>                Persistence audit sample size (default: 10)",
      "  --max-failure-rate-pct=<n>       Max allowed student failure rate percentage (default: 1)",
      "  --max-p95-page-ms=<ms>           Max allowed page-route p95 latency (default: 2200)",
      "  --max-p99-page-ms=<ms>           Max allowed page-route p99 latency (default: 3200)",
      "  --max-p95-dashboard-ms=<ms>      Max allowed dashboard API p95 latency (default: 1200)",
      "  --max-p99-dashboard-ms=<ms>      Max allowed dashboard API p99 latency (default: 1800)",
      "  --max-p95-course-list-ms=<ms>    Max allowed course list API p95 latency (default: 1400)",
      "  --max-p99-course-list-ms=<ms>    Max allowed course list API p99 latency (default: 2100)",
      "  --max-p95-course-detail-ms=<ms>  Max allowed course detail API p95 latency (default: 1600)",
      "  --max-p99-course-detail-ms=<ms>  Max allowed course detail API p99 latency (default: 2400)",
      "  --max-p95-course-progress-ms=<ms> Max allowed course progress PATCH p95 latency (default: 1000)",
      "  --max-p99-course-progress-ms=<ms> Max allowed course progress PATCH p99 latency (default: 1600)",
      "  --max-p95-diary-list-ms=<ms>     Max allowed diary list API p95 latency (default: 1200)",
      "  --max-p99-diary-list-ms=<ms>     Max allowed diary list API p99 latency (default: 1800)",
      "  --max-p95-diary-detail-ms=<ms>   Max allowed diary detail API p95 latency (default: 1200)",
      "  --max-p99-diary-detail-ms=<ms>   Max allowed diary detail API p99 latency (default: 1800)",
      "  --max-p95-diary-state-ms=<ms>    Max allowed diary state PATCH p95 latency (default: 800)",
      "  --max-p99-diary-state-ms=<ms>    Max allowed diary state PATCH p99 latency (default: 1200)",
      "  --max-p95-notifications-ms=<ms>  Max allowed notifications API p95 latency (default: 800)",
      "  --max-p99-notifications-ms=<ms>  Max allowed notifications API p99 latency (default: 1200)",
      "  --help                           Show this help text",
      "",
      "Notes:",
      "  - This script wraps stress:learning-content, enforces thresholds, and audits persisted course/diary state.",
      "  - The gate exits non-zero when any threshold or persistence audit fails.",
    ].join("\n"),
  );
}

function parseNumber(value: string | undefined, defaultValue: number) {
  const normalized = String(value || "").trim();
  if (!normalized) return defaultValue;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }
  return parsed;
}

function parsePositiveInt(value: string | undefined, defaultValue: number) {
  const parsed = parseNumber(value, defaultValue);
  if (parsed <= 0) {
    throw new Error(`Expected a positive integer, received: ${value}`);
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

  const metaFile = String(argMap.get("meta") || "").trim();
  if (!metaFile) {
    throw new Error("Missing required --meta argument.");
  }

  const outFile =
    String(argMap.get("out") || "").trim() ||
    path.resolve(`/tmp/learning-content-load-gate-${Date.now()}.json`);
  const gateOutFile =
    String(argMap.get("gate-out") || "").trim() || `${outFile}.gate.json`;

  return {
    metaFile,
    baseUrl: String(argMap.get("base") || "http://127.0.0.1:3000").replace(/\/$/, ""),
    outFile,
    gateOutFile,
    concurrency: parsePositiveInt(argMap.get("concurrency"), 60),
    rounds: parsePositiveInt(argMap.get("rounds"), 2),
    roundDelayMs: parsePositiveInt(argMap.get("round-delay-ms"), 150),
    jitterMs: Math.max(0, Math.floor(parseNumber(argMap.get("jitter-ms"), 75))),
    timeoutMs: parsePositiveInt(argMap.get("timeout-ms"), 15_000),
    sampleSize: parsePositiveInt(argMap.get("sample-size"), 10),
    maxFailureRatePct: parseNumber(argMap.get("max-failure-rate-pct"), 1),
    maxP95PageMs: parsePositiveInt(argMap.get("max-p95-page-ms"), 2200),
    maxP99PageMs: parsePositiveInt(argMap.get("max-p99-page-ms"), 3200),
    maxP95DashboardMs: parsePositiveInt(argMap.get("max-p95-dashboard-ms"), 1200),
    maxP99DashboardMs: parsePositiveInt(argMap.get("max-p99-dashboard-ms"), 1800),
    maxP95CourseListMs: parsePositiveInt(argMap.get("max-p95-course-list-ms"), 1400),
    maxP99CourseListMs: parsePositiveInt(argMap.get("max-p99-course-list-ms"), 2100),
    maxP95CourseDetailMs: parsePositiveInt(argMap.get("max-p95-course-detail-ms"), 1600),
    maxP99CourseDetailMs: parsePositiveInt(argMap.get("max-p99-course-detail-ms"), 2400),
    maxP95CourseProgressMs: parsePositiveInt(argMap.get("max-p95-course-progress-ms"), 1000),
    maxP99CourseProgressMs: parsePositiveInt(argMap.get("max-p99-course-progress-ms"), 1600),
    maxP95DiaryListMs: parsePositiveInt(argMap.get("max-p95-diary-list-ms"), 1200),
    maxP99DiaryListMs: parsePositiveInt(argMap.get("max-p99-diary-list-ms"), 1800),
    maxP95DiaryDetailMs: parsePositiveInt(argMap.get("max-p95-diary-detail-ms"), 1200),
    maxP99DiaryDetailMs: parsePositiveInt(argMap.get("max-p99-diary-detail-ms"), 1800),
    maxP95DiaryStateMs: parsePositiveInt(argMap.get("max-p95-diary-state-ms"), 800),
    maxP99DiaryStateMs: parsePositiveInt(argMap.get("max-p99-diary-state-ms"), 1200),
    maxP95NotificationsMs: parsePositiveInt(argMap.get("max-p95-notifications-ms"), 800),
    maxP99NotificationsMs: parsePositiveInt(argMap.get("max-p99-notifications-ms"), 1200),
  };
}

async function loadMeta(metaFile: string) {
  const resolvedPath = path.resolve(metaFile);
  const raw = await fs.readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw) as LearningContentMeta;

  if (
    !parsed?.schoolKey ||
    !parsed?.courseId ||
    !parsed?.diaryEntryId ||
    !parsed?.courseProgress?.viewedBlockId ||
    !parsed?.courseProgress?.completedBlockId ||
    !parsed?.courseProgress?.bookmarkedBlockId ||
    !parsed?.courseProgress?.noteBlockId
  ) {
    throw new Error(`Invalid learning-content metadata file: ${resolvedPath}`);
  }

  return {
    ...parsed,
    metaFile: resolvedPath,
  };
}

function runStressScript(args: ParsedArgs) {
  const stressArgs = [
    "scripts/stress-learning-content.mjs",
    `--meta=${args.metaFile}`,
    `--base=${args.baseUrl}`,
    `--concurrency=${args.concurrency}`,
    `--rounds=${args.rounds}`,
    `--delay-ms=${args.roundDelayMs}`,
    `--jitter-ms=${args.jitterMs}`,
    `--timeout-ms=${args.timeoutMs}`,
    `--out=${args.outFile}`,
  ];

  const result = spawnSync("node", stressArgs, {
    stdio: "inherit",
    env: process.env,
  });

  return result.status === null ? 1 : result.status;
}

function getStepSummary(
  rows: StressRequestSummaryRow[],
  step: string,
): StressRequestSummaryRow | null {
  return rows.find((row) => String(row?.step || "") === step) || null;
}

function buildExpectedCourseNoteText(identifier: string, rounds: number) {
  return `Load gate note ${identifier} round ${rounds}`;
}

function evaluateStepThreshold(params: {
  checks: CheckResult[];
  rows: StressRequestSummaryRow[];
  step: string;
  label: string;
  maxP95Ms: number;
  maxP99Ms: number;
}) {
  const summary = getStepSummary(params.rows, params.step);
  const actualP95 = summary?.p95Ms ?? null;
  const actualP99 = summary?.p99Ms ?? null;

  params.checks.push({
    name: `${params.label} p95`,
    pass: actualP95 !== null && actualP95 <= params.maxP95Ms,
    actual: actualP95 === null ? "missing" : `${actualP95} ms`,
    expected: `<= ${params.maxP95Ms} ms`,
  });
  params.checks.push({
    name: `${params.label} p99`,
    pass: actualP99 !== null && actualP99 <= params.maxP99Ms,
    actual: actualP99 === null ? "missing" : `${actualP99} ms`,
    expected: `<= ${params.maxP99Ms} ms`,
  });
}

async function auditPersistedLearningContent(params: {
  meta: Awaited<ReturnType<typeof loadMeta>>;
  successfulResults: StressResult[];
  sampleSize: number;
  rounds: number;
}) {
  const [{ connectDB }, { getTenantModels }] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db-tenant"),
  ]);

  if (params.successfulResults.length === 0) {
    return {
      sampled: 0,
      auditRows: [] as AuditRow[],
      failedAuditCount: 0,
    };
  }

  await connectDB();
  const {
    CourseProgress: CourseProgressModel,
    DiaryStudentState: DiaryStudentStateModel,
    User: UserModel,
  } = await getTenantModels(params.meta.schoolKey, [
    "CourseProgress",
    "DiaryStudentState",
    "User",
  ]);

  const sampleCount = Math.min(params.sampleSize, params.successfulResults.length);
  const sampledResults = params.successfulResults.slice(0, sampleCount);
  const auditRows: AuditRow[] = [];
  let failedAuditCount = 0;

  for (const result of sampledResults) {
    const identifier = String(result.identifier || "").trim().toUpperCase();
    const student = await UserModel.findOne({
      role: "student",
      rollNumber: identifier,
    })
      .select("_id rollNumber")
      .lean();

    if (!student?._id) {
      failedAuditCount += 1;
      auditRows.push({
        identifier,
        ok: false,
        message: "Student not found during audit.",
      });
      continue;
    }

    const [progress, diaryState] = await Promise.all([
      CourseProgressModel.findOne({
        course: params.meta.courseId,
        student: student._id,
      })
        .select(
          "viewedBlockIds completedBlockIds bookmarkedBlockIds notes lastViewedBlockId",
        )
        .lean(),
      DiaryStudentStateModel.findOne({
        entry: params.meta.diaryEntryId,
        student: student._id,
      })
        .select("status completedAt")
        .lean(),
    ]);

    const note = Array.isArray(progress?.notes)
      ? progress.notes.find(
          (candidate: any) =>
            String(candidate?.blockId || "") === params.meta.courseProgress.noteBlockId,
        )
      : null;
    const expectedNote = buildExpectedCourseNoteText(identifier, params.rounds);
    const progressOk =
      Boolean(progress) &&
      Array.isArray(progress?.viewedBlockIds) &&
      progress.viewedBlockIds.includes(params.meta.courseProgress.viewedBlockId) &&
      Array.isArray(progress?.completedBlockIds) &&
      progress.completedBlockIds.includes(
        params.meta.courseProgress.completedBlockId,
      ) &&
      Array.isArray(progress?.bookmarkedBlockIds) &&
      progress.bookmarkedBlockIds.includes(
        params.meta.courseProgress.bookmarkedBlockId,
      ) &&
      String(progress?.lastViewedBlockId || "") ===
        params.meta.courseProgress.viewedBlockId &&
      String(note?.text || "") === expectedNote;
    const diaryOk = String(diaryState?.status || "") === "completed";

    const ok = progressOk && diaryOk;
    if (!ok) {
      failedAuditCount += 1;
    }

    auditRows.push({
      identifier,
      ok,
      message: ok
        ? "Progress note, viewed/completed/bookmark fields, and diary completion all persisted."
        : [
            progressOk
              ? null
              : "Course progress persistence is missing or incomplete.",
            diaryOk ? null : "Diary completion state is missing.",
          ]
            .filter(Boolean)
            .join(" "),
    });
  }

  return {
    sampled: sampleCount,
    auditRows,
    failedAuditCount,
  };
}

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes("--help")) {
    printHelp();
    return;
  }

  const args = parseArgs(rawArgs);
  const meta = await loadMeta(args.metaFile);
  const stressExitCode = runStressScript(args);
  const rawOutput = await fs.readFile(args.outFile, "utf8");
  const stressOutput = JSON.parse(rawOutput) as StressOutput;

  const checks: CheckResult[] = [];
  const studentFailureRatePct =
    stressOutput.summary.students > 0
      ? (stressOutput.summary.failed / stressOutput.summary.students) * 100
      : 100;

  checks.push({
    name: "Student failure rate",
    pass: studentFailureRatePct <= args.maxFailureRatePct,
    actual: `${studentFailureRatePct.toFixed(2)}%`,
    expected: `<= ${args.maxFailureRatePct}%`,
  });

  evaluateStepThreshold({
    checks,
    rows: stressOutput.requestSummary,
    step: "page.student.dashboard",
    label: "Student page.dashboard",
    maxP95Ms: args.maxP95PageMs,
    maxP99Ms: args.maxP99PageMs,
  });
  evaluateStepThreshold({
    checks,
    rows: stressOutput.requestSummary,
    step: "page.student.courses",
    label: "Student page.courses",
    maxP95Ms: args.maxP95PageMs,
    maxP99Ms: args.maxP99PageMs,
  });
  evaluateStepThreshold({
    checks,
    rows: stressOutput.requestSummary,
    step: "page.student.diary",
    label: "Student page.diary",
    maxP95Ms: args.maxP95PageMs,
    maxP99Ms: args.maxP99PageMs,
  });
  evaluateStepThreshold({
    checks,
    rows: stressOutput.requestSummary,
    step: "api.student.dashboard",
    label: "Student api.dashboard",
    maxP95Ms: args.maxP95DashboardMs,
    maxP99Ms: args.maxP99DashboardMs,
  });
  evaluateStepThreshold({
    checks,
    rows: stressOutput.requestSummary,
    step: "api.student.courses",
    label: "Student api.courses",
    maxP95Ms: args.maxP95CourseListMs,
    maxP99Ms: args.maxP99CourseListMs,
  });
  evaluateStepThreshold({
    checks,
    rows: stressOutput.requestSummary,
    step: "api.student.course.detail",
    label: "Student api.course.detail",
    maxP95Ms: args.maxP95CourseDetailMs,
    maxP99Ms: args.maxP99CourseDetailMs,
  });
  evaluateStepThreshold({
    checks,
    rows: stressOutput.requestSummary,
    step: "api.student.course.progress",
    label: "Student api.course.progress",
    maxP95Ms: args.maxP95CourseProgressMs,
    maxP99Ms: args.maxP99CourseProgressMs,
  });
  evaluateStepThreshold({
    checks,
    rows: stressOutput.requestSummary,
    step: "api.student.diary",
    label: "Student api.diary",
    maxP95Ms: args.maxP95DiaryListMs,
    maxP99Ms: args.maxP99DiaryListMs,
  });
  evaluateStepThreshold({
    checks,
    rows: stressOutput.requestSummary,
    step: "api.student.diary.detail",
    label: "Student api.diary.detail",
    maxP95Ms: args.maxP95DiaryDetailMs,
    maxP99Ms: args.maxP99DiaryDetailMs,
  });
  evaluateStepThreshold({
    checks,
    rows: stressOutput.requestSummary,
    step: "api.student.diary.state",
    label: "Student api.diary.state",
    maxP95Ms: args.maxP95DiaryStateMs,
    maxP99Ms: args.maxP99DiaryStateMs,
  });
  evaluateStepThreshold({
    checks,
    rows: stressOutput.requestSummary,
    step: "api.student.notifications",
    label: "Student api.notifications",
    maxP95Ms: args.maxP95NotificationsMs,
    maxP99Ms: args.maxP99NotificationsMs,
  });

  const successfulResults = stressOutput.results.filter((result) => result.ok);
  const audit = await auditPersistedLearningContent({
    meta,
    successfulResults,
    sampleSize: args.sampleSize,
    rounds: args.rounds,
  });

  checks.push({
    name: "Persistence audit",
    pass: audit.failedAuditCount === 0,
    actual: `${audit.failedAuditCount} failed of ${audit.sampled} sampled`,
    expected: "0 failed samples",
  });

  const pass =
    stressExitCode === 0 && checks.every((check) => check.pass);

  const gateReport = {
    generatedAt: new Date().toISOString(),
    pass,
    stressExitCode,
    config: {
      metaFile: meta.metaFile,
      baseUrl: args.baseUrl,
      concurrency: args.concurrency,
      rounds: args.rounds,
      roundDelayMs: args.roundDelayMs,
      jitterMs: args.jitterMs,
      timeoutMs: args.timeoutMs,
      sampleSize: args.sampleSize,
      schoolKey: meta.schoolKey,
      courseId: meta.courseId,
      diaryEntryId: meta.diaryEntryId,
    },
    checks,
    audit,
    stressSummary: stressOutput.summary,
  };

  await fs.mkdir(path.dirname(args.gateOutFile), { recursive: true });
  await fs.writeFile(
    args.gateOutFile,
    JSON.stringify(gateReport, null, 2),
    "utf8",
  );

  console.log("[learning-content-load-gate] complete");
  console.log(`Stress output: ${args.outFile}`);
  console.log(`Gate report: ${args.gateOutFile}`);
  console.log(`Result: ${pass ? "PASS" : "FAIL"}`);

  if (!pass) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
