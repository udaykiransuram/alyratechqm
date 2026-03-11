'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { SubjectItem, SubjectItemSkeleton, type Subject } from '@/components/subject-item';
import { Spinner } from '@/components/ui/spinner';

export default function ViewSubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [subjectToDeleteId, setSubjectToDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const { toast } = useToast();

  const fetchSubjects = useCallback(async () => {
    setPageLoading(true);
    setFetchError(null);

    try {
      const res = await fetch('/api/subjects');
      const data = await res.json();

      if (data.success) {
        setSubjects(data.subjects);
      } else {
        const errorMessage = data.message || 'Failed to load subjects.';
        setFetchError(errorMessage);
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      }
    } catch {
      const errorMessage = 'Network error when fetching subjects.';
      setFetchError(errorMessage);
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setPageLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const handleDeleteClick = (id: string) => {
    setSubjectToDeleteId(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = useCallback(async () => {
    if (!subjectToDeleteId) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/subjects/${subjectToDeleteId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        setSubjects((prev) => prev.filter((subject) => subject._id !== subjectToDeleteId));
        toast({ title: 'Success', description: 'Subject archived successfully!' });
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to archive subject.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Network error when archiving subject.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setSubjectToDeleteId(null);
    }
  }, [subjectToDeleteId, toast]);

  return (
    <div className="container py-6 space-y-6">
      <div className="app-page-header-row">
        <div>
          <h1 className="app-page-title">All Subjects</h1>
          <p className="app-page-subtitle">
            Browse, update, and organize subject definitions and linked tags.
          </p>
        </div>
        <Link href="/subjects/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Subject
          </Button>
        </Link>
      </div>

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Existing Subjects</CardTitle>
          <CardDescription>Browse, edit, or archive your current subjects.</CardDescription>
        </CardHeader>
        <CardContent className="app-section-body">
          {fetchError ? (
            <div className="app-feedback app-feedback-error text-center">
              <p>{fetchError}</p>
              <div className="mt-4 flex justify-center">
                <Button onClick={fetchSubjects} variant="outline">
                  Try Again
                </Button>
              </div>
            </div>
          ) : pageLoading ? (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <SubjectItemSkeleton key={index} />
              ))}
            </ul>
          ) : subjects.length === 0 ? (
            <div className="app-empty-state">
              <p>No subjects found yet.</p>
              <div className="mt-4 flex justify-center">
                <Link href="/subjects/create">
                  <Button variant="outline">Create your first subject</Button>
                </Link>
              </div>
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {subjects.map((subject) => (
                <SubjectItem
                  key={subject._id}
                  subject={subject}
                  onDelete={handleDeleteClick}
                  isLoading={isDeleting && subjectToDeleteId === subject._id}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive subject?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will archive the subject.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? <Spinner /> : 'Archive Subject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
