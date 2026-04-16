import {
  normalizeCourseBlocks,
  normalizeCourseMetadata,
  resolveCourseStatus,
} from "@/lib/courses/shared";
import type { CourseBlock, CourseMetadata, CourseStatus } from "@/lib/courses/types";

export type CourseTemplateContextPayload = {
  templateFromCourseId: string;
  versionFromCourseId: string;
};

function toId(value: unknown) {
  if (!value) return "";
  if (typeof value === "object" && value !== null && "_id" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)._id || "").trim();
  }
  return String(value || "").trim();
}

function toOptionalString(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || "";
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return Array.from(
    new Set(value.map((item) => toId(item)).filter(Boolean)),
  );
}

function normalizeCourseTemplateContext(body: any): CourseTemplateContextPayload {
  return {
    templateFromCourseId: toId(
      body?.templateFromCourseId || body?.templateFrom || body?.sourceTemplateCourseId,
    ),
    versionFromCourseId: toId(
      body?.versionFromCourseId || body?.versionFrom || body?.templateVersionSourceCourseId,
    ),
  };
}

export function normalizeCoursePayload(body: any) {
  return {
    title: String(body?.title || "").trim(),
    summary: toOptionalString(body?.summary),
    classId: toId(body?.class || body?.classId),
    subjectIds: normalizeIds(body?.subjectIds ?? body?.subjects),
    assignedAcademicSectionIds: normalizeIds(
      body?.assignedAcademicSections ??
        body?.assignedAcademicSectionIds ??
        body?.academicSectionIds,
    ),
    status: resolveCourseStatus(body?.status),
    blocks: normalizeCourseBlocks(body?.blocks),
    metadata: normalizeCourseMetadata(body),
    templateContext: normalizeCourseTemplateContext(body),
  };
}

