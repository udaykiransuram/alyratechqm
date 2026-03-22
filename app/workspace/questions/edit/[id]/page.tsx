'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import dynamic from 'next/dynamic';
import { TagItem } from '@/components/ui/multi-select-tags';
import { Spinner } from '@/components/ui/spinner';
import EditorLoadingState from '@/components/ui/editor-loading-state';
import PageHero from '@/components/layout/PageHero';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlusCircle, X } from 'lucide-react';
import { MetadataSelector } from '@/components/MetadataSelector';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useBackNavigation } from '@/hooks/useReturnNavigation';
import { fetchApiJson, peekCachedApiJson } from '@/lib/client/api';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  ssr: false,
  loading: () => <EditorLoadingState label="Loading rich text editor" />,
});
const MatrixMatchConfigurator = dynamic(() => import('@/components/MatrixMatchConfigurator').then(mod => mod.default), {
  ssr: false,
  loading: () => <EditorLoadingState label="Loading matrix configurator" />,
});

const SUPPORT_DATA_CACHE_TTL_MS = 60_000;

export default function EditQuestionPage() {
  const params = useParams();
  const { navigateBack } = useBackNavigation('/workspace/questions');
  const questionId = params.id as string;
  const { toast } = useToast();
  const cachedQuestionResponse = questionId
    ? peekCachedApiJson<{ question?: any }>(`/api/questions/${questionId}`, {
        clientCacheTtlMs: SUPPORT_DATA_CACHE_TTL_MS,
      })
    : null;
  const cachedClassesResponse = peekCachedApiJson<{ classes?: any[] }>('/api/classes', {
    clientCacheTtlMs: SUPPORT_DATA_CACHE_TTL_MS,
  });
  const cachedTagsResponse = peekCachedApiJson<{ tags?: TagItem[] }>('/api/tags/with-subjects', {
    clientCacheTtlMs: SUPPORT_DATA_CACHE_TTL_MS,
  });
  const cachedSubjectsResponse = peekCachedApiJson<{ subjects?: any[] }>('/api/subjects', {
    clientCacheTtlMs: SUPPORT_DATA_CACHE_TTL_MS,
  });
  const hasCachedSupportData = Boolean(
    cachedClassesResponse?.classes && cachedTagsResponse?.tags,
  );
  const cachedQuestion = cachedQuestionResponse?.question;

  // Form state
  const [type, setType] = useState<'single' | 'multiple' | 'matrix-match' | 'descriptive'>(
    cachedQuestion?.type || 'single',
  );
  const [classId, setClassId] = useState(cachedQuestion?.class?._id || '');
  const [subjectId, setSubjectId] = useState(cachedQuestion?.subject?._id || '');
  const [classes, setClasses] = useState<any[]>(() => cachedClassesResponse?.classes || []);
  const [subjects, setSubjects] = useState<any[]>(() => cachedSubjectsResponse?.subjects || []);
  const [allTags, setAllTags] = useState<TagItem[]>(() => cachedTagsResponse?.tags || []);
  const [selectedTags, setSelectedTags] = useState<TagItem[]>(() => cachedQuestion?.tags || []);
  const [options, setOptions] = useState<{ content: string | null }[]>(
    () => cachedQuestion?.options || [{ content: '' }],
  );
  const [answerIndexes, setAnswerIndexes] = useState<number[]>(
    () => cachedQuestion?.answerIndexes ?? [],
  );
  const [content, setContent] = useState<string | null>(cachedQuestion?.content || '');
  const [explanation, setExplanation] = useState<string | null>(
    cachedQuestion?.explanation || '',
  );
  const [marks, setMarks] = useState<number>(cachedQuestion?.marks || 1);
  const [loading, setLoading] = useState(false);
  const [initialDataLoading, setInitialDataLoading] = useState(() => !hasCachedSupportData);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);

  // Matrix match state (consistent with create page)
  const [matrixRows, setMatrixRows] = useState<string[]>(
    () =>
      cachedQuestion?.type === 'matrix-match'
        ? (cachedQuestion.matrixOptions || []).map((opt: { left: string }) => opt.left || '')
        : [''],
  );
  const [matrixCols, setMatrixCols] = useState<string[]>(
    () =>
      cachedQuestion?.type === 'matrix-match'
        ? (cachedQuestion.matrixOptions || []).map((opt: { right: string }) => opt.right || '')
        : [''],
  );
  const [matrixAnswers, setMatrixAnswers] = useState<number[][]>(
    () => cachedQuestion?.matrixAnswers || [],
  );

  useEffect(() => {
    const fetchInitialData = async () => {
      setInitialDataLoading(!hasCachedSupportData);
      try {
        const [classesData, tagsData] = await Promise.all([
          fetchApiJson<{ classes?: any[] }>('/api/classes', {
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
        ]);
        setClasses(classesData.classes || []);
        setAllTags(tagsData.tags || []);
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to load initial data.', variant: 'destructive' });
      } finally {
        setInitialDataLoading(false);
      }
    };
    fetchInitialData();
  }, [hasCachedSupportData, toast]);

  useEffect(() => {
    if (!classId) {
      setSubjects(cachedSubjectsResponse?.subjects || []);
      setSubjectId('');
      setSubjectsLoading(false);
      return;
    }
    const fetchSubjectsForClass = async () => {
      const cachedSubjects = cachedSubjectsResponse?.subjects || [];
      if (cachedSubjects.length > 0) {
        setSubjects(cachedSubjects);
        setSubjectsLoading(false);
      } else {
        setSubjectsLoading(true);
      }
      try {
        const data = await fetchApiJson<{ subjects?: any[] }>('/api/subjects', {
          cache: 'no-store',
          fallbackMessage: 'Failed to load subjects for the selected class.',
          clientCacheTtlMs: SUPPORT_DATA_CACHE_TTL_MS,
          preferClientCache: true,
        });
        setSubjects(data.subjects || []);
      } catch (error) {
        toast({ title: 'Network Error', description: 'Could not fetch subjects.', variant: 'destructive' });
      } finally {
        setSubjectsLoading(false);
      }
    };
    fetchSubjectsForClass();
  }, [cachedSubjectsResponse?.subjects, classId, toast]);

  useEffect(() => {
    if (!questionId) return;
    const fetchQuestion = async () => {
      if (!cachedQuestion) {
        setInitialDataLoading(true);
      }
      try {
        const data = await fetchApiJson<{ question?: any }>(`/api/questions/${questionId}`, {
          cache: 'no-store',
          fallbackMessage: 'Failed to load question.',
          clientCacheTtlMs: SUPPORT_DATA_CACHE_TTL_MS,
          preferClientCache: true,
        });
        if (!data.question) {
          throw new Error('Failed to load question.');
        }
        const q = data.question;
        setType(q.type || 'single');
        setClassId(q.class?._id || '');
        setSubjectId(q.subject?._id || '');
        setSelectedTags(q.tags || []);
        setContent(q.content || '');
        setExplanation(q.explanation || '');
        setMarks(q.marks || 1);
        setOptions(q.options || [{ content: '' }]);
        setAnswerIndexes(q.answerIndexes ?? []);
        if (q.type === 'matrix-match') {
          setMatrixRows(q.matrixOptions.map((opt: { left: string }) => opt.left || ''));
          setMatrixCols(q.matrixOptions.map((opt: { right: string }) => opt.right || ''));
          setMatrixAnswers(q.matrixAnswers || []);
        }
      } catch (error) {
        if (!cachedQuestion) {
          toast({ title: 'Network Error', description: 'Could not fetch question.', variant: 'destructive' });
        }
      } finally {
        setInitialDataLoading(false);
      }
    };
    fetchQuestion();
  }, [cachedQuestion, questionId, toast]);

  const recommendedTagIds = useMemo(() => {
    if (!subjectId) return [];
    const selectedSubject = subjects.find((s: any) => s._id === subjectId);
    return selectedSubject ? selectedSubject.tags.map((t: any) => t._id) : [];
  }, [subjectId, subjects]);

  const handleClassChange = (value: string) => {
    setClassId(value);
    setSubjectId('');
    setSelectedTags([]);
  };

  // --- Option handlers (single/multiple choice) ---
  const handleAddOption = () => {
    if (options.length >= 5) {
      toast({ title: 'Limit Reached', description: 'You can add a maximum of 5 options.', variant: 'destructive' });
      return;
    }
    setOptions([...options, { content: '' }]);
  };

  const handleToggleAnswer = (index: number) => {
    setAnswerIndexes(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 1) {
      toast({ title: 'Cannot Remove', description: 'At least one option is required.', variant: 'destructive' });
      return;
    }
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    setAnswerIndexes(answerIndexes.filter(i => i !== index).map(i => (i > index ? i - 1 : i)));
  };

  const handleOptionChange = (index: number, value: string | null) => {
    const newOptions = [...options];
    newOptions[index].content = value;
    setOptions(newOptions);
  };

  const handleMarksChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setMarks(isNaN(val) ? 1 : Math.max(1, val));
  };

  // --- Update handler ---
  const handleUpdate = async () => {
    if (!content || content === '<p></p>') {
      toast({ title: 'Validation Error', description: 'Question content cannot be empty.', variant: 'destructive' });
      return;
    }
    if (!subjectId) {
      toast({ title: 'Validation Error', description: 'Please select a subject.', variant: 'destructive' });
      return;
    }
    if (!classId) {
      toast({ title: 'Validation Error', description: 'Please select a class.', variant: 'destructive' });
      return;
    }
    if (!marks || marks < 1) {
      toast({ title: 'Validation Error', description: 'Marks must be at least 1.', variant: 'destructive' });
      return;
    }

    let questionData: any = {
      subject: subjectId,
      class: classId,
      tags: selectedTags.map(tag => tag._id),
      content,
      explanation: explanation || undefined,
      marks,
      type,
    };

    if (type === 'matrix-match') {
      // Build matrixOptions from rows and cols
      const maxLen = Math.max(matrixRows.length, matrixCols.length);
      const matrixOptions = [];
      for (let i = 0; i < maxLen; i++) {
        matrixOptions.push({
          left: matrixRows[i] || '',
          right: matrixCols[i] || '',
        });
      }
      questionData.matrixOptions = matrixOptions;
      questionData.matrixAnswers = matrixAnswers;
    } else if (type === 'single' || type === 'multiple') {
      questionData.options = options;
      questionData.answerIndexes = answerIndexes;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(questionData),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Question Updated!',
          description: 'Your changes have been saved.',
        });
        navigateBack();
      } else {
        toast({
          title: 'Error Updating Question',
          description: data.message || 'An unknown error occurred.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Network Error',
        description: 'Could not update the question. Please check your connection.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="Question Bank"
        title="Edit Question"
        description="Update the question content, metadata, and answer configuration without leaving the dedicated authoring flow."
        actions={
          <Button type="button" variant="outline" onClick={navigateBack}>
            Back
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Question maintenance</span>
            <span className="app-meta-chip">Metadata-aware editing</span>
          </>
        }
        stats={[
          {
            label: 'Question type',
            value:
              type === 'single'
                ? 'Single choice'
                : type === 'multiple'
                  ? 'Multiple choice'
                  : type === 'matrix-match'
                    ? 'Matrix match'
                    : 'Descriptive',
            meta: 'Existing question type stays fixed on this edit screen.',
          },
          {
            label: 'Selected tags',
            value: String(selectedTags.length),
            meta: 'Keep tags aligned with how the question should be discovered later.',
          },
          {
            label: 'Marks',
            value: String(marks),
            meta: 'Marks edits affect paper-building and reporting expectations.',
          },
        ]}
      />

      <div className="app-editor-grid">
        <div className="app-editor-main">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Question Content</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <RichTextEditor key={resetCounter + '-content'} initialContent={content} onChange={setContent} />
            </CardContent>
          </Card>

          {type === 'single' || type === 'multiple' ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Answer Options</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body space-y-3">
                {options.map((opt, index) => (
                  <div key={index} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/10 p-2.5">
                    <div className="pt-2">
                      <Checkbox
                        id={`option-${index}`}
                        checked={answerIndexes.includes(index)}
                        onCheckedChange={() => handleToggleAnswer(index)}
                      />
                    </div>
                    <div className="flex-1">
                      <RichTextEditor
                        key={resetCounter + '-option-' + index}
                        initialContent={opt.content}
                        onChange={value => handleOptionChange(index, value)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(index)}
                      className="mt-1 text-muted-foreground hover:text-destructive"
                      aria-label="Remove option"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
              <CardFooter className="app-section-body border-t border-border/60 pt-3.5">
                <Button variant="outline" onClick={handleAddOption} className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Option
                </Button>
              </CardFooter>
            </Card>
          ) : null}

          {type === 'matrix-match' ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Matrix Configuration</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body">
                <MatrixMatchConfigurator
                  rows={matrixRows}
                  setRows={setMatrixRows}
                  cols={matrixCols}
                  setCols={setMatrixCols}
                  answers={matrixAnswers}
                  setAnswers={setMatrixAnswers}
                />
              </CardContent>
            </Card>
          ) : null}

          {type === 'descriptive' ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Written Response</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body">
              </CardContent>
            </Card>
          ) : null}

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Explanation</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <RichTextEditor key={resetCounter + '-explanation'} initialContent={explanation} onChange={setExplanation} />
            </CardContent>
          </Card>
        </div>

        <aside className="app-editor-aside xl:sticky xl:top-[calc(var(--app-header-height)+1.5rem)] xl:self-start">
          <MetadataSelector
            classes={classes}
            classId={classId}
            setClassId={handleClassChange}
            subjects={subjects}
            subjectId={subjectId}
            setSubjectId={setSubjectId}
            subjectsLoading={subjectsLoading}
            allTags={allTags}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            recommendedTagIds={recommendedTagIds}
            initialDataLoading={initialDataLoading}
            resetCounter={resetCounter}
            toast={toast}
            onCreateNewTag={async () => null}
          />

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Marks</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <div className="app-field-group">
                <Label htmlFor="marks-input" className="app-field-label">
                  Marks <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="marks-input"
                  type="number"
                  min={1}
                  value={marks}
                  onChange={handleMarksChange}
                  placeholder="Enter marks for this question"
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Question Type</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2 text-sm font-medium text-foreground">
                {type === 'single'
                  ? 'Single Choice'
                  : type === 'multiple'
                    ? 'Multiple Choice'
                    : type === 'matrix-match'
                      ? 'Matrix Match'
                      : 'Descriptive'}
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <Button size="lg" className="w-full" disabled={loading} onClick={handleUpdate}>
                {loading ? <Spinner /> : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
