"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageLoadingState from "@/components/ui/page-loading-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MessageCircle } from "lucide-react";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import { useBackNavigation, useCurrentPathWithSearch } from "@/hooks/useReturnNavigation";
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";

interface ClassItem {
  _id: string;
  name: string;
}

interface AcademicSectionItem {
  _id: string;
  name: string;
}

interface UserItem {
  _id: string;
  name: string;
  email?: string;
  role: string;
  class?: string;
  academicSection?: string;
  rollNumber?: string;
  enrolledAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AttemptItem {
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
}

export default function StudentDetailPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const { navigateBack } = useBackNavigation("/students");
  const currentPath = useCurrentPathWithSearch("/students");
  const editHref = buildHrefWithReturnTo(`/students/edit/${id}`, currentPath);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserItem | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<AcademicSectionItem[]>([]);

  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);
  const [sendingResponseId, setSendingResponseId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const schoolKey = resolveClientSchoolKey();
        if (!schoolKey) {
          throw new Error("Please select a school in the navbar to view student details.");
        }

        const [userResult, classesResult, sectionsResult, attemptsResult] =
          await Promise.allSettled([
            fetchApiJson<any>(`/api/users/${id}`, {
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
              `/api/question-paper-response?student=${encodeURIComponent(id)}`,
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
        setClasses(Array.isArray(classesResult.value.classes) ? classesResult.value.classes : []);
        setSections(Array.isArray(sectionsResult.value.sections) ? sectionsResult.value.sections : []);

        if (attemptsResult.status === "fulfilled") {
          setAttempts(Array.isArray(attemptsResult.value.responses) ? attemptsResult.value.responses : []);
          setAttemptsError(null);
        } else {
          setAttempts([]);
          setAttemptsError(attemptsResult.reason?.message || "Failed to load attempts");
        }
      } catch (e: any) {
        setError(e.message || "Failed to load");
        setAttemptsError(e.message || "Failed to load attempts");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (id) load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const className = user?.class
    ? classes.find((classItem) => classItem._id === String(user.class))?.name || String(user.class)
    : "-";
  const academicSectionName = user?.academicSection
    ? sections.find((section) => section._id === String(user.academicSection))?.name || String(user.academicSection)
    : "-";

  const totalAttempts = attempts.length;
  const maxPage = Math.max(1, Math.ceil(totalAttempts / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return attempts.slice(start, start + pageSize);
  }, [attempts, page]);

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

      const data = await fetchApiJson<any>(`/api/reports/send/student/${responseId}`, {
        method: "POST",
        schoolKey,
        fallbackMessage: "Failed to send report",
      });

      if (data.queued) {
        const queuedMsg = data.message || "Report queued for background processing.";
        const failureMsg = data?.lastFailure?.error
          ? `\n\nLast delivery failure: ${data.lastFailure.error}`
          : "";
        alert(`${queuedMsg}\nCurrent status: ${data.deliveryStatus || "queued"}.${failureMsg}`);
      } else {
        alert(data.message || "Request accepted.");
      }
    } catch (error: any) {
      alert(error?.message || "Failed to send report");
    } finally {
      setSendingResponseId(null);
    }
  };

  return (
    <div className="container py-6 space-y-6">
      <div className="app-page-header-row">
        <div className="app-page-header">
          <h1 className="app-page-title">Student Details</h1>
          <p className="app-page-subtitle">
            View student profile information, enrollment data, and exam attempts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={navigateBack}>Back to Students</Button>
          <Link href={editHref}>
            <Button>Edit</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <PageLoadingState
          title="Loading student details"
          description="Preparing the student profile, class section, and response summary."
          className="px-0 py-0"
          contentClassName="max-w-none"
          dense
        />
      ) : error ? (
        <div className="app-feedback app-feedback-error">{error}</div>
      ) : !user ? (
        <div className="app-empty-state">User not found.</div>
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
                    {user.enrolledAt ? new Date(user.enrolledAt).toLocaleDateString() : "-"}
                  </div>
                </div>
                <div className="app-detail-item">
                  <div className="app-detail-label">Created</div>
                  <div className="app-detail-value">
                    {user.createdAt ? new Date(user.createdAt).toLocaleString() : "-"}
                  </div>
                </div>
                <div className="app-detail-item">
                  <div className="app-detail-label">Updated</div>
                  <div className="app-detail-value">
                    {user.updatedAt ? new Date(user.updatedAt).toLocaleString() : "-"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle className="flex flex-col gap-3 text-xl font-semibold tracking-tight lg:flex-row lg:items-center lg:justify-between">
                <span>Attempts ({totalAttempts})</span>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Page {page} of {maxPage}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => changePage(-1)} disabled={page <= 1}>
                    Prev
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => changePage(1)} disabled={page >= maxPage}>
                    Next
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              {attemptsError ? (
                <div className="app-feedback app-feedback-error">{attemptsError}</div>
              ) : totalAttempts === 0 ? (
                <div className="app-empty-state">No attempts found.</div>
              ) : (
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
                            <TableCell className="font-medium">{paperTitle}</TableCell>
                            <TableCell>{subjectName}</TableCell>
                            <TableCell>{currentClassName}</TableCell>
                            <TableCell>{started}</TableCell>
                            <TableCell>{submitted}</TableCell>
                            <TableCell>{attempt.submittedAt ? "Submitted" : "In progress"}</TableCell>
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
                                    (sum, section) => sum + (section.answers?.length || 0),
                                    0,
                                  )
                                : 0}
                            </TableCell>
                            <TableCell>{score}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-2">
                                <Link href={buildHrefWithReturnTo(`/analytics/student-tag-report/${attempt._id}`, currentPath)}>
                                  <Button variant="outline" size="sm">
                                    Student Report
                                  </Button>
                                </Link>
                                <Link href={buildHrefWithReturnTo(`/analytics/class-tag-report/${paperId}`, currentPath)} prefetch={false}>
                                  <Button size="sm">Class Report</Button>
                                </Link>
                                <Link href={buildHrefWithReturnTo(`/question-papers/view/${paperId}`, currentPath)}>
                                  <Button variant="outline" size="sm">
                                    View Paper
                                  </Button>
                                </Link>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSendStudentReport(attempt._id)}
                                  disabled={sendingResponseId === attempt._id}
                                  className="border-green-300 text-green-700"
                                >
                                  <MessageCircle className="mr-1 h-4 w-4" />
                                  {sendingResponseId === attempt._id ? "Sending…" : "Send Parent Report"}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
