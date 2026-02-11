'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import dynamic from 'next/dynamic';
import { TagItem } from '@/components/ui/multi-select-tags';
import { Spinner } from '@/components/ui/spinner';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlusCircle, X } from 'lucide-react';
import { MetadataSelector } from '@/components/MetadataSelector';
import { Input } from '@/components/ui/input';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center min-h-[210px] p-4 border rounded-lg bg-muted"><Spinner /></div>,
});
const MatrixMatchConfigurator = dynamic(() => import('@/components/MatrixMatchConfigurator').then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center min-h-[210px] p-4 border rounded-lg bg-muted"><Spinner /></div>,
});

export default function EditQuestionPage() {
  const router = useRouter();
  const params = useParams();
  const questionId = params.id as string;
  const { toast } = useToast();

  // Form state
  const [type, setType] = useState<'single' | 'multiple' | 'matrix-match'>('single');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [options, setOptions] = useState<{ content: string | null }[]>([{ content: '' }]);
  const [answerIndexes, setAnswerIndexes] = useState<number[]>([]);
  const [content, setContent] = useState<string | null>('');
  const [explanation, setExplanation] = useState<string | null>('');
  const [marks, setMarks] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [initialDataLoading, setInitialDataLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);

  // Matrix match state (consistent with create page)
  const [matrixRows, setMatrixRows] = useState<string[]>(['']);
  const [matrixCols, setMatrixCols] = useState<string[]>(['']);
  const [matrixAnswers, setMatrixAnswers] = useState<number[][]>([]);

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
        const res = await fetch(`/api/subjects`);
        const data = await res.json();
        if (data.success) {
          setSubjects(data.subjects || []);
        } else {
          toast({ title: 'Error', description: 'Failed to load subjects for the selected class.', variant: 'destructive' });
        }
      } catch (error) {
        toast({ title: 'Network Error', description: 'Could not fetch subjects.', variant: 'destructive' });
      } finally {
        setSubjectsLoading(false);
      }
    };
    fetchSubjectsForClass();
  }, [classId, toast]);

  useEffect(() => {
    if (!questionId) return;
    const fetchQuestion = async () => {
      setInitialDataLoading(true);
      try {
        const res = await fetch(`/api/questions/${questionId}`);
        const data = await res.json();
        if (data.success && data.question) {
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
          // Matrix-match mapping
          if (q.type === 'matrix-match') {
            setMatrixRows(q.matrixOptions.map((opt: { left: string }) => opt.left || ''));
            setMatrixCols(q.matrixOptions.map((opt: { right: string }) => opt.right || ''));
            setMatrixAnswers(q.matrixAnswers || []);
          }
        } else {
          toast({ title: 'Error', description: 'Failed to load question.', variant: 'destructive' });
        }
      } catch (error) {
        toast({ title: 'Network Error', description: 'Could not fetch question.', variant: 'destructive' });
      } finally {
        setInitialDataLoading(false);
      }
    };
    fetchQuestion();
  }, [questionId, toast]);

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
        router.back();
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
    <div className="container py-8 space-y-8">
      <header className="mb-6 border-b pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Edit Question</h1>
        <p className="text-muted-foreground mt-1 text-base">Update the details below and save your changes.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          {/* Question Content Card */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Question Content</CardTitle>
              <CardDescription>
                Write the main body of the question. <span className="text-destructive">*</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RichTextEditor key={resetCounter + '-content'} initialContent={content} onChange={setContent} />
            </CardContent>
          </Card>

          {/* Options Card */}
          {type !== 'matrix-match' && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Answer Options</CardTitle>
                <CardDescription>
                  Provide the possible answers and select <b>one or more</b> correct ones. All options are required.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      name="answer"
                      id={`option-${i}`}
                      className="mt-8 h-4 w-4 accent-primary"
                      checked={answerIndexes.includes(i)}
                      onChange={() => handleToggleAnswer(i)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={`option-${i}`} className="sr-only">Option {i + 1}</Label>
                      <RichTextEditor key={resetCounter + '-option-' + i} initialContent={opt.content} onChange={(val) => handleOptionChange(i, val)} />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveOption(i)} className="mt-5 text-muted-foreground hover:text-destructive" aria-label="Remove option">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
              <CardFooter>
                <Button variant="outline" onClick={handleAddOption} className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Option
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Matrix Match Pairs Card */}
          {type === 'matrix-match' && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Matrix Configuration</CardTitle>
                <CardDescription>
                  Define your rows and columns. You can have a different number of each.
                </CardDescription>
              </CardHeader>
              <CardContent>
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
          )}

          {/* Explanation Card */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Explanation <span className="text-muted-foreground text-xs">(Optional)</span></CardTitle>
              <CardDescription>Provide an explanation for the correct answer.</CardDescription>
            </CardHeader>
            <CardContent>
              <RichTextEditor key={resetCounter + '-explanation'} initialContent={explanation} onChange={setExplanation} />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-8 lg:sticky lg:top-8">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
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
                onCreateNewTag={async (tagName: string) => null}
              />
            </CardContent>
          </Card>

          {/* Marks Input */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Marks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="marks-input">Marks <span className="text-destructive">*</span></Label>
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

          {/* Question Type Selector */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Question Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <span className="inline-block rounded px-3 py-1 bg-muted text-foreground font-semibold capitalize">
                  {type === 'single' && 'Single'}
                  {type === 'multiple' && 'Multiple'}
                  {type === 'matrix-match' && 'Matrix'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Actions Card */}
          <Card className="shadow-sm bg-gray-50">
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <Button size="lg" className="w-full" disabled={loading} onClick={handleUpdate}>
                {loading && <Spinner />}
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}