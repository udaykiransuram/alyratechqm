'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Plus } from 'lucide-react';
import type { Question } from '@/components/question-items';
import { PaperDetailsForm } from '@/components/PaperDetailsForm';
import { PaperSummary } from '@/components/PaperSummary';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { useBackNavigation } from '@/hooks/useReturnNavigation';
import { fetchApiJson, peekCachedApiJson, prefetchApiJson } from '@/lib/client/api';
import { announceNavigationStart } from '@/lib/client/navigation-feedback';
import { calculateSectionTotalMarks } from '@/lib/question-paper/sections';
import { resolvePaperSubjects } from '@/lib/question-paper/subjects';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function SectionEditorLoadingState() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
      <div className="space-y-3.5 border-b border-border/60 bg-muted/20 px-4 py-3.5">
        <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-20 w-full animate-pulse rounded-2xl bg-muted/70" />
        <div className="grid grid-cols-2 gap-3 sm:w-56">
          <div className="h-10 animate-pulse rounded-xl bg-muted/70" />
          <div className="h-10 animate-pulse rounded-xl bg-muted/70" />
        </div>
      </div>
      <div className="space-y-3.5 px-4 py-3.5">
        <div className="h-32 w-full animate-pulse rounded-2xl bg-muted/60" />
        <div className="h-10 w-52 animate-pulse rounded-xl bg-muted/70" />
      </div>
    </div>
  );
}

function CompactQuestionCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-background p-4">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-muted/60" />
      </div>
    </div>
  );
}

