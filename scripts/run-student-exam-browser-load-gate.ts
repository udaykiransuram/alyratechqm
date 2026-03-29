import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { syncExamRuntimeMongoProjectionsForPaper } from "@/lib/exam-runtime";

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
  navigationTimeoutMs: number;
  actionTimeoutMs: number;
  sampleSize: number;
  submitEnabled: boolean;
  warmupEnabled: boolean;
  headlessEnabled: boolean;
  maxFailureRatePct: number;
  maxP95AuthPageMs: number;
  maxP95SignInMs: number;
  maxP95ListMs: number;
  maxP95OpenMs: number;
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
  cleanupWarning?: string;
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
      "Usage: npm run gate:student-tests:browser -- --school=<schoolKey> --paper=<paperId> --students=<jsonFile> [options]",
      "",
      "Required:",
      "  --school=<schoolKey>              School key for the student accounts",
      "  --paper=<paperId>                 Online paper id to audit",
      "  --students=<jsonFile>             JSON file with browser stress student credentials",
      "",
      "Options:",
      "  --base=<url>                      App base URL (default: http://localhost:3000)",
      "  --out=<jsonFile>                  Browser stress summary output path",
      "  --gate-out=<jsonFile>             Gate report output path",
      "  --concurrency=<n>                 Concurrent browser student flows (default: 25)",
      "  --rounds=<n>                      Answer/save rounds before final submit (default: 3)",
      "  --round-delay-ms=<ms>             Delay between save rounds (default: 400)",
      "  --jitter-ms=<ms>                  Random delay jitter added per round (default: 150)",
      "  --navigation-timeout-ms=<ms>      Page navigation timeout (default: 30000)",
      "  --action-timeout-ms=<ms>          UI action timeout (default: 15000)",
      "  --sample-size=<n>                 Persisted-attempt audit sample size (default: 10)",
      "  --submit=<true|false>             Submit after save rounds (default: true)",
      "  --warmup=<true|false>             Prewarm sign-in/list/detail routes before measuring (default: true)",
      "  --headless=<true|false>           Launch Chromium headless (default: true)",
      "  --max-failure-rate-pct=<n>        Max allowed failure rate percentage (default: 0.5)",
      "  --max-p95-auth-page-ms=<ms>       Max allowed ui.auth.page p95 latency (default: 2000)",
      "  --max-p95-signin-ms=<ms>          Max allowed ui.auth.signin p95 latency (default: 3000)",
      "  --max-p95-list-ms=<ms>            Max allowed ui.test.list p95 latency (default: 2000)",
      "  --max-p95-open-ms=<ms>            Max allowed ui.test.open p95 latency (default: 1500)",
      "  --max-p95-start-ms=<ms>           Max allowed ui.test.start p95 latency (default: 1800)",
      "  --max-p95-save-ms=<ms>            Max allowed ui.test.save p95 latency (default: 1200)",
      "  --max-p95-submit-ms=<ms>          Max allowed ui.test.submit p95 latency (default: 2200)",
      "  --help                            Show this help text",
      "",
      "Notes:",
      "  - This wraps the browser/UI stress harness, enforces latency/failure thresholds, and audits persisted attempts.",
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

