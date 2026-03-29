import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  resolveManagedOnlineTestBaseUrl,
  resolveOnlineTestServerMode,
  withOnlineTestServer,
} from "./online-test-server.ts";

type ParsedArgs = {
  baseUrl: string;
  schoolKey: string;
  paperId: string;
  studentsFile: string;
  autoSeed: boolean;
  cleanupSeeded: boolean;
  seedStudents: number;
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
  serverMode?: string;
  outFile: string;
  gateOutFile: string;
};

type SeedMeta = {
  schoolKey: string;
  paperId: string;
  studentsFile: string;
  studentCount: number;
};

type StressInputs = {
  schoolKey: string;
  paperId: string;
  studentsFile: string;
  seeded: boolean;
  seedMetaFile: string;
  cleanupEligible: boolean;
};

function printHelp() {
  console.log(
    [
      "Usage: npm run stress:online-test:browser -- [options]",
      "",
      "Options:",
      "  --base=<url>                      App base URL (default: http://localhost:3000)",
      "  --school=<schoolKey>              Existing school key to reuse instead of auto-seeding",
      "  --paper=<paperId>                 Existing paper id to reuse instead of auto-seeding",
      "  --students=<jsonFile>             Existing student credential file to reuse",
      "  --auto-seed=<true|false>          Seed disposable data when inputs are missing (default: true)",
      "  --cleanup-seeded=<true|false>     Delete auto-generated seed data after the run (default: false)",
      "  --seed-students=<n>               Number of disposable students to seed (default: 25)",
      "  --concurrency=<n>                 Concurrent browser student flows (default: 25)",
      "  --rounds=<n>                      Answer/save rounds per student before submit (default: 3)",
      "  --round-delay-ms=<ms>             Delay between save rounds (default: 400)",
      "  --jitter-ms=<ms>                  Random delay jitter added per round (default: 150)",
      "  --navigation-timeout-ms=<ms>      Page navigation timeout (default: 30000)",
      "  --action-timeout-ms=<ms>          UI action timeout (default: 15000)",
      "  --sample-size=<n>                 Persisted-attempt audit sample size (default: 10)",
      "  --submit=<true|false>             Submit attempts at the end of the flow (default: true)",
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
      "  --server-mode=<mode>              external, dev, or prod (default: auto from --base)",
      "  --out=<jsonFile>                  Browser stress summary output path",
      "  --gate-out=<jsonFile>             Gate report output path",
      "  --help                            Show this help text",
      "",
      "Notes:",
      "  - If --school, --paper, and --students are omitted, disposable browser-stress data is seeded automatically.",
      "  - --cleanup-seeded=true only auto-deletes data when the school key was auto-generated for the run.",
      "  - Loopback base URLs use a managed local Next production server by default; use --server-mode=dev for quicker smoke checks.",
      "  - If the requested loopback port is already in use, managed runs automatically move to the next free local port.",
      "  - This wrapper runs the browser load gate and exits non-zero when gate checks fail.",
    ].join("\n"),
  );
}

