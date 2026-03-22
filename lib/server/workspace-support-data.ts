import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import type {
  WorkspaceAcademicSectionItem,
  WorkspaceClassItem,
  WorkspaceSubjectItem,
  WorkspaceTagItem,
  WorkspaceTagTypeItem,
} from "@/lib/workspace/support-types";

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
  await connectDB();
  const { Class: ClassModel } = await getTenantModels(schoolKey, ["Class"]);
  const classes = await ClassModel.find(buildArchiveFilter(false))
    .sort({ name: 1 })
    .lean();

  return Array.isArray(classes) ? classes.map(mapClassItem) : [];
}

export async function getWorkspaceSections(
  schoolKey: string,
  options?: {
    includeInactive?: boolean;
  },
): Promise<WorkspaceAcademicSectionItem[]> {
  await connectDB();
  const includeInactive = options?.includeInactive === true;
  const {
    AcademicSection: AcademicSectionModel,
    Class: ClassModel,
  } = await getTenantModels(schoolKey, ["AcademicSection", "Class"]);

  const sections = await AcademicSectionModel.find({
    ...buildArchiveFilter(false),
    ...(includeInactive ? {} : { isActive: true }),
  })
    .populate({ path: "class", model: ClassModel, select: "name" })
    .sort({ name: 1, _id: 1 })
    .lean();

  return Array.isArray(sections) ? sections.map(mapAcademicSectionItem) : [];
}

export async function getWorkspaceSubjects(
  schoolKey: string,
): Promise<WorkspaceSubjectItem[]> {
  await connectDB();
  const {
    Subject: SubjectModel,
    TagType: TagTypeModel,
  } = await getTenantModels(schoolKey, ["Subject", "Tag", "TagType"]);

  const subjects = await SubjectModel.find(buildArchiveFilter(false))
    .populate({
      path: "tags",
      match: buildArchiveFilter(false),
      populate: { path: "type", model: TagTypeModel, select: "name" },
    })
    .sort({ name: 1, _id: 1 })
    .lean();

  return Array.isArray(subjects) ? subjects.map(mapSubjectItem) : [];
}

export async function getWorkspaceTagTypes(
  schoolKey: string,
): Promise<WorkspaceTagTypeItem[]> {
  await connectDB();
  const { TagType: TagTypeModel } = await getTenantModels(schoolKey, [
    "TagType",
  ]);
  const tagTypes = await TagTypeModel.find({}).sort({ name: 1, _id: 1 }).lean();

  return Array.isArray(tagTypes)
    ? tagTypes
        .map(mapTagTypeItem)
        .filter((tagType) => Boolean(tagType._id) && Boolean(tagType.name))
    : [];
}

export async function getWorkspaceTags(
  schoolKey: string,
): Promise<WorkspaceTagItem[]> {
  await connectDB();
  const { Tag: TagModel } = await getTenantModels(schoolKey, ["Tag", "TagType"]);
  const tags = await TagModel.find(buildArchiveFilter(false))
    .populate("type")
    .sort({ name: 1, _id: 1 })
    .lean();

  return Array.isArray(tags) ? tags.map(mapTagItem) : [];
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
  await connectDB();
  const { Tag: TagModel, Subject: SubjectModel } = await getTenantModels(
    schoolKey,
    ["Tag", "Subject", "TagType"],
  );
  const tagFilter = buildArchiveFilter(false);
  const limit =
    typeof options?.limit === "number" && options.limit > 0
      ? Math.min(Math.floor(options.limit), 100)
      : null;

  const tagsQuery = TagModel.find(tagFilter).populate("type").sort({
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
          .select("name code tags")
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
    total,
    partial: mappedTags.length < total,
  };
}
