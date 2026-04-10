import { createHash } from "crypto";

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

export type StudentSessionValidationResult =
  | "valid"
  | "missing"
  | "mismatch";

export type RedisDependencyStatus = "up" | "down" | "not_configured";

export type RedisHealthProbeResult = {
  status: RedisDependencyStatus;
  configured: boolean;
  temporarilyUnavailable: boolean;
  latencyMs: number | null;
  error?: string;
  lock: {
    status: RedisDependencyStatus;
    latencyMs: number | null;
    error?: string;
  };
};

export const STUDENT_NOTIFICATION_REDIS_QUEUE = "student-notification-jobs";
export const REPORT_DISPATCH_REDIS_QUEUE = "report-dispatch-jobs";
export const EXAM_RUNTIME_PROJECTION_REDIS_QUEUE =
  "exam-runtime-projection-jobs";

export type RedisPartitionQueueName =
  | typeof STUDENT_NOTIFICATION_REDIS_QUEUE
  | typeof REPORT_DISPATCH_REDIS_QUEUE
  | typeof EXAM_RUNTIME_PROJECTION_REDIS_QUEUE;

export type RedisPartitionQueueStats = {
  configured: boolean;
  queueName: RedisPartitionQueueName;
  partitions: number;
  ready: number;
  delayed: number;
};

export type RedisPartitionQueuePartitionCounts = {
  ready: number;
  delayed: number;
};

const REDIS_FAILURE_BACKOFF_MS = 30_000;
const REDIS_FETCH_TIMEOUT_MS = 2_500;
const STUDENT_NOTIFICATION_SIGNAL_TTL_SECONDS = 24 * 60 * 60;
const REDIS_QUEUE_ENQUEUE_CHUNK_SIZE = 250;

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

export function isRedisInBackoffWindow() {
  return isRedisTemporarilyUnavailable();
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REDIS_FETCH_TIMEOUT_MS);
    const response = await fetch(getRedisUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getRedisToken()}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify(command),
    });
    clearTimeout(timeoutId);

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

function buildSharedCacheKey(key: string) {
  return `shared-cache:${String(key || "").trim()}`;
}

function buildStudentNotificationSignalKey(
  schoolKey: string,
  studentId: string,
) {
  return `student:notification-signal:${schoolKey}:${studentId}`;
}

function buildPartitionQueuePartitionSetKey(queueName: RedisPartitionQueueName) {
  return `queue:${queueName}:partitions`;
}

function buildPartitionQueueReadyKey(
  queueName: RedisPartitionQueueName,
  partitionKey: string,
) {
  return `queue:${queueName}:${partitionKey}:ready`;
}

function buildPartitionQueueDelayedKey(
  queueName: RedisPartitionQueueName,
  partitionKey: string,
) {
  return `queue:${queueName}:${partitionKey}:delayed`;
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

export async function validateAndRefreshStudentSession(
  schoolKey: string,
  studentId: string,
  sessionId: string,
): Promise<StudentSessionValidationResult | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  const result = await runRedisEval<number>(
    [
      "local current = redis.call('GET', KEYS[1])",
      "if not current then",
      "  return -1",
      "end",
      "if current ~= ARGV[1] then",
      "  return 0",
      "end",
      "redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))",
      "return 1",
    ].join("\n"),
    [buildStudentSessionKey(schoolKey, studentId)],
    [sessionId, STUDENT_SESSION_TTL_SECONDS],
  );

  if (result === null) {
    return null;
  }

  if (Number(result) === 1) {
    return "valid";
  }

  if (Number(result) === 0) {
    return "mismatch";
  }

  return "missing";
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

export async function claimExamAttemptLockAndConsumeAutosaveRateLimit(
  schoolKey: string,
  paperId: string,
  studentId: string,
  lockToken: string,
) {
  if (!isRedisConfigured()) {
    return null;
  }

  const result = await runRedisEval<Array<string | number>>(
    [
      "local lockResult = redis.call('SET', KEYS[1], ARGV[1], 'EX', tonumber(ARGV[2]), 'NX')",
      "if not lockResult then",
      "  return {0, 0, 0}",
      "end",
      "local nextCount = redis.call('INCR', KEYS[2])",
      "if nextCount == 1 then",
      "  redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))",
      "end",
      "local limited = 0",
      "if nextCount > tonumber(ARGV[4]) then",
      "  limited = 1",
      "end",
      "return {1, limited, nextCount}",
    ].join("\n"),
    [
      buildAttemptLockKey(schoolKey, paperId, studentId),
      buildAutosaveRateLimitKey(schoolKey, studentId, paperId),
    ],
    [
      lockToken,
      ATTEMPT_LOCK_TTL_SECONDS,
      AUTOSAVE_RATE_WINDOW_SECONDS,
      AUTOSAVE_RATE_LIMIT_MAX,
    ],
  );

  if (!Array.isArray(result) || result.length < 3) {
    return null;
  }

  const claimed = Number(result[0] || 0) === 1;
  if (!claimed) {
    return {
      claimed: false as const,
      rateLimit: null,
    };
  }

  const count = Number(result[2] || 0);
  return {
    claimed: true as const,
    rateLimit: {
      limited: Number(result[1] || 0) === 1,
      count,
      limit: AUTOSAVE_RATE_LIMIT_MAX,
    } satisfies RedisRateLimitResult,
  };
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

export async function writeSharedCacheEntry(
  key: string,
  value: unknown,
  ttlSeconds: number,
) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey || !isRedisConfigured()) {
    return false;
  }

  const normalizedTtlSeconds = Math.max(1, Math.floor(ttlSeconds || 0));
  const result = await runRedisCommand<string>([
    "SET",
    buildSharedCacheKey(normalizedKey),
    encodeRedisValue({ value }),
    "EX",
    normalizedTtlSeconds,
  ]);

  return result === "OK";
}

