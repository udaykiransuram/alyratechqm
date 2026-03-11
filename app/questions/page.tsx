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
import { buildPartialLoadMessage, fetchApiJson, resolveClientSchoolKey } from '@/lib/client/api';

export default function ViewQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [questionToArchive, setQuestionToArchive] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  // --- Filter state ---
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [allTags, setAllTags] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [selectedTags, setSelectedTags] = useState<any[]>([]);
  const [questionTagMatchMode, setQuestionTagMatchMode] = useState<'any' | 'all'>('any');
  const [modalSearch, setModalSearch] = useState('');
  const [setupNotice, setSetupNotice] = useState<string | null>(null);

  // Fetch classes and tags on mount
  useEffect(() => {
    void (async () => {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        setClasses([]);
        setAllTags([]);
        setSetupNotice('Select a school workspace to load filters and questions.');
        return;
      }

      const [classesResult, tagsResult] = await Promise.allSettled([
        fetchApiJson<any>('/api/classes', {
          cache: 'no-store',
          schoolKey,
          fallbackMessage: 'Failed to load classes.',
        }),
        fetchApiJson<any>('/api/tags', {
          cache: 'no-store',
          schoolKey,
          fallbackMessage: 'Failed to load tags.',
        }),
      ]);

      if (classesResult.status === 'fulfilled') {
        setClasses(Array.isArray(classesResult.value.classes) ? classesResult.value.classes : []);
      }
      if (tagsResult.status === 'fulfilled') {
        setAllTags(Array.isArray(tagsResult.value.tags) ? tagsResult.value.tags : []);
      }

      setSetupNotice(
        buildPartialLoadMessage([
          ...(classesResult.status === 'rejected' ? ['Class filters'] : []),
          ...(tagsResult.status === 'rejected' ? ['Tag filters'] : []),
        ]),
      );
    })();
  }, []);

  // Fetch subjects for selected class
  useEffect(() => {
    if (!classId) {
      setSubjects([]);
      setSubjectId('');
      return;
    }

    void (async () => {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        setSubjects([]);
        return;
      }

      try {
        const data = await fetchApiJson<any>(`/api/subjects?classId=${classId}`, {
          cache: 'no-store',
          schoolKey,
          fallbackMessage: 'Failed to load subjects.',
        });
        setSubjects(Array.isArray(data.subjects) ? data.subjects : []);
        setSetupNotice((currentNotice) =>
          currentNotice && currentNotice.includes('Subject options') ? null : currentNotice,
        );
      } catch {
        setSubjects([]);
        setSetupNotice('Subject options could not be loaded. You can continue with other filters and refresh to retry.');
      }
    })();
  }, [classId]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error('Select a school workspace to browse questions.');
      }

      const params = new URLSearchParams();
      if (classId) params.set('class', classId);
      if (subjectId) params.set('subject', subjectId);
      if (selectedTags.length > 0) {
        params.set('tags', selectedTags.map(t => t._id).join(','));
        params.set('tagsMode', questionTagMatchMode === 'all' ? 'and' : 'or');
      }
      if (modalSearch.trim()) params.set('search', modalSearch.trim());

      const qs = params.toString();
      const endpoint = qs ? `/api/questions?${qs}` : '/api/questions';
      const data = await fetchApiJson<any>(endpoint, {
        cache: 'no-store',
        schoolKey,
        fallbackMessage: 'Failed to load questions.',
      });
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
    } catch (err: any) {
      setError(err?.message || 'A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [classId, subjectId, selectedTags, questionTagMatchMode, modalSearch]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleArchiveRequest = (id: string) => {
    setQuestionToArchive(id);
    setShowArchiveDialog(true);
  };

  const confirmArchive = async () => {
    if (!questionToArchive) return;
    setIsDeleting(true);
    try {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error('Please select a school in the navbar first.');
      }

      await fetchApiJson(`/api/questions/${questionToArchive}`, {
        method: 'DELETE',
        schoolKey,
        fallbackMessage: 'Failed to archive question.',
      });
      setQuestions(prev => prev.filter(q => q._id !== questionToArchive));
      toast({ title: 'Success', description: 'Question archived successfully.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setShowArchiveDialog(false);
      setQuestionToArchive(null);
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
          <p className="app-page-subtitle">Browse, filter, edit, and archive questions from the bank.</p>
        </div>
        <Link href="/questions/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Question
          </Button>
        </Link>
      </div>

      {setupNotice ? <div className="app-feedback app-feedback-info">{setupNotice}</div> : null}

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
            <div className="app-field-group">
              <p className="app-field-label">Tag Match</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={questionTagMatchMode === 'any' ? 'default' : 'outline'}
                  className="h-9"
                  onClick={() => setQuestionTagMatchMode('any')}
                  disabled={selectedTags.length === 0}
                >
                  Any Tag
                </Button>
                <Button
                  type="button"
                  variant={questionTagMatchMode === 'all' ? 'default' : 'outline'}
                  className="h-9"
                  onClick={() => setQuestionTagMatchMode('all')}
                  disabled={selectedTags.length === 0}
                >
                  All Tags
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedTags.length === 0
                  ? 'Select one or more tags to filter by tag match mode.'
                  : questionTagMatchMode === 'all'
                    ? 'Only questions containing all selected tags are shown.'
                    : 'Questions containing any selected tag are shown.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={fetchQuestions}>Refresh</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setClassId('');
                  setSubjectId('');
                  setSelectedTags([]);
                  setQuestionTagMatchMode('any');
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
              if (!window.confirm(`Are you sure you want to archive all ${filteredQuestions.length} filtered questions? This cannot be undone.`)) return;
              setIsDeleting(true);
              try {
                const schoolKey = resolveClientSchoolKey();
                if (!schoolKey) {
                  throw new Error('Please select a school in the navbar first.');
                }

                for (const question of filteredQuestions) {
                  await fetchApiJson(`/api/questions/${question._id}`, {
                    method: 'DELETE',
                    schoolKey,
                    fallbackMessage: 'Failed to archive question.',
                  });
                }
                setQuestions(prev => prev.filter(question => !filteredQuestions.some(filtered => filtered._id === question._id)));
                toast({ title: 'Success', description: 'All filtered questions archived.' });
              } catch (error: any) {
                toast({ title: 'Error', description: error?.message || 'Failed to archive filtered questions.', variant: 'destructive' });
              } finally {
                setIsDeleting(false);
              }
            }}
            disabled={isDeleting}
          >
            {isDeleting ? 'Archiving...' : `Archive All (${filteredQuestions.length})`}
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
              onArchive={handleArchiveRequest}
              isDeleting={isDeleting && questionToArchive === question._id}
            />
          ))
        )}
      </div>

      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive question?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will archive the question.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? <Spinner /> : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