export function validateNormalizedCourseBlocks(
  blocks: CourseBlock[],
  options?: {
    strict?: boolean;
  },
) {
  const strict = options?.strict !== false;

  if (!Array.isArray(blocks)) {
    return {
      ok: false as const,
      message: "Course content could not be read correctly.",
    };
  }

  if (strict && blocks.length === 0) {
    return {
      ok: false as const,
      message: "Add at least one content block before saving the course.",
    };
  }

  const seenAssessmentPaperIds = new Set<string>();
  let pendingModuleTitle: string | null = null;
  let moduleHasContent = false;

  for (const block of blocks) {
    if (!block.id || !block.type) {
      return {
        ok: false as const,
        message: "Each course block must include a valid id and type.",
      };
    }

    if (!strict) {
      continue;
    }

    if (block.type === "text" && !String(block.contentHtml || "").trim()) {
      return {
        ok: false as const,
        message: "Text blocks require content.",
      };
    }

    if (block.type === "lesson") {
      if (!String(block.title || "").trim()) {
        return {
          ok: false as const,
          message: "Lesson blocks require a title.",
        };
      }

      const items = Array.isArray(block.items) ? block.items : [];
      if (items.length === 0) {
        return {
          ok: false as const,
          message: "Lesson blocks require at least one content item.",
        };
      }

      for (const item of items) {
        if (item.type === "text" && !String(item.contentHtml || "").trim()) {
          return {
            ok: false as const,
            message: "Lesson text items require content.",
          };
        }
        if (item.type === "image" && !String(item.imageUrl || "").trim()) {
          return {
            ok: false as const,
            message: "Lesson image items require an uploaded image.",
          };
        }
        if (item.type === "youtube" && !String(item.videoId || "").trim()) {
          return {
            ok: false as const,
            message: "Lesson video items require a valid YouTube link.",
          };
        }
        if (
          item.type === "resource" &&
          (!String(item.title || "").trim() ||
            !String(item.fileUrl || "").trim() ||
            !String(item.fileName || "").trim())
        ) {
          return {
            ok: false as const,
            message: "Lesson resources require a title and file link.",
          };
        }
      }
    }

    if (block.type === "image" && !String(block.imageUrl || "").trim()) {
      return {
        ok: false as const,
        message: "Image blocks require an uploaded image.",
      };
    }

    if (block.type === "youtube" && !String(block.videoId || "").trim()) {
      return {
        ok: false as const,
        message: "YouTube blocks require a valid YouTube link.",
      };
    }

    if (block.type === "module" && !String(block.title || "").trim()) {
      return {
        ok: false as const,
        message: "Module blocks require a title.",
      };
    }

    if (
      block.type === "announcement" &&
      (!String(block.title || "").trim() ||
        !String(block.contentHtml || "").trim())
    ) {
      return {
        ok: false as const,
        message: "Announcement blocks require a title and content.",
      };
    }

    if (
      block.type === "resource" &&
      (!String(block.title || "").trim() ||
        !String(block.fileUrl || "").trim() ||
        !String(block.fileName || "").trim())
    ) {
      return {
        ok: false as const,
        message: "Resource blocks require a title and file link.",
      };
    }

    if (
      block.type === "assessment" &&
      !String(block.questionPaperId || "").trim()
    ) {
      return {
        ok: false as const,
        message: "Assessment blocks require a linked question paper.",
      };
    }

    if (block.type === "module") {
      if (pendingModuleTitle && !moduleHasContent) {
        return {
          ok: false as const,
          message: `Add at least one lesson or assessment inside "${pendingModuleTitle}".`,
        };
      }
      pendingModuleTitle = String(block.title || "").trim() || "this module";
      moduleHasContent = false;
    } else if (
      block.type === "lesson" ||
      block.type === "assessment" ||
      block.type === "announcement" ||
      block.type === "text" ||
      block.type === "image" ||
      block.type === "youtube" ||
      block.type === "resource"
    ) {
      moduleHasContent = true;
    }

    if (block.type === "assessment") {
      const paperId = String(block.questionPaperId || "").trim();
      if (seenAssessmentPaperIds.has(paperId)) {
        return {
          ok: false as const,
          message: "Use each linked assessment only once in a course.",
        };
      }
      seenAssessmentPaperIds.add(paperId);
    }
  }

  if (strict && pendingModuleTitle && !moduleHasContent) {
    return {
      ok: false as const,
      message: `Add at least one lesson or assessment inside "${pendingModuleTitle}".`,
    };
  }

  return {
    ok: true as const,
  };
}

export function validateNormalizedCourseMetadata(metadata: CourseMetadata) {
  const startsAtTime = metadata.startsAt ? new Date(metadata.startsAt).getTime() : null;
  const dueAtTime = metadata.dueAt ? new Date(metadata.dueAt).getTime() : null;

  if (
    startsAtTime !== null &&
    dueAtTime !== null &&
    !Number.isNaN(startsAtTime) &&
    !Number.isNaN(dueAtTime) &&
    dueAtTime < startsAtTime
  ) {
    return {
      ok: false as const,
      message: "The due date must be after the start date.",
    };
  }

  return {
    ok: true as const,
  };
}

