import {
  shouldRefreshStudentSessionHeartbeat,
} from "@/lib/student-session";

export type StudentSessionDbSyncEntry = {
  syncedAt: number;
};

export type StudentSessionRedisValidationEntry = {
  validatedAt: number;
};

type StudentSessionCacheState = {
  dbSyncCache: Map<string, StudentSessionDbSyncEntry>;
  redisValidationCache: Map<string, StudentSessionRedisValidationEntry>;
  lastDbSyncPrunedAt: number;
  lastRedisValidationPrunedAt: number;
};

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

const STUDENT_SESSION_CACHE_MAX_ENTRIES = Math.max(
  250,
  parsePositiveInt(process.env.STUDENT_SESSION_CACHE_MAX_ENTRIES, 4000),
);
const STUDENT_SESSION_CACHE_PRUNE_INTERVAL_MS = Math.max(
  250,
  parsePositiveInt(process.env.STUDENT_SESSION_CACHE_PRUNE_INTERVAL_MS, 2000),
);
const STUDENT_SESSION_DB_SYNC_CACHE_MAX_AGE_MS = Math.max(
  60_000,
  parsePositiveInt(
    process.env.STUDENT_SESSION_DB_SYNC_CACHE_MAX_AGE_MS,
    15 * 60 * 1000,
  ),
);
const STUDENT_SESSION_REDIS_VALIDATION_CACHE_MS = Math.max(
  500,
  parsePositiveInt(
    process.env.STUDENT_SESSION_REDIS_VALIDATION_CACHE_MS,
    1500,
  ),
);
const STUDENT_SESSION_REDIS_VALIDATION_CACHE_MAX_AGE_MS = Math.max(
  STUDENT_SESSION_REDIS_VALIDATION_CACHE_MS,
  parsePositiveInt(
    process.env.STUDENT_SESSION_REDIS_VALIDATION_CACHE_MAX_AGE_MS,
    Math.max(10_000, STUDENT_SESSION_REDIS_VALIDATION_CACHE_MS * 5),
  ),
);

function getStudentSessionCacheState() {
  const globalState = globalThis as typeof globalThis & {
    __studentSessionCacheState?: StudentSessionCacheState;
  };

  if (!globalState.__studentSessionCacheState) {
    globalState.__studentSessionCacheState = {
      dbSyncCache: new Map(),
      redisValidationCache: new Map(),
      lastDbSyncPrunedAt: 0,
      lastRedisValidationPrunedAt: 0,
    };
  }

  return globalState.__studentSessionCacheState;
}

function buildStudentSessionCacheKey(
  schoolKey: string,
  studentId: string,
  studentSessionId: string,
) {
  return `${schoolKey}::${studentId}::${studentSessionId}`;
}

function pruneOldestEntries<T>(
  cache: Map<string, T>,
  maxEntries: number,
  getTimestamp: (entry: T) => number,
) {
  if (cache.size <= maxEntries) {
    return;
  }

  const entries = Array.from(cache.entries()).sort(
    (left, right) => getTimestamp(left[1]) - getTimestamp(right[1]),
  );
  const removeCount = Math.max(0, cache.size - maxEntries);
  for (let index = 0; index < removeCount; index += 1) {
    cache.delete(entries[index][0]);
  }
}

function maybePruneStudentSessionDbSyncCache(nowMs: number) {
  const state = getStudentSessionCacheState();
  if (
    nowMs - state.lastDbSyncPrunedAt <
    STUDENT_SESSION_CACHE_PRUNE_INTERVAL_MS
  ) {
    return;
  }

  state.lastDbSyncPrunedAt = nowMs;
  for (const [cacheKey, entry] of state.dbSyncCache.entries()) {
    if (nowMs - entry.syncedAt > STUDENT_SESSION_DB_SYNC_CACHE_MAX_AGE_MS) {
      state.dbSyncCache.delete(cacheKey);
    }
  }

  pruneOldestEntries(
    state.dbSyncCache,
    STUDENT_SESSION_CACHE_MAX_ENTRIES,
    (entry) => entry.syncedAt,
  );
}

