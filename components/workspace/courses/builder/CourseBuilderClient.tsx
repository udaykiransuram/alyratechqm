"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  BookOpen,
  CheckCircle2,
  Clock3,
  Eye,
  FileQuestion,
  FileText,
  ImageIcon,
  Link2,
  Plus,
  Save,
  Settings2,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  buildCourseBuilderOutlineEntries,
  buildEmptyCourseBuilderBlock,
  createEmptyLessonItem,
  deriveInitialCourseSubjectIds,
  duplicateCourseBuilderLesson,
  ensureSeededCourseBuilderBlocks,
  formatDateTimeLocalInput,
  getModuleContextForLesson,
  isCourseBuilderScopeComplete,
  mapInitialCourseBlocks,
  moveCourseBuilderLessonToAdjacentModule,
  moveCourseBuilderLessonWithinModule,
  moveCourseBuilderTopLevelBlock,
  removeCourseBuilderBlockWithFallback,
  type EditableAnnouncementBlock,
  type EditableAssessmentBlock,
  type EditableCourseBlock,
  type EditableLessonBlock,
  type EditableLessonImageItem,
  type EditableLessonItem,
  type EditableLessonResourceItem,
  type EditableLessonTextItem,
  type EditableLessonYoutubeItem,
  type EditableModuleBlock,
} from "@/lib/courses/course-builder";
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

type BuilderStepKey = "scope" | "curriculum" | "review";

type InlineErrorMap = {
  title: string;
  classId: string;
  subjects: string;
  blocks: Record<
    string,
    {
      title?: string;
      summary?: string;
      items?: string;
      assessment?: string;
      minimumScore?: string;
      itemErrors?: Record<string, string>;
    }
  >;
};

const BUILDER_STEPS: Array<{
  key: BuilderStepKey;
  label: string;
  note: string;
}> = [
  {
    key: "scope",
    label: "Scope",
    note: "Title, class, sections, and subjects",
  },
  {
    key: "curriculum",
    label: "Curriculum",
    note: "Outline, lessons, and special blocks",
  },
  {
    key: "review",
    label: "Review & Publish",
    note: "Validation, preview, and release",
  },
];

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

function getBlockTypeLabel(block: EditableCourseBlock) {
  switch (block.type) {
    case "module":
      return "Module";
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
    return params.saving ? "Saving draft..." : "Save draft";
  }

  if (params.saving) {
    return params.mode === "edit" ? "Publishing course..." : "Creating course...";
  }

  return params.mode === "edit" ? "Publish course" : "Create course";
}

function getBlockIcon(block: EditableCourseBlock) {
  switch (block.type) {
    case "module":
      return BookOpen;
    case "lesson":
      return FileText;
    case "announcement":
      return Bell;
    case "assessment":
      return FileQuestion;
  }
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
  children: ReactNode;
  className?: string;
}) {
  const hintClassName =
    hintTone === "error"
      ? "text-xs leading-5 text-rose-600"
      : "text-xs leading-5 text-muted-foreground";

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
  description,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-[4.25rem] items-center justify-between gap-4 rounded-[1.05rem] border border-border/70 bg-muted/10 px-4 py-3 transition-colors",
        disabled
          ? "cursor-not-allowed opacity-70"
          : "cursor-pointer hover:border-primary/25 hover:bg-muted/20",
      )}
    >
      <span className="space-y-1 pr-2">
        <span className="block text-sm font-semibold leading-5 text-foreground">{label}</span>
        {description ? (
          <span className="block text-xs leading-5 text-muted-foreground">{description}</span>
        ) : null}
      </span>
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
        Curriculum preview appears here once the builder has content.
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
                    ? block.title || "Module"
                    : block.type === "lesson"
                      ? block.title || "Lesson"
                      : block.type === "announcement"
                        ? block.title || "Announcement"
                        : block.titleOverride ||
                          paperOptionsById.get(block.questionPaperId)?.title ||
                          "Assessment"}
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
                {block.summary || "Module summary goes here."}
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

