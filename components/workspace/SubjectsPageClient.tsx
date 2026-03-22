"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import PageHero from "@/components/layout/PageHero";
import { SubjectItem, type Subject } from "@/components/subject-item";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";

type SubjectsPageClientProps = {
  initialSubjects: Subject[];
  initialError?: string | null;
};

export default function SubjectsPageClient({
  initialSubjects,
  initialError = null,
}: SubjectsPageClientProps) {
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [pageLoading, setPageLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [subjectToDeleteId, setSubjectToDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(initialError);
  const { toast } = useToast();

  const fetchSubjects = useCallback(async () => {
    setPageLoading(true);
    setFetchError(null);

    try {
      const response = await fetch("/api/subjects");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to load subjects.");
      }

      setSubjects(Array.isArray(data.subjects) ? data.subjects : []);
    } catch (error: any) {
      const errorMessage =
        error?.message || "Network error when fetching subjects.";
      setFetchError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setPageLoading(false);
    }
  }, [toast]);

  const handleDeleteClick = (id: string) => {
    setSubjectToDeleteId(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = useCallback(async () => {
    if (!subjectToDeleteId) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/subjects/${subjectToDeleteId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to archive subject.");
      }

      setSubjects((currentSubjects) =>
        currentSubjects.filter((subject) => subject._id !== subjectToDeleteId),
      );
      toast({
        title: "Success",
        description: "Subject archived successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Network error when archiving subject.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setSubjectToDeleteId(null);
    }
  }, [subjectToDeleteId, toast]);

  return (
    <div className="app-page-shell max-w-7xl px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="Curriculum"
        title="Subjects"
        description="Browse, update, and organize subject definitions and the tags used across your paper-authoring flow."
        actions={
          <Button asChild className="gap-2">
            <AppPrefetchLink
              href="/workspace/subjects/create"
              prefetchOnMount
              relatedApiPrefetches={["/api/tags"]}
            >
              <Plus className="h-4 w-4" />
              Add Subject
            </AppPrefetchLink>
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Dedicated subject library</span>
            <span className="app-meta-chip">Tag-linked setup</span>
          </>
        }
        stats={[
          {
            label: "Total subjects",
            value: String(subjects.length),
            meta: "Subject definitions available in the current school workspace.",
          },
          {
            label: "Tagged subjects",
            value: String(subjects.filter((subject) => subject.tags?.length).length),
            meta: "Subjects already connected to one or more curriculum tags.",
          },
          {
            label: "Library state",
            value: fetchError ? "Needs attention" : pageLoading ? "Refreshing" : "Ready",
            meta: fetchError
              ? "Refresh or retry if the subject list did not load cleanly."
              : "This page now opens with subject data already rendered from the server.",
          },
        ]}
      />

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Existing Subjects</CardTitle>
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
          ) : subjects.length === 0 ? (
            <div className="app-empty-state">
              <p>No subjects found yet.</p>
              <div className="mt-4 flex justify-center">
                <AppPrefetchLink href="/workspace/subjects/create">
                  <Button variant="outline">Create your first subject</Button>
                </AppPrefetchLink>
              </div>
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
              {isDeleting ? <Spinner /> : "Archive Subject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
