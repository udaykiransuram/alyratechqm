import { connectDB } from "@/lib/db";
import {
  isRedisConfigured,
  readSharedCacheEntry,
  writeSharedCacheEntry,
} from "@/lib/redis";
import { isMockedE2ETestMode } from "@/lib/test-mode";
import School from "@/models/School";

export type PublicSchoolOption = {
  key: string;
  displayName: string;
};

type SchoolDoc = {
  key?: string;
  displayName?: string;
};

function toPublicSchoolOption(school: SchoolDoc): PublicSchoolOption | null {
  const key = String(school?.key || "").trim().toLowerCase();
  const displayName = String(school?.displayName || "").trim();

  if (!key || !displayName) {
    return null;
  }

  return {
    key,
    displayName,
  };
}

const PUBLIC_SCHOOL_CACHE_TTL_MS = 60_000;

type PublicSchoolCacheEntry<T> = {
  fetchedAt: number;
  value: T;
};

type PublicSchoolCacheState = {
  all: PublicSchoolCacheEntry<PublicSchoolOption[]> | null;
  allPromise: Promise<PublicSchoolOption[]> | null;
  byKey: Map<string, PublicSchoolCacheEntry<PublicSchoolOption | null>>;
  byKeyPromises: Map<string, Promise<PublicSchoolOption | null>>;
  stats: {
    localHits: number;
    localMisses: number;
    redisHits: number;
    redisMisses: number;
    redisWrites: number;
    loaderRuns: number;
  };
};

const PUBLIC_SCHOOL_ALL_SHARED_CACHE_KEY = "public-school-options::all";

function buildPublicSchoolSharedCacheKey(schoolKey: string) {
  return `public-school-option::${String(schoolKey || "").trim().toLowerCase()}`;
}

function getPublicSchoolCacheState(): PublicSchoolCacheState {
  const globalState = globalThis as typeof globalThis & {
    __publicSchoolDataCache?: PublicSchoolCacheState;
  };

  if (!globalState.__publicSchoolDataCache) {
    globalState.__publicSchoolDataCache = {
      all: null,
      allPromise: null,
      byKey: new Map(),
      byKeyPromises: new Map(),
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

  return globalState.__publicSchoolDataCache;
}

function isFresh<T>(entry: PublicSchoolCacheEntry<T> | null) {
  return Boolean(
    entry && Date.now() - entry.fetchedAt < PUBLIC_SCHOOL_CACHE_TTL_MS,
  );
}

function writeFullSchoolCache(options: PublicSchoolOption[]) {
  const cache = getPublicSchoolCacheState();
  const fetchedAt = Date.now();
  cache.all = {
    fetchedAt,
    value: options,
  };

  for (const option of options) {
    cache.byKey.set(option.key, {
      fetchedAt,
      value: option,
    });
  }

  return options;
}

export function getPublicSchoolCacheStats() {
  const cache = getPublicSchoolCacheState();

  return {
    allLoaded: Boolean(cache.all),
    allCount: cache.all?.value?.length || 0,
    keyedEntries: cache.byKey.size,
    redisConfigured: isRedisConfigured(),
    ...cache.stats,
  };
}

export async function getPublicSchoolOptions(): Promise<PublicSchoolOption[]> {
  if (isMockedE2ETestMode()) {
    return [];
  }

  const cache = getPublicSchoolCacheState();
  if (isFresh(cache.all)) {
    cache.stats.localHits += 1;
    return cache.all?.value || [];
  }

  if (!cache.allPromise) {
    cache.allPromise = (async () => {
      const sharedEntry = await readSharedCacheEntry<PublicSchoolOption[]>(
        PUBLIC_SCHOOL_ALL_SHARED_CACHE_KEY,
      );
      if (sharedEntry) {
        cache.stats.redisHits += 1;
        return writeFullSchoolCache(
          Array.isArray(sharedEntry.value) ? sharedEntry.value : [],
        );
      }

      cache.stats.localMisses += 1;
      if (isRedisConfigured()) {
        cache.stats.redisMisses += 1;
      }
      cache.stats.loaderRuns += 1;
      await connectDB();

      const schools = (await School.find({})
        .sort({ displayName: 1, _id: 1 })
        .select("key displayName")
        .lean()) as SchoolDoc[];

      const options = Array.isArray(schools)
        ? schools
            .map(toPublicSchoolOption)
            .filter((school): school is PublicSchoolOption => Boolean(school))
        : [];

      const normalizedOptions = writeFullSchoolCache(options);

      if (isRedisConfigured()) {
        const wroteToSharedCache = await writeSharedCacheEntry(
          PUBLIC_SCHOOL_ALL_SHARED_CACHE_KEY,
          normalizedOptions,
          Math.max(1, Math.ceil(PUBLIC_SCHOOL_CACHE_TTL_MS / 1000)),
        ).catch(() => false);

        if (wroteToSharedCache) {
          cache.stats.redisWrites += 1;
        }
      }

      return normalizedOptions;
    })().finally(() => {
      cache.allPromise = null;
    });
  }

  return cache.allPromise;
}

export async function getPublicSchoolOptionByKey(
  rawSchoolKey: string,
): Promise<PublicSchoolOption | null> {
  const schoolKey = String(rawSchoolKey || "").trim().toLowerCase();
  if (!schoolKey) {
    return null;
  }

  if (isMockedE2ETestMode()) {
    return null;
  }

  const cache = getPublicSchoolCacheState();
  if (isFresh(cache.all)) {
    cache.stats.localHits += 1;
    return cache.byKey.get(schoolKey)?.value || null;
  }

  const byKeyEntry = cache.byKey.get(schoolKey) || null;
  if (isFresh(byKeyEntry)) {
    cache.stats.localHits += 1;
    return byKeyEntry?.value || null;
  }

  const pendingPromise = cache.byKeyPromises.get(schoolKey);
  if (pendingPromise) {
    return pendingPromise;
  }

  const nextPromise = (async () => {
    const sharedEntry = await readSharedCacheEntry<PublicSchoolOption | null>(
      buildPublicSchoolSharedCacheKey(schoolKey),
    );
    if (sharedEntry) {
      const option = sharedEntry.value;
      cache.stats.redisHits += 1;
      cache.byKey.set(schoolKey, {
        fetchedAt: Date.now(),
        value: option,
      });
      return option;
    }

    cache.stats.localMisses += 1;
    if (isRedisConfigured()) {
      cache.stats.redisMisses += 1;
    }
    cache.stats.loaderRuns += 1;
    await connectDB();

    const school = (await School.findOne({ key: schoolKey })
      .select("key displayName")
      .lean()) as SchoolDoc | null;
    const option = school ? toPublicSchoolOption(school) : null;

    cache.byKey.set(schoolKey, {
      fetchedAt: Date.now(),
      value: option,
    });

    if (isRedisConfigured()) {
      const wroteToSharedCache = await writeSharedCacheEntry(
        buildPublicSchoolSharedCacheKey(schoolKey),
        option,
        Math.max(1, Math.ceil(PUBLIC_SCHOOL_CACHE_TTL_MS / 1000)),
      ).catch(() => false);

      if (wroteToSharedCache) {
        cache.stats.redisWrites += 1;
      }
    }

    return option;
  })().finally(() => {
    cache.byKeyPromises.delete(schoolKey);
  });

  cache.byKeyPromises.set(schoolKey, nextPromise);
  return nextPromise;
}
