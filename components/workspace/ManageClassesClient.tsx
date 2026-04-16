"use client";

import { useEffect, useState } from "react";

import { Archive } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SectionState from "@/components/ui/section-state";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { fetchApiJson } from "@/lib/client/api";
import { isMockedE2ETestMode } from "@/lib/test-mode";
import type { WorkspaceClassItem } from "@/lib/workspace/support-types";

type ManageClassesClientProps = {
  initialClasses: WorkspaceClassItem[];
  initialError?: string | null;
};

function sortClassesByName(items: WorkspaceClassItem[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export default function ManageClassesClient({
  initialClasses,
  initialError = null,
}: ManageClassesClientProps) {
  const shouldRefreshMockedData =
    isMockedE2ETestMode() && initialClasses.length === 0;
  const [classes, setClasses] = useState<WorkspaceClassItem[]>(
    sortClassesByName(initialClasses),
  );
  const [archivingClassId, setArchivingClassId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const { toast } = useToast();

  useEffect(() => {
    if (!initialError && !shouldRefreshMockedData) {
      return;
    }

    let active = true;

    void fetchApiJson<any>("/api/classes", {
      cache: "no-store",
      fallbackMessage: "We couldn't refresh the class list.",
    })
      .then((data) => {
        if (!active) {
          return;
        }

        const nextClasses = Array.isArray(data?.classes)
          ? data.classes
              .map((classItem: any) => ({
                _id: String(classItem?._id || "").trim(),
                name: String(classItem?.name || "").trim(),
                description: classItem?.description
                  ? String(classItem.description).trim()
                  : undefined,
              }))
              .filter(
                (classItem: WorkspaceClassItem) =>
                  Boolean(classItem._id) && Boolean(classItem.name),
              )
          : [];

        setClasses(sortClassesByName(nextClasses));
        setError(null);
      })
      .catch((loadError: any) => {
        if (!active) {
          return;
        }

        setError(
          loadError?.message || initialError || "Failed to load classes.",
        );
      });

    return () => {
      active = false;
    };
  }, [initialError, shouldRefreshMockedData]);

  const handleArchiveClass = async (classId: string) => {
    setArchivingClassId(classId);

    try {
      await fetchApiJson(`/api/classes/${classId}`, {
        method: "DELETE",
        fallbackMessage: "We couldn't archive this class.",
      });

      setClasses((currentClasses) =>
        currentClasses.filter((item) => item._id !== classId),
      );
      toast({
        title: "Class archived",
        description: "The class has been archived.",
      });
    } catch (error: any) {
      toast({
        title: "Couldn't archive class",
        description: error?.message || "We couldn't archive this class.",
        variant: "destructive",
      });
    } finally {
      setArchivingClassId((currentId) =>
        currentId === classId ? null : currentId,
      );
    }
  };

  return (
    <PageShell width="wide" padding="standard" className="app-directory-stack">
      <PageHero
        variant="directory"
        density="compact"
        eyebrow="Academic Setup"
        title="Manage Classes"
        description="Review and archive classes from the directory page."
        actions={
          <Button asChild className="app-button-page">
            <AppPrefetchLink href="/workspace/manage/classes/create" prefetchOnMount>
              Create Classes
            </AppPrefetchLink>
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Dedicated create page</span>
            <span className="app-meta-chip">Bulk upload available</span>
          </>
        }
        stats={[
          {
            label: "Total classes",
            value: String(classes.length),
            meta: "All active classes currently available in this school.",
          },
          {
            label: "Directory mode",
            value: "List + Archive",
            meta: "Creation now happens in the dedicated create route.",
          },
          {
            label: "Archive state",
            value: archivingClassId ? "Archiving" : "Ready",
            meta: "Archive unused classes directly from this page.",
          },
          {
            label: "Data health",
            value: error ? "Needs review" : "Good",
            meta: error
              ? "One or more class records failed to load."
              : "Class records are ready on page open.",
          },
        ]}
      />

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <CardTitle>Existing Classes</CardTitle>
            <div className="app-chip-cloud-tight">
              <span className="app-meta-chip">{classes.length} classes</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="app-section-body">
          {error ? (
            <SectionState
              variant="error"
              title="Class data needs attention"
              description={error}
            />
          ) : classes.length === 0 ? (
            <SectionState
              title="No classes yet"
              description="Open the dedicated create page to add your first class or import a class list in bulk."
              action={
                <Button asChild className="app-button-page">
                  <AppPrefetchLink href="/workspace/manage/classes/create">
                    Go to Create Classes
                  </AppPrefetchLink>
                </Button>
              }
            />
	          ) : (
	            <>
	              <div className="space-y-3 md:hidden">
	                {classes.map((classItem) => (
	                  <div
	                    key={`mobile-${classItem._id}`}
	                    className="rounded-2xl border border-border/60 bg-background/70 p-3"
	                  >
	                    <div className="space-y-2">
	                      <p className="text-sm font-semibold text-foreground">{classItem.name}</p>
	                      <AlertDialog>
	                        <AlertDialogTrigger asChild>
	                          <Button
	                            variant="outline"
	                            size="sm"
	                            className="app-row-action-button app-row-action-button-danger w-full justify-center"
	                            disabled={Boolean(archivingClassId)}
	                            aria-label={`Archive ${classItem.name}`}
	                            title={`Archive ${classItem.name}`}
	                          >
	                            {archivingClassId === classItem._id ? (
	                              <Spinner />
	                            ) : (
	                              <Archive className="h-4 w-4" />
	                            )}
	                            Archive
	                          </Button>
	                        </AlertDialogTrigger>
	                        <AlertDialogContent>
	                          <AlertDialogHeader>
	                            <AlertDialogTitle>Archive class?</AlertDialogTitle>
	                            <AlertDialogDescription>
	                              This action cannot be undone. This will archive the class
	                              <strong className="mx-1">&ldquo;{classItem.name}&rdquo;</strong>.
	                            </AlertDialogDescription>
	                          </AlertDialogHeader>
	                          <AlertDialogFooter>
	                            <AlertDialogCancel disabled={Boolean(archivingClassId)}>
	                              Cancel
	                            </AlertDialogCancel>
	                            <AlertDialogAction
	                              onClick={() => void handleArchiveClass(classItem._id)}
	                              disabled={Boolean(archivingClassId)}
	                            >
	                              {archivingClassId === classItem._id ? <Spinner /> : "Archive"}
	                            </AlertDialogAction>
	                          </AlertDialogFooter>
	                        </AlertDialogContent>
	                      </AlertDialog>
	                    </div>
	                  </div>
	                ))}
	              </div>

	              <div className="app-table-wrap app-table-dense hidden md:block">
	                <Table>
	                  <TableHeader>
	                    <TableRow>
	                      <TableHead>Class Name</TableHead>
	                      <TableHead className="text-right">Actions</TableHead>
	                    </TableRow>
	                  </TableHeader>
	                  <TableBody>
	                    {classes.map((classItem) => (
	                      <TableRow key={classItem._id}>
	                        <TableCell>
	                          <div className="app-table-cell-title">{classItem.name}</div>
	                        </TableCell>
	                        <TableCell className="text-right">
	                          <AlertDialog>
	                            <AlertDialogTrigger asChild>
	                              <Button
	                                variant="outline"
	                                size="sm"
	                                className="app-row-action-button app-row-action-button-danger"
	                                disabled={Boolean(archivingClassId)}
	                                aria-label={`Archive ${classItem.name}`}
	                                title={`Archive ${classItem.name}`}
	                              >
	                                {archivingClassId === classItem._id ? (
	                                  <Spinner />
	                                ) : (
	                                  <Archive className="h-4 w-4" />
	                                )}
	                                Archive
	                              </Button>
	                            </AlertDialogTrigger>
	                            <AlertDialogContent>
	                              <AlertDialogHeader>
	                                <AlertDialogTitle>Archive class?</AlertDialogTitle>
	                                <AlertDialogDescription>
	                                  This action cannot be undone. This will archive the class
	                                  <strong className="mx-1">
	                                    &ldquo;{classItem.name}&rdquo;
	                                  </strong>
	                                  .
	                                </AlertDialogDescription>
	                              </AlertDialogHeader>
	                              <AlertDialogFooter>
	                                <AlertDialogCancel disabled={Boolean(archivingClassId)}>
	                                  Cancel
	                                </AlertDialogCancel>
	                                <AlertDialogAction
	                                  onClick={() => void handleArchiveClass(classItem._id)}
	                                  disabled={Boolean(archivingClassId)}
	                                >
	                                  {archivingClassId === classItem._id ? <Spinner /> : "Archive"}
	                                </AlertDialogAction>
	                              </AlertDialogFooter>
	                            </AlertDialogContent>
	                          </AlertDialog>
	                        </TableCell>
	                      </TableRow>
	                    ))}
	                  </TableBody>
	                </Table>
	              </div>
	            </>
	          )}
	        </CardContent>
	      </Card>
	    </PageShell>
  );
}
