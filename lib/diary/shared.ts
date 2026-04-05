import { resolveYouTubeVideoId } from "@/lib/courses/youtube";

import type {
  DiaryAuthorSummary,
  DiaryClassSummary,
  DiaryContentSummary,
  DiaryResource,
  DiarySectionSummary,
  DiaryStudentStateSnapshot,
  DiarySubjectSummary,
} from "@/lib/diary/types";

const DIARY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toDiaryId(value: unknown) {
  if (!value) return "";

  if (
    typeof value === "object" &&
    value !== null &&
    "_id" in (value as Record<string, unknown>)
  ) {
    return String((value as Record<string, unknown>)._id || "").trim();
  }

  return String(value || "").trim();
}

export function toOptionalDiaryString(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

export function toDiaryIsoOrNull(value: unknown) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isDiaryEntryDate(value: unknown) {
  return DIARY_DATE_PATTERN.test(String(value || "").trim());
}

export function coerceDiaryEntryDate(value: unknown) {
  const normalized = String(value || "").trim();
  if (isDiaryEntryDate(normalized)) {
    return normalized;
  }

  if (!normalized) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function getTodayDiaryEntryDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

export function formatDiaryDateLabel(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!isDiaryEntryDate(normalized)) {
    return null;
  }

  const date = new Date(`${normalized}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function uniqueSortedDiaryIds(values: unknown) {
  if (!Array.isArray(values)) {
    return [] as string[];
  }

  return Array.from(
    new Set(values.map((value) => toDiaryId(value)).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
}

function decodeDiaryHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function extractDiaryPlainText(value: unknown) {
  return decodeDiaryHtmlEntities(String(value || ""))
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasDiaryHtmlContent(value: unknown) {
  return extractDiaryPlainText(value).length > 0;
}

function createFallbackResourceId(prefix: string, index: number) {
  return `${prefix}-${index + 1}`;
}

export function normalizeDiaryResources(value: unknown): DiaryResource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedResources: DiaryResource[] = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const rawItem = item as Record<string, unknown>;
    const type = String(rawItem.type || "").trim();
    const id =
      toOptionalDiaryString(rawItem.id) ||
      createFallbackResourceId("diary-resource", index);

    if (type === "image") {
      const url = String(rawItem.url || rawItem.imageUrl || "").trim();
      if (!url) {
        return;
      }

      normalizedResources.push({
        id,
        type: "image",
        url,
        altText: toOptionalDiaryString(rawItem.altText),
        caption: toOptionalDiaryString(rawItem.caption),
      });
      return;
    }

    if (type === "youtube") {
      const videoId =
        resolveYouTubeVideoId(rawItem.videoId) ||
        resolveYouTubeVideoId(rawItem.youtubeUrl) ||
        resolveYouTubeVideoId(rawItem.url);

      if (!videoId) {
        return;
      }

      normalizedResources.push({
        id,
        type: "youtube",
        videoId,
        caption: toOptionalDiaryString(rawItem.caption),
      });
      return;
    }

    if (type === "file") {
      const url = String(rawItem.url || rawItem.fileUrl || "").trim();
      const fileName = String(rawItem.fileName || "").trim();
      if (!url || !fileName) {
        return;
      }

      normalizedResources.push({
        id,
        type: "file",
        url,
        fileName,
        caption: toOptionalDiaryString(rawItem.caption),
      });
    }
  });

  return normalizedResources;
}

export function buildDiaryContentSummary(params: {
  lessonSummaryHtml?: unknown;
  homeworkHtml?: unknown;
  teacherNoteHtml?: unknown;
  resources?: unknown;
}): DiaryContentSummary {
  const resources = normalizeDiaryResources(params.resources);

  return {
    hasLessonSummary: hasDiaryHtmlContent(params.lessonSummaryHtml),
    hasHomework: hasDiaryHtmlContent(params.homeworkHtml),
    hasTeacherNote: hasDiaryHtmlContent(params.teacherNoteHtml),
    resourceCount: resources.length,
  };
}

export function mapDiaryClassSummary(value: any): DiaryClassSummary | null {
  const id = toDiaryId(value);
  if (!id) {
    return null;
  }

  return {
    _id: id,
    name: String(value?.name || "").trim() || id,
  };
}

export function mapDiarySubjectSummary(value: any): DiarySubjectSummary | null {
  const id = toDiaryId(value);
  if (!id) {
    return null;
  }

  return {
    _id: id,
    name: String(value?.name || "").trim() || id,
  };
}

export function mapDiarySectionSummary(value: any): DiarySectionSummary | null {
  const id = toDiaryId(value);
  if (!id) {
    return null;
  }

  return {
    _id: id,
    name: String(value?.name || "").trim() || id,
    class:
      value?.class && typeof value.class === "object"
        ? mapDiaryClassSummary(value.class)
        : null,
  };
}

export function mapDiaryAuthorSummary(value: any): DiaryAuthorSummary | null {
  const id = toDiaryId(value);
  if (!id) {
    return null;
  }

  const role = String(value?.role || "").trim();

  return {
    _id: id,
    name: String(value?.name || "").trim() || id,
    role:
      role === "admin" || role === "teacher" || role === "student"
        ? role
        : undefined,
  };
}

export function mapDiaryStateSnapshot(value?: any): DiaryStudentStateSnapshot {
  const status =
    String(value?.status || "").trim() === "completed"
      ? "completed"
      : String(value?.status || "").trim() === "seen"
        ? "seen"
        : "not_seen";

  return {
    status,
    firstSeenAt: toDiaryIsoOrNull(value?.firstSeenAt),
    lastViewedAt: toDiaryIsoOrNull(value?.lastViewedAt),
    completedAt: toDiaryIsoOrNull(value?.completedAt),
  };
}
