import { connectDB } from "@/lib/db";
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
};

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

export async function getPublicSchoolOptions(): Promise<PublicSchoolOption[]> {
  if (isMockedE2ETestMode()) {
    return [];
  }

  const cache = getPublicSchoolCacheState();
  if (isFresh(cache.all)) {
    return cache.all?.value || [];
  }

  if (!cache.allPromise) {
    cache.allPromise = (async () => {
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

      return writeFullSchoolCache(options);
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
    return cache.byKey.get(schoolKey)?.value || null;
  }

  const byKeyEntry = cache.byKey.get(schoolKey) || null;
  if (isFresh(byKeyEntry)) {
    return byKeyEntry?.value || null;
  }

  const pendingPromise = cache.byKeyPromises.get(schoolKey);
  if (pendingPromise) {
    return pendingPromise;
  }

  const nextPromise = (async () => {
    await connectDB();

    const school = (await School.findOne({ key: schoolKey })
      .select("key displayName")
      .lean()) as SchoolDoc | null;
    const option = school ? toPublicSchoolOption(school) : null;

    cache.byKey.set(schoolKey, {
      fetchedAt: Date.now(),
      value: option,
    });

    return option;
  })().finally(() => {
    cache.byKeyPromises.delete(schoolKey);
  });

  cache.byKeyPromises.set(schoolKey, nextPromise);
  return nextPromise;
}
