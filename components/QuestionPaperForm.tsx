'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Button }  from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, X } from 'lucide-react';
import { PaperDetailsForm } from '@/components/PaperDetailsForm';
import { PaperSummary } from '@/components/PaperSummary';
import { SectionEditor } from '@/components/SectionEditor';
import { Question, QuestionItem } from '@/components/question-items';
import { EditQuestionModal } from '@/components/EditQuestionModal';
import { QuestionFilterPopup } from '@/components/QuestionFilterPopup';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TagItem { _id: string; name: string; type: { name: string } }
interface SubjectWithTags { _id: string; name: string; tags: TagItem[] }
interface Class { _id: string; name: string }
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

  // State initialization (use initialData if present)
  const [paperTitle, setPaperTitle] = useState(initialData?.title || '');
  const [instructions, setInstructions] = useState(initialData?.instructions || '');
  const [duration, setDuration] = useState(initialData?.duration ?? 60);
  const [passingMarks, setPassingMarks] = useState(initialData?.passingMarks ?? 0);
  const [examDate, setExamDate] = useState(
    initialData?.examDate ? new Date(initialData.examDate) : new Date()
  );
  const [sections, setSections] = useState<Section[]>(initialData?.sections || []);
  const [classId, setClassId] = useState(initialData?.classId || '');
  const [subjectId, setSubjectId] = useState(initialData?.subjectId || '');

  // Hydrate state when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      setPaperTitle(initialData.title || '');
      setInstructions(initialData.instructions || '');
      setDuration(initialData.duration ?? 60);
      setPassingMarks(initialData.passingMarks ?? 0);
      setExamDate(initialData.examDate ? new Date(initialData.examDate) : new Date());
      setClassId(initialData.classId || '');
      setSubjectId(initialData.subjectId || '');
      setSections(initialData.sections || []);
    }
  }, [initialData]);

  // Question Bank State
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  // Filters
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [search, setSearch] = useState('');

  // Global State
  const [saving, setSaving] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<SubjectWithTags[]>([]);
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [initialDataLoading, setInitialDataLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  // Modal State
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<(string | number)[]>([]);
  const [modalSearch, setModalSearch] = useState('');

  // Edit Question Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

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
    const params = new URLSearchParams();
    if (classId) params.append('class', classId);
    if (subjectId) params.append('subject', subjectId);
    if (selectedTags.length) params.append('tags', selectedTags.map(t => t._id).join(','));
    if (search) params.append('search', search);
    if (selectedTags.length > 1) params.append('tagsMode', 'and');

    // Allow fetching by tags (or search) even if class/subject are not selected
    const shouldFetch = (classId && subjectId) || selectedTags.length > 0 || (search?.trim().length ?? 0) > 0;

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
      }).finally(() => setLoadingQuestions(false));
  }, [classId, subjectId, selectedTags, search]);

  // Computed Values
  const totalPaperMarks = useMemo(
    () => sections.reduce((sum, s) => sum + s.questions.reduce((qsum, q) => qsum + q.marks, 0), 0),
    [sections]
  );

  // Modal: Filter questions (exclude those already in other sections)
  const modalAvailableQuestions = useMemo(() => {
    if (!activeSectionId) return [];
    const usedIds = sections
      .filter(s => s.id !== activeSectionId)
      .flatMap(s => s.questions.map(q => q.question._id));
    return availableQuestions
      .filter(q =>
        !usedIds.includes(q._id) &&
        (modalSearch.trim() === '' || q.content.toLowerCase().includes(modalSearch.toLowerCase()))
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
        totalMarks: totalPaperMarks,
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
          router.push(`/question-paper/view/${data.paper._id}`);
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
    <div className="container mx-auto max-w-full p-4 lg:p-6 bg-muted/20 min-h-screen">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* --- Section Builder (Left Side) --- */}
        <main className="flex-1 space-y-4 w-full">
          <Accordion
            type="multiple"
            className="w-full space-y-4"
            defaultValue={sections.map(s => s.id)} // Keep all sections open by default
          >
            {sections.map((section, sectionIndex) => {
              const sectionTotalMarks = section.questions.reduce((sum, q) => sum + q.marks, 0);
              const canAddQuestions =
                section.name.trim().length > 0 &&
                typeof section.defaultMarks === 'number' &&
                section.defaultMarks > 0;

              return (
                <AccordionItem key={section.id} value={section.id} className="border rounded-lg bg-background overflow-hidden">
                  <AccordionTrigger className="p-4 hover:no-underline flex justify-between items-center">
                    <div className="flex items-center gap-4 w-full">
                      <h3 className="text-lg font-semibold text-left">{section.name || `Section ${sectionIndex + 1}`}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{section.questions.length} Questions</span>
                        <span>{sectionTotalMarks} Marks</span>
                      </div>
                    </div>
                    {/* Chevron icon for collapse/expand */}
                    <svg
                      className="ml-2 h-5 w-5 transition-transform duration-200 accordion-chevron"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path d="M6 8l4 4 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </AccordionTrigger>
                  <AccordionContent className="border-t">
                    <SectionEditor
                      section={section}
                      onUpdate={(field, value) => handleUpdateSection(section.id, field as 'name' | 'description' | 'defaultMarks' | 'defaultNegativeMarks', value)}
                      onRemove={() => handleRemoveSection(section.id)}
                      onAddQuestions={() => openQuestionModal(section.id)}
                      canAddQuestions={canAddQuestions}
                      sectionTotalMarks={sectionTotalMarks}
                    >
                      {section.questions.length > 0 ? (
                        <div className="space-y-2">
                          {section.questions.map((q, qIndex) => (
                            <div key={q.question._id} className="border rounded p-2 bg-muted/40 transition">
                              <div className="flex justify-between items-center gap-2">
                                <div className="flex-1">
                                  <div className="mb-1 flex items-center gap-1">
                                    <span className="inline-block px-1 py-0.5 rounded bg-background text-xs font-semibold text-foreground">
                                      Q{qIndex + 1}
                                    </span>
                                    <span className="text-xs text-muted-foreground">ID: {q.question._id}</span>
                                  </div>
                                  <QuestionItem
                                    question={q.question}
                                    onDelete={() => {}}
                                    isDeleting={false}
                                    classes={classes}
                                    subjects={subjects}
                                    allTags={allTags.map(tag => ({
                                      _id: tag._id,
                                      name: tag.name,
                                      type: {
                                        _id: (tag.type as any)?._id ?? '',
                                        name: (tag.type as any)?.name ?? ''
                                      }
                                    }))}
                                    onSave={async (updated) => {
                                      setSections(prev =>
                                        prev.map(section => ({
                                          ...section,
                                          questions: section.questions.map(q =>
                                            q.question._id === updated._id
                                              ? { ...q, question: updated }
                                              : q
                                          ),
                                        }))
                                      );
                                      setAvailableQuestions(prev =>
                                        prev.map(q => q._id === updated._id ? updated : q)
                                      );
                                      setEditingQuestion(null);
                                      setEditModalOpen(false);
                                    }}
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveQuestionFromSection(section.id, q.question._id)}
                                  aria-label="Remove question"
                                  title="Remove question"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-4 mt-2 pt-2 border-t text-xs">
                                <div className="flex items-center gap-1.5">
                                  <Label className="font-semibold">Marks:</Label>
                                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{q.marks}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Label className="font-semibold">Negative:</Label>
                                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{q.negativeMarks}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 border-2 border-dashed rounded text-muted-foreground flex flex-col items-center gap-1">
                          <p className="text-xs">No questions in this section.</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openQuestionModal(section.id)}
                            disabled={!canAddQuestions}
                          >
                            <Plus className="mr-1 h-4 w-4" /> Add Questions
                          </Button>
                          {!canAddQuestions && (
                            <span className="text-xs text-destructive mt-1">
                              Enter section name and default marks to add questions.
                            </span>
                          )}
                        </div>
                      )}
                    </SectionEditor>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          <Button variant="outline" className="w-full py-6 border-dashed" onClick={handleAddSection}>
            <Plus className="mr-2 h-4 w-4" /> Add New Section
          </Button>
        </main>

        {/* --- Sidebar (Right Side) --- */}
        <aside className="w-full lg:w-[380px] lg:sticky lg:top-6 space-y-4">
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
            classId={classId}
            setClassId={setClassId}
            subjectId={subjectId}
            setSubjectId={setSubjectId}
            classes={classes}
            subjects={subjects}
            compact
          />
          <PaperSummary
            sections={sections}
            totalPaperMarks={totalPaperMarks}
            duration={duration}
            passingMarks={passingMarks}
            examDate={examDate ? examDate.toISOString() : ''}
          />
          <Button size="lg" className="w-full" onClick={handleSavePaper} disabled={saving}>
            {saving ? <Spinner /> : 'Save Question Paper'}
          </Button>
        </aside>
      </div>

      {/* --- Modals --- */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
          </DialogHeader>
          {editingQuestion && (
            <EditQuestionModal
              open={editModalOpen}
              onOpenChange={setEditModalOpen}
              question={editingQuestion}
              classes={classes}
              subjects={subjects}
              allTags={allTags.map(tag => ({
                ...tag,
                type: {
                  _id: (tag.type as any)?._id ?? '',
                  name: (tag.type as any)?.name ?? ''
                }
              }))}
              onSave={async (updatedQuestion) => {
                setSections(prev => prev.map(section => ({
                  ...section,
                  questions: section.questions.map(q => q.question._id === updatedQuestion._id
                    ? { ...q, question: updatedQuestion }
                    : q
                  ),
                }))
                );
                setAvailableQuestions(prev => prev.map(q => q._id === updatedQuestion._id ? updatedQuestion : q)
                );
                setEditModalOpen(false);
              } } toast={undefined}            />
          )}
        </DialogContent>
      </Dialog>

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
        initialDataLoading={initialDataLoading}
        modalSearch={modalSearch}
        setModalSearch={setModalSearch}
        loadingQuestions={loadingQuestions}
        modalAvailableQuestions={modalAvailableQuestions}
        selectedQuestionIds={selectedQuestionIds}
        setSelectedQuestionIds={setSelectedQuestionIds}
        handleConfirmQuestions={handleConfirmQuestions}
        handleEditQuestionSave={async (updatedQuestion) => {
          setSections(prev =>
            prev.map(section => ({
              ...section,
              questions: section.questions.map(q =>
                q.question._id === updatedQuestion._id
                  ? { ...q, question: updatedQuestion }
                  : q
              ),
            }))
          );
          setAvailableQuestions(prev =>
            prev.map(q => q._id === updatedQuestion._id ? updatedQuestion : q)
          );
        }}
        toast={toast}
        availableQuestions={availableQuestions}
      />
    </div>
  );
}