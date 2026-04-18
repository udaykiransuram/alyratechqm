import fs from "node:fs/promises";
import path from "node:path";

export type OnlineTestLoadProfileName =
  | "smoke"
  | "scale-1k"
  | "scale-5k"
  | "scale-10k"
  | "scale-25k"
  | "scale-50k"
  | "scale-100k";

export type OnlineTestLoadProfile = {
  name: OnlineTestLoadProfileName;
  description: string;
  totalStudents: number;
  targetTotalConcurrency: number;
  recommendedRunnerCount: number;
  rounds: number;
  roundDelayMs: number;
  jitterMs: number;
  timeoutMs: number;
  sampleSize: number;
  submitEnabled: boolean;
  heartbeatEnabled: boolean;
  listFirstEnabled: boolean;
  warmupEnabled: boolean;
  maxFailureRatePct: number;
  maxP95ListMs: number;
  maxP95StartMs: number;
  maxP95SaveMs: number;
  maxP95SubmitMs: number;
};

export type OnlineTestLoadConfigFile = Partial<{
  profile: OnlineTestLoadProfileName;
  runnerCount: number;
  runnerIndex: number;
  seedStudents: number;
  concurrency: number;
  rounds: number;
  roundDelayMs: number;
  jitterMs: number;
  timeoutMs: number;
  sampleSize: number;
  submitEnabled: boolean;
  heartbeatEnabled: boolean;
  listFirstEnabled: boolean;
  warmupEnabled: boolean;
  maxFailureRatePct: number;
  maxP95ListMs: number;
  maxP95StartMs: number;
  maxP95SaveMs: number;
  maxP95SubmitMs: number;
  baseUrl: string;
  schoolKey: string;
  paperId: string;
  studentsFile: string;
  autoSeed: boolean;
  cleanupSeeded: boolean;
  serverMode: string;
  outFile: string;
  gateOutFile: string;
}> & {
  _resolvedFrom?: string;
};

export const ONLINE_TEST_LOAD_PROFILES: Record<
  OnlineTestLoadProfileName,
  OnlineTestLoadProfile
