import { createHash } from "node:crypto";

import {
  ATTEMPT_LOCK_TTL_SECONDS,
  AUTOSAVE_RATE_LIMIT_MAX,
  AUTOSAVE_RATE_WINDOW_SECONDS,
  SNAPSHOT_CACHE_TTL_SECONDS,
  STUDENT_LOGIN_RATE_LIMIT_MAX,
  STUDENT_LOGIN_RATE_WINDOW_SECONDS,
  STUDENT_SESSION_TTL_SECONDS,
} from "@/lib/student-session";

type RedisCommandValue = string | number | boolean;

type UpstashResponse<T> = {
  result?: T;
  error?: string;
};

export type RedisRateLimitResult = {
  limited: boolean;
  count: number;
  limit: number;
};

const REDIS_FAILURE_BACKOFF_MS = 30_000;

type RedisRuntimeState = {
  unavailableUntil: number;
  lastLoggedAt: number;
};

function getRedisUrl() {
  return String(process.env.UPSTASH_REDIS_REST_URL || "").trim();
}

function getRedisToken() {
  return String(process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
}

export function isRedisConfigured() {
  return Boolean(getRedisUrl() && getRedisToken());
}

function getRedisRuntimeState() {
  const globalState = globalThis as typeof globalThis & {
    __redisRuntimeState?: RedisRuntimeState;
  };

  if (!globalState.__redisRuntimeState) {
    globalState.__redisRuntimeState = {
      unavailableUntil: 0,
      lastLoggedAt: 0,
    };
  }

  return globalState.__redisRuntimeState;
}

function isRedisTemporarilyUnavailable() {
  return getRedisRuntimeState().unavailableUntil > Date.now();
}

function markRedisTemporarilyUnavailable(error: unknown) {
  const state = getRedisRuntimeState();
  const now = Date.now();
  state.unavailableUntil = now + REDIS_FAILURE_BACKOFF_MS;

  if (now - state.lastLoggedAt >= REDIS_FAILURE_BACKOFF_MS) {
    state.lastLoggedAt = now;
    console.error(
      "Redis temporarily unavailable. Falling back without Redis support:",
      error,
    );
  }
}

function markRedisAvailable() {
  getRedisRuntimeState().unavailableUntil = 0;
}

function encodeRedisValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function decodeRedisValue<T>(value: unknown): T | null {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  if (typeof value !== "string") {
    return value as T;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

async function runRedisCommand<T = unknown>(
  command: RedisCommandValue[],
): Promise<T | null> {
  if (!isRedisConfigured() || isRedisTemporarilyUnavailable()) {
    return null;
  }

  try {
    const response = await fetch(getRedisUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getRedisToken()}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(command),
    });

    const payload = (await response.json().catch(() => ({}))) as UpstashResponse<T>;
    if (!response.ok || payload.error) {
      throw new Error(payload.error || "Redis command failed.");
    }

    markRedisAvailable();

    return typeof payload.result === "undefined"
      ? null
      : (payload.result as T);
  } catch (error) {
    markRedisTemporarilyUnavailable(error);
    return null;
  }
}

async function runRedisEval<T = unknown>(
  script: string,
  keys: string[],
  args: Array<string | number>,
) {
  return runRedisCommand<T>([
    "EVAL",
    script,
    keys.length,
    ...keys,
    ...args,
  ]);
}

function buildStudentSessionKey(schoolKey: string, studentId: string) {
  return `student:session:${schoolKey}:${studentId}`;
}

function buildAttemptLockKey(
  schoolKey: string,
  paperId: string,
  studentId: string,
) {
  return `exam:attempt-lock:${schoolKey}:${paperId}:${studentId}`;
}

function buildSnapshotCacheKey(
  schoolKey: string,
  paperId: string,
  snapshotVersion: number,
) {
  return `exam:snapshot-cache:${schoolKey}:${paperId}:${snapshotVersion}`;
}

function buildStudentLoginRateLimitKey(
  schoolKey: string,
  identifier: string,
) {
  const hashedIdentifier = createHash("sha256")
    .update(identifier)
    .digest("hex");

  return `ratelimit:student-login:${schoolKey}:${hashedIdentifier}`;
}

function buildAutosaveRateLimitKey(
  schoolKey: string,
  studentId: string,
  paperId: string,
) {
  return `ratelimit:autosave:${schoolKey}:${studentId}:${paperId}`;
}

async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RedisRateLimitResult | null> {
  const count = await runRedisEval<number>(
    [
      "local nextCount = redis.call('INCR', KEYS[1])",
      "if nextCount == 1 then",
      "  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))",
      "end",
      "return nextCount",
    ].join("\n"),
    [key],
    [windowSeconds],
  );

  if (count === null) {
    return null;
  }

  return {
    limited: Number(count) > limit,
    count: Number(count),
    limit,
  };
}

export async function consumeStudentLoginRateLimit(
  schoolKey: string,
  identifier: string,
) {
  const normalizedIdentifier = String(identifier || "").trim().toLowerCase();
  if (!normalizedIdentifier || !isRedisConfigured()) {
    return null;
  }

  return consumeRateLimit(
    buildStudentLoginRateLimitKey(schoolKey, normalizedIdentifier),
    STUDENT_LOGIN_RATE_LIMIT_MAX,
    STUDENT_LOGIN_RATE_WINDOW_SECONDS,
  );
}

export async function clearStudentLoginRateLimit(
  schoolKey: string,
  identifier: string,
) {
  const normalizedIdentifier = String(identifier || "").trim().toLowerCase();
  if (!normalizedIdentifier || !isRedisConfigured()) {
    return;
  }

  await runRedisCommand(["DEL", buildStudentLoginRateLimitKey(schoolKey, normalizedIdentifier)]);
}

export async function consumeAutosaveRateLimit(
  schoolKey: string,
  studentId: string,
  paperId: string,
) {
  if (!isRedisConfigured()) {
    return null;
  }

  return consumeRateLimit(
    buildAutosaveRateLimitKey(schoolKey, studentId, paperId),
    AUTOSAVE_RATE_LIMIT_MAX,
    AUTOSAVE_RATE_WINDOW_SECONDS,
  );
}

export async function claimStudentSession(
  schoolKey: string,
  studentId: string,
  sessionId: string,
) {
  if (!isRedisConfigured()) {
    return null;
  }

  const result = await runRedisCommand<string | null>([
    "SET",
    buildStudentSessionKey(schoolKey, studentId),
    sessionId,
    "EX",
    STUDENT_SESSION_TTL_SECONDS,
    "NX",
  ]);

  if (result === null) {
    return null;
  }

  return result === "OK";
}

export async function readStudentSession(
  schoolKey: string,
  studentId: string,
) {
  if (!isRedisConfigured()) {
    return null;
  }

  return runRedisCommand<string>([
    "GET",
    buildStudentSessionKey(schoolKey, studentId),
  ]);
}

export async function refreshStudentSessionIfMatch(
  schoolKey: string,
  studentId: string,
  sessionId: string,
) {
  if (!isRedisConfigured()) {
    return null;
  }

  const result = await runRedisEval<number>(
    [
      "if redis.call('GET', KEYS[1]) == ARGV[1] then",
      "  return redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))",
      "end",
      "return 0",
    ].join("\n"),
    [buildStudentSessionKey(schoolKey, studentId)],
    [sessionId, STUDENT_SESSION_TTL_SECONDS],
  );

  if (result === null) {
    return null;
  }

  return Number(result || 0) === 1;
}

export async function clearStudentSessionIfMatch(
  schoolKey: string,
  studentId: string,
  sessionId: string,
) {
  if (!isRedisConfigured()) {
    return null;
  }

  const result = await runRedisEval<number>(
    [
      "if redis.call('GET', KEYS[1]) == ARGV[1] then",
      "  return redis.call('DEL', KEYS[1])",
      "end",
      "return 0",
    ].join("\n"),
    [buildStudentSessionKey(schoolKey, studentId)],
    [sessionId],
  );

  if (result === null) {
    return null;
  }

  return Number(result || 0) > 0;
}

export async function clearStudentSession(
  schoolKey: string,
  studentId: string,
) {
  if (!isRedisConfigured()) {
    return null;
  }

  const result = await runRedisCommand<number>([
    "DEL",
    buildStudentSessionKey(schoolKey, studentId),
  ]);

  if (result === null) {
    return null;
  }

  return Number(result || 0) > 0;
}

export async function claimExamAttemptLock(
  schoolKey: string,
  paperId: string,
  studentId: string,
  lockToken: string,
) {
  if (!isRedisConfigured()) {
    return null;
  }

  const result = await runRedisCommand<string | null>([
    "SET",
    buildAttemptLockKey(schoolKey, paperId, studentId),
    lockToken,
    "EX",
    ATTEMPT_LOCK_TTL_SECONDS,
    "NX",
  ]);

  if (result === null) {
    return null;
  }

  return result === "OK";
}

export async function releaseExamAttemptLock(
  schoolKey: string,
  paperId: string,
  studentId: string,
  lockToken: string,
) {
  if (!isRedisConfigured()) {
    return null;
  }

  const result = await runRedisEval<number>(
    [
      "if redis.call('GET', KEYS[1]) == ARGV[1] then",
      "  return redis.call('DEL', KEYS[1])",
      "end",
      "return 0",
    ].join("\n"),
    [buildAttemptLockKey(schoolKey, paperId, studentId)],
    [lockToken],
  );

  if (result === null) {
    return null;
  }

  return Number(result || 0) > 0;
}

export async function cacheExamSnapshotPayload<T>(
  schoolKey: string,
  paperId: string,
  snapshotVersion: number,
  payload: T,
) {
  if (!isRedisConfigured()) {
    return;
  }

  await runRedisCommand([
    "SET",
    buildSnapshotCacheKey(schoolKey, paperId, snapshotVersion),
    encodeRedisValue(payload),
    "EX",
    SNAPSHOT_CACHE_TTL_SECONDS,
  ]);
}

export async function readCachedExamSnapshotPayload<T>(
  schoolKey: string,
  paperId: string,
  snapshotVersion: number,
) {
  if (!isRedisConfigured()) {
    return null;
  }

  const payload = await runRedisCommand<string>([
    "GET",
    buildSnapshotCacheKey(schoolKey, paperId, snapshotVersion),
  ]);

  return decodeRedisValue<T>(payload);
}
