'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
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
import { QuestionItem, QuestionItemSkeleton } from '@/components/question-item';
import type { Question } from '@/components/question-item';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { MetadataSelector } from '@/components/MetadataSelector';

export default function ViewQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  // --- Filter state ---
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [allTags, setAllTags] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [selectedTags, setSelectedTags] = useState<any[]>([]);
  const [modalSearch, setModalSearch] = useState('');

  // Fetch classes and tags on mount
  useEffect(() => {
    fetch('/api/classes')
      .then(res => res.json())
      .then(data => setClasses(data.classes || []));
    fetch('/api/tags')
      .then(res => res.json())
      .then(data => setAllTags(data.tags || []));
  }, []);

  // Fetch subjects for selected class
  useEffect(() => {
    if (!classId) {
      setSubjects([]);
      setSubjectId('');
      return;
    }
    fetch(`/api/subjects?classId=${classId}`)
      .then(res => res.json())
      .then(data => setSubjects(data.subjects || []));
  }, [classId]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/questions');
      const data = await res.json();
      if (data.success) {
        setQuestions(data.questions);
      } else {
        setError(data.message || 'Failed to load questions.');
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleDeleteRequest = (id: string) => {
    setQuestionToDelete(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!questionToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/questions/${questionToDelete}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setQuestions(prev => prev.filter(q => q._id !== questionToDelete));
        toast({ title: 'Success', description: 'Question deleted successfully.' });
      } else {
        throw new Error(data.message || 'Failed to delete question.');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setQuestionToDelete(null);
    }
  };

  // --- Filtering logic ---
  const filteredQuestions = questions.filter(q => {
    // Filter by class
    if (classId && q.class?._id !== classId) return false;
    // Filter by subject
    if (subjectId && q.subject?._id !== subjectId) return false;
    // Filter by tags (at least one tag matches)
    if (selectedTags.length > 0) {
      const tagIds = selectedTags.map(t => t._id);
      if (!q.tags?.some((tag: any) => tagIds.includes(tag._id))) return false;
    }
    // Filter by search (content)
    if (modalSearch && !q.content?.toLowerCase().includes(modalSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="container mx-auto max-w-5xl py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Questions</h1>
          <p className="text-muted-foreground mt-1">Browse, manage, and create questions.</p>
        </div>
        <Link href="/questions/create" passHref>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Question
          </Button>
        </Link>
      </div>

      {/* --- Filter Controls --- */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200/80 p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Filter Questions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
            recommendedTagIds={[]}
            initialDataLoading={false}
            resetCounter={0}
            toast={toast}
            onCreateNewTag={async () => null}
            disableClassSubject={false}
          />
          <input
            type="text"
            value={modalSearch}
            onChange={e => setModalSearch(e.target.value)}
            placeholder="Search by content..."
            className="border rounded px-3 py-2"
          />
        </div>
      </div>

      <div className="space-y-6">
        {/* Show filtered count and bulk delete button */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-right text-sm text-slate-600">
            Showing {filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''}
          </div>
          {filteredQuestions.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (!window.confirm(`Are you sure you want to delete all ${filteredQuestions.length} filtered questions? This cannot be undone.`)) return;
                setIsDeleting(true);
                try {
                  // Send a bulk delete request (if your backend supports it), otherwise delete one by one
                  for (const q of filteredQuestions) {
                    await fetch(`/api/questions/${q._id}`, { method: 'DELETE' });
                  }
                  setQuestions(prev => prev.filter(q => !filteredQuestions.some(fq => fq._id === q._id)));
                  toast({ title: 'Success', description: 'All filtered questions deleted.' });
                } catch (err: any) {
                  toast({ title: 'Error', description: 'Failed to delete all filtered questions.', variant: 'destructive' });
                } finally {
                  setIsDeleting(false);
                }
              }}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : `Delete All (${filteredQuestions.length})`}
            </Button>
          )}
        </div>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <QuestionItemSkeleton key={i} />)
        ) : error ? (
          <div className="text-center py-10 text-destructive">
            <p>{error}</p>
            <Button onClick={fetchQuestions} variant="outline" className="mt-4">Try Again</Button>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <p>No questions match your filters.</p>
            <Link href="/questions/create">
              <Button variant="outline" className="mt-4">Create your first question</Button>
            </Link>
          </div>
        ) : (
          filteredQuestions.map(q => (
            <QuestionItem
              key={q._id}
              question={q}
              onDelete={handleDeleteRequest}
              isDeleting={isDeleting && questionToDelete === q._id}
            />
          ))
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the question.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? <Spinner /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}