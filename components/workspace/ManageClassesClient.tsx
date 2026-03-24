"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import SectionState from "@/components/ui/section-state";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchApiJson } from "@/lib/client/api";
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
  const [classes, setClasses] = useState<WorkspaceClassItem[]>(
    sortClassesByName(initialClasses),
  );
  const [newClassName, setNewClassName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [archivingClassId, setArchivingClassId] = useState<string | null>(null);
  const [error] = useState<string | null>(initialError);
  const { toast } = useToast();

  const handleCreateClass = async (event: FormEvent) => {
    event.preventDefault();

    if (!newClassName.trim()) {
      toast({
        title: "Validation Error",
        description: "Class name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await fetchApiJson<any>("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClassName }),
        fallbackMessage: "Failed to create class.",
      });

      const nextClass: WorkspaceClassItem = {
        _id: String(data.class?._id || data.classId || ""),
        name: String(data.class?.name || newClassName).trim(),
        description: data.class?.description
          ? String(data.class.description).trim()
          : undefined,
      };

      setClasses((currentClasses) =>
        sortClassesByName([
          ...currentClasses.filter((item) => item._id !== nextClass._id),
          nextClass,
        ]),
      );
      setNewClassName("");
      toast({
        title: "Success",
        description: `Class "${nextClass.name}" created.`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to create class.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveClass = async (classId: string) => {
    setArchivingClassId(classId);
    try {
      await fetchApiJson(`/api/classes/${classId}`, {
        method: "DELETE",
        fallbackMessage: "Failed to archive class.",
      });

      setClasses((currentClasses) =>
        currentClasses.filter((item) => item._id !== classId),
      );
      toast({
        title: "Success",
        description: "Class archived successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to archive class.",
        variant: "destructive",
      });
    } finally {
      setArchivingClassId((currentId) =>
        currentId === classId ? null : currentId,
      );
    }
  };

  return (
    <PageShell width="wide" padding="relaxed">
      <PageHero
        eyebrow="Academic Setup"
        title="Manage Classes"
        description="Create the class structure your school uses for student enrollment, question papers, analytics, and reports."
        meta={
          <>
            <span className="app-meta-chip">Foundation data</span>
            <span className="app-meta-chip">Used across papers and users</span>
          </>
        }
        stats={[
          {
            label: "Total classes",
            value: String(classes.length),
            meta: "All active classes currently available in this school workspace.",
          },
          {
            label: "Create status",
            value: isSubmitting ? "Saving" : "Ready",
            meta: "Add a new class without leaving this page.",
          },
          {
            label: "Data health",
            value: error ? "Needs review" : "Good",
            meta: error
              ? "One or more class operations failed to load."
              : "Class records are ready immediately on page open.",
          },
          {
            label: "Flow",
            value: "Create + Archive",
            meta: "Class maintenance stays in one standardized workspace.",
          },
        ]}
      />

      <div className="space-y-6">
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Create New Class</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <form
              onSubmit={handleCreateClass}
              className="flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Input
                id="newClassName"
                placeholder="e.g., Grade 10"
                value={newClassName}
                onChange={(event) => setNewClassName(event.target.value)}
                disabled={isSubmitting || Boolean(archivingClassId)}
              />
              <Button
                type="submit"
                disabled={isSubmitting || Boolean(archivingClassId)}
                className="w-[150px]"
              >
                {isSubmitting ? <Spinner /> : "Create Class"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Existing Classes</CardTitle>
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
                description="Create your first class above to unlock section setup, student placement, and paper assignment flows."
              />
            ) : (
              <div className="app-table-wrap">
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
                        <TableCell className="font-medium">
                          {classItem.name}
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={isSubmitting || Boolean(archivingClassId)}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
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
                                  onClick={() => handleArchiveClass(classItem._id)}
                                  disabled={Boolean(archivingClassId)}
                                >
                                  {archivingClassId === classItem._id ? (
                                    <Spinner />
                                  ) : (
                                    "Archive"
                                  )}
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
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
