'use client';

import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';

import AppPrefetchLink from '@/components/navigation/AppPrefetchLink';
import PageHero from '@/components/layout/PageHero';
import { QuestionItem, QuestionItemSkeleton } from '@/components/question-item';
import type { Question } from '@/components/question-item';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableMultiSelectPopover } from '@/components/ui/searchable-multi-select-popover';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buildPartialLoadMessage, fetchApiJson, resolveClientSchoolKey } from '@/lib/client/api';

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
  questionTagMatchMode: 'any' | 'all';
  search: string;
};

const DEFAULT_FILTERS: QuestionBankFilters = {
  classId: '',
  subjectId: '',
  selectedTagIds: [],
  questionTagMatchMode: 'all',
  search: '',
};

const ALL_CLASSES_VALUE = '__all_classes__';
const ALL_SUBJECTS_VALUE = '__all_subjects__';
const QUESTIONS_INITIAL_PAGE_SIZE = 24;
const QUESTIONS_VISIBLE_PAGE_SIZE = QUESTIONS_INITIAL_PAGE_SIZE;
const QUESTIONS_BACKGROUND_BATCH_SIZE = 3;

function buildQuestionQueryParams(
  filters: QuestionBankFilters,
  page?: number,
  limit?: number,
) {
  const params = new URLSearchParams();

  if (filters.classId) params.set('class', filters.classId);
  if (filters.subjectId) params.set('subject', filters.subjectId);
  if (filters.selectedTagIds.length > 0) {
    params.set('tags', filters.selectedTagIds.join(','));
    params.set('tagsMode', filters.questionTagMatchMode === 'all' ? 'and' : 'or');
  }
  if (filters.search) params.set('search', filters.search);
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));

  return params;
}

function mergeQuestionsById(current: Question[], next: Question[]) {
  if (next.length === 0) {
    return current;
  }

  const merged = new Map<string, Question>();
  current.forEach((question) => {
    merged.set(question._id, question);
  });
  next.forEach((question) => {
    merged.set(question._id, question);
  });
  return Array.from(merged.values());
}

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException
      ? error.name === 'AbortError'
      : typeof error === 'object' &&
          error !== null &&
          'name' in error &&
          (error as { name?: string }).name === 'AbortError'
  );
}

