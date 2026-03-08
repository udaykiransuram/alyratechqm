"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface ClassItem {
  _id: string;
  name: string;
}
interface UserItem {
  _id: string;
  name: string;
  email?: string;
  role: string;
  class?: string;
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserItem | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // Attempts state
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);
  const [sendingResponseId, setSendingResponseId] = useState<string | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [uRes, cRes, aRes] = await Promise.all([
          fetch("/api/users/" + id),
          fetch("/api/classes"),
          fetch("/api/question-paper-response?student=" + id),
        ]);
        const uJson = await uRes.json();
        const cJson = await cRes.json();
        const aJson = await aRes.json();
        if (!mounted) return;
        if (!uJson.success)
          throw new Error(uJson.message || "Failed to load user");
        if (!cJson.success)
          throw new Error(cJson.message || "Failed to load classes");
        if (!aJson.success)
          throw new Error(aJson.message || "Failed to load attempts");
        setUser(uJson.user);
        setClasses(cJson.classes || []);
        setAttempts(aJson.responses || []);
        setAttemptsError(null);
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
    ? classes.find((c) => c._id === String(user.class))?.name ||
      (user.class as string)
    : "-";

  // Pagination helpers for attempts
  const totalAttempts = attempts.length;
  const maxPage = Math.max(1, Math.ceil(totalAttempts / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return attempts.slice(start, start + pageSize);
  }, [attempts, page]);

  const changePage = (dir: 1 | -1) => {
    setPage((prev) => Math.min(maxPage, Math.max(1, prev + dir)));
  };

  // Score calculator (client-side fallback)
  const calcScore = (a: AttemptItem) => {
    if (typeof a.totalMarksAwarded === "number") return a.totalMarksAwarded;
    let sum = 0;
    a.sectionAnswers?.forEach((sec) =>
      sec.answers.forEach((ans) => {
        sum += ans.marksAwarded || 0;
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

  const getSchoolKeyFromCookie = () => {
    const m = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  };

  const handleSendStudentReport = async (responseId: string) => {
    try {
      setSendingResponseId(responseId);
      const schoolKey = getSchoolKeyFromCookie();
      const res = await fetch(
        `/api/reports/send/student/${responseId}` +
          (schoolKey ? `?school=${encodeURIComponent(schoolKey)}` : ""),
        {
          method: "POST",
          headers: schoolKey ? { "x-school-key": schoolKey } : {},
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.message || "Failed to send report");
        return;
      }

      // This endpoint queues background delivery; it does not guarantee immediate send.
      if (data.queued) {
        const queuedMsg =
          data.message || "Report queued for background processing.";
        const failureMsg = data?.lastFailure?.error
          ? `\n\nLast delivery failure: ${data.lastFailure.error}`
          : "";
        alert(
          `${queuedMsg}\nCurrent status: ${data.deliveryStatus || "queued"}.${failureMsg}`,
        );
      } else {
        alert(data.message || "Request accepted.");
      }
    } catch {
      alert("Failed to send report");
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
          <Link href="/students">
            <Button variant="outline">Back to Students</Button>
          </Link>
          <Link href={"/students/edit/" + id}>
            <Button>Edit</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="app-empty-state">Loading student details...</div>
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

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between text-xl font-semibold tracking-tight">
                <span>Attempts ({totalAttempts})</span>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Page {page} of {maxPage}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changePage(-1)}
                    disabled={page <= 1}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changePage(1)}
                    disabled={page >= maxPage}
                  >
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
                      {pageItems.map((a) => {
                        const paperId = (a.paper as any)?._id || "";
                        const paperTitle = (a.paper as any)?.title || "-";
                        const subjectName =
                          typeof (a.paper as any)?.subject === "object"
                            ? (a.paper as any)?.subject?.name || "-"
                            : (a.paper as any)?.subject || "-";
                        const currentClassName =
                          typeof (a.paper as any)?.class === "object"
                            ? (a.paper as any)?.class?.name || "-"
                            : (a.paper as any)?.class || "-";
                        const started = a.startedAt
                          ? new Date(a.startedAt).toLocaleString()
                          : "-";
                        const submitted = a.submittedAt
                          ? new Date(a.submittedAt).toLocaleString()
                          : "-";
                        const score = calcScore(a);
                        return (
                          <TableRow key={a._id}>
                            <TableCell className="font-medium">{paperTitle}</TableCell>
                            <TableCell>{subjectName}</TableCell>
                            <TableCell>{currentClassName}</TableCell>
                            <TableCell>{started}</TableCell>
                            <TableCell>{submitted}</TableCell>
                            <TableCell>
                              {a.submittedAt ? "Submitted" : "In progress"}
                            </TableCell>
                            <TableCell>
                              {a.startedAt && a.submittedAt
                                ? formatDuration(
                                    new Date(a.submittedAt).getTime() -
                                      new Date(a.startedAt).getTime(),
                                  )
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {Array.isArray(a.sectionAnswers)
                                ? a.sectionAnswers.reduce(
                                    (sum, sec) => sum + (sec.answers?.length || 0),
                                    0,
                                  )
                                : 0}
                            </TableCell>
                            <TableCell>{score}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-2">
                                <Link href={"/analytics/student-tag-report/" + a._id}>
                                  <Button variant="outline" size="sm">
                                    Student Report
                                  </Button>
                                </Link>
                                <Link
                                  href={"/analytics/class-tag-report/" + paperId}
                                  prefetch={false}
                                >
                                  <Button size="sm">Class Report</Button>
                                </Link>
                                <Link href={"/question-paper/view/" + paperId}>
                                  <Button variant="outline" size="sm">
                                    View Paper
                                  </Button>
                                </Link>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSendStudentReport(a._id)}
                                  disabled={sendingResponseId === a._id}
                                  className="border-green-300 text-green-700"
                                >
                                  <MessageCircle className="mr-1 h-4 w-4" />
                                  {sendingResponseId === a._id
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
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