function maybePruneStudentSessionRedisValidationCache(nowMs: number) {
  const state = getStudentSessionCacheState();
  if (
    nowMs - state.lastRedisValidationPrunedAt <
    STUDENT_SESSION_CACHE_PRUNE_INTERVAL_MS
  ) {
    return;
  }

  state.lastRedisValidationPrunedAt = nowMs;
  for (const [cacheKey, entry] of state.redisValidationCache.entries()) {
    if (
      nowMs - entry.validatedAt >
      STUDENT_SESSION_REDIS_VALIDATION_CACHE_MAX_AGE_MS
    ) {
      state.redisValidationCache.delete(cacheKey);
    }
  }

  pruneOldestEntries(
    state.redisValidationCache,
    STUDENT_SESSION_CACHE_MAX_ENTRIES,
    (entry) => entry.validatedAt,
  );
}

export function shouldSyncRedisValidatedStudentSessionToDb(
  schoolKey: string,
  studentId: string,
  studentSessionId: string,
  now: Date,
) {
  const nowMs = now.getTime();
  maybePruneStudentSessionDbSyncCache(nowMs);
  const cacheKey = buildStudentSessionCacheKey(
    schoolKey,
    studentId,
    studentSessionId,
  );
  const entry = getStudentSessionCacheState().dbSyncCache.get(cacheKey);

  if (entry && !shouldRefreshStudentSessionHeartbeat(entry.syncedAt, now)) {
    return false;
  }

  return true;
}

export function markRedisValidatedStudentSessionDbSynced(
  schoolKey: string,
  studentId: string,
  studentSessionId: string,
  now: Date,
) {
  const nowMs = now.getTime();
  maybePruneStudentSessionDbSyncCache(nowMs);
  getStudentSessionCacheState().dbSyncCache.set(
    buildStudentSessionCacheKey(
      schoolKey,
      studentId,
      studentSessionId,
    ),
    { syncedAt: nowMs },
  );
}

export function hasRecentlyValidatedStudentSessionViaRedis(
  schoolKey: string,
  studentId: string,
  studentSessionId: string,
  now: Date,
) {
  const nowMs = now.getTime();
  maybePruneStudentSessionRedisValidationCache(nowMs);
  const cacheKey = buildStudentSessionCacheKey(
    schoolKey,
    studentId,
    studentSessionId,
  );
  const entry = getStudentSessionCacheState().redisValidationCache.get(cacheKey);

  if (!entry) {
    return false;
  }

  return nowMs - entry.validatedAt < STUDENT_SESSION_REDIS_VALIDATION_CACHE_MS;
}

export function markStudentSessionRecentlyValidatedViaRedis(
  schoolKey: string,
  studentId: string,
  studentSessionId: string,
  now: Date,
) {
  const nowMs = now.getTime();
  maybePruneStudentSessionRedisValidationCache(nowMs);
  getStudentSessionCacheState().redisValidationCache.set(
    buildStudentSessionCacheKey(
      schoolKey,
      studentId,
      studentSessionId,
    ),
    { validatedAt: nowMs },
  );
}

export function clearStudentSessionRecentRedisValidation(
  schoolKey: string,
  studentId: string,
  studentSessionId: string,
) {
  getStudentSessionCacheState().redisValidationCache.delete(
    buildStudentSessionCacheKey(
      schoolKey,
      studentId,
      studentSessionId,
    ),
  );
}

export function invalidateStudentSessionValidationCache(params: {
  schoolKey: string;
  studentId: string;
  studentSessionId?: string | null;
}) {
  const schoolKey = String(params.schoolKey || "").trim();
  const studentId = String(params.studentId || "").trim();
  const studentSessionId = String(params.studentSessionId || "").trim();
  if (!schoolKey || !studentId) {
    return;
  }

  const state = getStudentSessionCacheState();
  const prefix = `${schoolKey}::${studentId}::`;
  for (const cacheKey of state.dbSyncCache.keys()) {
    if (cacheKey.startsWith(prefix)) {
      state.dbSyncCache.delete(cacheKey);
    }
  }
  for (const cacheKey of state.redisValidationCache.keys()) {
    if (cacheKey.startsWith(prefix)) {
      state.redisValidationCache.delete(cacheKey);
    }
  }

  if (studentSessionId) {
    const exactKey = buildStudentSessionCacheKey(
      schoolKey,
      studentId,
      studentSessionId,
    );
    state.dbSyncCache.delete(exactKey);
    state.redisValidationCache.delete(exactKey);
  }
}
