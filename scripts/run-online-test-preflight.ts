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
  seedStudents: number;
  concurrency: number;
  rounds: number;
  serverMode?: string;
};

type SeedMeta = {
  schoolKey: string;
  paperId: string;
  studentsFile: string;
  studentCount: number;
};

function printHelp() {
  console.log(
    [
      "Usage: npm run preflight:online-test -- [options]",
      "",
      "Options:",
      "  --base=<url>                  App base URL (default: http://127.0.0.1:3000)",
      "  --school=<schoolKey>          Existing school key to reuse instead of auto-seeding",
      "  --paper=<paperId>             Existing paper id to reuse instead of auto-seeding",
      "  --students=<jsonFile>         Existing student credential file to reuse",
      "  --auto-seed=<true|false>      Seed disposable data when inputs are missing (default: true)",
      "  --seed-students=<n>           Number of disposable students to seed (default: 100)",
      "  --concurrency=<n>             Concurrent student flows for the load gate (default: 100)",
      "  --rounds=<n>                  Save rounds per student before submit (default: 3)",
      "  --server-mode=<mode>          external, dev, or prod (default: auto from --base)",
      "  --help                        Show this help text",
      "",
      "What it runs:",
      "  1. npm run typecheck",
      "  2. targeted lint for student online-test routes",
      "  3. integration e2e against the online student test flow",
      "  4. the online student load gate with list/detail/start/save/heartbeat/submit coverage",
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

function parsePositiveInt(value: string | undefined, defaultValue: number) {
  const normalized = String(value || "").trim();
  if (!normalized) return defaultValue;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer: ${value}`);
  }
  return Math.floor(parsed);
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
  return {
    baseUrl:
      String(argMap.get("base") || process.env.ONLINE_TEST_GATE_BASE || "").trim() ||
      "http://127.0.0.1:3000",
    schoolKey: String(
      argMap.get("school") || process.env.ONLINE_TEST_GATE_SCHOOL || "",
    )
      .trim()
      .toLowerCase(),
    paperId: String(argMap.get("paper") || process.env.ONLINE_TEST_GATE_PAPER || "").trim(),
    studentsFile: String(
      argMap.get("students") || process.env.ONLINE_TEST_GATE_STUDENTS || "",
    ).trim(),
    autoSeed: parseBoolean(
      argMap.get("auto-seed") || process.env.ONLINE_TEST_GATE_AUTO_SEED,
      true,
    ),
    seedStudents: parsePositiveInt(
      argMap.get("seed-students") || process.env.ONLINE_TEST_GATE_SEED_STUDENTS,
      100,
    ),
    concurrency: parsePositiveInt(
      argMap.get("concurrency") || process.env.ONLINE_TEST_GATE_CONCURRENCY,
      100,
    ),
    rounds: parsePositiveInt(
      argMap.get("rounds") || process.env.ONLINE_TEST_GATE_ROUNDS,
      3,
    ),
    serverMode:
      String(
        argMap.get("server-mode") || process.env.ONLINE_TEST_GATE_SERVER_MODE || "",
      ).trim() || undefined,
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

  const derivedPoolMax = Math.min(200, Math.max(40, args.concurrency * 2));
  process.env.EXAM_RUNTIME_POOL_MAX = String(derivedPoolMax);
  console.log(`Exam runtime pool max: ${process.env.EXAM_RUNTIME_POOL_MAX}`);
}

async function maybeSeed(args: ParsedArgs) {
  if (args.schoolKey && args.paperId && args.studentsFile) {
    return {
      schoolKey: args.schoolKey,
      paperId: args.paperId,
      studentsFile: args.studentsFile,
      seeded: false,
    };
  }

  if (!args.autoSeed) {
    throw new Error(
      "Missing load-gate inputs. Provide --school --paper --students or enable --auto-seed=true.",
    );
  }

  const metaOut = path.resolve(`/tmp/online-test-preflight-seed-${Date.now()}.json`);
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
    "Seed load-gate disposable data",
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
  };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.some((arg) => String(arg || "").startsWith("--help"))) {
    printHelp();
    return;
  }

  const args = parseArgs(argv);
  const serverMode = resolveOnlineTestServerMode(args.baseUrl, args.serverMode);
  const managedBaseUrl = await resolveManagedOnlineTestBaseUrl(
    args.baseUrl,
    serverMode,
  );
  ensureManagedSchoolUserAuthRateLimit(args, serverMode);
  ensureManagedExamRuntimePoolMax(args, serverMode);
  const commandEnv = {
    BASE_URL: managedBaseUrl,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || managedBaseUrl,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || managedBaseUrl,
  };

  runCommand("npm", ["run", "typecheck"], "Typecheck");
  runCommand(
    "npm",
    ["run", "lint:online-test"],
    "Targeted lint",
  );

  const seeded = await maybeSeed(args);

  const stressOut = path.resolve(`/tmp/online-test-preflight-stress-${Date.now()}.json`);
  const gateOut = `${stressOut}.gate.json`;

  await withOnlineTestServer(
    {
      baseUrl: managedBaseUrl,
      mode: serverMode,
    },
    async () => {
      runCommand(
        "npm",
        ["run", "test:e2e:online-integration"],
        "Student online-test integration e2e",
        {
          ...commandEnv,
          PLAYWRIGHT_USE_EXTERNAL_SERVER: "1",
        },
      );

      runCommand(
        "npm",
        [
          "run",
          "gate:student-tests:load",
          "--",
          `--base=${managedBaseUrl}`,
          `--school=${seeded.schoolKey}`,
          `--paper=${seeded.paperId}`,
          `--students=${seeded.studentsFile}`,
          `--concurrency=${args.concurrency}`,
          `--rounds=${args.rounds}`,
          "--submit=true",
          "--heartbeat=true",
          "--list-first=true",
          `--out=${stressOut}`,
          `--gate-out=${gateOut}`,
        ],
        "Student online-test load gate",
        commandEnv,
      );
    },
  );

  console.log("\n== Deployment checks still required before go-live ==");
  console.log(
    "- Session-lock coverage now runs in the real-backend integration suite.",
  );
  console.log(
    "- Runtime on/off verification is automated for managed lanes when EXAM_RUNTIME_DATABASE_URL is configured; if this preflight targets an external environment, still verify that toggle there.",
  );
  console.log(
    "- Review docs/online-test-operational-checklist.md and record rollback and canary completion before production rollout.",
  );
  console.log(`- Stress summary: ${stressOut}`);
  console.log(`- Gate report: ${gateOut}`);
  if (seeded.seeded) {
    console.log("- Disposable readiness data was auto-seeded for this run.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
