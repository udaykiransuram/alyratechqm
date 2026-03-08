"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useToast } from "@/components/ui/use-toast";

interface SchoolItem {
  _id: string;
  key: string;
  displayName: string;
  createdAt?: string;
  updatedAt?: string;
}

const EMPTY_CREATE_FORM = {
  key: "",
  displayName: "",
};

export default function ManageSchoolsPage() {
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [editForm, setEditForm] = useState<SchoolItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();

  const sortedSchools = useMemo(
    () => [...schools].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [schools],
  );

  const loadSchools = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch("/api/schools", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to load schools.");
      }
      setSchools(Array.isArray(data.schools) ? data.schools : []);
    } catch (err: any) {
      setError(err.message || "Failed to load schools.");
      toast({
        title: "Error",
        description: "Failed to load schools.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSchools();
  }, [loadSchools]);

  function clearSelectedSchoolIfDeleted(schoolKey: string) {
    try {
      const match = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
      const currentSchoolKey = match?.[1] ? decodeURIComponent(match[1]) : "";
      if (currentSchoolKey === schoolKey) {
        document.cookie = "schoolKey=; path=/; max-age=0";
      }
    } catch {
    }
  }

  async function handleCreateSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      key: createForm.key.trim(),
      displayName: createForm.displayName.trim(),
    };

    if (!payload.key || !payload.displayName) {
      toast({
        title: "Validation Error",
        description: "Enter both a school key and a display name.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to create school.");
      }

      setCreateForm(EMPTY_CREATE_FORM);
      setSchools((current) => [...current, data.school]);
      toast({
        title: "School created",
        description: `${data.school.displayName} is ready to use.`,
      });
    } catch (err: any) {
      toast({
        title: "Create failed",
        description: err.message || "Failed to create school.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveSchool() {
    if (!editForm) return;

    const payload = {
      displayName: editForm.displayName.trim(),
      key: editForm.key,
    };

    if (!payload.displayName) {
      toast({
        title: "Validation Error",
        description: "Display name is required.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/schools/${editForm._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to update school.");
      }

      setSchools((current) =>
        current.map((school) =>
          school._id === editForm._id ? data.school : school,
        ),
      );
      setEditOpen(false);
      setEditForm(null);
      toast({
        title: "School updated",
        description: `${data.school.displayName} has been updated.`,
      });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err.message || "Failed to update school.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteSchool(school: SchoolItem) {
    setDeletingId(school._id);
    try {
      const res = await fetch(`/api/schools/${school._id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to delete school.");
      }

      clearSelectedSchoolIfDeleted(school.key);
      setSchools((current) => current.filter((item) => item._id !== school._id));
      toast({
        title: "School deleted",
        description: `${school.displayName} has been removed.`,
      });
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message || "Failed to delete school.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="container py-6 space-y-6">
      <header className="app-page-header">
        <h1 className="app-page-title">Manage Schools</h1>
        <p className="app-page-subtitle">
          Create, rename, and remove school workspaces used by the tenant switcher.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle>Create School</CardTitle>
                <CardDescription>
                  School keys are permanent tenant identifiers. Choose them carefully.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="app-section-body">
            <form className="space-y-4" onSubmit={handleCreateSchool}>
              <div className="app-field-group">
                <label className="app-field-label" htmlFor="create-school-key">
                  School Key
                </label>
                <Input
                  id="create-school-key"
                  placeholder="e.g., alpha-high"
                  value={createForm.key}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      key: event.target.value,
                    }))
                  }
                  disabled={isSubmitting}
                />
                <p className="text-sm text-muted-foreground">
                  Used for tenant database names, cookies, and API routing.
                </p>
              </div>

              <div className="app-field-group">
                <label
                  className="app-field-label"
                  htmlFor="create-school-display-name"
                >
                  Display Name
                </label>
                <Input
                  id="create-school-display-name"
                  placeholder="e.g., Alpha High School"
                  value={createForm.displayName}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                  disabled={isSubmitting}
                />
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? <Spinner /> : "Create School"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Existing Schools</CardTitle>
            <CardDescription>
              Rename display names here. Deleting a school also removes its tenant database.
            </CardDescription>
          </CardHeader>
          <CardContent className="app-section-body">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : error ? (
              <div className="app-feedback app-feedback-error">{error}</div>
            ) : (
              <div className="app-table-wrap">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSchools.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No schools created yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedSchools.map((school) => (
                        <TableRow key={school._id}>
                          <TableCell className="font-medium">
                            {school.displayName}
                          </TableCell>
                          <TableCell>
                            <code className="rounded bg-muted px-2 py-1 text-xs">
                              {school.key}
                            </code>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {school.updatedAt
                              ? new Date(school.updatedAt).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => {
                                  setEditForm(school);
                                  setEditOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Edit school</span>
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 text-destructive"
                                    disabled={deletingId === school._id}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Delete school</span>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete school?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This removes {school.displayName} from the
                                      switcher and deletes its tenant database.
                                      This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteSchool(school)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      {deletingId === school._id ? <Spinner /> : "Delete"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(nextOpen) => {
          setEditOpen(nextOpen);
          if (!nextOpen) setEditForm(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle>Edit School</DialogTitle>
            <DialogDescription>
              Update the display name shown in the navbar and management pages.
            </DialogDescription>
          </DialogHeader>

          {editForm ? (
            <div className="space-y-4">
              <div className="app-field-group">
                <label className="app-field-label" htmlFor="edit-school-key">
                  School Key
                </label>
                <Input id="edit-school-key" value={editForm.key} disabled />
                <p className="text-sm text-muted-foreground">
                  School keys stay fixed after creation to preserve tenant routing.
                </p>
              </div>

              <div className="app-field-group">
                <label
                  className="app-field-label"
                  htmlFor="edit-school-display-name"
                >
                  Display Name
                </label>
                <Input
                  id="edit-school-display-name"
                  value={editForm.displayName}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, displayName: event.target.value }
                        : current,
                    )
                  }
                  disabled={isSaving}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveSchool} disabled={isSaving || !editForm}>
              {isSaving ? <Spinner /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
