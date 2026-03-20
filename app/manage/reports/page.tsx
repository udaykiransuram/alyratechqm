"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquareText, RefreshCcw, Wrench } from "lucide-react";
import PageHero from "@/components/layout/PageHero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import PageLoadingState from "@/components/ui/page-loading-state";
import { fetchApiJson } from "@/lib/client/api";
import { getSchoolKeyFromCookie } from "@/lib/client/school";

type Job = {
  _id: string;
  type: "student" | "exam" | "teacher" | "admin";
  status: "queued" | "processing" | "sent" | "failed";
  studentName?: string;
  paperTitle?: string;
  classId?: string;
  className?: string;
  academicSectionId?: string;
  academicSectionName?: string;
  mobileNumber?: string;
  error?: string;
  attempts?: number;
  maxAttempts?: number;
  updatedAt?: string;
  createdAt?: string;
  providerMessageId?: string;
  deliveryStatus?: "accepted" | "sent" | "delivered" | "read" | "failed";
  deliveryError?: string;
  deliveredAt?: string;
  readAt?: string;
  lastWebhookAt?: string;
  reportUrl?: string;
};

type ReportFilterOption = {
  value: string;
  label: string;
};

type TypeFilter = "all" | "student" | "teacher" | "admin" | "exam";
type ReportScopeFilter = "all" | "benchmark" | "student";

function isBenchmarkJob(job: Job) {
  return job.type !== "student";
}

function getTypeLabel(job: Job) {
  switch (job.type) {
    case "student":
      return "Student";
    case "teacher":
      return "Teacher";
    case "admin":
      return "Admin";
    case "exam":
      return "Exam Team";
    default:
      return job.type;
  }
}

function getReportLabel(job: Job) {
  return isBenchmarkJob(job) ? "Class benchmark report" : "Student report";
}

function getScopeLabel(job: Job) {
  const classLabel = job.className?.trim() || "Class not available";
  if (job.academicSectionName?.trim()) {
    return `${classLabel} • ${job.academicSectionName.trim()}`;
  }
  return isBenchmarkJob(job)
    ? `${classLabel} • All class sections`
    : classLabel;
}

function getBenchmarkLabel(job: Job) {
  if (!isBenchmarkJob(job)) {
    return "Not applicable";
  }
  if (job.academicSectionName?.trim()) {
    return `${job.academicSectionName.trim()} vs class average`;
  }
  return "All sections vs class average";
}

