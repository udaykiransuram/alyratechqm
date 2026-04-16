"use client";

import { useEffect, useMemo, useState } from "react";
import { PlusCircle, X } from "lucide-react";

import RichTextEditor from "@/components/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MultiSelectTags, type TagItem } from "@/components/ui/multi-select-tags";
import type {
  LiveSessionItemType,
  LiveSessionTeacherItem,
} from "@/lib/live-sessions/types";

type LiveSessionItemEditorDialogProps = {
  liveSessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: LiveSessionTeacherItem | null;
  onSaved?: () => void;
};

type LiveSessionEditorOption = {
  contentHtml: string;
};

function buildDefaultState(item?: LiveSessionTeacherItem | null) {
  const type = item?.type || "single";
  const options =
    type === "short-text"
      ? []
      : item?.options.map((option) => ({
          contentHtml: option.contentHtml,
        })) || [{ contentHtml: "" }, { contentHtml: "" }];

  return {
    type,
    promptHtml: item?.promptHtml || "",
    options,
    answerIndexes: Array.isArray(item?.answerIndexes) ? item.answerIndexes : [],
    tagIds: Array.isArray(item?.tagIds) ? item.tagIds : [],
    explanationHtml: item?.explanationHtml || "",
  };
}

function getTypeLabel(type: LiveSessionItemType) {
  if (type === "single") {
    return "Single choice";
  }

  if (type === "multiple") {
    return "Multiple choice";
  }

  return "Short text";
}