> = {
  smoke: {
    name: "smoke",
    description: "Single-runner smoke gate for local readiness checks.",
    totalStudents: 100,
    targetTotalConcurrency: 100,
    recommendedRunnerCount: 1,
    rounds: 3,
    roundDelayMs: 400,
    jitterMs: 150,
    timeoutMs: 15_000,
    sampleSize: 10,
    submitEnabled: true,
    heartbeatEnabled: true,
    listFirstEnabled: true,
    warmupEnabled: true,
    maxFailureRatePct: 0.5,
    maxP95ListMs: 1200,
    maxP95StartMs: 1200,
    maxP95SaveMs: 800,
    maxP95SubmitMs: 1500,
  },
  "scale-1k": {
    name: "scale-1k",
    description: "Distributed 1k-concurrency gate across 10 runners.",
    totalStudents: 1000,
    targetTotalConcurrency: 1000,
    recommendedRunnerCount: 10,
    rounds: 3,
    roundDelayMs: 325,
    jitterMs: 125,
    timeoutMs: 20_000,
    sampleSize: 25,
    submitEnabled: true,
    heartbeatEnabled: true,
    listFirstEnabled: true,
    warmupEnabled: true,
    maxFailureRatePct: 1,
    maxP95ListMs: 1500,
    maxP95StartMs: 1500,
    maxP95SaveMs: 1000,
    maxP95SubmitMs: 1800,
  },
  "scale-5k": {
    name: "scale-5k",
    description: "Distributed 5k-concurrency gate across 25 runners.",
    totalStudents: 5000,
    targetTotalConcurrency: 5000,
    recommendedRunnerCount: 25,
    rounds: 3,
    roundDelayMs: 300,
    jitterMs: 100,
    timeoutMs: 25_000,
    sampleSize: 50,
    submitEnabled: true,
    heartbeatEnabled: true,
    listFirstEnabled: true,
    warmupEnabled: true,
    maxFailureRatePct: 1.5,
    maxP95ListMs: 2000,
    maxP95StartMs: 2000,
    maxP95SaveMs: 1200,
    maxP95SubmitMs: 2500,
  },
  "scale-10k": {
    name: "scale-10k",
    description: "Distributed 10k-concurrency gate across 50 runners.",
    totalStudents: 10_000,
    targetTotalConcurrency: 10_000,
    recommendedRunnerCount: 50,
    rounds: 3,
    roundDelayMs: 275,
    jitterMs: 100,
    timeoutMs: 30_000,
    sampleSize: 100,
    submitEnabled: true,
    heartbeatEnabled: true,
    listFirstEnabled: true,
    warmupEnabled: true,
    maxFailureRatePct: 2,
    maxP95ListMs: 2500,
    maxP95StartMs: 2500,
    maxP95SaveMs: 1500,
    maxP95SubmitMs: 3000,
  },
  "scale-25k": {
    name: "scale-25k",
    description: "Distributed 25k-concurrency gate across 125 runners.",
    totalStudents: 25_000,
    targetTotalConcurrency: 25_000,
    recommendedRunnerCount: 125,
    rounds: 3,
    roundDelayMs: 250,
    jitterMs: 90,
    timeoutMs: 35_000,
    sampleSize: 150,
    submitEnabled: true,
    heartbeatEnabled: true,
    listFirstEnabled: true,
    warmupEnabled: true,
    maxFailureRatePct: 2.5,
    maxP95ListMs: 3000,
    maxP95StartMs: 3000,
    maxP95SaveMs: 1800,
    maxP95SubmitMs: 3500,
  },
  "scale-50k": {
    name: "scale-50k",
    description: "Distributed 50k-concurrency gate across 250 runners.",
    totalStudents: 50_000,
    targetTotalConcurrency: 50_000,
    recommendedRunnerCount: 250,
    rounds: 2,
    roundDelayMs: 250,
    jitterMs: 90,
    timeoutMs: 40_000,
    sampleSize: 200,
    submitEnabled: true,
    heartbeatEnabled: true,
    listFirstEnabled: true,
    warmupEnabled: true,
    maxFailureRatePct: 3,
    maxP95ListMs: 3500,
    maxP95StartMs: 3500,
    maxP95SaveMs: 2000,
    maxP95SubmitMs: 4250,
  },
  "scale-100k": {
    name: "scale-100k",
    description: "Distributed 100k-concurrency gate across 500 runners.",
    totalStudents: 100_000,
    targetTotalConcurrency: 100_000,
    recommendedRunnerCount: 500,
    rounds: 2,
    roundDelayMs: 225,
    jitterMs: 80,
    timeoutMs: 45_000,
    sampleSize: 250,
    submitEnabled: true,
    heartbeatEnabled: true,
    listFirstEnabled: true,
    warmupEnabled: true,
    maxFailureRatePct: 3.5,
    maxP95ListMs: 4000,
    maxP95StartMs: 4000,
    maxP95SaveMs: 2400,
    maxP95SubmitMs: 5000,
  },
};

export function listOnlineTestLoadProfiles() {
  return Object.values(ONLINE_TEST_LOAD_PROFILES);
}

export function resolveOnlineTestLoadProfile(
  name: string | undefined | null,
): OnlineTestLoadProfile | null {
  const normalizedName = String(name || "").trim() as OnlineTestLoadProfileName;
  if (!normalizedName) {
    return null;
  }

  return ONLINE_TEST_LOAD_PROFILES[normalizedName] || null;
}

export function resolveProfileLocalConcurrency(
  profile: OnlineTestLoadProfile,
  runnerCount: number,
) {
  return Math.max(
    1,
    Math.ceil(
      profile.targetTotalConcurrency / Math.max(1, Math.floor(runnerCount || 1)),
    ),
  );
}

export async function loadOnlineTestLoadConfigFile(
  configPath: string | undefined | null,
) {
  const normalizedPath = String(configPath || "").trim();
  if (!normalizedPath) {
    return null;
  }

  const resolvedPath = path.resolve(normalizedPath);
  const raw = await fs.readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw) as OnlineTestLoadConfigFile;

  return {
    ...parsed,
    _resolvedFrom: resolvedPath,
  } satisfies OnlineTestLoadConfigFile;
}