export async function readSharedCacheEntry<T>(key: string) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey || !isRedisConfigured()) {
    return null;
  }

  let payload: string | null = null;
  try {
    payload = await runRedisCommand<string>([
      "GET",
      buildSharedCacheKey(normalizedKey),
    ]);
  } catch {
    return null;
  }

  if (typeof payload !== "string") {
    return null;
  }

  const decoded = decodeRedisValue<{ value: T }>(payload);
  if (!decoded || typeof decoded !== "object" || !("value" in decoded)) {
    return null;
  }

  return {
    value: decoded.value as T,
  };
}

function chunkValues<T>(values: T[], chunkSize: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

function normalizePartitionQueueName(queueName: RedisPartitionQueueName) {
  return queueName;
}

function normalizePartitionQueuePartitionKey(partitionKey: string) {
  return String(partitionKey || "").trim();
}

export async function enqueueRedisPartitionQueueItems(params: {
  queueName: RedisPartitionQueueName;
  partitionKey: string;
  itemIds: string[];
  availableAt?: Date | number | string | null;
}) {
  const queueName = normalizePartitionQueueName(params.queueName);
  const partitionKey = normalizePartitionQueuePartitionKey(params.partitionKey);
  const itemIds = Array.from(
    new Set(
      (Array.isArray(params.itemIds) ? params.itemIds : [])
        .map((itemId) => String(itemId || "").trim())
        .filter(Boolean),
    ),
  );

  if (!partitionKey || itemIds.length === 0 || !isRedisConfigured()) {
    return null;
  }

  const availableAtMs =
    params.availableAt instanceof Date
      ? params.availableAt.getTime()
      : typeof params.availableAt === "number"
        ? params.availableAt
        : typeof params.availableAt === "string" && params.availableAt.trim()
          ? new Date(params.availableAt).getTime()
          : Date.now();
  const normalizedAvailableAtMs = Number.isFinite(availableAtMs)
    ? Math.max(0, Math.floor(availableAtMs))
    : Date.now();
  const partitionSetKey = buildPartitionQueuePartitionSetKey(queueName);
  const readyKey = buildPartitionQueueReadyKey(queueName, partitionKey);
  const delayedKey = buildPartitionQueueDelayedKey(queueName, partitionKey);

  let enqueuedCount = 0;

  for (const chunk of chunkValues(itemIds, REDIS_QUEUE_ENQUEUE_CHUNK_SIZE)) {
    const insertedCount = await runRedisEval<number>(
      [
        "local partitionKey = ARGV[1]",
        "local availableAtMs = tonumber(ARGV[2])",
        "local nowMs = tonumber(ARGV[3])",
        "local itemCount = tonumber(ARGV[4])",
        "redis.call('SADD', KEYS[1], partitionKey)",
        "for index = 1, itemCount do",
        "  local itemId = ARGV[index + 4]",
        "  if availableAtMs > nowMs then",
        "    redis.call('ZADD', KEYS[3], availableAtMs, itemId)",
        "  else",
        "    redis.call('RPUSH', KEYS[2], itemId)",
        "  end",
        "end",
        "return itemCount",
      ].join("\n"),
      [partitionSetKey, readyKey, delayedKey],
      [partitionKey, normalizedAvailableAtMs, Date.now(), chunk.length, ...chunk],
    );

    if (insertedCount === null) {
      return enqueuedCount > 0 ? enqueuedCount : null;
    }

    enqueuedCount += Number(insertedCount || 0);
  }

  return enqueuedCount;
}

export async function claimRedisPartitionQueueItems(params: {
  queueName: RedisPartitionQueueName;
  partitionKey: string;
  limit: number;
  now?: Date | number | string | null;
}) {
  const queueName = normalizePartitionQueueName(params.queueName);
  const partitionKey = normalizePartitionQueuePartitionKey(params.partitionKey);
  const limit = Math.max(1, Math.min(250, Math.floor(params.limit || 0) || 1));

  if (!partitionKey || !isRedisConfigured()) {
    return null;
  }

  const nowMs =
    params.now instanceof Date
      ? params.now.getTime()
      : typeof params.now === "number"
        ? params.now
        : typeof params.now === "string" && params.now.trim()
          ? new Date(params.now).getTime()
          : Date.now();
  const normalizedNowMs = Number.isFinite(nowMs)
    ? Math.max(0, Math.floor(nowMs))
    : Date.now();

  return runRedisEval<string[]>(
    [
      "local nowMs = tonumber(ARGV[1])",
      "local limit = tonumber(ARGV[2])",
      "local dueIds = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', nowMs, 'LIMIT', 0, limit)",
      "for _, itemId in ipairs(dueIds) do",
      "  redis.call('RPUSH', KEYS[1], itemId)",
      "  redis.call('ZREM', KEYS[2], itemId)",
      "end",
      "local claimed = {}",
      "for index = 1, limit do",
      "  local itemId = redis.call('LPOP', KEYS[1])",
      "  if not itemId then",
      "    break",
      "  end",
      "  table.insert(claimed, itemId)",
      "end",
      "return claimed",
    ].join("\n"),
    [
      buildPartitionQueueReadyKey(queueName, partitionKey),
      buildPartitionQueueDelayedKey(queueName, partitionKey),
    ],
    [normalizedNowMs, limit],
  );
}

export async function listRedisPartitionQueuePartitions(
  queueName: RedisPartitionQueueName,
) {
  if (!isRedisConfigured()) {
    return null;
  }

  const partitions = await runRedisCommand<string[]>([
    "SMEMBERS",
    buildPartitionQueuePartitionSetKey(normalizePartitionQueueName(queueName)),
  ]);

  if (partitions === null) {
    return null;
  }

  if (!Array.isArray(partitions)) {
    return [];
  }

  return partitions
    .map((partitionKey) => String(partitionKey || "").trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

export async function setRedisPartitionQueuePartitionActive(params: {
  queueName: RedisPartitionQueueName;
  partitionKey: string;
  active: boolean;
}) {
  const queueName = normalizePartitionQueueName(params.queueName);
  const partitionKey = normalizePartitionQueuePartitionKey(params.partitionKey);

  if (!partitionKey || !isRedisConfigured()) {
    return null;
  }

  const command = params.active ? "SADD" : "SREM";
  const result = await runRedisCommand<number>([
    command,
    buildPartitionQueuePartitionSetKey(queueName),
    partitionKey,
  ]);

  if (result === null) {
    return null;
  }

  return Number(result || 0);
}

export async function getRedisPartitionQueuePartitionCounts(params: {
  queueName: RedisPartitionQueueName;
  partitionKey: string;
}): Promise<RedisPartitionQueuePartitionCounts | null> {
  const queueName = normalizePartitionQueueName(params.queueName);
  const partitionKey = normalizePartitionQueuePartitionKey(params.partitionKey);

  if (!partitionKey || !isRedisConfigured()) {
    return null;
  }

  const counts = await runRedisEval<[number, number]>(
    [
      "local ready = tonumber(redis.call('LLEN', KEYS[1]) or 0)",
      "local delayed = tonumber(redis.call('ZCARD', KEYS[2]) or 0)",
      "return {ready, delayed}",
    ].join("\n"),
    [
      buildPartitionQueueReadyKey(queueName, partitionKey),
      buildPartitionQueueDelayedKey(queueName, partitionKey),
    ],
    [],
  );

  return {
    ready:
      Array.isArray(counts) && counts.length > 0
        ? Number(counts[0] || 0)
        : 0,
    delayed:
      Array.isArray(counts) && counts.length > 1
        ? Number(counts[1] || 0)
        : 0,
  };
}

export async function getRedisPartitionQueueStats(
  queueName: RedisPartitionQueueName,
): Promise<RedisPartitionQueueStats> {
  const normalizedQueueName = normalizePartitionQueueName(queueName);

  if (!isRedisConfigured()) {
    return {
      configured: false,
      queueName: normalizedQueueName,
      partitions: 0,
      ready: 0,
      delayed: 0,
    };
  }

  const partitions =
    (await listRedisPartitionQueuePartitions(normalizedQueueName)) || [];

  if (partitions.length === 0) {
    return {
      configured: true,
      queueName: normalizedQueueName,
      partitions: 0,
      ready: 0,
      delayed: 0,
    };
  }

  const counts = await runRedisEval<[number, number]>(
    [
      "local ready = 0",
      "local delayed = 0",
      "for index = 1, #KEYS, 2 do",
      "  ready = ready + tonumber(redis.call('LLEN', KEYS[index]) or 0)",
      "  delayed = delayed + tonumber(redis.call('ZCARD', KEYS[index + 1]) or 0)",
      "end",
      "return {ready, delayed}",
    ].join("\n"),
    partitions.flatMap((partitionKey) => [
      buildPartitionQueueReadyKey(normalizedQueueName, partitionKey),
      buildPartitionQueueDelayedKey(normalizedQueueName, partitionKey),
    ]),
    [],
  );

  return {
    configured: true,
    queueName: normalizedQueueName,
    partitions: partitions.length,
    ready:
      Array.isArray(counts) && counts.length > 0
        ? Number(counts[0] || 0)
        : 0,
    delayed:
      Array.isArray(counts) && counts.length > 1
        ? Number(counts[1] || 0)
        : 0,
  };
}

export async function readStudentNotificationSignalVersion(
  schoolKey: string,
  studentId: string,
) {
  const normalizedSchoolKey = String(schoolKey || "").trim();
  const normalizedStudentId = String(studentId || "").trim();

  if (
    !normalizedSchoolKey ||
    !normalizedStudentId ||
    !isRedisConfigured()
  ) {
    return null;
  }

  const payload = await runRedisCommand<string | number>([
    "GET",
    buildStudentNotificationSignalKey(normalizedSchoolKey, normalizedStudentId),
  ]);

  if (payload === null || typeof payload === "undefined") {
    return 0;
  }

  const parsed = Number(payload);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

export async function bumpStudentNotificationSignalVersion(
  schoolKey: string,
  studentId: string,
) {
  const normalizedSchoolKey = String(schoolKey || "").trim();
  const normalizedStudentId = String(studentId || "").trim();

  if (
    !normalizedSchoolKey ||
    !normalizedStudentId ||
    !isRedisConfigured()
  ) {
    return null;
  }

  const nextVersion = await runRedisEval<number>(
    [
      "local nextVersion = redis.call('INCR', KEYS[1])",
      "redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))",
      "return nextVersion",
    ].join("\n"),
    [buildStudentNotificationSignalKey(normalizedSchoolKey, normalizedStudentId)],
    [STUDENT_NOTIFICATION_SIGNAL_TTL_SECONDS],
  );

  if (nextVersion === null) {
    return null;
  }

  const parsed = Number(nextVersion);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.floor(parsed);
}

export async function deleteSharedCacheEntries(keys: string[]) {
  const normalizedKeys = Array.from(
    new Set(
      (Array.isArray(keys) ? keys : [])
        .map((key) => String(key || "").trim())
        .filter(Boolean),
    ),
  );

  if (normalizedKeys.length === 0 || !isRedisConfigured()) {
    return null;
  }

  const result = await runRedisCommand<number>([
    "DEL",
    ...normalizedKeys.map(buildSharedCacheKey),
  ]);

  if (result === null) {
    return null;
  }

  return Number(result || 0);
}

export async function probeRedisHealth(): Promise<RedisHealthProbeResult> {
  const configured = isRedisConfigured();
  if (!configured) {
    return {
      status: "not_configured",
      configured: false,
      temporarilyUnavailable: false,
      latencyMs: null,
      lock: {
        status: "not_configured",
        latencyMs: null,
      },
    };
  }

  const pingStartedAt = Date.now();
  const pingResult = await runRedisCommand<string>(["PING"]);
  const pingLatencyMs = Date.now() - pingStartedAt;

  if (String(pingResult || "").toUpperCase() !== "PONG") {
    return {
      status: "down",
      configured: true,
      temporarilyUnavailable: isRedisTemporarilyUnavailable(),
      latencyMs: pingLatencyMs,
      error: "Redis ping failed.",
      lock: {
        status: "down",
        latencyMs: null,
        error: "Redis ping failed, lock check skipped.",
      },
    };
  }

  const healthLockKey = `health:exam-lock:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const healthLockToken = `probe:${Date.now()}`;
  const lockStartedAt = Date.now();
  const lockResult = await runRedisCommand<string | null>([
    "SET",
    healthLockKey,
    healthLockToken,
    "EX",
    15,
    "NX",
  ]);
  const lockLatencyMs = Date.now() - lockStartedAt;

  if (lockResult !== "OK") {
    return {
      status: "up",
      configured: true,
      temporarilyUnavailable: isRedisTemporarilyUnavailable(),
      latencyMs: pingLatencyMs,
      lock: {
        status: "down",
        latencyMs: lockLatencyMs,
        error: "Redis lock probe failed.",
      },
    };
  }

  await runRedisCommand(["DEL", healthLockKey]);

  return {
    status: "up",
    configured: true,
    temporarilyUnavailable: false,
    latencyMs: pingLatencyMs,
    lock: {
      status: "up",
      latencyMs: lockLatencyMs,
    },
  };
}
