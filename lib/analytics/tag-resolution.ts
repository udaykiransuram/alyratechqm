export type AnalyticsResolvedTag = {
  _id: string;
  name: string;
  type: {
    _id: string;
    name: string;
  } | null;
};

export type AnalyticsTagLookup = Map<string, AnalyticsResolvedTag>;

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const TAG_TYPE_ALIAS_MAP: Record<string, string> = {
  "difficulty-level": "difficulty",
  "level-of-difficulty": "difficulty",
  "chapter-name": "topic",
  "chapter-title": "topic",
  chapter: "topic",
  "subtopic-title": "topic",
  "sub-topic-title": "topic",
  subtopic: "topic",
  "sub-topic": "topic",
  "template-id": "templateid",
};

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}

function looksLikeObjectId(value: string) {
  return OBJECT_ID_PATTERN.test(value);
}

function toDisplayString(value: unknown) {
  return String(value || "").trim();
}

function normalizeTagTypeKey(value: unknown) {
  return toDisplayString(value)
    .toLowerCase()
    .replace(/[_\s/]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeAnalyticsTagTypeName(value: unknown) {
  const normalizedKey = normalizeTagTypeKey(value);
  if (!normalizedKey) {
    return "";
  }

  return TAG_TYPE_ALIAS_MAP[normalizedKey] || normalizedKey;
}

function toId(value: unknown, seen = new WeakSet<object>()): string {
  if (!value) return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (isRecord(value)) {
    if (seen.has(value)) {
      return "";
    }

    seen.add(value);

    if (typeof value.toHexString === "function") {
      return String(value.toHexString()).trim();
    }

    if (typeof value.valueOf === "function") {
      const primitiveValue = value.valueOf();
      if (primitiveValue && primitiveValue !== value) {
        const normalizedPrimitive = toId(primitiveValue, seen);
        if (normalizedPrimitive) {
          return normalizedPrimitive;
        }
      }
    }

    if ("_id" in value && value._id && value._id !== value) {
      const nestedId = toId(value._id, seen);
      if (nestedId) {
        return nestedId;
      }
    }

    if (typeof value.toString === "function") {
      const normalized = String(value.toString()).trim();
      if (normalized && normalized !== "[object Object]") {
        return normalized;
      }
    }
  }

  return "";
}

function getInlineTypeName(value: unknown) {
  if (isRecord(value)) {
    return toDisplayString(value.name);
  }

  const normalized = toDisplayString(value);
  return looksLikeObjectId(normalized) ? "" : normalized;
}

function mergeResolvedTag(
  current: AnalyticsResolvedTag | undefined,
  incoming: AnalyticsResolvedTag,
): AnalyticsResolvedTag {
  if (!current) {
    return incoming;
  }

  const currentTypeName = toDisplayString(current.type?.name);
  const incomingTypeName = toDisplayString(incoming.type?.name);
  const currentTypeId = toDisplayString(current.type?._id);
  const incomingTypeId = toDisplayString(incoming.type?._id);

  const mergedType =
    current.type || incoming.type
      ? {
          _id: currentTypeId || incomingTypeId,
          name: currentTypeName || incomingTypeName,
        }
      : null;

  return {
    _id: current._id || incoming._id,
    name: current.name || incoming.name,
    type: mergedType,
  };
}

function normalizeInlineTag(tag: any): AnalyticsResolvedTag | null {
  const tagId = toId(tag);
  const tagName = toDisplayString(tag?.name ?? tag?.value);
  const inlineTypeValue = isRecord(tag) ? tag.type : undefined;
  const inlineTypeId = isRecord(inlineTypeValue)
    ? toId(inlineTypeValue._id)
    : looksLikeObjectId(toDisplayString(inlineTypeValue))
      ? toDisplayString(inlineTypeValue)
      : "";
  const inlineTypeName =
    normalizeAnalyticsTagTypeName(
      toDisplayString(tag?.typeName) || getInlineTypeName(inlineTypeValue),
    );

  if (!tagId && !tagName) {
    return null;
  }

  if (!tagName) {
    return null;
  }

  return {
    _id: tagId,
    name: tagName,
    type:
      inlineTypeId || inlineTypeName
        ? {
            _id: inlineTypeId,
            name: inlineTypeName,
          }
        : null,
  };
}

function collectQuestionTags(paperSections: any[]) {
  const tags: any[] = [];

  (Array.isArray(paperSections) ? paperSections : []).forEach((section: any) => {
    (Array.isArray(section?.questions) ? section.questions : []).forEach(
      (qWrap: any) => {
        const questionTags = qWrap?.question?.tags;
        if (!Array.isArray(questionTags)) {
          return;
        }
        tags.push(...questionTags);
      },
    );
  });

  return tags;
}

export async function buildAnalyticsTagLookup({
  TagModel,
  TagTypeModel,
  paperSections,
}: {
  TagModel?: any;
  TagTypeModel?: any;
  paperSections: any[];
}): Promise<AnalyticsTagLookup> {
  const lookup: AnalyticsTagLookup = new Map();
  const unresolvedTagIds = new Set<string>();

  collectQuestionTags(paperSections).forEach((tag: any) => {
    const tagId = toId(tag);
    const normalizedTag = normalizeInlineTag(tag);

    if (tagId && normalizedTag) {
      lookup.set(tagId, mergeResolvedTag(lookup.get(tagId), normalizedTag));
    }

    if (
      tagId &&
      looksLikeObjectId(tagId) &&
      (!normalizedTag ||
        !toDisplayString(normalizedTag.name) ||
        !toDisplayString(normalizedTag.type?.name))
    ) {
      unresolvedTagIds.add(tagId);
    }
  });

  if (TagModel && unresolvedTagIds.size > 0) {
    const tagDocs = await TagModel.find({
      _id: { $in: Array.from(unresolvedTagIds) },
    })
      .select("_id name type")
      .populate({ path: "type", select: "name" })
      .lean();

    (Array.isArray(tagDocs) ? tagDocs : []).forEach((tagDoc: any) => {
      const normalizedTag = normalizeInlineTag(tagDoc);
      if (!normalizedTag?._id) {
        return;
      }

      lookup.set(
        normalizedTag._id,
        mergeResolvedTag(lookup.get(normalizedTag._id), normalizedTag),
      );
    });
  }

  const unresolvedTypeIds = new Set<string>();
  lookup.forEach((tag) => {
    const typeId = toDisplayString(tag?.type?._id);
    const typeName = toDisplayString(tag?.type?.name);
    if (typeId && !typeName && looksLikeObjectId(typeId)) {
      unresolvedTypeIds.add(typeId);
    }
  });

  if (TagTypeModel && unresolvedTypeIds.size > 0) {
    const typeDocs = await TagTypeModel.find({
      _id: { $in: Array.from(unresolvedTypeIds) },
    })
      .select("_id name")
      .lean();

    const typeNamesById = new Map<string, string>();
    (Array.isArray(typeDocs) ? typeDocs : []).forEach((typeDoc: any) => {
      const typeId = toId(typeDoc);
      const typeName = toDisplayString(typeDoc?.name);
      const normalizedTypeName = normalizeAnalyticsTagTypeName(typeName);
      if (typeId && normalizedTypeName) {
        typeNamesById.set(typeId, normalizedTypeName);
      }
    });

    if (typeNamesById.size > 0) {
      lookup.forEach((tag, key) => {
        const typeId = toDisplayString(tag?.type?._id);
        const typeName = toDisplayString(tag?.type?.name);
        const resolvedTypeName =
          (typeId ? typeNamesById.get(typeId) : undefined) || typeName;

        if (!typeId || !resolvedTypeName || resolvedTypeName === typeName) {
          return;
        }

        lookup.set(key, {
          ...tag,
          type: {
            _id: typeId,
            name: resolvedTypeName,
          },
        });
      });
    }
  }

  return lookup;
}

export function resolveAnalyticsTags(
  tags: any[],
  tagLookup?: AnalyticsTagLookup,
): AnalyticsResolvedTag[] {
  const resolvedTags: AnalyticsResolvedTag[] = [];
  const seen = new Set<string>();

  (Array.isArray(tags) ? tags : []).forEach((tag: any) => {
    const tagId = toId(tag);
    const inlineTag = normalizeInlineTag(tag);
    const lookupTag = tagId ? tagLookup?.get(tagId) : undefined;
    const resolvedTag =
      inlineTag && lookupTag
        ? mergeResolvedTag(inlineTag, lookupTag)
        : inlineTag || lookupTag || null;

    if (!resolvedTag || !toDisplayString(resolvedTag.name)) {
      return;
    }

    const dedupeKey =
      resolvedTag._id ||
      `${toDisplayString(resolvedTag.type?.name).toLowerCase()}::${resolvedTag.name.toLowerCase()}`;

    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    resolvedTags.push(resolvedTag);
  });

  return resolvedTags;
}
