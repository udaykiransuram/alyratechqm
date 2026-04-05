import type { DiaryResource, DiaryStatus } from "@/lib/diary/types";
import {
  buildDiaryContentSummary,
  coerceDiaryEntryDate,
  normalizeDiaryResources,
  toOptionalDiaryString,
  uniqueSortedDiaryIds,
} from "@/lib/diary/shared";

export type NormalizedDiaryPayload = {
  title: string;
  entryDate: string;
  classId: string;
  subjectId: string;
  assignedAcademicSectionIds: string[];
  status: DiaryStatus;
  lessonSummaryHtml: string;
  homeworkHtml: string;
  teacherNoteHtml: string;
  resources: DiaryResource[];
};

const DIARY_TITLE_MAX_LENGTH = 180;

function normalizeDiaryStatus(value: unknown): DiaryStatus {
  const normalized = String(value || "").trim();
  if (normalized === "published") {
    return "published";
  }

  if (normalized === "archived") {
    return "archived";
  }

  return "draft";
}

export function buildDiaryScopeKey(params: {
  entryDate: string;
  classId: string;
  subjectId: string;
  assignedAcademicSectionIds: string[];
}) {
  const sortedSectionIds = uniqueSortedDiaryIds(params.assignedAcademicSectionIds);

  return [
    String(params.entryDate || "").trim(),
    String(params.classId || "").trim(),
    String(params.subjectId || "").trim(),
    sortedSectionIds.length > 0 ? sortedSectionIds.join(",") : "all-sections",
  ].join("::");
}

export function normalizeDiaryPayload(body: any): NormalizedDiaryPayload {
  return {
    title: String(body?.title || "").trim(),
    entryDate: coerceDiaryEntryDate(body?.entryDate),
    classId: String(body?.classId || body?.class || "").trim(),
    subjectId: String(body?.subjectId || body?.subject || "").trim(),
    assignedAcademicSectionIds: uniqueSortedDiaryIds(
      body?.assignedAcademicSectionIds ||
        body?.assignedAcademicSections ||
        body?.sectionIds,
    ),
    status: normalizeDiaryStatus(body?.status),
    lessonSummaryHtml: String(body?.lessonSummaryHtml || ""),
    homeworkHtml: String(body?.homeworkHtml || ""),
    teacherNoteHtml: String(body?.teacherNoteHtml || ""),
    resources: normalizeDiaryResources(body?.resources),
  };
}

export function validateNormalizedDiaryPayload(
  payload: NormalizedDiaryPayload,
  options?: { strict?: boolean; allowArchivedStatus?: boolean },
) {
  if (!payload.title) {
    return {
      ok: false as const,
      message: "Add a diary title.",
    };
  }

  if (payload.title.length > DIARY_TITLE_MAX_LENGTH) {
    return {
      ok: false as const,
      message: `Keep the diary title within ${DIARY_TITLE_MAX_LENGTH} characters.`,
    };
  }

  if (payload.status === "archived" && !options?.allowArchivedStatus) {
    return {
      ok: false as const,
      message: "Use the archive action to archive a diary entry.",
    };
  }

  if (!payload.entryDate) {
    return {
      ok: false as const,
      message: "Select the diary date.",
    };
  }

  if (!payload.classId) {
    return {
      ok: false as const,
      message: "Select the class for this diary entry.",
    };
  }

  if (!payload.subjectId) {
    return {
      ok: false as const,
      message: "Select the subject for this diary entry.",
    };
  }

  for (const resource of payload.resources) {
    if (resource.type === "image" && !String(resource.url || "").trim()) {
      return {
        ok: false as const,
        message: "Every diary image needs an uploaded image.",
      };
    }

    if (resource.type === "youtube" && !String(resource.videoId || "").trim()) {
      return {
        ok: false as const,
        message: "Every diary video needs a valid YouTube link.",
      };
    }

    if (
      resource.type === "file" &&
      (!String(resource.url || "").trim() ||
        !String(resource.fileName || "").trim())
    ) {
      return {
        ok: false as const,
        message: "Every diary file needs an uploaded file.",
      };
    }
  }

  if (options?.strict) {
    const content = buildDiaryContentSummary(payload);
    if (
      !content.hasLessonSummary &&
      !content.hasHomework &&
      !content.hasTeacherNote &&
      content.resourceCount === 0
    ) {
      return {
        ok: false as const,
        message:
          "Add lesson notes, homework, a teacher note, or at least one resource before publishing.",
      };
    }
  }

  return {
    ok: true as const,
  };
}

export function buildDiaryDocumentFromPayload(params: {
  payload: NormalizedDiaryPayload;
  createdBy?: string;
  updatedBy: string;
  previousPublishedAt?: Date | string | null;
}) {
  const publishedAt =
    params.payload.status === "published"
      ? params.previousPublishedAt
        ? new Date(params.previousPublishedAt)
        : new Date()
      : null;

  return {
    title: params.payload.title,
    entryDate: params.payload.entryDate,
    class: params.payload.classId,
    subject: params.payload.subjectId,
    assignedAcademicSections: params.payload.assignedAcademicSectionIds,
    status: params.payload.status,
    scopeKey: buildDiaryScopeKey({
      entryDate: params.payload.entryDate,
      classId: params.payload.classId,
      subjectId: params.payload.subjectId,
      assignedAcademicSectionIds: params.payload.assignedAcademicSectionIds,
    }),
    lessonSummaryHtml: toOptionalDiaryString(params.payload.lessonSummaryHtml) || "",
    homeworkHtml: toOptionalDiaryString(params.payload.homeworkHtml) || "",
    teacherNoteHtml: toOptionalDiaryString(params.payload.teacherNoteHtml) || "",
    resources: params.payload.resources.map((resource) => {
      if (resource.type === "image") {
        return {
          id: resource.id,
          type: resource.type,
          url: resource.url,
          altText: resource.altText || "",
          caption: resource.caption || "",
        };
      }

      if (resource.type === "youtube") {
        return {
          id: resource.id,
          type: resource.type,
          videoId: resource.videoId,
          caption: resource.caption || "",
        };
      }

      return {
        id: resource.id,
        type: resource.type,
        url: resource.url,
        fileName: resource.fileName,
        caption: resource.caption || "",
      };
    }),
    ...(params.createdBy ? { createdBy: params.createdBy } : {}),
    updatedBy: params.updatedBy,
    publishedAt,
    ...(params.payload.status === "archived"
      ? { isArchived: true, archivedAt: new Date() }
      : { isArchived: false, archivedAt: null }),
  };
}
