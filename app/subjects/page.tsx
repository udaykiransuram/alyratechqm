// app/subjects/page.tsx

'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { SubjectItem, SubjectItemSkeleton } from '@/components/subject-item';
import Link from 'next/link';
import type { Subject } from '@/components/subject-item'; // Import the consistent Subject type
import { Spinner } from '@/components/ui/spinner';

export default function ViewSubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [subjectToDeleteId, setSubjectToDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const { toast } = useToast();

  // This single fetch is all that's needed for the page.
  const fetchSubjects = useCallback(async () => {
    setPageLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/subjects');
      const data = await res.json();
      if (data.success) {
        setSubjects(data.subjects);
      } else {
        const errorMessage = data.message || "Failed to load subjects.";
        setFetchError(errorMessage);
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    } catch (error) {
      const errorMessage = "Network error when fetching subjects.";
      setFetchError(errorMessage);
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
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
        setSubjects(prev => prev.filter((s) => s._id !== subjectToDeleteId));
        toast({ title: "Success", description: "Subject deleted successfully!" });
      } else {
        toast({ title: "Error", description: data.message || "Failed to delete subject.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Network error when deleting subject.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setSubjectToDeleteId(null);
    }
  }, [subjectToDeleteId, toast]);

  return (
    <div className="container py-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">All Subjects</h1>
        <Link href="/subjects/create" passHref>
          <Button>+ Add New Subject</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing Subjects</CardTitle>
          <CardDescription>Browse, edit, or delete your current subjects.</CardDescription>
        </CardHeader>
        <CardContent>
          {fetchError ? (
            <div className="text-center text-destructive py-10">
              <p>{fetchError}</p>
              <Button onClick={fetchSubjects} variant="outline" className="mt-4">
                Try Again
              </Button>
            </div>
          ) : pageLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <SubjectItemSkeleton key={i} />
              ))}
            </div>
          ) : subjects.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              <p>No subjects found.</p>
              <Link href="/subjects/create">
                <Button variant="outline" className="mt-4">
                  Create your first subject
                </Button>
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
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
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the subject.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? <Spinner /> : 'Delete Subject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}