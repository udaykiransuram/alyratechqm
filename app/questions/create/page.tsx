'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
import { X, PlusCircle } from 'lucide-react';
import { MetadataSelector } from '@/components/MetadataSelector';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';

// Dynamically load Tiptap rich editor
const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center min-h-[210px] p-4 border rounded-lg bg-muted"><Spinner /></div>,
});
const MatrixMatchConfigurator = dynamic(() => import('@/components/MatrixMatchConfigurator').then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center min-h-[210px] p-4 border rounded-lg bg-muted"><Spinner /></div>,
});

interface SubjectWithTags {
  _id: string;
  name: string;
  tags: TagItem[];
}

interface Class { _id: string; name: string; }

export default function CreateQuestionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<SubjectWithTags[]>([]);
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [options, setOptions] = useState<{ content: string | null }[]>([{ content: '' }]);
  const [answerIndexes, setAnswerIndexes] = useState<number[]>([]);
  const [content, setContent] = useState<string | null>('');
  const [explanation, setExplanation] = useState<string | null>('');
  const [marks, setMarks] = useState<number>(1);
  const [questionType, setQuestionType] = useState<'single' | 'multiple' | 'matrix-match'>('single');

  const [loading, setLoading] = useState(false);
  const [initialDataLoading, setInitialDataLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  // --- Forcing UI reset ---
  const [resetCounter, setResetCounter] = useState(0);

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

  const recommendedTagIds = useMemo(() => {
    if (!subjectId) return [];
    const selectedSubject = subjects.find(s => s._id === subjectId);
    return selectedSubject ? selectedSubject.tags.map(t => t._id) : [];
  }, [subjectId, subjects]);

  const handleClassChange = (value: string) => {
    setClassId(value);
    setSubjectId('');
    setSelectedTags([]);
  };

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

  const handleSubmit = async () => {
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

    setLoading(true);

    let questionData: any = {
      subject: subjectId,
      class: classId,
      tags: selectedTags.map(tag => tag._id),
      content,
      explanation: explanation || undefined,
      marks,
      type: questionType,
    };

    if (questionType === 'matrix-match') {
      // Remove empty rows and columns
      const filteredRows = matrixRows.filter(row => row.trim() !== '');
      const filteredCols = matrixCols.filter(col => col.trim() !== '');

      // If any are empty, show a validation error
      if (filteredRows.length !== matrixRows.length || filteredCols.length !== matrixCols.length) {
        toast({
          title: 'Validation Error',
          description: 'All matrix rows and columns must be filled in.',
          variant: 'destructive',
        });
        return;
      }

      // Build matrixOptions for API
      questionData.matrixOptions = filteredRows.map((row, i) => ({
        left: row,
        right: filteredCols[i] || '', // If you want to pair them, otherwise adjust structure
      }));

      questionData.matrixAnswers = matrixAnswers.slice(0, filteredRows.length).map((rowAnswers, i) =>
        rowAnswers.filter(colIdx => colIdx < filteredCols.length)
      );
    } else if (questionType === 'single' || questionType === 'multiple') {
      questionData.options = options;
      questionData.answerIndexes = answerIndexes;
    }

    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(questionData),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Question Created!',
          description: 'Your new question has been saved successfully.',
        });
        // --- Add selected tags to the subject ---
        if (subjectId && selectedTags.length > 0) {
          try {
            await fetch(`/api/subjects/${subjectId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tags: selectedTags.map(tag => tag._id), // Add all selected tags to the subject
              }),
            });
            // Optionally handle response or errors
          } catch (err) {
            toast({
              title: 'Warning',
              description: 'Question created, but failed to update subject tags.',
              variant: 'destructive',
            });
          }
        }

        setContent('');
        setExplanation('');
        setOptions([{ content: '' }]);
        setAnswerIndexes([]);
        setSelectedTags([]);
        setSubjectId('');
        setClassId('');
        setMarks(1);
        setResetCounter(c => c + 1);
        router.push('/question-paper/create');
      } else {
        toast({
          title: 'Error Saving Question',
          description: data.message || 'An unknown error occurred.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Network Error',
        description: 'Could not save the question. Please check your connection.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl py-8 space-y-8 px-4">
      <header className="mb-6 border-b pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Create New Question</h1>
        <p className="text-muted-foreground mt-1 text-base">Fill out the form below to add a new question to the database.</p>
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
          {questionType !== 'matrix-match' && (
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
          {questionType === 'matrix-match' && (
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

          {/* Explanation Card - moved below matrix/options */}
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
                onCreateNewTag={async (tagName: string) => {
                  if (!selectedTypeId) {
                    toast({
                      title: 'Cannot Create Tag',
                      description: 'A tag type must be selected first.',
                      variant: 'destructive',
                    });
                    return null;
                  }
                  try {
                    const res = await fetch('/api/tags', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: tagName,
                        type: selectedTypeId,
                        subjectIds: [subjectId]
                      }),
                    });

                    const data = await res.json();

                    if (data.success) {
                      toast({
                        title: 'Tag Created',
                        description: `Tag "${data.tag.name}" has been created.`,
                      });
                      setAllTags((prev) => [...prev, data.tag]);
                      return data.tag;
                    } else {
                      toast({
                        title: 'Error Creating Tag',
                        description: data.message,
                        variant: 'destructive',
                      });
                      return null;
                    }
                  } catch (error) {
                    toast({
                      title: 'Network Error',
                      description: 'Failed to create the new tag.',
                      variant: 'destructive',
                    });
                    return null;
                  }
                }}
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
                <Button
                  variant={questionType === 'single' ? 'default' : 'outline'}
                  onClick={() => setQuestionType('single')}
                  className="flex-1"
                >
                  Single
                </Button>
                <Button
                  variant={questionType === 'multiple' ? 'default' : 'outline'}
                  onClick={() => setQuestionType('multiple')}
                  className="flex-1"
                >
                  Multiple
                </Button>
                <Button
                  variant={questionType === 'matrix-match' ? 'default' : 'outline'}
                  onClick={() => setQuestionType('matrix-match')}
                  className="flex-1"
                >
                  Matrix
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Actions Card */}
          <Card className="shadow-sm bg-gray-50">
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <Button size="lg" className="w-full" disabled={loading} onClick={handleSubmit}>
                {loading && <Spinner />}
                {loading ? 'Submitting...' : 'Submit Question'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
