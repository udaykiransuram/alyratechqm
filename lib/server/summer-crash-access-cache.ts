import type { SummerCrashPortalAccessPolicy } from "@/lib/summer-crash/portal-access";

const SUMMER_CRASH_ACCESS_CACHE_TTL_MS =
  process.env.NODE_ENV === "production" ? 15_000 : 4_000;
const SUMMER_CRASH_ACCESS_CACHE_MAX_ENTRIES = 1_500;

type SummerCrashAccessCacheEntry = {
  expiresAt: number;
  value: SummerCrashPortalAccessPolicy;
  createdAt: number;
};

type SummerCrashAccessCacheState = {
  cache: Map<string, SummerCrashAccessCacheEntry>;
};

function clonePolicy(
  policy: SummerCrashPortalAccessPolicy,
): SummerCrashPortalAccessPolicy {
  return {
    applies: Boolean(policy.applies),
    isUnlocked: Boolean(policy.isUnlocked),
    requiresPayment: Boolean(policy.requiresPayment),
    allowedDiagnosticPaperId:
      typeof policy.allowedDiagnosticPaperId === "string"
        ? policy.allowedDiagnosticPaperId
        : null,
    allowedDiagnosticResponseId:
      typeof policy.allowedDiagnosticResponseId === "string"
        ? policy.allowedDiagnosticResponseId
        : null,
    redirectHref: String(policy.redirectHref || ""),
  };
}

function getCacheState() {
  const globalState = globalThis as typeof globalThis & {
    __summerCrashPortalAccessCache?: SummerCrashAccessCacheState;
  };

  if (!globalState.__summerCrashPortalAccessCache) {
    globalState.__summerCrashPortalAccessCache = {
      cache: new Map(),
    };
  }

  return globalState.__summerCrashPortalAccessCache;
}

function getCacheKey(schoolKey: string, studentId: string) {
  return [
    "summer-crash-access",
    String(schoolKey || "").trim(),
    String(studentId || "").trim(),
  ].join("::");
}

function pruneCache() {
  const state = getCacheState();
  const now = Date.now();

  for (const [key, entry] of state.cache.entries()) {
    if (entry.expiresAt <= now) {
      state.cache.delete(key);
    }
  }

  if (state.cache.size <= SUMMER_CRASH_ACCESS_CACHE_MAX_ENTRIES) {
    return;
  }

  const overflowCount =
    state.cache.size - SUMMER_CRASH_ACCESS_CACHE_MAX_ENTRIES;
  const keysByAge = Array.from(state.cache.entries())
    .sort((left, right) => left[1].createdAt - right[1].createdAt)
    .slice(0, overflowCount)
    .map(([key]) => key);

  keysByAge.forEach((key) => {
    state.cache.delete(key);
  });
}

function isSummerCacheEligible(params: { schoolKey: string; studentId: string }) {
  return Boolean(
    String(params.schoolKey || "").trim() && String(params.studentId || "").trim(),
  );
}

function getSafePolicy(
  entry: SummerCrashAccessCacheEntry | undefined,
): SummerCrashPortalAccessPolicy | null {
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    return null;
  }
  return clonePolicy(entry.value);
}

export function getCachedSummerCrashPortalAccessPolicy(params: {
  schoolKey: string;
  studentId: string;
}) {
  if (!isSummerCacheEligible(params)) {
    return null;
  }
  const state = getCacheState();
  const key = getCacheKey(params.schoolKey, params.studentId);
  const entry = state.cache.get(key);
  const policy = getSafePolicy(entry);
  if (!policy) {
    state.cache.delete(key);
    return null;
  }

  return policy;
}

export function setCachedSummerCrashPortalAccessPolicy(params: {
  schoolKey: string;
  studentId: string;
  policy: SummerCrashPortalAccessPolicy;
}) {
  if (!isSummerCacheEligible(params)) {
    return;
  }
  const state = getCacheState();
  const now = Date.now();
  const key = getCacheKey(params.schoolKey, params.studentId);

  state.cache.set(key, {
    expiresAt: now + SUMMER_CRASH_ACCESS_CACHE_TTL_MS,
    value: clonePolicy(params.policy),
    createdAt: now,
  });
  pruneCache();
}

export function invalidateSummerCrashPortalAccessPolicyCache(params: {
  schoolKey: string;
  studentId: string;
}) {
  const state = getCacheState();
  const key = getCacheKey(params.schoolKey, params.studentId);
  state.cache.delete(key);
}
