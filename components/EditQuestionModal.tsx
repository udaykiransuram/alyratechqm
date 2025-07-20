import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { MetadataSelector } from '@/components/MetadataSelector';
import { Input } from '@/components/ui/input';
import dynamic from 'next/dynamic';
import { TagItem } from '@/components/ui/multi-select-tags';
import { PlusCircle, X } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center min-h-[210px] p-4 border rounded-lg bg-muted"><Spinner /></div>,
});
const MatrixMatchConfigurator = dynamic(() => import('@/components/MatrixMatchConfigurator').then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center min-h-[210px] p-4 border rounded-lg bg-muted"><Spinner /></div>,
});

interface EditQuestionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void; // <-- Add this line
  question: any;
  classes: any[];
  subjects: any[];
  allTags: TagItem[];
  onSave: (updated: any) => Promise<void>;
  toast: any;
}

// Add this helper function at the top or in a utils/api file
async function updateQuestionAPI(updated: any) {
  const res = await fetch(`/api/questions/${updated._id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to update question');
  }
  return data.question;
}

export function EditQuestionModal({
  open,
  onOpenChange,
  onClose, // <-- Add this line
  question,
  classes,
  subjects,
  allTags,
  onSave,
  toast,
}: EditQuestionModalProps) {
  // --- Form State ---
  const [type, setType] = useState<'single' | 'multiple' | 'matrix-match'>('single');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [options, setOptions] = useState<{ content: string | null }[]>([{ content: '' }]);
  const [answerIndexes, setAnswerIndexes] = useState<number[]>([]);
  const [content, setContent] = useState<string | null>('');
  const [explanation, setExplanation] = useState<string | null>('');
  const [marks, setMarks] = useState<number>(1);
  const [loading, setLoading] = useState(false);

  // Matrix match state
  const [matrixRows, setMatrixRows] = useState<string[]>(['']);
  const [matrixCols, setMatrixCols] = useState<string[]>(['']);
  const [matrixAnswers, setMatrixAnswers] = useState<number[][]>([]);

  // --- Populate initial values only when modal opens ---
  useEffect(() => {
    if (!open || !question) return;
    setType(question.type || 'single');
    setClassId(
      typeof question.class === 'string'
        ? question.class
        : question.class?._id || ''
    );
    setSubjectId(
      typeof question.subject === 'string'
        ? question.subject
        : question.subject?._id || ''
    );
    // Map tag IDs to tag objects
    if (question.tags && Array.isArray(question.tags) && allTags.length > 0) {
      const tagObjs = question.tags.map((tag: any) =>
        typeof tag === 'string'
          ? allTags.find(t => t._id === tag)
          : allTags.find(t => t._id === tag._id)
      ).filter(Boolean);
      setSelectedTags(tagObjs);
    } else {
      setSelectedTags([]);
    }
    setContent(question.content || '');
    setExplanation(question.explanation || '');
    setMarks(question.marks || 1);
    setOptions(question.options || [{ content: '' }]);
    setAnswerIndexes(question.answerIndexes ?? []);
    if (question.type === 'matrix-match') {
      setMatrixRows(question.matrixOptions?.map((opt: any) => opt.left || '') || ['']);
      setMatrixCols(question.matrixOptions?.map((opt: any) => opt.right || '') || ['']);
      setMatrixAnswers(question.matrixAnswers || []);
    } else {
      setMatrixRows(['']);
      setMatrixCols(['']);
      setMatrixAnswers([]);
    }
  }, [open]); // <--- Only depend on open

  // --- Option handlers ---
  const handleAddOption = () => {
    console.log('Add Option clicked');
    if (options.length >= 5) {
      toast({ title: 'Limit Reached', description: 'You can add a maximum of 5 options.', variant: 'destructive' });
      return;
    }
    setOptions([...options, { content: '' }]);
  };

  const handleToggleAnswer = (index: number) => {
    console.log('Toggle Answer', index);
    setAnswerIndexes(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const handleRemoveOption = (index: number) => {
    console.log('Remove Option', index);
    if (options.length <= 1) {
      toast({ title: 'Cannot Remove', description: 'At least one option is required.', variant: 'destructive' });
      return;
    }
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    setAnswerIndexes(answerIndexes.filter(i => i !== index).map(i => (i > index ? i - 1 : i)));
  };

  const handleOptionChange = (index: number, value: string | null) => {
    console.log('Option Change', index, value);
    const newOptions = [...options];
    newOptions[index].content = value;
    setOptions(newOptions);
  };

  const handleMarksChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    console.log('Marks Change', val);
    setMarks(isNaN(val) ? 1 : Math.max(1, val));
  };

  // --- Save handler ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Save clicked');
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

    let updated: any = {
      ...question,
      subject: subjectId,
      class: classId,
      tags: selectedTags,
      content,
      explanation: explanation || undefined,
      marks,
      type,
    };

    if (type === 'matrix-match') {
      const maxLen = Math.max(matrixRows.length, matrixCols.length);
      const matrixOptions = [];
      for (let i = 0; i < maxLen; i++) {
        matrixOptions.push({
          left: matrixRows[i] || '',
          right: matrixCols[i] || '',
        });
      }
      updated.matrixOptions = matrixOptions;
      updated.matrixAnswers = matrixAnswers;
    } else if (type === 'single' || type === 'multiple') {
      updated.options = options;
      updated.answerIndexes = answerIndexes;
    }

    setLoading(true);
    try {
      // --- API call here ---
      const saved = await updateQuestionAPI(updated);
      await onSave(saved); // update parent state
      toast(
        <div>
          <div className="font-bold">Success</div>
          <div>Question successfully saved.</div>
        </div>
      ); // Show toast
      // Add a slight delay before closing, or close after a tick
      setTimeout(() => onOpenChange(false), 100); // 100ms delay
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // --- Recommended tags ---
  const recommendedTagIds = useMemo(() => {
    if (!subjectId) return [];
    const selectedSubject = subjects.find((s: any) => s._id === subjectId);
    return selectedSubject ? selectedSubject.tags.map((t: any) => t._id) : [];
  }, [subjectId, subjects]);

  // Use onClose if provided, otherwise fallback to onOpenChange(false)
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-4xl"
        onInteractOutside={e => {
          if (
            (e.target as HTMLElement).closest('.tag-popover-content') ||
            (e.target as HTMLElement).closest('[data-tag-popover]')
          ) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">Edit Question</DialogTitle>
          <DialogDescription>
            Modify the question details, options, and metadata below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="max-h-[65vh] overflow-y-auto pr-4 -mr-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Question Content</CardTitle>
              </CardHeader>
              <CardContent>
                <RichTextEditor
                  key={question?._id || 'main-content'}
                  initialContent={content}
                  onChange={setContent}
                />
              </CardContent>
            </Card>

            {(type === 'single' || type === 'multiple') && (
              <Card>
                <CardHeader>
                  <CardTitle>Answer Options</CardTitle>
                  <CardDescription>Select the correct answer(s) using the checkboxes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="flex flex-col items-center pt-2">
                        <Checkbox
                          id={`option-${i}`}
                          checked={answerIndexes.includes(i)}
                          onCheckedChange={() => handleToggleAnswer(i)}
                        />
                      </div>
                      <div className="flex-1">
                        <RichTextEditor
                          key={`${question?._id}-option-${i}`}
                          initialContent={opt.content}
                          onChange={val => handleOptionChange(i, val)}
                        />
                      </div>
                      <Button variant="ghost" size="icon" type="button" onClick={() => handleRemoveOption(i)} className="mt-1 text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" type="button" onClick={handleAddOption} className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Option
                  </Button>
                </CardContent>
              </Card>
            )}

            {type === 'matrix-match' && (
              <Card>
                <CardHeader><CardTitle>Matrix Configuration</CardTitle></CardHeader>
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

            <Card>
              <CardHeader>
                <CardTitle>Explanation</CardTitle>
                <CardDescription>Provide an optional explanation for the answer.</CardDescription>
              </CardHeader>
              <CardContent>
                <RichTextEditor
                  key={`${question?._id}-explanation`}
                  initialContent={explanation}
                  onChange={setExplanation}
                />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Metadata</CardTitle></CardHeader>
                <CardContent>
                  <MetadataSelector
                    classes={classes}
                    classId={classId}
                    setClassId={setClassId}
                    subjects={subjects}
                    subjectId={subjectId}
                    setSubjectId={setSubjectId}
                    subjectsLoading={false}
                    allTags={allTags}
                    selectedTags={selectedTags}
                    setSelectedTags={setSelectedTags}
                    recommendedTagIds={recommendedTagIds}
                    initialDataLoading={false}
                    resetCounter={0}
                    toast={toast}
                    onCreateNewTag={async () => null}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Marks</CardTitle></CardHeader>
                <CardContent>
                  <Label htmlFor="marks" className="sr-only">Marks</Label>
                  <Input
                    id="marks"
                    type="number"
                    min={1}
                    value={marks}
                    onChange={handleMarksChange}
                    required
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter className="pt-6 border-t">
            <Button variant="ghost" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Spinner />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}