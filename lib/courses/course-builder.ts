import type {
  CourseAnnouncementTone,
  WorkspaceCourseDetail,
} from "@/lib/courses/types";
import { buildYouTubeWatchUrl } from "@/lib/courses/youtube";

export type EditableModuleBlock = {
  id: string;
  type: "module";
  title: string;
  summary: string;
};

export type EditableLessonTextItem = {
  id: string;
  type: "text";
  contentHtml: string;
};

export type EditableLessonImageItem = {
  id: string;
  type: "image";
  imageUrl: string;
  altText: string;
  caption: string;
  imageFit: "contain" | "cover";
  imageWidth: "compact" | "standard" | "full";
  imageHeight: "small" | "medium" | "large" | "xlarge";
};

export type EditableLessonYoutubeItem = {
  id: string;
  type: "youtube";
  videoId: string;
  caption: string;
  urlInput: string;
};

export type EditableLessonResourceItem = {
  id: string;
  type: "resource";
  title: string;
  fileUrl: string;
  fileName: string;
  caption: string;
};

export type EditableLessonItem =
  | EditableLessonTextItem
  | EditableLessonImageItem
  | EditableLessonYoutubeItem
  | EditableLessonResourceItem;

export type EditableLessonBlock = {
  id: string;
  type: "lesson";
  title: string;
  summary: string;
  estimatedMinutes: string;
  items: EditableLessonItem[];
};

export type EditableAnnouncementBlock = {
  id: string;
  type: "announcement";
  title: string;
  tone: CourseAnnouncementTone;
  contentHtml: string;
};

export type EditableAssessmentBlock = {
  id: string;
  type: "assessment";
  questionPaperId: string;
  titleOverride: string;
  required: boolean;
  minimumScorePct: string;
};

export type EditableCourseBlock =
  | EditableModuleBlock
  | EditableLessonBlock
  | EditableAnnouncementBlock
  | EditableAssessmentBlock;

export type CourseBuilderScopeState = {
  title: string;
  classId: string;
  selectedSubjectIds: string[];
};

export type CourseBuilderOutlineEntry = {
  blockId: string;
  type: EditableCourseBlock["type"];
  depth: 0 | 1;
  parentModuleId?: string;
};

type CourseBuilderTopLevelSegment =
  | {
      kind: "module";
      blockId: string;
      startIndex: number;
      endIndex: number;
    }
  | {
      kind: "special";
      blockId: string;
      startIndex: number;
      endIndex: number;
    };

