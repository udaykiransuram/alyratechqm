"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
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
import SectionState from "@/components/ui/section-state";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { fetchApiJson } from "@/lib/client/api";

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
      const data = await fetchApiJson<{ subjects?: Subject[] }>("/api/subjects", {
        fallbackMessage: "Failed to load subjects.",
      });
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
      await fetchApiJson(`/api/subjects/${subjectToDeleteId}`, {
        method: "DELETE",
        fallbackMessage: "Failed to archive subject.",
      });

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
    <PageShell width="wide" padding="standard" className="app-directory-stack">
      <PageHero
        variant="directory"
        density="compact"
        eyebrow="Curriculum"
        title="Subjects"
        description="Browse, update, and archive subject definitions."
        actions={
          <Button asChild className="app-button-page">
            <AppPrefetchLink
              href="/workspace/subjects/create"
              prefetchOnMount
              relatedApiPrefetches={["/api/tags"]}
            >
              <Plus className="h-4 w-4" />
              Create Subject
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
            meta: "Subject definitions available in the current school.",
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
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <CardTitle>Existing Subjects</CardTitle>
            <div className="app-chip-cloud-tight">
              <span className="app-meta-chip">{subjects.length} subjects</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="app-section-body">
          {fetchError ? (
            <SectionState
              variant="error"
              title="Could not load subjects"
              description={fetchError}
              action={
                <Button onClick={fetchSubjects} variant="outline">
                  {pageLoading ? <Spinner /> : "Try Again"}
                </Button>
              }
            />
          ) : subjects.length === 0 ? (
            <SectionState
              title="No subjects yet"
              description="Create your first subject to start organizing curriculum data and tag-linked authoring flows."
              action={
                <Button asChild variant="outline" className="app-button-page">
                  <AppPrefetchLink href="/workspace/subjects/create">
                    Create your first subject
                  </AppPrefetchLink>
                </Button>
              }
            />
          ) : (
            <ul className="app-directory-card-grid">
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
    </PageShell>
  );
}
