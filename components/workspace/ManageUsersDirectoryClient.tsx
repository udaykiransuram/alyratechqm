"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
} from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FeedbackNotice from "@/components/ui/feedback-notice";
import SectionState from "@/components/ui/section-state";
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
import { useToast } from "@/components/ui/use-toast";
import {
  fetchApiJson,
  resolveClientSchoolKey,
} from "@/lib/client/api";
import { useReturnHrefBuilder } from "@/hooks/useReturnNavigation";

type ManagedUser = {
  _id: string;
  name: string;
  email?: string;
  role: "admin" | "teacher" | "student";
  mobileNumber?: string;
  class?: string;
  academicSection?: string;
  rollNumber?: string;
  classIds?: string[];
  academicSectionIds?: string[];
  hasAllClasses?: boolean;
  hasAllSections?: boolean;
};

type ClassItem = {
  _id: string;
  name: string;
};

type AcademicSectionItem = {
  _id: string;
  name: string;
  class?: { _id: string; name: string } | string;
};

type ManageUsersDirectoryClientProps = {
  initialUsers: ManagedUser[];
  initialClasses: ClassItem[];
  initialSections: AcademicSectionItem[];
  initialSchoolKey: string;
  initialTotal: number;
  initialPage: number;
  initialPages: number;
  initialListError?: string | null;
  initialSupportDataNotice?: string | null;
};

const NO_SCHOOL_USERS_MESSAGE = "Select a school to load users.";

function getRoleBadgeVariant(role: ManagedUser["role"]) {
  if (role === "student") return "success";
  if (role === "teacher") return "warning";
  return "default";
}

function getRoleAccountLabel(role: ManagedUser["role"]) {
  if (role === "student") return "Student account";
  if (role === "teacher") return "Teacher account";
  return "Admin account";
}

function getUserDetailPath(user: ManagedUser) {
  if (user.role === "student") {
    return `/workspace/students/${user._id}`;
  }

  if (user.role === "teacher") {
    return `/workspace/teachers/${user._id}`;
  }

  return `/workspace/admins/${user._id}`;
}

function getUserEditPath(user: ManagedUser) {
  if (user.role === "student") {
    return `/workspace/students/edit/${user._id}`;
  }

  if (user.role === "teacher") {
    return `/workspace/teachers/edit/${user._id}`;
  }

  return `/workspace/admins/edit/${user._id}`;
}