function normalizeFilters(filters: QuestionBankFilters): QuestionBankFilters {
  return {
    ...filters,
    search: filters.search.trim(),
    selectedTagIds: [...filters.selectedTagIds].sort(),
    questionTagMatchMode: filters.selectedTagIds.length > 1 ? filters.questionTagMatchMode : 'all',
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
    normalizedLeft.selectedTagIds.every((tagId, index) => tagId === normalizedRight.selectedTagIds[index])
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

type QuestionResultsListProps = {
  loading: boolean;
  error: string | null;
  questions: Question[];
  isDeleting: boolean;
  questionToArchive: string | null;
  onRetry: () => void;
  onArchive: (id: string) => void;
};

const QuestionResultsList = memo(function QuestionResultsList({
  loading,
  error,
  questions,
  isDeleting,
  questionToArchive,
  onRetry,
  onArchive,
}: QuestionResultsListProps) {
  return (
    <div className="space-y-3">
      {loading ? (
        Array.from({ length: 3 }).map((_, index) => <QuestionItemSkeleton key={index} />)
      ) : error ? (
        <div className="app-feedback app-feedback-error text-center">
          <p>{error}</p>
          <div className="mt-4 flex justify-center">
            <Button onClick={onRetry} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      ) : questions.length === 0 ? (
        <div className="app-empty-state">
          <p>No questions match your current filters.</p>
          <div className="mt-4 flex justify-center">
            <AppPrefetchLink
              href="/workspace/questions/create"
              relatedApiPrefetches={[
                '/api/classes',
                '/api/subjects',
                '/api/tags/with-subjects',
              ]}
            >
              <Button variant="outline">Create your first question</Button>
            </AppPrefetchLink>
          </div>
        </div>
      ) : (
        questions.map((question) => (
          <QuestionItem
            key={question._id}
            question={question}
            onArchive={onArchive}
            isDeleting={isDeleting && questionToArchive === question._id}
          />
        ))
      )}
    </div>
  );
});

export default function ViewQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [questionToArchive, setQuestionToArchive] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [classes, setClasses] = useState<FilterOption[]>([]);
  const [subjects, setSubjects] = useState<FilterOption[]>([]);
  const [allTags, setAllTags] = useState<FilterOption[]>([]);
  const [draftFilters, setDraftFilters] = useState<QuestionBankFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<QuestionBankFilters>(DEFAULT_FILTERS);
  const [setupNotice, setSetupNotice] = useState<string | null>(null);
  const [backgroundNotice, setBackgroundNotice] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [visibleQuestionCount, setVisibleQuestionCount] = useState(
    QUESTIONS_VISIBLE_PAGE_SIZE,
  );
  const requestAbortRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);
  const { toast } = useToast();

  useEffect(() => {
    void (async () => {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        setClasses([]);
        setAllTags([]);
        setSetupNotice('Select a school to load filters and questions.');
        return;
      }

      const [classesResult, tagsResult] = await Promise.allSettled([
        fetchApiJson<any>('/api/classes', {
          cache: 'no-store',
          schoolKey,
          fallbackMessage: 'Failed to load classes.',
        }),
        fetchApiJson<any>('/api/tags', {
          cache: 'no-store',
          schoolKey,
          fallbackMessage: 'Failed to load tags.',
        }),
      ]);

      if (classesResult.status === 'fulfilled') {
        setClasses(Array.isArray(classesResult.value.classes) ? classesResult.value.classes : []);
      }
      if (tagsResult.status === 'fulfilled') {
        setAllTags(Array.isArray(tagsResult.value.tags) ? tagsResult.value.tags : []);
      }

      setSetupNotice(
        buildPartialLoadMessage([
          ...(classesResult.status === 'rejected' ? ['Class filters'] : []),
          ...(tagsResult.status === 'rejected' ? ['Tag filters'] : []),
        ]),
      );
    })();
  }, []);

  useEffect(() => {
    if (!draftFilters.classId) {
      setSubjects([]);
      setDraftFilters((current) => (current.subjectId ? { ...current, subjectId: '' } : current));
      return;
    }

    void (async () => {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        setSubjects([]);
        return;
      }

      try {
        const data = await fetchApiJson<any>(`/api/subjects?classId=${draftFilters.classId}`, {
          cache: 'no-store',
          schoolKey,
          fallbackMessage: 'Failed to load subjects.',
        });
        const nextSubjects = Array.isArray(data.subjects) ? data.subjects : [];
        setSubjects(nextSubjects);
        setDraftFilters((current) => {
          if (!current.subjectId) return current;
          const hasCurrentSubject = nextSubjects.some((subject: FilterOption) => subject._id === current.subjectId);
          return hasCurrentSubject ? current : { ...current, subjectId: '' };
        });
        setSetupNotice((currentNotice) =>
          currentNotice && currentNotice.includes('Subject options') ? null : currentNotice,
        );
      } catch {
        setSubjects([]);
        setSetupNotice('Subject options could not be loaded. You can continue with the other filters and retry.');
      }
    })();
  }, [draftFilters.classId]);

  const requestQuestions = useCallback(async (filters: QuestionBankFilters) => {
    requestAbortRef.current?.abort();
    const abortController = new AbortController();
    requestAbortRef.current = abortController;
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;

    setLoading(true);
    setBackgroundLoading(false);
    setError(null);
    setBackgroundNotice(null);

    try {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error('Select a school to browse questions.');
      }

      const normalizedFilters = normalizeFilters(filters);
      const initialParams = buildQuestionQueryParams(
        normalizedFilters,
        1,
        QUESTIONS_INITIAL_PAGE_SIZE,
      );
      const data = await fetchApiJson<any>(`/api/questions?${initialParams.toString()}`, {
        cache: 'no-store',
        schoolKey,
        fallbackMessage: 'Failed to load questions.',
        signal: abortController.signal,
      });

      if (
        abortController.signal.aborted ||
        requestSequenceRef.current !== requestSequence
      ) {
        return;
      }

      const initialQuestions = Array.isArray(data.questions) ? data.questions : [];
      const totalPages = Math.max(1, Number(data.pages) || 1);
      const nextTotalQuestions = Math.max(
        initialQuestions.length,
        Number(data.total) || initialQuestions.length,
      );

      startTransition(() => {
        setQuestions(initialQuestions);
      });
      setTotalQuestions(nextTotalQuestions);
      setLoading(false);

      if (totalPages <= 1) {
        return;
      }

      setBackgroundLoading(true);

      void (async () => {
        try {
          for (let page = 2; page <= totalPages; page += QUESTIONS_BACKGROUND_BATCH_SIZE) {
            const batchPages = Array.from(
              { length: Math.min(QUESTIONS_BACKGROUND_BATCH_SIZE, totalPages - page + 1) },
              (_, index) => page + index,
            );

            const batchResults = await Promise.all(
              batchPages.map(async (pageNumber) => {
                const pageParams = buildQuestionQueryParams(
                  normalizedFilters,
                  pageNumber,
                  QUESTIONS_INITIAL_PAGE_SIZE,
                );
                const pageData = await fetchApiJson<any>(
                  `/api/questions?${pageParams.toString()}`,
                  {
                    cache: 'no-store',
                    schoolKey,
                    fallbackMessage: 'Failed to load questions.',
                    signal: abortController.signal,
                  },
                );
                return Array.isArray(pageData.questions) ? pageData.questions : [];
              }),
            );

            if (
              abortController.signal.aborted ||
              requestSequenceRef.current !== requestSequence
            ) {
              return;
            }

            const nextQuestions = batchResults.flat();
            if (nextQuestions.length > 0) {
              startTransition(() => {
                setQuestions((currentQuestions) =>
                  mergeQuestionsById(currentQuestions, nextQuestions),
                );
              });
            }
          }
        } catch (backgroundError) {
          if (
            !isAbortError(backgroundError) &&
            requestSequenceRef.current === requestSequence
          ) {
            setBackgroundNotice('Some questions are still loading. Refresh to retry.');
          }
        } finally {
          if (
            !abortController.signal.aborted &&
            requestSequenceRef.current === requestSequence
          ) {
            setBackgroundLoading(false);
          }
        }
      })();
    } catch (requestError: any) {
      if (isAbortError(requestError)) {
        return;
      }

      setQuestions([]);
      setTotalQuestions(0);
      setError(requestError?.message || 'A network error occurred. Please try again.');
      setLoading(false);
      setBackgroundLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      requestAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    void requestQuestions(appliedFilters);
  }, [appliedFilters, requestQuestions]);

  useEffect(() => {
    setVisibleQuestionCount(QUESTIONS_VISIBLE_PAGE_SIZE);
  }, [appliedFilters]);

  const handleApplyFilters = useCallback(() => {
    const nextFilters = normalizeFilters(draftFilters);
    setAppliedFilters((current) => (areFiltersEqual(current, nextFilters) ? current : nextFilters));
  }, [draftFilters]);

  const handleClearFilters = useCallback(() => {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  }, []);

  const handleArchiveRequest = useCallback((id: string) => {
    setQuestionToArchive(id);
    setShowArchiveDialog(true);
  }, []);

  const handleSelectedTagIdsChange = useCallback((selectedTagIds: string[]) => {
    setDraftFilters((current) => ({
      ...current,
      selectedTagIds,
      questionTagMatchMode:
        selectedTagIds.length > 1 ? current.questionTagMatchMode : 'all',
    }));
  }, []);

  const handleRetry = useCallback(() => {
    void requestQuestions(appliedFilters);
  }, [appliedFilters, requestQuestions]);

  const confirmArchive = async () => {
    if (!questionToArchive) return;

    setIsDeleting(true);
    try {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error('Please select a school in the navbar first.');
      }

      await fetchApiJson(`/api/questions/${questionToArchive}`, {
        method: 'DELETE',
        schoolKey,
        fallbackMessage: 'Failed to archive question.',
      });
      setQuestions((previousQuestions) =>
        previousQuestions.filter((question) => question._id !== questionToArchive),
      );
      setTotalQuestions((currentTotal) => Math.max(0, currentTotal - 1));
      toast({ title: 'Success', description: 'Question archived successfully.' });
    } catch (archiveError: any) {
      toast({
        title: 'Error',
        description: archiveError?.message || 'Failed to archive question.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowArchiveDialog(false);
      setQuestionToArchive(null);
    }
  };

  const filteredQuestions = questions;
  const refreshing = loading && filteredQuestions.length > 0;
  const visibleQuestions = useMemo(() => {
    return filteredQuestions.slice(0, visibleQuestionCount);
  }, [filteredQuestions, visibleQuestionCount]);
  const hasMoreVisibleQuestions = filteredQuestions.length > visibleQuestions.length;
  const remainingVisibleQuestions = Math.max(
    0,
    filteredQuestions.length - visibleQuestions.length,
  );

  const hasPendingFilterChanges = !areFiltersEqual(draftFilters, appliedFilters);
  const hasAnyAppliedFilters = countActiveFilters(appliedFilters) > 0;
  const appliedFilterCount = countActiveFilters(appliedFilters);
  const tagOptions = useMemo(
    () =>
      allTags.map((tag) => ({
        value: tag._id,
        label: tag.name,
        description: tag.type?.name || undefined,
        keywords: tag.type?.name ? [tag.type.name] : [],
      })),
    [allTags],
  );
  const appliedTagModeLabel =
    appliedFilters.selectedTagIds.length > 1
      ? appliedFilters.questionTagMatchMode === 'all'
        ? 'All selected tags'
        : 'Any selected tag'
      : null;

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="Question Bank"
        title="Questions"
        description="Filter by class, subject, tags, and search terms without leaving the question workspace."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <AppPrefetchLink href="/workspace/questions/bulk-upload">
                Bulk Upload
              </AppPrefetchLink>
            </Button>
            <Button asChild className="gap-2">
              <AppPrefetchLink
                href="/workspace/questions/create"
                prefetchOnMount
                relatedApiPrefetches={[
                  '/api/classes',
                  '/api/subjects',
                  '/api/tags/with-subjects',
                ]}
              >
                <Plus className="h-4 w-4" />
                Create Question
              </AppPrefetchLink>
            </Button>
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">
              {appliedFilterCount === 0
                ? 'All questions'
                : `${appliedFilterCount} active filter${appliedFilterCount === 1 ? '' : 's'}`}
            </span>
            {appliedTagModeLabel ? <span className="app-meta-chip">{appliedTagModeLabel}</span> : null}
            {refreshing ? <span className="app-meta-chip">Refreshing...</span> : null}
            {backgroundLoading ? <span className="app-meta-chip">Loading more...</span> : null}
          </>
        }
        stats={[
          {
            label: 'Loaded questions',
            value:
              loading
                ? 'Loading'
                : backgroundLoading && totalQuestions > filteredQuestions.length
                  ? `${filteredQuestions.length}/${totalQuestions}`
                  : String(filteredQuestions.length),
            meta: backgroundLoading ? 'Loading the rest.' : 'Current result set.',
          },
          {
            label: 'Available classes',
            value: String(classes.length),
            meta: 'School class filters.',
          },
          {
            label: 'Tag library',
            value: String(allTags.length),
            meta: 'Reusable tag filters.',
          },
        ]}
      />

      {setupNotice ? <div className="app-feedback app-feedback-info">{setupNotice}</div> : null}
      {backgroundNotice ? <div className="app-feedback app-feedback-info">{backgroundNotice}</div> : null}

      <div className="app-surface overflow-hidden shadow-none">
        <div className="app-section-header">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="app-meta-chip">
                {hasAnyAppliedFilters ? 'Filtered view' : 'Full question bank'}
              </span>
              {draftFilters.selectedTagIds.length > 1 ? (
                <span className="app-meta-chip">
                  {draftFilters.questionTagMatchMode === 'all'
                    ? 'Match all selected tags'
                    : 'Match any selected tag'}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void requestQuestions(appliedFilters)}
              >
                Refresh
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleClearFilters}
                disabled={!hasAnyAppliedFilters && !hasPendingFilterChanges}
              >
                Clear
              </Button>
              <Button type="button" onClick={handleApplyFilters} disabled={!hasPendingFilterChanges}>
                Apply Filters
              </Button>
            </div>
          </div>
        </div>

        <div className="app-section-body">
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
                  setDraftFilters((current) => ({ ...current, search: event.target.value }))
                }
                placeholder="Search question content"
              />
            </div>

            <div className="app-field-group">
              <Label className="app-field-label">Class</Label>
              <Select
                value={draftFilters.classId || ALL_CLASSES_VALUE}
                onValueChange={(value) =>
                  setDraftFilters((current) => ({
                    ...current,
                    classId: value === ALL_CLASSES_VALUE ? '' : value,
                    subjectId: '',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CLASSES_VALUE}>All classes</SelectItem>
                  {classes.map((classOption) => (
                    <SelectItem key={classOption._id} value={classOption._id}>
                      {classOption.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="app-field-group">
              <Label className="app-field-label">Subject</Label>
              <Select
                value={draftFilters.subjectId || ALL_SUBJECTS_VALUE}
                onValueChange={(value) =>
                  setDraftFilters((current) => ({
                    ...current,
                    subjectId: value === ALL_SUBJECTS_VALUE ? '' : value,
                  }))
                }
                disabled={!draftFilters.classId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={draftFilters.classId ? 'All subjects' : 'Select class first'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SUBJECTS_VALUE}>All subjects</SelectItem>
                  {subjects.map((subjectOption) => (
                    <SelectItem key={subjectOption._id} value={subjectOption._id}>
                      {subjectOption.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="app-field-group">
              <Label className="app-field-label">Tags</Label>
              <SearchableMultiSelectPopover
                selectedValues={draftFilters.selectedTagIds}
                options={tagOptions}
                onSelectedValuesChange={handleSelectedTagIdsChange}
                placeholder="Select tags"
                searchPlaceholder="Search tags..."
                emptyText="No matching tags found."
                noOptionsText="No tags available."
                maxVisibleBadges={3}
                triggerClassName="h-11 rounded-xl px-3.5"
              />

              {draftFilters.selectedTagIds.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={draftFilters.questionTagMatchMode === 'all' ? 'default' : 'outline'}
                    className="h-9"
                    onClick={() =>
                      setDraftFilters((current) => ({
                        ...current,
                        questionTagMatchMode: 'all',
                      }))
                    }
                  >
                    Match all selected
                  </Button>
                  <Button
                    type="button"
                    variant={draftFilters.questionTagMatchMode === 'any' ? 'default' : 'outline'}
                    className="h-9"
                    onClick={() =>
                      setDraftFilters((current) => ({
                        ...current,
                        questionTagMatchMode: 'any',
                      }))
                    }
                  >
                    Match any selected
                  </Button>
                </div>
              ) : null}
            </div>
          </form>
        </div>
      </div>

      <div className="app-toolbar">
        <div className="app-toolbar-row">
          <p className="app-toolbar-title">
            Showing {filteredQuestions.length}
            {backgroundLoading && totalQuestions > filteredQuestions.length
              ? ` of ${totalQuestions}`
              : ''}
            {' '}question{filteredQuestions.length === 1 ? '' : 's'}
          </p>
	          {backgroundLoading ? <span className="app-meta-chip">Loading more...</span> : null}
	          {filteredQuestions.length > 0 ? (
	            <div className="app-toolbar-actions">
	              <Button
	                variant="destructive"
                size="sm"
                className="app-button-compact"
                onClick={async () => {
	                  if (!window.confirm(`Are you sure you want to archive all ${filteredQuestions.length} loaded questions in the current result set? This cannot be undone.`)) {
	                    return;
	                  }

                  setIsDeleting(true);
                  try {
                    const schoolKey = resolveClientSchoolKey();
                    if (!schoolKey) {
                      throw new Error('Please select a school in the navbar first.');
                    }

                    for (const question of filteredQuestions) {
                      await fetchApiJson(`/api/questions/${question._id}`, {
                        method: 'DELETE',
                        schoolKey,
                        fallbackMessage: 'Failed to archive question.',
                      });
                    }

                    setQuestions((previousQuestions) =>
                      previousQuestions.filter(
                        (question) =>
                          !filteredQuestions.some((filteredQuestion) => filteredQuestion._id === question._id),
                      ),
                    );
                    setTotalQuestions((currentTotal) =>
                      Math.max(0, currentTotal - filteredQuestions.length),
                    );
                    toast({ title: 'Success', description: 'All filtered questions archived.' });
                  } catch (archiveError: any) {
                    toast({
                      title: 'Error',
                      description:
                        archiveError?.message || 'Failed to archive filtered questions.',
                      variant: 'destructive',
                    });
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
              >
	                {isDeleting ? 'Archiving...' : `Archive Loaded (${filteredQuestions.length})`}
	              </Button>
	            </div>
	          ) : null}
	        </div>
	      </div>

	      {filteredQuestions.length > QUESTIONS_VISIBLE_PAGE_SIZE ? (
	        <div className="app-toolbar">
	          <div className="app-toolbar-row">
	            <div className="app-toolbar-copy">
	              <p className="app-toolbar-title">
	                Showing {visibleQuestions.length} of {filteredQuestions.length} loaded question
	                {filteredQuestions.length === 1 ? '' : 's'}
	              </p>
	              <p className="app-toolbar-note">
	                Load more when you want to expand the current result set without jumping pages.
	              </p>
	            </div>
	            {hasMoreVisibleQuestions ? (
	              <Button
	                type="button"
	                variant="outline"
	                className="app-button-compact"
	                onClick={() =>
	                  setVisibleQuestionCount(
	                    (currentCount) => currentCount + QUESTIONS_VISIBLE_PAGE_SIZE,
	                  )
	                }
	              >
	                Load More
	                {remainingVisibleQuestions > 0
	                  ? ` (${Math.min(QUESTIONS_VISIBLE_PAGE_SIZE, remainingVisibleQuestions)} more)`
	                  : ''}
	              </Button>
	            ) : null}
	          </div>
	        </div>
	      ) : null}

	      <QuestionResultsList
	        loading={loading && filteredQuestions.length === 0}
	        error={error}
	        questions={visibleQuestions}
	        isDeleting={isDeleting}
	        questionToArchive={questionToArchive}
	        onRetry={handleRetry}
        onArchive={handleArchiveRequest}
      />

      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive question?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will archive the question.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmArchive}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? <Spinner /> : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
