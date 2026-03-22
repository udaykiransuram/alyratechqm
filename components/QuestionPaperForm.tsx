'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Button }  from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Plus, X } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import type { Question } from '@/components/question-items';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { useBackNavigation } from '@/hooks/useReturnNavigation';
import { fetchApiJson, peekCachedApiJson } from '@/lib/client/api';
import { announceNavigationStart } from '@/lib/client/navigation-feedback';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function SidebarPanelSkeleton({
  title,
  rows = 4,
}: {
  title: string;
  rows?: number;
}) {
  return (
    <div className="app-surface overflow-hidden">
      <div className="app-section-header">
        <div className="text-base font-semibold text-foreground">{title}</div>
      </div>
      <div className="app-section-body space-y-3.5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

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
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="h-5 w-40 animate-pulse rounded bg-muted" />
                <div className="h-4 w-64 animate-pulse rounded bg-muted/80" />
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs text-muted-foreground">
                <Spinner />
                Loading
              </span>
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

const PaperDetailsForm = dynamic(
  () =>
    import('@/components/PaperDetailsForm').then(
      (module) => module.PaperDetailsForm,
    ),
  {
    loading: () => <SidebarPanelSkeleton title="Paper Details" rows={6} />,
  },
);

const PaperSummary = dynamic(
  () => import('@/components/PaperSummary').then((module) => module.PaperSummary),
  {
    loading: () => <SidebarPanelSkeleton title="Paper Summary" rows={5} />,
  },
);

const SectionEditor = dynamic(
  () => import('@/components/SectionEditor').then((module) => module.SectionEditor),
  {
    loading: () => <SectionEditorLoadingState />,
  },
);

const QuestionItem = dynamic(
  () => import('@/components/question-items').then((module) => module.QuestionItem),
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
  defaultMarks: number | undefined;
  defaultNegativeMarks: number | undefined;
  questions: QuestionInPaper[];
}

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
    parseStoredDate(initialData?.examDate) ?? new Date(),
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
  const [subjectId, setSubjectId] = useState(initialData?.subjectId || '');
  const [assignedAcademicSectionIds, setAssignedAcademicSectionIds] = useState<string[]>(initialData?.assignedAcademicSectionIds || []);

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
      setSubjectId(initialData.subjectId || '');
      setAssignedAcademicSectionIds(initialData.assignedAcademicSectionIds || []);
      setSections(initialData.sections || []);
    }
  }, [initialData]);

  // Question Bank State
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Filters
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [questionTagMatchMode, setQuestionTagMatchMode] = useState<'any' | 'all'>('any');

  // Global State
  const [saving, setSaving] = useState(false);
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

  // Modal State
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<(string | number)[]>([]);
  const [selectedQuestionCache, setSelectedQuestionCache] = useState<Record<string, any>>({});
  const [modalSearch, setModalSearch] = useState('');
  const [questionFilterClassId, setQuestionFilterClassId] = useState('all');
  const [questionFilterSubjectId, setQuestionFilterSubjectId] = useState('all');

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
    if (!questionModalOpen) {
      setLoadingQuestions(false);
      return;
    }

    const abortController = new AbortController();
    const params = new URLSearchParams();
    const questionSearch = modalSearch.trim();

    if (questionFilterClassId !== 'all') params.append('class', questionFilterClassId);
    if (questionFilterSubjectId !== 'all') params.append('subject', questionFilterSubjectId);
    if (selectedTags.length) {
      params.append('tags', selectedTags.map(t => t._id).join(','));
      params.append('tagsMode', questionTagMatchMode === 'all' ? 'and' : 'or');
    }
    if (questionSearch) params.append('search', questionSearch);

    setLoadingQuestions(true);
    const qs = params.toString();
    const endpoint = qs ? `/api/questions?${qs}` : '/api/questions';

    fetchApiJson<{ questions?: any[] }>(endpoint, {
      signal: abortController.signal,
      cache: 'no-store',
      fallbackMessage: 'Could not load questions for the current filters.',
      clientCacheTtlMs: 15_000,
      preferClientCache: true,
    })
      .then(data => {
        setAvailableQuestions(data.questions || []);
      })
      .catch(error => {
        if (error?.name !== 'AbortError') {
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
    modalSearch,
    questionFilterClassId,
    questionFilterSubjectId,
    questionModalOpen,
    questionTagMatchMode,
    selectedTags,
    toast,
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
  const pageTitle = isEditMode ? 'Edit Question Paper' : 'Create Question Paper';
  const pageSubtitle = isEditMode
    ? 'Refine the paper structure, question mix, and grading rules before publishing.'
    : 'Build a new paper with consistent sections, question selection, and scoring rules.';

  // Modal: Filter questions (exclude those already in other sections)
  const modalAvailableQuestions = useMemo(() => {
    if (!activeSectionId) return [];
    const usedIds = sections
      .filter(s => s.id !== activeSectionId)
      .flatMap(s => s.questions.map(q => String(q.question._id)));
    return availableQuestions
      .filter(q => !usedIds.includes(String(q._id)));
  }, [availableQuestions, sections, activeSectionId]);

  // Section Handlers
  const handleAddSection = () => {
    setSections(prev => [
      ...prev,
      {
        id: `section-${Date.now()}`,
        name: '',
        description: '',
        defaultMarks: undefined,
        defaultNegativeMarks: 0, 
        questions: []
      }
    ]);
  };

  const handleUpdateSection = (
    id: string,
    field: 'name' | 'description' | 'defaultMarks' | 'defaultNegativeMarks',
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
    setQuestionModalOpen(true);
  };

  const handleConfirmQuestions = () => {
    if (!activeSectionId) return;
    const activeSection = sections.find(s => s.id === activeSectionId);
    if (!activeSection) return;
    // Prevent adding if marks are not set
    if (typeof activeSection.defaultMarks !== 'number' || activeSection.defaultMarks <= 0) return;

    const normalizedSelectedQuestionIds = Array.from(
      new Set(selectedQuestionIds.map((questionId) => String(questionId))),
    );

    const selectedQuestions = normalizedSelectedQuestionIds
      .map((questionId) => selectedQuestionCache[String(questionId)])
      .filter(Boolean);

    if (selectedQuestions.length !== normalizedSelectedQuestionIds.length) {
      toast({
        title: 'Question selection incomplete',
        description: 'A few selected questions are missing from the current cache. Please reopen the picker and try again.',
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
                  marks: activeSection.defaultMarks as number, // always a number here
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
    if (!subjectId) {
      toast({ title: 'Validation Error', description: 'Subject is required.', variant: 'destructive' });
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

    setSaving(true);
    try {
      const payload = {
        title: paperTitle,
        instructions,
        class: classId,
        subject: subjectId,
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
          marks: s.questions.reduce((sum, q) => sum + q.marks, 0),
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
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="Assessments"
        title={pageTitle}
        description={pageSubtitle}
        actions={
          <Button type="button" variant="outline" onClick={navigateBack}>
            {isEditMode ? 'Back' : 'Cancel'}
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">{isEditMode ? 'Paper maintenance' : 'Paper builder'}</span>
            <span className="app-meta-chip">{onlineEnabled ? 'Online delivery enabled' : 'Offline / manual delivery'}</span>
          </>
        }
        stats={[
          {
            label: 'Sections',
            value: String(sections.length),
            meta: 'Each section can carry its own defaults and selected question set.',
          },
          {
            label: 'Questions',
            value: String(totalQuestions),
            meta: 'Current total across every section in the paper.',
          },
          {
            label: 'Total marks',
            value: String(totalPaperMarks),
            meta: 'Marks update automatically as you refine the paper structure.',
          },
        ]}
      />

      {initialSupportMessage ? (
        <div className="app-feedback app-feedback-info">{initialSupportMessage}</div>
      ) : null}

      <div className="app-editor-grid">
        <main className="app-editor-main">
          <div className="app-surface overflow-hidden">
            <div className="app-section-header">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Section Builder</h2>
                  <p className="app-page-subtitle">Organize sections, set defaults, and add questions to each block.</p>
                </div>
                <Button variant="outline" className="border-dashed" onClick={handleAddSection}>
                  <Plus className="mr-2 h-4 w-4" />
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

                    return (
                      <AccordionItem
                        key={section.id}
                        value={section.id}
                        className="overflow-hidden rounded-2xl border border-border/60 bg-background"
                      >
                        <AccordionTrigger className="px-4 py-3.5 text-left hover:no-underline">
                          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <h3 className="truncate text-base font-semibold text-foreground">
                              {section.name || `Section ${sectionIndex + 1}`}
                            </h3>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                              <span className="rounded-full bg-muted px-2.5 py-1">
                                {section.questions.length} question{section.questions.length === 1 ? '' : 's'}
                              </span>
                              <span className="rounded-full bg-muted px-2.5 py-1">{sectionTotalMarks} marks</span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="border-t border-border/60">
                          <SectionEditor
                            section={section}
                            onUpdate={(field, value) =>
                              handleUpdateSection(
                                section.id,
                                field as 'name' | 'description' | 'defaultMarks' | 'defaultNegativeMarks',
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
                                  <div
                                    key={questionInPaper.question._id}
                                    className="rounded-2xl border border-border/60 bg-muted/10 p-2.5 transition"
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="mb-2 flex flex-wrap items-center gap-2">
                                          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-foreground">
                                            Q{questionIndex + 1}
                                          </span>
                                          <span className="text-xs text-muted-foreground">ID: {questionInPaper.question._id}</span>
                                        </div>
                                        <QuestionItem
                                          compact
                                          question={questionInPaper.question}
                                          classes={classes}
                                          subjects={subjects}
                                          allTags={normalizedAllTags}
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
                                          }}
                                        />
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveQuestionFromSection(section.id, questionInPaper.question._id)}
                                        aria-label="Remove question"
                                        title="Remove question"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/60 pt-3 text-xs">
                                      <div className="flex items-center gap-1.5">
                                        <Label className="font-semibold">Marks:</Label>
                                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{questionInPaper.marks}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <Label className="font-semibold">Negative:</Label>
                                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{questionInPaper.negativeMarks}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="app-empty-state">
                                <p>No questions in this section yet.</p>
                                <div className="mt-4 flex justify-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="app-button-compact"
                                    onClick={() => openQuestionModal(section.id)}
                                    disabled={!canAddQuestions}
                                  >
                                    <Plus className="mr-1 h-4 w-4" />
                                    Add Questions
                                  </Button>
                                </div>
                                {!canAddQuestions ? (
                                  <p className="mt-2 text-xs text-destructive">
                                    Enter a section name and default marks before adding questions.
                                  </p>
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
                <div className="app-empty-state">
                  <p>No sections added yet.</p>
                  <div className="mt-4 flex justify-center">
                    <Button variant="outline" onClick={handleAddSection}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Your First Section
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <aside className="app-editor-aside xl:sticky xl:top-[calc(var(--app-header-height)+1.5rem)] xl:self-start">
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
            subjectId={subjectId}
            setSubjectId={setSubjectId}
            classes={classes}
            subjects={subjects}
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
            }
          }}
          classes={classes}
          classId={questionFilterClassId}
          setClassId={id => setQuestionFilterClassId(String(id))}
          subjects={subjects}
          subjectId={questionFilterSubjectId}
          setSubjectId={id => setQuestionFilterSubjectId(String(id))}
          subjectsLoading={subjectsLoading}
          allTags={normalizedAllTags}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
          questionTagMatchMode={questionTagMatchMode}
          setQuestionTagMatchMode={setQuestionTagMatchMode}
          initialDataLoading={initialDataLoading}
          modalSearch={modalSearch}
          setModalSearch={setModalSearch}
          loadingQuestions={loadingQuestions}
          modalAvailableQuestions={modalAvailableQuestions}
          selectedQuestionIds={selectedQuestionIds}
          setSelectedQuestionIds={setSelectedQuestionIds}
          handleConfirmQuestions={handleConfirmQuestions}
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