function getStatusBadgeClass(status: Job["status"]) {
  switch (status) {
    case "sent":
      return "bg-emerald-100 text-emerald-700";
    case "failed":
      return "bg-rose-100 text-rose-700";
    case "processing":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getDeliveryBadgeClass(status?: Job["deliveryStatus"]) {
  switch (status) {
    case "read":
      return "bg-emerald-100 text-emerald-700";
    case "delivered":
      return "bg-sky-100 text-sky-700";
    case "sent":
      return "bg-indigo-100 text-indigo-700";
    case "accepted":
      return "bg-amber-100 text-amber-700";
    case "failed":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function ManageReportJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [reportScopeFilter, setReportScopeFilter] =
    useState<ReportScopeFilter>("all");
  const [academicSectionFilter, setAcademicSectionFilter] =
    useState<string>("all");
  const [academicSectionOptions, setAcademicSectionOptions] = useState<
    ReportFilterOption[]
  >([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const schoolKey = useMemo(() => getSchoolKeyFromCookie(), []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams();
      if (statusFilter !== "all") qs.set("status", statusFilter);
      if (academicSectionFilter !== "all") {
        qs.set("academicSectionId", academicSectionFilter);
      }
      const data = await fetchApiJson<any>(`/api/reports/jobs?${qs.toString()}`, {
        cache: "no-store",
        schoolKey,
        fallbackMessage: "Failed to load report jobs.",
      });
      setJobs(data.jobs || []);
      setAcademicSectionOptions(
        Array.isArray(data?.filters?.academicSections)
          ? data.filters.academicSections
          : [],
      );
    } catch (loadError: any) {
      setError(loadError?.message || "Failed to load report jobs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, academicSectionFilter]);

  const retryJob = async (jobId: string) => {
    try {
      setRetryingId(jobId);
      setNotice(null);
      await fetchApiJson(`/api/reports/jobs/${jobId}/retry`, {
        method: "POST",
        schoolKey,
        fallbackMessage: "Retry failed.",
      });
      await loadJobs();
      setNotice("Retry request queued successfully.");
    } catch (retryError: any) {
      setError(retryError?.message || "Retry failed.");
    } finally {
      setRetryingId(null);
    }
  };

  const runWorkerNow = async () => {
    try {
      setNotice(null);
      const data = await fetchApiJson<any>(`/api/reports/worker`, {
        method: "POST",
        schoolKey,
        fallbackMessage: "Worker failed.",
      });
      setNotice(
        `Worker processed ${data.processed}, sent ${data.sent}, and failed ${data.failed}.`,
      );
      await loadJobs();
    } catch (workerError: any) {
      setError(workerError?.message || "Worker run failed.");
    }
  };

  const visibleJobs = useMemo(
    () =>
      jobs.filter((job) => {
        if (typeFilter !== "all" && job.type !== typeFilter) {
          return false;
        }
        if (reportScopeFilter === "benchmark" && !isBenchmarkJob(job)) {
          return false;
        }
        if (reportScopeFilter === "student" && isBenchmarkJob(job)) {
          return false;
        }
        return true;
      }),
    [jobs, reportScopeFilter, typeFilter],
  );

  const summary = useMemo(() => {
    return visibleJobs.reduce(
      (acc, job) => {
        acc.total += 1;
        if (job.status === "sent") acc.sent += 1;
        if (job.status === "failed") acc.failed += 1;
        if (job.status === "queued" || job.status === "processing") {
          acc.pending += 1;
        }
        if (isBenchmarkJob(job)) acc.benchmark += 1;
        return acc;
      },
      { total: 0, pending: 0, sent: 0, failed: 0, benchmark: 0 },
    );
  }, [visibleJobs]);

  if (loading && jobs.length === 0 && !error) {
    return (
      <PageLoadingState
        title="Loading report jobs"
        description="Preparing queued deliveries, filters, and WhatsApp delivery state."
      />
    );
  }

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-6 sm:px-0">
      <PageHero
        eyebrow="School Workspace"
        title="Report Delivery"
        description="Track dispatch jobs, refresh delivery state, and run the worker manually when queued or failed report delivery needs attention."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadJobs} disabled={loading}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={runWorkerNow}>
              <Wrench className="h-4 w-4" />
              Run Worker Now
            </Button>
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">
              {schoolKey ? `School: ${schoolKey}` : "No school selected"}
            </span>
            <span className="app-meta-chip">WhatsApp delivery tracking</span>
            <span className="app-meta-chip">Manual worker fallback</span>
          </>
        }
        stats={[
          {
            label: "Visible jobs",
            value: String(summary.total),
            meta: "Jobs visible after the current recipient and report-scope filters.",
          },
          {
            label: "Pending",
            value: String(summary.pending),
            meta: "Queued or processing jobs still waiting for completion.",
          },
          {
            label: "Sent",
            value: String(summary.sent),
            meta: "Jobs successfully processed and dispatched.",
          },
          {
            label: "Failed",
            value: String(summary.failed),
            meta: "Jobs that may need a retry or worker follow-up.",
          },
        ]}
      />

      {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}
      {notice ? <div className="app-feedback app-feedback-success">{notice}</div> : null}

      <div className="app-spotlight-grid">
        <div className="app-spotlight-card app-spotlight-card-strong">
          <p className="app-spotlight-label">Dispatch overview</p>
          <h2 className="app-spotlight-title">
            Keep report delivery readable from queue status through WhatsApp receipt state
          </h2>
          <p className="app-spotlight-copy">
            Jobs are created from response and analytics workflows, processed by the
            worker, and then updated again as WhatsApp delivery webhooks arrive.
          </p>
          <div className="app-inline-stat-grid">
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Benchmark jobs</p>
              <p className="app-inline-stat-value">{summary.benchmark}</p>
              <p className="app-inline-stat-copy">
                Teacher, admin, and exam-team jobs use benchmark report flows.
              </p>
            </div>
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Student reports</p>
              <p className="app-inline-stat-value">
                {Math.max(0, summary.total - summary.benchmark)}
              </p>
              <p className="app-inline-stat-copy">
                Individual student PDFs remain visible in the same delivery queue.
              </p>
            </div>
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Worker path</p>
              <p className="app-inline-stat-value">Auto + manual</p>
              <p className="app-inline-stat-copy">
                Automatic processing is primary; the worker button is the fallback for backlog or retries.
              </p>
            </div>
          </div>
        </div>

        <div className="app-surface app-surface-body">
          <p className="app-spotlight-label">Reading the queue</p>
          <h2 className="text-lg font-semibold text-foreground">
            Separate dispatch status from delivery status
          </h2>
          <div className="app-flow-list">
            <div className="app-flow-item">
              <div className="app-flow-index">1</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">Dispatch status</p>
                <p className="app-flow-note">
                  Queued, processing, sent, and failed describe report generation and send attempts.
                </p>
              </div>
            </div>
            <div className="app-flow-item">
              <div className="app-flow-index">2</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">WhatsApp delivery</p>
                <p className="app-flow-note">
                  Accepted, sent, delivered, read, and failed come from provider delivery updates after dispatch.
                </p>
              </div>
            </div>
            <div className="app-flow-item">
              <div className="app-flow-index">
                <MessageSquareText className="h-4 w-4" />
              </div>
              <div className="app-flow-copy">
                <p className="app-flow-title">Retry carefully</p>
                <p className="app-flow-note">
                  Use retry when a failed job is still valid, and use the worker when the queue needs another processing pass.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Filters & Actions</CardTitle>
              <CardDescription>
                Use server-side status and section filtering, then narrow visible results by recipient type and report scope in the current view.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{visibleJobs.length} visible</Badge>
              <Badge variant="outline">{summary.failed} failed</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="app-section-body">
          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(12rem,1.1fr)]">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Dispatch status
                </p>
                <select
                  className="app-form-input"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="queued">Queued</option>
                  <option value="processing">Processing</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Recipients
                </p>
                <select
                  className="app-form-input"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
                >
                  <option value="all">All recipients</option>
                  <option value="student">Students</option>
                  <option value="teacher">Teachers</option>
                  <option value="admin">Admins</option>
                  <option value="exam">Exam team</option>
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Report scope
                </p>
                <select
                  className="app-form-input"
                  value={reportScopeFilter}
                  onChange={(event) =>
                    setReportScopeFilter(event.target.value as ReportScopeFilter)
                  }
                >
                  <option value="all">All report scopes</option>
                  <option value="benchmark">Benchmark reports</option>
                  <option value="student">Student reports</option>
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Class section
                </p>
                <select
                  className="app-form-input"
                  value={academicSectionFilter}
                  onChange={(event) => setAcademicSectionFilter(event.target.value)}
                >
                  <option value="all">All class sections</option>
                  {academicSectionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="app-section space-y-3 2xl:self-start">
              <div>
                <p className="app-spotlight-label">Current scope</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="app-meta-chip">
                    {statusFilter === "all" ? "All statuses" : statusFilter}
                  </span>
                  <span className="app-meta-chip">
                    {typeFilter === "all" ? "All recipients" : typeFilter}
                  </span>
                  <span className="app-meta-chip">
                    {reportScopeFilter === "all"
                      ? "All report scopes"
                      : reportScopeFilter === "benchmark"
                        ? "Benchmark reports"
                        : "Student reports"}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Status and class-section filters reload the server list. Recipient and report-scope filters narrow the current results client-side.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Dispatch Queue</CardTitle>
              <CardDescription>
                Review delivery progress, file availability, and retry actions without leaving the report operations screen.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{summary.pending} pending</Badge>
              <Badge variant="outline">{summary.sent} sent</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="app-table-wrap rounded-none border-x-0 border-b-0 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">WA Delivery</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Recipient</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Report</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Scope</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Benchmark</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">File</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Mobile</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Attempts</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Updated</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Error</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleJobs.map((job) => (
                  <tr key={job._id} className="border-t border-border/60 align-top bg-background">
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(job.status)}`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex max-w-[260px] flex-col gap-1">
                        <span
                          className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${getDeliveryBadgeClass(job.deliveryStatus)}`}
                        >
                          {job.deliveryStatus || "-"}
                        </span>
                        {job.deliveryError ? (
                          <span className="text-xs text-rose-600">
                            {job.deliveryError}
                          </span>
                        ) : null}
                        {job.providerMessageId ? (
                          <span
                            className="truncate text-xs text-slate-500"
                            title={job.providerMessageId}
                          >
                            {job.providerMessageId}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-[160px] flex-col gap-1">
                        <span className="font-medium text-foreground">
                          {job.studentName || "-"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getTypeLabel(job)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-[220px] flex-col gap-1">
                        <span className="font-medium text-foreground">
                          {job.paperTitle || "-"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getReportLabel(job)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="min-w-[220px] text-sm text-foreground/80">
                        {getScopeLabel(job)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {isBenchmarkJob(job) ? (
                        <div className="flex min-w-[220px] flex-col gap-1">
                          <span className="inline-flex w-fit rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">
                            Benchmark included
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {getBenchmarkLabel(job)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Student-only analytics
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {job.reportUrl ? (
                        <a
                          href={job.reportUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="app-button-secondary h-8 px-3 text-xs"
                        >
                          Open report
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pending file</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{job.mobileNumber || "-"}</td>
                    <td className="px-3 py-2">
                      {job.attempts || 0}/{job.maxAttempts || 3}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDateTime(job.updatedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div
                        className="max-w-[320px] truncate text-xs text-rose-600"
                        title={job.error || ""}
                      >
                        {job.error || "-"}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {job.status === "failed" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => retryJob(job._id)}
                          disabled={retryingId === job._id}
                        >
                          {retryingId === job._id ? "Retrying…" : "Retry now"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {visibleJobs.length === 0 && (
                  <tr>
                    <td
                      colSpan={12}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      No jobs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
