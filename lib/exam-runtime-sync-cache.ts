import {
  resolveExamRuntimeMongoResponseId,
  syncExamRuntimeMongoProjectionsForPaper,
} from "@/lib/exam-runtime";

const SYNC_CACHE_MAX_ENTRIES = 400;
const DEFAULT_SYNC_MIN_INTERVAL_MS = 20_000;
const RESPONSE_ID_CACHE_MAX_ENTRIES = 600;
const DEFAULT_RESPONSE_ID_TTL_MS = 120_000;

type SyncEntry = {
  lastCompletedAt: number;
  promise?: Promise<Map<string, string> | null>;
};

type ResponseIdResolveEntry = {
  lastResolvedAt: number;
  value?: string;
  promise?: Promise<string | undefined>;
};

function getExamRuntimeSyncCache() {
  const globalState = global as typeof globalThis & {
    __examRuntimeSyncCache?: Map<string, SyncEntry>;
  };

  if (!globalState.__examRuntimeSyncCache) {
    globalState.__examRuntimeSyncCache = new Map();
  }

  return globalState.__examRuntimeSyncCache;
}

function getExamRuntimeResponseIdCache() {
  const globalState = global as typeof globalThis & {
    __examRuntimeResponseIdCache?: Map<string, ResponseIdResolveEntry>;
  };

  if (!globalState.__examRuntimeResponseIdCache) {
    globalState.__examRuntimeResponseIdCache = new Map();
  }

  return globalState.__examRuntimeResponseIdCache;
}

function buildSyncCacheKey(schoolKey: string, paperId: string) {
  return `${String(schoolKey || "").trim()}::${String(paperId || "").trim()}`;
}

function buildResponseIdCacheKey(schoolKey: string, referenceId: string) {
  return `${String(schoolKey || "").trim()}::${String(referenceId || "").trim()}`;
}

function pruneExamRuntimeSyncCache() {
  const cache = getExamRuntimeSyncCache();
  if (cache.size <= SYNC_CACHE_MAX_ENTRIES) {
    return;
  }

  for (const [key, entry] of cache.entries()) {
    if (!entry.promise) {
      cache.delete(key);
    }
    if (cache.size <= SYNC_CACHE_MAX_ENTRIES) {
      break;
    }
  }

  while (cache.size > SYNC_CACHE_MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (!firstKey) {
      break;
    }
    cache.delete(firstKey);
  }
}

function pruneExamRuntimeResponseIdCache() {
  const cache = getExamRuntimeResponseIdCache();
  if (cache.size <= RESPONSE_ID_CACHE_MAX_ENTRIES) {
    return;
  }

  for (const [key, entry] of cache.entries()) {
    if (!entry.promise) {
      cache.delete(key);
    }
    if (cache.size <= RESPONSE_ID_CACHE_MAX_ENTRIES) {
      break;
    }
  }

  while (cache.size > RESPONSE_ID_CACHE_MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (!firstKey) {
      break;
    }
    cache.delete(firstKey);
  }
}

export async function syncExamRuntimeMongoProjectionsForPaperWithCooldown(
  schoolKey: string,
  paperId: string,
  options?: {
    minIntervalMs?: number;
  },
) {
  const normalizedSchoolKey = String(schoolKey || "").trim();
  const normalizedPaperId = String(paperId || "").trim();
  if (!normalizedSchoolKey || !normalizedPaperId) {
    return null;
  }

  const minIntervalMs = Math.max(
    0,
    Number(options?.minIntervalMs || DEFAULT_SYNC_MIN_INTERVAL_MS),
  );
  const cacheKey = buildSyncCacheKey(normalizedSchoolKey, normalizedPaperId);
  const cache = getExamRuntimeSyncCache();
  const now = Date.now();
  const existing = cache.get(cacheKey);

  if (existing?.promise) {
    return existing.promise;
  }

  if (
    existing &&
    existing.lastCompletedAt > 0 &&
    now - existing.lastCompletedAt < minIntervalMs
  ) {
    return null;
  }

  const promise = syncExamRuntimeMongoProjectionsForPaper(
    normalizedSchoolKey,
    normalizedPaperId,
  )
    .then((result) => {
      cache.set(cacheKey, {
        lastCompletedAt: Date.now(),
      });
      pruneExamRuntimeSyncCache();
      return result;
    })
    .catch((error) => {
      cache.delete(cacheKey);
      throw error;
    });

  cache.set(cacheKey, {
    lastCompletedAt: existing?.lastCompletedAt || 0,
    promise,
  });
  pruneExamRuntimeSyncCache();

  return promise;
}

export async function resolveExamRuntimeMongoResponseIdWithCooldown(
  schoolKey: string,
  referenceId: string,
  options?: {
    ttlMs?: number;
  },
) {
  const normalizedSchoolKey = String(schoolKey || "").trim();
  const normalizedReferenceId = String(referenceId || "").trim();
  if (!normalizedSchoolKey || !normalizedReferenceId) {
    return undefined;
  }

  const ttlMs = Math.max(
    0,
    Number(options?.ttlMs || DEFAULT_RESPONSE_ID_TTL_MS),
  );
  const cacheKey = buildResponseIdCacheKey(
    normalizedSchoolKey,
    normalizedReferenceId,
  );
  const cache = getExamRuntimeResponseIdCache();
  const now = Date.now();
  const existing = cache.get(cacheKey);

  if (existing?.promise) {
    return existing.promise;
  }

  if (
    existing &&
    existing.lastResolvedAt > 0 &&
    now - existing.lastResolvedAt < ttlMs
  ) {
    return existing.value;
  }

  const promise = resolveExamRuntimeMongoResponseId(
    normalizedSchoolKey,
    normalizedReferenceId,
  )
    .then((value) => {
      cache.set(cacheKey, {
        lastResolvedAt: Date.now(),
        value,
      });
      pruneExamRuntimeResponseIdCache();
      return value;
    })
    .catch((error) => {
      cache.delete(cacheKey);
      throw error;
    });

  cache.set(cacheKey, {
    lastResolvedAt: existing?.lastResolvedAt || 0,
    value: existing?.value,
    promise,
  });
  pruneExamRuntimeResponseIdCache();

  return promise;
}
