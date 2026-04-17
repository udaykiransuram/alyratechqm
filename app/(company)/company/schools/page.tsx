"use client";

import Link from "next/link";
import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Edit,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { fetchApiJson } from "@/lib/client/api";
import { clearSchoolKeyCookie, getSchoolKeyFromCookie } from "@/lib/client/school";
import {
  SUMMER_CRASH_DISPLAY_NAME,
  SUMMER_CRASH_SCHOOL_KEY,
  isSummerCrashSchoolKey,
} from "@/lib/summer-crash/constants";

interface SchoolItem {
  _id: string;
  key: string;
  displayName: string;
  createdAt?: string;
  updatedAt?: string;
}

type EditSchoolForm = SchoolItem & {
  bootstrapAdminId?: string;
  adminName: string;
  adminEmail: string;
  adminMobileNumber: string;
  adminPassword: string;
};

const EMPTY_CREATE_FORM = {
  key: "",
  displayName: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
  adminMobileNumber: "",
};

type CreateSchoolPreset = "standard" | "summerCrash";

export default function ManageSchoolsPage() {
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createPreset, setCreatePreset] = useState<CreateSchoolPreset>("standard");
  const [editForm, setEditForm] = useState<EditSchoolForm | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSchoolKey, setSelectedSchoolKey] = useState("");

  const { toast } = useToast();

  const sortedSchools = useMemo(
    () => [...schools].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [schools],
  );
  const summerCrashSchool = useMemo(
    () => schools.find((school) => isSummerCrashSchoolKey(school.key)) || null,
    [schools],
  );

  const loadSchools = useCallback(async () => {
    try {
      setSelectedSchoolKey(getSchoolKeyFromCookie());
      setIsLoading(true);
      setError(null);
      const data = await fetchApiJson<any>("/api/schools", {
        cache: "no-store",
        fallbackMessage: "Failed to load schools.",
      });
      setSchools(Array.isArray(data.schools) ? data.schools : []);
    } catch (err: any) {
      const message = err.message || "Failed to load schools.";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setSelectedSchoolKey(getSchoolKeyFromCookie());
  }, []);

  useEffect(() => {
    loadSchools();
  }, [loadSchools]);

  function clearSelectedSchoolIfDeleted(schoolKey: string) {
    if (getSchoolKeyFromCookie() === schoolKey) {
      clearSchoolKeyCookie();
      setSelectedSchoolKey("");
    }
  }

  async function handleCreateSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      key: createForm.key.trim(),
      displayName: createForm.displayName.trim(),
      adminName: createForm.adminName.trim(),
      adminEmail: createForm.adminEmail.trim(),
      adminPassword: createForm.adminPassword,
      adminMobileNumber: createForm.adminMobileNumber.trim(),
    };

    if (
      !payload.key ||
      !payload.displayName ||
      !payload.adminName ||
      !payload.adminEmail ||
      !payload.adminPassword ||
      !payload.adminMobileNumber
    ) {
      toast({
        title: "Validation Error",
        description:
          "Complete the school details and the bootstrap school admin details.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await fetchApiJson<any>("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        fallbackMessage: "Failed to create school.",
      });

      setCreatePreset("standard");
      setCreateForm(EMPTY_CREATE_FORM);
      setSchools((current) => [...current, data.school]);
      toast({
        title: "School created",
        description: `${data.school.displayName} is ready with ${data.bootstrapAdmin?.email || "its first admin account"}.`,
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

  async function handleOpenEditSchool(school: SchoolItem) {
    setEditOpen(true);
    setIsEditLoading(true);
    setEditForm(null);

    try {
      const data = await fetchApiJson<any>(`/api/schools/${school._id}`, {
        cache: "no-store",
        fallbackMessage: "Failed to load school details.",
      });

      setEditForm({
        _id: data.school._id,
        key: data.school.key,
        displayName: data.school.displayName,
        createdAt: data.school.createdAt,
        updatedAt: data.school.updatedAt,
        bootstrapAdminId: data.bootstrapAdmin?.id || undefined,
        adminName: data.bootstrapAdmin?.name || "",
        adminEmail: data.bootstrapAdmin?.email || "",
        adminMobileNumber: data.bootstrapAdmin?.mobileNumber || "",
        adminPassword: "",
      });
    } catch (err: any) {
      setEditOpen(false);
      setEditForm(null);
      toast({
        title: "Load failed",
        description: err.message || "Failed to load school details.",
        variant: "destructive",
      });
    } finally {
      setIsEditLoading(false);
    }
  }

  async function handleSaveSchool() {
    if (!editForm) return;

    const payload = {
      displayName: editForm.displayName.trim(),
      key: editForm.key,
      adminName: editForm.adminName.trim(),
      adminEmail: editForm.adminEmail.trim(),
      adminMobileNumber: editForm.adminMobileNumber.trim(),
      adminPassword: editForm.adminPassword,
    };

    if (!payload.displayName) {
      toast({
        title: "Validation Error",
        description: "Display name is required.",
        variant: "destructive",
      });
      return;
    }

    if (
      editForm.bootstrapAdminId &&
      (payload.adminName ||
        payload.adminEmail ||
        payload.adminMobileNumber ||
        payload.adminPassword) &&
      (!payload.adminName || !payload.adminEmail || !payload.adminMobileNumber)
    ) {
      toast({
        title: "Validation Error",
        description:
          "Bootstrap school admin name, email, and phone are required.",
        variant: "destructive",
      });
      return;
    }

    if (
      !editForm.bootstrapAdminId &&
      (payload.adminName ||
        payload.adminEmail ||
        payload.adminMobileNumber ||
        payload.adminPassword) &&
      (!payload.adminName ||
        !payload.adminEmail ||
        !payload.adminMobileNumber ||
        !payload.adminPassword)
    ) {
      toast({
        title: "Validation Error",
        description:
          "Name, email, phone, and password are required to create the first school admin.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const data = await fetchApiJson<any>(`/api/schools/${editForm._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        fallbackMessage: "Failed to update school.",
      });

      setSchools((current) =>
        current.map((school) =>
          school._id === editForm._id ? data.school : school,
        ),
      );
      setEditOpen(false);
      setEditForm(null);
      toast({
        title: "School updated",
        description: data.bootstrapAdmin
          ? `${data.school.displayName} and its bootstrap admin have been updated.`
          : `${data.school.displayName} has been updated.`,
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
      await fetchApiJson(`/api/schools/${school._id}`, {
        method: "DELETE",
        fallbackMessage: "Failed to delete school.",
      });

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

  function handleUseSummerCrashPreset() {
    setCreatePreset("summerCrash");
    setCreateForm((current) => ({
      ...current,
      key: SUMMER_CRASH_SCHOOL_KEY,
      displayName: SUMMER_CRASH_DISPLAY_NAME,
    }));
  }

  function handleUseStandardSchoolForm() {
    setCreatePreset("standard");
    setCreateForm((current) => ({
      ...current,
      key: "",
      displayName: "",
    }));
  }

  return (
    <PageShell width="wide" padding="relaxed" className="app-directory-stack">
      <PageHero
        eyebrow="Company Admin"
        title="Manage Schools"
        description="Create, update, and remove school workspaces from one company-level console."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/company/activity">
              <Button type="button" variant="outline" size="sm" className="app-button-compact">
                Operations Activity
              </Button>
            </Link>
            <Link href="/company/health">
              <Button type="button" variant="outline" size="sm" className="app-button-compact">
                System Health
              </Button>
            </Link>
            <Link href="/company/indexing">
              <Button type="button" variant="outline" size="sm" className="app-button-compact">
                Maintenance Console
              </Button>
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="app-button-compact"
              onClick={() => void loadSchools()}
              disabled={isLoading}
            >
              {isLoading ? <Spinner /> : "Refresh"}
            </Button>
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">School keys are permanent</span>
            <span className="app-meta-chip">Bootstrap admin required</span>
            <span className="app-meta-chip">Company-admin only actions</span>
          </>
        }
        stats={[
          {
            label: "Total schools",
            value: String(sortedSchools.length),
            meta: "All company-managed school workspaces.",
          },
          {
            label: "Selected workspace",
            value: selectedSchoolKey || "None",
            meta: "Current school key in the browser workspace context.",
          },
          {
            label: "Provisioning mode",
            value: "School + admin",
            meta: "Every new school is created together with its first admin.",
          },
          {
            label: "Access boundary",
            value: "Company only",
            meta: "Only company-admin sessions can create, edit, or delete schools.",
          },
        ]}
      />

	      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] xl:items-start">
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle>Create School</CardTitle>
                <CardDescription>
                  School keys are permanent tenant identifiers.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="app-section-body">
            <form className="space-y-4" onSubmit={handleCreateSchool}>
              <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        Crash Course Workspace
                      </h3>
                      <Badge variant="outline">
                        {summerCrashSchool ? "Already created" : "Hidden tenant"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Use the fixed Crash Course tenant key and keep it hidden from
                      the normal public school picker.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Key: <code className="rounded bg-background px-1.5 py-0.5">{SUMMER_CRASH_SCHOOL_KEY}</code>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {summerCrashSchool ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="app-button-compact"
                        onClick={() => void handleOpenEditSchool(summerCrashSchool)}
                      >
                        Edit Crash Course School
                      </Button>
                    ) : createPreset === "summerCrash" ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="app-button-compact"
                        onClick={handleUseStandardSchoolForm}
                        disabled={isSubmitting}
                      >
                        Use Standard School Form
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="app-button-compact"
                        onClick={handleUseSummerCrashPreset}
                        disabled={isSubmitting}
                      >
                        Use Crash Course Preset
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="app-section space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    School identity
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {createPreset === "summerCrash"
                      ? "Crash Course preset is active. The tenant key and name are locked to the summer workspace defaults."
                      : "Set the permanent key and display name for this tenant workspace."}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="create-school-key">
                      School Key
                    </label>
                    <Input
                      id="create-school-key"
                      placeholder={
                        createPreset === "summerCrash"
                          ? SUMMER_CRASH_SCHOOL_KEY
                          : "e.g., alpha-high"
                      }
                      value={createForm.key}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          key: event.target.value,
                        }))
                      }
                      disabled={isSubmitting || createPreset === "summerCrash"}
                    />
                    <p className="text-sm text-muted-foreground">
                      {createPreset === "summerCrash"
                        ? "This special key keeps the Crash Course school hidden from normal school selection."
                        : "Used for tenant database names, cookies, and routing."}
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
                      placeholder={
                        createPreset === "summerCrash"
                          ? SUMMER_CRASH_DISPLAY_NAME
                          : "e.g., Alpha High School"
                      }
                      value={createForm.displayName}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          displayName: event.target.value,
                        }))
                      }
                      disabled={isSubmitting || createPreset === "summerCrash"}
                    />
                  </div>
                </div>
              </div>

              <div className="app-section space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Bootstrap School Admin
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Every new school starts with its first admin so the school can log in immediately.
                  </p>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="app-field-group">
                    <label
                      className="app-field-label"
                      htmlFor="create-school-admin-name"
                    >
                      Admin Name
                    </label>
                    <Input
                      id="create-school-admin-name"
                      placeholder="e.g., Priya Sharma"
                      value={createForm.adminName}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          adminName: event.target.value,
                        }))
                      }
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="app-field-group">
                    <label
                      className="app-field-label"
                      htmlFor="create-school-admin-email"
                    >
                      Admin Email
                    </label>
                    <Input
                      id="create-school-admin-email"
                      type="email"
                      placeholder="admin@school.com"
                      value={createForm.adminEmail}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          adminEmail: event.target.value,
                        }))
                      }
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="app-field-group">
                    <label
                      className="app-field-label"
                      htmlFor="create-school-admin-mobile"
                    >
                      Admin Phone
                    </label>
                    <Input
                      id="create-school-admin-mobile"
                      placeholder="e.g., 9876543210"
                      value={createForm.adminMobileNumber}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          adminMobileNumber: event.target.value,
                        }))
                      }
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="app-field-group">
                    <label
                      className="app-field-label"
                      htmlFor="create-school-admin-password"
                    >
                      Admin Password
                    </label>
                    <Input
                      id="create-school-admin-password"
                      type="password"
                      placeholder="Create a secure password"
                      value={createForm.adminPassword}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          adminPassword: event.target.value,
                        }))
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-dashed border-border/70 bg-background/70 px-3.5 py-3 text-sm text-muted-foreground">
                  This admin uses school-user sign-in and can immediately create additional users.
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? <Spinner /> : "Create School & Admin"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <CardTitle>Existing Schools</CardTitle>
                <CardDescription>
                  Edit school names and bootstrap admin details. Deleting a school also removes its tenant database.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{sortedSchools.length} schools</Badge>
                <Badge variant="outline">
                  {selectedSchoolKey ? `Active: ${selectedSchoolKey}` : "No active workspace"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="app-section-body">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : error ? (
              <div className="space-y-3">
                <div className="app-feedback app-feedback-error">{error}</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="app-button-compact"
                  onClick={() => void loadSchools()}
                >
                  Retry
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {sortedSchools.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                      No schools created yet.
                    </div>
	                  ) : (
	                    sortedSchools.map((school) => (
	                      <article
	                        key={school._id}
	                        className="rounded-2xl border border-border/70 bg-background/80 p-4"
	                      >
	                        <div className="space-y-1">
	                          <div className="flex flex-wrap items-center gap-2">
	                            <p className="font-medium text-foreground">{school.displayName}</p>
	                            {isSummerCrashSchoolKey(school.key) ? (
	                              <Badge variant="outline">Crash Course</Badge>
	                            ) : null}
	                          </div>
	                          <div>
	                            <code className="rounded bg-muted px-2 py-1 text-xs">{school.key}</code>
	                          </div>
                          <p className="text-xs text-muted-foreground">
                            Updated{" "}
                            {school.updatedAt
                              ? new Date(school.updatedAt).toLocaleDateString()
                              : "—"}
                          </p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="app-row-action-button app-row-action-button-accent"
                            onClick={() => void handleOpenEditSchool(school)}
                            title="Edit school"
                            aria-label="Edit school"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="app-row-action-button app-row-action-button-danger"
                                disabled={deletingId === school._id}
                                title="Delete school"
                                aria-label="Delete school"
                              >
                                {deletingId === school._id ? (
                                  <Spinner />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                                Delete
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
                                  className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {deletingId === school._id ? <Spinner /> : "Delete"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </article>
                    ))
                  )}
                </div>

                <div className="hidden md:block">
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
	                              <TableCell>
                                  <div className="flex flex-wrap items-center gap-2">
	                                  <span className="font-medium">{school.displayName}</span>
                                    {isSummerCrashSchoolKey(school.key) ? (
                                      <Badge variant="outline">Crash Course</Badge>
                                    ) : null}
                                  </div>
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
                                <div className="app-row-action-group justify-end">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="app-row-action-button app-row-action-button-accent"
                                    onClick={() => void handleOpenEditSchool(school)}
                                    title="Edit school"
                                    aria-label="Edit school"
                                  >
                                    <Edit className="h-4 w-4" />
                                    Edit
                                  </Button>

                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="app-row-action-button app-row-action-button-danger"
                                        disabled={deletingId === school._id}
                                        title="Delete school"
                                        aria-label="Delete school"
                                      >
                                        {deletingId === school._id ? (
                                          <Spinner />
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                        Delete
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
                                          className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(nextOpen) => {
          setEditOpen(nextOpen);
          if (!nextOpen) {
            setEditForm(null);
            setIsEditLoading(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle>Edit School</DialogTitle>
            <DialogDescription>
              Update the school profile and the bootstrap school-admin account used for the initial handoff.
            </DialogDescription>
          </DialogHeader>

          {isEditLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : editForm ? (
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

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Bootstrap School Admin
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {editForm.bootstrapAdminId
                      ? "Update the current bootstrap school admin for this tenant."
                      : "Create the first bootstrap school admin for this tenant if one is still missing."}
                  </p>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="app-field-group">
                    <label
                      className="app-field-label"
                      htmlFor="edit-school-admin-name"
                    >
                      Admin Name
                    </label>
                    <Input
                      id="edit-school-admin-name"
                      placeholder="e.g., Priya Sharma"
                      value={editForm.adminName}
                      onChange={(event) =>
                        setEditForm((current) =>
                          current
                            ? { ...current, adminName: event.target.value }
                            : current,
                        )
                      }
                      disabled={isSaving}
                    />
                  </div>

                  <div className="app-field-group">
                    <label
                      className="app-field-label"
                      htmlFor="edit-school-admin-email"
                    >
                      Admin Email
                    </label>
                    <Input
                      id="edit-school-admin-email"
                      type="email"
                      placeholder="admin@school.com"
                      value={editForm.adminEmail}
                      onChange={(event) =>
                        setEditForm((current) =>
                          current
                            ? { ...current, adminEmail: event.target.value }
                            : current,
                        )
                      }
                      disabled={isSaving}
                    />
                  </div>

                  <div className="app-field-group">
                    <label
                      className="app-field-label"
                      htmlFor="edit-school-admin-mobile"
                    >
                      Admin Phone
                    </label>
                    <Input
                      id="edit-school-admin-mobile"
                      placeholder="e.g., 9876543210"
                      value={editForm.adminMobileNumber}
                      onChange={(event) =>
                        setEditForm((current) =>
                          current
                            ? {
                                ...current,
                                adminMobileNumber: event.target.value,
                              }
                            : current,
                        )
                      }
                      disabled={isSaving}
                    />
                  </div>

                  <div className="app-field-group">
                    <label
                      className="app-field-label"
                      htmlFor="edit-school-admin-password"
                    >
                      Admin Password
                    </label>
                    <Input
                      id="edit-school-admin-password"
                      type="password"
                      placeholder={
                        editForm.bootstrapAdminId
                          ? "Leave blank to keep the current password"
                          : "Required for the first school admin"
                      }
                      value={editForm.adminPassword}
                      onChange={(event) =>
                        setEditForm((current) =>
                          current
                            ? { ...current, adminPassword: event.target.value }
                            : current,
                        )
                      }
                      disabled={isSaving}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isSaving || isEditLoading}>
              Cancel
            </Button>
            <Button onClick={handleSaveSchool} disabled={isSaving || isEditLoading || !editForm}>
              {isSaving ? <Spinner /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
