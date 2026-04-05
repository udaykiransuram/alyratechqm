import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  isRedisConfigured,
  readSharedCacheEntry,
  writeSharedCacheEntry,
} from "@/lib/redis";
import {
  getMockWorkspaceClasses,
  getMockWorkspaceSections,
  getMockWorkspaceSubjects,
} from "@/lib/test-fixtures/learning-content";
import { isMockedE2ETestMode } from "@/lib/test-mode";
import type {
  WorkspaceAcademicSectionItem,
  WorkspaceClassItem,
  WorkspaceSubjectItem,
  WorkspaceTagItem,
  WorkspaceTagTypeItem,
} from "@/lib/workspace/support-types";

const SUPPORT_DATA_CACHE_MAX_ENTRIES = 400;
const SUPPORT_DATA_CACHE_TTLS = {
  classes: 60_000,
  sections: 60_000,
  subjects: 60_000,
  tagTypes: 60_000,
  tags: 60_000,
  tagsWithSubjects: 45_000,
} as const;
const DEV_SUPPORT_DATA_CACHE_TTL_MS = 5_000;

type SupportDataCacheEntry<T> = {
  expiresAt: number;
  hasValue: boolean;
  value?: T;
  promise?: Promise<T>;
};

type WorkspaceSupportDataCacheStats = {
  localHits: number;
  localMisses: number;
  redisHits: number;
  redisMisses: number;
  redisWrites: number;
  loaderRuns: number;
};

type WorkspaceSupportDataCacheState = {
  cache: Map<string, SupportDataCacheEntry<unknown>>;
  stats: WorkspaceSupportDataCacheStats;
};

