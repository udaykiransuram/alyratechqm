import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

type ParsedArgs = {
  baseUrl: string;
  schoolKey: string;
  paperId: string;
  studentsFile: string;
  outFile: string;
  gateOutFile: string;
  concurrency: number;
  rounds: number;
  roundDelayMs: number;
  jitterMs: number;
  timeoutMs: number;
  sampleSize: number;
  submitEnabled: boolean;
  heartbeatEnabled: boolean;
  listFirstEnabled: boolean;
  maxFailureRatePct: number;
  maxP95ListMs: number;
  maxP95StartMs: number;
  maxP95SaveMs: number;
  maxP95SubmitMs: number;
};

type StressRequestSummaryRow = {
  step: string;
  count: number;
  failures: number;
  avgMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  maxMs: number | null;
};

type StressResult = {
  student: string;
  identifier: string;
  ok: boolean;
  status: string;
  error?: string;
  totalDurationMs?: number;
};

type StressSummary = {
  students: number;
  succeeded: number;
  failed: number;
  cleanupWarnings: number;
  totalDurationMs: number;
};

type StressOutput = {
  generatedAt?: string;
  config?: {
    submitEnabled?: boolean;
  };
  summary: StressSummary;
  requestSummary: StressRequestSummaryRow[];
  results: StressResult[];
};

type AuditRow = {
  identifier: string;
  ok: boolean;
  message: string;
};

