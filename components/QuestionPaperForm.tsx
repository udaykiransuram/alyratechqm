'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Button }  from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Plus, X } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { PaperDetailsForm } from '@/components/PaperDetailsForm';
import { PaperSummary } from '@/components/PaperSummary';
import { SectionEditor } from '@/components/SectionEditor';
import { Question, QuestionItem } from '@/components/question-items';
import { QuestionFilterPopup } from '@/components/QuestionFilterPopup';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { useBackNavigation } from '@/hooks/useReturnNavigation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface TagItem { _id: string; name: string; type: { name: string } }
interface SubjectWithTags { _id: string; name: string; tags: TagItem[] }
interface Class { _id: string; name: string }
interface AcademicSectionItem { _id: string; name: string }
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

export default function QuestionPaperForm({ initialData, isEditMode = false }: {
  initialData?: any;
  isEditMode?: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const { navigateBack } = useBackNavigation('/workspace/question-papers');

  // State initialization (use initialData if present)
  const [paperTitle, setPaperTitle] = useState(initialData?.title || '');
  const [instructions, setInstructions] = useState(initialData?.instructions || '');
  const [duration, setDuration] = useState(initialData?.duration ?? 60);
  const [passingMarks, setPassingMarks] = useState(initialData?.passingMarks ?? 0);
  const [examDate, setExamDate] = useState(
    initialData?.examDate ? new Date(initialData.examDate) : new Date()
  );
  const [onlineEnabled, setOnlineEnabled] = useState(
    Boolean(initialData?.onlineEnabled),
  );
  const [onlineStartsAt, setOnlineStartsAt] = useState<Date | null>(
    initialData?.onlineStartsAt ? new Date(initialData.onlineStartsAt) : null,
  );
  const [onlineEndsAt, setOnlineEndsAt] = useState<Date | null>(
    initialData?.onlineEndsAt ? new Date(initialData.onlineEndsAt) : null,
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
      setExamDate(initialData.examDate ? new Date(initialData.examDate) : new Date());
      setOnlineEnabled(Boolean(initialData.onlineEnabled));
      setOnlineStartsAt(
        initialData.onlineStartsAt ? new Date(initialData.onlineStartsAt) : null,
      );
      setOnlineEndsAt(
        initialData.onlineEndsAt ? new Date(initialData.onlineEndsAt) : null,
      );
      setClassId(initialData.classId || '');
      setSubjectId(initialData.subjectId || '');
      setAssignedAcademicSectionIds(initialData.assignedAcademicSectionIds || []);
      setSections(initialData.sections || []);
    }
  }, [initialData]);

  // Question Bank State
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  // Filters
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [questionTagMatchMode, setQuestionTagMatchMode] = useState<'any' | 'all'>('any');

  // Global State
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<SubjectWithTags[]>([]);
  const [availableAcademicSections, setAvailableAcademicSections] = useState<AcademicSectionItem[]>([]);
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [initialDataLoading, setInitialDataLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  // Modal State
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<(string | number)[]>([]);
  const [modalSearch, setModalSearch] = useState('');

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      setInitialDataLoading(true);
      try {
        const [classesRes, tagsRes] = await Promise.all([
          fetch('/api/classes'),
          fetch('/api/tags/with-subjects')
        ]);
        const classesData = await classesRes.json();
        const tagsData = await tagsRes.json();
        if (classesData.success) setClasses(classesData.classes);
        if (tagsData.success) setAllTags(tagsData.tags || []);
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to load initial data.', variant: 'destructive' });
      } finally {
        setInitialDataLoading(false);
      }
    };
    fetchInitialData();
  }, [toast]);

  useEffect(() => {
    if (!classId) {
      setSubjects([]);
      setSubjectId('');
      return;
    }
    const fetchSubjectsForClass = async () => {
      setSubjectsLoading(true);
      try {
        const res = await fetch(`/api/subjects?classId=${classId}`);
        const data = await res.json();
        if (data.success) setSubjects(data.subjects || []);
      } catch (error) {
        toast({ title: 'Network Error', description: 'Could not fetch subjects.', variant: 'destructive' });
      } finally {
        setSubjectsLoading(false);
      }
    };
    fetchSubjectsForClass();
  }, [classId, toast]);

  useEffect(() => {
    const fetchAcademicSections = async () => {
      if (!classId) {
        setAvailableAcademicSections([]);
        setAssignedAcademicSectionIds([]);
        return;
      }

      try {
        const res = await fetch(`/api/sections?classId=${classId}`);
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message || 'Failed to load academic sections.');
        }

        const nextSections = data.sections || [];
        setAvailableAcademicSections(nextSections);
        const validIds = new Set(nextSections.map((section: AcademicSectionItem) => section._id));
        setAssignedAcademicSectionIds((prev) => prev.filter((id) => validIds.has(id)));
      } catch (error) {
        setAvailableAcademicSections([]);
      }
    };

    fetchAcademicSections();
  }, [classId]);

  useEffect(() => {
    const params = new URLSearchParams();
    const questionSearch = modalSearch.trim();

    if (classId) params.append('class', classId);
    if (subjectId) params.append('subject', subjectId);
    if (selectedTags.length) {
      params.append('tags', selectedTags.map(t => t._id).join(','));
      params.append('tagsMode', questionTagMatchMode === 'all' ? 'and' : 'or');
    }
    if (questionSearch) params.append('search', questionSearch);

    const shouldFetch = Boolean((classId && subjectId) || selectedTags.length > 0 || questionSearch.length > 0);

    if (!shouldFetch) {
      setAvailableQuestions([]);
      setLoadingQuestions(false);
      return;
    }

    setLoadingQuestions(true);
    const qs = params.toString();
    const endpoint = qs ? `/api/questions?${qs}` : '/api/questions';

    fetch(endpoint)
      .then(res => res.json())
      .then(data => {
        setAvailableQuestions(data.questions || []);
      })
      .finally(() => setLoadingQuestions(false));
  }, [classId, subjectId, selectedTags, questionTagMatchMode, modalSearch]);

  // Computed Values
  const totalPaperMarks = useMemo(
    () => sections.reduce((sum, s) => sum + s.questions.reduce((qsum, q) => qsum + q.marks, 0), 0),
    [sections]
  );
  const totalQuestions = useMemo(
    () => sections.reduce((sum, section) => sum + section.questions.length, 0),
    [sections]
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
      .flatMap(s => s.questions.map(q => q.question._id));
    return availableQuestions
      .filter(q =>
        !usedIds.includes(q._id) &&
        (modalSearch.trim() === '' || String(q.content || '').toLowerCase().includes(modalSearch.toLowerCase()))
      );
  }, [availableQuestions, sections, activeSectionId, modalSearch]);

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
    setActiveSectionId(sectionId);
    setSelectedQuestionIds(
      sections.find(s => s.id === sectionId)?.questions.map(q => q.question._id) || []
    );
    setModalSearch('');
    setQuestionModalOpen(true);
  };

  const handleConfirmQuestions = () => {
    if (!activeSectionId) return;
    const activeSection = sections.find(s => s.id === activeSectionId);
    if (!activeSection) return;
    // Prevent adding if marks are not set
    if (typeof activeSection.defaultMarks !== 'number' || activeSection.defaultMarks <= 0) return;

    setSections(prev =>
      prev.map(s =>
        s.id === activeSectionId
          ? {
              ...s,
              questions: availableQuestions
                .filter(q => selectedQuestionIds.includes(q._id))
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
        setTimeout(() => {
          if (isEditMode) {
            navigateBack();
            return;
          }
          router.push(`/workspace/question-papers/view/${data.paper._id}`);
        }, 1000);
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
                      Boolean(classId) &&
                      Boolean(subjectId) &&
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
                                          allTags={allTags.map(tag => ({
                                            _id: tag._id,
                                            name: tag.name,
                                            type: {
                                              _id: (tag.type as any)?._id ?? '',
                                              name: (tag.type as any)?.name ?? '',
                                            },
                                          }))}
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
                                    onClick={() => openQuestionModal(section.id)}
                                    disabled={!canAddQuestions}
                                  >
                                    <Plus className="mr-1 h-4 w-4" />
                                    Add Questions
                                  </Button>
                                </div>
                                {!canAddQuestions ? (
                                  <p className="mt-2 text-xs text-destructive">
                                    Select the paper class and subject, then enter a section name and default marks to add questions.
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
            examDate={examDate ? new Date(examDate) : new Date()}
            setExamDate={date => setExamDate(date ? new Date(date) : new Date())}
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

      <QuestionFilterPopup
        open={questionModalOpen}
        onOpenChange={setQuestionModalOpen}
        classes={classes}
        classId={classId}
        setClassId={id => setClassId(String(id))}
        subjects={subjects}
        subjectId={subjectId}
        setSubjectId={id => setSubjectId(String(id))}
        subjectsLoading={subjectsLoading}
        allTags={allTags}
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
        }}
        toast={toast}
      />
    </div>
  );
}