function cloneForTransport<T>(value: T): T {
  if (typeof value === "undefined") {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function getWorkspaceSupportDataCacheState() {
  const globalState = global as typeof globalThis & {
    __workspaceSupportDataCache?: WorkspaceSupportDataCacheState;
  };

  if (!globalState.__workspaceSupportDataCache) {
    globalState.__workspaceSupportDataCache = {
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

  return globalState.__workspaceSupportDataCache;
}

function getWorkspaceSupportDataCache() {
  return getWorkspaceSupportDataCacheState().cache;
}

export function getWorkspaceSupportDataCacheStats() {
  const state = getWorkspaceSupportDataCacheState();

  return {
    entries: state.cache.size,
    maxEntries: SUPPORT_DATA_CACHE_MAX_ENTRIES,
    redisConfigured: isRedisConfigured(),
    ...state.stats,
  };
}

function pruneWorkspaceSupportDataCache() {
  const cache = getWorkspaceSupportDataCache();
  if (cache.size <= SUPPORT_DATA_CACHE_MAX_ENTRIES) {
    return;
  }

  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if ((entry.expiresAt <= now && !entry.promise) || cache.size > SUPPORT_DATA_CACHE_MAX_ENTRIES) {
      cache.delete(key);
    }
    if (cache.size <= SUPPORT_DATA_CACHE_MAX_ENTRIES) {
      break;
    }
  }
}

function buildWorkspaceSupportDataCacheKey(
  schoolKey: string,
  namespace: string,
  variant?: string,
) {
  return [schoolKey, namespace, variant || ""].join("::");
}

async function getCachedWorkspaceSupportData<T>(
  cacheKey: string,
  ttlMs: number,
  loader: () => Promise<T>,
) {
  const effectiveTtlMs =
    process.env.NODE_ENV === "production"
      ? ttlMs
      : Math.min(ttlMs, DEV_SUPPORT_DATA_CACHE_TTL_MS);

  const state = getWorkspaceSupportDataCacheState();
  const cache = getWorkspaceSupportDataCache();
  const now = Date.now();
  const existingEntry = cache.get(cacheKey) as
    | SupportDataCacheEntry<T>
    | undefined;

  if (existingEntry?.hasValue && existingEntry.expiresAt > now) {
    state.stats.localHits += 1;
    return cloneForTransport(existingEntry.value as T);
  }

  if (existingEntry?.promise) {
    return existingEntry.promise;
  }

  state.stats.localMisses += 1;

  const promise = (async () => {
    const sharedEntry = await readSharedCacheEntry<T>(cacheKey);
    if (sharedEntry) {
      const normalizedValue = cloneForTransport(sharedEntry.value);
      state.stats.redisHits += 1;
      cache.set(cacheKey, {
        expiresAt: Date.now() + effectiveTtlMs,
        hasValue: true,
        value: normalizedValue,
      });
      pruneWorkspaceSupportDataCache();
      return cloneForTransport(normalizedValue);
    }

    if (isRedisConfigured()) {
      state.stats.redisMisses += 1;
    }

    state.stats.loaderRuns += 1;
    const value = await loader();
    const normalizedValue = cloneForTransport(value);
    cache.set(cacheKey, {
      expiresAt: Date.now() + effectiveTtlMs,
      hasValue: true,
      value: normalizedValue,
    });
    pruneWorkspaceSupportDataCache();

    if (isRedisConfigured()) {
      const wroteToSharedCache = await writeSharedCacheEntry(
        cacheKey,
        normalizedValue,
        Math.max(1, Math.ceil(effectiveTtlMs / 1000)),
      ).catch(() => false);

      if (wroteToSharedCache) {
        state.stats.redisWrites += 1;
      }
    }

    return cloneForTransport(normalizedValue);
  })()
    .catch((error) => {
      cache.delete(cacheKey);
      throw error;
    });

  cache.set(cacheKey, {
    expiresAt: now + effectiveTtlMs,
    hasValue: false,
    promise,
  });
  pruneWorkspaceSupportDataCache();

  return promise;
}

function toId(value: unknown) {
  return String(value || "").trim();
}

function toOptionalString(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

function mapTagTypeItem(value: any): WorkspaceTagTypeItem {
  return {
    _id: toId(value?._id),
    name: toOptionalString(value?.name) || "",
  };
}

function mapClassItem(value: any): WorkspaceClassItem {
  return {
    _id: toId(value?._id),
    name: toOptionalString(value?.name) || "",
    description: toOptionalString(value?.description),
  };
}

function mapAcademicSectionItem(value: any): WorkspaceAcademicSectionItem {
  const classValue =
    value?.class && typeof value.class === "object"
      ? {
          _id: toId(value.class?._id),
          name: toOptionalString(value.class?.name) || "",
        }
      : toOptionalString(value?.class);

  return {
    _id: toId(value?._id),
    name: toOptionalString(value?.name) || "",
    description: toOptionalString(value?.description),
    isActive:
      typeof value?.isActive === "boolean" ? value.isActive : undefined,
    class: classValue,
  };
}

function mapSubjectItem(value: any): WorkspaceSubjectItem {
  return {
    _id: toId(value?._id),
    name: toOptionalString(value?.name) || "",
    code: toOptionalString(value?.code),
    description: toOptionalString(value?.description),
    tags: Array.isArray(value?.tags)
      ? value.tags.map((tag: any) => ({
          _id: toId(tag?._id),
          name: toOptionalString(tag?.name) || "",
          type: mapTagTypeItem(tag?.type),
        }))
      : [],
  };
}

function mapTagItem(value: any): WorkspaceTagItem {
  return {
    _id: toId(value?._id),
    name: toOptionalString(value?.name) || "",
    type: mapTagTypeItem(value?.type),
    subjects: Array.isArray(value?.subjects)
      ? value.subjects.map((subject: any) => ({
          _id: toId(subject?._id),
          name: toOptionalString(subject?.name) || "",
          code: toOptionalString(subject?.code),
        }))
      : undefined,
  };
}

export async function getWorkspaceClasses(
  schoolKey: string,
): Promise<WorkspaceClassItem[]> {
  if (isMockedE2ETestMode()) {
    return getMockWorkspaceClasses();
  }

  const cacheKey = buildWorkspaceSupportDataCacheKey(schoolKey, "classes");
  return getCachedWorkspaceSupportData(
    cacheKey,
    SUPPORT_DATA_CACHE_TTLS.classes,
    async () => {
      await connectDB();
      const { Class: ClassModel } = await getTenantModels(schoolKey, ["Class"]);
      const classes = await ClassModel.find(buildArchiveFilter(false))
        .select("_id name description")
        .sort({ name: 1 })
        .lean();

      return Array.isArray(classes) ? classes.map(mapClassItem) : [];
    },
  );
}

export async function getWorkspaceSections(
  schoolKey: string,
  options?: {
    includeInactive?: boolean;
  },
): Promise<WorkspaceAcademicSectionItem[]> {
  if (isMockedE2ETestMode()) {
    return getMockWorkspaceSections();
  }

  const includeInactive = options?.includeInactive === true;
  const cacheKey = buildWorkspaceSupportDataCacheKey(
    schoolKey,
    "sections",
    includeInactive ? "all" : "active",
  );

  return getCachedWorkspaceSupportData(
    cacheKey,
    SUPPORT_DATA_CACHE_TTLS.sections,
    async () => {
      await connectDB();
      const {
        AcademicSection: AcademicSectionModel,
        Class: ClassModel,
      } = await getTenantModels(schoolKey, ["AcademicSection", "Class"]);

      const sections = await AcademicSectionModel.find({
        ...buildArchiveFilter(false),
        ...(includeInactive ? {} : { isActive: true }),
      })
        .select("_id name description isActive class")
        .populate({ path: "class", model: ClassModel, select: "name" })
        .sort({ name: 1, _id: 1 })
        .lean();

      return Array.isArray(sections) ? sections.map(mapAcademicSectionItem) : [];
    },
  );
}

export async function getWorkspaceSubjects(
  schoolKey: string,
): Promise<WorkspaceSubjectItem[]> {
  if (isMockedE2ETestMode()) {
    return getMockWorkspaceSubjects();
  }

  const cacheKey = buildWorkspaceSupportDataCacheKey(schoolKey, "subjects");
  return getCachedWorkspaceSupportData(
    cacheKey,
    SUPPORT_DATA_CACHE_TTLS.subjects,
    async () => {
      await connectDB();
      const {
        Subject: SubjectModel,
        TagType: TagTypeModel,
      } = await getTenantModels(schoolKey, ["Subject", "Tag", "TagType"]);

      const subjects = await SubjectModel.find(buildArchiveFilter(false))
        .select("_id name code description tags")
        .populate({
          path: "tags",
          match: buildArchiveFilter(false),
          select: "_id name type",
          populate: { path: "type", model: TagTypeModel, select: "name" },
        })
        .sort({ name: 1, _id: 1 })
        .lean();

      return Array.isArray(subjects) ? subjects.map(mapSubjectItem) : [];
    },
  );
}

export async function getWorkspaceTagTypes(
  schoolKey: string,
): Promise<WorkspaceTagTypeItem[]> {
  if (isMockedE2ETestMode()) {
    return [];
  }

  const cacheKey = buildWorkspaceSupportDataCacheKey(schoolKey, "tag-types");
  return getCachedWorkspaceSupportData(
    cacheKey,
    SUPPORT_DATA_CACHE_TTLS.tagTypes,
    async () => {
      await connectDB();
      const { TagType: TagTypeModel } = await getTenantModels(schoolKey, [
        "TagType",
      ]);
      const tagTypes = await TagTypeModel.find({})
        .select("_id name")
        .sort({ name: 1, _id: 1 })
        .lean();

      return Array.isArray(tagTypes)
        ? tagTypes
            .map(mapTagTypeItem)
            .filter((tagType) => Boolean(tagType._id) && Boolean(tagType.name))
        : [];
    },
  );
}

export async function getWorkspaceTags(
  schoolKey: string,
): Promise<WorkspaceTagItem[]> {
  if (isMockedE2ETestMode()) {
    return [];
  }

  const cacheKey = buildWorkspaceSupportDataCacheKey(schoolKey, "tags");
  return getCachedWorkspaceSupportData(
    cacheKey,
    SUPPORT_DATA_CACHE_TTLS.tags,
    async () => {
      await connectDB();
      const { Tag: TagModel } = await getTenantModels(schoolKey, [
        "Tag",
        "TagType",
      ]);
      const tags = await TagModel.find(buildArchiveFilter(false))
        .select("_id name type subjects")
        .populate({ path: "type", select: "name" })
        .sort({ name: 1, _id: 1 })
        .lean();

      return Array.isArray(tags) ? tags.map(mapTagItem) : [];
    },
  );
}

export async function getWorkspaceTagsWithSubjects(
  schoolKey: string,
  options?: {
    limit?: number;
  },
): Promise<{
  tags: WorkspaceTagItem[];
  total: number;
  partial: boolean;
}> {
  if (isMockedE2ETestMode()) {
    return {
      tags: [],
      total: 0,
      partial: false,
    };
  }

  const limit =
    typeof options?.limit === "number" && options.limit > 0
      ? Math.min(Math.floor(options.limit), 100)
      : null;
  const cacheKey = buildWorkspaceSupportDataCacheKey(
    schoolKey,
    "tags-with-subjects",
    limit ? String(limit) : "all",
  );

  return getCachedWorkspaceSupportData(
    cacheKey,
    SUPPORT_DATA_CACHE_TTLS.tagsWithSubjects,
    async () => {
      await connectDB();
      const { Tag: TagModel, Subject: SubjectModel } = await getTenantModels(
        schoolKey,
        ["Tag", "Subject", "TagType"],
      );
      const tagFilter = buildArchiveFilter(false);

      const tagsQuery = TagModel.find(tagFilter)
        .select("_id name type")
        .populate({ path: "type", select: "name" })
        .sort({
          name: 1,
          _id: 1,
        });
      if (limit) {
        tagsQuery.limit(limit);
      }

      const [tags, total] = await Promise.all([
        tagsQuery.lean(),
        TagModel.countDocuments(tagFilter),
      ]);

      const tagIds = Array.isArray(tags) ? tags.map((tag: any) => tag?._id) : [];
      const subjects =
        tagIds.length > 0
          ? await SubjectModel.find({
              tags: { $in: tagIds },
              ...buildArchiveFilter(false),
            })
              .select("_id name code tags")
              .lean()
          : [];

      const tagIdToSubjects: Record<
        string,
        Array<{ _id: string; name: string; code?: string }>
      > = {};

      if (Array.isArray(subjects)) {
        subjects.forEach((subject: any) => {
          const subjectItem = {
            _id: toId(subject?._id),
            name: toOptionalString(subject?.name) || "",
            code: toOptionalString(subject?.code),
          };

          (Array.isArray(subject?.tags) ? subject.tags : []).forEach((tagId: any) => {
            const normalizedTagId = toId(tagId);
            if (!normalizedTagId) {
              return;
            }
            (tagIdToSubjects[normalizedTagId] ||= []).push(subjectItem);
          });
        });
      }

      const mappedTags = Array.isArray(tags)
        ? tags.map((tag: any) =>
            mapTagItem({
              ...tag,
              subjects: tagIdToSubjects[toId(tag?._id)] || [],
            }),
          )
        : [];

      return {
        tags: mappedTags,
        total: Number(total || 0),
        partial: mappedTags.length < Number(total || 0),
      };
    },
  );
}
