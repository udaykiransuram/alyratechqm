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

export default function ViewQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

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

      <div className="space-y-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <QuestionItemSkeleton key={i} />)
        ) : error ? (
          <div className="text-center py-10 text-destructive">
            <p>{error}</p>
            <Button onClick={fetchQuestions} variant="outline" className="mt-4">Try Again</Button>
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <p>No questions have been created yet.</p>
            <Link href="/questions/create">
              <Button variant="outline" className="mt-4">Create your first question</Button>
            </Link>
          </div>
        ) : (
          questions.map(q => (
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