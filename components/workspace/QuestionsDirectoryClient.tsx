"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";

import type { Question } from "@/components/question-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SearchableCommandOption } from "@/components/ui/searchable-command-select";
import { useToast } from "@/components/ui/use-toast";
import ListPagination from "@/components/ui/list-pagination";
import { fetchApiJson } from "@/lib/client/api";

const SearchableCommandSelect = dynamic(
  () =>
    import("@/components/ui/searchable-command-select").then(
      (module) => module.SearchableCommandSelect,
    ),
  {
    ssr: false,
    loading: () => <div className="h-11 rounded-xl border border-border/60 bg-muted/30" />,
  },
);

const SearchableMultiSelectPopover = dynamic(
  () =>
    import("@/components/ui/searchable-multi-select-popover").then(
      (module) => module.SearchableMultiSelectPopover,
    ),
  {
    ssr: false,
    loading: () => <div className="h-11 rounded-xl border border-border/60 bg-muted/30" />,
  },
);

const QuestionResultsList = dynamic(
  () => import("@/components/workspace/questions/QuestionResultsList"),
);

const QuestionArchiveDialog = dynamic(
  () => import("@/components/workspace/questions/QuestionArchiveDialog"),
);

type FilterOption = {
  _id: string;
  name: string;
  type?: {
    _id: string;
    name: string;
  } | null;
};

type QuestionBankFilters = {
  classId: string;
  subjectId: string;
  selectedTagIds: string[];
  questionTagMatchMode: "any" | "all";
  search: string;
};

export type QuestionsDirectoryClientProps = {
  questions: Question[];
  classes: FilterOption[];
  tags: FilterOption[];
  subjects: FilterOption[];
  schoolKey: string;
  totalQuestions: number;
  page: number;
  pages: number;
  pageSize: number;
  initialClassFilterId: string;
  initialSubjectFilterId: string;
  initialSearch: string;
  initialTagIds: string[];
  initialTagMode: "any" | "all";
  basePath: string;
};

const ALL_CLASSES_VALUE = "__all_classes__";
const ALL_SUBJECTS_VALUE = "__all_subjects__";

function normalizeFilters(filters: QuestionBankFilters): QuestionBankFilters {
  return {
    ...filters,
    search: filters.search.trim(),
    selectedTagIds: [...filters.selectedTagIds].sort(),
    questionTagMatchMode:
      filters.selectedTagIds.length > 1 ? filters.questionTagMatchMode : "all",
  };
}

function areFiltersEqual(left: QuestionBankFilters, right: QuestionBankFilters) {
  const normalizedLeft = normalizeFilters(left);
  const normalizedRight = normalizeFilters(right);

  return (
    normalizedLeft.classId === normalizedRight.classId &&
    normalizedLeft.subjectId === normalizedRight.subjectId &&
    normalizedLeft.search === normalizedRight.search &&
    normalizedLeft.questionTagMatchMode === normalizedRight.questionTagMatchMode &&
    normalizedLeft.selectedTagIds.length === normalizedRight.selectedTagIds.length &&
    normalizedLeft.selectedTagIds.every(
      (tagId, index) => tagId === normalizedRight.selectedTagIds[index],
    )
  );
}

function countActiveFilters(filters: QuestionBankFilters) {
  return (
    (filters.classId ? 1 : 0) +
    (filters.subjectId ? 1 : 0) +
    (filters.selectedTagIds.length > 0 ? 1 : 0) +
    (filters.search.trim() ? 1 : 0)
  );
}

