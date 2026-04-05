"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  FileImage,
  FileText,
  Save,
  Trash2,
  Upload,
  Video,
} from "lucide-react";

import RichTextEditor from "@/components/RichTextEditor";
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
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import {
  fetchApiJson,
  getApiRequestErrorCode,
  getApiRequestErrorPayload,
} from "@/lib/client/api";
import { buildYouTubeEmbedUrl, resolveYouTubeVideoId } from "@/lib/courses/youtube";
import { getTodayDiaryEntryDate, hasDiaryHtmlContent } from "@/lib/diary/shared";
import type { WorkspaceDiaryDetail } from "@/lib/diary/types";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import { cn } from "@/lib/utils";
import type {
  WorkspaceAcademicSectionItem,
  WorkspaceClassItem,
  WorkspaceSubjectItem,
} from "@/lib/workspace/support-types";

type EditableImageResource = {
  id: string;
  type: "image";
  url: string;
  altText: string;
  caption: string;
};

type EditableYoutubeResource = {
  id: string;
  type: "youtube";
  videoId: string;
  caption: string;
  urlInput: string;
};

type EditableFileResource = {
  id: string;
  type: "file";
  url: string;
  fileName: string;
  caption: string;
};

type EditableDiaryResource =
  | EditableImageResource
  | EditableYoutubeResource
  | EditableFileResource;

type DiaryConflictErrorPayload = {
  entryId?: string;
};

type DiaryEditorClientProps = {
  mode: "create" | "edit";
  entryId?: string;
  returnToPath: string;
  classes: WorkspaceClassItem[];
  sections: WorkspaceAcademicSectionItem[];
  subjects: WorkspaceSubjectItem[];
  initialEntry?: WorkspaceDiaryDetail | null;
};

function createResourceId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `diary-resource-${globalThis.crypto.randomUUID()}`;
  }

  return `diary-resource-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function mapInitialResources(entry?: WorkspaceDiaryDetail | null): EditableDiaryResource[] {
  const resources = Array.isArray(entry?.resources) ? entry.resources : [];

  return resources.map((resource) => {
    if (resource.type === "image") {
      return {
        id: resource.id,
        type: "image",
        url: resource.url,
        altText: resource.altText || "",
        caption: resource.caption || "",
      } satisfies EditableImageResource;
    }

    if (resource.type === "youtube") {
      return {
        id: resource.id,
        type: "youtube",
        videoId: resource.videoId,
        caption: resource.caption || "",
        urlInput: `https://www.youtube.com/watch?v=${resource.videoId}`,
      } satisfies EditableYoutubeResource;
    }

    return {
      id: resource.id,
      type: "file",
      url: resource.url,
      fileName: resource.fileName,
      caption: resource.caption || "",
    } satisfies EditableFileResource;
  });
}

function buildEmptyResource(
  type: EditableDiaryResource["type"],
): EditableDiaryResource {
  const id = createResourceId();

  if (type === "image") {
    return {
      id,
      type,
      url: "",
      altText: "",
      caption: "",
    };
  }

  if (type === "youtube") {
    return {
      id,
      type,
      videoId: "",
      caption: "",
      urlInput: "",
    };
  }

  return {
    id,
    type,
    url: "",
    fileName: "",
    caption: "",
  };
}

function getSubmitLabel(params: {
  mode: "create" | "edit";
  targetStatus: "draft" | "published";
  saving: boolean;
}) {
  if (params.targetStatus === "draft") {
    return params.saving ? "Saving draft..." : "Save as Draft";
  }

  if (params.saving) {
    return params.mode === "edit" ? "Publishing diary..." : "Creating diary...";
  }

  return params.mode === "edit" ? "Publish Diary" : "Create Diary";
}

function FormField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function ResourceIcon({ type }: { type: EditableDiaryResource["type"] }) {
  if (type === "image") {
    return <FileImage className="h-4 w-4" />;
  }

  if (type === "youtube") {
    return <Video className="h-4 w-4" />;
  }

  return <FileText className="h-4 w-4" />;
}

