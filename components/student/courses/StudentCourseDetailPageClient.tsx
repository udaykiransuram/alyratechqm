"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  Download,
  FileQuestion,
  Lock,
  PlayCircle,
} from "lucide-react";

import { ContentRenderer } from "@/components/ContentRenderer";
import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { fetchApiJson } from "@/lib/client/api";
import { getCourseImageDisplayClasses } from "@/lib/courses/image-display";
import type {
  CourseBlock,
  CourseProgressSnapshot,
  StudentCourseDetail,
  StudentCourseDetailBlock,
} from "@/lib/courses/types";
import { buildYouTubeEmbedUrl, buildYouTubeWatchUrl } from "@/lib/courses/youtube";

type StudentCourseDetailPageClientProps = {
  courseId: string;
  initialCourse: StudentCourseDetail;
};

const COURSE_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

const AVAILABILITY_LABELS: Record<string, string> = {
  upcoming: "Upcoming",
  active: "Active",
  overdue: "Overdue",
  completed: "Completed",
};

const ASSESSMENT_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  available: "Ready",
  upcoming: "Upcoming",
  in_progress: "In progress",
  submitted: "Submitted",
  auto_submitted: "Submitted",
  expired: "Closed",
  unavailable: "Unavailable",
};

function formatCourseDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getAssessmentActionLabel(status: string) {
  if (status === "in_progress") {
    return "Continue Assessment";
  }
  if (status === "submitted" || status === "auto_submitted") {
    return "Open Analysis Report";
  }
  return "Open Assessment";
}

