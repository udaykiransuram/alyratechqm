"use client";

import { useEffect, useMemo, useState } from "react";
import { PlusCircle, X } from "lucide-react";

import { QuestionFilterPopup } from "@/components/QuestionFilterPopup";
import RichTextEditor from "@/components/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/components/ui/use-toast";
import { fetchApiJson, isAbortError } from "@/lib/client/api";
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

type ExistingQuestionSummary = {
  _id: string;
  content: string;
  subject?: { _id?: string; name?: string } | string | null;
  class?: { _id?: string; name?: string } | string | null;
  tags?: TagItem[];
  options?: Array<{ content?: string | null }>;
  answerIndexes?: number[];
  explanation?: string;
  marks?: number;
  createdAt?: string;
  type: "single" | "multiple" | "matrix-match" | "descriptive" | string;
  detailLevel?: "summary" | "full";
};

type ClassOption = {
  _id: string;
  name: string;
};

type SubjectOption = {
  _id: string;
  name: string;
  tags?: TagItem[];
};

type QuestionPickerResponse = {
  success?: boolean;
  questions?: ExistingQuestionSummary[];
  total?: number;
  page?: number;
  pages?: number;
};

const QUESTION_PICKER_PAGE_SIZE = 12;

function isSubskillTag(tag: TagItem) {
  const normalized = String(tag?.type?.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return normalized === "subskill" || normalized === "subskills";
}

function mapQuestionTypeToLiveItemType(questionType: string): LiveSessionItemType | null {
  if (questionType === "single" || questionType === "multiple") {
    return questionType;
  }

  if (questionType === "descriptive") {
    return "short-text";
  }

  return null;
}

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

function normalizeTagList(tags: unknown): TagItem[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((tag) => ({
      _id: String((tag as any)?._id || "").trim(),
      name: String((tag as any)?.name || "").trim(),
      type: {
        _id: String((tag as any)?.type?._id || "").trim(),
        name: String((tag as any)?.type?.name || "").trim(),
      },
    }))
    .filter(
      (tag: TagItem) => tag._id && tag.name && tag.type?._id && tag.type?.name,
    );
}

function getRichTextTextLength(value: string) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .trim().length;
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
  const { toast } = useToast();
  const isEditMode = Boolean(item?._id);
  const [type, setType] = useState<LiveSessionItemType>("single");
  const [promptHtml, setPromptHtml] = useState("");
  const [options, setOptions] = useState<LiveSessionEditorOption[]>([
    { contentHtml: "" },
    { contentHtml: "" },
  ]);
  const [answerIndexes, setAnswerIndexes] = useState<number[]>([]);
  const [availableTags, setAvailableTags] = useState<TagItem[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [questionFilterSubjects, setQuestionFilterSubjects] = useState<SubjectOption[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [initialDataLoading, setInitialDataLoading] = useState(false);
  const [questionFilterSubjectsLoading, setQuestionFilterSubjectsLoading] = useState(false);
  const [explanationHtml, setExplanationHtml] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isQuestionPickerOpen, setIsQuestionPickerOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [selectedFilterTags, setSelectedFilterTags] = useState<TagItem[]>([]);
  const [questionTagMatchMode, setQuestionTagMatchMode] = useState<"any" | "all">("any");
  const [questionFilterClassId, setQuestionFilterClassId] = useState("all");
  const [questionFilterSubjectId, setQuestionFilterSubjectId] = useState("all");
  const [questionPage, setQuestionPage] = useState(1);
  const [questionPageCount, setQuestionPageCount] = useState(1);
  const [questionResultCount, setQuestionResultCount] = useState(0);
  const [availableQuestions, setAvailableQuestions] = useState<ExistingQuestionSummary[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<(string | number)[]>([]);
  const [confirmingQuestions, setConfirmingQuestions] = useState(false);
  const [importingQuestionId, setImportingQuestionId] = useState<string | null>(null);
  const selectedFilterTagIdsKey = useMemo(
    () =>
      selectedFilterTags
        .map((tag) => String(tag._id || ""))
        .filter(Boolean)
        .sort()
        .join(","),
    [selectedFilterTags],
  );

  useEffect(() => {
    if (!open) {
      setIsQuestionPickerOpen(false);
      setImportingQuestionId(null);
      setConfirmingQuestions(false);
      setSelectedQuestionIds([]);
      setModalSearch("");
      setSelectedFilterTags([]);
      setQuestionTagMatchMode("any");
      setQuestionFilterClassId("all");
      setQuestionFilterSubjectId("all");
      setQuestionPage(1);
      setQuestionPageCount(1);
      setQuestionResultCount(0);
      setAvailableQuestions([]);
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
    const loadSupportData = async () => {
      setInitialDataLoading(true);
      try {
        const [classesData, tagsData, subjectsData] = await Promise.all([
          fetchApiJson<{ classes?: ClassOption[] }>("/api/classes", {
            cache: "no-store",
            fallbackMessage: "Could not load classes for the question bank.",
          }),
          fetchApiJson<{ tags?: TagItem[] }>("/api/tags/with-subjects", {
            cache: "no-store",
            fallbackMessage: "Could not load tags for the question bank.",
          }),
          fetchApiJson<{ subjects?: SubjectOption[] }>("/api/subjects", {
            cache: "no-store",
            fallbackMessage: "Could not load subjects for the question bank.",
          }),
        ]);

        if (!active) {
          return;
        }

        const normalizedTags = normalizeTagList(tagsData?.tags);
        const nextSubjects = Array.isArray(subjectsData?.subjects)
          ? subjectsData.subjects
          : [];

        setClasses(Array.isArray(classesData?.classes) ? classesData.classes : []);
        setAvailableTags(normalizedTags);
        setSubjects(nextSubjects);
        setQuestionFilterSubjects(nextSubjects);
      } catch (loadError) {
        if (!active || isAbortError(loadError)) {
          return;
        }

        toast({
          title: "Question filters unavailable",
          description:
            loadError instanceof Error
              ? loadError.message
              : "Could not load the question filter data.",
          variant: "destructive",
        });
      } finally {
        if (active) {
          setInitialDataLoading(false);
        }
      }
    };

    void loadSupportData();

    return () => {
      active = false;
    };
  }, [open, toast]);

  useEffect(() => {
    if (questionFilterClassId === "all") {
      setQuestionFilterSubjects(subjects);
      setQuestionFilterSubjectId((current) =>
        current === "all" || subjects.some((subject) => subject._id === current)
          ? current
          : "all",
      );
      setQuestionFilterSubjectsLoading(false);
      return;
    }

    if (!isQuestionPickerOpen) {
      return;
    }

    const abortController = new AbortController();
    setQuestionFilterSubjectsLoading(true);

    fetchApiJson<{ subjects?: SubjectOption[] }>(
      `/api/subjects?classId=${questionFilterClassId}`,
      {
        signal: abortController.signal,
        cache: "no-store",
        fallbackMessage: "Could not load subjects for the selected class.",
      },
    )
      .then((data) => {
        const nextSubjects = Array.isArray(data?.subjects) ? data.subjects : [];
        setQuestionFilterSubjects(nextSubjects);
        setQuestionFilterSubjectId((current) =>
          current === "all" || nextSubjects.some((subject) => subject._id === current)
            ? current
            : "all",
        );
      })
      .catch((loadError) => {
        if (isAbortError(loadError)) {
          return;
        }

        setQuestionFilterSubjects([]);
        setQuestionFilterSubjectId("all");
        toast({
          title: "Subject filters unavailable",
          description:
            loadError instanceof Error
              ? loadError.message
              : "Could not load subjects for the selected class.",
          variant: "destructive",
        });
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setQuestionFilterSubjectsLoading(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [isQuestionPickerOpen, questionFilterClassId, subjects, toast]);

  useEffect(() => {
    if (!isQuestionPickerOpen) {
      setIsLoadingQuestions(false);
      setAvailableQuestions([]);
      setQuestionResultCount(0);
      setQuestionPageCount(1);
      return;
    }

    const abortController = new AbortController();
    const searchParams = new URLSearchParams({
      view: "picker",
      page: String(questionPage),
      limit: String(QUESTION_PICKER_PAGE_SIZE),
      sort: "createdAt",
      order: "desc",
      types: "single,multiple,descriptive",
    });

    if (questionFilterClassId !== "all") {
      searchParams.set("class", questionFilterClassId);
    }

    if (questionFilterSubjectId !== "all") {
      searchParams.set("subject", questionFilterSubjectId);
    }

    if (selectedFilterTagIdsKey) {
      searchParams.set("tags", selectedFilterTagIdsKey);
      searchParams.set("tagsMode", questionTagMatchMode === "all" ? "and" : "or");
    }

    const trimmedSearch = modalSearch.trim();
    if (trimmedSearch) {
      searchParams.set("search", trimmedSearch);
    }

    setIsLoadingQuestions(true);

    fetchApiJson<QuestionPickerResponse>(`/api/questions?${searchParams.toString()}`, {
      signal: abortController.signal,
      cache: "no-store",
      fallbackMessage: "Could not load questions for the current filters.",
    })
      .then((payload) => {
        const questions = Array.isArray(payload?.questions) ? payload.questions : [];
        setAvailableQuestions(questions);
        setQuestionResultCount(
          Number.isFinite(Number(payload?.total)) ? Number(payload.total) : questions.length,
        );
        setQuestionPageCount(
          Math.max(1, Number.isFinite(Number(payload?.pages)) ? Number(payload.pages) : 1),
        );
      })
      .catch((loadError) => {
        if (isAbortError(loadError)) {
          return;
        }

        setAvailableQuestions([]);
        setQuestionResultCount(0);
        setQuestionPageCount(1);
        toast({
          title: "Question bank load failed",
          description:
            loadError instanceof Error
              ? loadError.message
              : "Could not load questions for the current filters.",
          variant: "destructive",
        });
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoadingQuestions(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [
    isQuestionPickerOpen,
    modalSearch,
    questionFilterClassId,
    questionFilterSubjectId,
    questionPage,
    questionTagMatchMode,
    selectedFilterTagIdsKey,
    toast,
  ]);

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

  const selectedSubskillTags = useMemo(
    () => subskillTags.filter((tag) => selectedTagIds.includes(tag._id)),
    [selectedTagIds, subskillTags],
  );
  const hasPromptContent = getRichTextTextLength(promptHtml) > 0;
  const explanationLength = getRichTextTextLength(explanationHtml);
  const completedOptionCount = hasOptions
    ? options.filter((option) => getRichTextTextLength(option.contentHtml) > 0).length
    : 0;
  const footerSummary = hasOptions
    ? `${options.length} option${options.length === 1 ? "" : "s"} • ${answerIndexes.length} correct`
    : explanationLength > 0
      ? "Written response • explanation added"
      : "Written response • teacher review";

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

  async function handleImportExistingQuestion(questionId: string) {
    setImportingQuestionId(questionId);

    try {
      const payload = await fetchApiJson<{
        success?: boolean;
        question?: ExistingQuestionSummary;
        message?: string;
      }>(`/api/questions/${questionId}`, {
        cache: "no-store",
      });

      if (!payload?.success || !payload?.question) {
        throw new Error(String(payload?.message || "Could not load the selected question."));
      }

      const question = payload.question as ExistingQuestionSummary;
      const nextType = mapQuestionTypeToLiveItemType(String(question.type || ""));

      if (!nextType) {
        throw new Error(
          "Only single choice, multiple choice, and descriptive questions can be imported.",
        );
      }

      setType(nextType);
      setPromptHtml(String(question.content || ""));
      setOptions(
        nextType === "short-text"
          ? []
          : Array.isArray(question.options) && question.options.length > 0
            ? question.options.map((option) => ({
                contentHtml: String(option?.content || ""),
              }))
            : [{ contentHtml: "" }, { contentHtml: "" }],
      );
      setAnswerIndexes(
        nextType === "short-text"
          ? []
          : Array.isArray(question.answerIndexes)
            ? question.answerIndexes
            : [],
      );
      setSelectedTagIds(
        Array.isArray(question.tags)
          ? question.tags.filter(isSubskillTag).map((tag) => tag._id)
          : [],
      );
      setExplanationHtml(String(question.explanation || ""));
      setError(null);
      setIsQuestionPickerOpen(false);
      setSelectedQuestionIds([]);
      setModalSearch("");
      setSelectedFilterTags([]);
      setQuestionTagMatchMode("any");
      setQuestionFilterClassId("all");
      setQuestionFilterSubjectId("all");
      setQuestionPage(1);
    } catch (importError) {
      toast({
        title: "Question import failed",
        description:
          importError instanceof Error
            ? importError.message
            : "Could not import the selected question.",
        variant: "destructive",
      });
    } finally {
      setImportingQuestionId(null);
    }
  }

  async function handleConfirmQuestions() {
    if (confirmingQuestions || importingQuestionId) {
      return;
    }

    if (selectedQuestionIds.length !== 1) {
      toast({
        title: "Select one question",
        description: "Choose exactly one existing question to import into this live item.",
        variant: "destructive",
      });
      return;
    }

    setConfirmingQuestions(true);
    try {
      await handleImportExistingQuestion(String(selectedQuestionIds[0]));
    } finally {
      setConfirmingQuestions(false);
    }
  }

  async function handleEditQuestionSave(updatedQuestion: ExistingQuestionSummary) {
    setAvailableQuestions((currentQuestions) =>
      currentQuestions.map((question) =>
        String(question._id) === String(updatedQuestion._id) ? updatedQuestion : question,
      ),
    );
  }

  function openQuestionPicker() {
    setSelectedQuestionIds([]);
    setModalSearch("");
    setSelectedFilterTags([]);
    setQuestionTagMatchMode("any");
    setQuestionFilterClassId("all");
    setQuestionFilterSubjectId("all");
    setQuestionFilterSubjects(subjects);
    setQuestionPage(1);
    setIsQuestionPickerOpen(true);
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden p-0 sm:h-[min(92vh,900px)] sm:max-h-[min(92vh,900px)] sm:w-[min(96vw,1280px)] sm:max-w-[1280px]"
          onInteractOutside={(event) => {
            if (
              (event.target as HTMLElement).closest(".tag-popover-content") ||
              (event.target as HTMLElement).closest("[data-tag-popover]")
            ) {
              event.preventDefault();
            }
          }}
        >
          <DialogHeader className="border-b border-border/60 bg-muted/20 px-4 py-3.5 pr-12 text-left sm:px-5 sm:pr-14">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="app-kicker">Live item builder</span>
                  <span className="app-meta-chip">
                    {isEditMode ? "Editing saved item" : "New live item"}
                  </span>
                  <span className="app-meta-chip">{getTypeLabel(type)}</span>
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-lg sm:text-xl">{dialogTitle}</DialogTitle>
                  <DialogDescription className="max-w-3xl">
                    {dialogDescription}
                  </DialogDescription>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="app-meta-chip">
                    {hasPromptContent ? "Prompt ready" : "Add prompt"}
                  </span>
                  <span className="app-meta-chip">
                    {hasOptions
                      ? `${completedOptionCount}/${options.length} options filled`
                      : "Short-text response"}
                  </span>
                  <span className="app-meta-chip">
                    {selectedSubskillTags.length} subskill tag
                    {selectedSubskillTags.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[248px]">
                <Button
                  type="button"
                  variant="outline"
                  className="app-button-inline w-full"
                  onClick={openQuestionPicker}
                  disabled={isSaving}
                >
                  Import from Question Bank
                </Button>
                <p className="text-xs leading-5 text-muted-foreground sm:max-w-[248px]">
                  Start from an existing question, then adjust the prompt, answers, and explanation
                  before saving.
                </p>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden bg-muted/20 p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <main className="min-h-0 space-y-3 overflow-y-auto pr-1">
                <Card className="app-surface overflow-hidden shadow-none">
                  <CardContent className="app-section-body">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:items-start">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="app-kicker">Quick Start</p>
                          <h3 className="text-base font-semibold text-foreground">
                            Choose the easiest starting point
                          </h3>
                          <p className="text-sm leading-6 text-muted-foreground">
                            Build this item from scratch or import a question-bank item first. You
                            can still edit everything below before saving.
                          </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="rounded-[1rem] border border-border/60 bg-background/80 px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              1. Start
                            </p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              Pick a type or import
                            </p>
                          </div>
                          <div className="rounded-[1rem] border border-border/60 bg-background/80 px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              2. Build
                            </p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              Write the prompt and answers
                            </p>
                          </div>
                          <div className="rounded-[1rem] border border-border/60 bg-background/80 px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              3. Review
                            </p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              Check the answer key and save
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                        <button
                          type="button"
                          onClick={openQuestionPicker}
                          disabled={isSaving}
                          className="rounded-[1.15rem] border border-border/70 bg-[hsl(var(--app-surface-1)/0.94)] px-4 py-3 text-left transition-colors hover:border-primary/35 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="app-status-badge app-status-badge-info">
                              Fastest
                            </span>
                            <span className="app-meta-chip">Reuse bank content</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-foreground">
                            Import existing question
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Pull in the prompt, options, answers, and explanation, then make quick
                            edits here.
                          </p>
                        </button>

                        <div className="rounded-[1.15rem] border border-border/70 bg-[hsl(var(--app-surface-1)/0.88)] px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="app-status-badge app-status-badge-neutral">
                              Flexible
                            </span>
                            <span className="app-meta-chip">Blank canvas</span>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-foreground">
                            Start from scratch
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Use the editor below to write a fresh live question and supporting
                            explanation.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="app-surface overflow-hidden shadow-none">
                  <CardHeader className="app-section-header py-3.5">
                    <div className="space-y-1.5">
                      <p className="app-kicker">Step 1</p>
                      <CardTitle>Prompt</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Students will see this live prompt exactly as written here.
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="app-section-body">
                    <RichTextEditor
                      compact
                      initialContent={promptHtml}
                      onChange={setPromptHtml}
                      editorKey={`${item?._id || "new"}-prompt-${type}`}
                      imageUploadEndpoint="/api/live-sessions/images"
                    />
                  </CardContent>
                </Card>

                {hasOptions ? (
                  <Card className="app-surface overflow-hidden shadow-none">
                    <CardHeader className="app-section-header py-3.5">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-1.5">
                            <p className="app-kicker">Step 2</p>
                            <CardTitle>Answer Options</CardTitle>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleAddOption}
                            className="app-button-inline w-full sm:w-auto"
                            disabled={isSaving}
                          >
                            <PlusCircle className="h-4 w-4" />
                            Add Option
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {type === "single"
                            ? "Choose one correct option and keep each answer easy to scan."
                            : "Choose all correct options and mark the exact answer set."}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="app-section-body space-y-3">
                      {options.map((option, index) => (
                        <div
                          key={`option-${index}`}
                          className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/10 p-2.5"
                        >
                          <div className="flex flex-col items-center gap-2 pt-1">
                            <Checkbox
                              checked={answerIndexes.includes(index)}
                              onCheckedChange={() => handleAnswerToggle(index)}
                              disabled={isSaving}
                            />
                            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              {index + 1}
                            </span>
                          </div>
                          <div className="flex-1">
                            <RichTextEditor
                              compact
                              initialContent={option.contentHtml}
                              onChange={(value) => handleOptionChange(index, value)}
                              editorKey={`${item?._id || "new"}-option-${index}-${type}`}
                              imageUploadEndpoint="/api/live-sessions/images"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveOption(index)}
                            className="mt-1 text-muted-foreground hover:text-destructive"
                            disabled={isSaving || options.length <= 2}
                            aria-label={`Remove option ${index + 1}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="app-surface overflow-hidden shadow-none">
                    <CardHeader className="app-section-header py-3.5">
                      <div className="space-y-1.5">
                        <p className="app-kicker">Step 2</p>
                        <CardTitle>Written Response</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Students answer this prompt in their own words while the item stays
                          active.
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="app-section-body">
                      <div className="rounded-[1rem] border border-dashed border-border/70 bg-muted/10 px-4 py-4 text-sm leading-6 text-muted-foreground">
                        There is no option list for short-text prompts. Teachers review responses
                        manually after class.
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="app-surface overflow-hidden shadow-none">
                  <CardHeader className="app-section-header py-3.5">
                    <div className="space-y-1.5">
                      <p className="app-kicker">Optional</p>
                      <CardTitle>Explanation</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Add a follow-up explanation or solution students can review after the item
                        is discussed.
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="app-section-body">
                    <RichTextEditor
                      compact
                      initialContent={explanationHtml}
                      onChange={setExplanationHtml}
                      editorKey={`${item?._id || "new"}-explanation-${type}`}
                      imageUploadEndpoint="/api/live-sessions/images"
                    />
                  </CardContent>
                </Card>
              </main>

              <aside className="min-h-0 space-y-3 overflow-y-auto xl:overflow-visible">
                <Card className="app-surface overflow-hidden shadow-none">
                  <CardHeader className="app-section-header py-3.5">
                    <div className="space-y-1.5">
                      <p className="app-kicker">Overview</p>
                      <CardTitle>Quick setup</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Keep the essentials visible while you build the live item.
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="app-section-body space-y-4">
                    <div className="app-field-group">
                      <Label className="app-field-label">Live Item Type</Label>
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

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-[1rem] border border-border/60 bg-background/80 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Prompt
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {hasPromptContent ? "Ready" : "Draft"}
                        </p>
                      </div>
                      <div className="rounded-[1rem] border border-border/60 bg-background/80 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Response
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {type === "single"
                            ? "One answer"
                            : type === "multiple"
                              ? "Multiple answers"
                              : "Written reply"}
                        </p>
                      </div>
                      <div className="rounded-[1rem] border border-border/60 bg-background/80 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Answer Key
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {hasOptions
                            ? answerIndexes.length > 0
                              ? `${answerIndexes.length} marked`
                              : "Not set"
                            : "Review only"}
                        </p>
                      </div>
                      <div className="rounded-[1rem] border border-border/60 bg-background/80 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Explanation
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {explanationLength > 0 ? "Added" : "Optional"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="app-surface overflow-hidden shadow-none">
                  <CardHeader className="app-section-header py-3.5">
                    <div className="space-y-1.5">
                      <p className="app-kicker">Recovery</p>
                      <CardTitle>Subskill Tags</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Tag the item so follow-up recovery and attentiveness practice stay targeted.
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="app-section-body space-y-3">
                    <MultiSelectTags
                      selectedTags={selectedSubskillTags}
                      allTags={subskillTags}
                      onSelectedTagsChange={(nextTags) =>
                        setSelectedTagIds(nextTags.map((tag) => tag._id))
                      }
                      isLoading={initialDataLoading}
                      disabled={isSaving}
                    />
                    {subskillTags.length === 0 && !initialDataLoading ? (
                      <p className="text-xs text-muted-foreground">
                        No subskill tags are available yet. Create them to enable live recovery
                        tracking.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>

                {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}
              </aside>
            </div>

            <DialogFooter className="border-t border-border/60 bg-muted/10 px-4 py-3 sm:px-5">
              <div className="mr-auto flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="app-meta-chip">{getTypeLabel(type)}</span>
                <span className="app-meta-chip">{footerSummary}</span>
              </div>
              <Button
                variant="outline"
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : isEditMode ? "Save Live Item" : "Create Live Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <QuestionFilterPopup
        open={isQuestionPickerOpen}
        onOpenChange={(nextOpen) => {
          setIsQuestionPickerOpen(nextOpen);
          if (!nextOpen) {
            setImportingQuestionId(null);
            setConfirmingQuestions(false);
            setSelectedQuestionIds([]);
            setModalSearch("");
            setSelectedFilterTags([]);
            setQuestionTagMatchMode("any");
            setQuestionFilterClassId("all");
            setQuestionFilterSubjectId("all");
            setQuestionFilterSubjects(subjects);
            setQuestionPage(1);
          }
        }}
        classes={classes}
        classId={questionFilterClassId}
        setClassId={(id) => {
          setQuestionPage(1);
          setQuestionFilterClassId(String(id));
        }}
        subjects={questionFilterSubjects}
        subjectId={questionFilterSubjectId}
        setSubjectId={(id) => {
          setQuestionPage(1);
          setQuestionFilterSubjectId(String(id));
        }}
        subjectsLoading={initialDataLoading || questionFilterSubjectsLoading}
        allTags={availableTags}
        selectedTags={selectedFilterTags}
        setSelectedTags={(tags) => {
          setQuestionPage(1);
          setSelectedFilterTags(tags);
        }}
        questionTagMatchMode={questionTagMatchMode}
        setQuestionTagMatchMode={setQuestionTagMatchMode}
        initialDataLoading={initialDataLoading}
        modalSearch={modalSearch}
        setModalSearch={setModalSearch}
        loadingQuestions={isLoadingQuestions}
        modalAvailableQuestions={availableQuestions}
        questionResultCount={questionResultCount}
        questionPage={questionPage}
        setQuestionPage={setQuestionPage}
        questionPageCount={questionPageCount}
        questionPageSize={QUESTION_PICKER_PAGE_SIZE}
        selectedQuestionIds={selectedQuestionIds}
        setSelectedQuestionIds={setSelectedQuestionIds}
        handleConfirmQuestions={handleConfirmQuestions}
        handleSelectAllFilteredQuestions={async () => {
          toast({
            title: "Select one question",
            description: "This import flow supports one existing question at a time.",
            variant: "destructive",
          });
        }}
        confirmingQuestions={confirmingQuestions || Boolean(importingQuestionId)}
        selectingAllFilteredQuestions={false}
        toast={toast}
        handleEditQuestionSave={handleEditQuestionSave}
        selectionMode="single"
        title="Select Existing Question"
        description="Import one question-bank item into this live prompt. Single choice, multiple choice, and descriptive questions are supported."
        confirmLabel="Import Selected Question"
      />
    </>
  );
}