function QuestionFilterModalLoadingState() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 px-3 py-4">
      <div className="flex h-[min(92vh,860px)] w-full max-w-[1320px] flex-col overflow-hidden rounded-[28px] border border-border/60 bg-background shadow-2xl">
        <div className="border-b border-border/60 bg-muted/20 px-4 py-3.5">
          <div className="space-y-2">
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded bg-muted/80" />
          </div>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 bg-muted/20 p-3 sm:p-4 lg:grid-cols-[minmax(300px,320px)_minmax(0,1fr)]">
          <div className="app-surface space-y-3.5 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-xl bg-muted/70" />
              </div>
            ))}
          </div>
          <div className="app-surface flex min-h-0 flex-col p-4">
            <div className="mb-4">
              <div className="space-y-2">
                <div className="h-5 w-40 animate-pulse rounded bg-muted" />
                <div className="h-4 w-64 animate-pulse rounded bg-muted/80" />
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-hidden">
              {Array.from({ length: 3 }).map((_, index) => (
                <CompactQuestionCardSkeleton key={index} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SectionEditor = dynamic(
  () => import('@/components/SectionEditor').then((module) => module.SectionEditor),
  {
    loading: () => <SectionEditorLoadingState />,
  },
);

const SelectedPaperQuestionCard = dynamic(
  () =>
    import('@/components/question-paper-builder/SelectedPaperQuestionCard').then(
      (module) => module.SelectedPaperQuestionCard,
    ),
  {
    loading: () => <CompactQuestionCardSkeleton />,
  },
);

const QuestionFilterPopup = dynamic(
  () =>
    import('@/components/QuestionFilterPopup').then(
      (module) => module.QuestionFilterPopup,
    ),
  {
    ssr: false,
    loading: () => <QuestionFilterModalLoadingState />,
  },
);

interface TagItem { _id: string; name: string; type: { name: string } }
interface SubjectWithTags { _id: string; name: string; tags: TagItem[] }
interface Class { _id: string; name: string }
interface AcademicSectionItem {
  _id: string;
  name: string;
  class?: { _id: string; name?: string } | string;
}
interface QuestionInPaper {
  question: Question;
  marks: number;
  negativeMarks: number;
}
interface Section {
  id: string;
  name: string;
  description: string;
  instructions: string;
  defaultMarks: number | undefined;
  defaultNegativeMarks: number | undefined;
  questions: QuestionInPaper[];
}

type QuestionPickerResponse = {
  questions?: any[];
  total?: number;
  page?: number;
  pages?: number;
};

type QuestionPickerIdsResponse = {
  questionIds?: string[];
  total?: number;
};

type QuestionPaperFormProps = {
  initialData?: any;
  isEditMode?: boolean;
  initialClasses?: Class[];
  initialSubjects?: SubjectWithTags[];
  initialTags?: TagItem[];
  initialAcademicSections?: AcademicSectionItem[];
  initialSupportDataLoaded?: boolean;
  initialSupportMessage?: string | null;
};

function parseStoredDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getAcademicSectionClassId(section: AcademicSectionItem) {
  return typeof section.class === 'string' ? section.class : section.class?._id || '';
}

const SUPPORT_DATA_CACHE_TTL_MS = 60_000;
const QUESTION_FILTER_PAGE_SIZE = 30;
const QUESTION_FILTER_CACHE_TTL_MS = 15_000;
const QUESTION_PICKER_FETCH_BY_IDS_CHUNK_SIZE = 40;

function appendQuestionPickerFilters(
  params: URLSearchParams,
  {
    activeSectionId,
    sections,
    classId = 'all',
    subjectId = 'all',
    selectedTagIdsKey = '',
    questionTagMatchMode = 'any',
    questionSearch = '',
  }: {
    activeSectionId: string | null;
    sections: Section[];
    classId?: string;
    subjectId?: string;
    selectedTagIdsKey?: string;
    questionTagMatchMode?: 'any' | 'all';
    questionSearch?: string;
  },
) {
  const normalizedSearch = questionSearch.trim();
  const excludedQuestionIds =
    activeSectionId
      ? Array.from(
          new Set(
            sections
              .filter((section) => section.id !== activeSectionId)
              .flatMap((section) =>
                section.questions.map((question) => String(question.question._id || '')),
              )
              .filter(Boolean),
          ),
        )
      : [];

  if (classId !== 'all') params.append('class', classId);
  if (subjectId !== 'all') params.append('subject', subjectId);
  if (selectedTagIdsKey) {
    params.append('tags', selectedTagIdsKey);
    params.append('tagsMode', questionTagMatchMode === 'all' ? 'and' : 'or');
  }
  if (normalizedSearch) params.append('search', normalizedSearch);
  if (excludedQuestionIds.length > 0) {
    params.append('excludeIds', excludedQuestionIds.join(','));
  }
}

function buildQuestionPickerEndpoint({
  activeSectionId,
  sections,
  classId = 'all',
  subjectId = 'all',
  selectedTagIdsKey = '',
  questionTagMatchMode = 'any',
  questionSearch = '',
  questionPage = 1,
  questionPageSize = QUESTION_FILTER_PAGE_SIZE,
}: {
  activeSectionId: string | null;
  sections: Section[];
  classId?: string;
  subjectId?: string;
  selectedTagIdsKey?: string;
  questionTagMatchMode?: 'any' | 'all';
  questionSearch?: string;
  questionPage?: number;
  questionPageSize?: number;
}) {
  const params = new URLSearchParams();
  appendQuestionPickerFilters(params, {
    activeSectionId,
    sections,
    classId,
    subjectId,
    selectedTagIdsKey,
    questionTagMatchMode,
    questionSearch,
  });
  params.append('page', String(questionPage));
  params.append('limit', String(questionPageSize));
  params.append('view', 'picker');

  return `/api/questions?${params.toString()}`;
}

function buildQuestionPickerIdsEndpoint({
  activeSectionId,
  sections,
  classId = 'all',
  subjectId = 'all',
  selectedTagIdsKey = '',
  questionTagMatchMode = 'any',
  questionSearch = '',
}: {
  activeSectionId: string | null;
  sections: Section[];
  classId?: string;
  subjectId?: string;
  selectedTagIdsKey?: string;
  questionTagMatchMode?: 'any' | 'all';
  questionSearch?: string;
}) {
  const params = new URLSearchParams();
  appendQuestionPickerFilters(params, {
    activeSectionId,
    sections,
    classId,
    subjectId,
    selectedTagIdsKey,
    questionTagMatchMode,
    questionSearch,
  });
  params.append('view', 'picker-ids');

  return `/api/questions?${params.toString()}`;
}

function buildQuestionPickerByIdsEndpoint(questionIds: string[]) {
  const params = new URLSearchParams();
  params.append('ids', questionIds.join(','));
  params.append('view', 'picker');

  return `/api/questions?${params.toString()}`;
}

export default function QuestionPaperForm({
  initialData,
  isEditMode = false,
  initialClasses,
  initialSubjects,
  initialTags,
  initialAcademicSections,
  initialSupportDataLoaded = false,
  initialSupportMessage = null,
}: QuestionPaperFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { navigateBack } = useBackNavigation('/workspace/question-papers');
  const hasProvidedSupportData = initialSupportDataLoaded;

  // State initialization (use initialData if present)
  const [paperTitle, setPaperTitle] = useState(initialData?.title || '');
  const [instructions, setInstructions] = useState(initialData?.instructions || '');
  const [duration, setDuration] = useState(initialData?.duration ?? 60);
  const [passingMarks, setPassingMarks] = useState(initialData?.passingMarks ?? 0);
  const [examDate, setExamDate] = useState<Date | null>(
    parseStoredDate(initialData?.examDate),
  );
  const [onlineEnabled, setOnlineEnabled] = useState(
    Boolean(initialData?.onlineEnabled),
  );
  const [onlineStartsAt, setOnlineStartsAt] = useState<Date | null>(
    parseStoredDate(initialData?.onlineStartsAt),
  );
  const [onlineEndsAt, setOnlineEndsAt] = useState<Date | null>(
    parseStoredDate(initialData?.onlineEndsAt),
  );
  const [sections, setSections] = useState<Section[]>(initialData?.sections || []);
  const [classId, setClassId] = useState(initialData?.classId || '');
  const [assignedAcademicSectionIds, setAssignedAcademicSectionIds] = useState<string[]>(initialData?.assignedAcademicSectionIds || []);
  const nextSectionIdRef = useRef(1);

  // Hydrate state when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      setPaperTitle(initialData.title || '');
      setInstructions(initialData.instructions || '');
      setDuration(initialData.duration ?? 60);
      setPassingMarks(initialData.passingMarks ?? 0);
      setExamDate(parseStoredDate(initialData.examDate) ?? new Date());
      setOnlineEnabled(Boolean(initialData.onlineEnabled));
      setOnlineStartsAt(parseStoredDate(initialData.onlineStartsAt));
      setOnlineEndsAt(parseStoredDate(initialData.onlineEndsAt));
      setClassId(initialData.classId || '');
      setAssignedAcademicSectionIds(initialData.assignedAcademicSectionIds || []);
      setSections(initialData.sections || []);
    }
  }, [initialData]);

  useEffect(() => {
    if (initialData || isEditMode || examDate) {
      return;
    }

    setExamDate(new Date());
  }, [examDate, initialData, isEditMode]);

  useEffect(() => {
    const maxExistingSectionId = sections.reduce((currentMax, section) => {
      const match = /^section-(\d+)$/.exec(String(section.id || ''));
      const numericId = match ? Number(match[1]) : 0;
      return Number.isFinite(numericId) ? Math.max(currentMax, numericId) : currentMax;
    }, 0);

    nextSectionIdRef.current = Math.max(nextSectionIdRef.current, maxExistingSectionId + 1);
  }, [sections]);

  // Question Bank State
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionResultCount, setQuestionResultCount] = useState(0);
  const [questionPage, setQuestionPage] = useState(1);
  const [questionPageCount, setQuestionPageCount] = useState(1);

  // Filters
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [questionTagMatchMode, setQuestionTagMatchMode] = useState<'any' | 'all'>('any');

  // Global State
  const [saving, setSaving] = useState(false);
  const [confirmingQuestions, setConfirmingQuestions] = useState(false);
  const [selectingAllFilteredQuestions, setSelectingAllFilteredQuestions] = useState(false);
  const cachedClassesResponse = peekCachedApiJson<{ classes?: Class[] }>('/api/classes', {
    clientCacheTtlMs: SUPPORT_DATA_CACHE_TTL_MS,
  });
  const cachedTagsResponse = peekCachedApiJson<{ tags?: TagItem[] }>('/api/tags/with-subjects', {
    clientCacheTtlMs: SUPPORT_DATA_CACHE_TTL_MS,
  });
  const cachedSubjectsResponse = peekCachedApiJson<{ subjects?: SubjectWithTags[] }>('/api/subjects', {
    clientCacheTtlMs: SUPPORT_DATA_CACHE_TTL_MS,
  });
  const cachedSectionsResponse = peekCachedApiJson<{ sections?: AcademicSectionItem[] }>('/api/sections', {
    clientCacheTtlMs: SUPPORT_DATA_CACHE_TTL_MS,
  });
  const hasCachedSupportData = Boolean(
    cachedClassesResponse?.classes &&
      cachedTagsResponse?.tags &&
      cachedSubjectsResponse?.subjects,
  );
  const [classes, setClasses] = useState<Class[]>(
    () => initialClasses ?? cachedClassesResponse?.classes ?? [],
  );
  const [subjects, setSubjects] = useState<SubjectWithTags[]>(
    () => initialSubjects ?? cachedSubjectsResponse?.subjects ?? [],
  );
  const [questionFilterSubjects, setQuestionFilterSubjects] = useState<SubjectWithTags[]>(
    () => initialSubjects ?? cachedSubjectsResponse?.subjects ?? [],
  );
  const [availableAcademicSections, setAvailableAcademicSections] = useState<AcademicSectionItem[]>(
    () =>
      classId
        ? (initialAcademicSections ?? cachedSectionsResponse?.sections ?? []).filter(
            (section) => getAcademicSectionClassId(section) === classId,
          )
        : [],
  );
  const [allTags, setAllTags] = useState<TagItem[]>(
    () => initialTags ?? cachedTagsResponse?.tags ?? [],
  );
  const [initialDataLoading, setInitialDataLoading] = useState(
    () => !(hasProvidedSupportData || hasCachedSupportData),
  );
  const [subjectsLoading, setSubjectsLoading] = useState(
    () => !(hasProvidedSupportData || cachedSubjectsResponse?.subjects),
  );
  const [questionFilterSubjectsLoading, setQuestionFilterSubjectsLoading] = useState(false);

  // Modal State
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<(string | number)[]>([]);
  const [selectedQuestionCache, setSelectedQuestionCache] = useState<Record<string, any>>({});
  const [modalSearch, setModalSearch] = useState('');
  const [questionFilterClassId, setQuestionFilterClassId] = useState('all');
  const [questionFilterSubjectId, setQuestionFilterSubjectId] = useState('all');
  const selectedTagIdsKey = useMemo(
    () => selectedTags.map((tag) => String(tag._id || '')).sort().join(','),
    [selectedTags],
  );
  const hydrateQuestionPickerResults = useCallback((data: QuestionPickerResponse | null | undefined) => {
    const questions = Array.isArray(data?.questions) ? data?.questions : [];
    setAvailableQuestions(questions);
    setQuestionResultCount(
      Number.isFinite(Number(data?.total))
        ? Number(data?.total)
        : questions.length,
    );
    setQuestionPageCount(
      Number.isFinite(Number(data?.pages)) && Number(data?.pages) > 0
        ? Number(data?.pages)
        : 1,
    );
    setQuestionPage(
      Number.isFinite(Number(data?.page)) && Number(data?.page) > 0
        ? Number(data?.page)
        : 1,
    );
  }, []);
  const clearQuestionPickerResults = useCallback(() => {
    setAvailableQuestions([]);
    setQuestionResultCount(0);
    setQuestionPageCount(1);
  }, []);

  // Fetch initial data
  useEffect(() => {
    if (hasProvidedSupportData) {
      setInitialDataLoading(false);
      setSubjectsLoading(false);
      return;
    }

    const fetchInitialData = async () => {
      setInitialDataLoading(!hasCachedSupportData);
      setSubjectsLoading(!cachedSubjectsResponse?.subjects);
      try {
        const [classesData, tagsData, subjectsData] = await Promise.all([
          fetchApiJson<{ classes?: Class[] }>('/api/classes', {
            cache: 'no-store',
            fallbackMessage: 'Failed to load initial data.',
            clientCacheTtlMs: SUPPORT_DATA_CACHE_TTL_MS,
            preferClientCache: true,
          }),
          fetchApiJson<{ tags?: TagItem[] }>('/api/tags/with-subjects', {
            cache: 'no-store',
            fallbackMessage: 'Failed to load initial data.',
            clientCacheTtlMs: SUPPORT_DATA_CACHE_TTL_MS,
            preferClientCache: true,
          }),
          fetchApiJson<{ subjects?: SubjectWithTags[] }>('/api/subjects', {
            cache: 'no-store',
            fallbackMessage: 'Failed to load initial data.',
            clientCacheTtlMs: SUPPORT_DATA_CACHE_TTL_MS,
            preferClientCache: true,
          }),
        ]);
        setClasses(classesData.classes || []);
        setAllTags(tagsData.tags || []);
        setSubjects(subjectsData.subjects || []);
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to load initial data.', variant: 'destructive' });
      } finally {
        setSubjectsLoading(false);
        setInitialDataLoading(false);
      }
    };
    fetchInitialData();
  }, [
    cachedSubjectsResponse?.subjects,
    hasCachedSupportData,
    hasProvidedSupportData,
    toast,
  ]);

  useEffect(() => {
    if (initialAcademicSections) {
      if (!classId) {
        setAvailableAcademicSections([]);
        setAssignedAcademicSectionIds([]);
        return;
      }

      const nextSections = initialAcademicSections.filter(
        (section) => getAcademicSectionClassId(section) === classId,
      );
      setAvailableAcademicSections(nextSections);
      const validIds = new Set(nextSections.map((section) => section._id));
      setAssignedAcademicSectionIds((prev) => prev.filter((id) => validIds.has(id)));
      return;
    }

    const fetchAcademicSections = async () => {
      if (!classId) {
        setAvailableAcademicSections([]);
        setAssignedAcademicSectionIds([]);
        return;
      }

      const cachedSections = cachedSectionsResponse?.sections || [];
      if (cachedSections.length > 0) {
        const nextSections = cachedSections.filter(
          (section) => getAcademicSectionClassId(section) === classId,
        );
        setAvailableAcademicSections(nextSections);
        const validIds = new Set(nextSections.map((section) => section._id));
        setAssignedAcademicSectionIds((prev) => prev.filter((id) => validIds.has(id)));
      }

      try {
        const data = await fetchApiJson<{ sections?: AcademicSectionItem[] }>(
          `/api/sections?classId=${classId}`,
          {
            cache: 'no-store',
            fallbackMessage: 'Failed to load academic sections.',
            clientCacheTtlMs: SUPPORT_DATA_CACHE_TTL_MS,
            preferClientCache: true,
          },
        );
        const nextSections = data.sections || [];
        setAvailableAcademicSections(nextSections);
        const validIds = new Set(nextSections.map((section: AcademicSectionItem) => section._id));
        setAssignedAcademicSectionIds((prev) => prev.filter((id) => validIds.has(id)));
      } catch (error) {
        if ((cachedSectionsResponse?.sections || []).length === 0) {
          setAvailableAcademicSections([]);
        }
      }
    };

    fetchAcademicSections();
  }, [cachedSectionsResponse?.sections, classId, initialAcademicSections]);

  useEffect(() => {
    if (questionFilterClassId === 'all') {
      setQuestionFilterSubjects(subjects);
      setQuestionFilterSubjectId((current) =>
        current === 'all' || subjects.some((subject) => subject._id === current)
          ? current
          : 'all',
      );
      setQuestionFilterSubjectsLoading(false);
      return;
    }

    if (!questionModalOpen) {
      return;
    }

    const abortController = new AbortController();
    setQuestionFilterSubjectsLoading(true);

    fetchApiJson<{ subjects?: SubjectWithTags[] }>(
      `/api/subjects?classId=${questionFilterClassId}`,
      {
        signal: abortController.signal,
        cache: 'no-store',
        fallbackMessage: 'Could not load subjects for the selected question class.',
        clientCacheTtlMs: SUPPORT_DATA_CACHE_TTL_MS,
        preferClientCache: true,
      },
    )
      .then((data) => {
        const nextSubjects = Array.isArray(data.subjects) ? data.subjects : [];
        setQuestionFilterSubjects(nextSubjects);
        setQuestionFilterSubjectId((current) =>
          current === 'all' || nextSubjects.some((subject) => subject._id === current)
            ? current
            : 'all',
        );
      })
      .catch((error) => {
        if (error?.name === 'AbortError') {
          return;
        }

        setQuestionFilterSubjects([]);
        setQuestionFilterSubjectId('all');
        toast({
          title: 'Subject filters unavailable',
          description: 'Could not load subjects for the selected question class.',
          variant: 'destructive',
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
  }, [questionFilterClassId, questionModalOpen, subjects, toast]);

  useEffect(() => {
    if (!questionModalOpen) {
      setLoadingQuestions(false);
      clearQuestionPickerResults();
      return;
    }

    const abortController = new AbortController();
    setLoadingQuestions(true);
    const endpoint = buildQuestionPickerEndpoint({
      activeSectionId,
      sections,
      classId: questionFilterClassId,
      subjectId: questionFilterSubjectId,
      selectedTagIdsKey,
      questionTagMatchMode,
      questionSearch: modalSearch,
      questionPage,
      questionPageSize: QUESTION_FILTER_PAGE_SIZE,
    });

    fetchApiJson<QuestionPickerResponse>(endpoint, {
      signal: abortController.signal,
      cache: 'no-store',
      fallbackMessage: 'Could not load questions for the current filters.',
      clientCacheTtlMs: QUESTION_FILTER_CACHE_TTL_MS,
      preferClientCache: true,
    })
      .then(data => {
        hydrateQuestionPickerResults(data);
      })
      .catch(error => {
        if (error?.name !== 'AbortError') {
          clearQuestionPickerResults();
          toast({
            title: 'Question bank load failed',
            description: 'Could not load questions for the current filters.',
            variant: 'destructive',
          });
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoadingQuestions(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [
    clearQuestionPickerResults,
    hydrateQuestionPickerResults,
    modalSearch,
    activeSectionId,
    questionPage,
    questionFilterClassId,
    questionFilterSubjectId,
    questionModalOpen,
    questionTagMatchMode,
    sections,
    selectedTagIdsKey,
    toast,
  ]);

  useEffect(() => {
    if (questionModalOpen) {
      return;
    }

    const prefetchableSections = sections.filter(
      (section) =>
        section.name.trim().length > 0 &&
        typeof section.defaultMarks === 'number' &&
        section.defaultMarks > 0,
    );

    if (prefetchableSections.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      prefetchableSections.forEach((section) => {
        const endpoint = buildQuestionPickerEndpoint({
          activeSectionId: section.id,
          sections,
          classId: questionFilterClassId,
          subjectId: questionFilterSubjectId,
          selectedTagIdsKey,
          questionTagMatchMode,
          questionSearch: '',
          questionPage: 1,
          questionPageSize: QUESTION_FILTER_PAGE_SIZE,
        });

        const cachedResponse = peekCachedApiJson<QuestionPickerResponse>(endpoint, {
          clientCacheTtlMs: QUESTION_FILTER_CACHE_TTL_MS,
        });
        if (cachedResponse) {
          return;
        }

        void prefetchApiJson<QuestionPickerResponse>(endpoint, {
          cache: 'no-store',
          fallbackMessage: 'Could not preload picker results.',
          clientCacheTtlMs: QUESTION_FILTER_CACHE_TTL_MS,
        });
      });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    questionFilterClassId,
    questionFilterSubjectId,
    questionModalOpen,
    questionTagMatchMode,
    sections,
    selectedTagIdsKey,
  ]);

  useEffect(() => {
    if (availableQuestions.length === 0) {
      return;
    }

    setSelectedQuestionCache((currentCache) => {
      const nextCache = { ...currentCache };
      let changed = false;

      availableQuestions.forEach((question) => {
        const questionId = String(question?._id || '');
        if (!questionId) return;
        if (nextCache[questionId] !== question) {
          nextCache[questionId] = question;
          changed = true;
        }
      });

      return changed ? nextCache : currentCache;
    });
  }, [availableQuestions]);

  // Computed Values
  const totalPaperMarks = useMemo(
    () => sections.reduce((sum, s) => sum + s.questions.reduce((qsum, q) => qsum + q.marks, 0), 0),
    [sections]
  );
  const totalQuestions = useMemo(
    () => sections.reduce((sum, section) => sum + section.questions.length, 0),
    [sections]
  );
  const derivedSubjects = useMemo(() => {
    const knownSubjectNames = new Map(
      subjects.map((subject) => [String(subject._id || '').trim(), String(subject.name || '').trim()]),
    );

    return resolvePaperSubjects({ sections }).map((subject) => ({
      ...subject,
      name: subject.name || knownSubjectNames.get(subject._id) || subject._id,
    }));
  }, [sections, subjects]);
  const normalizedAllTags = useMemo(
    () =>
      allTags.map((tag) => ({
        _id: tag._id,
        name: tag.name,
        type: {
          _id: (tag.type as any)?._id ?? '',
          name: (tag.type as any)?.name ?? '',
        },
      })),
    [allTags],
  );
  // Modal: Filter questions (exclude those already in other sections)
  const modalAvailableQuestions = useMemo(() => {
    if (!activeSectionId) return [];
    return availableQuestions;
  }, [availableQuestions, activeSectionId]);

  // Section Handlers
  const handleAddSection = () => {
    const nextSectionId = `section-${nextSectionIdRef.current}`;
    nextSectionIdRef.current += 1;

    setSections(prev => [
      ...prev,
      {
        id: nextSectionId,
        name: '',
        description: '',
        instructions: '',
        defaultMarks: undefined,
        defaultNegativeMarks: 0, 
        questions: []
      }
    ]);
  };

  const handleUpdateSection = (
    id: string,
    field: 'name' | 'description' | 'instructions' | 'defaultMarks' | 'defaultNegativeMarks',
    value: string | number | undefined
  ) => {
    setSections(prev =>
      prev.map(s => {
        if (s.id === id) {
          const updatedSection = { ...s, [field]: value };
          const numericValue = Number(value);

          // If default marks are updated, apply to all questions in this section
          if (field === 'defaultMarks' && !isNaN(numericValue)) {
            updatedSection.questions = updatedSection.questions.map(q => ({
              ...q,
              marks: numericValue,
            }));
          }

          // If default negative marks are updated, apply to all questions in this section
          if (field === 'defaultNegativeMarks' && !isNaN(numericValue)) {
            updatedSection.questions = updatedSection.questions.map(q => ({
              ...q,
              negativeMarks: numericValue,
            }));
          }
          
          return updatedSection;
        }
        return s;
      })
    );
  };

  const handleRemoveSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
  };

  const handleRemoveQuestionFromSection = (sectionId: string, questionId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, questions: s.questions.filter(q => q.question._id !== questionId) }
        : s
    ));
  };

  const handleUpdateQuestionInPaper = (
    sectionId: string,
    questionId: string,
    field: 'marks' | 'negativeMarks',
    value: number
  ) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, questions: s.questions.map(q => q.question._id === questionId ? { ...q, [field]: value } : q) }
        : s
    ));
  };

  // Modal Handlers
  const openQuestionModal = (sectionId: string) => {
    const currentSectionQuestions =
      sections.find(s => s.id === sectionId)?.questions || [];
    const cachedPickerEndpoint = buildQuestionPickerEndpoint({
      activeSectionId: sectionId,
      sections,
      classId: questionFilterClassId,
      subjectId: questionFilterSubjectId,
      selectedTagIdsKey,
      questionTagMatchMode,
      questionSearch: '',
      questionPage: 1,
      questionPageSize: QUESTION_FILTER_PAGE_SIZE,
    });
    const cachedPickerResponse = peekCachedApiJson<QuestionPickerResponse>(
      cachedPickerEndpoint,
      {
        clientCacheTtlMs: QUESTION_FILTER_CACHE_TTL_MS,
      },
    );

    setActiveSectionId(sectionId);
    setSelectedQuestionIds(currentSectionQuestions.map(q => String(q.question._id)));
    setSelectedQuestionCache((currentCache) => {
      const nextCache = { ...currentCache };
      currentSectionQuestions.forEach((questionInPaper) => {
        const questionId = String(questionInPaper.question?._id || '');
        if (!questionId) return;
        nextCache[questionId] = questionInPaper.question;
      });
      return nextCache;
    });
    setModalSearch('');
    setQuestionPage(1);
    if (cachedPickerResponse) {
      hydrateQuestionPickerResults(cachedPickerResponse);
      setLoadingQuestions(false);
    } else {
      clearQuestionPickerResults();
      setLoadingQuestions(true);
    }
    setQuestionModalOpen(true);
  };

  const fetchPickerQuestionsByIds = useCallback(
    async (questionIds: string[]) => {
      const normalizedQuestionIds = Array.from(
        new Set(questionIds.map((questionId) => String(questionId)).filter(Boolean)),
      );

      if (normalizedQuestionIds.length === 0) {
        return [];
      }

      const questionChunks: string[][] = [];
      for (
        let index = 0;
        index < normalizedQuestionIds.length;
        index += QUESTION_PICKER_FETCH_BY_IDS_CHUNK_SIZE
      ) {
        questionChunks.push(
          normalizedQuestionIds.slice(
            index,
            index + QUESTION_PICKER_FETCH_BY_IDS_CHUNK_SIZE,
          ),
        );
      }

      const chunkResponses = await Promise.all(
        questionChunks.map((questionChunk) =>
          fetchApiJson<QuestionPickerResponse>(
            buildQuestionPickerByIdsEndpoint(questionChunk),
            {
              cache: 'no-store',
              fallbackMessage: 'Could not fetch the selected questions.',
              clientCacheTtlMs: QUESTION_FILTER_CACHE_TTL_MS,
            },
          ),
        ),
      );

      const questionMap = new Map<string, any>();
      chunkResponses.forEach((response) => {
        (response.questions || []).forEach((question) => {
          const questionId = String(question?._id || '');
          if (questionId) {
            questionMap.set(questionId, question);
          }
        });
      });

      return normalizedQuestionIds
        .map((questionId) => questionMap.get(questionId))
        .filter(Boolean);
    },
    [],
  );

  const handleSelectAllFilteredQuestions = useCallback(async () => {
    if (!activeSectionId || selectingAllFilteredQuestions) {
      return;
    }

    setSelectingAllFilteredQuestions(true);
    try {
      const data = await fetchApiJson<QuestionPickerIdsResponse>(
        buildQuestionPickerIdsEndpoint({
          activeSectionId,
          sections,
          classId: questionFilterClassId,
          subjectId: questionFilterSubjectId,
          selectedTagIdsKey,
          questionTagMatchMode,
          questionSearch: modalSearch,
        }),
        {
          cache: 'no-store',
          fallbackMessage: 'Could not select all filtered questions.',
          clientCacheTtlMs: QUESTION_FILTER_CACHE_TTL_MS,
        },
      );

      const filteredQuestionIds = Array.from(
        new Set((data.questionIds || []).map((questionId) => String(questionId)).filter(Boolean)),
      );

      if (filteredQuestionIds.length === 0) {
        toast({
          title: 'No matching questions',
          description: 'There are no filtered questions to add right now.',
          variant: 'destructive',
        });
        return;
      }

      const currentlySelectedIds = new Set(
        selectedQuestionIds.map((questionId) => String(questionId)),
      );
      const addedCount = filteredQuestionIds.filter(
        (questionId) => !currentlySelectedIds.has(questionId),
      ).length;

      setSelectedQuestionIds((currentIds) => {
        const nextIds = new Set(currentIds.map((questionId) => String(questionId)));
        filteredQuestionIds.forEach((questionId) => nextIds.add(questionId));
        return Array.from(nextIds);
      });

      toast({
        title:
          addedCount > 0
            ? 'Filtered questions selected'
            : 'All filtered questions already selected',
        description:
          addedCount > 0
            ? `${addedCount} more question${addedCount === 1 ? '' : 's'} added from the current filters.`
            : 'The current filtered result set is already in your selection.',
      });
    } catch (error) {
      toast({
        title: 'Selection failed',
        description: 'Could not select all filtered questions.',
        variant: 'destructive',
      });
    } finally {
      setSelectingAllFilteredQuestions(false);
    }
  }, [
    activeSectionId,
    modalSearch,
    questionFilterClassId,
    questionFilterSubjectId,
    questionTagMatchMode,
    sections,
    selectedQuestionIds,
    selectedTagIdsKey,
    selectingAllFilteredQuestions,
    toast,
  ]);

  const handleConfirmQuestions = async () => {
    if (!activeSectionId) return;
    const activeSection = sections.find(s => s.id === activeSectionId);
    if (!activeSection) return;
    // Prevent adding if marks are not set
    if (typeof activeSection.defaultMarks !== 'number' || activeSection.defaultMarks <= 0) return;

    if (confirmingQuestions) {
      return;
    }

    const normalizedSelectedQuestionIds = Array.from(
      new Set(selectedQuestionIds.map((questionId) => String(questionId))),
    );

    setConfirmingQuestions(true);
    try {
      const missingSelectedQuestionIds = normalizedSelectedQuestionIds.filter(
        (questionId) => !selectedQuestionCache[String(questionId)],
      );

      const fetchedMissingQuestions =
        missingSelectedQuestionIds.length > 0
          ? await fetchPickerQuestionsByIds(missingSelectedQuestionIds)
          : [];

      const mergedQuestionCache = { ...selectedQuestionCache };
      fetchedMissingQuestions.forEach((question) => {
        const questionId = String(question?._id || '');
        if (questionId) {
          mergedQuestionCache[questionId] = question;
        }
      });

      if (fetchedMissingQuestions.length > 0) {
        setSelectedQuestionCache((currentCache) => ({
          ...currentCache,
          ...Object.fromEntries(
            fetchedMissingQuestions
              .map((question) => [String(question?._id || ''), question] as const)
              .filter(([questionId]) => questionId),
          ),
        }));
      }

      const selectedQuestions = normalizedSelectedQuestionIds
        .map((questionId) => mergedQuestionCache[String(questionId)])
        .filter(Boolean);

      if (selectedQuestions.length !== normalizedSelectedQuestionIds.length) {
        toast({
          title: 'Question selection incomplete',
          description: 'A few selected questions could not be loaded. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      setSections(prev =>
        prev.map(s =>
          s.id === activeSectionId
            ? {
                ...s,
                questions: selectedQuestions
                  .map(q => ({
                    question: q,
                    marks: activeSection.defaultMarks as number,
                    negativeMarks: typeof activeSection.defaultNegativeMarks === 'number'
                      ? activeSection.defaultNegativeMarks
                      : 0,
                  })),
            }
          : s
        )
      );
      setQuestionModalOpen(false);
      setActiveSectionId(null);
      setSelectedQuestionIds([]);
      setModalSearch('');
    } catch (error) {
      toast({
        title: 'Could not add selected questions',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setConfirmingQuestions(false);
    }
  };

  // Save Paper
  const handleSavePaper = async () => {
    // Paper-level validations
    if (!paperTitle.trim()) {
      toast({ title: 'Validation Error', description: 'Paper Title is required.', variant: 'destructive' });
      return;
    }
    if (!classId) {
      toast({ title: 'Validation Error', description: 'Class is required.', variant: 'destructive' });
      return;
    }
    if (!duration || isNaN(Number(duration)) || Number(duration) <= 0) {
      toast({ title: 'Validation Error', description: 'Duration must be a positive number.', variant: 'destructive' });
      return;
    }
    if (passingMarks === undefined || passingMarks === null || isNaN(Number(passingMarks)) || Number(passingMarks) < 0) {
      toast({ title: 'Validation Error', description: 'Passing marks must be 0 or greater.', variant: 'destructive' });
      return;
    }
    if (!examDate || isNaN(Date.parse(examDate.toString()))) {
      toast({ title: 'Validation Error', description: 'Exam date is required.', variant: 'destructive' });
      return;
    }
    const effectiveOnlineStart = onlineStartsAt || examDate;
    if (
      onlineEnabled &&
      onlineEndsAt &&
      effectiveOnlineStart &&
      onlineEndsAt.getTime() <= effectiveOnlineStart.getTime()
    ) {
      toast({
        title: 'Validation Error',
        description: 'Online end time must be after the online start time.',
        variant: 'destructive',
      });
      return;
    }
    if (sections.length === 0) {
      toast({ title: 'Validation Error', description: 'Add at least one section.', variant: 'destructive' });
      return;
    }

    // Section-level validations
    for (const section of sections) {
      if (!section.name.trim()) {
        toast({ title: 'Validation Error', description: 'Section name is required.', variant: 'destructive' });
        return;
      }
      if (section.questions.length === 0) {
        toast({ title: `Validation Error in "${section.name}"`, description: 'Add at least one question to each section.', variant: 'destructive' });
        return;
      }
      if (typeof section.defaultMarks !== 'number' || section.defaultMarks <= 0) {
        toast({ title: `Validation Error in "${section.name}"`, description: 'Default marks must be a positive number.', variant: 'destructive' });
        return;
      }
      if (typeof section.defaultNegativeMarks !== 'number' || section.defaultNegativeMarks < 0) {
        toast({ title: `Validation Error in "${section.name}"`, description: 'Default negative marks must be 0 or greater.', variant: 'destructive' });
        return;
      }
      for (const q of section.questions) {
        if (q.marks === undefined || q.marks === null || isNaN(Number(q.marks)) || Number(q.marks) < 0) {
          toast({
            title: `Validation Error in "${section.name}"`,
            description: 'Question marks must be at least 0.',
            variant: 'destructive',
          });
          return;
        }
        if (q.negativeMarks === undefined || q.negativeMarks === null || isNaN(Number(q.negativeMarks)) || Number(q.negativeMarks) < 0) {
          toast({
            title: `Validation Error in "${section.name}"`,
            description: 'Negative marks must be at least 0.',
            variant: 'destructive',
          });
          return;
        }
      }
    }

    if (derivedSubjects.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Each selected question must have a subject so the paper can derive its subject mix.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: paperTitle,
        instructions,
        class: classId,
        duration,
        passingMarks,
        examDate,
        onlineEnabled,
        onlineStartsAt: onlineStartsAt ? onlineStartsAt.toISOString() : undefined,
        onlineEndsAt: onlineEndsAt ? onlineEndsAt.toISOString() : undefined,
        totalMarks: totalPaperMarks,
        assignedAcademicSections: assignedAcademicSectionIds,
        sections: sections.map(s => ({
          name: s.name,
          description: s.description,
          instructions: s.instructions,
          defaultMarks: s.defaultMarks,
          defaultNegativeMarks: s.defaultNegativeMarks,
          marks: calculateSectionTotalMarks(s),
          questions: s.questions.map(q => ({
            question: q.question._id,
            marks: q.marks,
            negativeMarks: q.negativeMarks,
          })),
        })),
      };

      let res, data;
      if (isEditMode && initialData?._id) {
        // EDIT: Update existing paper
        res = await fetch(`/api/question-papers/${initialData._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // CREATE: New paper
        res = await fetch('/api/question-papers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      data = await res.json();

      if (data.success) {
        toast({ title: 'Success', description: isEditMode ? 'Question paper updated.' : 'Question paper created successfully.' });
        if (isEditMode) {
          navigateBack();
          return;
        }
        const nextHref = `/workspace/question-papers/view/${data.paper._id}`;
        announceNavigationStart(nextHref);
        router.push(nextHref);
      } else {
        toast({ title: 'Error', description: data.message || 'Failed to save paper.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Network Error', description: 'Could not save question paper.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // --- Render ---
  return (
    <div className="space-y-4 sm:space-y-5">
      {initialSupportMessage ? (
        <div className="app-feedback app-feedback-info">{initialSupportMessage}</div>
      ) : null}

      <div className="app-editor-grid app-editor-grid-builder">
        <main className="app-editor-main">
          <div className="app-surface overflow-hidden border-border/70 shadow-[0_26px_46px_-38px_hsl(var(--app-shadow-deep)/0.18)]">
            <div className="relative overflow-hidden app-section-header bg-[linear-gradient(145deg,hsl(var(--app-surface-tint)/0.42)_0%,hsl(var(--app-surface-1)/0.99)_46%,hsl(var(--app-surface-2)/0.92)_100%)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/36 to-transparent" />
              <div className="pointer-events-none absolute -right-16 top-0 h-28 w-28 rounded-full bg-primary/10 blur-3xl" />
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-primary/16 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                      Builder
                    </span>
                    {sections.length > 0 ? (
                      <>
                        <span className="inline-flex items-center rounded-full border border-border/60 bg-background/88 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
                          {sections.length} sections
                        </span>
                        <span className="inline-flex items-center rounded-full border border-border/60 bg-background/88 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
                          {totalQuestions} questions
                        </span>
                        <span className="inline-flex items-center rounded-full border border-primary/16 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm">
                          {totalPaperMarks} marks
                        </span>
                      </>
                    ) : null}
                  </div>
                  <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                    Section Builder
                  </h2>
                </div>
                <Button
                  variant="default"
                  className="app-button-inline shadow-[0_20px_34px_-24px_hsl(var(--primary)/0.36)]"
                  onClick={handleAddSection}
                >
                  <Plus className="h-4 w-4" />
                  Add New Section
                </Button>
              </div>
            </div>

            <div className="app-section-body">
              {sections.length > 0 ? (
                <Accordion
                  type="multiple"
                  className="space-y-3"
                  defaultValue={sections.map(section => section.id)}
                >
                  {sections.map((section, sectionIndex) => {
                    const sectionTotalMarks = section.questions.reduce((sum, question) => sum + question.marks, 0);
                    const canAddQuestions =
                      section.name.trim().length > 0 &&
                      typeof section.defaultMarks === 'number' &&
                      section.defaultMarks > 0;
                    const sectionNumberLabel = String(sectionIndex + 1).padStart(2, '0');

                    return (
                      <AccordionItem
                        key={section.id}
                        value={section.id}
                        className="group relative overflow-hidden rounded-[calc(var(--app-radius-xl)+0.125rem)] border border-border/72 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.998)_0%,hsl(var(--app-surface-2)/0.9)_100%)] shadow-[0_24px_40px_-36px_hsl(var(--app-shadow-deep)/0.16)] transition-[border-color,box-shadow] duration-200 data-[state=open]:border-primary/16 data-[state=open]:shadow-[0_28px_46px_-34px_hsl(var(--primary)/0.16)]"
                      >
                        <AccordionTrigger className="gap-4 px-4 py-4 text-left hover:no-underline data-[state=open]:bg-[hsl(var(--app-surface-tint)/0.18)] [&>svg]:mt-1 [&>svg]:text-muted-foreground data-[state=open]:[&>svg]:text-primary">
                          <div className="flex min-w-0 flex-1 items-start gap-3.5">
                            <div
                              className={cn(
                                "flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.15rem] border text-sm font-semibold shadow-sm",
                                canAddQuestions
                                  ? "border-primary/18 bg-primary/10 text-primary shadow-[0_18px_30px_-24px_hsl(var(--primary)/0.34)]"
                                  : "border-border/70 bg-background/88 text-foreground/88",
                              )}
                            >
                              {sectionNumberLabel}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded-full border border-primary/16 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                                  Section {sectionIndex + 1}
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]",
                                    canAddQuestions
                                      ? "border-emerald-300/55 bg-emerald-50 text-emerald-800 dark:border-emerald-700/45 dark:bg-emerald-950/35 dark:text-emerald-200"
                                      : "border-amber-300/55 bg-amber-50 text-amber-800 dark:border-amber-700/45 dark:bg-amber-950/35 dark:text-amber-200",
                                  )}
                                >
                                  {canAddQuestions ? 'Ready for Questions' : 'Setup Needed'}
                                </span>
                              </div>
                              <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                                <h3 className="truncate text-[18px] font-semibold tracking-[-0.04em] text-foreground">
                                  {section.name || `Untitled Section ${sectionIndex + 1}`}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                  <span className="rounded-full border border-border/60 bg-background/88 px-3 py-1.5 text-xs font-semibold shadow-sm">
                                    {section.questions.length} question{section.questions.length === 1 ? '' : 's'}
                                  </span>
                                  <span className="rounded-full border border-border/60 bg-background/88 px-3 py-1.5 text-xs font-semibold shadow-sm">
                                    +{section.defaultMarks ?? 0} / -{section.defaultNegativeMarks ?? 0}
                                  </span>
                                  <span className="rounded-full border border-primary/16 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm">
                                    {sectionTotalMarks} marks
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="border-t border-border/60 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.84)_0%,hsl(var(--app-surface-2)/0.62)_100%)]">
                          <SectionEditor
                            section={section}
                            onUpdate={(field, value) =>
                              handleUpdateSection(
                                section.id,
                                field as 'name' | 'description' | 'instructions' | 'defaultMarks' | 'defaultNegativeMarks',
                                value,
                              )
                            }
                            onRemove={() => handleRemoveSection(section.id)}
                            onAddQuestions={() => openQuestionModal(section.id)}
                            canAddQuestions={canAddQuestions}
                            sectionTotalMarks={sectionTotalMarks}
                          >
                            {section.questions.length > 0 ? (
                              <div className="space-y-3">
                                {section.questions.map((questionInPaper, questionIndex) => (
                                  <SelectedPaperQuestionCard
                                    key={questionInPaper.question._id}
                                    questionInPaper={questionInPaper}
                                    questionIndex={questionIndex}
                                    classes={classes}
                                    subjects={subjects}
                                    allTags={normalizedAllTags}
                                    onRemove={() =>
                                      handleRemoveQuestionFromSection(
                                        section.id,
                                        questionInPaper.question._id,
                                      )
                                    }
                                    onSave={async updated => {
                                      setSections(prev =>
                                        prev.map(sectionItem => ({
                                          ...sectionItem,
                                          questions: sectionItem.questions.map(item =>
                                            item.question._id === updated._id
                                              ? { ...item, question: updated }
                                              : item,
                                          ),
                                        })),
                                      );
                                      setAvailableQuestions(prev =>
                                        prev.map(item => (item._id === updated._id ? updated : item)),
                                      );
                                      setSelectedQuestionCache((currentCache) => ({
                                        ...currentCache,
                                        [String(updated._id)]: updated,
                                      }));
                                    }}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="app-empty-state border-border/70 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.98)_0%,hsl(var(--app-surface-2)/0.78)_100%)] py-10">
                                <p className="text-sm font-semibold text-foreground">
                                  No questions in this section yet.
                                </p>
                                <div className="mt-4 flex justify-center">
                                  <Button
                                    variant={canAddQuestions ? "default" : "outline"}
                                    className="app-button-inline"
                                    onClick={() => openQuestionModal(section.id)}
                                    disabled={!canAddQuestions}
                                  >
                                    <Plus className="h-4 w-4" />
                                    Add Questions
                                  </Button>
                                </div>
                                {!canAddQuestions ? (
                                  <span className="mt-3 inline-flex items-center rounded-full border border-amber-300/55 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm dark:border-amber-700/45 dark:bg-amber-950/35 dark:text-amber-200">
                                    Add a name and default marks first
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </SectionEditor>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              ) : (
                <div className="app-empty-state border-border/70 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.98)_0%,hsl(var(--app-surface-2)/0.8)_100%)] py-10">
                  <p className="text-sm font-semibold text-foreground">No sections added yet.</p>
                  <div className="mt-4 flex justify-center">
                    <Button variant="default" className="app-button-inline" onClick={handleAddSection}>
                      <Plus className="h-4 w-4" />
                      Add Your First Section
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="app-editor-aside app-editor-aside-sticky">
          <PaperDetailsForm
            paperTitle={paperTitle}
            setPaperTitle={setPaperTitle}
            instructions={instructions}
            setInstructions={setInstructions}
            duration={duration}
            setDuration={setDuration}
            passingMarks={passingMarks}
            setPassingMarks={setPassingMarks}
            examDate={examDate}
            setExamDate={setExamDate}
            onlineEnabled={onlineEnabled}
            setOnlineEnabled={setOnlineEnabled}
            onlineStartsAt={onlineStartsAt}
            setOnlineStartsAt={setOnlineStartsAt}
            onlineEndsAt={onlineEndsAt}
            setOnlineEndsAt={setOnlineEndsAt}
            classId={classId}
            setClassId={setClassId}
            classes={classes}
            derivedSubjects={derivedSubjects}
            availableAcademicSections={availableAcademicSections}
            assignedAcademicSectionIds={assignedAcademicSectionIds}
            setAssignedAcademicSectionIds={setAssignedAcademicSectionIds}
            compact
            initialDataLoading={initialDataLoading}
          />
          <PaperSummary
            sections={sections}
            totalPaperMarks={totalPaperMarks}
            duration={duration}
            passingMarks={passingMarks}
            examDate={examDate ? examDate.toISOString() : ''}
            onlineEnabled={onlineEnabled}
            onlineStartsAt={onlineStartsAt ? onlineStartsAt.toISOString() : null}
            onlineEndsAt={onlineEndsAt ? onlineEndsAt.toISOString() : null}
            subjects={derivedSubjects}
          />
          <Button size="lg" className="w-full" onClick={handleSavePaper} disabled={saving}>
            {saving ? <Spinner /> : isEditMode ? 'Update Question Paper' : 'Save Question Paper'}
          </Button>
        </aside>
      </div>

      {questionModalOpen || activeSectionId ? (
        <QuestionFilterPopup
          open={questionModalOpen}
          onOpenChange={(nextOpen) => {
            setQuestionModalOpen(nextOpen);
            if (!nextOpen) {
              setActiveSectionId(null);
              setSelectedQuestionIds([]);
              setModalSearch('');
              setQuestionPage(1);
            }
          }}
          classes={classes}
          classId={questionFilterClassId}
          setClassId={id => {
            setQuestionPage(1);
            setQuestionFilterClassId(String(id));
          }}
          subjects={questionFilterSubjects}
          subjectId={questionFilterSubjectId}
          setSubjectId={id => {
            setQuestionPage(1);
            setQuestionFilterSubjectId(String(id));
          }}
          subjectsLoading={subjectsLoading || questionFilterSubjectsLoading}
          allTags={normalizedAllTags}
          selectedTags={selectedTags}
          setSelectedTags={(tags) => {
            setQuestionPage(1);
            setSelectedTags(tags);
          }}
          questionTagMatchMode={questionTagMatchMode}
          setQuestionTagMatchMode={setQuestionTagMatchMode}
          initialDataLoading={initialDataLoading}
          modalSearch={modalSearch}
          setModalSearch={setModalSearch}
          loadingQuestions={loadingQuestions}
          modalAvailableQuestions={modalAvailableQuestions}
          questionResultCount={questionResultCount}
          questionPage={questionPage}
          setQuestionPage={setQuestionPage}
          questionPageCount={questionPageCount}
          questionPageSize={QUESTION_FILTER_PAGE_SIZE}
          selectedQuestionIds={selectedQuestionIds}
          setSelectedQuestionIds={setSelectedQuestionIds}
          handleConfirmQuestions={handleConfirmQuestions}
          handleSelectAllFilteredQuestions={handleSelectAllFilteredQuestions}
          confirmingQuestions={confirmingQuestions}
          selectingAllFilteredQuestions={selectingAllFilteredQuestions}
          handleEditQuestionSave={async updatedQuestion => {
            setSections(prev =>
              prev.map(section => ({
                ...section,
                questions: section.questions.map(question =>
                  question.question._id === updatedQuestion._id
                    ? { ...question, question: updatedQuestion }
                    : question,
                ),
              })),
            );
            setAvailableQuestions(prev =>
              prev.map(question => (question._id === updatedQuestion._id ? updatedQuestion : question)),
            );
            setSelectedQuestionCache((currentCache) => ({
              ...currentCache,
              [String(updatedQuestion._id)]: updatedQuestion,
            }));
          }}
          toast={toast}
        />
      ) : null}
    </div>
  );
}