function CourseImagePanel({
  imageUrl,
  altText,
  caption,
  fallbackLabel,
  displayClasses,
}: {
  imageUrl: string;
  altText?: string | null;
  caption?: string | null;
  fallbackLabel?: string;
  displayClasses: ReturnType<typeof getCourseImageDisplayClasses>;
}) {
  const [hasError, setHasError] = useState(false);

  if (!imageUrl || hasError) {
    return (
      <div className="app-course-panel">
        <p className="text-sm text-muted-foreground">
          {fallbackLabel || "Image could not be loaded."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={displayClasses.wrapperClassName}>
        <div className={displayClasses.frameClassName}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={altText || "Course image"}
            className={displayClasses.imageClassName}
            loading="lazy"
            decoding="async"
            onError={() => setHasError(true)}
          />
        </div>
      </div>
      {caption ? (
        <p className="text-sm leading-6 text-muted-foreground">{caption}</p>
      ) : null}
    </div>
  );
}

function CourseVideoPanel({
  videoId,
  caption,
}: {
  videoId?: string | null;
  caption?: string | null;
}) {
  const [hasError, setHasError] = useState(false);
  const watchUrl = videoId ? buildYouTubeWatchUrl(videoId) : "";

  if (!videoId || hasError) {
    return (
      <div className="app-course-panel space-y-2">
        <p className="text-sm text-muted-foreground">
          Video could not be loaded.
        </p>
        {watchUrl ? (
          <a href={watchUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary">
            Open video in a new tab
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="app-course-media-frame">
        <div className="aspect-video w-full">
          <iframe
            title="Course video"
            src={buildYouTubeEmbedUrl(videoId)}
            className="h-full w-full"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            onError={() => setHasError(true)}
          />
        </div>
      </div>
      {caption ? (
        <p className="text-sm leading-6 text-muted-foreground">{caption}</p>
      ) : null}
    </div>
  );
}

function CourseResourcePanel({
  title,
  fileUrl,
  fileName,
  caption,
}: {
  title?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  caption?: string | null;
}) {
  if (!fileUrl) {
    return (
      <div className="app-course-panel">
        <p className="text-sm text-muted-foreground">
          Resource file is unavailable.
        </p>
      </div>
    );
  }

  return (
    <div className="app-course-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">
            {title || "Resource"}
          </p>
          {fileName ? (
            <p className="text-sm text-muted-foreground">{fileName}</p>
          ) : null}
          {caption ? (
            <p className="text-sm text-muted-foreground">{caption}</p>
          ) : null}
        </div>
        <Button
          asChild
          variant="outline"
          className="app-button-compact-secondary app-course-action-button"
        >
          <a href={fileUrl} target="_blank" rel="noreferrer">
            Download
            <Download className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}

type LessonTocEntry = {
  id: string;
  text: string;
  level: 2 | 3;
};

function slugifyHeading(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 64);
}

function useLessonToc(params: {
  lessonId: string;
  contentKey: string;
  containerRef: RefObject<HTMLDivElement>;
}) {
  const { lessonId, contentKey, containerRef } = params;
  const [entries, setEntries] = useState<LessonTocEntry[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const headings = Array.from(container.querySelectorAll("h2, h3"));
    const nextEntries: LessonTocEntry[] = [];
    const usedIds = new Set<string>();

    headings.forEach((heading, index) => {
      if (!(heading instanceof HTMLElement)) {
        return;
      }

      const text = String(heading.textContent || "").trim();
      if (!text) {
        return;
      }

      let id = heading.getAttribute("id");
      if (!id) {
        const baseId = `${lessonId}-${slugifyHeading(text) || "section"}`;
        id = baseId;
        if (usedIds.has(id)) {
          id = `${baseId}-${index + 1}`;
        }
        heading.setAttribute("id", id);
      }

      usedIds.add(id);
      nextEntries.push({
        id,
        text,
        level: heading.tagName === "H3" ? 3 : 2,
      });
    });

    setEntries(nextEntries);
  }, [contentKey, containerRef, lessonId]);

  return entries;
}

function LessonContentPanel({
  lessonId,
  contentKey,
  children,
}: {
  lessonId: string;
  contentKey: string;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const tocEntries = useLessonToc({
    lessonId,
    contentKey,
    containerRef: contentRef,
  });

  const handleTocJump = (entryId: string) => {
    const container = contentRef.current;
    if (!container) {
      return;
    }

    const selector =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? `#${CSS.escape(entryId)}`
        : `#${entryId}`;
    const target = container.querySelector(selector);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="space-y-3">
      {tocEntries.length > 0 ? (
        <div className="app-course-panel app-course-toc">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Lesson outline
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {tocEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => handleTocJump(entry.id)}
                className={[
                  "app-course-toc-button",
                  entry.level === 3 ? "app-course-toc-button-sub" : "",
                ].join(" ")}
              >
                {entry.text}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div ref={contentRef} className="space-y-3">
        {children}
      </div>
    </div>
  );
}

function canManuallyCompleteBlock(block: CourseBlock) {
  return (
    block.type === "lesson" ||
    block.type === "text" ||
    block.type === "image" ||
    block.type === "youtube" ||
    block.type === "resource"
  );
}

const LESSON_BLOCK_TYPES = new Set<CourseBlock["type"]>([
  "text",
  "image",
  "youtube",
  "resource",
]);

type CourseSection = {
  id: string;
  title: string;
  summary?: string;
  blocks: StudentCourseDetailBlock[];
};

type CourseLessonGroup = {
  id: string;
  type: "lesson";
  blocks: StudentCourseDetailBlock[];
  lessonBlock?: Extract<StudentCourseDetailBlock, { type: "lesson" }>;
};

type CourseAnnouncementGroup = {
  id: string;
  type: "announcement";
  blocks: [Extract<StudentCourseDetailBlock, { type: "announcement" }>];
};

type CourseAssessmentGroup = {
  id: string;
  type: "assessment";
  blocks: [Extract<StudentCourseDetailBlock, { type: "assessment" }>];
};

type CourseBlockGroup =
  | CourseLessonGroup
  | CourseAnnouncementGroup
  | CourseAssessmentGroup;

function isBlockingProgressBlock(block: CourseBlock) {
  return (
    block.type !== "module" &&
    block.type !== "announcement" &&
    !(block.type === "assessment" && block.required === false)
  );
}

function isNonAssessmentBlockCompleted(block: CourseBlock, progress: CourseProgressSnapshot) {
  if (!canManuallyCompleteBlock(block)) {
    return false;
  }

  if (progress.completedBlockIds.includes(block.id)) {
    return true;
  }

  return (
    (block.type === "lesson" ||
      block.type === "text" ||
      block.type === "image" ||
      block.type === "youtube" ||
      block.type === "resource") &&
    progress.viewedBlockIds.includes(block.id)
  );
}

function deriveBlocks(course: StudentCourseDetail): StudentCourseDetailBlock[] {
  const noteByBlockId = new Map(course.progress.notes.map((note) => [note.blockId, note.text]));
  let gateClosed = false;

  return course.blocks.map((block) => {
    const isCompleted =
      block.type === "assessment"
        ? Boolean(block.assessmentState.meetsMinimumScore)
        : isNonAssessmentBlockCompleted(block, course.progress);

    const isLocked =
      block.type === "module" || block.type === "announcement"
        ? false
        : course.availabilityStatus === "upcoming"
          ? true
          : course.metadata.enforceSequentialProgress && gateClosed;

    if (
      course.metadata.enforceSequentialProgress &&
      !isLocked &&
      isBlockingProgressBlock(block) &&
      !isCompleted
    ) {
      gateClosed = true;
    }

    return {
      ...block,
      isLocked,
      isCompleted,
      isBookmarked: course.progress.bookmarkedBlockIds.includes(block.id),
      note: noteByBlockId.get(block.id) || null,
    } satisfies StudentCourseDetailBlock;
  });
}

function getFirstNavigableBlockId(blocks: StudentCourseDetailBlock[]) {
  return blocks.find((block) => !block.isLocked && block.type !== "module")?.id || "";
}

function splitCourseBlocksIntoSections(
  blocks: StudentCourseDetailBlock[],
): CourseSection[] {
  const sections: CourseSection[] = [];
  let currentSection: CourseSection | null = null;

  const ensureSection = () => {
    if (currentSection) {
      return currentSection;
    }
    currentSection = {
      id: "course-section-intro",
      title: "Overview",
      summary: undefined,
      blocks: [],
    };
    sections.push(currentSection);
    return currentSection;
  };

  blocks.forEach((block) => {
    if (block.type === "module") {
      currentSection = {
        id: block.id,
        title: block.title,
        summary: block.summary,
        blocks: [],
      };
      sections.push(currentSection);
      return;
    }

    ensureSection().blocks.push(block);
  });

  return sections.filter((section) => section.blocks.length > 0);
}

function groupCourseSectionBlocks(
  blocks: StudentCourseDetailBlock[],
): CourseBlockGroup[] {
  const groups: CourseBlockGroup[] = [];
  let currentLesson: StudentCourseDetailBlock[] = [];

  const flushLesson = () => {
    if (currentLesson.length > 0) {
      groups.push({
        id: currentLesson[0].id,
        type: "lesson",
        blocks: currentLesson,
      } satisfies CourseLessonGroup);
      currentLesson = [];
    }
  };

  blocks.forEach((block) => {
    if (block.type === "lesson") {
      flushLesson();
      groups.push({
        id: block.id,
        type: "lesson",
        blocks: [block],
        lessonBlock: block,
      } satisfies CourseLessonGroup);
      return;
    }

    if (LESSON_BLOCK_TYPES.has(block.type)) {
      currentLesson.push(block);
      return;
    }

    flushLesson();

    if (block.type === "announcement") {
      groups.push({
        id: block.id,
        type: "announcement",
        blocks: [block],
      } satisfies CourseAnnouncementGroup);
      return;
    }

    if (block.type === "assessment") {
      groups.push({
        id: block.id,
        type: "assessment",
        blocks: [block],
      } satisfies CourseAssessmentGroup);
    }
  });

  flushLesson();
  return groups;
}

function getLessonNoteAnchorId(blocks: StudentCourseDetailBlock[]) {
  const notedBlock = blocks.find((block) => Boolean(block.note));
  return notedBlock?.id || blocks[0]?.id || "";
}

function getLockedMessage(course: StudentCourseDetail) {
  if (course.availabilityStatus === "upcoming") {
    return course.metadata.startsAt
      ? `This course opens on ${formatCourseDate(course.metadata.startsAt)}.`
      : "This course is not available yet.";
  }

  return "Finish the earlier required blocks to unlock this section.";
}

function AssessmentActionButtons({
  block,
}: {
  block: Extract<StudentCourseDetailBlock, { type: "assessment" }>;
}) {
  if (block.isLocked) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button disabled className="app-course-action-button">
          <Lock className="h-4 w-4" />
          Locked
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild className="app-button-compact-primary app-course-action-button">
        <AppPrefetchLink
          href={block.assessmentState.reportHref || block.assessmentState.launchHref}
        >
          {block.assessmentState.reportHref ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <PlayCircle className="h-4 w-4" />
          )}
          {getAssessmentActionLabel(block.assessmentState.attemptStatus)}
        </AppPrefetchLink>
      </Button>
      {!block.assessmentState.reportHref ? (
        <Button
          asChild
          variant="outline"
          className="app-button-compact-secondary app-course-action-button"
        >
          <AppPrefetchLink href={block.assessmentState.launchHref}>
            <FileQuestion className="h-4 w-4" />
            Open Test Page
          </AppPrefetchLink>
        </Button>
      ) : null}
    </div>
  );
}

export default function StudentCourseDetailPageClient({
  courseId,
  initialCourse,
}: StudentCourseDetailPageClientProps) {
  const [course, setCourse] = useState(initialCourse);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [busyBlockId, setBusyBlockId] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const persistTimerRef = useRef<number | null>(null);
  const persistedBlockIdRef = useRef<string | null>(initialCourse.progress.lastViewedBlockId);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>(
    Object.fromEntries(
      initialCourse.progress.notes.map((note) => [note.blockId, note.text]),
    ),
  );

  const blocks = useMemo(() => deriveBlocks(course), [course]);
  const courseSections = useMemo(
    () => splitCourseBlocksIntoSections(blocks),
    [blocks],
  );
  const [activeBlockId, setActiveBlockId] = useState(
    course.progress.lastViewedBlockId || getFirstNavigableBlockId(blocks),
  );

  useEffect(() => {
    setNoteDrafts(
      Object.fromEntries(course.progress.notes.map((note) => [note.blockId, note.text])),
    );
  }, [course.progress.notes]);

  const requiredAssessmentCount = useMemo(
    () =>
      blocks.filter(
        (block) => block.type === "assessment" && block.required !== false,
      ).length,
    [blocks],
  );

  const completedAssessmentCount = course.progress.completedAssessmentPaperIds.length;

  const patchProgress = useCallback(
    async (payload: Record<string, unknown>) => {
      const response = await fetchApiJson<{
        success: boolean;
        progress: CourseProgressSnapshot;
      }>(`/api/student/courses/${courseId}/progress`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        fallbackMessage: "Failed to update course progress.",
      });

      setCourse((currentCourse) => ({
        ...currentCourse,
        progress: response.progress,
      }));
      setProgressError(null);
      return response.progress;
    },
    [courseId],
  );

  const persistProgress = useCallback(
    (blockId: string) => {
      const block = blocks.find((entry) => entry.id === blockId);
      if (!block || block.isLocked || blockId === persistedBlockIdRef.current) {
        return;
      }

      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }

      persistTimerRef.current = window.setTimeout(async () => {
        try {
          await patchProgress({
            lastViewedBlockId: blockId,
            viewedBlockId: blockId,
          });
          persistedBlockIdRef.current = blockId;
        } catch (error) {
          setProgressError(
            error instanceof Error
              ? error.message
              : "We couldn't update your course progress.",
          );
        }
      }, 250);
    },
    [blocks, patchProgress],
  );

  useEffect(() => {
    const visibleElements = Object.entries(sectionRefs.current).filter((entry) =>
      Boolean(entry[1]),
    );

    if (visibleElements.length === 0 || typeof IntersectionObserver !== "function") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (!visibleEntry?.target) {
          return;
        }

        const blockId = String(
          (visibleEntry.target as HTMLElement).dataset.courseBlockId || "",
        ).trim();
        if (!blockId) {
          return;
        }

        const block = blocks.find((entry) => entry.id === blockId);
        if (block?.isLocked) {
          return;
        }

        setActiveBlockId(blockId);
        persistProgress(blockId);
      },
      {
        threshold: [0.35, 0.6],
        rootMargin: "-10% 0px -45% 0px",
      },
    );

    visibleElements.forEach(([, element]) => {
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
    };
  }, [blocks, persistProgress]);

  const scrollToBlock = (blockId: string) => {
    const block = blocks.find((entry) => entry.id === blockId);
    if (!block || block.isLocked) {
      return;
    }

    const element = sectionRefs.current[blockId];
    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setActiveBlockId(blockId);
    persistProgress(blockId);
  };

  const handleToggleBookmark = async (blockId: string, nextBookmarked: boolean) => {
    try {
      setBusyBlockId(blockId);
      await patchProgress({
        bookmarkedBlockId: blockId,
        bookmarked: nextBookmarked,
      });
    } catch (error) {
      setProgressError(
        error instanceof Error ? error.message : "We couldn't update the bookmark.",
      );
    } finally {
      setBusyBlockId(null);
    }
  };

  const handleToggleComplete = async (blockId: string, nextCompleted: boolean) => {
    try {
      setBusyBlockId(blockId);
      await patchProgress({
        completedBlockId: blockId,
        completed: nextCompleted,
      });
    } catch (error) {
      setProgressError(
        error instanceof Error ? error.message : "We couldn't update the completion state.",
      );
    } finally {
      setBusyBlockId(null);
    }
  };

  const handleSaveNote = async (blockId: string, nextText?: string) => {
    try {
      setBusyBlockId(blockId);
      await patchProgress({
        note: {
          blockId,
          text: nextText ?? noteDrafts[blockId] ?? "",
        },
      });
    } catch (error) {
      setProgressError(
        error instanceof Error ? error.message : "We couldn't save your note.",
      );
    } finally {
      setBusyBlockId(null);
    }
  };

  const handleBulkComplete = async (
    blockIds: string[],
    nextCompleted: boolean,
    busyKey: string,
  ) => {
    try {
      setBusyBlockId(busyKey);
      for (const blockId of blockIds) {
        await patchProgress({
          completedBlockId: blockId,
          completed: nextCompleted,
        });
      }
    } catch (error) {
      setProgressError(
        error instanceof Error
          ? error.message
          : "We couldn't update the completion state.",
      );
    } finally {
      setBusyBlockId(null);
    }
  };

  const handleBulkBookmark = async (
    blockIds: string[],
    nextBookmarked: boolean,
    busyKey: string,
  ) => {
    try {
      setBusyBlockId(busyKey);
      for (const blockId of blockIds) {
        await patchProgress({
          bookmarkedBlockId: blockId,
          bookmarked: nextBookmarked,
        });
      }
    } catch (error) {
      setProgressError(
        error instanceof Error ? error.message : "We couldn't update the bookmark.",
      );
    } finally {
      setBusyBlockId(null);
    }
  };

  const resumeBlockId =
    blocks.find(
      (block) =>
        block.id === course.progress.lastViewedBlockId &&
        !block.isLocked &&
        block.type !== "module",
    )?.id ||
    getFirstNavigableBlockId(blocks);

  const lessonSummaries = useMemo(() => {
    let lessonNumber = 0;
    const summaries: Array<{
      id: string;
      title: string;
      completed: boolean;
      locked: boolean;
      blockIds: string[];
      estimatedMinutes?: number | null;
    }> = [];

    courseSections.forEach((section) => {
      const groups = groupCourseSectionBlocks(section.blocks);
      groups.forEach((group) => {
        if (group.type !== "lesson") {
          return;
        }

        lessonNumber += 1;
        const lessonBlock = group.lessonBlock;
        const blockIds = group.blocks.map((block) => block.id);
        const completed = group.blocks.every((block) => block.isCompleted);
        const locked = group.blocks.some((block) => block.isLocked);
        const title = lessonBlock?.title
          ? `Lesson ${lessonNumber}: ${lessonBlock.title}`
          : `Lesson ${lessonNumber}`;

        summaries.push({
          id: lessonBlock?.id || group.id,
          title,
          completed,
          locked,
          blockIds,
          estimatedMinutes: lessonBlock?.estimatedMinutes ?? null,
        });
      });
    });

    return summaries;
  }, [courseSections]);

  const totalLessons = lessonSummaries.length;
  const completedLessons = lessonSummaries.filter((lesson) => lesson.completed).length;
  const lessonProgressPct = totalLessons
    ? Math.round((completedLessons / totalLessons) * 100)
    : 100;
  const resumeLesson = lessonSummaries.find((lesson) =>
    resumeBlockId ? lesson.blockIds.includes(resumeBlockId) : false,
  );
  const nextLesson =
    lessonSummaries.find((lesson) => !lesson.completed && !lesson.locked) ||
    lessonSummaries.find((lesson) => !lesson.locked) ||
    null;

  const nextLessonById = useMemo(() => {
    const map = new Map<string, (typeof lessonSummaries)[number] | null>();
    lessonSummaries.forEach((lesson, index) => {
      map.set(lesson.id, lessonSummaries[index + 1] || null);
    });
    return map;
  }, [lessonSummaries]);

  const sectionTimeSummary = useMemo(() => {
    const summary = new Map<
      string,
      { remainingMinutes: number; estimatedCount: number }
    >();

    courseSections.forEach((section) => {
      const groups = groupCourseSectionBlocks(section.blocks);
      let remainingMinutes = 0;
      let estimatedCount = 0;

      groups.forEach((group) => {
        if (group.type !== "lesson") {
          return;
        }

        const lessonBlock = group.lessonBlock;
        if (
          typeof lessonBlock?.estimatedMinutes !== "number" ||
          lessonBlock.estimatedMinutes <= 0
        ) {
          return;
        }

        estimatedCount += 1;
        if (!group.blocks.every((block) => block.isCompleted)) {
          remainingMinutes += lessonBlock.estimatedMinutes;
        }
      });

      summary.set(section.id, { remainingMinutes, estimatedCount });
    });

    return summary;
  }, [courseSections]);

  return (
    <div className="app-student-page-shell app-course-page">
      <PageHero
        className="app-learning-hero"
        eyebrow="Student Portal"
        title={course.title}
        variant="overview"
        density="compact"
        description={
          course.summary ||
          "Continue through the course blocks and complete the required assessments."
        }
        actions={
          <div className="app-student-action-cluster">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="app-student-action-secondary"
            >
              <AppPrefetchLink href="/student/courses">
                <ArrowLeft className="h-4 w-4" />
                Back to Courses
              </AppPrefetchLink>
            </Button>
            {resumeBlockId ? (
              <Button
                size="lg"
                className="app-student-action-primary"
                onClick={() => scrollToBlock(resumeBlockId)}
              >
                Continue where you left off
              </Button>
            ) : null}
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">
              {COURSE_STATUS_LABELS[course.progress.status] || "In progress"}
            </span>
            <span className="app-meta-chip">
              {AVAILABILITY_LABELS[course.availabilityStatus] || "Active"}
            </span>
            {course.class?.name ? (
              <span className="app-meta-chip">{course.class.name}</span>
            ) : null}
            {course.metadata.completionBadgeLabel ? (
              <span className="app-meta-chip">{course.metadata.completionBadgeLabel}</span>
            ) : null}
          </>
        }
        stats={[
          {
            label: "Progress",
            value: `${course.progress.completionPercent}%`,
            meta:
              course.progress.status === "completed"
                ? "Course flow completed."
                : "Continue the learning sequence.",
          },
          {
            label: "Required assessments",
            value: String(requiredAssessmentCount),
            meta: "Completion-driving tasks.",
          },
          {
            label: "Completed assessments",
            value: String(completedAssessmentCount),
            meta: "Submitted linked tests that count.",
          },
          {
            label: "Availability",
            value: AVAILABILITY_LABELS[course.availabilityStatus] || "Active",
            meta:
              course.metadata.dueAt && course.availabilityStatus !== "completed"
                ? `Due ${formatCourseDate(course.metadata.dueAt) || "soon"}`
                : "Open in your student scope.",
          },
        ]}
      >
        <StudentPortalNav />
      </PageHero>

      {progressError ? <FeedbackNotice variant="error">{progressError}</FeedbackNotice> : null}

      {course.availabilityStatus === "upcoming" ? (
        <FeedbackNotice>
          {course.metadata.startsAt
            ? `This course opens on ${formatCourseDate(course.metadata.startsAt)}.`
            : "This course is not available yet."}
        </FeedbackNotice>
      ) : null}

      {course.availabilityStatus === "overdue" ? (
        <FeedbackNotice>
          This course is past its due date. You can still review the material and open any linked reports that remain available.
        </FeedbackNotice>
      ) : null}

      {course.metadata.coverImageUrl ? (
        <Card className="app-course-cover-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={course.metadata.coverImageUrl}
            alt={course.metadata.coverImageAltText || course.title}
            className="app-course-cover-image"
          />
        </Card>
      ) : null}

      <div className="app-course-student-layout">
        <div className="app-course-student-sidebar">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
            <CardTitle>Course Outline</CardTitle>
          </CardHeader>
            <CardContent className="app-section-body space-y-3">
              {courseSections.map((section, sectionIndex) => {
                const groups = groupCourseSectionBlocks(section.blocks);
                let lessonIndex = 0;

                return (
                <div key={section.id} className="space-y-1.5">
                    <div className="app-course-outline-section-title">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Section {sectionIndex + 1}
                      </span>
                      <p className="truncate text-sm font-semibold text-foreground">
                        {section.title}
                      </p>
                    </div>

                    {groups.map((group, groupIndex) => {
                      const groupBlocks = group.blocks;
                      const firstBlock = groupBlocks[0];
                      const groupBlockIds = groupBlocks.map((block) => block.id);
                      const isActive = groupBlockIds.includes(activeBlockId);
                      const isLocked = groupBlocks.some((block) => block.isLocked);
                      const isBookmarked = groupBlocks.some((block) => block.isBookmarked);
                      const isCompleted =
                        group.type === "lesson"
                          ? groupBlocks.every((block) => block.isCompleted)
                          : Boolean(firstBlock?.isCompleted);

                      if (group.type === "lesson") {
                        lessonIndex += 1;
                      }

                      let label = "Lesson";
                      let lessonMeta: string | null = null;
                      if (group.type === "lesson") {
                        const lessonBlock = group.lessonBlock;
                        label = lessonBlock?.title
                          ? `Lesson ${lessonIndex}: ${lessonBlock.title}`
                          : `Lesson ${lessonIndex}`;
                        lessonMeta =
                          typeof lessonBlock?.estimatedMinutes === "number" &&
                          lessonBlock.estimatedMinutes > 0
                            ? `~${lessonBlock.estimatedMinutes} min`
                            : null;
                      } else if (group.type === "announcement") {
                        const announcementBlock = firstBlock as Extract<
                          StudentCourseDetailBlock,
                          { type: "announcement" }
                        >;
                        label = announcementBlock.title || "Announcement";
                      } else {
                        const assessmentBlock = firstBlock as Extract<
                          StudentCourseDetailBlock,
                          { type: "assessment" }
                        >;
                        label =
                          assessmentBlock.titleOverride ||
                          assessmentBlock.assessmentState.paperTitle ||
                          "Assessment";
                      }

                      return (
                        <button
                          key={`${section.id}-${group.id}-${groupIndex}`}
                          type="button"
                          onClick={() => scrollToBlock(firstBlock.id)}
                          disabled={isLocked}
                          className={[
                            "app-course-outline-button",
                            isLocked
                              ? "app-course-outline-button-locked"
                              : isActive
                                ? "app-course-outline-button-active"
                                : "",
                          ].join(" ")}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                              {group.type === "lesson"
                                ? "Lesson"
                                : group.type === "announcement"
                                  ? "Announcement"
                                  : "Assessment"}
                            </p>
                            <p className="truncate text-sm font-semibold">{label}</p>
                            {lessonMeta ? (
                              <p className="text-xs text-muted-foreground">{lessonMeta}</p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {isBookmarked ? <Badge variant="outline">Saved</Badge> : null}
                            {isCompleted ? <Badge variant="outline">Done</Badge> : null}
                            {isLocked ? (
                              <Lock className="h-4 w-4" />
                            ) : group.type === "assessment" ? (
                              <Badge variant="outline">
                                {ASSESSMENT_STATUS_LABELS[
                                  (firstBlock as Extract<
                                    StudentCourseDetailBlock,
                                    { type: "assessment" }
                                  >).assessmentState.attemptStatus
                                ]}
                              </Badge>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Next up</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body space-y-2">
              {nextLesson ? (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{nextLesson.title}</p>
                    {nextLesson.estimatedMinutes ? (
                      <p className="text-xs text-muted-foreground">
                        ~{nextLesson.estimatedMinutes} min
                      </p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    className="app-course-action-button"
                    onClick={() => scrollToBlock(nextLesson.blockIds[0])}
                  >
                    Continue this lesson
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  All lessons are complete.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Completion</span>
                <span className="text-muted-foreground">{course.progress.completionPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/20">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{
                    width: `${Math.max(0, Math.min(100, course.progress.completionPercent))}%`,
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {course.metadata.enforceSequentialProgress ? (
                  <Badge variant="outline">Sequential flow</Badge>
                ) : null}
                {course.metadata.allowNotes ? <Badge variant="outline">Notes</Badge> : null}
                {course.metadata.allowBookmarks ? (
                  <Badge variant="outline">Bookmarks</Badge>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {totalLessons > 0 ? (
            <Card className="app-course-block-card">
              <CardHeader className="app-section-header">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>Lesson progress</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {completedLessons} of {totalLessons} lessons complete
                    </p>
                  </div>
                  {resumeBlockId ? (
                    <Button
                      size="sm"
                      className="app-course-action-button"
                      onClick={() => scrollToBlock(resumeBlockId)}
                    >
                      {resumeLesson?.title || "Continue where you left off"}
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="app-section-body space-y-3">
                <div className="h-2 overflow-hidden rounded-full bg-muted/20">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{
                      width: `${Math.max(0, Math.min(100, lessonProgressPct))}%`,
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{lessonProgressPct}% complete</span>
                  {resumeLesson?.estimatedMinutes ? (
                    <span>~{resumeLesson.estimatedMinutes} min next</span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {courseSections.map((section, sectionIndex) => {
            const groups = groupCourseSectionBlocks(section.blocks);
            const sectionBlockCount = section.blocks.length;
            let lessonIndex = 0;

            return (
              <details
                key={section.id}
                open={sectionIndex === 0}
                className="app-course-section"
              >
                <summary className="app-course-section-summary">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Module {sectionIndex + 1}
                    </p>
                    <p className="text-base font-semibold text-foreground">
                      {section.title}
                    </p>
                    {section.summary ? (
                      <p className="text-sm text-muted-foreground">{section.summary}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{sectionBlockCount} blocks</Badge>
                    {sectionTimeSummary.get(section.id)?.estimatedCount ? (
                      <Badge variant="outline">
                        {sectionTimeSummary.get(section.id)!.remainingMinutes > 0
                          ? `${sectionTimeSummary.get(section.id)!.remainingMinutes} min remaining`
                          : "Time complete"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Time not set</Badge>
                    )}
                    <ChevronDown className="app-course-section-icon h-4 w-4" />
                  </div>
                </summary>

                <div className="space-y-3">
                  {groups.map((group) => {
                    if (group.type === "lesson") {
                      lessonIndex += 1;
                      const lessonBlock = group.lessonBlock;
                      const lessonBlocks = group.blocks;
                      const lessonBlockIds = lessonBlock
                        ? [lessonBlock.id]
                        : lessonBlocks.map((block) => block.id);
                      const lessonLocked = lessonBlock
                        ? lessonBlock.isLocked
                        : lessonBlocks.some((block) => block.isLocked);
                      const lessonCompleted = lessonBlock
                        ? lessonBlock.isCompleted
                        : lessonBlocks.every((block) => block.isCompleted);
                      const lessonBookmarked = lessonBlock
                        ? lessonBlock.isBookmarked
                        : lessonBlocks.some((block) => block.isBookmarked);
                      const lessonActionKey = `lesson:${group.id}`;
                      const lessonNoteBlockId = lessonBlock
                        ? lessonBlock.id
                        : getLessonNoteAnchorId(lessonBlocks);
                      const lessonNoteBlock = lessonBlock
                        ? lessonBlock
                        : lessonBlocks.find((block) => block.id === lessonNoteBlockId);
                      const lessonTitle = lessonBlock?.title
                        ? `Lesson ${lessonIndex}: ${lessonBlock.title}`
                        : `Lesson ${lessonIndex}`;
                      const lessonId = lessonBlock?.id || group.id;
                      const nextLessonForThis = nextLessonById.get(lessonId) || null;
                      const lessonContentKey = lessonBlock
                        ? lessonBlock.items
                            .map((item) => {
                              if (item.type === "text") {
                                return `text:${item.contentHtml}`;
                              }
                              if (item.type === "image") {
                                return `image:${item.imageUrl}:${item.caption || ""}`;
                              }
                              if (item.type === "youtube") {
                                return `youtube:${item.videoId}:${item.caption || ""}`;
                              }
                              if (item.type === "resource") {
                                return `resource:${item.fileUrl}:${item.fileName}`;
                              }
                              return "item:unknown";
                            })
                            .join("|")
                        : lessonBlocks
                            .map((block) => {
                              if (block.type === "text") {
                                return `text:${block.contentHtml}`;
                              }
                              if (block.type === "image") {
                                return `image:${block.imageUrl}:${block.caption || ""}`;
                              }
                              if (block.type === "youtube") {
                                return `youtube:${block.videoId}:${block.caption || ""}`;
                              }
                              if (block.type === "resource") {
                                return `resource:${block.fileUrl}:${block.fileName}`;
                              }
                              return "block:unknown";
                            })
                            .join("|");
                      const lessonEstimate =
                        typeof lessonBlock?.estimatedMinutes === "number" &&
                        lessonBlock.estimatedMinutes > 0
                          ? `~${lessonBlock.estimatedMinutes} min`
                          : null;

                      return (
                        <Card
                          key={group.id}
                          ref={(element) => {
                            if (lessonBlock) {
                              sectionRefs.current[lessonBlock.id] = element;
                            }
                          }}
                          data-course-block-id={lessonBlock?.id || undefined}
                          className="app-course-block-card"
                        >
                          <CardHeader className="app-section-header">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="secondary">Lesson</Badge>
                                  {lessonLocked ? (
                                    <Badge variant="outline">Locked</Badge>
                                  ) : null}
                                  {lessonCompleted ? (
                                    <Badge variant="outline">Completed</Badge>
                                  ) : null}
                                </div>
                                <CardTitle>{lessonTitle}</CardTitle>
                                {lessonEstimate ? (
                                  <p className="text-sm text-muted-foreground">
                                    {lessonEstimate}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {course.metadata.allowBookmarks ? (
                                  <Button
                                    variant={lessonBookmarked ? "primary" : "outline"}
                                    size="sm"
                                    onClick={() =>
                                      handleBulkBookmark(
                                        lessonBlockIds,
                                        !lessonBookmarked,
                                        lessonActionKey,
                                      )
                                    }
                                    disabled={busyBlockId === lessonActionKey}
                                    className="app-course-action-button"
                                  >
                                    <Bookmark className="h-4 w-4" />
                                    {lessonBookmarked ? "Saved" : "Save"}
                                  </Button>
                                ) : null}
                                <Button
                                  variant={lessonCompleted ? "primary" : "outline"}
                                  size="sm"
                                  onClick={() =>
                                    handleBulkComplete(
                                      lessonBlockIds,
                                      !lessonCompleted,
                                      lessonActionKey,
                                    )
                                  }
                                  disabled={lessonLocked || busyBlockId === lessonActionKey}
                                  className="app-course-action-button"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  {lessonCompleted ? "Completed" : "Mark complete"}
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="app-section-body space-y-3">
                            {lessonLocked ? (
                              <div className="app-course-panel">
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background">
                                    <Lock className="h-4 w-4" />
                                  </div>
                                  <div className="space-y-1.5">
                                    <p className="text-sm font-semibold text-foreground">
                                      This lesson is locked right now.
                                    </p>
                                    <p className="text-sm leading-6 text-muted-foreground">
                                      {getLockedMessage(course)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            {!lessonLocked ? (
                              <LessonContentPanel
                                lessonId={lessonId}
                                contentKey={lessonContentKey}
                              >
                                {lessonBlock
                                  ? lessonBlock.items.map((item, itemIndex) => (
                                  <div
                                    key={`${lessonBlock.id}-${itemIndex}`}
                                    className="app-course-lesson-block space-y-2"
                                  >
                                        {item.type === "text" ? (
                                          <ContentRenderer
                                            htmlContent={item.contentHtml}
                                            enableImageZoom
                                          />
                                        ) : null}

                                        {item.type === "image" ? (
                                          <CourseImagePanel
                                            imageUrl={item.imageUrl}
                                            altText={item.altText}
                                            caption={item.caption}
                                            displayClasses={getCourseImageDisplayClasses(item)}
                                          />
                                        ) : null}

                                        {item.type === "youtube" ? (
                                          <CourseVideoPanel
                                            videoId={item.videoId}
                                            caption={item.caption}
                                          />
                                        ) : null}

                                        {item.type === "resource" ? (
                                          <CourseResourcePanel
                                            title={item.title}
                                            fileUrl={item.fileUrl}
                                            fileName={item.fileName}
                                            caption={item.caption}
                                          />
                                        ) : null}

                                        {itemIndex < lessonBlock.items.length - 1 ? (
                                          <div className="app-course-lesson-divider" />
                                        ) : null}
                                      </div>
                                    ))
                                  : lessonBlocks.map((block, blockIndex) => (
                                      <div
                                        key={block.id}
                                        ref={(element) => {
                                          sectionRefs.current[block.id] = element;
                                        }}
                                        data-course-block-id={block.id}
                                        className="app-course-lesson-block space-y-3"
                                      >
                                        {block.type === "text" ? (
                                          <ContentRenderer
                                            htmlContent={block.contentHtml}
                                            enableImageZoom
                                          />
                                        ) : null}

                                        {block.type === "image" ? (
                                          <CourseImagePanel
                                            imageUrl={block.imageUrl}
                                            altText={block.altText}
                                            caption={block.caption}
                                            displayClasses={getCourseImageDisplayClasses(block)}
                                          />
                                        ) : null}

                                        {block.type === "youtube" ? (
                                          <CourseVideoPanel
                                            videoId={block.videoId}
                                            caption={block.caption}
                                          />
                                        ) : null}

                                        {block.type === "resource" ? (
                                          <CourseResourcePanel
                                            title={block.title}
                                            fileUrl={block.fileUrl}
                                            fileName={block.fileName}
                                            caption={block.caption}
                                          />
                                        ) : null}

                                        {blockIndex < lessonBlocks.length - 1 ? (
                                          <div className="app-course-lesson-divider" />
                                        ) : null}
                                      </div>
                                    ))}
                              </LessonContentPanel>
                            ) : null}

                            {!lessonLocked ? (
                              <div className="app-course-panel">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="space-y-1">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                      Next up
                                    </p>
                                    <p className="text-sm font-semibold text-foreground">
                                      {nextLessonForThis?.title || "You're all caught up"}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {nextLessonForThis ? (
                                      <Button
                                        size="sm"
                                        className="app-course-action-button"
                                        onClick={() => scrollToBlock(nextLessonForThis.blockIds[0])}
                                        disabled={nextLessonForThis.locked}
                                      >
                                        Next lesson
                                      </Button>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="app-course-action-button"
                                      onClick={() =>
                                        window.scrollTo({ top: 0, behavior: "smooth" })
                                      }
                                    >
                                      Back to top
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            {!lessonLocked && course.metadata.allowNotes && lessonNoteBlockId ? (
                              <div className="app-course-panel space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-foreground">
                                    Lesson notes
                                  </p>
                                  {lessonNoteBlock?.note ? (
                                    <Badge variant="outline">Saved</Badge>
                                  ) : null}
                                </div>
                                <textarea
                                  value={noteDrafts[lessonNoteBlockId] ?? ""}
                                  onChange={(event) =>
                                    setNoteDrafts((current) => ({
                                      ...current,
                                      [lessonNoteBlockId]: event.target.value,
                                    }))
                                  }
                                  rows={4}
                                  className="app-course-note-area"
                                  placeholder="Add your notes for this lesson..."
                                />
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveNote(lessonNoteBlockId)}
                                    disabled={busyBlockId === lessonNoteBlockId}
                                    className="app-course-action-button"
                                  >
                                    {busyBlockId === lessonNoteBlockId ? "Saving..." : "Save Note"}
                                  </Button>
                                  {lessonNoteBlock?.note ||
                                  noteDrafts[lessonNoteBlockId] ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setNoteDrafts((current) => ({
                                          ...current,
                                          [lessonNoteBlockId]: "",
                                        }));
                                        void handleSaveNote(lessonNoteBlockId, "");
                                      }}
                                      disabled={busyBlockId === lessonNoteBlockId}
                                      className="app-course-action-button"
                                    >
                                      Clear Note
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      );
                    }

                    if (group.type === "announcement") {
                      const block = group.blocks[0];

                      return (
                        <Card
                          key={block.id}
                          ref={(element) => {
                            sectionRefs.current[block.id] = element;
                          }}
                          data-course-block-id={block.id}
                          className="app-course-block-card"
                        >
                          <CardHeader className="app-section-header">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="secondary">Announcement</Badge>
                                  {block.isLocked ? (
                                    <Badge variant="outline">Locked</Badge>
                                  ) : null}
                                </div>
                                <CardTitle>{block.title}</CardTitle>
                              </div>
                              {course.metadata.allowBookmarks ? (
                                <Button
                                  variant={block.isBookmarked ? "primary" : "outline"}
                                  size="sm"
                                  onClick={() =>
                                    handleToggleBookmark(block.id, !block.isBookmarked)
                                  }
                                  disabled={busyBlockId === block.id}
                                  className="app-course-action-button"
                                >
                                  <Bookmark className="h-4 w-4" />
                                  {block.isBookmarked ? "Saved" : "Save"}
                                </Button>
                              ) : null}
                            </div>
                          </CardHeader>
                          <CardContent className="app-section-body space-y-3">
                            {block.isLocked ? (
                              <div className="app-course-panel">
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background">
                                    <Lock className="h-4 w-4" />
                                  </div>
                                  <div className="space-y-1.5">
                                    <p className="text-sm font-semibold text-foreground">
                                      This announcement is locked right now.
                                    </p>
                                    <p className="text-sm leading-6 text-muted-foreground">
                                      {getLockedMessage(course)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            {!block.isLocked ? (
                              <div className="app-course-panel">
                                <div className="mb-3 flex flex-wrap gap-2">
                                  <Badge variant="outline" className="capitalize">
                                    {block.tone}
                                  </Badge>
                                </div>
                                <ContentRenderer htmlContent={block.contentHtml} enableImageZoom />
                              </div>
                            ) : null}

                            {!block.isLocked && course.metadata.allowNotes ? (
                              <div className="app-course-panel space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-foreground">Your notes</p>
                                  {block.note ? <Badge variant="outline">Saved</Badge> : null}
                                </div>
                                <textarea
                                  value={noteDrafts[block.id] ?? ""}
                                  onChange={(event) =>
                                    setNoteDrafts((current) => ({
                                      ...current,
                                      [block.id]: event.target.value,
                                    }))
                                  }
                                  rows={4}
                                  className="app-course-note-area"
                                  placeholder="Add your notes for this block..."
                                />
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveNote(block.id)}
                                    disabled={busyBlockId === block.id}
                                    className="app-course-action-button"
                                  >
                                    {busyBlockId === block.id ? "Saving..." : "Save Note"}
                                  </Button>
                                  {block.note || noteDrafts[block.id] ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setNoteDrafts((current) => ({
                                          ...current,
                                          [block.id]: "",
                                        }));
                                        void handleSaveNote(block.id, "");
                                      }}
                                      disabled={busyBlockId === block.id}
                                      className="app-course-action-button"
                                    >
                                      Clear Note
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      );
                    }

                    const block = group.blocks[0];

                    return (
                      <Card
                        key={block.id}
                        ref={(element) => {
                          sectionRefs.current[block.id] = element;
                        }}
                        data-course-block-id={block.id}
                        className="app-course-block-card"
                      >
                        <CardHeader className="app-section-header">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">Assessment</Badge>
                                {block.required !== false ? (
                                  <Badge variant="outline">Required</Badge>
                                ) : null}
                                {block.isLocked ? (
                                  <Badge variant="outline">Locked</Badge>
                                ) : null}
                              </div>
                              <CardTitle>
                                {block.titleOverride || block.assessmentState.paperTitle}
                              </CardTitle>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="app-section-body space-y-3">
                          {block.isLocked ? (
                            <div className="app-course-panel">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background">
                                  <Lock className="h-4 w-4" />
                                </div>
                                <div className="space-y-1.5">
                                  <p className="text-sm font-semibold text-foreground">
                                    This assessment is locked right now.
                                  </p>
                                  <p className="text-sm leading-6 text-muted-foreground">
                                    {getLockedMessage(course)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {!block.isLocked ? (
                            <div className="space-y-3">
                              <div className="app-course-panel">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="space-y-2">
                                    <p className="text-sm font-semibold text-foreground">
                                      {block.assessmentState.paperTitle}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      <Badge variant="outline">
                                        {
                                          ASSESSMENT_STATUS_LABELS[
                                            block.assessmentState.attemptStatus
                                          ]
                                        }
                                      </Badge>
                                      {typeof block.assessmentState.scorePct === "number" ? (
                                        <Badge variant="outline">
                                          {block.assessmentState.scorePct}%
                                        </Badge>
                                      ) : null}
                                      {typeof block.assessmentState.minimumScorePct === "number" ? (
                                        <Badge variant="outline">
                                          Minimum {block.assessmentState.minimumScorePct}%
                                        </Badge>
                                      ) : null}
                                    </div>
                                    {block.assessmentState.requiresManualReview ? (
                                      <p className="text-sm text-muted-foreground">
                                        Manual review may still be pending after submission.
                                      </p>
                                    ) : null}
                                    {block.assessmentState.minimumScorePct &&
                                    block.assessmentState.attemptStatus !== "in_progress" &&
                                    !block.assessmentState.meetsMinimumScore ? (
                                      <p className="text-sm text-amber-700 dark:text-amber-300">
                                        This assessment needs at least {block.assessmentState.minimumScorePct}% to count as complete.
                                      </p>
                                    ) : null}
                                  </div>
                                  <AssessmentActionButtons block={block} />
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {!block.isLocked && course.metadata.allowNotes ? (
                            <div className="app-course-panel space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-foreground">Your notes</p>
                                {block.note ? <Badge variant="outline">Saved</Badge> : null}
                              </div>
                              <textarea
                                value={noteDrafts[block.id] ?? ""}
                                onChange={(event) =>
                                  setNoteDrafts((current) => ({
                                    ...current,
                                    [block.id]: event.target.value,
                                  }))
                                }
                                rows={4}
                                className="app-course-note-area"
                                placeholder="Add your notes for this block..."
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveNote(block.id)}
                                  disabled={busyBlockId === block.id}
                                  className="app-course-action-button"
                                >
                                  {busyBlockId === block.id ? "Saving..." : "Save Note"}
                                </Button>
                                {block.note || noteDrafts[block.id] ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setNoteDrafts((current) => ({
                                        ...current,
                                        [block.id]: "",
                                      }));
                                      void handleSaveNote(block.id, "");
                                    }}
                                    disabled={busyBlockId === block.id}
                                    className="app-course-action-button"
                                  >
                                    Clear Note
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}