function CourseBuilderStepper({
  activeStep,
  onStepChange,
  scopeComplete,
  curriculumReady,
  reviewReady,
}: {
  activeStep: BuilderStepKey;
  onStepChange: (step: BuilderStepKey) => void;
  scopeComplete: boolean;
  curriculumReady: boolean;
  reviewReady: boolean;
}) {
  const canOpenStep = (step: BuilderStepKey) => {
    if (step === "scope") {
      return true;
    }
    if (step === "curriculum") {
      return scopeComplete;
    }
    return scopeComplete && curriculumReady;
  };

  const isComplete = (step: BuilderStepKey) => {
    if (step === "scope") {
      return scopeComplete;
    }
    if (step === "curriculum") {
      return curriculumReady;
    }
    return reviewReady;
  };

  return (
    <div className="rounded-[1.4rem] border border-border/70 bg-[hsl(var(--app-surface-1)/0.96)] p-3 shadow-[0_24px_44px_-36px_hsl(var(--app-shadow-deep)/0.18)]">
      <div className="grid gap-2 lg:grid-cols-3">
        {BUILDER_STEPS.map((step, index) => {
          const active = activeStep === step.key;
          const complete = isComplete(step.key);
          const disabled = !canOpenStep(step.key);

          return (
            <button
              key={step.key}
              type="button"
              onClick={() => onStepChange(step.key)}
              disabled={disabled}
              className={cn(
                "group flex min-h-[5rem] items-start gap-3 rounded-[1.15rem] border px-4 py-3 text-left transition",
                active
                  ? "border-primary/28 bg-primary/8 shadow-[0_20px_30px_-32px_hsl(var(--primary)/0.28)]"
                  : "border-border/60 bg-background/60 hover:border-primary/16 hover:bg-[hsl(var(--app-surface-2)/0.72)]",
                disabled && "cursor-not-allowed opacity-55 hover:border-border/60 hover:bg-background/60",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                  complete
                    ? "border-primary/30 bg-primary text-primary-foreground"
                    : active
                      ? "border-primary/24 bg-primary/12 text-primary"
                      : "border-border/70 bg-background text-muted-foreground",
                )}
              >
                {complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{step.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CourseSettingsDrawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coverImageUrl: string;
  setCoverImageUrl: (value: string) => void;
  coverImageAltText: string;
  setCoverImageAltText: (value: string) => void;
  startsAt: string;
  setStartsAt: (value: string) => void;
  dueAt: string;
  setDueAt: (value: string) => void;
  completionBadgeLabel: string;
  setCompletionBadgeLabel: (value: string) => void;
  enforceSequentialProgress: boolean;
  setEnforceSequentialProgress: (value: boolean) => void;
  allowNotes: boolean;
  setAllowNotes: (value: boolean) => void;
  allowBookmarks: boolean;
  setAllowBookmarks: (value: boolean) => void;
  isTemplate: boolean;
  setIsTemplate: (value: boolean) => void;
  templateToggleLocked: boolean;
  uploadingImageTarget: string | null;
  handleCoverImageUpload: (file: File | null) => Promise<void>;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Advanced course settings</DialogTitle>
          <DialogDescription>
            Keep the default flow light here and open these settings only when needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <FormField label="Cover image">
              <div className="space-y-3">
                <Input
                  value={props.coverImageUrl}
                  onChange={(event) => props.setCoverImageUrl(event.target.value)}
                  placeholder="https://example.com/course-cover.webp"
                  aria-label="Course cover image"
                />
                <FilePickerField
                  id="course-cover-image"
                  label="Course cover upload"
                  hideLabel
                  buttonLabel="Upload cover"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
                  placeholder="No cover selected"
                  selectedFileName={
                    props.uploadingImageTarget === "cover" ? "Uploading..." : null
                  }
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    event.target.value = "";
                    void props.handleCoverImageUpload(file);
                  }}
                />
                {props.uploadingImageTarget === "cover" ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner />
                    Uploading cover image...
                  </div>
                ) : null}
              </div>
            </FormField>

            <FormField label="Cover image alt text">
              <Input
                value={props.coverImageAltText}
                onChange={(event) => props.setCoverImageAltText(event.target.value)}
                placeholder="Describe the cover image"
                aria-label="Course cover image alt text"
              />
            </FormField>
          </div>

          {props.coverImageUrl ? (
            <div className="app-course-media-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={props.coverImageUrl}
                alt={props.coverImageAltText || "Course cover preview"}
                className="h-[220px] w-full object-cover"
              />
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            <FormField label="Starts at">
              <Input
                type="datetime-local"
                value={props.startsAt}
                onChange={(event) => props.setStartsAt(event.target.value)}
                aria-label="Course starts at"
              />
            </FormField>
            <FormField label="Due at">
              <Input
                type="datetime-local"
                value={props.dueAt}
                onChange={(event) => props.setDueAt(event.target.value)}
                aria-label="Course due at"
              />
            </FormField>
            <FormField label="Completion badge">
              <Input
                value={props.completionBadgeLabel}
                onChange={(event) => props.setCompletionBadgeLabel(event.target.value)}
                placeholder="Course complete"
                aria-label="Completion badge label"
              />
            </FormField>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ToggleRow
              checked={props.enforceSequentialProgress}
              onCheckedChange={props.setEnforceSequentialProgress}
              label="Sequential progression"
              description="Students complete the curriculum in order."
            />
            <ToggleRow
              checked={props.templateToggleLocked ? true : props.isTemplate}
              onCheckedChange={props.setIsTemplate}
              label="Save as reusable template"
              description="Keep this structure ready for future courses."
              disabled={props.templateToggleLocked}
            />
            <ToggleRow
              checked={props.allowNotes}
              onCheckedChange={props.setAllowNotes}
              label="Allow student notes"
              description="Students can save notes while reading lessons."
            />
            <ToggleRow
              checked={props.allowBookmarks}
              onCheckedChange={props.setAllowBookmarks}
              label="Allow student bookmarks"
              description="Students can bookmark blocks for later review."
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CourseScopeStep(props: {
  title: string;
  setTitle: (value: string) => void;
  summary: string;
  setSummary: (value: string) => void;
  classId: string;
  setClassId: (value: string) => void;
  classOptions: SearchableCommandOption[];
  sectionOptions: SearchableCommandOption[];
  selectedSubjectIds: string[];
  setSelectedSubjectIds: (value: string[]) => void;
  subjectOptions: SearchableCommandOption[];
  assignedSectionIds: string[];
  setAssignedSectionIds: (value: string[]) => void;
  sectionsDisabled: boolean;
  selectedClassName: string;
  selectedSubjectNames: string[];
  selectedSectionNames: string[];
  inlineErrors: InlineErrorMap;
  onScopeClassChange: (value: string) => void;
  onScopeClassClear: () => void;
  onOpenSettings: () => void;
}) {
  const readyItems = [
    {
      label: "Title",
      complete: Boolean(props.title.trim()),
      note: props.title.trim() ? props.title.trim() : "Add a clear course title.",
    },
    {
      label: "Class",
      complete: Boolean(props.classId),
      note: props.classId ? props.selectedClassName : "Choose the class this course belongs to.",
    },
    {
      label: "Subjects",
      complete: props.selectedSubjectIds.length > 0,
      note:
        props.selectedSubjectNames.length > 0
          ? props.selectedSubjectNames.join(", ")
          : "Select at least one subject.",
    },
  ];

  return (
    <Card className="app-surface overflow-hidden">
      <CardHeader className="app-section-header">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle>Scope</CardTitle>
            <p className="text-sm text-muted-foreground">
              Fill the essentials first. Everything else stays out of the way.
            </p>
          </div>
          <Button variant="outline" onClick={props.onOpenSettings}>
            <Settings2 className="h-4 w-4" />
            Course settings
          </Button>
        </div>
      </CardHeader>
      <CardContent className="app-section-body space-y-6">
        <FormField
          label="Course title"
          hint={props.inlineErrors.title || undefined}
          hintTone={props.inlineErrors.title ? "error" : "muted"}
        >
          <Input
            value={props.title}
            onChange={(event) => props.setTitle(event.target.value)}
            placeholder="Diagnostic Foundations"
            aria-label="Course title"
          />
        </FormField>

        <FormField label="Course summary">
          <Textarea
            value={props.summary}
            onChange={(event) => props.setSummary(event.target.value)}
            placeholder="What students will learn in this course."
            className="min-h-[128px]"
            aria-label="Course summary"
          />
        </FormField>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <FormField
            label="Class"
            hint={props.inlineErrors.classId || undefined}
            hintTone={props.inlineErrors.classId ? "error" : "muted"}
          >
            <SearchableCommandSelect
              value={props.classId}
              options={props.classOptions}
              onValueChange={props.onScopeClassChange}
              placeholder="Select class"
              searchPlaceholder="Search classes..."
              emptyText="No classes found."
              clearLabel="Clear"
              onClear={props.onScopeClassClear}
              showCloseAction
            />
          </FormField>
          <FormField label="Assigned sections">
            <SearchableMultiSelectPopover
              selectedValues={props.assignedSectionIds}
              options={props.sectionOptions}
              onSelectedValuesChange={props.setAssignedSectionIds}
              placeholder="Whole class or selected sections"
              noOptionsText={
                props.sectionsDisabled
                  ? "Select a class first."
                  : "No sections available for this class."
              }
              disabled={props.sectionsDisabled}
            />
          </FormField>
        </div>

        <FormField
          label="Subjects"
          hint={props.inlineErrors.subjects || undefined}
          hintTone={props.inlineErrors.subjects ? "error" : "muted"}
        >
          <SearchableMultiSelectPopover
            selectedValues={props.selectedSubjectIds}
            options={props.subjectOptions}
            onSelectedValuesChange={props.setSelectedSubjectIds}
            placeholder="Select subjects"
            noOptionsText="No subjects available."
          />
        </FormField>

        <div className="rounded-[1rem] border border-border/60 bg-background/70 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {readyItems.map((item) => (
              <Badge key={item.label} variant={item.complete ? "secondary" : "outline"}>
                {item.complete ? `${item.label} ready` : `${item.label} needed`}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {props.classId ? props.selectedClassName : "Select class"} •{" "}
            {props.selectedSubjectNames.length > 0
              ? props.selectedSubjectNames.join(", ")
              : "Choose subject"} •{" "}
            {props.selectedSectionNames.length > 0
              ? props.selectedSectionNames.join(", ")
              : "All sections"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CourseBuilderInspector(props: {
  block: EditableCourseBlock | null;
  selectedItem: EditableLessonItem | null;
  selectedBlockError?: InlineErrorMap["blocks"][string];
  paperOptions: SearchableCommandOption[];
  paperOptionsById: Map<string, WorkspaceCoursePaperOption>;
  currentEditorPath: string;
  onUpdateBlock: <T extends EditableCourseBlock>(
    blockId: string,
    updater: (block: T) => T,
  ) => void;
  onUpdateLessonItem: <T extends EditableLessonItem>(
    blockId: string,
    itemId: string,
    updater: (item: T) => T,
  ) => void;
  onDeleteSelectedBlock: () => void;
  onDuplicateLesson: () => void;
  onMoveLessonToPrevModule: () => void;
  onMoveLessonToNextModule: () => void;
  canMoveLessonToPrevModule: boolean;
  canMoveLessonToNextModule: boolean;
  firstAssessment: boolean;
}) {
  if (!props.block) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">Block settings</p>
        <p className="text-sm text-muted-foreground">
          Select a module, lesson, or special block to manage advanced settings.
        </p>
      </div>
    );
  }

  const block = props.block;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Block settings</p>
        <p className="text-sm text-muted-foreground">
          Advanced controls stay here so the main canvas stays simple.
        </p>
      </div>

      {props.selectedBlockError ? (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          {props.selectedBlockError.title ||
            props.selectedBlockError.summary ||
            props.selectedBlockError.items ||
            props.selectedBlockError.assessment ||
            props.selectedBlockError.minimumScore ||
            "This block still needs attention."}
        </div>
      ) : null}

      {block.type === "lesson" ? (
        <div className="space-y-4">
          <FormField label="Estimated time (minutes)">
            <Input
              type="number"
              min="0"
              max="600"
              step="1"
              value={block.estimatedMinutes}
              onChange={(event) =>
                props.onUpdateBlock<EditableLessonBlock>(block.id, (currentBlock) => ({
                  ...currentBlock,
                  estimatedMinutes: event.target.value,
                }))
              }
              placeholder="15"
              aria-label="Lesson estimated time"
            />
          </FormField>

          <div className="grid gap-2">
            <Button variant="outline" onClick={props.onDuplicateLesson}>
              Duplicate lesson
            </Button>
            <Button
              variant="outline"
              onClick={props.onMoveLessonToPrevModule}
              disabled={!props.canMoveLessonToPrevModule}
            >
              Move to previous module
            </Button>
            <Button
              variant="outline"
              onClick={props.onMoveLessonToNextModule}
              disabled={!props.canMoveLessonToNextModule}
            >
              Move to next module
            </Button>
          </div>

          {props.selectedItem?.type === "image" ? (
            <div className="space-y-4 rounded-[1rem] border border-border/65 bg-background/70 p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Image display</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Tune how the selected image appears to students.
                </p>
              </div>
              <FormField label="Image fit">
                <Select
                  value={props.selectedItem.imageFit}
                  onValueChange={(value) =>
                    props.onUpdateLessonItem<EditableLessonImageItem>(
                      block.id,
                      props.selectedItem!.id,
                      (item) => ({
                        ...item,
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
                  value={props.selectedItem.imageWidth}
                  onValueChange={(value) =>
                    props.onUpdateLessonItem<EditableLessonImageItem>(
                      block.id,
                      props.selectedItem!.id,
                      (item) => ({
                        ...item,
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
                  value={props.selectedItem.imageHeight}
                  onValueChange={(value) =>
                    props.onUpdateLessonItem<EditableLessonImageItem>(
                      block.id,
                      props.selectedItem!.id,
                      (item) => ({
                        ...item,
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
          ) : null}
        </div>
      ) : null}

      {block.type === "announcement" ? (
        <div className="space-y-4">
          <FormField label="Tone">
            <Select
              value={block.tone}
              onValueChange={(value) =>
                props.onUpdateBlock<EditableAnnouncementBlock>(block.id, (currentBlock) => ({
                  ...currentBlock,
                  tone: value as CourseAnnouncementTone,
                }))
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
      ) : null}

      {block.type === "assessment" ? (
        <div className="space-y-4">
          <FormField
            label="Linked question paper"
            hint={props.selectedBlockError?.assessment}
            hintTone={props.selectedBlockError?.assessment ? "error" : "muted"}
          >
            <SearchableCommandSelect
              value={block.questionPaperId}
              options={props.paperOptions}
              onValueChange={(value) =>
                props.onUpdateBlock<EditableAssessmentBlock>(block.id, (currentBlock) => ({
                  ...currentBlock,
                  questionPaperId: value,
                }))
              }
              placeholder="Select question paper"
              searchPlaceholder="Search papers..."
              emptyText="No matching papers found."
              clearLabel="Clear"
              onClear={() =>
                props.onUpdateBlock<EditableAssessmentBlock>(block.id, (currentBlock) => ({
                  ...currentBlock,
                  questionPaperId: "",
                }))
              }
              showCloseAction
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <AppPrefetchLink
                  href={buildHrefWithReturnTo(
                    "/workspace/question-papers/create",
                    `${props.currentEditorPath}${
                      props.currentEditorPath.includes("?") ? "&" : "?"
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
                      props.currentEditorPath,
                    )}
                  >
                    Edit selected paper
                  </AppPrefetchLink>
                </Button>
              ) : null}
            </div>
          </FormField>

          <FormField
            label="Minimum score %"
            hint={props.selectedBlockError?.minimumScore}
            hintTone={props.selectedBlockError?.minimumScore ? "error" : "muted"}
          >
            <Input
              type="number"
              min="0"
              max="100"
              step="1"
              value={block.minimumScorePct}
              onChange={(event) =>
                props.onUpdateBlock<EditableAssessmentBlock>(block.id, (currentBlock) => ({
                  ...currentBlock,
                  minimumScorePct: event.target.value,
                }))
              }
              placeholder="70"
              aria-label="Assessment minimum score"
            />
          </FormField>

          <FormField label="Requirement">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={block.required ? "primary" : "outline"}
                className="flex-1"
                onClick={() =>
                  props.onUpdateBlock<EditableAssessmentBlock>(block.id, (currentBlock) => ({
                    ...currentBlock,
                    required: true,
                  }))
                }
              >
                Required
              </Button>
              <Button
                variant={!block.required ? "primary" : "outline"}
                className="flex-1"
                onClick={() =>
                  props.onUpdateBlock<EditableAssessmentBlock>(block.id, (currentBlock) => ({
                    ...currentBlock,
                    required: false,
                  }))
                }
              >
                Optional
              </Button>
            </div>
          </FormField>

          {block.questionPaperId ? (
            <div className="rounded-[1rem] border border-border/65 bg-background/70 p-4">
              {props.paperOptionsById.get(block.questionPaperId) ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {props.paperOptionsById.get(block.questionPaperId)?.onlineEnabled
                        ? "Online ready"
                        : "Unavailable"}
                    </Badge>
                    {props.paperOptionsById
                      .get(block.questionPaperId)
                      ?.subjects.map((subject) => (
                        <Badge key={subject._id} variant="outline">
                          {subject.name}
                        </Badge>
                      ))}
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {props.paperOptionsById.get(block.questionPaperId)?.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {props.paperOptionsById.get(block.questionPaperId)?.duration} min •{" "}
                    {props.paperOptionsById.get(block.questionPaperId)?.totalMarks} marks
                  </p>
                </div>
              ) : (
                <p className="text-sm text-amber-700">
                  This linked paper no longer matches the chosen class, subject, or sections.
                </p>
              )}
            </div>
          ) : null}

          {props.firstAssessment ? (
            <p className="text-xs text-muted-foreground">
              This assessment will also appear in the student tests list.
            </p>
          ) : null}
        </div>
      ) : null}

      <Button variant="destructive" onClick={props.onDeleteSelectedBlock}>
        <Trash2 className="h-4 w-4" />
        Delete {getBlockTypeLabel(block).toLowerCase()}
      </Button>
    </div>
  );
}

function CourseReviewStep(props: {
  blocks: EditableCourseBlock[];
  paperOptionsById: Map<string, WorkspaceCoursePaperOption>;
  selectedClassName: string;
  selectedSectionSummary: string;
  selectedSubjectNames: string[];
  startsAt: string;
  dueAt: string;
  blockCounts: Record<string, number>;
  requiredAssessmentCount: number;
  enforceSequentialProgress: boolean;
  allowNotes: boolean;
  allowBookmarks: boolean;
  isTemplate: boolean;
  completionBadgeLabel: string;
  publishValidationMessage: string | null;
  setupComplete: boolean;
  buildComplete: boolean;
}) {
  const validationRows = [
    {
      label: "Scope is complete",
      pass: props.setupComplete,
      note: props.setupComplete
        ? "Title, class, and subject scope are ready."
        : "Add a title, class, and at least one subject before publishing.",
    },
    {
      label: "Curriculum has structure",
      pass: props.buildComplete,
      note: props.buildComplete
        ? "At least one module and one lesson are in place."
        : "The builder needs at least one module and one lesson.",
    },
    {
      label: "Publish validation",
      pass: props.publishValidationMessage === null,
      note: props.publishValidationMessage || "No publish-blocking issues found.",
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[21rem_minmax(0,1fr)]">
      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Review</CardTitle>
        </CardHeader>
        <CardContent className="app-section-body space-y-4">
          <div className="space-y-3">
            {validationRows.map((row) => (
              <div
                key={row.label}
                className="flex items-start gap-3 rounded-[1rem] border border-border/60 bg-background/70 px-3.5 py-3"
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                    row.pass
                      ? "border-primary/30 bg-primary text-primary-foreground"
                      : "border-rose-200 bg-rose-50 text-rose-600",
                  )}
                >
                  {row.pass ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{row.label}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{row.note}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[1rem] border border-border/60 bg-background/70 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Scope
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{props.selectedClassName}</p>
            <p className="text-sm text-muted-foreground">{props.selectedSectionSummary}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {props.selectedSubjectNames.map((subjectName) => (
                <Badge key={subjectName} variant="outline">
                  {subjectName}
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-[1rem] border border-border/60 bg-background/70 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Course summary
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">{props.blocks.length} blocks</Badge>
              <Badge variant="outline">{props.requiredAssessmentCount} required assessments</Badge>
              {props.enforceSequentialProgress ? (
                <Badge variant="outline">Sequential flow</Badge>
              ) : null}
              {props.allowNotes ? <Badge variant="outline">Notes enabled</Badge> : null}
              {props.allowBookmarks ? <Badge variant="outline">Bookmarks enabled</Badge> : null}
              {props.isTemplate ? <Badge variant="outline">Template</Badge> : null}
              {props.completionBadgeLabel ? (
                <Badge variant="outline">{props.completionBadgeLabel}</Badge>
              ) : null}
              <Badge variant="outline">
                {props.startsAt ? `Starts ${props.startsAt.replace("T", " ")}` : "Starts immediately"}
              </Badge>
              <Badge variant="outline">
                {props.dueAt ? `Due ${props.dueAt.replace("T", " ")}` : "No due date"}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(props.blockCounts)
                .filter(([, count]) => count > 0)
                .map(([type, count]) => (
                  <Badge key={type} variant="secondary">
                    {count} {type}
                  </Badge>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="app-section-body">
          <CoursePreview blocks={props.blocks} paperOptionsById={props.paperOptionsById} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function CourseBuilderClient({
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
    deriveInitialCourseSubjectIds(initialCourse),
  );
  const [assignedSectionIds, setAssignedSectionIds] = useState<string[]>(
    Array.isArray(initialCourse?.assignedAcademicSections)
      ? initialCourse.assignedAcademicSections.map((section) => section._id)
      : [],
  );
  const [blocks, setBlocks] = useState<EditableCourseBlock[]>(
    mapInitialCourseBlocks(initialCourse),
  );
  const [activeStep, setActiveStep] = useState<BuilderStepKey>("scope");
  const [selectedBlockId, setSelectedBlockId] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [savingTarget, setSavingTarget] = useState<"draft" | "published" | null>(null);
  const [uploadingImageTarget, setUploadingImageTarget] = useState<string | null>(null);
  const [uploadingFileBlockId, setUploadingFileBlockId] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [autosaveMessage, setAutosaveMessage] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileOutlineOpen, setMobileOutlineOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
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

  const subjectOptions = useMemo<SearchableCommandOption[]>(
    () =>
      subjects.map((subject) => ({
        value: subject._id,
        label: subject.name,
        description: subject.code || subject.description,
      })),
    [subjects],
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

          const linkedPaper = papers.find((paper) => paper._id === block.questionPaperId);
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
      currentBlocks.map((block) => (block.id === blockId ? updater(block as T) : block)),
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
          items: block.items.map((item) => (item.id === itemId ? updater(item as T) : item)),
        };
      }),
    );
  };

  const ensureSelectedBlock = useCallback((nextBlocks: EditableCourseBlock[]) => {
    if (nextBlocks.length === 0) {
      setSelectedBlockId("");
      setSelectedItemId("");
      return;
    }

    setSelectedBlockId((current) =>
      nextBlocks.some((block) => block.id === current)
        ? current
        : nextBlocks.find((block) => block.type === "lesson")?.id || nextBlocks[0]!.id,
    );
  }, []);

  useEffect(() => {
    ensureSelectedBlock(blocks);
  }, [blocks, ensureSelectedBlock]);

  const selectedBlock = useMemo(
    () => blocks.find((block) => block.id === selectedBlockId) || null,
    [blocks, selectedBlockId],
  );

  useEffect(() => {
    if (!selectedBlock) {
      setSelectedItemId("");
      return;
    }

    if (selectedBlock.type !== "lesson") {
      setSelectedItemId("");
      return;
    }

    if (
      selectedItemId &&
      selectedBlock.items.some((item) => item.id === selectedItemId)
    ) {
      return;
    }

    setSelectedItemId(selectedBlock.items[0]?.id || "");
  }, [selectedBlock, selectedItemId]);

  const selectedItem =
    selectedBlock?.type === "lesson"
      ? selectedBlock.items.find((item) => item.id === selectedItemId) || null
      : null;

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

  const validateBeforeSave = useCallback(
    (targetStatus: "draft" | "published") => {
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
          return "Every module block needs a title.";
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
    },
    [blocks, classId, dueAt, selectedSubjectIds.length, startsAt, title],
  );

  const canAutosave = isCourseBuilderScopeComplete({
    title,
    classId,
    selectedSubjectIds,
  });

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
        setAutosaveMessage(error instanceof Error ? error.message : "Autosave failed.");
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
    buildCoursePayload,
    canAutosave,
    courseId,
    mode,
    returnToPath,
    router,
    saving,
  ]);

  const handleSubmit = async (targetStatus: "draft" | "published") => {
    const validationMessage = validateBeforeSave(targetStatus);
    if (validationMessage) {
      setFormError(validationMessage);
      if (targetStatus === "published") {
        setActiveStep("review");
      }
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
      setFormError(error instanceof Error ? error.message : "We couldn't save the course.");
    } finally {
      setSavingTarget(null);
    }
  };

  const inlineErrors = useMemo<InlineErrorMap>(() => {
    const blockErrors: InlineErrorMap["blocks"] = {};

    blocks.forEach((block, index) => {
      if (block.type === "module") {
        let hasLesson = false;
        for (let nextIndex = index + 1; nextIndex < blocks.length; nextIndex += 1) {
          const nextBlock = blocks[nextIndex];
          if (nextBlock.type === "module" || nextBlock.type === "announcement" || nextBlock.type === "assessment") {
            break;
          }
          if (nextBlock.type === "lesson") {
            hasLesson = true;
            break;
          }
        }
        if (!block.title.trim()) {
          blockErrors[block.id] = { title: "Module title is required." };
        }
        if (!hasLesson) {
          blockErrors[block.id] = {
            ...(blockErrors[block.id] || {}),
            summary: "Add at least one lesson to this module.",
          };
        }
      }

      if (block.type === "lesson") {
        const itemErrors: Record<string, string> = {};
        const moduleContext = getModuleContextForLesson(blocks, block.id);

        if (!moduleContext) {
          blockErrors[block.id] = {
            ...(blockErrors[block.id] || {}),
            summary: "Move this lesson under a module.",
          };
        }
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
      subjects: selectedSubjectIds.length === 0 ? "Select at least one subject." : "",
      blocks: blockErrors,
    };
  }, [blocks, classId, selectedSubjectIds, title]);

  const publishValidationMessage = useMemo(
    () => validateBeforeSave("published"),
    [validateBeforeSave],
  );

  const setupComplete = isCourseBuilderScopeComplete({
    title,
    classId,
    selectedSubjectIds,
  });
  const buildComplete =
    blocks.some((block) => block.type === "module") &&
    blocks.some((block) => block.type === "lesson");
  const reviewReady = publishValidationMessage === null;

  const blockCounts = blocks.reduce<Record<string, number>>((counts, block) => {
    counts[block.type] = (counts[block.type] || 0) + 1;
    return counts;
  }, {});

  const requiredAssessmentCount = blocks.filter(
    (block) => block.type === "assessment" && block.required !== false,
  ).length;

  const firstAssessmentIndex = useMemo(
    () => blocks.findIndex((block) => block.type === "assessment"),
    [blocks],
  );

  useEffect(() => {
    if (activeStep !== "curriculum") {
      return;
    }

    setBlocks((currentBlocks) => {
      if (currentBlocks.length > 0) {
        return currentBlocks;
      }

      const seededBlocks = ensureSeededCourseBuilderBlocks(currentBlocks);
      const firstLessonId =
        seededBlocks.find((block) => block.type === "lesson")?.id || seededBlocks[0]?.id || "";
      setSelectedBlockId(firstLessonId);
      return seededBlocks;
    });
  }, [activeStep]);

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

  const handleStepChange = (step: BuilderStepKey) => {
    if (step === "curriculum" && !setupComplete) {
      setFormError("Add a title, class, and at least one subject before building curriculum.");
      return;
    }
    if (step === "review" && (!setupComplete || !buildComplete)) {
      setFormError("Complete the scope and curriculum before reviewing the course.");
      return;
    }
    setFormError(null);
    setActiveStep(step);
  };

  const handleContinue = () => {
    if (activeStep === "scope") {
      handleStepChange("curriculum");
      return;
    }
    if (activeStep === "curriculum") {
      handleStepChange("review");
    }
  };

  const handleGoBackStep = () => {
    if (activeStep === "curriculum") {
      setActiveStep("scope");
      return;
    }
    if (activeStep === "review") {
      setActiveStep("curriculum");
    }
  };

  const handleScopeClassChange = (value: string) => {
    const nextAssignedSectionIds = assignedSectionIds.filter((sectionId) =>
      sections.some((section) => {
        const sectionClassId =
          typeof section.class === "string" ? section.class : section.class?._id || "";

        return (
          section._id === sectionId &&
          (!value || !sectionClassId || sectionClassId === value)
        );
      }),
    );

    setClassId(value);
    setAssignedSectionIds(nextAssignedSectionIds);
    syncAssessmentBlocksForScope(value, nextAssignedSectionIds, selectedSubjectIds);
  };

  const handleScopeClassClear = () => {
    setClassId("");
    setAssignedSectionIds([]);
    syncAssessmentBlocksForScope("", [], selectedSubjectIds);
  };

  const handleSubjectChange = (nextSubjectIds: string[]) => {
    setSelectedSubjectIds(nextSubjectIds);
    syncAssessmentBlocksForScope(classId, assignedSectionIds, nextSubjectIds);
  };

  const handleSectionChange = (nextAssignedSectionIds: string[]) => {
    setAssignedSectionIds(nextAssignedSectionIds);
    syncAssessmentBlocksForScope(classId, nextAssignedSectionIds, selectedSubjectIds);
  };

  const outlineEntries = useMemo(
    () => buildCourseBuilderOutlineEntries(blocks),
    [blocks],
  );

  const topLevelBlockIds = outlineEntries
    .filter((entry) => entry.depth === 0)
    .map((entry) => entry.blockId);
  const topLevelIndexById = new Map(topLevelBlockIds.map((id, index) => [id, index]));

  const lessonMoveMap = useMemo(() => {
    const map = new Map<string, { canMoveUp: boolean; canMoveDown: boolean }>();
    let currentModuleId: string | null = null;
    let currentLessons: string[] = [];

    const flush = () => {
      currentLessons.forEach((lessonId, index) => {
        map.set(lessonId, {
          canMoveUp: index > 0,
          canMoveDown: index < currentLessons.length - 1,
        });
      });
      currentLessons = [];
    };

    blocks.forEach((block) => {
      if (block.type === "module") {
        flush();
        currentModuleId = block.id;
        return;
      }

      if (block.type === "lesson" && currentModuleId) {
        currentLessons.push(block.id);
        return;
      }

      currentModuleId = null;
      flush();
    });
    flush();
    return map;
  }, [blocks]);

  const addBlock = (type: EditableCourseBlock["type"]) => {
    const nextBlock = buildEmptyCourseBuilderBlock(type);
    setBlocks((currentBlocks) => [...currentBlocks, nextBlock]);
    setSelectedBlockId(nextBlock.id);
    if (nextBlock.type === "lesson") {
      setSelectedItemId(nextBlock.items[0]?.id || "");
    } else {
      setSelectedItemId("");
    }
  };

  const addModule = () => {
    const nextBlock = buildEmptyCourseBuilderBlock("module");
    if (nextBlock.type === "module") {
      nextBlock.title = `Module ${blocks.filter((block) => block.type === "module").length + 1}`;
    }
    setBlocks((currentBlocks) => [...currentBlocks, nextBlock]);
    setSelectedBlockId(nextBlock.id);
    setSelectedItemId("");
  };

  const addSpecialBlock = (type: "announcement" | "assessment") => {
    addBlock(type);
  };

  const addLessonToModule = (
    moduleId: string,
    type: EditableLessonItem["type"] = "text",
  ) => {
    const newLesson = buildEmptyCourseBuilderBlock("lesson");
    if (newLesson.type !== "lesson") {
      return;
    }
    newLesson.title = `Lesson ${
      blocks.filter((block) => block.type === "lesson").length + 1
    }`;
    newLesson.items = [createEmptyLessonItem(type)];

    setBlocks((currentBlocks) => {
      const moduleIndex = currentBlocks.findIndex((block) => block.id === moduleId);
      if (moduleIndex < 0 || currentBlocks[moduleIndex]?.type !== "module") {
        return currentBlocks;
      }

      let insertIndex = moduleIndex + 1;
      while (insertIndex < currentBlocks.length && currentBlocks[insertIndex]?.type === "lesson") {
        insertIndex += 1;
      }

      const nextBlocks = [...currentBlocks];
      nextBlocks.splice(insertIndex, 0, newLesson);
      return nextBlocks;
    });
    setSelectedBlockId(newLesson.id);
    setSelectedItemId(newLesson.items[0]?.id || "");
  };

  const selectedLessonModuleId =
    selectedBlock?.type === "module"
      ? selectedBlock.id
      : selectedBlock?.type === "lesson"
        ? getModuleContextForLesson(blocks, selectedBlock.id)?.id || null
        : null;

  const addLessonItem = (
    blockId: string,
    type: EditableLessonItem["type"],
    overrides?: Partial<EditableLessonItem>,
  ) => {
    const newItem = createEmptyLessonItem(type, overrides);

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
    setSelectedItemId(newItem.id);
  };

  const removeLessonItem = (blockId: string, itemId: string) => {
    setBlocks((currentBlocks) =>
      currentBlocks.map((block) => {
        if (block.id !== blockId || block.type !== "lesson") {
          return block;
        }

        const nextItems = block.items.filter((item) => item.id !== itemId);
        return {
          ...block,
          items: nextItems,
        };
      }),
    );
    if (selectedItemId === itemId) {
      setSelectedItemId("");
    }
  };

  const deleteSelectedBlock = () => {
    if (!selectedBlock) {
      return;
    }
    const nextBlocks = removeCourseBuilderBlockWithFallback(blocks, selectedBlock.id);
    setBlocks(nextBlocks);
  };

  const handleDuplicateLesson = () => {
    if (!selectedBlock || selectedBlock.type !== "lesson") {
      return;
    }

    const result = duplicateCourseBuilderLesson(blocks, selectedBlock.id);
    setBlocks(result.blocks);
    if (result.duplicatedLessonId) {
      setSelectedBlockId(result.duplicatedLessonId);
    }
  };

  const canMoveSelectedLessonToPrevModule =
    selectedBlock?.type === "lesson"
      ? blocks
          .slice(0, blocks.findIndex((block) => block.id === selectedBlock.id))
          .some((block) => block.type === "module" && block.id !== getModuleContextForLesson(blocks, selectedBlock.id)?.id)
      : false;

  const canMoveSelectedLessonToNextModule =
    selectedBlock?.type === "lesson"
      ? (() => {
          const currentModuleId = getModuleContextForLesson(blocks, selectedBlock.id)?.id;
          let foundCurrent = false;
          for (const block of blocks) {
            if (block.type === "module") {
              if (block.id === currentModuleId) {
                foundCurrent = true;
                continue;
              }
              if (foundCurrent) {
                return true;
              }
            }
          }
          return false;
        })()
      : false;

  const selectedBlockError = selectedBlock ? inlineErrors.blocks[selectedBlock.id] : undefined;

  return (
    <div className="space-y-4">
      {formError ? <FeedbackNotice variant="error">{formError}</FeedbackNotice> : null}
      {creationModeNotice ? (
        <FeedbackNotice variant="info">
          <span className="font-semibold">{creationModeNotice.title}.</span>{" "}
          {creationModeNotice.message}
        </FeedbackNotice>
      ) : null}

      <div className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <h2 className="text-[1.12rem] font-semibold tracking-[-0.025em] text-foreground">
              {activeStep === "scope"
                ? "Start with scope"
                : activeStep === "curriculum"
                  ? "Build the curriculum"
                  : "Review before publishing"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {activeStep === "scope"
                ? "Only the essentials are visible here."
                : activeStep === "curriculum"
                  ? "Keep one block in focus at a time."
                  : "Check the summary and preview, then publish."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {canAutosave
                ? autosaveStatus === "saving"
                  ? "Saving..."
                  : autosaveStatus === "saved"
                    ? "Saved"
                    : "Auto-save"
                : "Draft only"}
            </Badge>
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4" />
              Settings
            </Button>
            <Button variant="outline" onClick={() => navigateBack()}>
              Cancel
            </Button>
          </div>
        </div>

        <CourseBuilderStepper
          activeStep={activeStep}
          onStepChange={handleStepChange}
          scopeComplete={setupComplete}
          curriculumReady={buildComplete}
          reviewReady={reviewReady}
        />

        {activeStep === "scope" ? (
          <CourseScopeStep
            title={title}
            setTitle={setTitle}
            summary={summary}
            setSummary={setSummary}
            classId={classId}
            setClassId={setClassId}
            classOptions={classOptions}
            sectionOptions={sectionOptions}
            selectedSubjectIds={selectedSubjectIds}
            setSelectedSubjectIds={handleSubjectChange}
            subjectOptions={subjectOptions}
            assignedSectionIds={assignedSectionIds}
            setAssignedSectionIds={handleSectionChange}
            sectionsDisabled={!classId}
            selectedClassName={selectedClassName}
            selectedSubjectNames={selectedSubjectNames}
            selectedSectionNames={selectedSectionNames}
            inlineErrors={inlineErrors}
            onScopeClassChange={handleScopeClassChange}
            onScopeClassClear={handleScopeClassClear}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        ) : null}

        {activeStep === "curriculum" ? (
          <div className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)]">
            <Card className="app-surface hidden overflow-hidden xl:block">
              <CardHeader className="app-section-header">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Outline</CardTitle>
                  <Button variant="outline" size="sm" onClick={addModule}>
                    <Plus className="h-4 w-4" />
                    Module
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="app-section-body space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      selectedLessonModuleId ? addLessonToModule(selectedLessonModuleId) : undefined
                    }
                    disabled={!selectedLessonModuleId}
                  >
                    <Plus className="h-4 w-4" />
                    Lesson
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4" />
                        Special block
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-52 p-2">
                      <div className="grid gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="justify-start"
                          onClick={() => addSpecialBlock("announcement")}
                        >
                          <Bell className="h-4 w-4" />
                          Announcement
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="justify-start"
                          onClick={() => addSpecialBlock("assessment")}
                        >
                          <FileQuestion className="h-4 w-4" />
                          Assessment
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  {outlineEntries.map((entry) => {
                    const block = blocks.find((item) => item.id === entry.blockId);
                    if (!block) {
                      return null;
                    }

                    const Icon = getBlockIcon(block);
                    const active = selectedBlockId === block.id;
                    const topLevelIndex = topLevelIndexById.get(block.id) ?? -1;
                    const canMoveTopLevelUp =
                      entry.depth === 0 && topLevelIndex > 0;
                    const canMoveTopLevelDown =
                      entry.depth === 0 && topLevelIndex >= 0 && topLevelIndex < topLevelBlockIds.length - 1;
                    const lessonMoveState = lessonMoveMap.get(block.id);

                    return (
                      <div
                        key={entry.blockId}
                        className={cn(
                          "flex items-start gap-2 rounded-[1rem] border p-2",
                          entry.depth === 1 ? "ml-5 border-border/55 bg-background/60" : "border-border/65 bg-[hsl(var(--app-surface-2)/0.56)]",
                          active && "border-primary/28 bg-primary/6",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedBlockId(block.id)}
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        >
                          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.9rem] border border-border/60 bg-background text-muted-foreground">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 space-y-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-foreground">
                                {block.type === "module"
                                  ? block.title || "Untitled module"
                                  : block.type === "lesson"
                                    ? block.title || "Untitled lesson"
                                    : block.type === "announcement"
                                      ? block.title || "Announcement"
                                      : block.titleOverride ||
                                        paperOptionsById.get(block.questionPaperId)?.title ||
                                        "Assessment"}
                              </span>
                              {inlineErrors.blocks[block.id] ? (
                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                              ) : (
                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary/55" />
                              )}
                            </span>
                            <span className="block text-xs leading-5 text-muted-foreground">
                              {block.type === "module"
                                ? `${blocks.filter((item, index) => {
                                    if (item.type !== "lesson") return false;
                                    const moduleContext = getModuleContextForLesson(blocks, item.id);
                                    return moduleContext?.id === block.id;
                                  }).length} lesson(s)`
                                : block.type === "lesson"
                                  ? `${block.items.length} item(s)`
                                  : block.type === "announcement"
                                    ? "Student-facing update"
                                    : block.questionPaperId
                                      ? "Linked assessment"
                                      : "Needs linked paper"}
                            </span>
                          </span>
                        </button>
                        <div className="flex shrink-0 flex-col gap-1">
                          {block.type === "module" ? (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => addLessonToModule(block.id)}
                              aria-label="Add lesson"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {entry.depth === 0 ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() =>
                                  setBlocks((currentBlocks) =>
                                    moveCourseBuilderTopLevelBlock(currentBlocks, block.id, -1),
                                  )
                                }
                                disabled={!canMoveTopLevelUp}
                                aria-label="Move block up"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() =>
                                  setBlocks((currentBlocks) =>
                                    moveCourseBuilderTopLevelBlock(currentBlocks, block.id, 1),
                                  )
                                }
                                disabled={!canMoveTopLevelDown}
                                aria-label="Move block down"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                            </>
                          ) : block.type === "lesson" ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() =>
                                  setBlocks((currentBlocks) =>
                                    moveCourseBuilderLessonWithinModule(currentBlocks, block.id, -1),
                                  )
                                }
                                disabled={!lessonMoveState?.canMoveUp}
                                aria-label="Move lesson up"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() =>
                                  setBlocks((currentBlocks) =>
                                    moveCourseBuilderLessonWithinModule(currentBlocks, block.id, 1),
                                  )
                                }
                                disabled={!lessonMoveState?.canMoveDown}
                                aria-label="Move lesson down"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                            </>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setSelectedBlockId(block.id);
                              const nextBlocks = removeCourseBuilderBlockWithFallback(blocks, block.id);
                              setBlocks(nextBlocks);
                            }}
                            aria-label="Delete block"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4 xl:col-start-2">
              <Card className="app-surface overflow-hidden">
                <CardHeader className="app-section-header">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <CardTitle>
                      {selectedBlock
                        ? `${getBlockTypeLabel(selectedBlock)}`
                        : "Curriculum"}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="xl:hidden"
                        onClick={() => setMobileOutlineOpen(true)}
                      >
                        Outline
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMobileInspectorOpen(true)}
                        disabled={!selectedBlock}
                      >
                        Block settings
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="app-section-body space-y-5">
                  {!selectedBlock ? (
                    <div className="rounded-[1.1rem] border border-dashed border-border/70 bg-muted/10 p-5 text-sm text-muted-foreground">
                      Select a block from the outline to start editing.
                    </div>
                  ) : null}

                  {selectedBlock?.type === "module" ? (
                    <div className="space-y-5">
                      <FormField
                        label="Module title"
                        hint={selectedBlockError?.title}
                        hintTone={selectedBlockError?.title ? "error" : "muted"}
                      >
                        <Input
                          value={selectedBlock.title}
                          onChange={(event) =>
                            updateBlock<EditableModuleBlock>(selectedBlock.id, (block) => ({
                              ...block,
                              title: event.target.value,
                            }))
                          }
                          placeholder="Module 1"
                          aria-label="Module title"
                        />
                      </FormField>

                      <FormField
                        label="Module summary"
                        hint={selectedBlockError?.summary}
                        hintTone={selectedBlockError?.summary ? "error" : "muted"}
                      >
                        <Textarea
                          value={selectedBlock.summary}
                          onChange={(event) =>
                            updateBlock<EditableModuleBlock>(selectedBlock.id, (block) => ({
                              ...block,
                              summary: event.target.value,
                            }))
                          }
                          placeholder="Optional context for the lessons that follow."
                          className="min-h-[128px]"
                          aria-label="Module summary"
                        />
                      </FormField>

                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => addLessonToModule(selectedBlock.id)}>
                          <Plus className="h-4 w-4" />
                          Add lesson
                        </Button>
                        <Button variant="outline" onClick={() => setMobileOutlineOpen(true)} className="xl:hidden">
                          Reorder in outline
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {selectedBlock?.type === "lesson" ? (
                    <div className="space-y-5">
                      <div className="flex flex-col gap-3 rounded-[1.05rem] border border-border/65 bg-background/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                        <p className="text-sm text-muted-foreground">
                          Lesson stays focused here. Open block settings only when needed.
                        </p>
                        {getModuleContextForLesson(blocks, selectedBlock.id) ? (
                          <Badge variant="outline">
                            In {getModuleContextForLesson(blocks, selectedBlock.id)?.title || "Untitled module"}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Needs module</Badge>
                        )}
                      </div>

                      <FormField
                        label="Lesson title"
                        hint={selectedBlockError?.title}
                        hintTone={selectedBlockError?.title ? "error" : "muted"}
                      >
                        <Input
                          value={selectedBlock.title}
                          onChange={(event) =>
                            updateBlock<EditableLessonBlock>(selectedBlock.id, (block) => ({
                              ...block,
                              title: event.target.value,
                            }))
                          }
                          placeholder="Lesson 1"
                          aria-label="Lesson title"
                        />
                      </FormField>

                      <FormField
                        label="Lesson summary"
                        hint={selectedBlockError?.summary}
                        hintTone={selectedBlockError?.summary ? "error" : "muted"}
                      >
                        <Textarea
                          value={selectedBlock.summary}
                          onChange={(event) =>
                            updateBlock<EditableLessonBlock>(selectedBlock.id, (block) => ({
                              ...block,
                              summary: event.target.value,
                            }))
                          }
                          placeholder="Optional context for this lesson."
                          className="min-h-[128px]"
                          aria-label="Lesson summary"
                        />
                      </FormField>

                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-foreground">Lesson content</p>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Plus className="h-4 w-4" />
                                Add item
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-52 p-2">
                              <div className="grid gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="justify-start"
                                  onClick={() => addLessonItem(selectedBlock.id, "text")}
                                >
                                  <FileText className="h-4 w-4" />
                                  Text
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="justify-start"
                                  onClick={() => addLessonItem(selectedBlock.id, "image")}
                                >
                                  <ImageIcon className="h-4 w-4" />
                                  Image
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="justify-start"
                                  onClick={() => addLessonItem(selectedBlock.id, "youtube")}
                                >
                                  <Video className="h-4 w-4" />
                                  YouTube
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="justify-start"
                                  onClick={() => addLessonItem(selectedBlock.id, "resource")}
                                >
                                  <Link2 className="h-4 w-4" />
                                  Resource
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>

                        {selectedBlockError?.items ? (
                          <p className="text-xs text-rose-600">{selectedBlockError.items}</p>
                        ) : null}

                        {selectedBlock.items.map((item, itemIndex) => (
                          <div
                            key={item.id}
                            className={cn(
                              "space-y-4 rounded-[1.1rem] border p-4 transition",
                              selectedItemId === item.id
                                ? "border-primary/24 bg-primary/5"
                                : "border-border/65 bg-background/80",
                            )}
                            onClick={() => setSelectedItemId(item.id)}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">
                                  {item.type === "text"
                                    ? "Text"
                                    : item.type === "image"
                                      ? "Image"
                                      : item.type === "youtube"
                                        ? "YouTube"
                                        : "Resource"}
                                </Badge>
                                <span className="text-xs text-muted-foreground">Item {itemIndex + 1}</span>
                              </div>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeLessonItem(selectedBlock.id, item.id);
                                }}
                                aria-label="Remove lesson item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {item.type === "text" ? (
                              <FormField
                                label="Text content"
                                hint={selectedBlockError?.itemErrors?.[item.id]}
                                hintTone={selectedBlockError?.itemErrors?.[item.id] ? "error" : "muted"}
                              >
                                <RichTextEditor
                                  initialContent={item.contentHtml}
                                  onChange={(html) =>
                                    updateLessonItem<EditableLessonTextItem>(selectedBlock.id, item.id, (currentItem) => ({
                                      ...currentItem,
                                      contentHtml: html,
                                    }))
                                  }
                                  editorKey={`${selectedBlock.id}-${item.id}`}
                                  imageUploadEndpoint="/api/courses/images"
                                />
                              </FormField>
                            ) : null}

                            {item.type === "image" ? (
                              <div className="space-y-4">
                                <FormField
                                  label="Image URL or upload"
                                  hint={selectedBlockError?.itemErrors?.[item.id]}
                                  hintTone={selectedBlockError?.itemErrors?.[item.id] ? "error" : "muted"}
                                >
                                  <div className="space-y-3">
                                    <Input
                                      value={item.imageUrl}
                                      onChange={(event) =>
                                        updateLessonItem<EditableLessonImageItem>(selectedBlock.id, item.id, (currentItem) => ({
                                          ...currentItem,
                                          imageUrl: event.target.value,
                                        }))
                                      }
                                      placeholder="https://example.com/lesson-image.webp"
                                      aria-label="Lesson image URL"
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
                                        void handleLessonItemImageUpload(selectedBlock.id, item.id, file);
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
                                <div className="grid gap-4 lg:grid-cols-2">
                                  <FormField label="Alt text">
                                    <Input
                                      value={item.altText}
                                      onChange={(event) =>
                                        updateLessonItem<EditableLessonImageItem>(selectedBlock.id, item.id, (currentItem) => ({
                                          ...currentItem,
                                          altText: event.target.value,
                                        }))
                                      }
                                      placeholder="Describe the image for accessibility"
                                      aria-label="Lesson image alt text"
                                    />
                                  </FormField>
                                  <FormField label="Caption">
                                    <Input
                                      value={item.caption}
                                      onChange={(event) =>
                                        updateLessonItem<EditableLessonImageItem>(selectedBlock.id, item.id, (currentItem) => ({
                                          ...currentItem,
                                          caption: event.target.value,
                                        }))
                                      }
                                      placeholder="Optional caption"
                                      aria-label="Lesson image caption"
                                    />
                                  </FormField>
                                </div>
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
                            ) : null}

                            {item.type === "youtube" ? (
                              <div className="space-y-4">
                                <FormField
                                  label="YouTube link"
                                  hint={selectedBlockError?.itemErrors?.[item.id]}
                                  hintTone={selectedBlockError?.itemErrors?.[item.id] ? "error" : "muted"}
                                >
                                  <Input
                                    value={item.urlInput}
                                    onChange={(event) =>
                                      updateLessonItem<EditableLessonYoutubeItem>(selectedBlock.id, item.id, (currentItem) => ({
                                        ...currentItem,
                                        urlInput: event.target.value,
                                        videoId:
                                          resolveYouTubeVideoId(event.target.value) || currentItem.videoId,
                                      }))
                                    }
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    aria-label="Lesson YouTube link"
                                  />
                                </FormField>
                                <FormField label="Caption">
                                  <Textarea
                                    value={item.caption}
                                    onChange={(event) =>
                                      updateLessonItem<EditableLessonYoutubeItem>(selectedBlock.id, item.id, (currentItem) => ({
                                        ...currentItem,
                                        caption: event.target.value,
                                      }))
                                    }
                                    className="min-h-[120px]"
                                    placeholder="Optional context or instructions for the video."
                                    aria-label="Lesson YouTube caption"
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
                            ) : null}

                            {item.type === "resource" ? (
                              <div className="space-y-4">
                                <div className="grid gap-4 lg:grid-cols-2">
                                  <FormField
                                    label="Resource title"
                                    hint={
                                      selectedBlockError?.itemErrors?.[item.id]?.includes("title")
                                        ? selectedBlockError.itemErrors?.[item.id]
                                        : undefined
                                    }
                                    hintTone={
                                      selectedBlockError?.itemErrors?.[item.id]?.includes("title")
                                        ? "error"
                                        : "muted"
                                    }
                                  >
                                    <Input
                                      value={item.title}
                                      onChange={(event) =>
                                        updateLessonItem<EditableLessonResourceItem>(selectedBlock.id, item.id, (currentItem) => ({
                                          ...currentItem,
                                          title: event.target.value,
                                        }))
                                      }
                                      placeholder="Formula sheet"
                                      aria-label="Lesson resource title"
                                    />
                                  </FormField>
                                  <FormField label="Caption">
                                    <Input
                                      value={item.caption}
                                      onChange={(event) =>
                                        updateLessonItem<EditableLessonResourceItem>(selectedBlock.id, item.id, (currentItem) => ({
                                          ...currentItem,
                                          caption: event.target.value,
                                        }))
                                      }
                                      placeholder="Optional context for the download"
                                      aria-label="Lesson resource caption"
                                    />
                                  </FormField>
                                </div>
                                <FormField
                                  label="Resource upload"
                                  hint={
                                    selectedBlockError?.itemErrors?.[item.id]?.includes("Upload")
                                      ? selectedBlockError.itemErrors?.[item.id]
                                      : "PDF, DOCX, spreadsheet, archive, and common video files are supported."
                                  }
                                  hintTone={
                                    selectedBlockError?.itemErrors?.[item.id]?.includes("Upload")
                                      ? "error"
                                      : "muted"
                                  }
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
                                      void handleLessonItemResourceUpload(selectedBlock.id, item.id, file);
                                    }}
                                  />
                                </FormField>
                                {uploadingFileBlockId === item.id ? (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Spinner />
                                    Uploading resource...
                                  </div>
                                ) : null}
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
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {selectedBlock?.type === "announcement" ? (
                    <div className="space-y-5">
                      <FormField
                        label="Announcement title"
                        hint={selectedBlockError?.title}
                        hintTone={selectedBlockError?.title ? "error" : "muted"}
                      >
                        <Input
                          value={selectedBlock.title}
                          onChange={(event) =>
                            updateBlock<EditableAnnouncementBlock>(selectedBlock.id, (block) => ({
                              ...block,
                              title: event.target.value,
                            }))
                          }
                          placeholder="Before you start"
                          aria-label="Announcement title"
                        />
                      </FormField>

                      <FormField
                        label="Announcement content"
                        hint={selectedBlockError?.title}
                        hintTone={selectedBlockError?.title ? "error" : "muted"}
                      >
                        <RichTextEditor
                          initialContent={selectedBlock.contentHtml}
                          onChange={(html) =>
                            updateBlock<EditableAnnouncementBlock>(selectedBlock.id, (block) => ({
                              ...block,
                              contentHtml: html,
                            }))
                          }
                          editorKey={`${selectedBlock.id}-announcement`}
                          imageUploadEndpoint="/api/courses/images"
                        />
                      </FormField>
                    </div>
                  ) : null}

                  {selectedBlock?.type === "assessment" ? (
                    <div className="space-y-5">
                      <FormField label="Assessment title override">
                        <Input
                          value={selectedBlock.titleOverride}
                          onChange={(event) =>
                            updateBlock<EditableAssessmentBlock>(selectedBlock.id, (block) => ({
                              ...block,
                              titleOverride: event.target.value,
                            }))
                          }
                          placeholder="Leave blank to reuse the paper title"
                          aria-label="Assessment title override"
                        />
                      </FormField>

                      <div className="rounded-[1.05rem] border border-border/65 bg-background/70 p-4">
                        {selectedBlock.questionPaperId && paperOptionsById.get(selectedBlock.questionPaperId) ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">
                                {paperOptionsById.get(selectedBlock.questionPaperId)?.onlineEnabled
                                  ? "Online ready"
                                  : "Unavailable"}
                              </Badge>
                              {paperOptionsById
                                .get(selectedBlock.questionPaperId)
                                ?.subjects.map((subject) => (
                                  <Badge key={subject._id} variant="outline">
                                    {subject.name}
                                  </Badge>
                                ))}
                            </div>
                            <p className="text-sm font-semibold text-foreground">
                              {paperOptionsById.get(selectedBlock.questionPaperId)?.title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {paperOptionsById.get(selectedBlock.questionPaperId)?.duration} min •{" "}
                              {paperOptionsById.get(selectedBlock.questionPaperId)?.totalMarks} marks
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Link a question paper from the inspector to complete this block.
                          </p>
                        )}
                      </div>

                      <Button variant="outline" onClick={() => setMobileInspectorOpen(true)} className="xl:hidden">
                        Open assessment settings
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}

        {activeStep === "review" ? (
          <CourseReviewStep
            blocks={blocks}
            paperOptionsById={paperOptionsById}
            selectedClassName={selectedClassName}
            selectedSectionSummary={selectedSectionSummary}
            selectedSubjectNames={selectedSubjectNames}
            startsAt={startsAt}
            dueAt={dueAt}
            blockCounts={blockCounts}
            requiredAssessmentCount={requiredAssessmentCount}
            enforceSequentialProgress={enforceSequentialProgress}
            allowNotes={allowNotes}
            allowBookmarks={allowBookmarks}
            isTemplate={templateToggleLocked ? true : isTemplate}
            completionBadgeLabel={completionBadgeLabel}
            publishValidationMessage={publishValidationMessage}
            setupComplete={setupComplete}
            buildComplete={buildComplete}
          />
        ) : null}
      </div>

      <CourseSettingsDrawer
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        coverImageUrl={coverImageUrl}
        setCoverImageUrl={setCoverImageUrl}
        coverImageAltText={coverImageAltText}
        setCoverImageAltText={setCoverImageAltText}
        startsAt={startsAt}
        setStartsAt={setStartsAt}
        dueAt={dueAt}
        setDueAt={setDueAt}
        completionBadgeLabel={completionBadgeLabel}
        setCompletionBadgeLabel={setCompletionBadgeLabel}
        enforceSequentialProgress={enforceSequentialProgress}
        setEnforceSequentialProgress={setEnforceSequentialProgress}
        allowNotes={allowNotes}
        setAllowNotes={setAllowNotes}
        allowBookmarks={allowBookmarks}
        setAllowBookmarks={setAllowBookmarks}
        isTemplate={isTemplate}
        setIsTemplate={setIsTemplate}
        templateToggleLocked={templateToggleLocked}
        uploadingImageTarget={uploadingImageTarget}
        handleCoverImageUpload={handleCoverImageUpload}
      />

      <Dialog open={mobileOutlineOpen} onOpenChange={setMobileOutlineOpen}>
        <DialogContent className="sm:max-w-xl xl:hidden">
          <DialogHeader>
            <DialogTitle>Course outline</DialogTitle>
            <DialogDescription>
              Reorder modules and lessons from here, then return to the focused canvas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={addModule}>
                <Plus className="h-4 w-4" />
                Module
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  selectedLessonModuleId ? addLessonToModule(selectedLessonModuleId) : undefined
                }
                disabled={!selectedLessonModuleId}
              >
                <Plus className="h-4 w-4" />
                Lesson
              </Button>
            </div>
            <div className="space-y-2">
              {outlineEntries.map((entry) => {
                const block = blocks.find((item) => item.id === entry.blockId);
                if (!block) {
                  return null;
                }

                const Icon = getBlockIcon(block);

                return (
                  <button
                    key={entry.blockId}
                    type="button"
                    onClick={() => {
                      setSelectedBlockId(block.id);
                      setMobileOutlineOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[1rem] border px-3.5 py-3 text-left",
                      entry.depth === 1 ? "ml-5 w-[calc(100%-1.25rem)]" : "",
                      selectedBlockId === block.id
                        ? "border-primary/28 bg-primary/6"
                        : "border-border/65 bg-background/80",
                    )}
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.9rem] border border-border/60 bg-background text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {block.type === "module"
                          ? block.title || "Untitled module"
                          : block.type === "lesson"
                            ? block.title || "Untitled lesson"
                            : block.type === "announcement"
                              ? block.title || "Announcement"
                              : block.titleOverride ||
                                paperOptionsById.get(block.questionPaperId)?.title ||
                                "Assessment"}
                      </span>
                      <span className="block text-xs leading-5 text-muted-foreground">
                        {getBlockTypeLabel(block)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mobileInspectorOpen} onOpenChange={setMobileInspectorOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Block settings</DialogTitle>
            <DialogDescription>
              Advanced block settings stay here so the main editor can stay simple.
            </DialogDescription>
          </DialogHeader>
          <CourseBuilderInspector
            block={selectedBlock}
            selectedItem={selectedItem}
            selectedBlockError={selectedBlockError}
            paperOptions={paperOptions}
            paperOptionsById={paperOptionsById}
            currentEditorPath={currentEditorPath}
            onUpdateBlock={updateBlock}
            onUpdateLessonItem={updateLessonItem}
            onDeleteSelectedBlock={() => {
              deleteSelectedBlock();
              setMobileInspectorOpen(false);
            }}
            onDuplicateLesson={handleDuplicateLesson}
            onMoveLessonToPrevModule={() =>
              selectedBlock?.type === "lesson"
                ? setBlocks((currentBlocks) =>
                    moveCourseBuilderLessonToAdjacentModule(
                      currentBlocks,
                      selectedBlock.id,
                      "prev",
                    ),
                  )
                : undefined
            }
            onMoveLessonToNextModule={() =>
              selectedBlock?.type === "lesson"
                ? setBlocks((currentBlocks) =>
                    moveCourseBuilderLessonToAdjacentModule(
                      currentBlocks,
                      selectedBlock.id,
                      "next",
                    ),
                  )
                : undefined
            }
            canMoveLessonToPrevModule={canMoveSelectedLessonToPrevModule}
            canMoveLessonToNextModule={canMoveSelectedLessonToNextModule}
            firstAssessment={
              selectedBlock ? blocks[firstAssessmentIndex]?.id === selectedBlock.id : false
            }
          />
        </DialogContent>
      </Dialog>

      <div className="sticky bottom-3 z-20">
        <div className="rounded-[1.3rem] border border-border/70 bg-[hsl(var(--app-surface-1)/0.96)] p-3 shadow-[0_24px_40px_-34px_hsl(var(--app-shadow-deep)/0.22)] backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {activeStep === "scope"
                  ? "Complete the scope to unlock autosave and curriculum authoring."
                  : activeStep === "curriculum"
                    ? "Keep building in the canvas and use the outline or inspector only when needed."
                    : "Review the student-facing result, then publish when the checklist is clear."}
              </p>
              <p
                className={cn(
                  "text-xs",
                  autosaveStatus === "error" ? "text-rose-600" : "text-muted-foreground",
                )}
              >
                {canAutosave
                  ? autosaveMessage ||
                    (autosaveStatus === "saved"
                      ? "Draft saved."
                      : "Edits will autosave once the scope is valid.")
                  : "Add a title, class, and subject to enable autosave."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              {activeStep !== "scope" ? (
                <Button variant="outline" onClick={handleGoBackStep}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => void handleSubmit("draft")}
                disabled={saving}
              >
                {savingTarget === "draft" ? <Spinner /> : <Save className="h-4 w-4" />}
                {getActionButtonLabel({
                  mode,
                  targetStatus: "draft",
                  saving: savingTarget === "draft",
                })}
              </Button>
              {activeStep !== "review" ? (
                <Button onClick={handleContinue}>
                  {activeStep === "scope" ? "Continue to curriculum" : "Continue to review"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => void handleSubmit("published")} disabled={saving}>
                  {savingTarget === "published" ? <Spinner /> : <Save className="h-4 w-4" />}
                  {getActionButtonLabel({
                    mode,
                    targetStatus: "published",
                    saving: savingTarget === "published",
                  })}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
