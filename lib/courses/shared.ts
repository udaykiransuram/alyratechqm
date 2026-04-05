import type {
  CourseAnnouncementBlock,
  CourseAssessmentBlock,
  CourseBlock,
  CourseImageBlock,
  CourseLessonBlock,
  CourseLessonItem,
  CourseLessonResourceItem,
  CourseMetadata,
  CourseModuleBlock,
  CourseNote,
  CourseProgressStatus,
  CourseResourceBlock,
  CourseStatus,
  CourseTextBlock,
  CourseYoutubeBlock,
} from "@/lib/courses/types";
import {
  resolveCourseImageFit,
  resolveCourseImageHeight,
  resolveCourseImageWidth,
} from "@/lib/courses/image-display";
import { resolveYouTubeVideoId } from "@/lib/courses/youtube";
import { sanitizeRichTextHtml } from "@/lib/security/html-sanitize";

function toOptionalString(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

function normalizeId(value: unknown) {
  if (!value) {
    return "";
  }

  if (typeof value === "object" && value !== null && "_id" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)._id || "").trim();
  }

  return String(value || "").trim();
}

function createFallbackBlockId() {
  return `course-block-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function isHttpUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

export function ensureCourseBlockId(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || createFallbackBlockId();
}

export function resolveCourseStatus(value: unknown): CourseStatus {
  switch (String(value || "").trim().toLowerCase()) {
    case "published":
      return "published";
    case "archived":
      return "archived";
    default:
      return "draft";
  }
}

export function normalizeCourseDate(value: unknown) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }

  const parsedDate = new Date(normalized);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

export function normalizeCourseImageUrl(value: unknown) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  if (
    normalized.startsWith("/") ||
    normalized.startsWith("./") ||
    normalized.startsWith("../")
  ) {
    return normalized;
  }

  return isHttpUrl(normalized) ? normalized : "";
}

function normalizeModuleBlock(value: any): CourseModuleBlock {
  return {
    id: ensureCourseBlockId(value?.id),
    type: "module",
    title: String(value?.title || "").trim(),
    summary: toOptionalString(value?.summary),
  };
}

function normalizeTextBlock(value: any): CourseTextBlock {
  return {
    id: ensureCourseBlockId(value?.id),
    type: "text",
    contentHtml: sanitizeRichTextHtml(value?.contentHtml || value?.content || ""),
  };
}

function normalizeLessonItem(value: any): CourseLessonItem | null {
  const type = String(value?.type || "").trim().toLowerCase();

  if (type === "text") {
    return {
      type: "text",
      contentHtml: sanitizeRichTextHtml(value?.contentHtml || value?.content || ""),
    };
  }

  if (type === "image") {
    return {
      type: "image",
      imageUrl: normalizeCourseImageUrl(value?.imageUrl || value?.src),
      altText: toOptionalString(value?.altText || value?.alt),
      caption: toOptionalString(value?.caption),
      imageFit: resolveCourseImageFit(value?.imageFit || value?.fit),
      imageWidth: resolveCourseImageWidth(value?.imageWidth || value?.width),
      imageHeight: resolveCourseImageHeight(value?.imageHeight || value?.height),
    };
  }

  if (type === "youtube") {
    const videoId =
      resolveYouTubeVideoId(value?.youtubeUrl) ||
      resolveYouTubeVideoId(value?.url) ||
      resolveYouTubeVideoId(value?.videoId);

    return {
      type: "youtube",
      videoId: videoId || "",
      caption: toOptionalString(value?.caption),
    };
  }

  if (type === "resource") {
    return {
      type: "resource",
      title: String(value?.title || "").trim(),
      fileUrl: normalizeCourseImageUrl(value?.fileUrl || value?.url),
      fileName: String(value?.fileName || "").trim(),
      caption: toOptionalString(value?.caption),
    } satisfies CourseLessonResourceItem;
  }

  return null;
}

function normalizeLessonBlock(value: any): CourseLessonBlock {
  const items = Array.isArray(value?.items)
    ? value.items.map(normalizeLessonItem).filter(Boolean)
    : [];

  return {
    id: ensureCourseBlockId(value?.id),
    type: "lesson",
    title: String(value?.title || "").trim(),
    summary: toOptionalString(value?.summary),
    estimatedMinutes:
      typeof value?.estimatedMinutes === "number" &&
      Number.isFinite(value.estimatedMinutes)
        ? Math.max(0, Math.min(600, value.estimatedMinutes))
        : null,
    items,
  };
}

function normalizeImageBlock(value: any): CourseImageBlock {
  return {
    id: ensureCourseBlockId(value?.id),
    type: "image",
    imageUrl: normalizeCourseImageUrl(value?.imageUrl || value?.src),
    altText: toOptionalString(value?.altText || value?.alt),
    caption: toOptionalString(value?.caption),
    imageFit: resolveCourseImageFit(value?.imageFit || value?.fit),
    imageWidth: resolveCourseImageWidth(value?.imageWidth || value?.width),
    imageHeight: resolveCourseImageHeight(value?.imageHeight || value?.height),
  };
}

function normalizeYoutubeBlock(value: any): CourseYoutubeBlock {
  const videoId =
    resolveYouTubeVideoId(value?.youtubeUrl) ||
    resolveYouTubeVideoId(value?.url) ||
    resolveYouTubeVideoId(value?.videoId);

  return {
    id: ensureCourseBlockId(value?.id),
    type: "youtube",
    videoId: videoId || "",
    caption: toOptionalString(value?.caption),
  };
}

function normalizeResourceBlock(value: any): CourseResourceBlock {
  return {
    id: ensureCourseBlockId(value?.id),
    type: "resource",
    title: String(value?.title || "").trim(),
    fileUrl: normalizeCourseImageUrl(value?.fileUrl || value?.url),
    fileName: String(value?.fileName || "").trim(),
    caption: toOptionalString(value?.caption),
  };
}

function normalizeAnnouncementBlock(value: any): CourseAnnouncementBlock {
  const tone = String(value?.tone || "").trim().toLowerCase();

  return {
    id: ensureCourseBlockId(value?.id),
    type: "announcement",
    title: String(value?.title || "").trim(),
    contentHtml: sanitizeRichTextHtml(value?.contentHtml || value?.content || ""),
    tone:
      tone === "success" || tone === "warning"
        ? (tone as CourseAnnouncementBlock["tone"])
        : "info",
  };
}

function normalizeAssessmentBlock(value: any): CourseAssessmentBlock {
  const minimumScorePctValue = Number(value?.minimumScorePct);
  const normalizedMinimumScorePct =
    Number.isFinite(minimumScorePctValue) &&
    minimumScorePctValue > 0
      ? Math.min(100, Math.max(0, minimumScorePctValue))
      : null;

  return {
    id: ensureCourseBlockId(value?.id),
    type: "assessment",
    questionPaperId: normalizeId(
      value?.questionPaperId || value?.paperId || value?.questionPaper,
    ),
    titleOverride: toOptionalString(value?.titleOverride),
    required: value?.required !== false,
    minimumScorePct: normalizedMinimumScorePct,
  };
}

export function normalizeCourseBlocks(value: unknown): CourseBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((block) => {
      const type = String((block as { type?: unknown })?.type || "")
        .trim()
        .toLowerCase();

      switch (type) {
        case "module":
          return normalizeModuleBlock(block);
        case "lesson":
          return normalizeLessonBlock(block);
        case "text":
          return normalizeTextBlock(block);
        case "image":
          return normalizeImageBlock(block);
        case "youtube":
          return normalizeYoutubeBlock(block);
        case "resource":
          return normalizeResourceBlock(block);
        case "announcement":
          return normalizeAnnouncementBlock(block);
        case "assessment":
          return normalizeAssessmentBlock(block);
        default:
          return null;
      }
    })
    .filter((block): block is CourseBlock => Boolean(block));
}

export function getCourseAssessmentPaperIds(blocks: CourseBlock[]) {
  return Array.from(
    new Set(
      blocks
        .filter((block): block is CourseAssessmentBlock => block.type === "assessment")
        .map((block) => String(block.questionPaperId || "").trim())
        .filter(Boolean),
    ),
  );
}

export function getRequiredCourseAssessmentPaperIds(blocks: CourseBlock[]) {
  return Array.from(
    new Set(
      blocks
        .filter(
          (block): block is CourseAssessmentBlock =>
            block.type === "assessment" && block.required !== false,
        )
        .map((block) => String(block.questionPaperId || "").trim())
        .filter(Boolean),
    ),
  );
}

export function normalizeCourseMetadata(value: any): CourseMetadata {
  return {
    coverImageUrl: normalizeCourseImageUrl(value?.coverImageUrl),
    coverImageAltText: toOptionalString(value?.coverImageAltText),
    startsAt: normalizeCourseDate(value?.startsAt),
    dueAt: normalizeCourseDate(value?.dueAt),
    completionBadgeLabel: toOptionalString(value?.completionBadgeLabel),
    enforceSequentialProgress: value?.enforceSequentialProgress === true,
    allowNotes: value?.allowNotes !== false,
    allowBookmarks: value?.allowBookmarks !== false,
    isTemplate: value?.isTemplate === true,
  };
}

export function normalizeCourseNotes(value: unknown): CourseNote[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const blockId = String((entry as any)?.blockId || "").trim();
      const text = String((entry as any)?.text || "").trim();
      const updatedAt = normalizeCourseDate((entry as any)?.updatedAt) || new Date().toISOString();

      if (!blockId || !text) {
        return null;
      }

      return {
        blockId,
        text,
        updatedAt,
      };
    })
    .filter((entry): entry is CourseNote => Boolean(entry));
}

export function getTrackableCourseBlocks(blocks: CourseBlock[]) {
  return blocks.filter(
    (block) =>
      block.type !== "module" &&
      block.type !== "announcement" &&
      !(block.type === "assessment" && block.required === false),
  );
}

export function getCourseCompletionPercent(params: {
  blocks: CourseBlock[];
  completedBlockIds?: string[];
  completedAssessmentPaperIds?: string[];
  viewedBlockIds?: string[];
  assessmentCompletionByPaperId?: Map<string, boolean>;
}) {
  const trackableBlocks = getTrackableCourseBlocks(params.blocks);
  if (trackableBlocks.length === 0) {
    return 100;
  }

  let completedCount = 0;

  for (const block of trackableBlocks) {
    if (block.type === "assessment") {
      const paperId = String(block.questionPaperId || "").trim();
      const assessmentDone =
        params.assessmentCompletionByPaperId?.get(paperId) ||
        (Array.isArray(params.completedAssessmentPaperIds)
          ? params.completedAssessmentPaperIds.includes(paperId)
          : false);
      if (assessmentDone) {
        completedCount += 1;
      }
      continue;
    }

    const completedBlockIds = Array.isArray(params.completedBlockIds)
      ? params.completedBlockIds
      : [];
    const viewedBlockIds = Array.isArray(params.viewedBlockIds)
      ? params.viewedBlockIds
      : [];

    if (
      completedBlockIds.includes(block.id) ||
      ((block.type === "text" ||
        block.type === "image" ||
        block.type === "youtube" ||
        block.type === "resource" ||
        block.type === "lesson") &&
        viewedBlockIds.includes(block.id))
    ) {
      completedCount += 1;
    }
  }

  return Math.round((completedCount / trackableBlocks.length) * 100);
}

export function resolveCourseAvailabilityStatus(params: {
  startsAt?: string | null;
  dueAt?: string | null;
  completed: boolean;
  now?: Date;
}) {
  if (params.completed) {
    return "completed" as const;
  }

  const nowTime = (params.now || new Date()).getTime();
  const startsAtTime = params.startsAt ? new Date(params.startsAt).getTime() : null;
  const dueAtTime = params.dueAt ? new Date(params.dueAt).getTime() : null;

  if (startsAtTime && !Number.isNaN(startsAtTime) && startsAtTime > nowTime) {
    return "upcoming" as const;
  }

  if (dueAtTime && !Number.isNaN(dueAtTime) && dueAtTime < nowTime) {
    return "overdue" as const;
  }

  return "active" as const;
}

export function resolveCourseProgressStatus(params: {
  completionPercent: number;
  hasStarted: boolean;
  existingStatus?: string | null;
}) {
  if (params.completionPercent >= 100) {
    return "completed" as const;
  }

  if (params.hasStarted || params.existingStatus === "in_progress") {
    return "in_progress" as const;
  }

  return "not_started" as const;
}