function normalizeBaseUrl(value: string | undefined) {
  const normalized = String(value || "").trim() || "http://localhost:3000";
  const withScheme = /^https?:\/\//i.test(normalized)
    ? normalized
    : `http://${normalized}`;

  try {
    const parsed = new URL(withScheme);
    const hostname = String(parsed.hostname || "").trim().toLowerCase();
    if (
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1"
    ) {
      parsed.hostname = "localhost";
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return withScheme.replace(/\/$/, "");
  }
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
    path.resolve(`/tmp/online-test-browser-load-gate-${Date.now()}.json`);
  const gateOutFile =
    String(argMap.get("gate-out") || "").trim() || `${outFile}.gate.json`;

  return {
    baseUrl: normalizeBaseUrl(argMap.get("base") || "http://localhost:3000"),
    schoolKey,
    paperId,
    studentsFile,
    outFile,
    gateOutFile,
    concurrency: parsePositiveInt(argMap.get("concurrency"), 25),
    rounds: parsePositiveInt(argMap.get("rounds"), 3),
    roundDelayMs: parsePositiveInt(argMap.get("round-delay-ms"), 400),
    jitterMs: Math.max(0, Math.floor(parseNumber(argMap.get("jitter-ms"), 150))),
    navigationTimeoutMs: parsePositiveInt(
      argMap.get("navigation-timeout-ms"),
      30_000,
    ),
    actionTimeoutMs: parsePositiveInt(argMap.get("action-timeout-ms"), 15_000),
    sampleSize: parsePositiveInt(argMap.get("sample-size"), 10),
    submitEnabled: parseBoolean(argMap.get("submit"), true),
    warmupEnabled: parseBoolean(argMap.get("warmup"), true),
    headlessEnabled: parseBoolean(argMap.get("headless"), true),
    maxFailureRatePct: parseNumber(argMap.get("max-failure-rate-pct"), 0.5),
    maxP95AuthPageMs: parsePositiveInt(argMap.get("max-p95-auth-page-ms"), 2000),
    maxP95SignInMs: parsePositiveInt(argMap.get("max-p95-signin-ms"), 3000),
    maxP95ListMs: parsePositiveInt(argMap.get("max-p95-list-ms"), 2000),
    maxP95OpenMs: parsePositiveInt(argMap.get("max-p95-open-ms"), 1500),
    maxP95StartMs: parsePositiveInt(argMap.get("max-p95-start-ms"), 1800),
    maxP95SaveMs: parsePositiveInt(argMap.get("max-p95-save-ms"), 1200),
    maxP95SubmitMs: parsePositiveInt(argMap.get("max-p95-submit-ms"), 2200),
  };
}

function runStressScript(args: ParsedArgs) {
  const stressArgs = [
    "scripts/stress-student-exam-browser.mjs",
    `--base=${args.baseUrl}`,
    `--school=${args.schoolKey}`,
    `--paper=${args.paperId}`,
    `--students=${args.studentsFile}`,
    `--concurrency=${args.concurrency}`,
    `--rounds=${args.rounds}`,
    `--round-delay-ms=${args.roundDelayMs}`,
    `--jitter-ms=${args.jitterMs}`,
    `--navigation-timeout-ms=${args.navigationTimeoutMs}`,
    `--action-timeout-ms=${args.actionTimeoutMs}`,
    `--submit=${args.submitEnabled ? "true" : "false"}`,
    `--warmup=${args.warmupEnabled ? "true" : "false"}`,
    `--headless=${args.headlessEnabled ? "true" : "false"}`,
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

  await syncExamRuntimeMongoProjectionsForPaper(
    params.schoolKey,
    params.paperId,
  ).catch(() => undefined);

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
        message: "Missing student identifier in browser stress result row.",
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

  let rawOutput = "";
  try {
    rawOutput = await fs.readFile(args.outFile, "utf8");
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      throw new Error(
        `The browser stress script exited before writing ${args.outFile}. Check the earlier browser error in the log for the primary failure.`,
      );
    }
    throw error;
  }
  const stressOutput = JSON.parse(rawOutput) as StressOutput;
  const requestRows = Array.isArray(stressOutput.requestSummary)
    ? stressOutput.requestSummary
    : [];

  const authPageStep = getStepSummary(requestRows, "ui.auth.page");
  const signInStep = getStepSummary(requestRows, "ui.auth.signin");
  const listStep = getStepSummary(requestRows, "ui.test.list");
  const openStep = getStepSummary(requestRows, "ui.test.open");
  const startStep = getStepSummary(requestRows, "ui.test.start");
  const saveStep = getStepSummary(requestRows, "ui.test.save");
  const submitStep = getStepSummary(requestRows, "ui.test.submit");

  const checks: Array<{ name: string; ok: boolean; details: string }> = [];
  checks.push({
    name: "stress_exit_code",
    ok: stressExitCode === 0,
    details: `browser stress script exit code=${stressExitCode}`,
  });

  const authPageFailureRatePct = calculateFailureRatePct(authPageStep);
  const signInFailureRatePct = calculateFailureRatePct(signInStep);
  const listFailureRatePct = calculateFailureRatePct(listStep);
  const openFailureRatePct = calculateFailureRatePct(openStep);
  const startFailureRatePct = calculateFailureRatePct(startStep);
  const saveFailureRatePct = calculateFailureRatePct(saveStep);
  checks.push({
    name: "auth_page_failure_rate",
    ok: authPageFailureRatePct < args.maxFailureRatePct,
    details: `ui.auth.page failure rate=${authPageFailureRatePct.toFixed(3)}% (threshold < ${args.maxFailureRatePct}%)`,
  });
  checks.push({
    name: "signin_failure_rate",
    ok: signInFailureRatePct < args.maxFailureRatePct,
    details: `ui.auth.signin failure rate=${signInFailureRatePct.toFixed(3)}% (threshold < ${args.maxFailureRatePct}%)`,
  });
  checks.push({
    name: "list_failure_rate",
    ok: listFailureRatePct < args.maxFailureRatePct,
    details: `ui.test.list failure rate=${listFailureRatePct.toFixed(3)}% (threshold < ${args.maxFailureRatePct}%)`,
  });
  checks.push({
    name: "open_failure_rate",
    ok: openFailureRatePct < args.maxFailureRatePct,
    details: `ui.test.open failure rate=${openFailureRatePct.toFixed(3)}% (threshold < ${args.maxFailureRatePct}%)`,
  });
  checks.push({
    name: "start_failure_rate",
    ok: startFailureRatePct < args.maxFailureRatePct,
    details: `ui.test.start failure rate=${startFailureRatePct.toFixed(3)}% (threshold < ${args.maxFailureRatePct}%)`,
  });
  checks.push({
    name: "save_failure_rate",
    ok: saveFailureRatePct < args.maxFailureRatePct,
    details: `ui.test.save failure rate=${saveFailureRatePct.toFixed(3)}% (threshold < ${args.maxFailureRatePct}%)`,
  });

  if (args.submitEnabled) {
    const submitFailureRatePct = calculateFailureRatePct(submitStep);
    checks.push({
      name: "submit_failure_rate",
      ok: submitFailureRatePct < args.maxFailureRatePct,
      details: `ui.test.submit failure rate=${submitFailureRatePct.toFixed(3)}% (threshold < ${args.maxFailureRatePct}%)`,
    });
  }

  const authPageP95 = Number(authPageStep?.p95Ms || 0);
  const signInP95 = Number(signInStep?.p95Ms || 0);
  const listP95 = Number(listStep?.p95Ms || 0);
  const openP95 = Number(openStep?.p95Ms || 0);
  const startP95 = Number(startStep?.p95Ms || 0);
  const saveP95 = Number(saveStep?.p95Ms || 0);
  checks.push({
    name: "auth_page_p95",
    ok: authPageP95 > 0 && authPageP95 < args.maxP95AuthPageMs,
    details: `ui.auth.page p95=${authPageP95}ms (threshold < ${args.maxP95AuthPageMs}ms)`,
  });
  checks.push({
    name: "signin_p95",
    ok: signInP95 > 0 && signInP95 < args.maxP95SignInMs,
    details: `ui.auth.signin p95=${signInP95}ms (threshold < ${args.maxP95SignInMs}ms)`,
  });
  checks.push({
    name: "list_p95",
    ok: listP95 > 0 && listP95 < args.maxP95ListMs,
    details: `ui.test.list p95=${listP95}ms (threshold < ${args.maxP95ListMs}ms)`,
  });
  checks.push({
    name: "open_p95",
    ok: openP95 > 0 && openP95 < args.maxP95OpenMs,
    details: `ui.test.open p95=${openP95}ms (threshold < ${args.maxP95OpenMs}ms)`,
  });
  checks.push({
    name: "start_p95",
    ok: startP95 > 0 && startP95 < args.maxP95StartMs,
    details: `ui.test.start p95=${startP95}ms (threshold < ${args.maxP95StartMs}ms)`,
  });
  checks.push({
    name: "save_p95",
    ok: saveP95 > 0 && saveP95 < args.maxP95SaveMs,
    details: `ui.test.save p95=${saveP95}ms (threshold < ${args.maxP95SaveMs}ms)`,
  });

  if (args.submitEnabled) {
    const submitP95 = Number(submitStep?.p95Ms || 0);
    checks.push({
      name: "submit_p95",
      ok: submitP95 > 0 && submitP95 < args.maxP95SubmitMs,
      details: `ui.test.submit p95=${submitP95}ms (threshold < ${args.maxP95SubmitMs}ms)`,
    });
  }

  const successfulResults = (
    Array.isArray(stressOutput.results) ? stressOutput.results : []
  ).filter((result) => result?.ok);
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

  console.log("\nOnline Test Browser Load Gate Report");
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
