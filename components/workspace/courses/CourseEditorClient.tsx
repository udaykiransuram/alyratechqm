"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  FileImage,
  FileText,
  Plus,
  Save,
  Trash2,
  Video,
} from "lucide-react";

import RichTextEditor from "@/components/RichTextEditor";
import { ContentRenderer } from "@/components/ContentRenderer";
import CourseResourcePreview from "@/components/courses/CourseResourcePreview";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import FilePickerField from "@/components/ui/file-picker-field";
import {
  SearchableCommandSelect,
  type SearchableCommandOption,
} from "@/components/ui/searchable-command-select";
import { SearchableMultiSelectPopover } from "@/components/ui/searchable-multi-select-popover";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { fetchApiJson } from "@/lib/client/api";
import {
  COURSE_IMAGE_FIT_OPTIONS,
  COURSE_IMAGE_HEIGHT_OPTIONS,
  COURSE_IMAGE_WIDTH_OPTIONS,
  getCourseImageDisplayClasses,
} from "@/lib/courses/image-display";
import type {
  CourseAnnouncementTone,
  WorkspaceCourseDetail,
  WorkspaceCoursePaperOption,
} from "@/lib/courses/types";
import {
  buildYouTubeEmbedUrl,
  buildYouTubeWatchUrl,
  resolveYouTubeVideoId,
} from "@/lib/courses/youtube";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import { cn } from "@/lib/utils";
import type {
  WorkspaceAcademicSectionItem,
  WorkspaceClassItem,
  WorkspaceSubjectItem,
} from "@/lib/workspace/support-types";

type EditableModuleBlock = {
  id: string;
  type: "module";
  title: string;
  summary: string;
};

type EditableLessonTextItem = {
  id: string;
  type: "text";
  contentHtml: string;
};

type EditableLessonImageItem = {
  id: string;
  type: "image";
  imageUrl: string;
  altText: string;
  caption: string;
  imageFit: "contain" | "cover";
  imageWidth: "compact" | "standard" | "full";
  imageHeight: "small" | "medium" | "large" | "xlarge";
};

type EditableLessonYoutubeItem = {
  id: string;
  type: "youtube";
  videoId: string;
  caption: string;
  urlInput: string;
};

type EditableLessonResourceItem = {
  id: string;
  type: "resource";
  title: string;
  fileUrl: string;
  fileName: string;
  caption: string;
};

type EditableLessonItem =
  | EditableLessonTextItem
  | EditableLessonImageItem
  | EditableLessonYoutubeItem
  | EditableLessonResourceItem;

type EditableLessonBlock = {
  id: string;
  type: "lesson";
  title: string;
  summary: string;
  estimatedMinutes: string;
  items: EditableLessonItem[];
};

type EditableAnnouncementBlock = {
  id: string;
  type: "announcement";
  title: string;
  tone: CourseAnnouncementTone;
  contentHtml: string;
};

type EditableAssessmentBlock = {
  id: string;
  type: "assessment";
  questionPaperId: string;
  titleOverride: string;
  required: boolean;
  minimumScorePct: string;
};

type EditableCourseBlock =
  | EditableModuleBlock
  | EditableLessonBlock
  | EditableAnnouncementBlock
  | EditableAssessmentBlock;

type EditableSpecialBlock = EditableAnnouncementBlock | EditableAssessmentBlock;

type ModuleCurriculumChild =
  | {
      kind: "lesson";
      block: EditableLessonBlock;
      blockIndex: number;
    }
  | {
      kind: "special";
      block: EditableSpecialBlock;
      blockIndex: number;
    };

type CurriculumRenderEntry =
  | {
      kind: "module";
      module: EditableModuleBlock;
      moduleIndex: number;
      children: ModuleCurriculumChild[];
    }
  | {
      kind: "special";
      block: EditableSpecialBlock;
      blockIndex: number;
    }
  | {
      kind: "orphan-lesson";
      block: EditableLessonBlock;
      blockIndex: number;
    };

type CourseEditorClientProps = {
  mode: "create" | "edit";
  courseId?: string;
  returnToPath: string;
  classes: WorkspaceClassItem[];
  sections: WorkspaceAcademicSectionItem[];
  subjects: WorkspaceSubjectItem[];
  papers: WorkspaceCoursePaperOption[];
  initialCourse?: WorkspaceCourseDetail | null;
  creationContext?: {
    mode: "standard" | "duplicate" | "template" | "template-version";
    startAsTemplate?: boolean;
    sourceCourseId?: string | null;
    sourceCourseTitle?: string | null;
    sourceTemplateVersionNumber?: number | null;
  };
};