export function buildCourseDocumentFromPayload(params: {
  title: string;
  summary: string;
  classId: string;
  subjectIds: string[];
  assignedAcademicSectionIds: string[];
  status: CourseStatus;
  blocks: CourseBlock[];
  metadata: CourseMetadata;
  createdBy?: string;
  previousPublishedAt?: Date | string | null;
  template?: {
    familyId?: string | null;
    versionNumber?: number | null;
    parentCourseId?: string | null;
    derivedFromTemplateCourseId?: string | null;
    derivedFromTemplateVersionNumber?: number | null;
  };
}) {
  const publishedAt =
    params.status === "published"
      ? params.previousPublishedAt
        ? new Date(params.previousPublishedAt)
        : new Date()
      : null;

  return {
    title: params.title,
    summary: params.summary,
    class: params.classId,
    subjectIds: params.subjectIds,
    assignedAcademicSections: params.assignedAcademicSectionIds,
    status: params.status,
    blocks: params.blocks.map((block) => {
      if (block.type === "assessment") {
        return {
          id: block.id,
          type: block.type,
          questionPaper: block.questionPaperId,
          titleOverride: block.titleOverride || "",
          required: block.required !== false,
          minimumScorePct: block.minimumScorePct ?? null,
        };
      }

      if (block.type === "module") {
        return {
          id: block.id,
          type: block.type,
          title: block.title,
          summary: block.summary || "",
        };
      }

      if (block.type === "lesson") {
        return {
          id: block.id,
          type: block.type,
          title: block.title,
          summary: block.summary || "",
          estimatedMinutes:
            typeof block.estimatedMinutes === "number" &&
            Number.isFinite(block.estimatedMinutes)
              ? block.estimatedMinutes
              : null,
          items: Array.isArray(block.items)
            ? block.items.map((item) => ({ ...item }))
            : [],
        };
      }

      if (block.type === "youtube") {
        return {
          id: block.id,
          type: block.type,
          videoId: block.videoId,
          caption: block.caption || "",
        };
      }

      if (block.type === "resource") {
        return {
          id: block.id,
          type: block.type,
          title: block.title,
          fileUrl: block.fileUrl,
          fileName: block.fileName,
          caption: block.caption || "",
        };
      }

      if (block.type === "announcement") {
        return {
          id: block.id,
          type: block.type,
          title: block.title,
          contentHtml: block.contentHtml,
          tone: block.tone,
        };
      }

      if (block.type === "image") {
        return {
          id: block.id,
          type: block.type,
          imageUrl: block.imageUrl,
          altText: block.altText || "",
          caption: block.caption || "",
          imageFit: block.imageFit,
          imageWidth: block.imageWidth,
          imageHeight: block.imageHeight,
        };
      }

      return {
        id: block.id,
        type: block.type,
        contentHtml: block.contentHtml,
      };
    }),
    coverImageUrl: params.metadata.coverImageUrl || "",
    coverImageAltText: params.metadata.coverImageAltText || "",
    startsAt: params.metadata.startsAt ? new Date(params.metadata.startsAt) : null,
    dueAt: params.metadata.dueAt ? new Date(params.metadata.dueAt) : null,
    completionBadgeLabel: params.metadata.completionBadgeLabel || "",
    enforceSequentialProgress: params.metadata.enforceSequentialProgress === true,
    allowNotes: params.metadata.allowNotes !== false,
    allowBookmarks: params.metadata.allowBookmarks !== false,
    isTemplate: params.metadata.isTemplate === true,
    templateFamilyId:
      params.template?.familyId && params.metadata.isTemplate === true
        ? params.template.familyId
        : null,
    templateVersionNumber:
      typeof params.template?.versionNumber === "number" &&
      Number.isFinite(params.template.versionNumber) &&
      params.metadata.isTemplate === true
        ? Math.max(1, Math.floor(params.template.versionNumber))
        : null,
    templateParentCourse:
      params.template?.parentCourseId && params.metadata.isTemplate === true
        ? params.template.parentCourseId
        : null,
    derivedFromTemplateCourse:
      params.template?.derivedFromTemplateCourseId &&
      params.metadata.isTemplate !== true
        ? params.template.derivedFromTemplateCourseId
        : null,
    derivedFromTemplateVersionNumber:
      typeof params.template?.derivedFromTemplateVersionNumber === "number" &&
      Number.isFinite(params.template.derivedFromTemplateVersionNumber) &&
      params.metadata.isTemplate !== true
        ? Math.max(1, Math.floor(params.template.derivedFromTemplateVersionNumber))
        : null,
    ...(params.createdBy ? { createdBy: params.createdBy } : {}),
    publishedAt,
    ...(params.status === "archived"
      ? { isArchived: true, archivedAt: new Date() }
      : { isArchived: false, archivedAt: null }),
  };
}
