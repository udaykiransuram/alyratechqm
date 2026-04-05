import {
  deleteSharedCacheEntries,
  isRedisConfigured,
  readSharedCacheEntry,
  writeSharedCacheEntry,
} from "@/lib/redis";

const STUDENT_DASHBOARD_CACHE_NAMESPACE = "student-dashboard";
const STUDENT_DASHBOARD_CACHE_TTL_MS =
  process.env.NODE_ENV === "production" ? 30_000 : 5_000;
const STUDENT_DASHBOARD_CACHE_MAX_ENTRIES = 500;

type StudentDashboardCacheEntry<T> = {
  expiresAt: number;
  hasValue: boolean;
  value?: T;
  promise?: Promise<T>;
  createdAt: number;
  lastAccessedAt: number;
};

type StudentDashboardCacheStats = {
  localHits: number;
  localMisses: number;
  redisHits: number;
  redisMisses: number;
  redisWrites: number;
  loaderRuns: number;
};

type StudentDashboardCacheState = {
  cache: Map<string, StudentDashboardCacheEntry<unknown>>;
  stats: StudentDashboardCacheStats;
};

function cloneForTransport<T>(value: T): T {
  if (typeof value === "undefined") {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function getStudentDashboardCacheState() {
  const globalState = globalThis as typeof globalThis & {
    __studentDashboardCache?: StudentDashboardCacheState;
  };

  if (!globalState.__studentDashboardCache) {
    globalState.__studentDashboardCache = {
      cache: new Map(),
      stats: {
        localHits: 0,
        localMisses: 0,
        redisHits: 0,
        redisMisses: 0,
        redisWrites: 0,
        loaderRuns: 0,
      },
    };
  }

  return globalState.__studentDashboardCache;
}

function getStudentDashboardCache() {
  return getStudentDashboardCacheState().cache;
}

function pruneStudentDashboardCache() {
  const cache = getStudentDashboardCache();
  if (cache.size <= STUDENT_DASHBOARD_CACHE_MAX_ENTRIES) {
    return;
  }

  const now = Date.now();

  for (const [key, entry] of cache.entries()) {
    if (
      (entry.expiresAt <= now && !entry.promise) ||
      cache.size > STUDENT_DASHBOARD_CACHE_MAX_ENTRIES
    ) {
      cache.delete(key);
    }

    if (cache.size <= STUDENT_DASHBOARD_CACHE_MAX_ENTRIES) {
      break;
    }
  }
}

export function buildStudentDashboardCacheKey(
  schoolKey: string,
  studentId: string,
) {
  return [
    STUDENT_DASHBOARD_CACHE_NAMESPACE,
    String(schoolKey || "").trim(),
    String(studentId || "").trim(),
  ].join("::");
}

export function getStudentDashboardCacheStats() {
  const state = getStudentDashboardCacheState();

  return {
    entries: state.cache.size,
    maxEntries: STUDENT_DASHBOARD_CACHE_MAX_ENTRIES,
    redisConfigured: isRedisConfigured(),
    ttlMs: STUDENT_DASHBOARD_CACHE_TTL_MS,
    ...state.stats,
  };
}

export async function getCachedStudentDashboardData<T>(params: {
  schoolKey: string;
  studentId: string;
  loader: () => Promise<T>;
  skipCache?: boolean;
}) {
  const cacheKey = buildStudentDashboardCacheKey(
    params.schoolKey,
    params.studentId,
  );

  if (params.skipCache) {
    return params.loader();
  }

  const state = getStudentDashboardCacheState();
  const cache = getStudentDashboardCache();
  const now = Date.now();
  const existingEntry = cache.get(cacheKey) as
    | StudentDashboardCacheEntry<T>
    | undefined;

  if (existingEntry?.hasValue && existingEntry.expiresAt > now) {
    state.stats.localHits += 1;
    existingEntry.lastAccessedAt = now;
    return cloneForTransport(existingEntry.value as T);
  }

  if (existingEntry?.promise) {
    existingEntry.lastAccessedAt = now;
    return existingEntry.promise;
  }

  state.stats.localMisses += 1;

  const promise = (async () => {
    const sharedEntry = await readSharedCacheEntry<T>(cacheKey);
    if (sharedEntry) {
      const normalizedValue = cloneForTransport(sharedEntry.value);
      const resolvedAt = Date.now();
      state.stats.redisHits += 1;
      cache.set(cacheKey, {
        expiresAt: resolvedAt + STUDENT_DASHBOARD_CACHE_TTL_MS,
        hasValue: true,
        value: normalizedValue,
        createdAt: resolvedAt,
        lastAccessedAt: resolvedAt,
      });
      pruneStudentDashboardCache();
      return cloneForTransport(normalizedValue);
    }

    if (isRedisConfigured()) {
      state.stats.redisMisses += 1;
    }

    state.stats.loaderRuns += 1;
    const value = await params.loader();
    const normalizedValue = cloneForTransport(value);
    const resolvedAt = Date.now();
    cache.set(cacheKey, {
      expiresAt: resolvedAt + STUDENT_DASHBOARD_CACHE_TTL_MS,
      hasValue: true,
      value: normalizedValue,
      createdAt: resolvedAt,
      lastAccessedAt: resolvedAt,
    });
    pruneStudentDashboardCache();

    if (isRedisConfigured()) {
      const wroteToSharedCache = await writeSharedCacheEntry(
        cacheKey,
        normalizedValue,
        Math.max(1, Math.ceil(STUDENT_DASHBOARD_CACHE_TTL_MS / 1000)),
      ).catch(() => false);

      if (wroteToSharedCache) {
        state.stats.redisWrites += 1;
      }
    }

    return cloneForTransport(normalizedValue);
  })().catch((error) => {
    cache.delete(cacheKey);
    throw error;
  });

  cache.set(cacheKey, {
    expiresAt: now + STUDENT_DASHBOARD_CACHE_TTL_MS,
    hasValue: false,
    promise,
    createdAt: now,
    lastAccessedAt: now,
  });
  pruneStudentDashboardCache();

  return promise;
}

export async function invalidateStudentDashboardCacheForStudents(
  schoolKey: string,
  studentIds: string[],
) {
  const normalizedStudentIds = Array.from(
    new Set(
      (Array.isArray(studentIds) ? studentIds : [])
        .map((studentId) => String(studentId || "").trim())
        .filter(Boolean),
    ),
  );

  if (normalizedStudentIds.length === 0) {
    return;
  }

  const cache = getStudentDashboardCache();
  const cacheKeys = normalizedStudentIds.map((studentId) =>
    buildStudentDashboardCacheKey(schoolKey, studentId),
  );

  cacheKeys.forEach((cacheKey) => cache.delete(cacheKey));

  await deleteSharedCacheEntries(cacheKeys).catch(() => undefined);
}

export async function invalidateStudentDashboardCacheForStudent(
  schoolKey: string,
  studentId: string,
) {
  return invalidateStudentDashboardCacheForStudents(schoolKey, [studentId]);
}
