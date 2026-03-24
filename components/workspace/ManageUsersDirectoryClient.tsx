"use client";

import { useEffect, useMemo, useState } from "react";

import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

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
  buildPartialLoadMessage,
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

const NO_SCHOOL_USERS_MESSAGE = "Select a school to load users.";

function getUserDetailPath(user: ManagedUser) {
  if (user.role === "student") {
    return `/workspace/students/${user._id}`;
  }

  if (user.role === "teacher") {
    return `/workspace/teachers/${user._id}`;
  }

  return `/workspace/admins/${user._id}`;
}

export default function ManageUsersDirectoryClient() {
  const { toast } = useToast();
  const { buildReturnHref } = useReturnHrefBuilder("/workspace/manage/users");

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<AcademicSectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [supportDataNotice, setSupportDataNotice] = useState<string | null>(null);
  const [currentSchoolKey, setCurrentSchoolKey] = useState("");
  const [archivingUserId, setArchivingUserId] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
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

      const schoolKey = resolveClientSchoolKey();
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
    const init = async () => {
      const schoolKey = resolveClientSchoolKey();
      setCurrentSchoolKey(schoolKey);

      if (!schoolKey) {
        setSupportDataNotice("Select a school to load class and section details.");
        await loadUsers(1);
        return;
      }

      const [classesResult, sectionsResult] = await Promise.allSettled([
        fetchApiJson<any>("/api/classes", {
          cache: "no-store",
          schoolKey,
          fallbackMessage: "We couldn't load classes.",
        }),
        fetchApiJson<any>("/api/sections", {
          cache: "no-store",
          schoolKey,
          fallbackMessage: "We couldn't load sections.",
        }),
      ]);

      if (classesResult.status === "fulfilled") {
        setClasses(Array.isArray(classesResult.value.classes) ? classesResult.value.classes : []);
      }

      if (sectionsResult.status === "fulfilled") {
        setSections(Array.isArray(sectionsResult.value.sections) ? sectionsResult.value.sections : []);
      }

      setSupportDataNotice(
        buildPartialLoadMessage([
          ...(classesResult.status === "rejected" ? ["Class labels"] : []),
          ...(sectionsResult.status === "rejected" ? ["Section labels"] : []),
        ]),
      );

      await loadUsers(1);
    };

    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <PageShell width="wide" padding="relaxed">
      <PageHero
        eyebrow="School Workspace"
        title="User Management"
        description="Browse every school user from one directory, then open the dedicated student, teacher, or admin flows when you need deeper edits."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
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
            <span className="app-meta-chip">Create flow split out</span>
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

      <div className="space-y-6">
        {supportDataNotice ? (
          <FeedbackNotice variant="info">{supportDataNotice}</FeedbackNotice>
        ) : null}

        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <CardTitle>User Directory</CardTitle>
                <p className="text-sm leading-6 text-muted-foreground">
                  Open the dedicated detail flow for full edits, or archive accounts directly from this directory.
                </p>
              </div>
              <div className="app-chip-cloud">
                <span className="app-meta-chip">Dedicated create page</span>
                <span className="app-meta-chip">Dedicated role detail flows</span>
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
                  <Button asChild>
                    <AppPrefetchLink href="/workspace/manage/users/create">
                      Go to Create Users
                    </AppPrefetchLink>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                <div className="app-toolbar">
                  <div className="app-toolbar-row">
                    <div className="app-toolbar-copy">
                      <p className="app-toolbar-title">Loaded users</p>
                      <p className="app-toolbar-note">
                        Total {total} users. Page {page} of {pages}.
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

                <div className="app-table-wrap">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user._id}>
                          <TableCell className="font-medium">
                            <div className="space-y-1">
                              <div>{user.name}</div>
                              {user.role === "student" && user.rollNumber ? (
                                <div className="text-xs text-muted-foreground">
                                  Username: {user.rollNumber}
                                </div>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{user.email || "—"}</TableCell>
                          <TableCell>{user.mobileNumber || "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={user.role === "admin" ? "default" : "secondary"}
                              className="capitalize"
                            >
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {getScopeSummary(user)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button asChild variant="outline" size="sm" className="app-button-compact">
                                <AppPrefetchLink
                                  href={buildReturnHref(getUserDetailPath(user))}
                                  relatedApiPrefetches={[
                                    `/api/users/${user._id}`,
                                    "/api/classes",
                                    "/api/sections",
                                    "/api/subjects",
                                  ]}
                                >
                                  Open
                                </AppPrefetchLink>
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="app-button-compact"
                                    disabled={Boolean(archivingUserId)}
                                  >
                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
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