function createClientBlockId() {
  return `course-block-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function createClientItemId() {
  return `course-item-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function createStableId(prefix: string, parts: Array<string | number | null | undefined>) {
  const input = parts
    .map((value) => String(value ?? ""))
    .join("|");
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return `${prefix}-${hash.toString(36)}`;
}

function formatDateTimeLocalInput(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function createLessonItem(
  type: EditableLessonItem["type"],
  overrides?: Partial<EditableLessonItem>,
): EditableLessonItem {
  const id = createClientItemId();

  if (type === "text") {
    return {
      id,
      type,
      contentHtml: "",
      ...overrides,
    } as EditableLessonTextItem;
  }

  if (type === "image") {
    return {
      id,
      type,
      imageUrl: "",
      altText: "",
      caption: "",
      imageFit: "contain",
      imageWidth: "standard",
      imageHeight: "large",
      ...overrides,
    } as EditableLessonImageItem;
  }

  if (type === "youtube") {
    return {
      id,
      type,
      videoId: "",
      caption: "",
      urlInput: "",
      ...overrides,
    } as EditableLessonYoutubeItem;
  }

  return {
    id,
    type,
    title:
      overrides && "title" in overrides && typeof overrides.title === "string"
        ? overrides.title
        : "",
    fileUrl: "",
    fileName: "",
    caption: "",
    ...overrides,
  } as EditableLessonResourceItem;
}

function createModuleBlock(title = ""): EditableModuleBlock {
  return {
    id: createClientBlockId(),
    type: "module",
    title,
    summary: "",
  };
}

function createLessonBlock(params?: {
  title?: string;
  itemType?: EditableLessonItem["type"];
  itemOverrides?: Partial<EditableLessonItem>;
}): EditableLessonBlock {
  const itemType = params?.itemType || "text";

  return {
    id: createClientBlockId(),
    type: "lesson",
    title: params?.title || "",
    summary: "",
    estimatedMinutes: "",
    items: [createLessonItem(itemType, params?.itemOverrides)],
  };
}

function buildStarterCourseBlocks(): EditableCourseBlock[] {
  return [createLessonBlock({ title: "Lesson 1" })];
}

function shouldSeedStarterCourseBlocks(params: {
  mode: "create" | "edit";
  creationContext: CourseEditorClientProps["creationContext"];
  initialCourse?: WorkspaceCourseDetail | null;
  mappedBlocks: EditableCourseBlock[];
}) {
  return (
    params.mode === "create" &&
    !params.initialCourse &&
    params.creationContext?.mode === "standard" &&
    params.creationContext?.startAsTemplate !== true &&
    params.mappedBlocks.length === 0
  );
}

function buildEmptyBlock(type: EditableCourseBlock["type"]): EditableCourseBlock {
  switch (type) {
    case "module":
      return createModuleBlock();
    case "lesson":
      return createLessonBlock();
    case "announcement":
      return {
        id: createClientBlockId(),
        type,
        title: "",
        tone: "info",
        contentHtml: "",
      };
    case "assessment":
      return {
        id: createClientBlockId(),
        type,
        questionPaperId: "",
        titleOverride: "",
        required: true,
        minimumScorePct: "",
      };
  }
}

function mapInitialBlocks(course?: WorkspaceCourseDetail | null): EditableCourseBlock[] {
  const sourceBlocks = Array.isArray(course?.blocks) ? course!.blocks : [];
  const mappedBlocks: EditableCourseBlock[] = [];
  let lessonIndex = 0;
  let pendingItems: EditableLessonItem[] = [];
  let legacyItemIndex = 0;

  const flushLesson = () => {
    if (pendingItems.length === 0) {
      return;
    }

    lessonIndex += 1;
    mappedBlocks.push({
      id: createStableId("course-block", ["lesson", lessonIndex]),
      type: "lesson",
      title: `Lesson ${lessonIndex}`,
      summary: "",
      estimatedMinutes: "",
      items: pendingItems,
    });
    pendingItems = [];
  };

  const mapLegacyItem = (block: any): EditableLessonItem | null => {
    legacyItemIndex += 1;
    if (block.type === "text") {
      return {
        id: createStableId("course-item", ["legacy-text", legacyItemIndex, block.contentHtml]),
        type: "text",
        contentHtml: block.contentHtml || "",
      };
    }

    if (block.type === "image") {
      return {
        id: createStableId(
          "course-item",
          ["legacy-image", legacyItemIndex, block.imageUrl, block.caption],
        ),
        type: "image",
        imageUrl: block.imageUrl || "",
        altText: block.altText || "",
        caption: block.caption || "",
        imageFit: block.imageFit || "contain",
        imageWidth: block.imageWidth || "standard",
        imageHeight: block.imageHeight || "large",
      };
    }

    if (block.type === "youtube") {
      return {
        id: createStableId(
          "course-item",
          ["legacy-youtube", legacyItemIndex, block.videoId, block.caption],
        ),
        type: "youtube",
        videoId: block.videoId || "",
        caption: block.caption || "",
        urlInput: block.videoId ? buildYouTubeWatchUrl(block.videoId) : "",
      };
    }

    if (block.type === "resource") {
      return {
        id: createStableId(
          "course-item",
          ["legacy-resource", legacyItemIndex, block.fileUrl, block.title],
        ),
        type: "resource",
        title: block.title || "",
        fileUrl: block.fileUrl || "",
        fileName: block.fileName || "",
        caption: block.caption || "",
      };
    }

    return null;
  };

  const mapLessonBlock = (block: any): EditableLessonBlock => ({
    id: block.id || createStableId("course-block", ["lesson", block.title || "", block.summary || ""]),
    type: "lesson",
    title: block.title || "",
    summary: block.summary || "",
    estimatedMinutes:
      typeof block.estimatedMinutes === "number" && Number.isFinite(block.estimatedMinutes)
        ? String(block.estimatedMinutes)
        : "",
    items: Array.isArray(block.items)
      ? block.items
          .map((item: any, index: number) => {
            if (item?.type === "text") {
              return {
                id:
                  item.id ||
                  createStableId("course-item", [
                    block.id || block.title || "lesson",
                    "text",
                    index,
                    item.contentHtml,
                  ]),
                type: "text",
                contentHtml: item.contentHtml || "",
              };
            }
            if (item?.type === "image") {
              return {
                id:
                  item.id ||
                  createStableId("course-item", [
                    block.id || block.title || "lesson",
                    "image",
                    index,
                    item.imageUrl,
                  ]),
                type: "image",
                imageUrl: item.imageUrl || "",
                altText: item.altText || "",
                caption: item.caption || "",
                imageFit: item.imageFit || "contain",
                imageWidth: item.imageWidth || "standard",
                imageHeight: item.imageHeight || "large",
              };
            }
            if (item?.type === "youtube") {
              return {
                id:
                  item.id ||
                  createStableId("course-item", [
                    block.id || block.title || "lesson",
                    "youtube",
                    index,
                    item.videoId,
                  ]),
                type: "youtube",
                videoId: item.videoId || "",
                caption: item.caption || "",
                urlInput: item.videoId ? buildYouTubeWatchUrl(item.videoId) : "",
              };
            }
            if (item?.type === "resource") {
              return {
                id:
                  item.id ||
                  createStableId("course-item", [
                    block.id || block.title || "lesson",
                    "resource",
                    index,
                    item.fileUrl,
                  ]),
                type: "resource",
                title: item.title || "",
                fileUrl: item.fileUrl || "",
                fileName: item.fileName || "",
                caption: item.caption || "",
              };
            }
            return null;
          })
          .filter(Boolean)
      : [],
  });

  sourceBlocks.forEach((block) => {
    switch (block.type) {
      case "module":
        flushLesson();
        mappedBlocks.push({
          id: block.id || createStableId("course-block", ["module", block.title, block.summary]),
          type: "module",
          title: block.title,
          summary: block.summary || "",
        });
        return;
      case "lesson":
        flushLesson();
        mappedBlocks.push(mapLessonBlock(block));
        return;
      case "announcement":
        flushLesson();
        mappedBlocks.push({
          id: block.id || createStableId("course-block", ["announcement", block.title, block.contentHtml]),
          type: "announcement",
          title: block.title,
          tone: block.tone,
          contentHtml: block.contentHtml,
        });
        return;
      case "assessment":
        flushLesson();
        mappedBlocks.push({
          id: block.id || createStableId("course-block", ["assessment", block.questionPaperId]),
          type: "assessment",
          questionPaperId: block.questionPaperId,
          titleOverride: block.titleOverride || "",
          required: block.required !== false,
          minimumScorePct:
            typeof block.minimumScorePct === "number" &&
            Number.isFinite(block.minimumScorePct)
              ? String(block.minimumScorePct)
              : "",
        });
        return;
      case "text":
      case "image":
      case "youtube":
      case "resource": {
        const item = mapLegacyItem(block);
        if (item) {
          pendingItems.push(item);
        }
        return;
      }
      default:
        return;
    }
  });

  flushLesson();
  return mappedBlocks;
}

function deriveInitialSubjectIds(course?: WorkspaceCourseDetail | null) {
  const explicitSubjectIds =
    Array.isArray(course?.subjects) && course.subjects.length > 0
      ? course.subjects
          .map((subject) => String(subject?._id || "").trim())
          .filter(Boolean)
      : [];

  if (explicitSubjectIds.length > 0) {
    return Array.from(new Set(explicitSubjectIds));
  }

  const assessmentSubjectIds = Array.isArray(course?.blocks)
    ? course.blocks.flatMap((block) =>
        block.type === "assessment" && Array.isArray(block.paper?.subjects)
          ? block.paper.subjects
              .map((subject) => String(subject?._id || "").trim())
              .filter(Boolean)
          : [],
      )
    : [];

  return Array.from(new Set(assessmentSubjectIds));
}

function doesPaperCoverCourseSections(
  selectedSectionIds: string[],
  paperAssignedSectionIds: string[],
) {
  if (selectedSectionIds.length === 0) {
    return paperAssignedSectionIds.length === 0;
  }

  if (paperAssignedSectionIds.length === 0) {
    return true;
  }

  return selectedSectionIds.every((sectionId) =>
    paperAssignedSectionIds.includes(sectionId),
  );
}

function doesPaperFitSelectedSubjects(
  selectedSubjectIds: string[],
  paperSubjectIds: string[],
) {
  if (selectedSubjectIds.length === 0) {
    return true;
  }

  return paperSubjectIds.every((subjectId) => selectedSubjectIds.includes(subjectId));
}

function isPaperCompatibleWithCourseScope(
  paper: WorkspaceCoursePaperOption,
  classId: string,
  assignedSectionIds: string[],
  selectedSubjectIds: string[],
) {
  const paperClassId = String(paper.class?._id || "").trim();

  if (classId && paperClassId && paperClassId !== classId) {
    return false;
  }

  if (
    !doesPaperCoverCourseSections(
      assignedSectionIds,
      paper.assignedAcademicSections.map((section) => section._id),
    )
  ) {
    return false;
  }

  return doesPaperFitSelectedSubjects(
    selectedSubjectIds,
    paper.subjects.map((subject) => subject._id),
  );
}

function formatPaperOptionLabel(paper: WorkspaceCoursePaperOption) {
  const classLabel = paper.class?.name ? ` • ${paper.class.name}` : "";
  return `${paper.title}${classLabel}`;
}

function isSpecialCourseBlock(block: EditableCourseBlock): block is EditableSpecialBlock {
  return block.type === "announcement" || block.type === "assessment";
}

function buildCurriculumEntries(blocks: EditableCourseBlock[]): CurriculumRenderEntry[] {
  const entries: CurriculumRenderEntry[] = [];
  let activeModuleEntry: Extract<CurriculumRenderEntry, { kind: "module" }> | null = null;

  blocks.forEach((block, blockIndex) => {
    if (block.type === "module") {
      activeModuleEntry = {
        kind: "module",
        module: block,
        moduleIndex: blockIndex,
        children: [],
      };
      entries.push(activeModuleEntry);
      return;
    }

    if (block.type === "lesson") {
      if (activeModuleEntry) {
        activeModuleEntry.children.push({
          kind: "lesson",
          block,
          blockIndex,
        });
        return;
      }

      entries.push({
        kind: "orphan-lesson",
        block,
        blockIndex,
      });
      return;
    }

    if (!isSpecialCourseBlock(block)) {
      return;
    }

    if (activeModuleEntry) {
      activeModuleEntry.children.push({
        kind: "special",
        block,
        blockIndex,
      });
      return;
    }

    entries.push({
      kind: "special",
      block,
      blockIndex,
    });
  });

  return entries;
}

function stripHtmlToText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeText(value: string, maxLength = 88) {
  const plainText = stripHtmlToText(value);
  if (!plainText) {
    return "";
  }

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.slice(0, maxLength - 1).trimEnd()}…`;
}

function getLessonItemTypeLabel(item: EditableLessonItem) {
  switch (item.type) {
    case "text":
      return "Text";
    case "image":
      return "Image";
    case "youtube":
      return "Video";
    case "resource":
      return "File";
  }
}

function getLessonItemSummary(item: EditableLessonItem) {
  switch (item.type) {
    case "text":
      return summarizeText(item.contentHtml) || "Add lesson notes, explanation, or instructions.";
    case "image":
      return item.caption || item.altText || item.imageUrl || "Add an image and optional caption.";
    case "youtube":
      return item.caption || item.urlInput || "Paste a YouTube link.";
    case "resource":
      return item.title || item.fileName || item.caption || "Upload a supporting resource.";
  }
}

function getLessonItemIcon(item: EditableLessonItem) {
  switch (item.type) {
    case "text":
      return FileText;
    case "image":
      return FileImage;
    case "youtube":
      return Video;
    case "resource":
      return FileText;
  }
}

function getSpecialBlockTitle(
  block: EditableSpecialBlock,
  paperOptionsById: Map<string, WorkspaceCoursePaperOption>,
) {
  if (block.type === "announcement") {
    return block.title || "Announcement";
  }

  return (
    block.titleOverride ||
    paperOptionsById.get(block.questionPaperId)?.title ||
    "Assessment"
  );
}

function getBlockTypeLabel(block: EditableCourseBlock) {
  switch (block.type) {
    case "module":
      return "Chapter";
    case "lesson":
      return "Lesson";
    case "announcement":
      return "Announcement";
    case "assessment":
      return "Assessment";
  }
}

function getActionButtonLabel(params: {
  mode: "create" | "edit";
  targetStatus: "draft" | "published";
  saving: boolean;
}) {
  if (params.targetStatus === "draft") {
    return params.saving ? "Saving draft..." : "Save as Draft";
  }

  if (params.saving) {
    return params.mode === "edit" ? "Publishing course..." : "Creating course...";
  }

  return params.mode === "edit" ? "Publish Course" : "Create Course";
}

function FormField({
  label,
  hint,
  hintTone = "muted",
  children,
  className,
}: {
  label: string;
  hint?: string;
  hintTone?: "muted" | "error";
  children: React.ReactNode;
  className?: string;
}) {
  const hintClassName =
    hintTone === "error" ? "text-xs leading-5 text-rose-600" : "text-xs leading-5 text-muted-foreground";

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        {hint ? <p className={hintClassName}>{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  checked,
  onCheckedChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={[
        "flex min-h-[3.75rem] items-center justify-between gap-4 rounded-[1.05rem] border border-border/70 bg-muted/10 px-4 py-3 transition-colors",
        disabled
          ? "cursor-not-allowed opacity-70"
          : "cursor-pointer hover:border-primary/25 hover:bg-muted/20",
      ]
        .join(" ")
        .trim()}
    >
      <span className="pr-2 text-sm font-semibold leading-5 text-foreground">{label}</span>
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
    </label>
  );
}

function CoursePreview({
  blocks,
  paperOptionsById,
}: {
  blocks: EditableCourseBlock[];
  paperOptionsById: Map<string, WorkspaceCoursePaperOption>;
}) {
  if (blocks.length === 0) {
    return (
      <div className="rounded-[1.1rem] border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
        Add blocks to preview the course flow.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <Card key={block.id} className="app-course-block-card">
          <CardHeader className="app-section-header">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{getBlockTypeLabel(block)}</Badge>
                  <span className="text-sm text-muted-foreground">Block {index + 1}</span>
                </div>
                <CardTitle className="text-base">
                  {block.type === "module"
                    ? block.title || "Chapter"
                    : block.type === "lesson"
                      ? block.title || "Lesson"
                      : block.type === "announcement"
                        ? block.title || "Announcement"
                        : block.type === "assessment"
                          ? block.titleOverride ||
                            paperOptionsById.get(block.questionPaperId)?.title ||
                            "Assessment"
                          : "Content"}
                </CardTitle>
              </div>
              {block.type === "lesson" && block.estimatedMinutes.trim() ? (
                <Badge variant="outline">~{block.estimatedMinutes} min</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="app-section-body space-y-3">
            {block.type === "module" ? (
              <p className="text-sm text-muted-foreground">
                {block.summary || "Chapter summary goes here."}
              </p>
            ) : null}

            {block.type === "lesson" ? (
              <div className="space-y-4">
                {block.summary ? (
                  <p className="text-sm text-muted-foreground">{block.summary}</p>
                ) : null}
                {block.items.map((item) => (
                  <div key={item.id} className="space-y-3">
                    {item.type === "text" ? (
                      <ContentRenderer htmlContent={item.contentHtml} enableImageZoom />
                    ) : null}
                    {item.type === "image" ? (
                      <div className="space-y-2">
                        <div className={getCourseImageDisplayClasses(item).wrapperClassName}>
                          <div className={getCourseImageDisplayClasses(item).frameClassName}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.imageUrl}
                              alt={item.altText || "Lesson image"}
                              className={getCourseImageDisplayClasses(item).imageClassName}
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                        </div>
                        {item.caption ? (
                          <p className="text-sm text-muted-foreground">{item.caption}</p>
                        ) : null}
                      </div>
                    ) : null}
                    {item.type === "youtube" ? (
                      <div className="app-course-media-frame">
                        <div className="aspect-video w-full">
                          <iframe
                            title="Lesson video"
                            src={buildYouTubeEmbedUrl(
                              resolveYouTubeVideoId(item.urlInput) || item.videoId,
                            )}
                            className="h-full w-full"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            loading="lazy"
                          />
                        </div>
                      </div>
                    ) : null}
                    {item.type === "resource" ? (
                      <CourseResourcePreview
                        title={item.title}
                        fileUrl={item.fileUrl}
                        fileName={item.fileName}
                        caption={item.caption}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {block.type === "announcement" ? (
              <ContentRenderer htmlContent={block.contentHtml} />
            ) : null}

            {block.type === "assessment" ? (
              <div className="app-course-panel">
                <p className="text-sm font-semibold text-foreground">
                  {paperOptionsById.get(block.questionPaperId)?.title || "Linked assessment"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {paperOptionsById.get(block.questionPaperId)?.duration || 0} min •{" "}
                  {paperOptionsById.get(block.questionPaperId)?.totalMarks || 0} marks
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function CourseEditorClient({
  mode,
  courseId,
  returnToPath,
  classes,
  sections,
  subjects,
  papers,
  initialCourse = null,
  creationContext = {
    mode: "standard",
    startAsTemplate: false,
  },
}: CourseEditorClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { navigateBack } = useBackNavigation(returnToPath);
  const { toast } = useToast();

  const isTemplateVersionCreate =
    mode === "create" && creationContext.mode === "template-version";
  const isTemplateCreate =
    mode === "create" && creationContext.mode === "template";
  const initialMetadata = initialCourse?.metadata;

  const [title, setTitle] = useState(
    mode === "create"
      ? creationContext.mode === "duplicate"
        ? `${initialCourse?.title || "Course"} Copy`
        : initialCourse?.title || ""
      : initialCourse?.title || "",
  );
  const [summary, setSummary] = useState(initialCourse?.summary || "");
  const [coverImageUrl, setCoverImageUrl] = useState(initialMetadata?.coverImageUrl || "");
  const [coverImageAltText, setCoverImageAltText] = useState(
    initialMetadata?.coverImageAltText || "",
  );
  const [startsAt, setStartsAt] = useState(
    formatDateTimeLocalInput(initialMetadata?.startsAt),
  );
  const [dueAt, setDueAt] = useState(formatDateTimeLocalInput(initialMetadata?.dueAt));
  const [completionBadgeLabel, setCompletionBadgeLabel] = useState(
    initialMetadata?.completionBadgeLabel || "",
  );
  const [enforceSequentialProgress, setEnforceSequentialProgress] = useState(
    initialMetadata?.enforceSequentialProgress === true,
  );
  const [allowNotes, setAllowNotes] = useState(initialMetadata?.allowNotes !== false);
  const [allowBookmarks, setAllowBookmarks] = useState(
    initialMetadata?.allowBookmarks !== false,
  );
  const [isTemplate, setIsTemplate] = useState(
    mode === "edit"
      ? initialMetadata?.isTemplate === true
      : isTemplateVersionCreate || creationContext.startAsTemplate === true,
  );
  const [classId, setClassId] = useState(initialCourse?.class?._id || "");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>(
    deriveInitialSubjectIds(initialCourse),
  );
  const [assignedSectionIds, setAssignedSectionIds] = useState<string[]>(
    Array.isArray(initialCourse?.assignedAcademicSections)
      ? initialCourse!.assignedAcademicSections.map((section) => section._id)
      : [],
  );
  const [blocks, setBlocks] = useState<EditableCourseBlock[]>(() => {
    const mappedBlocks = mapInitialBlocks(initialCourse);

    if (
      shouldSeedStarterCourseBlocks({
        mode,
        creationContext,
        initialCourse,
        mappedBlocks,
      })
    ) {
      return buildStarterCourseBlocks();
    }

    return mappedBlocks;
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [savingTarget, setSavingTarget] = useState<"draft" | "published" | null>(null);
  const [uploadingImageTarget, setUploadingImageTarget] = useState<string | null>(null);
  const [uploadingFileBlockId, setUploadingFileBlockId] = useState<string | null>(null);
  const [expandedLessonItems, setExpandedLessonItems] = useState<
    Record<string, string[]>
  >({});
  const [settingsPanelValue, setSettingsPanelValue] = useState<string>("");
  const [previewPanelValue, setPreviewPanelValue] = useState<string>("");
  const [autosaveStatus, setAutosaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [autosaveMessage, setAutosaveMessage] = useState<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const autosaveSignatureRef = useRef<string>("");
  const autosaveInFlightRef = useRef(false);
  const saving = savingTarget !== null;
  const templateToggleLocked =
    isTemplateVersionCreate || (mode === "edit" && initialMetadata?.isTemplate === true);
  const creationModeNotice =
    mode !== "create"
      ? null
      : isTemplateVersionCreate
        ? {
            title: "Creating a new template version",
            message: `This draft stays linked to ${
              creationContext.sourceCourseTitle || "the selected template"
            } and will be saved as the next reusable version.`,
          }
        : isTemplateCreate
          ? {
              title: "Using a template as a course",
              message: `This starts from ${
                creationContext.sourceCourseTitle || "the selected template"
              } and saves as a regular course for student delivery.`,
            }
          : creationContext.startAsTemplate === true
            ? {
                title: "Creating a reusable template",
                message:
                  "This draft will be stored as a reusable template that teachers can use again later.",
              }
            : null;

  const currentEditorPath = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const classOptions = useMemo<SearchableCommandOption[]>(
    () =>
      classes.map((item) => ({
        value: item._id,
        label: item.name,
        description: item.description,
      })),
    [classes],
  );

  const filteredSections = useMemo(
    () =>
      sections.filter((section) => {
        if (!classId) {
          return true;
        }

        const sectionClassId =
          typeof section.class === "string" ? section.class : section.class?._id || "";

        return !sectionClassId || sectionClassId === classId;
      }),
    [classId, sections],
  );

  const sectionOptions = useMemo<SearchableCommandOption[]>(
    () =>
      filteredSections.map((section) => ({
        value: section._id,
        label: section.name,
        description:
          typeof section.class === "object" && section.class?.name
            ? section.class.name
            : undefined,
      })),
    [filteredSections],
  );

  const syncAssessmentBlocksForScope = useCallback(
    (
      nextClassId: string,
      nextAssignedSectionIds: string[],
      nextSubjectIds: string[],
    ) => {
      setBlocks((currentBlocks) =>
        currentBlocks.map((block) => {
          if (block.type !== "assessment" || !block.questionPaperId) {
            return block;
          }

          const linkedPaper = papers.find(
            (paper) => paper._id === block.questionPaperId,
          );
          if (
            linkedPaper &&
            isPaperCompatibleWithCourseScope(
              linkedPaper,
              nextClassId,
              nextAssignedSectionIds,
              nextSubjectIds,
            )
          ) {
            return block;
          }

          return {
            ...block,
            questionPaperId: "",
          };
        }),
      );
    },
    [papers],
  );

  useEffect(() => {
    if (classId || classes.length !== 1) {
      return;
    }

    const nextClassId = classes[0]?._id || "";
    if (!nextClassId) {
      return;
    }

    const nextAssignedSectionIds = assignedSectionIds.filter((sectionId) =>
      sections.some((section) => {
        const sectionClassId =
          typeof section.class === "string" ? section.class : section.class?._id || "";

        return (
          section._id === sectionId &&
          (!nextClassId || !sectionClassId || sectionClassId === nextClassId)
        );
      }),
    );

    setClassId(nextClassId);
    setAssignedSectionIds(nextAssignedSectionIds);
    syncAssessmentBlocksForScope(nextClassId, nextAssignedSectionIds, selectedSubjectIds);
  }, [
    assignedSectionIds,
    classId,
    classes,
    sections,
    selectedSubjectIds,
    syncAssessmentBlocksForScope,
  ]);

  const subjectOptions = useMemo<SearchableCommandOption[]>(
    () =>
      subjects.map((subject) => ({
        value: subject._id,
        label: subject.name,
        description: subject.code || subject.description,
      })),
    [subjects],
  );

  const filteredPapers = useMemo(
    () =>
      papers.filter((paper) =>
        isPaperCompatibleWithCourseScope(
          paper,
          classId,
          assignedSectionIds,
          selectedSubjectIds,
        ),
      ),
    [assignedSectionIds, classId, papers, selectedSubjectIds],
  );

  const paperOptions = useMemo<SearchableCommandOption[]>(
    () =>
      filteredPapers.map((paper) => ({
        value: paper._id,
        label: formatPaperOptionLabel(paper),
        description: `${paper.duration} min • ${paper.totalMarks} marks • ${paper.subjects
          .map((subject) => subject.name)
          .join(", ")}${paper.onlineEnabled ? " • Online" : " • Offline"}`,
        keywords: paper.subjects.map((subject) => subject.name),
      })),
    [filteredPapers],
  );

  const paperOptionsById = useMemo(
    () => new Map(filteredPapers.map((paper) => [paper._id, paper])),
    [filteredPapers],
  );

  const selectedClassName =
    classes.find((item) => item._id === classId)?.name || "No class selected";
  const selectedSubjectNames = selectedSubjectIds
    .map((subjectId) => subjects.find((subject) => subject._id === subjectId)?.name || subjectId)
    .filter(Boolean);
  const selectedSectionNames = assignedSectionIds
    .map((sectionId) => sections.find((section) => section._id === sectionId)?.name || sectionId)
    .filter(Boolean);
  const selectedSectionSummary =
    selectedSectionNames.length > 0
      ? `${selectedSectionNames.slice(0, 3).join(", ")}${
          selectedSectionNames.length > 3
            ? ` +${selectedSectionNames.length - 3} more`
            : ""
        }`
      : "All sections in this class";

  const updateBlock = <T extends EditableCourseBlock>(
    blockId: string,
    updater: (block: T) => T,
  ) => {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block) =>
        block.id === blockId ? updater(block as T) : block,
      ),
    );
  };

  const updateLessonItem = <T extends EditableLessonItem>(
    blockId: string,
    itemId: string,
    updater: (item: T) => T,
  ) => {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block) => {
        if (block.id !== blockId || block.type !== "lesson") {
          return block;
        }

        return {
          ...block,
          items: block.items.map((item) =>
            item.id === itemId ? updater(item as T) : item,
          ),
        };
      }),
    );
  };

  const removeLessonItem = (blockId: string, itemId: string) => {
    setExpandedLessonItems((currentItems) => {
      if (!Object.prototype.hasOwnProperty.call(currentItems, blockId)) {
        return currentItems;
      }

      return {
        ...currentItems,
        [blockId]: currentItems[blockId].filter((value) => value !== itemId),
      };
    });

    setBlocks((currentBlocks) =>
      currentBlocks.map((block) => {
        if (block.id !== blockId || block.type !== "lesson") {
          return block;
        }

        return {
          ...block,
          items: block.items.filter((item) => item.id !== itemId),
        };
      }),
    );
  };

  const addLessonItem = (
    blockId: string,
    type: EditableLessonItem["type"],
    overrides?: Partial<EditableLessonItem>,
  ) => {
    const newItem = createLessonItem(type, overrides);

    setExpandedLessonItems((currentItems) => ({
      ...currentItems,
      [blockId]: Array.from(
        new Set([...(currentItems[blockId] || []), newItem.id]),
      ),
    }));

    setBlocks((currentBlocks) =>
      currentBlocks.map((block) => {
        if (block.id !== blockId || block.type !== "lesson") {
          return block;
        }

        return {
          ...block,
          items: [...block.items, newItem],
        };
      }),
    );
  };

  const moveBlock = (blockId: string, direction: -1 | 1) => {
    setBlocks((currentBlocks) => {
      const currentIndex = currentBlocks.findIndex((block) => block.id === blockId);
      const nextIndex = currentIndex + direction;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentBlocks.length) {
        return currentBlocks;
      }

      if (currentBlocks[currentIndex].type === "module") {
        let currentModuleEnd = currentBlocks.length;
        for (let index = currentIndex + 1; index < currentBlocks.length; index += 1) {
          if (currentBlocks[index].type === "module") {
            currentModuleEnd = index;
            break;
          }
        }

        const currentModuleLength = currentModuleEnd - currentIndex;
        const movingSegment = currentBlocks.slice(currentIndex, currentModuleEnd);

        if (direction < 0) {
          let previousModuleIndex = -1;
          for (let index = currentIndex - 1; index >= 0; index -= 1) {
            if (currentBlocks[index].type === "module") {
              previousModuleIndex = index;
              break;
            }
          }

          if (previousModuleIndex < 0) {
            return currentBlocks;
          }

          const nextBlocks = [...currentBlocks];
          nextBlocks.splice(currentIndex, currentModuleLength);
          nextBlocks.splice(previousModuleIndex, 0, ...movingSegment);
          return nextBlocks;
        }

        let nextModuleIndex = -1;
        for (let index = currentModuleEnd; index < currentBlocks.length; index += 1) {
          if (currentBlocks[index].type === "module") {
            nextModuleIndex = index;
            break;
          }
        }

        if (nextModuleIndex < 0) {
          return currentBlocks;
        }

        let nextModuleEnd = currentBlocks.length;
        for (let index = nextModuleIndex + 1; index < currentBlocks.length; index += 1) {
          if (currentBlocks[index].type === "module") {
            nextModuleEnd = index;
            break;
          }
        }

        const nextBlocks = [...currentBlocks];
        nextBlocks.splice(currentIndex, currentModuleLength);
        nextBlocks.splice(nextModuleEnd - currentModuleLength, 0, ...movingSegment);
        return nextBlocks;
      }

      if (currentBlocks[currentIndex].type === "lesson") {
        let moduleIndex = -1;
        for (let i = currentIndex - 1; i >= 0; i -= 1) {
          if (currentBlocks[i].type === "module") {
            moduleIndex = i;
            break;
          }
        }

        if (moduleIndex === -1) {
          return currentBlocks;
        }

        if (direction < 0 && nextIndex <= moduleIndex) {
          return currentBlocks;
        }

        if (direction > 0) {
          for (let i = currentIndex + 1; i < currentBlocks.length; i += 1) {
            if (currentBlocks[i].type === "module") {
              if (nextIndex >= i) {
                return currentBlocks;
              }
              break;
            }
          }
        }
      }

      const nextBlocks = [...currentBlocks];
      const [selectedBlock] = nextBlocks.splice(currentIndex, 1);
      nextBlocks.splice(nextIndex, 0, selectedBlock);
      return nextBlocks;
    });
  };

  const removeBlock = (blockId: string) => {
    setExpandedLessonItems((currentItems) => {
      if (!Object.prototype.hasOwnProperty.call(currentItems, blockId)) {
        return currentItems;
      }

      const nextItems = { ...currentItems };
      delete nextItems[blockId];
      return nextItems;
    });

    setBlocks((currentBlocks) => currentBlocks.filter((block) => block.id !== blockId));
  };

  const addBlock = (type: EditableCourseBlock["type"]) => {
    setBlocks((currentBlocks) => {
      if (type === "module") {
        const nextModuleNumber =
          currentBlocks.filter((block) => block.type === "module").length + 1;
        return [...currentBlocks, createModuleBlock(`Chapter ${nextModuleNumber}`)];
      }

      return [...currentBlocks, buildEmptyBlock(type)];
    });
  };

  const duplicateLessonBlock = (blockId: string) => {
    let clonedBlockId = "";
    let clonedItemIds: string[] = [];

    setBlocks((currentBlocks) => {
      const index = currentBlocks.findIndex((block) => block.id === blockId);
      if (index < 0) {
        return currentBlocks;
      }

      const block = currentBlocks[index];
      if (block.type !== "lesson") {
        return currentBlocks;
      }

      const clonedBlock: EditableLessonBlock = {
        ...block,
        id: createClientBlockId(),
        title: block.title ? `${block.title} Copy` : "Lesson Copy",
        items: block.items.map((item) => ({
          ...item,
          id: createClientItemId(),
        })),
      };

      clonedBlockId = clonedBlock.id;
      clonedItemIds = clonedBlock.items.slice(0, 1).map((item) => item.id);

      const nextBlocks = [...currentBlocks];
      nextBlocks.splice(index + 1, 0, clonedBlock);
      return nextBlocks;
    });

    if (clonedBlockId) {
      setExpandedLessonItems((currentItems) => ({
        ...currentItems,
        [clonedBlockId]: clonedItemIds,
      }));
    }
  };

  const moveLessonToModule = (blockId: string, direction: "prev" | "next") => {
    setBlocks((currentBlocks) => {
      const sourceIndex = currentBlocks.findIndex((block) => block.id === blockId);
      if (sourceIndex < 0 || currentBlocks[sourceIndex].type !== "lesson") {
        return currentBlocks;
      }

      const findPrevModuleIndex = (fromIndex: number) => {
        for (let i = fromIndex; i >= 0; i -= 1) {
          if (currentBlocks[i].type === "module") {
            return i;
          }
        }
        return -1;
      };

      const findNextModuleIndex = (fromIndex: number) => {
        for (let i = fromIndex; i < currentBlocks.length; i += 1) {
          if (currentBlocks[i].type === "module") {
            return i;
          }
        }
        return -1;
      };

      const currentModuleIndex = findPrevModuleIndex(sourceIndex);
      if (currentModuleIndex < 0) {
        return currentBlocks;
      }

      let targetIndex = -1;
      if (direction === "prev") {
        const prevModuleIndex = findPrevModuleIndex(currentModuleIndex - 1);
        if (prevModuleIndex < 0) {
          return currentBlocks;
        }
        targetIndex = currentModuleIndex;
      } else {
        const nextModuleIndex = findNextModuleIndex(currentModuleIndex + 1);
        if (nextModuleIndex < 0) {
          return currentBlocks;
        }
        targetIndex = nextModuleIndex + 1;
      }

      const nextBlocks = [...currentBlocks];
      const [movingBlock] = nextBlocks.splice(sourceIndex, 1);
      const adjustedTargetIndex =
        sourceIndex < targetIndex ? Math.max(0, targetIndex - 1) : targetIndex;
      nextBlocks.splice(adjustedTargetIndex, 0, movingBlock);
      return nextBlocks;
    });
  };

  const canMoveLessonToPrevModule = (blockIndex: number) => {
    let currentModuleIndex = -1;
    for (let i = blockIndex; i >= 0; i -= 1) {
      if (blocks[i].type === "module") {
        currentModuleIndex = i;
        break;
      }
    }
    if (currentModuleIndex <= 0) {
      return false;
    }
    return blocks.slice(0, currentModuleIndex).some((block) => block.type === "module");
  };

  const canMoveLessonToNextModule = (blockIndex: number) => {
    let currentModuleIndex = -1;
    for (let i = blockIndex; i >= 0; i -= 1) {
      if (blocks[i].type === "module") {
        currentModuleIndex = i;
        break;
      }
    }
    if (currentModuleIndex < 0) {
      return false;
    }
    return blocks.slice(currentModuleIndex + 1).some((block) => block.type === "module");
  };

  const canMoveModuleSectionUp = (moduleIndex: number) =>
    blocks.slice(0, moduleIndex).some((block) => block.type === "module");

  const canMoveModuleSectionDown = (moduleIndex: number) =>
    blocks.slice(moduleIndex + 1).some((block) => block.type === "module");

  useEffect(() => {
    const paperId = searchParams.get("paperId");
    if (!paperId) {
      return;
    }

    const linkAssessmentId = searchParams.get("linkAssessmentId");

    setBlocks((currentBlocks) => {
      let updated = false;
      const nextBlocks = currentBlocks.map((block) => {
        if (block.type !== "assessment") {
          return block;
        }

        if (linkAssessmentId && block.id !== linkAssessmentId) {
          return block;
        }

        if (!linkAssessmentId && block.questionPaperId) {
          return block;
        }

        if (block.questionPaperId === paperId) {
          return block;
        }

        updated = true;
        return {
          ...block,
          questionPaperId: paperId,
        };
      });

      return updated ? nextBlocks : currentBlocks;
    });

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("paperId");
    nextParams.delete("linkAssessmentId");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [pathname, router, searchParams]);

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file, file.name || "course-image");

    const response = await fetch("/api/courses/images", {
      method: "POST",
      credentials: "same-origin",
      body: formData,
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success || !payload?.url) {
      throw new Error(payload?.message || "Failed to upload the image.");
    }

    return String(payload.url);
  };

  const handleCoverImageUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      setUploadingImageTarget("cover");
      const url = await uploadImage(file);
      setCoverImageUrl(url);
      toast({
        title: "Cover image uploaded",
        description: "The course cover is ready.",
      });
    } catch (error) {
      toast({
        title: "Cover image upload failed",
        description:
          error instanceof Error ? error.message : "We couldn't upload that image.",
        variant: "destructive",
      });
    } finally {
      setUploadingImageTarget(null);
    }
  };

  const handleLessonItemImageUpload = async (
    blockId: string,
    itemId: string,
    file: File | null,
  ) => {
    if (!file) {
      return;
    }

    try {
      setUploadingImageTarget(itemId);
      const url = await uploadImage(file);
      updateLessonItem<EditableLessonImageItem>(blockId, itemId, (item) => ({
        ...item,
        imageUrl: url,
      }));
      toast({
        title: "Lesson image uploaded",
        description: "The lesson image is ready.",
      });
    } catch (error) {
      toast({
        title: "Lesson image upload failed",
        description:
          error instanceof Error ? error.message : "We couldn't upload that image.",
        variant: "destructive",
      });
    } finally {
      setUploadingImageTarget(null);
    }
  };

  const handleLessonItemResourceUpload = async (
    blockId: string,
    itemId: string,
    file: File | null,
  ) => {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file, file.name || "lesson-resource");

    try {
      setUploadingFileBlockId(itemId);
      const response = await fetch("/api/courses/files", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success || !payload?.url) {
        throw new Error(payload?.message || "Failed to upload the file.");
      }

      updateLessonItem<EditableLessonResourceItem>(blockId, itemId, (item) => ({
        ...item,
        fileUrl: String(payload.url),
        fileName: String(payload.fileName || file.name || "resource"),
        title: item.title || String(file.name || "Resource"),
      }));
      toast({
        title: "Lesson resource uploaded",
        description: "The file is attached to the lesson.",
      });
    } catch (error) {
      toast({
        title: "Lesson resource upload failed",
        description:
          error instanceof Error ? error.message : "We couldn't upload that file.",
        variant: "destructive",
      });
    } finally {
      setUploadingFileBlockId(null);
    }
  };

  const validateBeforeSave = (targetStatus: "draft" | "published") => {
    if (!title.trim()) {
      return "Add a course title.";
    }

    if (!classId) {
      return "Select the class for this course.";
    }

    if (selectedSubjectIds.length === 0) {
      return "Select at least one subject for this course.";
    }

    if (startsAt && dueAt && new Date(dueAt).getTime() < new Date(startsAt).getTime()) {
      return "The due date must be after the start date.";
    }

    if (targetStatus === "draft") {
      return null;
    }

    if (blocks.length === 0) {
      return "Add at least one block before publishing the course.";
    }

    for (const block of blocks) {
      if (block.type === "module" && !block.title.trim()) {
        return "Every chapter block needs a title.";
      }

      if (block.type === "lesson") {
        if (!block.title.trim()) {
          return "Every lesson needs a title.";
        }

        if (block.estimatedMinutes.trim()) {
          const estimatedMinutes = Number(block.estimatedMinutes);
          if (
            !Number.isFinite(estimatedMinutes) ||
            estimatedMinutes < 0 ||
            estimatedMinutes > 600
          ) {
            return "Lesson time must be a number between 0 and 600 minutes.";
          }
        }

        if (!block.items.length) {
          return "Every lesson needs at least one content item.";
        }

        for (const item of block.items) {
          if (item.type === "text" && !item.contentHtml.trim()) {
            return "Lesson text items need content.";
          }
          if (item.type === "image" && !item.imageUrl.trim()) {
            return "Lesson image items need an uploaded image.";
          }
          if (item.type === "youtube") {
            if (!item.urlInput.trim()) {
              return "Lesson video items need a YouTube link.";
            }
            if (!resolveYouTubeVideoId(item.urlInput)) {
              return "One or more lesson YouTube links are invalid.";
            }
          }
          if (item.type === "resource") {
            if (!item.title.trim()) {
              return "Lesson resources need a title.";
            }
            if (!item.fileUrl.trim() || !item.fileName.trim()) {
              return "Lesson resources need an uploaded file.";
            }
          }
        }
      }

      if (block.type === "announcement") {
        if (!block.title.trim() || !block.contentHtml.trim()) {
          return "Every announcement block needs a title and content.";
        }
      }

      if (block.type === "assessment") {
        if (!block.questionPaperId.trim()) {
          return "Every assessment block needs a linked question paper.";
        }

        if (block.minimumScorePct.trim()) {
          const minimumScorePct = Number(block.minimumScorePct);
          if (
            !Number.isFinite(minimumScorePct) ||
            minimumScorePct < 0 ||
            minimumScorePct > 100
          ) {
            return "Assessment minimum score must be between 0 and 100.";
          }
        }
      }
    }

    return null;
  };

  const serializeBlocksForApi = useCallback(
    () =>
      blocks.map((block) => {
        switch (block.type) {
          case "module":
            return {
              id: block.id,
              type: block.type,
              title: block.title,
              summary: block.summary,
            };
          case "lesson":
            return {
              id: block.id,
              type: block.type,
              title: block.title,
              summary: block.summary,
              estimatedMinutes: block.estimatedMinutes.trim()
                ? Number(block.estimatedMinutes)
                : null,
              items: block.items.map((item) => {
                if (item.type === "text") {
                  return {
                    type: item.type,
                    contentHtml: item.contentHtml,
                  };
                }
                if (item.type === "image") {
                  return {
                    type: item.type,
                    imageUrl: item.imageUrl,
                    altText: item.altText,
                    caption: item.caption,
                    imageFit: item.imageFit,
                    imageWidth: item.imageWidth,
                    imageHeight: item.imageHeight,
                  };
                }
                if (item.type === "youtube") {
                  return {
                    type: item.type,
                    youtubeUrl: item.urlInput,
                    videoId: resolveYouTubeVideoId(item.urlInput) || item.videoId,
                    caption: item.caption,
                  };
                }
                return {
                  type: item.type,
                  title: item.title,
                  fileUrl: item.fileUrl,
                  fileName: item.fileName,
                  caption: item.caption,
                };
              }),
            };
          case "announcement":
            return block;
          case "assessment":
            return {
              id: block.id,
              type: block.type,
              questionPaperId: block.questionPaperId,
              titleOverride: block.titleOverride,
              required: block.required,
              minimumScorePct: block.minimumScorePct.trim()
                ? Number(block.minimumScorePct)
                : null,
            };
        }
      }),
    [blocks],
  );

  const buildCoursePayload = useCallback(
    (targetStatus: "draft" | "published") => ({
      title,
      summary,
      class: classId,
      subjectIds: selectedSubjectIds,
      assignedAcademicSections: assignedSectionIds,
      status: targetStatus,
      coverImageUrl,
      coverImageAltText,
      startsAt: startsAt || null,
      dueAt: dueAt || null,
      completionBadgeLabel,
      enforceSequentialProgress,
      allowNotes,
      allowBookmarks,
      isTemplate: templateToggleLocked ? true : isTemplate,
      templateFromCourseId:
        mode === "create" && creationContext.mode === "template"
          ? creationContext.sourceCourseId || undefined
          : undefined,
      versionFromCourseId:
        mode === "create" && creationContext.mode === "template-version"
          ? creationContext.sourceCourseId || undefined
          : undefined,
      blocks: serializeBlocksForApi(),
    }),
    [
      title,
      summary,
      classId,
      selectedSubjectIds,
      assignedSectionIds,
      coverImageUrl,
      coverImageAltText,
      startsAt,
      dueAt,
      completionBadgeLabel,
      enforceSequentialProgress,
      allowNotes,
      allowBookmarks,
      templateToggleLocked,
      isTemplate,
      mode,
      creationContext,
      serializeBlocksForApi,
    ],
  );

  const canAutosave =
    Boolean(title.trim()) && Boolean(classId) && selectedSubjectIds.length > 0;

  useEffect(() => {
    if (!canAutosave || saving || autosaveInFlightRef.current) {
      return;
    }

    const signature = JSON.stringify(buildCoursePayload("draft"));
    if (signature === autosaveSignatureRef.current) {
      return;
    }

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(async () => {
      autosaveInFlightRef.current = true;
      setAutosaveStatus("saving");
      setAutosaveMessage("Saving draft...");

      try {
        const endpoint =
          mode === "edit" && courseId ? `/api/courses/${courseId}` : "/api/courses";
        const method = mode === "edit" ? "PATCH" : "POST";
        const payload = await fetchApiJson<{
          success: boolean;
          courseId: string;
          message?: string;
        }>(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildCoursePayload("draft")),
          cache: "no-store",
          fallbackMessage: "Failed to autosave draft.",
        });

        autosaveSignatureRef.current = signature;
        setAutosaveStatus("saved");
        setAutosaveMessage("Draft saved just now.");

        if (mode === "create" && payload?.courseId) {
          router.replace(
            buildHrefWithReturnTo(
              `/workspace/courses/edit/${payload.courseId}`,
              returnToPath,
            ),
          );
        }
      } catch (error) {
        setAutosaveStatus("error");
        setAutosaveMessage(
          error instanceof Error ? error.message : "Autosave failed.",
        );
      } finally {
        autosaveInFlightRef.current = false;
      }
    }, 1200);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [
    assignedSectionIds,
    canAutosave,
    classId,
    completionBadgeLabel,
    coverImageAltText,
    coverImageUrl,
    dueAt,
    enforceSequentialProgress,
    isTemplate,
    mode,
    router,
    saving,
    selectedSubjectIds,
    startsAt,
    title,
    summary,
    allowBookmarks,
    allowNotes,
    blocks,
    buildCoursePayload,
    courseId,
    returnToPath,
  ]);

  const handleSubmit = async (targetStatus: "draft" | "published") => {
    const validationMessage = validateBeforeSave(targetStatus);
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setFormError(null);
    setSavingTarget(targetStatus);

    try {
      const endpoint = mode === "edit" && courseId ? `/api/courses/${courseId}` : "/api/courses";
      const method = mode === "edit" ? "PATCH" : "POST";
      const payload = await fetchApiJson<{
        success: boolean;
        courseId: string;
        message?: string;
      }>(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildCoursePayload(targetStatus)),
        cache: "no-store",
        fallbackMessage:
          mode === "edit" ? "Failed to update course." : "Failed to create course.",
      });

      const nextCourseId = String(payload?.courseId || courseId || "").trim();
      toast({
        title:
          targetStatus === "draft"
            ? "Draft saved"
            : mode === "edit"
              ? "Course published"
              : "Course created",
        description:
          targetStatus === "draft"
            ? "The course is saved as a draft and remains hidden from students."
            : "The course is now visible to the assigned learners.",
      });
      autosaveSignatureRef.current = JSON.stringify(buildCoursePayload("draft"));
      setAutosaveStatus("saved");
      setAutosaveMessage("Draft saved just now.");

      if (nextCourseId) {
        router.push(
          buildHrefWithReturnTo(`/workspace/courses/${nextCourseId}`, returnToPath),
        );
        return;
      }

      navigateBack();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "We couldn't save the course.",
      );
    } finally {
      setSavingTarget(null);
    }
  };

  const blockCounts = blocks.reduce<Record<string, number>>((counts, block) => {
    counts[block.type] = (counts[block.type] || 0) + 1;
    return counts;
  }, {});

  const requiredAssessmentCount = blocks.filter(
    (block) => block.type === "assessment" && block.required !== false,
  ).length;

  const inlineErrors = useMemo(() => {
    const blockErrors: Record<
      string,
      {
        title?: string;
        summary?: string;
        items?: string;
        assessment?: string;
        minimumScore?: string;
        itemErrors?: Record<string, string>;
      }
    > = {};

    blocks.forEach((block) => {
      if (block.type === "module") {
        const moduleIndex = blocks.findIndex((item) => item.id === block.id);
        let hasLesson = false;
        for (let index = moduleIndex + 1; index < blocks.length; index += 1) {
          const nextBlock = blocks[index];
          if (nextBlock.type === "module") break;
          if (nextBlock.type === "lesson") {
            hasLesson = true;
            break;
          }
        }
        if (!block.title.trim()) {
          blockErrors[block.id] = { title: "Chapter title is required." };
        }
        if (!hasLesson) {
          blockErrors[block.id] = {
            ...(blockErrors[block.id] || {}),
            summary: "Add at least one lesson to this chapter.",
          };
        }
      }

      if (block.type === "lesson") {
        const itemErrors: Record<string, string> = {};
        if (!block.title.trim()) {
          blockErrors[block.id] = {
            ...(blockErrors[block.id] || {}),
            title: "Lesson title is required.",
          };
        }
        if (!block.items.length) {
          blockErrors[block.id] = {
            ...(blockErrors[block.id] || {}),
            items: "Add at least one lesson item.",
          };
        }
        block.items.forEach((item) => {
          if (item.type === "text" && !item.contentHtml.trim()) {
            itemErrors[item.id] = "Text content is required.";
          }
          if (item.type === "image" && !item.imageUrl.trim()) {
            itemErrors[item.id] = "Image upload or URL is required.";
          }
          if (item.type === "youtube") {
            if (!item.urlInput.trim()) {
              itemErrors[item.id] = "YouTube link is required.";
            } else if (!resolveYouTubeVideoId(item.urlInput)) {
              itemErrors[item.id] = "Enter a valid YouTube link.";
            }
          }
          if (item.type === "resource") {
            if (!item.title.trim()) {
              itemErrors[item.id] = "Resource title is required.";
            } else if (!item.fileUrl.trim() || !item.fileName.trim()) {
              itemErrors[item.id] = "Upload a resource file.";
            }
          }
        });
        if (Object.keys(itemErrors).length > 0) {
          blockErrors[block.id] = {
            ...(blockErrors[block.id] || {}),
            itemErrors,
          };
        }
      }

      if (block.type === "announcement") {
        if (!block.title.trim() || !block.contentHtml.trim()) {
          blockErrors[block.id] = {
            ...(blockErrors[block.id] || {}),
            title: "Announcement title and content are required.",
          };
        }
      }

      if (block.type === "assessment") {
        if (!block.questionPaperId.trim()) {
          blockErrors[block.id] = {
            ...(blockErrors[block.id] || {}),
            assessment: "Select a linked question paper.",
          };
        }
        if (block.minimumScorePct.trim()) {
          const minimumScorePct = Number(block.minimumScorePct);
          if (
            !Number.isFinite(minimumScorePct) ||
            minimumScorePct < 0 ||
            minimumScorePct > 100
          ) {
            blockErrors[block.id] = {
              ...(blockErrors[block.id] || {}),
              minimumScore: "Minimum score must be 0 to 100.",
            };
          }
        }
      }
    });

    return {
      title: !title.trim() ? "Course title is required." : "",
      classId: !classId ? "Select a class for this course." : "",
      subjects:
        selectedSubjectIds.length === 0
          ? "Select at least one subject."
          : "",
      blocks: blockErrors,
    };
  }, [blocks, classId, selectedSubjectIds, title]);

  const firstAssessmentIndex = useMemo(
    () => blocks.findIndex((block) => block.type === "assessment"),
    [blocks],
  );

  const curriculumEntries = useMemo(
    () => buildCurriculumEntries(blocks),
    [blocks],
  );
  const moduleCount = blockCounts.module || 0;
  const lessonCount = blockCounts.lesson || 0;
  const setupComplete = Boolean(title.trim() && classId && selectedSubjectIds.length > 0);
  const buildComplete = lessonCount > 0;
  const publishReady = setupComplete && buildComplete;
  const configuredCourseSettingsCount = [
    Boolean(coverImageUrl),
    Boolean(startsAt),
    Boolean(dueAt),
    Boolean(completionBadgeLabel),
    enforceSequentialProgress,
    !allowNotes,
    !allowBookmarks,
    isTemplate,
  ].filter(Boolean).length;
  const settingsSummary =
    configuredCourseSettingsCount > 0
      ? `${configuredCourseSettingsCount} setting${
          configuredCourseSettingsCount === 1 ? "" : "s"
        } configured`
      : "Cover, schedule, student tools, and template options";
  const previewSummary =
    blocks.length > 0
      ? `${blocks.length} block${blocks.length === 1 ? "" : "s"} ready to preview`
      : "Preview becomes available once you add content.";

  const getExpandedLessonItemValues = (lesson: EditableLessonBlock) =>
    Object.prototype.hasOwnProperty.call(expandedLessonItems, lesson.id)
      ? expandedLessonItems[lesson.id]
      : lesson.items.slice(0, 1).map((item) => item.id);

  const addQuickLessonBlock = (type: EditableLessonItem["type"]) => {
    const nextLessonNumber = lessonCount + 1;
    const nextLessonBlock = createLessonBlock({
      title: `Lesson ${nextLessonNumber}`,
      itemType: type,
    });

    setExpandedLessonItems((currentItems) => ({
      ...currentItems,
      [nextLessonBlock.id]: nextLessonBlock.items.map((item) => item.id),
    }));

    setBlocks((currentBlocks) => {
      const lastModuleIndex = [...currentBlocks]
        .map((block, index) => (block.type === "module" ? index : -1))
        .filter((index) => index >= 0)
        .pop();

      if (typeof lastModuleIndex !== "number") {
        return [...currentBlocks, nextLessonBlock];
      }

      let insertIndex = lastModuleIndex + 1;
      while (
        insertIndex < currentBlocks.length &&
        currentBlocks[insertIndex].type !== "module"
      ) {
        insertIndex += 1;
      }

      const nextBlocks = [...currentBlocks];
      nextBlocks.splice(insertIndex, 0, nextLessonBlock);

      return nextBlocks;
    });
  };

  const addLessonToModule = (
    moduleIndex: number,
    type: EditableLessonItem["type"] = "text",
  ) => {
    const nextLessonNumber = lessonCount + 1;
    const nextLessonBlock = createLessonBlock({
      title: `Lesson ${nextLessonNumber}`,
      itemType: type,
    });

    setExpandedLessonItems((currentItems) => ({
      ...currentItems,
      [nextLessonBlock.id]: nextLessonBlock.items.map((item) => item.id),
    }));

    setBlocks((currentBlocks) => {
      if (!currentBlocks[moduleIndex] || currentBlocks[moduleIndex].type !== "module") {
        return currentBlocks;
      }

      let insertIndex = moduleIndex + 1;
      while (
        insertIndex < currentBlocks.length &&
        currentBlocks[insertIndex].type !== "module"
      ) {
        insertIndex += 1;
      }

      const nextBlocks = [...currentBlocks];
      nextBlocks.splice(insertIndex, 0, nextLessonBlock);

      return nextBlocks;
    });
  };

  const renderLessonItemEditor = (
    lessonBlock: EditableLessonBlock,
    item: EditableLessonItem,
  ) => {
    const itemError = inlineErrors.blocks[lessonBlock.id]?.itemErrors?.[item.id];

    if (item.type === "text") {
      return (
        <FormField
          label="Text content"
          hint={itemError || undefined}
          hintTone={itemError ? "error" : "muted"}
        >
          <RichTextEditor
            initialContent={item.contentHtml}
            onChange={(html) =>
              updateLessonItem<EditableLessonTextItem>(
                lessonBlock.id,
                item.id,
                (currentItem) => ({
                  ...currentItem,
                  contentHtml: html,
                }),
              )
            }
            editorKey={`${lessonBlock.id}-${item.id}`}
            imageUploadEndpoint="/api/courses/images"
            compact
          />
        </FormField>
      );
    }

    if (item.type === "image") {
      return (
        <div className="space-y-4">
          <FormField
            label="Image source"
            hint={itemError || undefined}
            hintTone={itemError ? "error" : "muted"}
          >
            <div className="space-y-3">
              <Input
                value={item.imageUrl}
                onChange={(event) =>
                  updateLessonItem<EditableLessonImageItem>(
                    lessonBlock.id,
                    item.id,
                    (currentItem) => ({
                      ...currentItem,
                      imageUrl: event.target.value,
                    }),
                  )
                }
                placeholder="https://example.com/lesson-image.webp"
              />
              <FilePickerField
                id={`lesson-image-${item.id}`}
                label="Image upload"
                hideLabel
                buttonLabel="Upload image"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
                placeholder="No image selected"
                selectedFileName={
                  uploadingImageTarget === item.id ? "Uploading..." : null
                }
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  event.target.value = "";
                  void handleLessonItemImageUpload(lessonBlock.id, item.id, file);
                }}
              />
              {uploadingImageTarget === item.id ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner />
                  Uploading image...
                </div>
              ) : null}
            </div>
          </FormField>

          <Accordion type="single" collapsible className="pt-1">
            <AccordionItem value={`image-settings-${item.id}`} className="border-none">
              <AccordionTrigger className="app-course-inline-accordion-trigger">
                Item settings
              </AccordionTrigger>
              <AccordionContent className="app-course-inline-accordion-content space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField label="Alt text">
                    <Input
                      value={item.altText}
                      onChange={(event) =>
                        updateLessonItem<EditableLessonImageItem>(
                          lessonBlock.id,
                          item.id,
                          (currentItem) => ({
                            ...currentItem,
                            altText: event.target.value,
                          }),
                        )
                      }
                      placeholder="Describe the image for accessibility"
                    />
                  </FormField>
                  <FormField label="Caption">
                    <Input
                      value={item.caption}
                      onChange={(event) =>
                        updateLessonItem<EditableLessonImageItem>(
                          lessonBlock.id,
                          item.id,
                          (currentItem) => ({
                            ...currentItem,
                            caption: event.target.value,
                          }),
                        )
                      }
                      placeholder="Optional caption"
                    />
                  </FormField>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <FormField label="Image fit">
                    <Select
                      value={item.imageFit}
                      onValueChange={(value) =>
                        updateLessonItem<EditableLessonImageItem>(
                          lessonBlock.id,
                          item.id,
                          (currentItem) => ({
                            ...currentItem,
                            imageFit: value as EditableLessonImageItem["imageFit"],
                          }),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select fit" />
                      </SelectTrigger>
                      <SelectContent>
                        {COURSE_IMAGE_FIT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Image width">
                    <Select
                      value={item.imageWidth}
                      onValueChange={(value) =>
                        updateLessonItem<EditableLessonImageItem>(
                          lessonBlock.id,
                          item.id,
                          (currentItem) => ({
                            ...currentItem,
                            imageWidth: value as EditableLessonImageItem["imageWidth"],
                          }),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select width" />
                      </SelectTrigger>
                      <SelectContent>
                        {COURSE_IMAGE_WIDTH_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Frame height">
                    <Select
                      value={item.imageHeight}
                      onValueChange={(value) =>
                        updateLessonItem<EditableLessonImageItem>(
                          lessonBlock.id,
                          item.id,
                          (currentItem) => ({
                            ...currentItem,
                            imageHeight: value as EditableLessonImageItem["imageHeight"],
                          }),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select height" />
                      </SelectTrigger>
                      <SelectContent>
                        {COURSE_IMAGE_HEIGHT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {item.imageUrl ? (
            <div className={getCourseImageDisplayClasses(item).wrapperClassName}>
              <div className={getCourseImageDisplayClasses(item).frameClassName}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.altText || "Lesson image preview"}
                  className={getCourseImageDisplayClasses(item).imageClassName}
                />
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    if (item.type === "youtube") {
      return (
        <div className="space-y-4">
          <FormField
            label="YouTube link"
            hint={itemError || undefined}
            hintTone={itemError ? "error" : "muted"}
          >
            <Input
              value={item.urlInput}
              onChange={(event) =>
                updateLessonItem<EditableLessonYoutubeItem>(
                  lessonBlock.id,
                  item.id,
                  (currentItem) => ({
                    ...currentItem,
                    urlInput: event.target.value,
                    videoId:
                      resolveYouTubeVideoId(event.target.value) || currentItem.videoId,
                  }),
                )
              }
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </FormField>

          <FormField label="Caption">
            <Textarea
              value={item.caption}
              onChange={(event) =>
                updateLessonItem<EditableLessonYoutubeItem>(
                  lessonBlock.id,
                  item.id,
                  (currentItem) => ({
                    ...currentItem,
                    caption: event.target.value,
                  }),
                )
              }
              className="min-h-[96px]"
              placeholder="Optional context or instructions for the video."
            />
          </FormField>

          {resolveYouTubeVideoId(item.urlInput) ? (
            <div className="app-course-media-frame">
              <div className="aspect-video w-full">
                <iframe
                  title="YouTube preview"
                  src={buildYouTubeEmbedUrl(
                    resolveYouTubeVideoId(item.urlInput) || "",
                  )}
                  className="h-full w-full"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    const resourceTitleError =
      itemError && itemError.includes("title") ? itemError : undefined;
    const resourceUploadError =
      itemError && itemError.includes("Upload") ? itemError : undefined;

    return (
      <div className="space-y-4">
        <FormField
          label="Resource title"
          hint={resourceTitleError}
          hintTone={resourceTitleError ? "error" : "muted"}
        >
          <Input
            value={item.title}
            onChange={(event) =>
              updateLessonItem<EditableLessonResourceItem>(
                lessonBlock.id,
                item.id,
                (currentItem) => ({
                  ...currentItem,
                  title: event.target.value,
                }),
              )
            }
            placeholder="Formula sheet"
          />
        </FormField>

        <FormField
          label="Resource or video file"
          hint={resourceUploadError || "PDF, DOCX, or video files are supported."}
          hintTone={resourceUploadError ? "error" : "muted"}
        >
          <FilePickerField
            id={`lesson-resource-${item.id}`}
            label="Upload resource file"
            hideLabel
            buttonLabel="Upload file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.mp4,.mov,.webm,.m4v,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/zip,video/mp4,video/webm,video/quicktime,video/x-m4v"
            placeholder="No file selected"
            selectedFileName={
              uploadingFileBlockId === item.id ? "Uploading..." : item.fileName || null
            }
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              event.target.value = "";
              void handleLessonItemResourceUpload(lessonBlock.id, item.id, file);
            }}
          />
        </FormField>

        {uploadingFileBlockId === item.id ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Uploading resource...
          </div>
        ) : null}

        <Accordion type="single" collapsible className="pt-1">
          <AccordionItem value={`resource-settings-${item.id}`} className="border-none">
            <AccordionTrigger className="app-course-inline-accordion-trigger">
              Item settings
            </AccordionTrigger>
            <AccordionContent className="app-course-inline-accordion-content">
              <FormField label="Caption">
                <Input
                  value={item.caption}
                  onChange={(event) =>
                    updateLessonItem<EditableLessonResourceItem>(
                      lessonBlock.id,
                      item.id,
                      (currentItem) => ({
                        ...currentItem,
                        caption: event.target.value,
                      }),
                    )
                  }
                  placeholder="Optional context for the download"
                />
              </FormField>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {item.fileUrl ? (
          <CourseResourcePreview
            title={item.title}
            fileUrl={item.fileUrl}
            fileName={item.fileName}
            caption={item.caption}
            showPreviewButton
          />
        ) : null}
      </div>
    );
  };

  const renderSpecialBlockPanel = (
    block: EditableSpecialBlock,
    blockIndex: number,
    moduleTitle?: string,
  ) => {
    const blockTitle = getSpecialBlockTitle(block, paperOptionsById);
    const blockSummary =
      block.type === "announcement"
        ? summarizeText(block.contentHtml) || "Add the announcement message."
        : block.questionPaperId
          ? paperOptionsById.get(block.questionPaperId)?.title || "Linked assessment"
          : "Link a question paper.";

    return (
      <Accordion
        key={block.id}
        type="single"
        collapsible
        className="app-course-special-block"
        data-course-special-type={block.type}
      >
        <AccordionItem value={block.id} className="border-none">
          <AccordionTrigger className="app-course-special-trigger">
            <div className="space-y-2 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={block.type === "announcement" ? "info" : "warning"}>
                  {getBlockTypeLabel(block)}
                </Badge>
                {moduleTitle ? <Badge variant="outline">{moduleTitle}</Badge> : null}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{blockTitle}</p>
                <p className="text-xs leading-5 text-muted-foreground">{blockSummary}</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="app-course-special-content space-y-4">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => moveBlock(block.id, -1)}
                disabled={blockIndex === 0}
                aria-label="Move block up"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => moveBlock(block.id, 1)}
                disabled={blockIndex === blocks.length - 1}
                aria-label="Move block down"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => removeBlock(block.id)}
                aria-label="Remove block"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {block.type === "announcement" ? (
              <>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <FormField
                    label="Announcement title"
                    hint={inlineErrors.blocks[block.id]?.title}
                    hintTone={inlineErrors.blocks[block.id]?.title ? "error" : "muted"}
                  >
                    <Input
                      value={block.title}
                      onChange={(event) =>
                        updateBlock<EditableAnnouncementBlock>(
                          block.id,
                          (currentBlock) => ({
                            ...currentBlock,
                            title: event.target.value,
                          }),
                        )
                      }
                      placeholder="Before you start the baseline test"
                    />
                  </FormField>
                  <FormField label="Tone">
                    <Select
                      value={block.tone}
                      onValueChange={(value) =>
                        updateBlock<EditableAnnouncementBlock>(
                          block.id,
                          (currentBlock) => ({
                            ...currentBlock,
                            tone: value as CourseAnnouncementTone,
                          }),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>

                <FormField
                  label="Announcement content"
                  hint={inlineErrors.blocks[block.id]?.title}
                  hintTone={inlineErrors.blocks[block.id]?.title ? "error" : "muted"}
                >
                  <RichTextEditor
                    initialContent={block.contentHtml}
                    onChange={(html) =>
                      updateBlock<EditableAnnouncementBlock>(
                        block.id,
                        (currentBlock) => ({
                          ...currentBlock,
                          contentHtml: html,
                        }),
                      )
                    }
                    editorKey={`${block.id}-announcement`}
                    imageUploadEndpoint="/api/courses/images"
                    compact
                  />
                </FormField>
              </>
            ) : (
              <>
                <FormField
                  label="Linked question paper"
                  hint={inlineErrors.blocks[block.id]?.assessment}
                  hintTone={inlineErrors.blocks[block.id]?.assessment ? "error" : "muted"}
                >
                  <SearchableCommandSelect
                    value={block.questionPaperId}
                    options={paperOptions}
                    onValueChange={(value) =>
                      updateBlock<EditableAssessmentBlock>(
                        block.id,
                        (currentBlock) => ({
                          ...currentBlock,
                          questionPaperId: value,
                        }),
                      )
                    }
                    placeholder="Select question paper"
                    searchPlaceholder="Search papers..."
                    emptyText="No matching papers found."
                    clearLabel="Clear"
                    onClear={() =>
                      updateBlock<EditableAssessmentBlock>(
                        block.id,
                        (currentBlock) => ({
                          ...currentBlock,
                          questionPaperId: "",
                        }),
                      )
                    }
                    showCloseAction
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <AppPrefetchLink
                        href={buildHrefWithReturnTo(
                          "/workspace/question-papers/create",
                          `${currentEditorPath}${
                            currentEditorPath.includes("?") ? "&" : "?"
                          }linkAssessmentId=${encodeURIComponent(block.id)}`,
                        )}
                      >
                        Create question paper
                      </AppPrefetchLink>
                    </Button>
                    {block.questionPaperId ? (
                      <Button asChild variant="outline" size="sm">
                        <AppPrefetchLink
                          href={buildHrefWithReturnTo(
                            `/workspace/question-papers/edit/${block.questionPaperId}`,
                            currentEditorPath,
                          )}
                        >
                          Edit selected paper
                        </AppPrefetchLink>
                      </Button>
                    ) : null}
                  </div>
                </FormField>

                {firstAssessmentIndex === blockIndex ? (
                  <p className="text-xs text-muted-foreground">
                    This assessment will also appear in the student tests list.
                  </p>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-3">
                  <FormField label="Title override">
                    <Input
                      value={block.titleOverride}
                      onChange={(event) =>
                        updateBlock<EditableAssessmentBlock>(
                          block.id,
                          (currentBlock) => ({
                            ...currentBlock,
                            titleOverride: event.target.value,
                          }),
                        )
                      }
                      placeholder="Baseline Test"
                    />
                  </FormField>
                  <FormField
                    label="Minimum score %"
                    hint={inlineErrors.blocks[block.id]?.minimumScore}
                    hintTone={inlineErrors.blocks[block.id]?.minimumScore ? "error" : "muted"}
                  >
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={block.minimumScorePct}
                      onChange={(event) =>
                        updateBlock<EditableAssessmentBlock>(
                          block.id,
                          (currentBlock) => ({
                            ...currentBlock,
                            minimumScorePct: event.target.value,
                          }),
                        )
                      }
                      placeholder="70"
                    />
                  </FormField>
                  <FormField label="Requirement">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={block.required ? "primary" : "outline"}
                        onClick={() =>
                          updateBlock<EditableAssessmentBlock>(
                            block.id,
                            (currentBlock) => ({
                              ...currentBlock,
                              required: true,
                            }),
                          )
                        }
                        className="flex-1"
                      >
                        Required
                      </Button>
                      <Button
                        variant={!block.required ? "primary" : "outline"}
                        onClick={() =>
                          updateBlock<EditableAssessmentBlock>(
                            block.id,
                            (currentBlock) => ({
                              ...currentBlock,
                              required: false,
                            }),
                          )
                        }
                        className="flex-1"
                      >
                        Optional
                      </Button>
                    </div>
                  </FormField>
                </div>

                {block.questionPaperId ? (
                  <div className="app-course-panel">
                    {paperOptionsById.get(block.questionPaperId) ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">
                            {paperOptionsById.get(block.questionPaperId)?.onlineEnabled
                              ? "Online ready"
                              : "Unavailable"}
                          </Badge>
                          {paperOptionsById
                            .get(block.questionPaperId)
                            ?.subjects.map((subject) => (
                              <Badge key={subject._id} variant="outline">
                                {subject.name}
                              </Badge>
                            ))}
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {paperOptionsById.get(block.questionPaperId)?.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {paperOptionsById.get(block.questionPaperId)?.duration} min •{" "}
                          {paperOptionsById.get(block.questionPaperId)?.totalMarks} marks
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        This linked paper is not compatible with the current class, subject, or
                        section scope. Choose another assessment before saving.
                      </p>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  const renderLessonPanel = (
    lessonBlock: EditableLessonBlock,
    blockIndex: number,
    moduleTitle?: string,
  ) => (
    <div key={lessonBlock.id} className="app-course-lesson-panel">
      <div className="app-course-lesson-toolbar">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Lesson</Badge>
            {moduleTitle ? <Badge variant="outline">{moduleTitle}</Badge> : null}
            <Badge variant="outline">
              {lessonBlock.items.length} item{lessonBlock.items.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {lessonBlock.title || "Untitled lesson"}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              {lessonBlock.summary || "Keep the lesson summary short so teachers can scan it quickly."}
            </p>
          </div>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Actions
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60 p-2">
            <div className="grid gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => duplicateLessonBlock(lessonBlock.id)}
              >
                Duplicate lesson
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => moveLessonToModule(lessonBlock.id, "prev")}
                disabled={!canMoveLessonToPrevModule(blockIndex)}
              >
                Move to previous chapter
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => moveLessonToModule(lessonBlock.id, "next")}
                disabled={!canMoveLessonToNextModule(blockIndex)}
              >
                Move to next chapter
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => moveBlock(lessonBlock.id, -1)}
                disabled={blockIndex === 0}
              >
                Move up
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => moveBlock(lessonBlock.id, 1)}
                disabled={blockIndex === blocks.length - 1}
              >
                Move down
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-rose-600 hover:text-rose-700"
                onClick={() => removeBlock(lessonBlock.id)}
              >
                Remove lesson
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.55fr)]">
        <FormField
          label="Lesson title"
          hint={inlineErrors.blocks[lessonBlock.id]?.title}
          hintTone={inlineErrors.blocks[lessonBlock.id]?.title ? "error" : "muted"}
        >
          <Input
            value={lessonBlock.title}
            onChange={(event) =>
              updateBlock<EditableLessonBlock>(lessonBlock.id, (currentBlock) => ({
                ...currentBlock,
                title: event.target.value,
              }))
            }
            placeholder="Lesson 1: Diagnostic mindset"
          />
        </FormField>

        <FormField label="Estimated minutes">
          <Input
            type="number"
            min="0"
            max="600"
            step="1"
            value={lessonBlock.estimatedMinutes}
            onChange={(event) =>
              updateBlock<EditableLessonBlock>(lessonBlock.id, (currentBlock) => ({
                ...currentBlock,
                estimatedMinutes: event.target.value,
              }))
            }
            placeholder="15"
          />
        </FormField>
      </div>

      <FormField label="Lesson summary">
        <Textarea
          value={lessonBlock.summary}
          onChange={(event) =>
            updateBlock<EditableLessonBlock>(lessonBlock.id, (currentBlock) => ({
              ...currentBlock,
              summary: event.target.value,
            }))
          }
          placeholder="Optional context for this lesson."
          className="min-h-[92px]"
        />
      </FormField>

      {inlineErrors.blocks[lessonBlock.id]?.summary ? (
        <div className="app-course-editor-inline-error">
          {inlineErrors.blocks[lessonBlock.id]?.summary}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Lesson content</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Add notes, media, or downloads without opening separate nested cards.
            </p>
          </div>
          <div className="app-course-chip-cloud">
            <Button
              variant="outline"
              size="sm"
              onClick={() => addLessonItem(lessonBlock.id, "text")}
            >
              <Plus className="h-4 w-4" />
              Text
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addLessonItem(lessonBlock.id, "image")}
            >
              <Plus className="h-4 w-4" />
              Image
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addLessonItem(lessonBlock.id, "youtube")}
            >
              <Plus className="h-4 w-4" />
              YouTube
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                addLessonItem(lessonBlock.id, "resource", {
                  title: "Video",
                })
              }
            >
              <Plus className="h-4 w-4" />
              Video file
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addLessonItem(lessonBlock.id, "resource")}
            >
              <Plus className="h-4 w-4" />
              Resource
            </Button>
          </div>
        </div>

        {lessonBlock.items.length === 0 ? (
          <div className="app-course-editor-empty-state">
            Add the first lesson item to start building this lesson.
          </div>
        ) : null}

        {inlineErrors.blocks[lessonBlock.id]?.items ? (
          <p className="text-xs text-rose-600">
            {inlineErrors.blocks[lessonBlock.id]?.items}
          </p>
        ) : null}

        <Accordion
          type="multiple"
          value={getExpandedLessonItemValues(lessonBlock)}
          onValueChange={(nextValues) =>
            setExpandedLessonItems((currentItems) => ({
              ...currentItems,
              [lessonBlock.id]: nextValues,
            }))
          }
          className="space-y-3"
        >
          {lessonBlock.items.map((item, itemIndex) => {
            const ItemIcon = getLessonItemIcon(item);

            return (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="app-course-lesson-item-shell"
              >
                <div className="app-course-lesson-item-header">
                  <AccordionTrigger className="app-course-lesson-item-trigger">
                    <div className="flex min-w-0 items-start gap-3 text-left">
                      <div className="app-course-lesson-item-icon">
                        <ItemIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{getLessonItemTypeLabel(item)}</Badge>
                          <span className="text-xs text-muted-foreground">
                            Item {itemIndex + 1}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {getLessonItemSummary(item)}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => removeLessonItem(lessonBlock.id, item.id)}
                    aria-label="Remove lesson item"
                    className="app-course-lesson-item-remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <AccordionContent className="app-course-lesson-item-content">
                  {renderLessonItemEditor(lessonBlock, item)}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );

  const scrollToSection = (targetId: string) => {
    if (typeof document === "undefined") return;
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="app-course-editor-grid">
      <div className="app-course-editor-main">
        {formError ? <FeedbackNotice variant="error">{formError}</FeedbackNotice> : null}
        {creationModeNotice ? (
          <FeedbackNotice variant="info">
            <span className="font-semibold">{creationModeNotice.title}.</span>{" "}
            {creationModeNotice.message}
          </FeedbackNotice>
        ) : null}

        <Card className="app-course-editor-card app-course-editor-section-card" id="course-setup">
          <CardHeader
            className="app-section-header app-course-editor-section-header"
            data-course-section="setup"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={setupComplete ? "success" : "warning"}>
                  {setupComplete ? "Scope ready" : "Finish scope"}
                </Badge>
                <Badge variant="outline">
                  {selectedSubjectIds.length} subject{selectedSubjectIds.length === 1 ? "" : "s"}
                </Badge>
                <Badge variant="outline">
                  {assignedSectionIds.length > 0
                    ? `${assignedSectionIds.length} section${
                        assignedSectionIds.length === 1 ? "" : "s"
                      }`
                    : "All sections"}
                </Badge>
              </div>
              <div className="space-y-1">
                <CardTitle>Course Setup</CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">
                  Start with the teaching scope. Course settings stay tucked away until you
                  need them.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="app-section-body space-y-5">
            <FormField
              label="Course title"
              hint={inlineErrors.title || undefined}
              hintTone={inlineErrors.title ? "error" : "muted"}
            >
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Diagnostic Foundations"
              />
            </FormField>

            <FormField label="Course summary">
              <Textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="What students will learn in this course."
                className="min-h-[120px]"
              />
            </FormField>

            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <FormField
                label="Class"
                hint={inlineErrors.classId || undefined}
                hintTone={inlineErrors.classId ? "error" : "muted"}
              >
                <SearchableCommandSelect
                  value={classId}
                  options={classOptions}
                  onValueChange={(value) => {
                    const nextAssignedSectionIds = assignedSectionIds.filter((sectionId) =>
                      sections.some((section) => {
                        const sectionClassId =
                          typeof section.class === "string"
                            ? section.class
                            : section.class?._id || "";

                        return (
                          section._id === sectionId &&
                          (!value || !sectionClassId || sectionClassId === value)
                        );
                      }),
                    );

                    setClassId(value);
                    setAssignedSectionIds(nextAssignedSectionIds);
                    syncAssessmentBlocksForScope(
                      value,
                      nextAssignedSectionIds,
                      selectedSubjectIds,
                    );
                  }}
                  placeholder="Select class"
                  searchPlaceholder="Search classes..."
                  emptyText="No classes found."
                  clearLabel="Clear"
                  onClear={() => {
                    setClassId("");
                    setAssignedSectionIds([]);
                    syncAssessmentBlocksForScope("", [], selectedSubjectIds);
                  }}
                  showCloseAction
                />
              </FormField>

              <FormField label="Assigned sections">
                <SearchableMultiSelectPopover
                  selectedValues={assignedSectionIds}
                  options={sectionOptions}
                  onSelectedValuesChange={(nextAssignedSectionIds) => {
                    setAssignedSectionIds(nextAssignedSectionIds);
                    syncAssessmentBlocksForScope(
                      classId,
                      nextAssignedSectionIds,
                      selectedSubjectIds,
                    );
                  }}
                  placeholder="Select sections"
                  noOptionsText={
                    classId
                      ? "No sections available for this class."
                      : "Select a class first."
                  }
                  disabled={!classId}
                />
              </FormField>
            </div>

            <FormField
              label="Subjects"
              hint={inlineErrors.subjects || undefined}
              hintTone={inlineErrors.subjects ? "error" : "muted"}
            >
              <SearchableMultiSelectPopover
                selectedValues={selectedSubjectIds}
                options={subjectOptions}
                onSelectedValuesChange={(nextSubjectIds) => {
                  setSelectedSubjectIds(nextSubjectIds);
                  syncAssessmentBlocksForScope(classId, assignedSectionIds, nextSubjectIds);
                }}
                placeholder="Select subjects"
                noOptionsText="No subjects available."
              />
            </FormField>

            <Accordion
              type="single"
              collapsible
              value={settingsPanelValue}
              onValueChange={setSettingsPanelValue}
              className="pt-1"
            >
              <AccordionItem value="settings" className="border-none">
                <AccordionTrigger className="app-course-inline-accordion-trigger app-course-settings-trigger">
                  <div className="space-y-1 text-left">
                    <span className="block text-sm font-semibold text-foreground">
                      Course settings
                    </span>
                    <span className="block text-xs leading-5 text-muted-foreground">
                      {settingsSummary}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="app-course-inline-accordion-content space-y-5">
                  <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                    <FormField label="Cover image">
                      <div className="space-y-3">
                        <Input
                          value={coverImageUrl}
                          onChange={(event) => setCoverImageUrl(event.target.value)}
                          placeholder="https://example.com/course-cover.webp"
                        />
                        <FilePickerField
                          id="course-cover-image"
                          label="Course cover upload"
                          hideLabel
                          buttonLabel="Upload cover"
                          accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
                          placeholder="No cover selected"
                          selectedFileName={
                            uploadingImageTarget === "cover" ? "Uploading..." : null
                          }
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            event.target.value = "";
                            void handleCoverImageUpload(file);
                          }}
                        />
                        {uploadingImageTarget === "cover" ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Spinner />
                            Uploading cover image...
                          </div>
                        ) : null}
                      </div>
                    </FormField>

                    <FormField label="Cover image alt text">
                      <Input
                        value={coverImageAltText}
                        onChange={(event) => setCoverImageAltText(event.target.value)}
                        placeholder="Describe the cover image"
                      />
                    </FormField>
                  </div>

                  {coverImageUrl ? (
                    <div className="app-course-media-frame mx-auto w-full max-w-4xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coverImageUrl}
                        alt={coverImageAltText || "Course cover preview"}
                        className="h-[220px] w-full object-cover"
                      />
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-3">
                    <FormField label="Starts at">
                      <Input
                        type="datetime-local"
                        value={startsAt}
                        onChange={(event) => setStartsAt(event.target.value)}
                      />
                    </FormField>
                    <FormField label="Due at">
                      <Input
                        type="datetime-local"
                        value={dueAt}
                        onChange={(event) => setDueAt(event.target.value)}
                      />
                    </FormField>
                    <FormField label="Completion badge">
                      <Input
                        value={completionBadgeLabel}
                        onChange={(event) => setCompletionBadgeLabel(event.target.value)}
                        placeholder="Course complete"
                      />
                    </FormField>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <ToggleRow
                      checked={enforceSequentialProgress}
                      onCheckedChange={setEnforceSequentialProgress}
                      label="Sequential progression"
                    />
                    <ToggleRow
                      checked={templateToggleLocked ? true : isTemplate}
                      onCheckedChange={setIsTemplate}
                      label="Save as reusable template"
                      disabled={templateToggleLocked}
                    />
                    <ToggleRow
                      checked={allowNotes}
                      onCheckedChange={setAllowNotes}
                      label="Allow student notes"
                    />
                    <ToggleRow
                      checked={allowBookmarks}
                      onCheckedChange={setAllowBookmarks}
                      label="Allow student bookmarks"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                onClick={() => scrollToSection("course-curriculum")}
                disabled={!setupComplete}
              >
                Continue to Curriculum
              </Button>
              <span className="text-xs text-muted-foreground">
                {setupComplete
                  ? "Scope is ready. Start shaping the learning flow."
                  : "Add a title, class, and subjects to continue."}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card
          className="app-course-editor-card app-course-editor-section-card"
          id="course-curriculum"
        >
          <CardHeader
            className="app-section-header app-course-editor-section-header"
            data-course-section="curriculum"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={buildComplete ? "success" : "warning"}>
                    {buildComplete ? "Curriculum ready" : "Build the flow"}
                  </Badge>
                  <Badge variant="outline">
                    {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
                  </Badge>
                  <Badge variant="outline">
                    {moduleCount} chapter{moduleCount === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <CardTitle>Curriculum</CardTitle>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Lessons can stand on their own, chapters are optional for grouping,
                    and announcements or assessments can be dropped anywhere in the flow.
                  </p>
                </div>
              </div>

              <div className="app-course-chip-cloud">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4" />
                      Add lesson
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-52 p-2">
                    <div className="grid gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => addQuickLessonBlock("text")}
                      >
                        Text lesson
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => addQuickLessonBlock("image")}
                      >
                        Image lesson
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => addQuickLessonBlock("youtube")}
                      >
                        Video lesson
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => addQuickLessonBlock("resource")}
                      >
                        Resource lesson
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4" />
                      Add activity
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 p-2">
                    <div className="grid gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => addBlock("announcement")}
                      >
                        Announcement
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={() => addBlock("assessment")}
                      >
                        Assessment
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="sm" onClick={() => addBlock("module")}>
                  <Plus className="h-4 w-4" />
                  Add chapter
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="app-section-body space-y-5">
            {curriculumEntries.length === 0 ? (
              <div className="app-course-editor-empty-state">
                <div className="space-y-3">
                  <p>Start with the first lesson. Add chapters later if you want grouped units.</p>
                  <Button variant="outline" size="sm" onClick={() => setBlocks(buildStarterCourseBlocks())}>
                    <Plus className="h-4 w-4" />
                    Start with Lesson 1
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {curriculumEntries.map((entry) => {
                  if (entry.kind === "module") {
                    const childLessonCount = entry.children.filter(
                      (child) => child.kind === "lesson",
                    ).length;
                    const childSpecialCount = entry.children.filter(
                      (child) => child.kind === "special",
                    ).length;

                    return (
                      <section key={entry.module.id} className="app-course-module-shell">
                        <div className="app-course-module-header">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="info">Chapter</Badge>
                              <Badge variant="outline">
                                {childLessonCount} lesson{childLessonCount === 1 ? "" : "s"}
                              </Badge>
                              {childSpecialCount > 0 ? (
                                <Badge variant="outline">
                                  {childSpecialCount} activit{childSpecialCount === 1 ? "y" : "ies"}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-sm leading-6 text-muted-foreground">
                              Keep the chapter summary high level, then add the lessons below it.
                            </p>
                          </div>

                          <div className="app-course-chip-cloud">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addLessonToModule(entry.moduleIndex)}
                            >
                              <Plus className="h-4 w-4" />
                              Add lesson
                            </Button>
                            <Button
                              variant="outline"
                              size="icon-sm"
                              onClick={() => moveBlock(entry.module.id, -1)}
                              disabled={!canMoveModuleSectionUp(entry.moduleIndex)}
                              aria-label="Move block up"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon-sm"
                              onClick={() => moveBlock(entry.module.id, 1)}
                              disabled={!canMoveModuleSectionDown(entry.moduleIndex)}
                              aria-label="Move block down"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon-sm"
                              onClick={() => removeBlock(entry.module.id)}
                              aria-label="Remove block"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                          <FormField
                            label="Chapter title"
                            hint={inlineErrors.blocks[entry.module.id]?.title}
                            hintTone={inlineErrors.blocks[entry.module.id]?.title ? "error" : "muted"}
                          >
                            <Input
                              value={entry.module.title}
                              onChange={(event) =>
                                updateBlock<EditableModuleBlock>(
                                  entry.module.id,
                                  (currentBlock) => ({
                                    ...currentBlock,
                                    title: event.target.value,
                                  }),
                                )
                              }
                              placeholder="Chapter 1: Diagnostic mindset"
                            />
                          </FormField>

                          <FormField label="Chapter summary">
                            <Textarea
                              value={entry.module.summary}
                              onChange={(event) =>
                                updateBlock<EditableModuleBlock>(
                                  entry.module.id,
                                  (currentBlock) => ({
                                    ...currentBlock,
                                    summary: event.target.value,
                                  }),
                                )
                              }
                              placeholder="Optional context for the chapter that follows."
                              className="min-h-[100px]"
                            />
                          </FormField>
                        </div>

                        {inlineErrors.blocks[entry.module.id]?.summary ? (
                          <div className="app-course-editor-inline-warning">
                            <div className="space-y-2">
                              <p>{inlineErrors.blocks[entry.module.id]?.summary}</p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => addLessonToModule(entry.moduleIndex, "text")}
                              >
                                <Plus className="h-4 w-4" />
                                Add lesson
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        <div className="space-y-4">
                          {entry.children.length === 0 ? (
                            <div className="app-course-editor-empty-state">
                              This chapter is ready for lessons. Add the first lesson to continue.
                            </div>
                          ) : null}

                          {entry.children.map((child) =>
                            child.kind === "lesson"
                              ? renderLessonPanel(
                                  child.block,
                                  child.blockIndex,
                                  entry.module.title || "Untitled chapter",
                                )
                              : renderSpecialBlockPanel(
                                  child.block,
                                  child.blockIndex,
                                  entry.module.title || "Untitled chapter",
                                ),
                          )}
                        </div>
                      </section>
                    );
                  }

                  if (entry.kind === "special") {
                    return renderSpecialBlockPanel(entry.block, entry.blockIndex);
                  }

                  return renderLessonPanel(entry.block, entry.blockIndex);
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                type="button"
                size="sm"
                onClick={() => scrollToSection("course-publish")}
                disabled={!buildComplete}
              >
                Continue to Save & Publish
              </Button>
              <span className="text-xs text-muted-foreground">
                {buildComplete
                  ? "Curriculum is ready. Review scope, preview, and publish."
                  : "Add at least one lesson to continue."}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="app-course-editor-sidebar">
        <Card
          className="app-course-editor-card app-course-editor-section-card app-course-save-rail"
        >
          <CardHeader
            className="app-section-header app-course-editor-section-header"
            data-course-section="publish"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={publishReady ? "success" : "warning"}>
                  {publishReady ? "Ready to publish" : "Review before publish"}
                </Badge>
                <Badge variant="outline">
                  {canAutosave
                    ? autosaveStatus === "saving"
                      ? "Saving..."
                      : autosaveStatus === "saved"
                        ? "Saved"
                        : "Auto-save"
                    : "Draft"}
                </Badge>
              </div>
              <div className="space-y-1">
                <CardTitle>Save & Publish</CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">
                  Keep the scope visible, preview only when needed, and finish with clear
                  publish actions.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="app-section-body space-y-4" id="course-publish">
            <div className="app-course-metric-grid">
              <div className="app-course-metric-card">
                <p className="app-course-metric-label">Chapters</p>
                <p className="app-course-metric-value">{moduleCount}</p>
              </div>
              <div className="app-course-metric-card">
                <p className="app-course-metric-label">Lessons</p>
                <p className="app-course-metric-value">{lessonCount}</p>
              </div>
              <div className="app-course-metric-card">
                <p className="app-course-metric-label">Assessments</p>
                <p className="app-course-metric-value">
                  {blocks.filter((block) => block.type === "assessment").length}
                </p>
              </div>
              <div className="app-course-metric-card">
                <p className="app-course-metric-label">Sections</p>
                <p className="app-course-metric-value">
                  {assignedSectionIds.length > 0 ? assignedSectionIds.length : "All"}
                </p>
              </div>
            </div>

            <div className="app-editor-summary-list">
              <div className="app-editor-summary-row">
                <div className="space-y-1">
                  <p className="app-editor-summary-label">Class</p>
                  <p className="app-editor-summary-value">{selectedClassName}</p>
                </div>
              </div>
              <div className="app-editor-summary-row">
                <div className="space-y-1">
                  <p className="app-editor-summary-label">Sections</p>
                  <p className="app-editor-summary-value">{selectedSectionSummary}</p>
                </div>
              </div>
              <div className="app-editor-summary-row">
                <div className="space-y-1">
                  <p className="app-editor-summary-label">Window</p>
                  <p className="app-editor-summary-value">
                    {startsAt ? `Starts ${startsAt.replace("T", " ")}` : "Starts immediately"}
                    {dueAt ? ` • Due ${dueAt.replace("T", " ")}` : " • No due date"}
                  </p>
                </div>
              </div>
            </div>

            <div className="app-editor-chip-section">
              <p className="app-editor-chip-section-title">Block mix</p>
              <div className="app-course-chip-cloud">
                {Object.entries(blockCounts)
                  .filter(([, count]) => count > 0)
                  .map(([type, count]) => (
                    <Badge key={type} variant="outline">
                      {count}{" "}
                      {type === "module"
                        ? count === 1
                          ? "chapter"
                          : "chapters"
                        : type}
                    </Badge>
                  ))}
              </div>
            </div>

            <div className="app-editor-chip-section">
              <p className="app-editor-chip-section-title">Subject scope</p>
              <div className="app-course-chip-cloud">
                {selectedSubjectNames.length > 0 ? (
                  selectedSubjectNames.map((subjectName) => (
                    <Badge key={subjectName} variant="outline">
                      {subjectName}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline">No subjects selected</Badge>
                )}
              </div>
            </div>

            <div className="app-editor-chip-section">
              <p className="app-editor-chip-section-title">Student tools</p>
              <div className="app-course-chip-cloud">
                <Badge variant="outline">
                  {requiredAssessmentCount} required assessment
                  {requiredAssessmentCount === 1 ? "" : "s"}
                </Badge>
                {enforceSequentialProgress ? (
                  <Badge variant="outline">Sequential flow</Badge>
                ) : null}
                {allowNotes ? <Badge variant="outline">Notes enabled</Badge> : null}
                {allowBookmarks ? <Badge variant="outline">Bookmarks enabled</Badge> : null}
                {templateToggleLocked ? (
                  <Badge variant="outline">
                    Template
                    {isTemplateVersionCreate &&
                    typeof creationContext.sourceTemplateVersionNumber === "number"
                      ? ` v${creationContext.sourceTemplateVersionNumber + 1}`
                      : ""}
                  </Badge>
                ) : isTemplate ? (
                  <Badge variant="outline">Template</Badge>
                ) : null}
                {completionBadgeLabel ? (
                  <Badge variant="outline">{completionBadgeLabel}</Badge>
                ) : null}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Autosave</p>
              <p
                className={[
                  "text-xs leading-5",
                  autosaveStatus === "error" ? "text-rose-600" : "text-muted-foreground",
                ].join(" ")}
              >
                {canAutosave
                  ? autosaveMessage ||
                    (autosaveStatus === "saved"
                      ? "Draft saved."
                      : "Edits will autosave.")
                  : "Add a title, class, and subject to enable autosave."}
              </p>
            </div>

            <Accordion
              type="single"
              collapsible
              value={previewPanelValue}
              onValueChange={setPreviewPanelValue}
            >
              <AccordionItem value="preview" className="border-none">
                <AccordionTrigger className="app-course-inline-accordion-trigger app-course-preview-trigger">
                  <div className="space-y-1 text-left">
                    <span className="block text-sm font-semibold text-foreground">
                      Preview course
                    </span>
                    <span className="block text-xs leading-5 text-muted-foreground">
                      {previewSummary}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="app-course-inline-accordion-content">
                  <div className="app-course-preview-panel">
                    <CoursePreview blocks={blocks} paperOptionsById={paperOptionsById} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="app-course-save-actions">
              <Button
                variant="outline"
                onClick={() => void handleSubmit("draft")}
                disabled={saving}
                className="app-course-action-button"
                size="lg"
              >
                {savingTarget === "draft" ? <Spinner /> : <Save className="h-4 w-4" />}
                {getActionButtonLabel({
                  mode,
                  targetStatus: "draft",
                  saving: savingTarget === "draft",
                })}
              </Button>
              <Button
                onClick={() => void handleSubmit("published")}
                disabled={saving}
                className="app-course-action-button"
                size="lg"
              >
                {savingTarget === "published" ? <Spinner /> : <Save className="h-4 w-4" />}
                {getActionButtonLabel({
                  mode,
                  targetStatus: "published",
                  saving: savingTarget === "published",
                })}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigateBack()}
                disabled={saving}
                className="app-course-action-button"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