export default function DiaryEditorClient({
  mode,
  entryId,
  returnToPath,
  classes,
  sections,
  subjects,
  initialEntry = null,
}: DiaryEditorClientProps) {
  const router = useRouter();
  const { navigateBack } = useBackNavigation(returnToPath);
  const { toast } = useToast();

  const [title, setTitle] = useState(initialEntry?.title || "");
  const [entryDate, setEntryDate] = useState(
    initialEntry?.entryDate || getTodayDiaryEntryDate(),
  );
  const [classId, setClassId] = useState(initialEntry?.class?._id || "");
  const [subjectId, setSubjectId] = useState(initialEntry?.subject?._id || "");
  const [assignedSectionIds, setAssignedSectionIds] = useState<string[]>(
    Array.isArray(initialEntry?.assignedAcademicSections)
      ? initialEntry.assignedAcademicSections.map((section) => section._id)
      : [],
  );
  const [lessonSummaryHtml, setLessonSummaryHtml] = useState(
    initialEntry?.lessonSummaryHtml || "",
  );
  const [homeworkHtml, setHomeworkHtml] = useState(
    initialEntry?.homeworkHtml || "",
  );
  const [teacherNoteHtml, setTeacherNoteHtml] = useState(
    initialEntry?.teacherNoteHtml || "",
  );
  const [resources, setResources] = useState<EditableDiaryResource[]>(
    mapInitialResources(initialEntry),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [conflictEntryId, setConflictEntryId] = useState<string | null>(null);
  const [savingTarget, setSavingTarget] = useState<"draft" | "published" | null>(
    null,
  );
  const [uploadingImageResourceId, setUploadingImageResourceId] = useState<
    string | null
  >(null);
  const [uploadingFileResourceId, setUploadingFileResourceId] = useState<
    string | null
  >(null);
  const [archiving, setArchiving] = useState(false);

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

  const saving = savingTarget !== null;
  const noteSectionCount =
    Number(hasDiaryHtmlContent(lessonSummaryHtml)) +
    Number(hasDiaryHtmlContent(homeworkHtml)) +
    Number(hasDiaryHtmlContent(teacherNoteHtml));
  const contentCount =
    noteSectionCount + resources.length;

  const selectedClassName =
    classes.find((item) => item._id === classId)?.name || "No class selected";
  const selectedSubjectName =
    subjects.find((item) => item._id === subjectId)?.name || "No subject selected";
  const selectedSectionNames = assignedSectionIds
    .map((sectionId) => sections.find((section) => section._id === sectionId)?.name)
    .filter(Boolean) as string[];
  const selectedSectionSummary =
    selectedSectionNames.length > 0
      ? `${selectedSectionNames.slice(0, 3).join(", ")}${
          selectedSectionNames.length > 3
            ? ` +${selectedSectionNames.length - 3} more`
            : ""
        }`
      : "All sections in the selected class";

  const updateResource = <T extends EditableDiaryResource>(
    resourceId: string,
    updater: (resource: T) => T,
  ) => {
    setResources((currentResources) =>
      currentResources.map((resource) =>
        resource.id === resourceId ? updater(resource as T) : resource,
      ),
    );
  };

  const addResource = (type: EditableDiaryResource["type"]) => {
    setResources((currentResources) => [...currentResources, buildEmptyResource(type)]);
  };

  const removeResource = (resourceId: string) => {
    setResources((currentResources) =>
      currentResources.filter((resource) => resource.id !== resourceId),
    );
  };

  const moveResource = (resourceId: string, direction: -1 | 1) => {
    setResources((currentResources) => {
      const currentIndex = currentResources.findIndex(
        (resource) => resource.id === resourceId,
      );
      if (currentIndex < 0) {
        return currentResources;
      }

      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= currentResources.length) {
        return currentResources;
      }

      const nextResources = [...currentResources];
      const [movedResource] = nextResources.splice(currentIndex, 1);
      nextResources.splice(nextIndex, 0, movedResource);
      return nextResources;
    });
  };

  const validateBeforeSave = (targetStatus: "draft" | "published") => {
    if (!title.trim()) {
      return "Add a diary title.";
    }

    if (title.trim().length > 180) {
      return "Keep the diary title within 180 characters.";
    }

    if (!entryDate.trim()) {
      return "Select the diary date.";
    }

    if (!classId.trim()) {
      return "Select the class for this diary entry.";
    }

    if (!subjectId.trim()) {
      return "Select the subject for this diary entry.";
    }

    if (targetStatus === "published") {
      if (!hasDiaryHtmlContent(lessonSummaryHtml) &&
          !hasDiaryHtmlContent(homeworkHtml) &&
          !hasDiaryHtmlContent(teacherNoteHtml) &&
          resources.length === 0) {
        return "Add lesson notes, homework, a teacher note, or at least one resource before publishing.";
      }
    }

    for (const resource of resources) {
      if (resource.type === "image" && !resource.url.trim()) {
        return "Every diary image needs an uploaded image.";
      }

      if (resource.type === "youtube") {
        if (!resource.urlInput.trim() || !resolveYouTubeVideoId(resource.urlInput)) {
          return "Every diary video needs a valid YouTube link.";
        }
      }

      if (resource.type === "file" && (!resource.url.trim() || !resource.fileName.trim())) {
        return "Every diary file needs an uploaded file.";
      }
    }

    return null;
  };

  const uploadDiaryImage = async (resourceId: string, file: File | null) => {
    if (!file) {
      return;
    }

    setUploadingImageResourceId(resourceId);

    try {
      const payload = await fetchApiJson<{
        success: boolean;
        url: string;
      }>("/api/diary/images", {
        method: "POST",
        body: (() => {
          const formData = new FormData();
          formData.append("file", file, file.name || "diary-image");
          return formData;
        })(),
        fallbackMessage: "Failed to upload the diary image.",
      });

      updateResource<EditableImageResource>(resourceId, (resource) => ({
        ...resource,
        url: String(payload?.url || ""),
      }));

      toast({
        title: "Image uploaded",
        description: "The diary image is ready.",
      });
    } catch (error) {
      toast({
        title: "Image upload failed",
        description:
          error instanceof Error ? error.message : "We couldn't upload that image.",
        variant: "destructive",
      });
    } finally {
      setUploadingImageResourceId(null);
    }
  };

  const uploadDiaryFile = async (resourceId: string, file: File | null) => {
    if (!file) {
      return;
    }

    setUploadingFileResourceId(resourceId);

    try {
      const payload = await fetchApiJson<{
        success: boolean;
        url: string;
        fileName: string;
      }>("/api/diary/files", {
        method: "POST",
        body: (() => {
          const formData = new FormData();
          formData.append("file", file, file.name || "diary-file");
          return formData;
        })(),
        fallbackMessage: "Failed to upload the diary file.",
      });

      updateResource<EditableFileResource>(resourceId, (resource) => ({
        ...resource,
        url: String(payload?.url || ""),
        fileName: String(payload?.fileName || file.name || ""),
      }));

      toast({
        title: "File uploaded",
        description: "The diary file is attached.",
      });
    } catch (error) {
      toast({
        title: "File upload failed",
        description:
          error instanceof Error ? error.message : "We couldn't upload that file.",
        variant: "destructive",
      });
    } finally {
      setUploadingFileResourceId(null);
    }
  };

  const serializeResourcesForApi = () =>
    resources.map((resource) => {
      if (resource.type === "image") {
        return {
          id: resource.id,
          type: resource.type,
          url: resource.url,
          altText: resource.altText,
          caption: resource.caption,
        };
      }

      if (resource.type === "youtube") {
        return {
          id: resource.id,
          type: resource.type,
          youtubeUrl: resource.urlInput,
          videoId: resolveYouTubeVideoId(resource.urlInput) || resource.videoId,
          caption: resource.caption,
        };
      }

      return {
        id: resource.id,
        type: resource.type,
        url: resource.url,
        fileName: resource.fileName,
        caption: resource.caption,
      };
    });

  const handleSubmit = async (targetStatus: "draft" | "published") => {
    const validationMessage = validateBeforeSave(targetStatus);
    if (validationMessage) {
      setFormError(validationMessage);
      setConflictEntryId(null);
      return;
    }

    setFormError(null);
    setConflictEntryId(null);
    setSavingTarget(targetStatus);

    try {
      const endpoint = mode === "edit" && entryId ? `/api/diary/${entryId}` : "/api/diary";
      const method = mode === "edit" ? "PATCH" : "POST";
      const payload = await fetchApiJson<{
        success: boolean;
        entryId: string;
      }>(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          entryDate,
          classId,
          subjectId,
          assignedAcademicSections: assignedSectionIds,
          lessonSummaryHtml,
          homeworkHtml,
          teacherNoteHtml,
          resources: serializeResourcesForApi(),
          status: targetStatus,
        }),
        cache: "no-store",
        fallbackMessage:
          mode === "edit"
            ? "Failed to update diary entry."
            : "Failed to create diary entry.",
      });

      const nextEntryId = String(payload?.entryId || entryId || "").trim();
      toast({
        title: targetStatus === "draft" ? "Draft saved" : "Diary published",
        description:
          targetStatus === "draft"
            ? "The diary entry is saved as a draft."
            : "The diary entry is now visible to students in scope.",
      });

      if (nextEntryId) {
        router.push(
          buildHrefWithReturnTo(`/workspace/diary/${nextEntryId}`, returnToPath),
        );
        return;
      }

      navigateBack();
    } catch (error) {
      const errorCode = getApiRequestErrorCode(error);
      const errorPayload = getApiRequestErrorPayload<DiaryConflictErrorPayload>(error);

      if (
        errorCode === "DIARY_SCOPE_CONFLICT" &&
        errorPayload?.entryId &&
        String(errorPayload.entryId).trim()
      ) {
        setConflictEntryId(String(errorPayload.entryId).trim());
      } else {
        setConflictEntryId(null);
      }

      setFormError(
        error instanceof Error ? error.message : "We couldn't save the diary entry.",
      );
    } finally {
      setSavingTarget(null);
    }
  };

  const handleArchive = async () => {
    if (!entryId) {
      return;
    }

    const confirmed = window.confirm(
      "Archive this diary entry? Students will no longer see it.",
    );
    if (!confirmed) {
      return;
    }

    setArchiving(true);
    setFormError(null);

    try {
      await fetchApiJson(`/api/diary/${entryId}`, {
        method: "DELETE",
        fallbackMessage: "Failed to archive the diary entry.",
      });

      toast({
        title: "Diary archived",
        description: "The diary entry is now hidden from normal boards.",
      });

      router.push(returnToPath);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "We couldn't archive the diary entry.",
      );
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="app-course-editor-grid app-diary-editor-grid">
      <div className="app-course-editor-main">
        {formError ? (
          <FeedbackNotice variant="error">
            <div className="space-y-3">
              <p>{formError}</p>
              {conflictEntryId ? (
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <AppPrefetchLink
                      href={buildHrefWithReturnTo(
                        `/workspace/diary/${conflictEntryId}`,
                        returnToPath,
                      )}
                    >
                      Open Existing Entry
                    </AppPrefetchLink>
                  </Button>
                </div>
              ) : null}
            </div>
          </FeedbackNotice>
        ) : null}

        <Card className="app-course-editor-card">
          <CardHeader className="app-section-header">
            <CardTitle>Diary Setup</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body space-y-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <FormField label="Diary title">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Fractions practice and correction work"
                />
              </FormField>
              <FormField label="Diary date">
                <Input
                  type="date"
                  value={entryDate}
                  onChange={(event) => setEntryDate(event.target.value)}
                />
              </FormField>
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <FormField label="Class">
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
                  }}
                  placeholder="Select class"
                  searchPlaceholder="Search classes..."
                  emptyText="No classes found."
                  onClear={() => {
                    setClassId("");
                    setAssignedSectionIds([]);
                  }}
                  showCloseAction
                />
              </FormField>

              <FormField label="Assigned sections">
                <SearchableMultiSelectPopover
                  selectedValues={assignedSectionIds}
                  options={sectionOptions}
                  onSelectedValuesChange={setAssignedSectionIds}
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

            <FormField label="Subject">
              <SearchableCommandSelect
                value={subjectId}
                options={subjectOptions}
                onValueChange={setSubjectId}
                placeholder="Select subject"
                searchPlaceholder="Search subjects..."
                emptyText="No subjects found."
                onClear={() => setSubjectId("")}
                showCloseAction
              />
            </FormField>
          </CardContent>
        </Card>

        <Card className="app-course-editor-card">
          <CardHeader className="app-section-header">
            <CardTitle>Daily Notes</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body space-y-5">
            <FormField label="Lesson Summary">
              <RichTextEditor
                initialContent={lessonSummaryHtml}
                onChange={setLessonSummaryHtml}
                editorKey="diary-lesson-summary"
                compact
                imageUploadEndpoint="/api/diary/images"
              />
            </FormField>

            <FormField label="Homework">
              <RichTextEditor
                initialContent={homeworkHtml}
                onChange={setHomeworkHtml}
                editorKey="diary-homework"
                compact
                imageUploadEndpoint="/api/diary/images"
              />
            </FormField>

            <FormField label="Teacher Note">
              <RichTextEditor
                initialContent={teacherNoteHtml}
                onChange={setTeacherNoteHtml}
                editorKey="diary-teacher-note"
                compact
                imageUploadEndpoint="/api/diary/images"
              />
            </FormField>
          </CardContent>
        </Card>

        <Card className="app-course-editor-card">
          <CardHeader className="app-section-header">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Resources</CardTitle>
              <div className="app-editor-action-cloud">
                <Button type="button" variant="outline" size="sm" onClick={() => addResource("image")}>
                  <Upload className="h-4 w-4" />
                  Image
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addResource("youtube")}>
                  <Video className="h-4 w-4" />
                  YouTube
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addResource("file")}>
                  <FileText className="h-4 w-4" />
                  File
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="app-section-body space-y-5">
            {resources.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-muted/15 p-6 text-sm text-muted-foreground">
                Add optional images, videos, or files for this day.
              </div>
            ) : null}

            {resources.map((resource, index) => (
              <Card key={resource.id} className="app-course-editor-block-card">
                <CardHeader className="app-course-editor-block-header">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background">
                        <ResourceIcon type={resource.type} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="capitalize">
                            {resource.type === "youtube" ? "Video" : resource.type}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Resource {index + 1}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => moveResource(resource.id, -1)}
                        disabled={index === 0}
                        aria-label="Move resource up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => moveResource(resource.id, 1)}
                        disabled={index === resources.length - 1}
                        aria-label="Move resource down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => removeResource(resource.id)}
                        aria-label="Remove resource"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="app-course-editor-block-body space-y-4">
                  {resource.type === "image" ? (
                    <>
                      <FormField label="Image upload">
                        <div className="space-y-3">
                          <Input
                            value={resource.url}
                            onChange={(event) =>
                              updateResource<EditableImageResource>(resource.id, (current) => ({
                                ...current,
                                url: event.target.value,
                              }))
                            }
                            placeholder="https://example.com/diary-image.webp"
                          />
                          <FilePickerField
                            id={`diary-image-${resource.id}`}
                            hideLabel
                            buttonLabel="Upload image"
                            accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
                            placeholder="No image selected"
                            selectedFileName={
                              uploadingImageResourceId === resource.id ? "Uploading..." : null
                            }
                            onChange={(event) => {
                              const file = event.target.files?.[0] || null;
                              event.target.value = "";
                              void uploadDiaryImage(resource.id, file);
                            }}
                          />
                        </div>
                      </FormField>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <FormField label="Alt text">
                          <Input
                            value={resource.altText}
                            onChange={(event) =>
                              updateResource<EditableImageResource>(resource.id, (current) => ({
                                ...current,
                                altText: event.target.value,
                              }))
                            }
                            placeholder="Describe the image"
                          />
                        </FormField>
                        <FormField label="Caption">
                          <Input
                            value={resource.caption}
                            onChange={(event) =>
                              updateResource<EditableImageResource>(resource.id, (current) => ({
                                ...current,
                                caption: event.target.value,
                              }))
                            }
                            placeholder="Optional image caption"
                          />
                        </FormField>
                      </div>

                      {uploadingImageResourceId === resource.id ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Spinner />
                          Uploading image...
                        </div>
                      ) : null}

                      {resource.url ? (
                        <div className="app-diary-media-frame">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={resource.url}
                            alt={resource.altText || "Diary image preview"}
                            className="h-[220px] w-full object-cover"
                          />
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {resource.type === "youtube" ? (
                    <>
                      <FormField label="YouTube URL">
                        <Input
                          value={resource.urlInput}
                          onChange={(event) =>
                            updateResource<EditableYoutubeResource>(
                              resource.id,
                              (current) => ({
                                ...current,
                                urlInput: event.target.value,
                                videoId:
                                  resolveYouTubeVideoId(event.target.value) || current.videoId,
                              }),
                            )
                          }
                          placeholder="https://www.youtube.com/watch?v=..."
                        />
                      </FormField>

                      <FormField label="Caption">
                        <Input
                          value={resource.caption}
                          onChange={(event) =>
                            updateResource<EditableYoutubeResource>(
                              resource.id,
                              (current) => ({
                                ...current,
                                caption: event.target.value,
                              }),
                            )
                          }
                          placeholder="Optional video caption"
                        />
                      </FormField>

                      {resolveYouTubeVideoId(resource.urlInput) ? (
                        <div className="app-diary-media-frame overflow-hidden">
                          <iframe
                            src={buildYouTubeEmbedUrl(
                              resolveYouTubeVideoId(resource.urlInput) || resource.videoId,
                            )}
                            title="Diary video preview"
                            className="aspect-video w-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {resource.type === "file" ? (
                    <>
                      <FormField label="File upload">
                        <div className="space-y-3">
                          <Input
                            value={resource.url}
                            onChange={(event) =>
                              updateResource<EditableFileResource>(resource.id, (current) => ({
                                ...current,
                                url: event.target.value,
                              }))
                            }
                            placeholder="/uploads/diary-files/..."
                          />
                          <FilePickerField
                            id={`diary-file-${resource.id}`}
                            hideLabel
                            buttonLabel="Upload file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                            placeholder="No file selected"
                            selectedFileName={
                              uploadingFileResourceId === resource.id
                                ? "Uploading..."
                                : resource.fileName || null
                            }
                            onChange={(event) => {
                              const file = event.target.files?.[0] || null;
                              event.target.value = "";
                              void uploadDiaryFile(resource.id, file);
                            }}
                          />
                        </div>
                      </FormField>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <FormField label="File name">
                          <Input
                            value={resource.fileName}
                            onChange={(event) =>
                              updateResource<EditableFileResource>(resource.id, (current) => ({
                                ...current,
                                fileName: event.target.value,
                              }))
                            }
                            placeholder="Worksheet.pdf"
                          />
                        </FormField>
                        <FormField label="Caption">
                          <Input
                            value={resource.caption}
                            onChange={(event) =>
                              updateResource<EditableFileResource>(resource.id, (current) => ({
                                ...current,
                                caption: event.target.value,
                              }))
                            }
                            placeholder="Optional file caption"
                          />
                        </FormField>
                      </div>

                      {uploadingFileResourceId === resource.id ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Spinner />
                          Uploading file...
                        </div>
                      ) : null}

                      {resource.url && resource.fileName ? (
                        <div className="rounded-[1rem] border border-border/70 bg-muted/10 px-4 py-3 text-sm">
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-foreground underline-offset-4 hover:underline"
                          >
                            {resource.fileName}
                          </a>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="app-course-editor-sidebar">
        <Card className="app-course-editor-card">
          <CardHeader className="app-section-header">
            <CardTitle>Save Diary</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body space-y-4">
            <div className="app-course-metric-grid">
              <div className="app-course-metric-card">
                <p className="app-course-metric-label">Notes</p>
                <p className="app-course-metric-value">{noteSectionCount}</p>
              </div>
              <div className="app-course-metric-card">
                <p className="app-course-metric-label">Resources</p>
                <p className="app-course-metric-value">{resources.length}</p>
              </div>
              <div className="app-course-metric-card">
                <p className="app-course-metric-label">Sections</p>
                <p className="app-course-metric-value">
                  {assignedSectionIds.length > 0 ? assignedSectionIds.length : "All"}
                </p>
              </div>
              <div className="app-course-metric-card">
                <p className="app-course-metric-label">Items</p>
                <p className="app-course-metric-value">{contentCount}</p>
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
                  <p className="app-editor-summary-label">Subject</p>
                  <p className="app-editor-summary-value">{selectedSubjectName}</p>
                </div>
              </div>
              <div className="app-editor-summary-row">
                <div className="space-y-1">
                  <p className="app-editor-summary-label">Coverage</p>
                  <p className="app-editor-summary-value">{selectedSectionSummary}</p>
                </div>
              </div>
            </div>

            <div className="app-editor-chip-section">
              <p className="app-editor-chip-section-title">Included</p>
              <div className="app-course-chip-cloud">
                {hasDiaryHtmlContent(lessonSummaryHtml) ? (
                  <Badge variant="outline">Lesson Summary</Badge>
                ) : null}
                {hasDiaryHtmlContent(homeworkHtml) ? (
                  <Badge variant="outline">Homework</Badge>
                ) : null}
                {hasDiaryHtmlContent(teacherNoteHtml) ? (
                  <Badge variant="outline">Teacher Note</Badge>
                ) : null}
                {resources.length > 0 ? (
                  <Badge variant="outline">
                    {resources.length} Resource{resources.length === 1 ? "" : "s"}
                  </Badge>
                ) : null}
                {contentCount === 0 ? (
                  <Badge variant="outline">Nothing added yet</Badge>
                ) : null}
              </div>
            </div>

            <div className="app-course-save-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleSubmit("draft")}
                disabled={saving || archiving}
                className="app-course-action-button"
                size="lg"
              >
                <Save className="h-4 w-4" />
                {getSubmitLabel({
                  mode,
                  targetStatus: "draft",
                  saving: savingTarget === "draft",
                })}
              </Button>
              <Button
                type="button"
                onClick={() => void handleSubmit("published")}
                disabled={saving || archiving}
                className="app-course-action-button"
                size="lg"
              >
                <Save className="h-4 w-4" />
                {getSubmitLabel({
                  mode,
                  targetStatus: "published",
                  saving: savingTarget === "published",
                })}
              </Button>
              {mode === "edit" && entryId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleArchive()}
                  disabled={saving || archiving}
                  className="app-course-action-button text-destructive hover:text-destructive"
                  size="lg"
                >
                  <Trash2 className="h-4 w-4" />
                  {archiving ? "Archiving..." : "Archive Diary"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="app-course-action-button"
                onClick={navigateBack}
                disabled={saving || archiving}
                size="lg"
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