export default function LiveSessionItemEditorDialog({
  liveSessionId,
  open,
  onOpenChange,
  item,
  onSaved,
}: LiveSessionItemEditorDialogProps) {
  const isEditMode = Boolean(item?._id);
  const [type, setType] = useState<LiveSessionItemType>("single");
  const [promptHtml, setPromptHtml] = useState("");
  const [options, setOptions] = useState<LiveSessionEditorOption[]>([
    { contentHtml: "" },
    { contentHtml: "" },
  ]);
  const [answerIndexes, setAnswerIndexes] = useState<number[]>([]);
  const [availableTags, setAvailableTags] = useState<TagItem[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [explanationHtml, setExplanationHtml] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextState = buildDefaultState(item);
    setType(nextState.type);
    setPromptHtml(nextState.promptHtml);
    setOptions(nextState.options);
    setAnswerIndexes(nextState.answerIndexes);
    setSelectedTagIds(nextState.tagIds);
    setExplanationHtml(nextState.explanationHtml);
    setError(null);
    setIsSaving(false);
  }, [item, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    const loadTags = async () => {
      setIsLoadingTags(true);
      try {
        const response = await fetch("/api/tags");
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        const tags = Array.isArray(data?.tags) ? data.tags : [];
        const normalizedTags: TagItem[] = tags
          .map((tag: any) => ({
            _id: String(tag?._id || "").trim(),
            name: String(tag?.name || "").trim(),
            type: {
              _id: String(tag?.type?._id || "").trim(),
              name: String(tag?.type?.name || "").trim(),
            },
          }))
          .filter((tag: TagItem) => tag._id && tag.name && tag.type?._id && tag.type?.name);
        setAvailableTags(normalizedTags);
      } catch (loadError) {
        if (active) {
          setAvailableTags([]);
        }
      } finally {
        if (active) {
          setIsLoadingTags(false);
        }
      }
    };

    loadTags();

    return () => {
      active = false;
    };
  }, [open]);

  const hasOptions = type === "single" || type === "multiple";
  const dialogTitle = isEditMode ? "Edit live item" : "Create live item";
  const dialogDescription = useMemo(
    () =>
      hasOptions
        ? "Compose a rich-text question, mark the correct answer set, and queue it for the live class."
        : "Compose a rich-text prompt students can answer in their own words during the live class.",
    [hasOptions],
  );

  function handleTypeChange(nextType: LiveSessionItemType) {
    setType(nextType);
    setError(null);

    if (nextType === "short-text") {
      setOptions([]);
      setAnswerIndexes([]);
      return;
    }

    setOptions((current) =>
      current.length >= 2 ? current : [{ contentHtml: "" }, { contentHtml: "" }],
    );
    setAnswerIndexes((current) =>
      nextType === "single" && current.length > 1 ? [current[0]] : current,
    );
  }

  const subskillTags = useMemo(() => {
    const normalizeTagType = (value: string) =>
      value.toLowerCase().replace(/[^a-z0-9]+/g, "");
    return availableTags.filter((tag) => {
      const normalized = normalizeTagType(tag.type?.name || "");
      return normalized === "subskill" || normalized === "subskills";
    });
  }, [availableTags]);

  const selectedTags = useMemo(
    () => subskillTags.filter((tag) => selectedTagIds.includes(tag._id)),
    [selectedTagIds, subskillTags],
  );

  function handleAnswerToggle(index: number) {
    setAnswerIndexes((current) => {
      if (type === "single") {
        return current[0] === index ? [] : [index];
      }

      return current.includes(index)
        ? current.filter((value) => value !== index)
        : [...current, index].sort((left, right) => left - right);
    });
  }

  function handleOptionChange(index: number, contentHtml: string) {
    setOptions((current) =>
      current.map((option, optionIndex) =>
        optionIndex === index ? { contentHtml } : option,
      ),
    );
  }

  function handleAddOption() {
    setOptions((current) => [...current, { contentHtml: "" }]);
  }

  function handleRemoveOption(index: number) {
    if (options.length <= 2) {
      return;
    }

    setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index));
    setAnswerIndexes((current) =>
      current
        .filter((value) => value !== index)
        .map((value) => (value > index ? value - 1 : value)),
    );
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch(
        isEditMode
          ? `/api/live-sessions/${liveSessionId}/items/${item?._id}`
          : `/api/live-sessions/${liveSessionId}/items`,
        {
          method: isEditMode ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type,
            promptHtml,
            options,
            answerIndexes,
            tagIds: selectedTagIds,
            explanationHtml,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success) {
        setError(String(payload?.message || "Failed to save the live item.").trim());
        setIsSaving(false);
        return;
      }

      onSaved?.();
      onOpenChange(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save the live item.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(92vw,72rem)] overflow-y-auto sm:bg-transparent sm:border-0 sm:shadow-none sm:p-0">
        <div className="app-surface overflow-hidden">
          <div className="app-section-header">
            <DialogHeader>
              <DialogTitle>{dialogTitle}</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </DialogHeader>
          </div>

          <div className="app-section-body space-y-5">
            <section className="app-section">
              <div className="space-y-2">
                <Label>Live item type</Label>
                <div className="flex flex-wrap gap-2">
                  {(["single", "multiple", "short-text"] as LiveSessionItemType[]).map(
                    (value) => (
                      <Button
                        key={value}
                        type="button"
                        variant={type === value ? "default" : "outline"}
                        size="sm"
                        className="app-button-compact"
                        onClick={() => handleTypeChange(value)}
                        disabled={isSaving}
                      >
                        {getTypeLabel(value)}
                      </Button>
                    ),
                  )}
                </div>
              </div>
            </section>

            <section className="app-section">
              <div className="space-y-2">
                <Label>Prompt</Label>
                <RichTextEditor
                  initialContent={promptHtml}
                  onChange={setPromptHtml}
                  editorKey={`${item?._id || "new"}-prompt-${type}`}
                  imageUploadEndpoint="/api/live-sessions/images"
                />
              </div>
            </section>

            <section className="app-section space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Tags (subskill)</Label>
                <span className="text-xs text-muted-foreground">
                  Used for attentiveness and recovery practice.
                </span>
              </div>
              <MultiSelectTags
                selectedTags={selectedTags}
                allTags={subskillTags}
                onSelectedTagsChange={(nextTags) =>
                  setSelectedTagIds(nextTags.map((tag) => tag._id))
                }
                isLoading={isLoadingTags}
                disabled={isSaving}
              />
              {subskillTags.length === 0 && !isLoadingTags ? (
                <p className="text-xs text-muted-foreground">
                  No subskill tags available yet. Create subskill tags to enable live recovery.
                </p>
              ) : null}
            </section>

            {hasOptions ? (
              <section className="app-section space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Label>Answer options</Label>
                    <p className="text-xs text-muted-foreground">
                      {type === "single"
                        ? "Choose one correct option."
                        : "Choose all correct options."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="app-button-compact"
                    onClick={handleAddOption}
                    disabled={isSaving}
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add option
                  </Button>
                </div>

                <div className="space-y-3">
                  {options.map((option, index) => (
                    <div
                      key={`option-${index}`}
                      className="app-exam-option"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-start gap-2 text-[13px] font-semibold text-foreground">
                          <Checkbox
                            checked={answerIndexes.includes(index)}
                            onCheckedChange={() => handleAnswerToggle(index)}
                            disabled={isSaving}
                          />
                          <span>
                            {type === "single" ? "Correct option" : "Correct answer"}
                          </span>
                        </label>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => handleRemoveOption(index)}
                          disabled={isSaving || options.length <= 2}
                          aria-label={`Remove option ${index + 1}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="app-exam-option-content">
                        <RichTextEditor
                          initialContent={option.contentHtml}
                          onChange={(value) => handleOptionChange(index, value)}
                          editorKey={`${item?._id || "new"}-option-${index}-${type}`}
                          compact
                          imageUploadEndpoint="/api/live-sessions/images"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="app-section">
              <div className="space-y-2">
                <Label>Explanation</Label>
                <RichTextEditor
                  initialContent={explanationHtml}
                  onChange={setExplanationHtml}
                  editorKey={`${item?._id || "new"}-explanation-${type}`}
                  compact
                  imageUploadEndpoint="/api/live-sessions/images"
                />
              </div>
            </section>

            {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}
          </div>

          <DialogFooter className="border-t border-border/70 px-4 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : isEditMode ? "Save live item" : "Create live item"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