function printHelp() {
  console.log(
    [
      "Usage: npm run gate:student-tests:load -- --school=<schoolKey> --paper=<paperId> --students=<jsonFile> [options]",
      "",
      "Required:",
      "  --school=<schoolKey>          School key for the student accounts",
      "  --paper=<paperId>             Online paper id to audit",
      "  --students=<jsonFile>         JSON file with stress student credentials",
      "",
      "Options:",
      "  --base=<url>                  App base URL (default: http://127.0.0.1:3000)",
      "  --out=<jsonFile>              Stress summary output path",
      "  --gate-out=<jsonFile>         Gate report output path",
      "  --concurrency=<n>             Concurrent student flows (default: 100)",
      "  --rounds=<n>                  Save rounds before final submit (default: 3)",
      "  --round-delay-ms=<ms>         Delay between save rounds (default: 400)",
      "  --jitter-ms=<ms>              Random delay jitter added per round (default: 150)",
      "  --timeout-ms=<ms>             Per-request timeout (default: 15000)",
      "  --sample-size=<n>             Persisted-attempt audit sample size (default: 10)",
      "  --submit=<true|false>         Submit after save rounds (default: true)",
      "  --heartbeat=<true|false>      Hit the student heartbeat during the flow (default: true)",
      "  --list-first=<true|false>     Hit /api/student/tests before detail/start (default: true)",
      "  --max-failure-rate-pct=<n>    Max allowed failure rate percentage (default: 0.5)",
      "  --max-p95-list-ms=<ms>        Max allowed test.list p95 latency (default: 1200)",
      "  --max-p95-start-ms=<ms>       Max allowed test.start p95 latency (default: 1200)",
      "  --max-p95-save-ms=<ms>        Max allowed test.save p95 latency (default: 800)",
      "  --max-p95-submit-ms=<ms>      Max allowed test.submit p95 latency (default: 1500)",
      "  --help                        Show this help text",
      "",
      "Notes:",
      "  - This script wraps the raw stress harness, enforces latency/failure thresholds, and audits persisted attempts.",
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

  const schoolKey = String(argMap.get("school") || "").trim().toLowerCase();
  const paperId = String(argMap.get("paper") || "").trim();
  const studentsFile = String(argMap.get("students") || "").trim();
  if (!schoolKey || !paperId || !studentsFile) {
    throw new Error("Missing required --school, --paper, or --students argument.");
  }

  const outFile =
    String(argMap.get("out") || "").trim() ||
    path.resolve(`/tmp/online-test-load-gate-${Date.now()}.json`);
  const gateOutFile =
    String(argMap.get("gate-out") || "").trim() || `${outFile}.gate.json`;

  return {
    baseUrl: String(argMap.get("base") || "http://127.0.0.1:3000").replace(/\/$/, ""),
    schoolKey,
    paperId,
    studentsFile,
    outFile,
    gateOutFile,
    concurrency: parsePositiveInt(argMap.get("concurrency"), 100),
    rounds: parsePositiveInt(argMap.get("rounds"), 3),
    roundDelayMs: parsePositiveInt(argMap.get("round-delay-ms"), 400),
    jitterMs: Math.max(0, Math.floor(parseNumber(argMap.get("jitter-ms"), 150))),
    timeoutMs: parsePositiveInt(argMap.get("timeout-ms"), 15000),
    sampleSize: parsePositiveInt(argMap.get("sample-size"), 10),
    submitEnabled: parseBoolean(argMap.get("submit"), true),
    heartbeatEnabled: parseBoolean(argMap.get("heartbeat"), true),
    listFirstEnabled: parseBoolean(argMap.get("list-first"), true),
    maxFailureRatePct: parseNumber(argMap.get("max-failure-rate-pct"), 0.5),
    maxP95ListMs: parsePositiveInt(argMap.get("max-p95-list-ms"), 1200),
    maxP95StartMs: parsePositiveInt(argMap.get("max-p95-start-ms"), 1200),
    maxP95SaveMs: parsePositiveInt(argMap.get("max-p95-save-ms"), 800),
    maxP95SubmitMs: parsePositiveInt(argMap.get("max-p95-submit-ms"), 1500),
  };
}

function runStressScript(args: ParsedArgs) {
  const stressArgs = [
    "scripts/stress-student-exam.mjs",
    `--base=${args.baseUrl}`,
    `--school=${args.schoolKey}`,
    `--paper=${args.paperId}`,
    `--students=${args.studentsFile}`,
    `--concurrency=${args.concurrency}`,
    `--rounds=${args.rounds}`,
    `--round-delay-ms=${args.roundDelayMs}`,
    `--jitter-ms=${args.jitterMs}`,
    `--timeout-ms=${args.timeoutMs}`,
    `--submit=${args.submitEnabled ? "true" : "false"}`,
    `--heartbeat=${args.heartbeatEnabled ? "true" : "false"}`,
    `--list-first=${args.listFirstEnabled ? "true" : "false"}`,
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

function calculateFailureRatePct(stepSummary: StressRequestSummaryRow | null) {
  if (!stepSummary || !stepSummary.count) return 100;
  return (stepSummary.failures / stepSummary.count) * 100;
}

async function auditPersistedAnswers(params: {
  schoolKey: string;
  paperId: string;
  successfulResults: StressResult[];
  sampleSize: number;
  submitEnabled: boolean;
}) {
  if (params.successfulResults.length === 0) {
    return {
      sampled: 0,
      auditRows: [] as AuditRow[],
      lostAnswerCount: 0,
      failedAuditCount: 0,
    };
  }

  await connectDB();
  const { User: UserModel, QuestionPaperResponse: ResponseModel } = await getTenantModels(
    params.schoolKey,
    ["User", "QuestionPaperResponse"],
  );

  const sampleCount = Math.min(params.sampleSize, params.successfulResults.length);
  const sampledResults = params.successfulResults.slice(0, sampleCount);
  const auditRows: AuditRow[] = [];
  let lostAnswerCount = 0;
  let failedAuditCount = 0;

  for (const result of sampledResults) {
    const identifier = String(result?.identifier || "").trim();
    if (!identifier) {
      failedAuditCount += 1;
      auditRows.push({
        identifier,
        ok: false,
        message: "Missing student identifier in stress result row.",
      });
      continue;
    }

    const isEmail = identifier.includes("@");
    const user = await UserModel.findOne(
      isEmail ? { email: identifier } : { rollNumber: identifier, role: "student" },
    )
      .select("_id")
      .lean();

    if (!user?._id) {
      failedAuditCount += 1;
      auditRows.push({
        identifier,
        ok: false,
        message: "Student not found while auditing persisted answers.",
      });
      continue;
    }

    const attempt = await ResponseModel.findOne({
      paper: params.paperId,
      student: user._id,
    })
      .select("status sectionAnswers")
      .lean();

    if (!attempt) {
      failedAuditCount += 1;
      auditRows.push({
        identifier,
        ok: false,
        message: "Attempt missing for sampled student.",
      });
      continue;
    }

    const answerCount = Array.isArray(attempt.sectionAnswers)
      ? attempt.sectionAnswers.reduce((count: number, section: any) => {
          const sectionCount = Array.isArray(section?.answers)
            ? section.answers.length
            : 0;
          return count + sectionCount;
        }, 0)
      : 0;

    if (params.submitEnabled) {
      const status = String(attempt.status || "");
      if (status !== "submitted" && status !== "auto_submitted") {
        failedAuditCount += 1;
        auditRows.push({
          identifier,
          ok: false,
          message: `Expected submitted/auto_submitted status, got "${status}".`,
        });
        continue;
      }
    }

    if (answerCount <= 0) {
      lostAnswerCount += 1;
      failedAuditCount += 1;
      auditRows.push({
        identifier,
        ok: false,
        message: "Attempt exists but no persisted answers were found.",
      });
      continue;
    }

    auditRows.push({
      identifier,
      ok: true,
      message: `Attempt persisted with ${answerCount} answers.`,
    });
  }

  return {
    sampled: sampleCount,
    auditRows,
    lostAnswerCount,
    failedAuditCount,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.some((arg) => String(arg || "").startsWith("--help"))) {
    printHelp();
    return;
  }

  const args = parseArgs(argv);
  await fs.mkdir(path.dirname(args.outFile), { recursive: true });
  await fs.mkdir(path.dirname(args.gateOutFile), { recursive: true });

  const stressExitCode = runStressScript(args);

  const rawOutput = await fs.readFile(args.outFile, "utf8");
  const stressOutput = JSON.parse(rawOutput) as StressOutput;
  const requestRows = Array.isArray(stressOutput.requestSummary)
    ? stressOutput.requestSummary
    : [];

  const listStep = getStepSummary(requestRows, "test.list");
  const startStep = getStepSummary(requestRows, "test.start");
  const saveStep = getStepSummary(requestRows, "test.save");
  const submitStep = getStepSummary(requestRows, "test.submit");

  const checks: Array<{ name: string; ok: boolean; details: string }> = [];
  checks.push({
    name: "stress_exit_code",
    ok: stressExitCode === 0,
    details: `stress script exit code=${stressExitCode}`,
  });

  if (args.listFirstEnabled) {
    const listFailureRatePct = calculateFailureRatePct(listStep);
    checks.push({
      name: "list_failure_rate",
      ok: listFailureRatePct < args.maxFailureRatePct,
      details: `list failure rate=${listFailureRatePct.toFixed(3)}% (threshold < ${args.maxFailureRatePct}%)`,
    });
  }

  const saveFailureRatePct = calculateFailureRatePct(saveStep);
  const submitFailureRatePct = calculateFailureRatePct(submitStep);
  checks.push({
    name: "save_failure_rate",
    ok: saveFailureRatePct < args.maxFailureRatePct,
    details: `save failure rate=${saveFailureRatePct.toFixed(3)}% (threshold < ${args.maxFailureRatePct}%)`,
  });
  checks.push({
    name: "submit_failure_rate",
    ok: submitFailureRatePct < args.maxFailureRatePct,
    details: `submit failure rate=${submitFailureRatePct.toFixed(3)}% (threshold < ${args.maxFailureRatePct}%)`,
  });

  if (args.listFirstEnabled) {
    const listP95 = Number(listStep?.p95Ms || 0);
    checks.push({
      name: "list_p95",
      ok: listP95 > 0 && listP95 < args.maxP95ListMs,
      details: `test.list p95=${listP95}ms (threshold < ${args.maxP95ListMs}ms)`,
    });
  }

  const startP95 = Number(startStep?.p95Ms || 0);
  const saveP95 = Number(saveStep?.p95Ms || 0);
  const submitP95 = Number(submitStep?.p95Ms || 0);
  checks.push({
    name: "start_p95",
    ok: startP95 > 0 && startP95 < args.maxP95StartMs,
    details: `test.start p95=${startP95}ms (threshold < ${args.maxP95StartMs}ms)`,
  });
  checks.push({
    name: "save_p95",
    ok: saveP95 > 0 && saveP95 < args.maxP95SaveMs,
    details: `test.save p95=${saveP95}ms (threshold < ${args.maxP95SaveMs}ms)`,
  });
  checks.push({
    name: "submit_p95",
    ok: submitP95 > 0 && submitP95 < args.maxP95SubmitMs,
    details: `test.submit p95=${submitP95}ms (threshold < ${args.maxP95SubmitMs}ms)`,
  });

  const successfulResults = (Array.isArray(stressOutput.results) ? stressOutput.results : []).filter(
    (result) => result?.ok,
  );
  const audit = await auditPersistedAnswers({
    schoolKey: args.schoolKey,
    paperId: args.paperId,
    successfulResults,
    sampleSize: args.sampleSize,
    submitEnabled: args.submitEnabled,
  });
  checks.push({
    name: "lost_answer_audit",
    ok: audit.lostAnswerCount === 0 && audit.failedAuditCount === 0,
    details: `sampled=${audit.sampled}, lost_answers=${audit.lostAnswerCount}, failed_audits=${audit.failedAuditCount}`,
  });

  const passed = checks.every((check) => check.ok);

  const gateReport = {
    generatedAt: new Date().toISOString(),
    config: args,
    stressSummary: stressOutput.summary,
    requestSummary: requestRows,
    checks,
    audit,
    passed,
  };

  await fs.writeFile(args.gateOutFile, JSON.stringify(gateReport, null, 2), "utf8");

  console.log("\nOnline Test Load Gate Report");
  for (const check of checks) {
    const marker = check.ok ? "PASS" : "FAIL";
    console.log(`- [${marker}] ${check.name}: ${check.details}`);
  }
  console.log(`Gate report: ${args.gateOutFile}`);

  if (!passed) {
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