export default function ManageUsersDirectoryClient({
  initialUsers,
  initialClasses,
  initialSections,
  initialSchoolKey,
  initialTotal,
  initialPage,
  initialPages,
  initialListError = null,
  initialSupportDataNotice = null,
}: ManageUsersDirectoryClientProps) {
  const { toast } = useToast();
  const { buildReturnHref } = useReturnHrefBuilder("/workspace/manage/users");

  const [users, setUsers] = useState<ManagedUser[]>(initialUsers);
  const [classes, setClasses] = useState<ClassItem[]>(initialClasses);
  const [sections, setSections] = useState<AcademicSectionItem[]>(initialSections);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(initialListError);
  const [supportDataNotice, setSupportDataNotice] = useState<string | null>(
    initialSupportDataNotice,
  );
  const [currentSchoolKey, setCurrentSchoolKey] = useState(initialSchoolKey);
  const [archivingUserId, setArchivingUserId] = useState<string | null>(null);

  const [page, setPage] = useState(initialPage);
  const [pages, setPages] = useState(initialPages);
  const [total, setTotal] = useState(initialTotal);
  const limit = 100;

  const loadUsers = async (
    pageNum = 1,
    options?: { silent?: boolean },
  ) => {
    const silent = options?.silent === true;

    try {
      if (!silent) {
        setIsLoading(true);
        setListError(null);
      }

      const schoolKey = resolveClientSchoolKey() || initialSchoolKey;
      setCurrentSchoolKey(schoolKey);

      if (!schoolKey) {
        setUsers([]);
        setTotal(0);
        setPages(1);
        setPage(1);
        setListError(NO_SCHOOL_USERS_MESSAGE);
        return;
      }

      const data = await fetchApiJson<any>(`/api/users?limit=${limit}&page=${pageNum}`, {
        cache: "no-store",
        schoolKey,
        fallbackMessage: "We couldn't load users.",
      });

      setUsers(Array.isArray(data.users) ? data.users : []);
      setTotal(Number(data.total) || 0);
      setPages(Math.max(1, Number(data.pages) || 1));
      setPage(Math.max(1, Number(data.page) || pageNum));
    } catch (error: any) {
      const message = error?.message || "We couldn't load users.";
      setUsers([]);
      setTotal(0);
      setPages(1);
      setPage(1);
      setListError(message);

      if (!silent) {
        toast({
          title: "Couldn't load users",
          description: message,
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    setUsers(initialUsers);
    setClasses(initialClasses);
    setSections(initialSections);
    setCurrentSchoolKey(initialSchoolKey);
    setTotal(initialTotal);
    setPage(initialPage);
    setPages(initialPages);
    setListError(initialListError);
    setSupportDataNotice(initialSupportDataNotice);
    setIsLoading(false);
  }, [
    initialClasses,
    initialListError,
    initialPage,
    initialPages,
    initialSchoolKey,
    initialSections,
    initialSupportDataNotice,
    initialTotal,
    initialUsers,
  ]);

  const roleCounts = useMemo(() => {
    return users.reduce(
      (accumulator, user) => {
        accumulator[user.role] += 1;
        return accumulator;
      },
      { admin: 0, teacher: 0, student: 0 },
    );
  }, [users]);

  const getScopeSummary = (user: ManagedUser) => {
    if (user.role === "student") {
      const className =
        classes.find((item) => item._id === user.class)?.name || user.class || "—";
      const sectionName =
        sections.find((item) => item._id === user.academicSection)?.name ||
        undefined;

      return sectionName ? `${className} • ${sectionName}` : className;
    }

    const classLabel =
      user.role === "admin" && user.hasAllClasses
        ? "All classes"
        : `${(user.classIds || []).length} class${(user.classIds || []).length === 1 ? "" : "es"}`;
    const sectionLabel =
      user.hasAllSections
        ? "all sections"
        : `${(user.academicSectionIds || []).length} section${(user.academicSectionIds || []).length === 1 ? "" : "s"}`;

    return `${classLabel} • ${sectionLabel}`;
  };

  const handleArchiveUser = async (userId: string) => {
    setArchivingUserId(userId);

    try {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error(NO_SCHOOL_USERS_MESSAGE);
      }

      await fetchApiJson(`/api/users/${userId}`, {
        method: "DELETE",
        schoolKey,
        fallbackMessage: "We couldn't archive this user.",
      });

      setUsers((currentUsers) => currentUsers.filter((user) => user._id !== userId));
      setTotal((currentTotal) => Math.max(0, currentTotal - 1));
      toast({
        title: "User archived",
        description: "The user has been archived.",
      });

      void loadUsers(page, { silent: true });
    } catch (error: any) {
      toast({
        title: "Couldn't archive user",
        description: error?.message || "We couldn't archive this user.",
        variant: "destructive",
      });
    } finally {
      setArchivingUserId((currentId) => (currentId === userId ? null : currentId));
    }
  };

  return (
    <PageShell width="wide" padding="standard" className="app-directory-stack">
      <PageHero
        variant="directory"
        density="compact"
        eyebrow="School Workspace"
        title="Manage Users"
        description="Browse every school user from one directory, then open the dedicated student, teacher, or admin flows when you need deeper edits."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild className="app-button-page">
              <AppPrefetchLink
                href="/workspace/manage/users/create"
                prefetchOnMount
                relatedApiPrefetches={[
                  "/api/classes",
                  "/api/sections",
                  "/api/subjects",
                ]}
              >
                Create Users
              </AppPrefetchLink>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="app-button-filter"
              onClick={() => void loadUsers(page)}
              disabled={isLoading}
            >
              {isLoading ? <Spinner /> : "Refresh"}
            </Button>
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">
              {currentSchoolKey ? `School: ${currentSchoolKey}` : "No school selected"}
            </span>
            <span className="app-meta-chip">Role-specific detail pages</span>
          </>
        }
        stats={[
          {
            label: "Total users",
            value: String(total),
            meta: "Users currently available in the active school.",
          },
          {
            label: "Admins on page",
            value: String(roleCounts.admin),
            meta: "Admin accounts shown in the current loaded page.",
          },
          {
            label: "Teachers on page",
            value: String(roleCounts.teacher),
            meta: "Teacher accounts shown in the current loaded page.",
          },
          {
            label: "Students on page",
            value: String(roleCounts.student),
            meta: "Student accounts shown in the current loaded page.",
          },
        ]}
      />

      <div className="app-directory-stack">
        {supportDataNotice ? (
          <FeedbackNotice variant="info">{supportDataNotice}</FeedbackNotice>
        ) : null}

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <CardTitle>User Directory</CardTitle>
              <div className="app-chip-cloud-tight">
                <span className="app-meta-chip">{`${roleCounts.admin} admins loaded`}</span>
                <span className="app-meta-chip">{`${roleCounts.teacher} teachers loaded`}</span>
                <span className="app-meta-chip">{`${roleCounts.student} students loaded`}</span>
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
            ) : listError ? (
              <SectionState
                variant={listError === NO_SCHOOL_USERS_MESSAGE ? "info" : "error"}
                title={
                  listError === NO_SCHOOL_USERS_MESSAGE
                    ? "No school selected"
                    : "User directory needs attention"
                }
                description={listError}
              />
            ) : users.length === 0 ? (
              <SectionState
              title="No users yet"
              description="Open the dedicated create page to add students, teachers, and admins one by one or in bulk."
              action={
                  <Button asChild className="app-button-page">
                    <AppPrefetchLink href="/workspace/manage/users/create">
                      Go to Create Users
                    </AppPrefetchLink>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                <div className="app-toolbar app-toolbar-compact">
                  <div className="app-toolbar-row">
                    <div className="app-toolbar-copy">
                      <p className="app-toolbar-title">
                        Total {total} users • Page {page} of {pages}
                      </p>
                    </div>
                    <div className="app-toolbar-actions">
                      <Button
                        variant="outline"
                        size="sm"
                        className="app-button-compact"
                        disabled={page <= 1 || Boolean(archivingUserId)}
                        onClick={() => void loadUsers(page - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="app-button-compact"
                        disabled={page >= pages || Boolean(archivingUserId)}
                        onClick={() => void loadUsers(page + 1)}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 md:hidden">
                  {users.map((user) => (
                    <article
                      key={`mobile-${user._id}`}
                      className="rounded-[1.05rem] border border-border/68 bg-background/90 px-3.5 py-3.5 shadow-sm"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {user.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {user.role === "student" && user.rollNumber
                                ? `Roll: ${user.rollNumber}`
                                : getRoleAccountLabel(user.role)}
                            </p>
                          </div>
                          <Badge
                            variant={getRoleBadgeVariant(user.role)}
                            className="capitalize"
                          >
                            {user.role}
                          </Badge>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg border border-border/55 bg-background/72 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                              Contact
                            </p>
                            <p className="mt-1 truncate text-sm text-foreground">
                              {user.email || "No email"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {user.mobileNumber || "No phone"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border/55 bg-background/72 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                              Scope
                            </p>
                            <p className="mt-1 text-sm text-foreground">
                              {getScopeSummary(user)}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="app-row-action-button app-row-action-button-accent w-full"
                          >
                            <AppPrefetchLink
                              href={buildReturnHref(getUserDetailPath(user))}
                              relatedApiPrefetches={[
                                `/api/users/${user._id}`,
                                "/api/classes",
                                "/api/sections",
                                "/api/subjects",
                              ]}
                              aria-label={`View ${user.name}`}
                              title={`View ${user.name}`}
                            >
                              <Eye className="h-4 w-4" />
                              View Profile
                            </AppPrefetchLink>
                          </Button>
                          <details className="group rounded-xl border border-border/60 bg-background/72 px-2.5 py-2">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                              More actions
                              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                            </summary>
                            <div className="mt-2 grid gap-2">
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="app-row-action-button w-full"
                              >
                                <AppPrefetchLink
                                  href={buildReturnHref(getUserEditPath(user))}
                                  relatedApiPrefetches={[
                                    `/api/users/${user._id}`,
                                    "/api/classes",
                                    "/api/sections",
                                    "/api/subjects",
                                  ]}
                                  aria-label={`Edit ${user.name}`}
                                  title={`Edit ${user.name}`}
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit Profile
                                </AppPrefetchLink>
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="app-row-action-button app-row-action-button-danger w-full"
                                    disabled={Boolean(archivingUserId)}
                                    aria-label={`Archive ${user.name}`}
                                    title={`Archive ${user.name}`}
                                  >
                                    {archivingUserId === user._id ? (
                                      <Spinner />
                                    ) : (
                                      <Archive className="h-4 w-4" />
                                    )}
                                    Archive User
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Archive user?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will archive the user
                                      <strong className="mx-1">{user.name}</strong>.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel disabled={Boolean(archivingUserId)}>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => void handleArchiveUser(user._id)}
                                      disabled={Boolean(archivingUserId)}
                                    >
                                      {archivingUserId === user._id ? <Spinner /> : "Archive"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </details>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden md:block app-table-wrap app-table-dense">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user._id}>
                          <TableCell>
                            <div className="app-table-cell-stack">
                              <div className="app-table-cell-title">{user.name}</div>
                              <div className="app-table-cell-note">
                                {user.role === "student" && user.rollNumber
                                  ? `Roll number login: ${user.rollNumber}`
                                  : getRoleAccountLabel(user.role)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="app-table-cell-stack">
                              <div className="app-table-cell-title">
                                {user.email || "No email"}
                              </div>
                              <div className="app-table-cell-note">
                                {user.mobileNumber || "No phone"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getRoleBadgeVariant(user.role)}
                              className="capitalize"
                            >
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="app-table-cell-stack">
                              <div className="app-table-cell-title">
                                {getScopeSummary(user)}
                              </div>
                              <div className="app-table-cell-note">
                                {user.role === "student"
                                  ? "Student placement"
                                  : "Academic access scope"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="app-row-action-group justify-end">
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="app-row-action-button"
                                aria-label={`View ${user.name}`}
                                title={`View ${user.name}`}
                              >
                                <AppPrefetchLink
                                  href={buildReturnHref(getUserDetailPath(user))}
                                  relatedApiPrefetches={[
                                    `/api/users/${user._id}`,
                                    "/api/classes",
                                    "/api/sections",
                                    "/api/subjects",
                                  ]}
                                >
                                  <Eye className="h-4 w-4" />
                                  View
                                </AppPrefetchLink>
                              </Button>
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="app-row-action-button app-row-action-button-accent"
                                aria-label={`Edit ${user.name}`}
                                title={`Edit ${user.name}`}
                              >
                                <AppPrefetchLink
                                  href={buildReturnHref(getUserEditPath(user))}
                                  relatedApiPrefetches={[
                                    `/api/users/${user._id}`,
                                    "/api/classes",
                                    "/api/sections",
                                    "/api/subjects",
                                  ]}
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit
                                </AppPrefetchLink>
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="app-row-action-button app-row-action-button-danger"
                                    disabled={Boolean(archivingUserId)}
                                    aria-label={`Archive ${user.name}`}
                                    title={`Archive ${user.name}`}
                                  >
                                    {archivingUserId === user._id ? (
                                      <Spinner />
                                    ) : (
                                      <Archive className="h-4 w-4" />
                                    )}
                                    Archive
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Archive user?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will archive the user
                                      <strong className="mx-1">{user.name}</strong>.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel disabled={Boolean(archivingUserId)}>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => void handleArchiveUser(user._id)}
                                      disabled={Boolean(archivingUserId)}
                                    >
                                      {archivingUserId === user._id ? <Spinner /> : "Archive"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