export default function QuestionsDirectoryClient({
  questions,
  classes,
  tags,
  subjects,
  schoolKey,
  totalQuestions,
  page,
  pages,
  pageSize,
  initialClassFilterId,
  initialSubjectFilterId,
  initialSearch,
  initialTagIds,
  initialTagMode,
  basePath,
}: QuestionsDirectoryClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const hasSyncedServerPropsRef = useRef(false);

  const [rows, setRows] = useState<Question[]>(questions);
  const [subjectsState, setSubjectsState] = useState<FilterOption[]>(subjects);
  const [loadedSubjectsClassId, setLoadedSubjectsClassId] = useState(
    initialClassFilterId,
  );
  const [setupNotice, setSetupNotice] = useState<string | null>(null);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [questionToArchive, setQuestionToArchive] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [draftFilters, setDraftFilters] = useState<QuestionBankFilters>({
    classId: initialClassFilterId || "",
    subjectId: initialSubjectFilterId || "",
    selectedTagIds: initialTagIds,
    questionTagMatchMode: initialTagMode,
    search: initialSearch || "",
  });

  const [appliedFilters, setAppliedFilters] = useState<QuestionBankFilters>({
    classId: initialClassFilterId || "",
    subjectId: initialSubjectFilterId || "",
    selectedTagIds: initialTagIds,
    questionTagMatchMode: initialTagMode,
    search: initialSearch || "",
  });

  useEffect(() => {
    if (!hasSyncedServerPropsRef.current) {
      hasSyncedServerPropsRef.current = true;
      return;
    }

    setRows(questions);
    setSubjectsState(subjects);
    setLoadedSubjectsClassId(initialClassFilterId || "");

    const nextFilters = {
      classId: initialClassFilterId || "",
      subjectId: initialSubjectFilterId || "",
      selectedTagIds: initialTagIds,
      questionTagMatchMode: initialTagMode,
      search: initialSearch || "",
    } satisfies QuestionBankFilters;

    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [
    initialClassFilterId,
    initialSearch,
    initialSubjectFilterId,
    initialTagIds,
    initialTagMode,
    questions,
    subjects,
  ]);

  useEffect(() => {
    const currentClassId = draftFilters.classId;
    if (!currentClassId) {
      setSubjectsState(subjects);
      setLoadedSubjectsClassId("");
      setSetupNotice(null);
      return;
    }

    if (currentClassId === loadedSubjectsClassId) {
      return;
    }

    let active = true;
    void (async () => {
      try {
        const data = await fetchApiJson<any>(
          `/api/subjects?classId=${encodeURIComponent(currentClassId)}`,
          {
            cache: "no-store",
            schoolKey,
            fallbackMessage: "Failed to load subjects.",
          },
        );
        if (!active) return;

        const nextSubjects = Array.isArray(data?.subjects) ? data.subjects : [];
        setSubjectsState(nextSubjects);
        setLoadedSubjectsClassId(currentClassId);
        setSetupNotice(null);

        setDraftFilters((current) => {
          if (!current.subjectId) return current;
          const subjectStillPresent = nextSubjects.some(
            (subject: FilterOption) => subject._id === current.subjectId,
          );
          return subjectStillPresent ? current : { ...current, subjectId: "" };
        });
      } catch {
        if (!active) return;
        setSubjectsState([]);
        setLoadedSubjectsClassId(currentClassId);
        setSetupNotice(
          "Subject options could not be loaded. You can still filter by class, tags, and search.",
        );
      }
    })();

    return () => {
      active = false;
    };
  }, [draftFilters.classId, loadedSubjectsClassId, schoolKey, subjects]);

  const classFilterOptions = useMemo<SearchableCommandOption[]>(
    () => [
      {
        value: ALL_CLASSES_VALUE,
        label: "All classes",
        description: "Browse questions across every class.",
      },
      ...classes.map((classOption) => ({
        value: classOption._id,
        label: classOption.name,
      })),
    ],
    [classes],
  );

  const subjectFilterOptions = useMemo<SearchableCommandOption[]>(
    () => [
      {
        value: ALL_SUBJECTS_VALUE,
        label: "All subjects",
        description: "Include every available subject for the current class scope.",
      },
      ...subjectsState.map((subjectOption) => ({
        value: subjectOption._id,
        label: subjectOption.name,
      })),
    ],
    [subjectsState],
  );

  const tagOptions = useMemo(
    () =>
      tags.map((tag) => ({
        value: tag._id,
        label: tag.name,
        description: tag.type?.name || undefined,
        keywords: tag.type?.name ? [tag.type.name] : [],
      })),
    [tags],
  );

  const hasPendingFilterChanges = !areFiltersEqual(draftFilters, appliedFilters);
  const hasAnyAppliedFilters = countActiveFilters(appliedFilters) > 0;

  const pushWithFilters = useCallback(
    (
      filters: QuestionBankFilters,
      nextPage = 1,
      options?: { preserveScroll?: boolean },
    ) => {
      const normalized = normalizeFilters(filters);
      const searchParams = new URLSearchParams();

      if (normalized.classId) searchParams.set("class", normalized.classId);
      if (normalized.subjectId) searchParams.set("subject", normalized.subjectId);
      if (normalized.selectedTagIds.length > 0) {
        searchParams.set("tags", normalized.selectedTagIds.join(","));
        searchParams.set(
          "tagsMode",
          normalized.questionTagMatchMode === "all" ? "and" : "or",
        );
      }
      if (normalized.search) searchParams.set("search", normalized.search);
      if (nextPage > 1) searchParams.set("page", String(nextPage));
      searchParams.set("limit", String(pageSize));

      const href = searchParams.toString()
        ? `${basePath}?${searchParams.toString()}`
        : basePath;

      startTransition(() => {
        router.push(href, { scroll: !options?.preserveScroll });
      });
    },
    [basePath, pageSize, router],
  );

  const handleApplyFilters = useCallback(() => {
    const nextFilters = normalizeFilters(draftFilters);
    setAppliedFilters(nextFilters);
    pushWithFilters(nextFilters, 1);
  }, [draftFilters, pushWithFilters]);

  const handleClearFilters = useCallback(() => {
    const clearedFilters: QuestionBankFilters = {
      classId: "",
      subjectId: "",
      selectedTagIds: [],
      questionTagMatchMode: "all",
      search: "",
    };
    setDraftFilters(clearedFilters);
    setAppliedFilters(clearedFilters);
    setSetupNotice(null);
    setSubjectsState([]);
    setLoadedSubjectsClassId("");
    pushWithFilters(clearedFilters, 1);
  }, [pushWithFilters]);

  const handleArchiveRequest = useCallback((id: string) => {
    void import("@/components/workspace/questions/QuestionArchiveDialog");
    setQuestionToArchive(id);
    setShowArchiveDialog(true);
  }, []);

  const confirmArchive = useCallback(async () => {
    if (!questionToArchive) return;

    setIsDeleting(true);
    try {
      await fetchApiJson(`/api/questions/${questionToArchive}`, {
        method: "DELETE",
        schoolKey,
        fallbackMessage: "Failed to archive question.",
      });

      setRows((currentRows) =>
        currentRows.filter((question) => question._id !== questionToArchive),
      );
      toast({ title: "Success", description: "Question archived successfully." });

      if (rows.length <= 1 && page > 1) {
        pushWithFilters(appliedFilters, Math.max(1, page - 1));
      } else {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (archiveError: any) {
      toast({
        title: "Error",
        description: archiveError?.message || "Failed to archive question.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowArchiveDialog(false);
      setQuestionToArchive(null);
    }
  }, [
    appliedFilters,
    page,
    pushWithFilters,
    questionToArchive,
    router,
    rows.length,
    schoolKey,
    toast,
  ]);

  const archiveLoadedQuestions = useCallback(async () => {
    if (rows.length === 0) return;

    if (
      !window.confirm(
        `Are you sure you want to archive all ${rows.length} loaded questions in the current page?`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      for (const question of rows) {
        await fetchApiJson(`/api/questions/${question._id}`, {
          method: "DELETE",
          schoolKey,
          fallbackMessage: "Failed to archive question.",
        });
      }

      toast({
        title: "Success",
        description: "All loaded questions were archived.",
      });

      if (page > 1) {
        pushWithFilters(appliedFilters, Math.max(1, page - 1));
      } else {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch (archiveError: any) {
      toast({
        title: "Error",
        description:
          archiveError?.message || "Failed to archive loaded questions.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [appliedFilters, page, pushWithFilters, router, rows, schoolKey, toast]);

  return (
    <>
      {setupNotice ? <div className="app-feedback app-feedback-info">{setupNotice}</div> : null}

      <div className="app-filter-panel app-filter-panel-tight">
        <div className="app-filter-panel-header">
          <div className="app-filter-panel-heading">
            <div className="app-filter-panel-copy">
              <p className="app-filter-panel-title">Question Filters</p>
              <p className="app-filter-panel-note">
                Narrow by class, subject, tags, and keywords. Apply filters to refresh this server page.
              </p>
            </div>
            <div className="app-filter-panel-chips">
              <span className="app-meta-chip">
                {hasAnyAppliedFilters ? "Filtered view" : "Full question bank"}
              </span>
            </div>
          </div>
        </div>

        <div className="app-filter-panel-body">
          <form
            className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(0,1.35fr)]"
            onSubmit={(event) => {
              event.preventDefault();
              handleApplyFilters();
            }}
          >
            <div className="app-field-group">
              <Label htmlFor="questions-search" className="app-field-label">
                Search
              </Label>
              <Input
                id="questions-search"
                value={draftFilters.search}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="Search question content"
              />
            </div>

            <div className="app-field-group">
              <Label className="app-field-label">Class</Label>
              <SearchableCommandSelect
                value={draftFilters.classId || ALL_CLASSES_VALUE}
                options={classFilterOptions}
                onValueChange={(value) =>
                  setDraftFilters((current) => ({
                    ...current,
                    classId: value === ALL_CLASSES_VALUE ? "" : value,
                    subjectId: "",
                  }))
                }
                placeholder="All classes"
                searchPlaceholder="Search classes..."
                emptyText="No classes found."
                onClear={() =>
                  setDraftFilters((current) => ({
                    ...current,
                    classId: "",
                    subjectId: "",
                  }))
                }
                showCloseAction
              />
            </div>

            <div className="app-field-group">
              <Label className="app-field-label">Subject</Label>
              <SearchableCommandSelect
                value={draftFilters.subjectId || ALL_SUBJECTS_VALUE}
                options={subjectFilterOptions}
                onValueChange={(value) =>
                  setDraftFilters((current) => ({
                    ...current,
                    subjectId: value === ALL_SUBJECTS_VALUE ? "" : value,
                  }))
                }
                placeholder="All subjects"
                searchPlaceholder="Search subjects..."
                emptyText="No subjects found."
                onClear={() =>
                  setDraftFilters((current) => ({
                    ...current,
                    subjectId: "",
                  }))
                }
                showCloseAction
              />
            </div>

            <div className="app-field-group">
              <Label className="app-field-label">Tags</Label>
              <SearchableMultiSelectPopover
                selectedValues={draftFilters.selectedTagIds}
                options={tagOptions}
                onSelectedValuesChange={(selectedTagIds) =>
                  setDraftFilters((current) => ({
                    ...current,
                    selectedTagIds,
                    questionTagMatchMode:
                      selectedTagIds.length > 1
                        ? current.questionTagMatchMode
                        : "all",
                  }))
                }
                placeholder="Select tags"
                searchPlaceholder="Search tags..."
                emptyText="No matching tags found."
                noOptionsText="No tags available."
                maxVisibleBadges={3}
                triggerClassName="h-10 rounded-xl px-3"
              />

              {draftFilters.selectedTagIds.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={
                      draftFilters.questionTagMatchMode === "all"
                        ? "default"
                        : "outline"
                    }
                    className="app-button-compact"
                    onClick={() =>
                      setDraftFilters((current) => ({
                        ...current,
                        questionTagMatchMode: "all",
                      }))
                    }
                  >
                    Match all selected
                  </Button>
                  <Button
                    type="button"
                    variant={
                      draftFilters.questionTagMatchMode === "any"
                        ? "default"
                        : "outline"
                    }
                    className="app-button-compact"
                    onClick={() =>
                      setDraftFilters((current) => ({
                        ...current,
                        questionTagMatchMode: "any",
                      }))
                    }
                  >
                    Match any selected
                  </Button>
                </div>
              ) : null}
            </div>
          </form>

          <div className="app-filter-summary">
            <div className="app-filter-summary-copy">
              <p className="app-filter-summary-title">
                {hasAnyAppliedFilters ? "Filtered bank ready" : "Browsing the full bank"}
              </p>
              <p className="app-filter-summary-note">
                Apply filters to refresh the current server-side page.
              </p>
            </div>
            <div className="app-filter-summary-actions">
              <Button
                type="button"
                variant="outline"
                className="app-button-filter"
                onClick={() =>
                  startTransition(() => {
                    router.refresh();
                  })
                }
                disabled={isPending}
              >
                Refresh
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="app-button-filter"
                onClick={handleClearFilters}
                disabled={!hasAnyAppliedFilters && !hasPendingFilterChanges}
              >
                Clear
              </Button>
              <Button
                type="button"
                className="app-button-filter"
                onClick={handleApplyFilters}
                disabled={!hasPendingFilterChanges || isPending}
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="app-toolbar app-toolbar-compact">
        <div className="app-toolbar-row">
          <div className="app-toolbar-copy">
            <p className="app-toolbar-title">
              Showing {rows.length} question{rows.length === 1 ? "" : "s"} on this page
            </p>
            <p className="app-toolbar-note">
              Archive Loaded affects only this visible page.
            </p>
          </div>
          <div className="app-toolbar-actions">
            {rows.length > 0 ? (
              <Button
                variant="destructive"
                className="app-button-inline"
                onClick={archiveLoadedQuestions}
                disabled={isDeleting || isPending}
              >
                {isDeleting ? "Archiving..." : `Archive Loaded (${rows.length})`}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <ListPagination
        page={page}
        totalPages={pages}
        totalItems={totalQuestions}
        pageSize={pageSize}
        itemLabel="questions"
        onPageChange={(nextPage, options) =>
          pushWithFilters(appliedFilters, nextPage, options)
        }
        disabled={isPending || isDeleting}
      />

      <QuestionResultsList
        questions={rows}
        isDeleting={isDeleting}
        questionToArchive={questionToArchive}
        onArchive={handleArchiveRequest}
      />

      {showArchiveDialog ? (
        <QuestionArchiveDialog
          open={showArchiveDialog}
          onOpenChange={setShowArchiveDialog}
          isDeleting={isDeleting}
          onConfirm={confirmArchive}
        />
      ) : null}
    </>
  );
}
