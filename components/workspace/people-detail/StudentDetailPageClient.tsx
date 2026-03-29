"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentPasswordAdminPanel from "@/components/workspace/students/StudentPasswordAdminPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageLoadingState from "@/components/ui/page-loading-state";
import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import PageState from "@/components/ui/page-state";
import SectionState from "@/components/ui/section-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import {
  useBackNavigation,
  useCurrentPathWithSearch,
} from "@/hooks/useReturnNavigation";
import { useToast } from "@/components/ui/use-toast";
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";
import type { StudentPasswordAdminInfo } from "@/lib/user-credentials";

type ClassItem = {
  _id: string;
  name: string;
};

type AcademicSectionItem = {
  _id: string;
  name: string;
};

type UserItem = {
  _id: string;
  name: string;
  email?: string;
  mobileNumber?: string;
  role: string;
  class?: string;
  academicSection?: string;
  rollNumber?: string;
  enrolledAt?: string;
  createdAt?: string;
  updatedAt?: string;
  studentPasswordInfo?: StudentPasswordAdminInfo;
};

type AttemptItem = {
  _id: string;
  paper?: {
    _id: string;
    title?: string;
    subject?: { name?: string } | string;
    class?: { name?: string } | string;
  };
  student?: string;
  startedAt?: string;
  submittedAt?: string;
  totalMarksAwarded?: number;
  sectionAnswers?: Array<{
    sectionName: string;
    answers: Array<{ marksAwarded?: number }>;
  }>;
};

type StudentDetailPageClientProps = {
  studentId: string;
  initialUser: UserItem | null;
  initialClasses: ClassItem[];
  initialSections: AcademicSectionItem[];
  initialAttempts: AttemptItem[];
  initialLoadError?: string | null;
};