function resolveCommand(name: string) {
  return process.platform === "win32" ? `${name}.cmd` : name;
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

function parseArgMap(argv: string[]) {
  const argMap = new Map<string, string>();
  for (const rawArg of argv) {
    const arg = String(rawArg || "");
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    argMap.set(key, rest.join("="));
  }
  return argMap;
}

function parseArgs(argv: string[]): ParsedArgs {
  const argMap = parseArgMap(argv);
  const outFile =
    String(argMap.get("out") || "").trim() ||
    path.resolve(`/tmp/online-test-browser-stress-${Date.now()}.json`);
  const gateOutFile =
    String(argMap.get("gate-out") || "").trim() || `${outFile}.gate.json`;

  return {
    baseUrl: normalizeBaseUrl(
      argMap.get("base") || process.env.ONLINE_TEST_BROWSER_GATE_BASE || "",
    ),
    schoolKey: String(
      argMap.get("school") || process.env.ONLINE_TEST_BROWSER_GATE_SCHOOL || "",
    )
      .trim()
      .toLowerCase(),
    paperId: String(
      argMap.get("paper") || process.env.ONLINE_TEST_BROWSER_GATE_PAPER || "",
    ).trim(),
    studentsFile: String(
      argMap.get("students") ||
        process.env.ONLINE_TEST_BROWSER_GATE_STUDENTS ||
        "",
    ).trim(),
    autoSeed: parseBoolean(
      argMap.get("auto-seed") || process.env.ONLINE_TEST_BROWSER_GATE_AUTO_SEED,
      true,
    ),
    cleanupSeeded: parseBoolean(
      argMap.get("cleanup-seeded") ||
        process.env.ONLINE_TEST_BROWSER_GATE_CLEANUP_SEEDED,
      false,
    ),
    seedStudents: parsePositiveInt(
      argMap.get("seed-students") ||
        process.env.ONLINE_TEST_BROWSER_GATE_SEED_STUDENTS,
      25,
    ),
    concurrency: parsePositiveInt(
      argMap.get("concurrency") ||
        process.env.ONLINE_TEST_BROWSER_GATE_CONCURRENCY,
      25,
    ),
    rounds: parsePositiveInt(
      argMap.get("rounds") || process.env.ONLINE_TEST_BROWSER_GATE_ROUNDS,
      3,
    ),
    roundDelayMs: parsePositiveInt(
      argMap.get("round-delay-ms") ||
        process.env.ONLINE_TEST_BROWSER_GATE_ROUND_DELAY_MS,
      400,
    ),
    jitterMs: Math.max(
      0,
      Math.floor(
        parseNumber(
          argMap.get("jitter-ms") || process.env.ONLINE_TEST_BROWSER_GATE_JITTER_MS,
          150,
        ),
      ),
    ),
    navigationTimeoutMs: parsePositiveInt(
      argMap.get("navigation-timeout-ms") ||
        process.env.ONLINE_TEST_BROWSER_GATE_NAVIGATION_TIMEOUT_MS,
      30_000,
    ),
    actionTimeoutMs: parsePositiveInt(
      argMap.get("action-timeout-ms") ||
        process.env.ONLINE_TEST_BROWSER_GATE_ACTION_TIMEOUT_MS,
      15_000,
    ),
    sampleSize: parsePositiveInt(
      argMap.get("sample-size") ||
        process.env.ONLINE_TEST_BROWSER_GATE_SAMPLE_SIZE,
      10,
    ),
    submitEnabled: parseBoolean(
      argMap.get("submit") || process.env.ONLINE_TEST_BROWSER_GATE_SUBMIT,
      true,
    ),
    warmupEnabled: parseBoolean(
      argMap.get("warmup") || process.env.ONLINE_TEST_BROWSER_GATE_WARMUP,
      true,
    ),
    headlessEnabled: parseBoolean(
      argMap.get("headless") || process.env.ONLINE_TEST_BROWSER_GATE_HEADLESS,
      true,
    ),
    maxFailureRatePct: parseNumber(
      argMap.get("max-failure-rate-pct") ||
        process.env.ONLINE_TEST_BROWSER_GATE_MAX_FAILURE_RATE_PCT,
      0.5,
    ),
    maxP95AuthPageMs: parsePositiveInt(
      argMap.get("max-p95-auth-page-ms") ||
        process.env.ONLINE_TEST_BROWSER_GATE_MAX_P95_AUTH_PAGE_MS,
      2000,
    ),
    maxP95SignInMs: parsePositiveInt(
      argMap.get("max-p95-signin-ms") ||
        process.env.ONLINE_TEST_BROWSER_GATE_MAX_P95_SIGNIN_MS,
      3000,
    ),
    maxP95ListMs: parsePositiveInt(
      argMap.get("max-p95-list-ms") ||
        process.env.ONLINE_TEST_BROWSER_GATE_MAX_P95_LIST_MS,
      2000,
    ),
    maxP95OpenMs: parsePositiveInt(
      argMap.get("max-p95-open-ms") ||
        process.env.ONLINE_TEST_BROWSER_GATE_MAX_P95_OPEN_MS,
      1500,
    ),
    maxP95StartMs: parsePositiveInt(
      argMap.get("max-p95-start-ms") ||
        process.env.ONLINE_TEST_BROWSER_GATE_MAX_P95_START_MS,
      1800,
    ),
    maxP95SaveMs: parsePositiveInt(
      argMap.get("max-p95-save-ms") ||
        process.env.ONLINE_TEST_BROWSER_GATE_MAX_P95_SAVE_MS,
      1200,
    ),
    maxP95SubmitMs: parsePositiveInt(
      argMap.get("max-p95-submit-ms") ||
        process.env.ONLINE_TEST_BROWSER_GATE_MAX_P95_SUBMIT_MS,
      2200,
    ),
    serverMode:
      String(
        argMap.get("server-mode") ||
          process.env.ONLINE_TEST_BROWSER_GATE_SERVER_MODE ||
          "",
      ).trim() || undefined,
    outFile,
    gateOutFile,
  };
}

function runCommand(
  command: string,
  args: string[],
  label: string,
  envOverrides: Record<string, string> = {},
) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(resolveCommand(command), args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...envOverrides,
    },
  });
  const exitCode = result.status === null ? 1 : result.status;
  if (exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${exitCode}.`);
  }
}

function ensureManagedSchoolUserAuthRateLimit(args: ParsedArgs, serverMode: string) {
  if (serverMode === "external") {
    return;
  }

  if (String(process.env.SCHOOL_USER_AUTH_CALLBACK_RATE_LIMIT_MAX || "").trim()) {
    return;
  }

  const derivedLimit = Math.max(
    250,
    args.seedStudents * 2,
    args.concurrency * 4,
  );
  process.env.SCHOOL_USER_AUTH_CALLBACK_RATE_LIMIT_MAX = String(derivedLimit);
  console.log(
    `School-user auth callback rate limit max: ${process.env.SCHOOL_USER_AUTH_CALLBACK_RATE_LIMIT_MAX}`,
  );
}

function ensureManagedExamRuntimePoolMax(args: ParsedArgs, serverMode: string) {
  if (serverMode === "external") {
    return;
  }

  if (String(process.env.EXAM_RUNTIME_POOL_MAX || "").trim()) {
    return;
  }

  const derivedPoolMax = Math.min(100, Math.max(20, args.concurrency));
  process.env.EXAM_RUNTIME_POOL_MAX = String(derivedPoolMax);
  console.log(`Exam runtime pool max: ${process.env.EXAM_RUNTIME_POOL_MAX}`);
}

async function maybeSeed(args: ParsedArgs): Promise<StressInputs> {
  if (args.schoolKey && args.paperId && args.studentsFile) {
    return {
      schoolKey: args.schoolKey,
      paperId: args.paperId,
      studentsFile: args.studentsFile,
      seeded: false,
      seedMetaFile: "",
      cleanupEligible: false,
    };
  }

  if (!args.autoSeed) {
    throw new Error(
      "Missing browser stress inputs. Provide --school --paper --students or enable --auto-seed=true.",
    );
  }

  const metaOut = path.resolve(`/tmp/online-test-browser-stress-seed-${Date.now()}.json`);
  runCommand(
    "npm",
    [
      "run",
      "gate:student-tests:seed",
      "--",
      ...(args.schoolKey ? [`--school=${args.schoolKey}`] : []),
      `--students=${args.seedStudents}`,
      `--meta-out=${metaOut}`,
    ],
    "Seed disposable online-exam browser stress data",
  );

  const seededMetaRaw = await fs.readFile(metaOut, "utf8");
  const seededMeta = JSON.parse(seededMetaRaw) as SeedMeta;

  if (!seededMeta.schoolKey || !seededMeta.paperId || !seededMeta.studentsFile) {
    throw new Error("Seed metadata is missing schoolKey, paperId, or studentsFile.");
  }

  return {
    schoolKey: String(seededMeta.schoolKey).trim().toLowerCase(),
    paperId: String(seededMeta.paperId).trim(),
    studentsFile: String(seededMeta.studentsFile).trim(),
    seeded: true,
    seedMetaFile: metaOut,
    cleanupEligible: !args.schoolKey,
  };
}

function cleanupSeededData(seeded: StressInputs) {
  if (!seeded.seeded || !seeded.seedMetaFile) {
    return;
  }

  runCommand(
    "npm",
    [
      "run",
      "gate:student-tests:cleanup",
      "--",
      `--meta=${seeded.seedMetaFile}`,
    ],
    "Cleanup disposable online-exam browser stress data",
  );
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

  let seeded: StressInputs | null = null;
  let runError: unknown = null;

  try {
    seeded = await maybeSeed(args);
    const stressInputs = seeded;
    const serverMode = resolveOnlineTestServerMode(args.baseUrl, args.serverMode);
    const managedBaseUrl = await resolveManagedOnlineTestBaseUrl(
      args.baseUrl,
      serverMode,
    );
    ensureManagedSchoolUserAuthRateLimit(args, serverMode);
    ensureManagedExamRuntimePoolMax(args, serverMode);
    console.log(
      `\n== Browser stress inputs ready ==\nSchool: ${stressInputs.schoolKey}\nPaper: ${stressInputs.paperId}\nStudents file: ${stressInputs.studentsFile}\nBase URL: ${managedBaseUrl}\nServer mode: ${serverMode}`,
    );
    const commandEnv = {
      BASE_URL: managedBaseUrl,
      NEXTAUTH_URL: managedBaseUrl,
      NEXT_PUBLIC_SITE_URL: managedBaseUrl,
    };

    await withOnlineTestServer(
      {
        baseUrl: managedBaseUrl,
        mode: serverMode,
      },
      async () => {
        runCommand(
          "npm",
          [
            "run",
            "gate:student-tests:browser",
            "--",
            `--base=${managedBaseUrl}`,
            `--school=${stressInputs.schoolKey}`,
            `--paper=${stressInputs.paperId}`,
            `--students=${stressInputs.studentsFile}`,
            `--concurrency=${args.concurrency}`,
            `--rounds=${args.rounds}`,
            `--round-delay-ms=${args.roundDelayMs}`,
            `--jitter-ms=${args.jitterMs}`,
            `--navigation-timeout-ms=${args.navigationTimeoutMs}`,
            `--action-timeout-ms=${args.actionTimeoutMs}`,
            `--sample-size=${args.sampleSize}`,
            `--submit=${args.submitEnabled ? "true" : "false"}`,
            `--warmup=${args.warmupEnabled ? "true" : "false"}`,
            `--headless=${args.headlessEnabled ? "true" : "false"}`,
            `--max-failure-rate-pct=${args.maxFailureRatePct}`,
            `--max-p95-auth-page-ms=${args.maxP95AuthPageMs}`,
            `--max-p95-signin-ms=${args.maxP95SignInMs}`,
            `--max-p95-list-ms=${args.maxP95ListMs}`,
            `--max-p95-open-ms=${args.maxP95OpenMs}`,
            `--max-p95-start-ms=${args.maxP95StartMs}`,
            `--max-p95-save-ms=${args.maxP95SaveMs}`,
            `--max-p95-submit-ms=${args.maxP95SubmitMs}`,
            `--out=${args.outFile}`,
            `--gate-out=${args.gateOutFile}`,
          ],
          "Online test browser stress gate",
          commandEnv,
        );
      },
    );

    console.log(`\nBrowser stress summary: ${args.outFile}`);
    console.log(`Gate report: ${args.gateOutFile}`);
    if (stressInputs.seeded) {
      console.log("- Disposable readiness data was auto-seeded for this run.");
      if (stressInputs.seedMetaFile) {
        console.log(`Seed metadata: ${stressInputs.seedMetaFile}`);
      }
    }
  } catch (error) {
    runError = error;
  } finally {
    if (args.cleanupSeeded && seeded?.seeded) {
      if (seeded.cleanupEligible) {
        try {
          cleanupSeededData(seeded);
        } catch (cleanupError) {
          if (!runError) {
            runError = cleanupError;
          } else {
            console.error(
              cleanupError instanceof Error
                ? cleanupError.message
                : String(cleanupError),
            );
          }
        }
      } else {
        console.log(
          "Cleanup skipped because the seeded school key was provided explicitly. Use gate:student-tests:cleanup to remove it manually.",
        );
      }
    }
  }

  if (runError) {
    throw runError;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