export function createClientBlockId() {
  return `course-block-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function createClientItemId() {
  return `course-item-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function createStableId(prefix: string, parts: Array<string | number | null | undefined>) {
  const input = parts.map((value) => String(value ?? "")).join("|");
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return `${prefix}-${hash.toString(36)}`;
}

export function formatDateTimeLocalInput(value?: string | null) {
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

export function isCourseBuilderScopeComplete(state: CourseBuilderScopeState) {
  return Boolean(
    state.title.trim() &&
      state.classId &&
      Array.isArray(state.selectedSubjectIds) &&
      state.selectedSubjectIds.length > 0,
  );
}

export function createEmptyLessonItem(
  type: EditableLessonItem["type"],
  overrides?: Partial<EditableLessonItem>,
): EditableLessonItem {
  const nextItemId = createClientItemId();

  if (type === "text") {
    return { id: nextItemId, type: "text", contentHtml: "" };
  }

  if (type === "image") {
    return {
      id: nextItemId,
      type: "image",
      imageUrl: "",
      altText: "",
      caption: "",
      imageFit: "contain",
      imageWidth: "standard",
      imageHeight: "large",
    };
  }

  if (type === "youtube") {
    return {
      id: nextItemId,
      type: "youtube",
      videoId: "",
      caption: "",
      urlInput: "",
    };
  }

  return {
    id: nextItemId,
    type: "resource",
    title:
      overrides && "title" in overrides && typeof overrides.title === "string"
        ? overrides.title
        : "",
    fileUrl: "",
    fileName: "",
    caption: "",
  };
}

export function buildEmptyCourseBuilderBlock(
  type: EditableCourseBlock["type"],
): EditableCourseBlock {
  const id = createClientBlockId();

  switch (type) {
    case "module":
      return {
        id,
        type,
        title: "",
        summary: "",
      };
    case "lesson":
      return {
        id,
        type,
        title: "",
        summary: "",
        estimatedMinutes: "",
        items: [createEmptyLessonItem("text")],
      };
    case "announcement":
      return {
        id,
        type,
        title: "",
        tone: "info",
        contentHtml: "",
      };
    case "assessment":
      return {
        id,
        type,
        questionPaperId: "",
        titleOverride: "",
        required: true,
        minimumScorePct: "",
      };
  }
}

export function createSeededCourseBuilderBlocks(): EditableCourseBlock[] {
  const moduleId = createClientBlockId();
  const lessonId = createClientBlockId();
  return [
    {
      id: moduleId,
      type: "module",
      title: "Module 1",
      summary: "",
    },
    {
      id: lessonId,
      type: "lesson",
      title: "Lesson 1",
      summary: "",
      estimatedMinutes: "",
      items: [createEmptyLessonItem("text")],
    },
  ];
}

export function ensureSeededCourseBuilderBlocks(blocks: EditableCourseBlock[]) {
  if (blocks.length > 0) {
    return blocks;
  }

  return createSeededCourseBuilderBlocks();
}

export function mapInitialCourseBlocks(course?: WorkspaceCourseDetail | null) {
  const sourceBlocks = Array.isArray(course?.blocks) ? course.blocks : [];
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

export function deriveInitialCourseSubjectIds(course?: WorkspaceCourseDetail | null) {
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

export function buildCourseBuilderOutlineEntries(
  blocks: EditableCourseBlock[],
): CourseBuilderOutlineEntry[] {
  const entries: CourseBuilderOutlineEntry[] = [];
  let currentModuleId: string | undefined;

  blocks.forEach((block) => {
    if (block.type === "module") {
      currentModuleId = block.id;
      entries.push({
        blockId: block.id,
        type: block.type,
        depth: 0,
      });
      return;
    }

    if (block.type === "lesson" && currentModuleId) {
      entries.push({
        blockId: block.id,
        type: block.type,
        depth: 1,
        parentModuleId: currentModuleId,
      });
      return;
    }

    currentModuleId = undefined;
    entries.push({
      blockId: block.id,
      type: block.type,
      depth: 0,
    });
  });

  return entries;
}

function buildTopLevelSegments(
  blocks: EditableCourseBlock[],
): CourseBuilderTopLevelSegment[] {
  const segments: CourseBuilderTopLevelSegment[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];
    if (block.type === "module") {
      let endIndex = index;
      while (endIndex + 1 < blocks.length && blocks[endIndex + 1]?.type === "lesson") {
        endIndex += 1;
      }

      segments.push({
        kind: "module",
        blockId: block.id,
        startIndex: index,
        endIndex,
      });
      index = endIndex + 1;
      continue;
    }

    segments.push({
      kind: "special",
      blockId: block.id,
      startIndex: index,
      endIndex: index,
    });
    index += 1;
  }

  return segments;
}

function swapRanges(
  blocks: EditableCourseBlock[],
  first: CourseBuilderTopLevelSegment,
  second: CourseBuilderTopLevelSegment,
) {
  const firstRange = blocks.slice(first.startIndex, first.endIndex + 1);
  const secondRange = blocks.slice(second.startIndex, second.endIndex + 1);

  return [
    ...blocks.slice(0, first.startIndex),
    ...secondRange,
    ...blocks.slice(first.endIndex + 1, second.startIndex),
    ...firstRange,
    ...blocks.slice(second.endIndex + 1),
  ];
}

export function moveCourseBuilderTopLevelBlock(
  blocks: EditableCourseBlock[],
  blockId: string,
  direction: -1 | 1,
) {
  const segments = buildTopLevelSegments(blocks);
  const segmentIndex = segments.findIndex((segment) => segment.blockId === blockId);
  const targetSegmentIndex = segmentIndex + direction;

  if (
    segmentIndex < 0 ||
    targetSegmentIndex < 0 ||
    targetSegmentIndex >= segments.length
  ) {
    return blocks;
  }

  const currentSegment = segments[segmentIndex];
  const targetSegment = segments[targetSegmentIndex];

  if (currentSegment.startIndex < targetSegment.startIndex) {
    return swapRanges(blocks, currentSegment, targetSegment);
  }

  return swapRanges(blocks, targetSegment, currentSegment);
}

export function moveCourseBuilderLessonWithinModule(
  blocks: EditableCourseBlock[],
  lessonId: string,
  direction: -1 | 1,
) {
  const lessonIndex = blocks.findIndex((block) => block.id === lessonId);
  if (lessonIndex < 0 || blocks[lessonIndex]?.type !== "lesson") {
    return blocks;
  }

  let moduleIndex = -1;
  for (let index = lessonIndex - 1; index >= 0; index -= 1) {
    if (blocks[index]?.type === "module") {
      moduleIndex = index;
      break;
    }
    if (blocks[index]?.type !== "lesson") {
      return blocks;
    }
  }

  if (moduleIndex < 0) {
    return blocks;
  }

  const lessonSiblingIndexes: number[] = [];
  for (let index = moduleIndex + 1; index < blocks.length; index += 1) {
    if (blocks[index]?.type !== "lesson") {
      break;
    }
    lessonSiblingIndexes.push(index);
  }

  const siblingPosition = lessonSiblingIndexes.indexOf(lessonIndex);
  const targetSiblingPosition = siblingPosition + direction;
  if (
    siblingPosition < 0 ||
    targetSiblingPosition < 0 ||
    targetSiblingPosition >= lessonSiblingIndexes.length
  ) {
    return blocks;
  }

  const targetIndex = lessonSiblingIndexes[targetSiblingPosition];
  const nextBlocks = [...blocks];
  const [movingLesson] = nextBlocks.splice(lessonIndex, 1);
  nextBlocks.splice(targetIndex, 0, movingLesson);
  return nextBlocks;
}

export function moveCourseBuilderLessonToAdjacentModule(
  blocks: EditableCourseBlock[],
  lessonId: string,
  direction: "prev" | "next",
) {
  const sourceIndex = blocks.findIndex((block) => block.id === lessonId);
  if (sourceIndex < 0 || blocks[sourceIndex]?.type !== "lesson") {
    return blocks;
  }

  const findPrevModuleIndex = (fromIndex: number) => {
    for (let index = fromIndex; index >= 0; index -= 1) {
      if (blocks[index]?.type === "module") {
        return index;
      }
      if (blocks[index]?.type !== "lesson") {
        break;
      }
    }
    return -1;
  };

  const findNextModuleIndex = (fromIndex: number) => {
    for (let index = fromIndex; index < blocks.length; index += 1) {
      if (blocks[index]?.type === "module") {
        return index;
      }
    }
    return -1;
  };

  const currentModuleIndex = findPrevModuleIndex(sourceIndex);
  if (currentModuleIndex < 0) {
    return blocks;
  }

  let targetIndex = -1;
  if (direction === "prev") {
    const prevModuleIndex = findPrevModuleIndex(currentModuleIndex - 1);
    if (prevModuleIndex < 0) {
      return blocks;
    }
    targetIndex = prevModuleIndex + 1;
    while (targetIndex < blocks.length && blocks[targetIndex]?.type === "lesson") {
      targetIndex += 1;
    }
  } else {
    const nextModuleIndex = findNextModuleIndex(currentModuleIndex + 1);
    if (nextModuleIndex < 0) {
      return blocks;
    }
    targetIndex = nextModuleIndex + 1;
    while (targetIndex < blocks.length && blocks[targetIndex]?.type === "lesson") {
      targetIndex += 1;
    }
  }

  const nextBlocks = [...blocks];
  const [movingLesson] = nextBlocks.splice(sourceIndex, 1);
  const adjustedTargetIndex =
    sourceIndex < targetIndex ? Math.max(0, targetIndex - 1) : targetIndex;
  nextBlocks.splice(adjustedTargetIndex, 0, movingLesson);
  return nextBlocks;
}

export function duplicateCourseBuilderLesson(
  blocks: EditableCourseBlock[],
  lessonId: string,
) {
  const index = blocks.findIndex((block) => block.id === lessonId);
  if (index < 0) {
    return {
      blocks,
      duplicatedLessonId: null,
    };
  }

  const targetBlock = blocks[index];
  if (targetBlock.type !== "lesson") {
    return {
      blocks,
      duplicatedLessonId: null,
    };
  }

  const duplicatedLesson: EditableLessonBlock = {
    ...targetBlock,
    id: createClientBlockId(),
    title: targetBlock.title ? `${targetBlock.title} Copy` : "Lesson Copy",
    items: targetBlock.items.map((item) => ({
      ...item,
      id: createClientItemId(),
    })),
  };

  const nextBlocks = [...blocks];
  nextBlocks.splice(index + 1, 0, duplicatedLesson);

  return {
    blocks: nextBlocks,
    duplicatedLessonId: duplicatedLesson.id,
  };
}

export function removeCourseBuilderBlockWithFallback(
  blocks: EditableCourseBlock[],
  blockId: string,
) {
  const targetIndex = blocks.findIndex((block) => block.id === blockId);
  if (targetIndex < 0) {
    return blocks;
  }

  const targetBlock = blocks[targetIndex];
  let nextBlocks: EditableCourseBlock[] = [];

  if (targetBlock.type === "module") {
    let endIndex = targetIndex;
    while (endIndex + 1 < blocks.length && blocks[endIndex + 1]?.type === "lesson") {
      endIndex += 1;
    }

    nextBlocks = [...blocks.slice(0, targetIndex), ...blocks.slice(endIndex + 1)];
  } else {
    nextBlocks = blocks.filter((block) => block.id !== blockId);
  }

  if (!nextBlocks.some((block) => block.type === "module")) {
    return createSeededCourseBuilderBlocks();
  }

  if (!nextBlocks.some((block) => block.type === "lesson")) {
    const firstModuleIndex = nextBlocks.findIndex((block) => block.type === "module");
    if (firstModuleIndex >= 0) {
      const seededLesson = buildEmptyCourseBuilderBlock("lesson");
      if (seededLesson.type === "lesson") {
        seededLesson.title = "Lesson 1";
        nextBlocks = [...nextBlocks];
        nextBlocks.splice(firstModuleIndex + 1, 0, seededLesson);
      }
    }
  }

  return nextBlocks;
}

export function getModuleContextForLesson(
  blocks: EditableCourseBlock[],
  lessonId: string,
) {
  const lessonIndex = blocks.findIndex((block) => block.id === lessonId);
  if (lessonIndex < 0 || blocks[lessonIndex]?.type !== "lesson") {
    return null;
  }

  for (let index = lessonIndex - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block?.type === "module") {
      return block;
    }
    if (block?.type !== "lesson") {
      break;
    }
  }

  return null;
}