export default function StudentDetailPageClient({
  studentId,
  initialUser,
  initialClasses,
  initialSections,
  initialAttempts,
  initialLoadError = null,
}: StudentDetailPageClientProps) {
  const { navigateBack } = useBackNavigation("/workspace/students");
  const currentPath = useCurrentPathWithSearch("/workspace/students");
  const editHref = buildHrefWithReturnTo(
    `/workspace/students/edit/${studentId}`,
    currentPath,
  );

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(initialLoadError);
  const [user, setUser] = useState<UserItem | null>(initialUser);
  const [classes, setClasses] = useState<ClassItem[]>(initialClasses);
  const [sections, setSections] = useState<AcademicSectionItem[]>(initialSections);
  const [attempts, setAttempts] = useState<AttemptItem[]>(initialAttempts);
  const [attemptsError, setAttemptsError] = useState<string | null>(
    initialLoadError ? "Failed to load attempts." : null,
  );
  const [sendingResponseId, setSendingResponseId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [reloadToken, setReloadToken] = useState(0);
  const { toast } = useToast();

  const retryLoad = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    if (reloadToken === 0) {
      return;
    }

    let mounted = true;

    async function load() {
      try {
        const schoolKey = resolveClientSchoolKey();
        if (!schoolKey) {
          throw new Error(
            "Please select a school in the navbar to view student details.",
          );
        }

        if (user) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const [userResult, classesResult, sectionsResult, attemptsResult] =
          await Promise.allSettled([
            fetchApiJson<any>(`/api/users/${studentId}`, {
              cache: "no-store",
              schoolKey,
              fallbackMessage: "Failed to load user.",
            }),
            fetchApiJson<any>("/api/classes", {
              cache: "no-store",
              schoolKey,
              fallbackMessage: "Failed to load classes.",
            }),
            fetchApiJson<any>("/api/sections", {
              cache: "no-store",
              schoolKey,
              fallbackMessage: "Failed to load sections.",
            }),
            fetchApiJson<any>(
              `/api/question-paper-response?student=${encodeURIComponent(studentId)}`,
              {
                cache: "no-store",
                schoolKey,
                fallbackMessage: "Failed to load attempts.",
              },
            ),
          ]);

        if (!mounted) return;

        if (userResult.status !== "fulfilled") {
          throw userResult.reason;
        }
        if (classesResult.status !== "fulfilled") {
          throw classesResult.reason;
        }
        if (sectionsResult.status !== "fulfilled") {
          throw sectionsResult.reason;
        }

        setUser(userResult.value.user || null);
        setClasses(
          Array.isArray(classesResult.value.classes)
            ? classesResult.value.classes
            : [],
        );
        setSections(
          Array.isArray(sectionsResult.value.sections)
            ? sectionsResult.value.sections
            : [],
        );

        if (attemptsResult.status === "fulfilled") {
          setAttempts(
            Array.isArray(attemptsResult.value.responses)
              ? attemptsResult.value.responses
              : [],
          );
          setAttemptsError(null);
        } else {
          setAttempts([]);
          setAttemptsError(
            attemptsResult.reason?.message || "Failed to load attempts",
          );
        }
      } catch (loadError: any) {
        setError(loadError.message || "Failed to load");
        setAttemptsError(loadError.message || "Failed to load attempts");
      } finally {
        if (mounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [reloadToken, studentId, user]);

  const className = user?.class
    ? classes.find((classItem) => classItem._id === String(user.class))?.name ||
      String(user.class)
    : "-";
  const academicSectionName = user?.academicSection
    ? sections.find((section) => section._id === String(user.academicSection))
        ?.name || String(user.academicSection)
    : "-";

  const totalAttempts = attempts.length;
  const maxPage = Math.max(1, Math.ceil(totalAttempts / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return attempts.slice(start, start + pageSize);
  }, [attempts, page]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, maxPage));
  }, [maxPage]);

  const changePage = (dir: 1 | -1) => {
    setPage((prev) => Math.min(maxPage, Math.max(1, prev + dir)));
  };

  const calcScore = (attempt: AttemptItem) => {
    if (typeof attempt.totalMarksAwarded === "number") return attempt.totalMarksAwarded;
    let sum = 0;
    attempt.sectionAnswers?.forEach((section) =>
      section.answers.forEach((answer) => {
        sum += answer.marksAwarded || 0;
      }),
    );
    return sum;
  };

  const formatDuration = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const parts: string[] = [];
    if (h) parts.push(h + "h");
    if (m) parts.push(m + "m");
    if (!h && !m) parts.push(s + "s");
    return parts.join(" ");
  };

  const handleSendStudentReport = async (responseId: string) => {
    try {
      setSendingResponseId(responseId);
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error("Please select a school in the navbar first.");
      }

      const data = await fetchApiJson<any>(
        `/api/reports/send/student/${responseId}`,
        {
          method: "POST",
          schoolKey,
          fallbackMessage: "Failed to send report",
        },
      );

      if (data.queued) {
        const queuedMsg =
          data.message || "Report queued for background processing.";
        const failureMsg = data?.lastFailure?.error
          ? ` Last delivery failure: ${data.lastFailure.error}`
          : "";
        toast({
          title: "Parent report queued",
          description: `${queuedMsg} Current status: ${
            data.deliveryStatus || "queued"
          }.${failureMsg}`,
        });
      } else {
        toast({
          title: "Parent report requested",
          description: data.message || "Request accepted.",
        });
      }
    } catch (sendError: any) {
      toast({
        title: "Failed to send report",
        description: sendError?.message || "Failed to send report.",
        variant: "destructive",
      });
    } finally {
      setSendingResponseId(null);
    }
  };

  if (loading && !user) {
    return (
      <PageLoadingState
        title="Loading student details"
        description="Preparing the student profile, class section, and response summary."
        width="wide"
        dense
      />
    );
  }

  return (
    <PageShell width="wide">
      <PageHero
        variant="editor"
        eyebrow="People"
        title={user?.name || "Student Details"}
        description="Review student profile information, class placement, credentials context, and all recorded paper attempts from one page."
        actions={
          user ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="app-button-back"
                onClick={navigateBack}
              >
                Back to Students
              </Button>
              <AppPrefetchLink
                href={editHref}
                relatedApiPrefetches={[
                  `/api/users/${studentId}`,
                  "/api/classes",
                  "/api/sections",
                ]}
              >
                <Button className="app-button-page">Edit Student</Button>
              </AppPrefetchLink>
            </div>
          ) : (
            <Button
              variant="outline"
              className="app-button-back"
              onClick={navigateBack}
            >
              Back to Students
            </Button>
          )
        }
        meta={
          <>
            <span className="app-meta-chip">Student account</span>
            <span className="app-meta-chip">
              {user?.rollNumber
                ? `Username: ${user.rollNumber}`
                : "Roll number pending"}
            </span>
            {attemptsError ? (
              <span className="app-meta-chip">Attempts need retry</span>
            ) : null}
            {refreshing ? <span className="app-meta-chip">Refreshing...</span> : null}
          </>
        }
        stats={[
          {
            label: "Class",
            value: loading ? "—" : className,
            meta: "Current class placement for eligibility and reporting.",
          },
          {
            label: "Section",
            value: loading ? "—" : academicSectionName,
            meta: "Current section placement for paper targeting.",
          },
          {
            label: "Attempts",
            value: loading ? "—" : String(totalAttempts),
            meta: "All recorded paper responses for this student.",
          },
          {
            label: "Profile state",
            value: loading
              ? "Loading"
              : error
                ? "Needs review"
                : attemptsError
                  ? "Partial data"
                  : "Ready",
            meta: error
              ? "Student details could not be loaded cleanly."
              : attemptsError
                ? "Profile loaded, but attempt history needs another try."
                : "Student profile and attempts loaded successfully.",
          },
        ]}
      />

      {error && user ? <FeedbackNotice variant="info">{error}</FeedbackNotice> : null}

      {error && !user ? (
        <PageState
          variant="error"
          title="Could not load student details"
          description={error}
          action={
            <>
              <Button
                type="button"
                variant="outline"
                className="app-button-back"
                onClick={navigateBack}
              >
                Back to Students
              </Button>
              <Button
                type="button"
                className="app-button-filter"
                onClick={retryLoad}
              >
                Try Again
              </Button>
            </>
          }
        />
      ) : !user ? (
        <PageState
          title="Student not found"
          description="We could not find a student record for this request."
          action={
            <Button
              type="button"
              variant="outline"
              className="app-button-back"
              onClick={navigateBack}
            >
              Back to Students
            </Button>
          }
        />
      ) : (
        <>
          <Card className="app-surface">
            <CardHeader className="app-section-header">
              <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-xl font-semibold tracking-tight">
                <span>{user.name}</span>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {user.role}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <div className="app-detail-grid">
                <div className="app-detail-item">
                  <div className="app-detail-label">Email</div>
                  <div className="app-detail-value">{user.email || "-"}</div>
                </div>
                <div className="app-detail-item">
                  <div className="app-detail-label">Parent Mobile Number</div>
                  <div className="app-detail-value">
                    {user.mobileNumber || "-"}
                  </div>
                </div>
                <div className="app-detail-item">
                  <div className="app-detail-label">Class</div>
                  <div className="app-detail-value">{className}</div>
                </div>
                <div className="app-detail-item">
                  <div className="app-detail-label">Section</div>
                  <div className="app-detail-value">{academicSectionName}</div>
                </div>
                <div className="app-detail-item">
                  <div className="app-detail-label">Roll Number</div>
                  <div className="app-detail-value">{user.rollNumber || "-"}</div>
                </div>
                <div className="app-detail-item">
                  <div className="app-detail-label">Enrolled At</div>
                  <div className="app-detail-value">
                    {user.enrolledAt
                      ? new Date(user.enrolledAt).toLocaleDateString()
                      : "-"}
                  </div>
                </div>
                <div className="app-detail-item">
                  <div className="app-detail-label">Created</div>
                  <div className="app-detail-value">
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleString()
                      : "-"}
                  </div>
                </div>
                <div className="app-detail-item">
                  <div className="app-detail-label">Updated</div>
                  <div className="app-detail-value">
                    {user.updatedAt
                      ? new Date(user.updatedAt).toLocaleString()
                      : "-"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <StudentPasswordAdminPanel
            studentId={studentId}
            initialInfo={user.studentPasswordInfo}
          />

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <CardTitle>Attempts ({totalAttempts})</CardTitle>
                  <p className="text-sm leading-6 text-muted-foreground">
                    View submission history, jump to analytics, open the source
                    paper, or trigger parent-report delivery from the same
                    table.
                  </p>
                </div>
                <div className="app-chip-cloud">
                  <span className="app-meta-chip">
                    Page {page} of {maxPage}
                  </span>
                  <span className="app-meta-chip">
                    {attemptsError ? "Attempt load issue" : "Attempt history ready"}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="app-section-body">
              {attemptsError ? (
                <SectionState
                  variant="error"
                  title="Attempt history needs attention"
                  description={attemptsError}
                />
              ) : totalAttempts === 0 ? (
                <SectionState
                  title="No attempts yet"
                  description="This student has not submitted any paper attempts yet."
                />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          Attempt navigation
                        </p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          Use pagination to move through the student&apos;s full
                          recorded attempt history.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="app-button-compact"
                          onClick={() => changePage(-1)}
                          disabled={page <= 1}
                        >
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="app-button-compact"
                          onClick={() => changePage(1)}
                          disabled={page >= maxPage}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="app-table-wrap">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Paper</TableHead>
                          <TableHead>Subject</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Attempted</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Questions</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead className="w-[360px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageItems.map((attempt) => {
                          const paperId = (attempt.paper as any)?._id || "";
                          const paperTitle = (attempt.paper as any)?.title || "-";
                          const subjectName =
                            typeof (attempt.paper as any)?.subject === "object"
                              ? (attempt.paper as any)?.subject?.name || "-"
                              : (attempt.paper as any)?.subject || "-";
                          const currentClassName =
                            typeof (attempt.paper as any)?.class === "object"
                              ? (attempt.paper as any)?.class?.name || "-"
                              : (attempt.paper as any)?.class || "-";
                          const started = attempt.startedAt
                            ? new Date(attempt.startedAt).toLocaleString()
                            : "-";
                          const submitted = attempt.submittedAt
                            ? new Date(attempt.submittedAt).toLocaleString()
                            : "-";
                          const score = calcScore(attempt);
                          return (
                            <TableRow key={attempt._id}>
                              <TableCell className="font-medium">
                                {paperTitle}
                              </TableCell>
                              <TableCell>{subjectName}</TableCell>
                              <TableCell>{currentClassName}</TableCell>
                              <TableCell>{started}</TableCell>
                              <TableCell>{submitted}</TableCell>
                              <TableCell>
                                {attempt.submittedAt ? "Submitted" : "In progress"}
                              </TableCell>
                              <TableCell>
                                {attempt.startedAt && attempt.submittedAt
                                  ? formatDuration(
                                      new Date(attempt.submittedAt).getTime() -
                                        new Date(attempt.startedAt).getTime(),
                                    )
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {Array.isArray(attempt.sectionAnswers)
                                  ? attempt.sectionAnswers.reduce(
                                      (sum, section) =>
                                        sum + (section.answers?.length || 0),
                                      0,
                                    )
                                  : 0}
                              </TableCell>
                              <TableCell>{score}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap items-center gap-2">
                                  <AppPrefetchLink
                                    href={buildHrefWithReturnTo(
                                      `/workspace/analytics/student-tag-report/${attempt._id}`,
                                      currentPath,
                                    )}
                                    relatedApiPrefetches={[
                                      `/api/analytics/student-tag-report/${attempt._id}?groupFields=1`,
                                    ]}
                                  >
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="app-button-compact"
                                    >
                                      Student Report
                                    </Button>
                                  </AppPrefetchLink>
                                  <AppPrefetchLink
                                    href={buildHrefWithReturnTo(
                                      `/workspace/analytics/class-tag-report/${paperId}`,
                                      currentPath,
                                    )}
                                    relatedApiPrefetches={[
                                      `/api/analytics/class-tag-report/${paperId}?groupFields=1`,
                                    ]}
                                  >
                                    <Button
                                      size="sm"
                                      className="app-button-compact"
                                    >
                                      Class Report
                                    </Button>
                                  </AppPrefetchLink>
                                  <AppPrefetchLink
                                    href={buildHrefWithReturnTo(
                                      `/workspace/question-papers/view/${paperId}`,
                                      currentPath,
                                    )}
                                  >
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="app-button-compact"
                                    >
                                      View Paper
                                    </Button>
                                  </AppPrefetchLink>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="app-button-compact app-button-compact-success"
                                    onClick={() =>
                                      handleSendStudentReport(attempt._id)
                                    }
                                    disabled={sendingResponseId === attempt._id}
                                  >
                                    <MessageCircle className="mr-1 h-4 w-4" />
                                    {sendingResponseId === attempt._id
                                      ? "Sending…"
                                      : "Send Parent Report"}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}
