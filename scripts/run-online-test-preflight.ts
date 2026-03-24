import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

type ParsedArgs = {
  baseUrl: string;
  schoolKey: string;
  paperId: string;
  studentsFile: string;
  autoSeed: boolean;
  seedStudents: number;
  concurrency: number;
  rounds: number;
};

type SeedMeta = {
  schoolKey: string;
  paperId: string;
  studentsFile: string;
  studentCount: number;
};

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
  };
}

function runCommand(command: string, args: string[], label: string) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });
  const exitCode = result.status === null ? 1 : result.status;
  if (exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${exitCode}.`);
  }
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
  const args = parseArgs(process.argv.slice(2));

  runCommand("npm", ["run", "typecheck"], "Typecheck");
  runCommand(
    "npm",
    [
      "run",
      "lint",
      "--",
      "--file",
      "app/api/student/tests/route.ts",
      "--file",
      "app/api/student/tests/[paperId]/route.ts",
      "--file",
      "app/api/student/tests/[paperId]/attempt/route.ts",
      "--file",
      "app/api/student/tests/[paperId]/submit/route.ts",
      "--file",
      "app/api/student/session/heartbeat/route.ts",
    ],
    "Targeted lint",
  );
  runCommand(
    "npm",
    ["run", "test:e2e:online-integration"],
    "Student online-test integration e2e",
  );

  const seeded = await maybeSeed(args);

  const stressOut = path.resolve(`/tmp/online-test-preflight-stress-${Date.now()}.json`);
  const gateOut = `${stressOut}.gate.json`;

  runCommand(
    "npm",
    [
      "run",
      "gate:student-tests:load",
      "--",
      `--base=${args.baseUrl}`,
      `--school=${seeded.schoolKey}`,
      `--paper=${seeded.paperId}`,
      `--students=${seeded.studentsFile}`,
      `--concurrency=${args.concurrency}`,
      `--rounds=${args.rounds}`,
      "--submit=true",
      "--heartbeat=true",
      `--out=${stressOut}`,
      `--gate-out=${gateOut}`,
    ],
    "Student online-test load gate",
  );

  console.log("\n== Manual operational checks required before go-live ==");
  console.log(
    "- Review docs/online-test-operational-checklist.md and record completion for session lock, exam-runtime toggle, and rollback checks.",
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
