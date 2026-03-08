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
import { Input } from '@/components/ui/input';


function getSchoolKey() {
  try {
    const m = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
    return m && m[1] ? m[1] : '';
  } catch { return ''; }
}

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
    fetch('/api/classes', { cache: 'no-store', headers: { 'X-School-Key': getSchoolKey() } })
      .then(res => res.json())
      .then(data => setClasses(data.classes || []));
    fetch('/api/tags', { cache: 'no-store', headers: { 'X-School-Key': getSchoolKey() } })
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
    fetch(`/api/subjects?classId=${classId}`, { cache: 'no-store', headers: { 'X-School-Key': getSchoolKey() } })
      .then(res => res.json())
      .then(data => setSubjects(data.subjects || []));
  }, [classId]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (classId) params.set('class', classId);
      if (subjectId) params.set('subject', subjectId);
      if (selectedTags.length > 0) params.set('tags', selectedTags.map(t => t._id).join(','));
      if (modalSearch.trim()) params.set('search', modalSearch.trim());
      // Use AND semantics when multiple tags are selected
      if (selectedTags.length > 1) params.set('tagsMode', 'and');

      const qs = params.toString();
      const endpoint = qs ? `/api/questions?${qs}` : '/api/questions';
      const res = await fetch(endpoint, { cache: 'no-store', headers: { 'X-School-Key': getSchoolKey() } });
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
  }, [classId, subjectId, selectedTags, modalSearch]);

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
  // Server-side filtering is applied via /api/questions query params; use the result as-is
  const filteredQuestions = questions;

  return (
    <div className="container py-6 space-y-6">
      <div className="app-page-header-row">
        <div>
          <h1 className="app-page-title">All Questions</h1>
          <p className="app-page-subtitle">Browse, filter, edit, and remove questions from the bank.</p>
        </div>
        <Link href="/questions/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Question
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
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

        <div className="app-surface overflow-hidden">
          <div className="app-section-header">
            <h2 className="text-base font-semibold text-foreground">Search</h2>
            <p className="app-page-subtitle">Search question content or reset the current filters.</p>
          </div>
          <div className="app-section-body space-y-4">
            <div className="app-field-group">
              <p className="app-field-label">Search Content</p>
              <Input
                value={modalSearch}
                onChange={event => setModalSearch(event.target.value)}
                placeholder="Search by content..."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={fetchQuestions}>Refresh</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setClassId('');
                  setSubjectId('');
                  setSelectedTags([]);
                  setModalSearch('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="app-page-header-row">
        <p className="app-page-subtitle">
          Showing {filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''}.
        </p>
        {filteredQuestions.length > 0 ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (!window.confirm(`Are you sure you want to delete all ${filteredQuestions.length} filtered questions? This cannot be undone.`)) return;
              setIsDeleting(true);
              try {
                for (const question of filteredQuestions) {
                  await fetch(`/api/questions/${question._id}`, { method: 'DELETE' });
                }
                setQuestions(prev => prev.filter(question => !filteredQuestions.some(filtered => filtered._id === question._id)));
                toast({ title: 'Success', description: 'All filtered questions deleted.' });
              } catch {
                toast({ title: 'Error', description: 'Failed to delete all filtered questions.', variant: 'destructive' });
              } finally {
                setIsDeleting(false);
              }
            }}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : `Delete All (${filteredQuestions.length})`}
          </Button>
        ) : null}
      </div>

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => <QuestionItemSkeleton key={index} />)
        ) : error ? (
          <div className="app-feedback app-feedback-error text-center">
            <p>{error}</p>
            <div className="mt-4 flex justify-center">
              <Button onClick={fetchQuestions} variant="outline">Try Again</Button>
            </div>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="app-empty-state">
            <p>No questions match your current filters.</p>
            <div className="mt-4 flex justify-center">
              <Link href="/questions/create">
                <Button variant="outline">Create your first question</Button>
              </Link>
            </div>
          </div>
        ) : (
          filteredQuestions.map(question => (
            <QuestionItem
              key={question._id}
              question={question}
              onDelete={handleDeleteRequest}
              isDeleting={isDeleting && questionToDelete === question._id}
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

