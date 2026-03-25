"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCcw, Wrench } from "lucide-react";
import PageHero from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ListPagination from "@/components/ui/list-pagination";
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
  nextRetryAt?: string;
  processingStartedAt?: string;
  activeAttemptCreatedAt?: string;
  providerAcceptedAt?: string;
  providerMessageId?: string;
  deliveryStatus?: "accepted" | "sent" | "delivered" | "read" | "failed";
  deliveryError?: string;
  deliveredAt?: string;
  readAt?: string;
  lastWebhookAt?: string;
  reportUrl?: string;
  deliveryAttempts?: ReportDispatchAttempt[];
  deliveryAttemptSummary?: ReportDispatchAttemptSummary;
};

type ReportDispatchAttempt = {
  key: string;
  attemptNumber: number;
  state: "pending_ack" | "accepted" | "expired";
  createdAt?: string | null;
  acknowledgedAt?: string | null;
  lastWebhookAt?: string | null;
  providerMessageId?: string | null;
  deliveryStatus?: "accepted" | "sent" | "delivered" | "read" | "failed" | null;
  note?: string | null;
};

type ReportDispatchAttemptSummary = {
  totalTracked: number;
  acceptedCount: number;
  expiredCount: number;
  pendingAckCount: number;
  awaitingProviderAck: boolean;
  ackWaitUntil?: string | null;
  recoveredStaleLock: boolean;
  latestAttempt?: ReportDispatchAttempt | null;
  activeAttempt?: ReportDispatchAttempt | null;
  history?: ReportDispatchAttempt[];
};

type ReportFilterOption = {
  value: string;
  label: string;
};

type TypeFilter = "all" | "student" | "teacher" | "admin" | "exam";
type ReportScopeFilter = "all" | "benchmark" | "student";
const REPORT_JOB_PAGE_SIZE = 40;
const REPORT_JOB_CACHE_TTL_MS = 30_000;

type ReportJobsCacheEntry = {
  jobs: Job[];
  totalJobs: number;
  pages: number;
  page: number;
  academicSectionOptions: ReportFilterOption[];
  fetchedAt: number;
};

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

function getAttemptStateBadgeClass(state?: ReportDispatchAttempt["state"] | null) {
  switch (state) {
    case "accepted":
      return "bg-emerald-100 text-emerald-700";
    case "expired":
      return "bg-rose-100 text-rose-700";
    case "pending_ack":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function getAttemptStateLabel(state?: ReportDispatchAttempt["state"] | null) {
  switch (state) {
    case "accepted":
      return "Accepted";
    case "expired":
      return "Expired";
    case "pending_ack":
      return "Pending Ack";
    default:
      return "Not tracked";
  }
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function ManageReportJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const jobsCacheRef = useRef<Map<string, ReportJobsCacheEntry>>(new Map());

  const schoolKey = useMemo(() => getSchoolKeyFromCookie(), []);

  const buildJobsQueryString = (targetPage = page) => {
    const qs = new URLSearchParams();
    if (statusFilter !== "all") qs.set("status", statusFilter);
    if (typeFilter !== "all") qs.set("type", typeFilter);
    if (reportScopeFilter !== "all") qs.set("scope", reportScopeFilter);
    if (academicSectionFilter !== "all") {
      qs.set("academicSectionId", academicSectionFilter);
    }
    qs.set("page", String(targetPage));
    qs.set("limit", String(REPORT_JOB_PAGE_SIZE));
    return qs.toString();
  };

  const getJobsCacheKey = (targetPage = page) =>
    `${schoolKey || "no-school"}::${buildJobsQueryString(targetPage)}`;

  const applyJobsCacheEntry = (entry: ReportJobsCacheEntry) => {
    setJobs(entry.jobs);
    setTotalJobs(entry.totalJobs);
    setPages(entry.pages);
    setPage(entry.page);
    setAcademicSectionOptions(entry.academicSectionOptions);
  };

  const prefetchJobsPage = async (targetPage: number, totalPageCount: number) => {
    if (targetPage < 1 || targetPage > totalPageCount) {
      return;
    }

    const cacheKey = getJobsCacheKey(targetPage);
    const cachedEntry = jobsCacheRef.current.get(cacheKey);
    if (cachedEntry && Date.now() - cachedEntry.fetchedAt < REPORT_JOB_CACHE_TTL_MS) {
      return;
    }

    try {
      const data = await fetchApiJson<any>(`/api/reports/jobs?${buildJobsQueryString(targetPage)}`, {
        cache: "no-store",
        schoolKey,
        fallbackMessage: "Failed to load report jobs.",
      });
      const resolvedPage = Math.max(1, Number(data.page) || targetPage);
      jobsCacheRef.current.set(getJobsCacheKey(resolvedPage), {
        jobs: Array.isArray(data.jobs) ? data.jobs : [],
        totalJobs: Math.max(0, Number(data.total) || 0),
        pages: Math.max(1, Number(data.pages) || 1),
        page: resolvedPage,
        academicSectionOptions: Array.isArray(data?.filters?.academicSections)
          ? data.filters.academicSections
          : [],
        fetchedAt: Date.now(),
      });
    } catch {
    }
  };

  const loadJobs = async ({
    silent = false,
    force = false,
    targetPage = page,
  }: {
    silent?: boolean;
    force?: boolean;
    targetPage?: number;
  } = {}) => {
    const cacheKey = getJobsCacheKey(targetPage);
    const cachedEntry = jobsCacheRef.current.get(cacheKey);
    const hasFreshCache =
      cachedEntry && Date.now() - cachedEntry.fetchedAt < REPORT_JOB_CACHE_TTL_MS;

    if (cachedEntry) {
      applyJobsCacheEntry(cachedEntry);
      if (hasFreshCache && !force) {
        setError(null);
        if (!silent) {
          setLoading(false);
        }
        void prefetchJobsPage(targetPage + 1, cachedEntry.pages);
        return;
      }
    }

    try {
      if (!silent) {
        setLoading(true);
      }
      if (!cachedEntry) {
        setError(null);
      }
      const data = await fetchApiJson<any>(
        `/api/reports/jobs?${buildJobsQueryString(targetPage)}`,
        {
          cache: "no-store",
          schoolKey,
          fallbackMessage: "Failed to load report jobs.",
        },
      );
      const resolvedPage = Math.max(1, Number(data.page) || targetPage);
      const nextEntry = {
        jobs: Array.isArray(data.jobs) ? data.jobs : [],
        totalJobs: Math.max(0, Number(data.total) || 0),
        pages: Math.max(1, Number(data.pages) || 1),
        page: resolvedPage,
        academicSectionOptions: Array.isArray(data?.filters?.academicSections)
          ? data.filters.academicSections
          : [],
        fetchedAt: Date.now(),
      };
      jobsCacheRef.current.set(getJobsCacheKey(resolvedPage), nextEntry);
      applyJobsCacheEntry(nextEntry);
      void prefetchJobsPage(resolvedPage + 1, nextEntry.pages);
    } catch (loadError: any) {
      if (!cachedEntry) {
        setError(loadError?.message || "Failed to load report jobs.");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicSectionFilter, page, reportScopeFilter, statusFilter, typeFilter]);

  const retryJob = async (jobId: string) => {
    try {
      setRetryingId(jobId);
      setNotice(null);
      await fetchApiJson(`/api/reports/jobs/${jobId}/retry`, {
        method: "POST",
        schoolKey,
        fallbackMessage: "Retry failed.",
      });
      setNotice("Retry request queued successfully.");
      void loadJobs({ silent: true, force: true });
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
      const recoveredNote =
        data.recoveredStale > 0
          ? ` Recovered ${data.recoveredStale} stale job lock(s).`
          : "";
      const waitingNote =
        data.awaitingProviderAck > 0
          ? ` ${data.awaitingProviderAck} job(s) are waiting for provider acknowledgement before retry.`
          : "";
      setNotice(
        `Worker processed ${data.processed}, sent ${data.sent}, and failed ${data.failed}.${recoveredNote}${waitingNote}`,
      );
      void loadJobs({ silent: true, force: true });
    } catch (workerError: any) {
      setError(workerError?.message || "Worker run failed.");
    }
  };

  const visibleJobs = jobs;

  const summary = useMemo(() => {
    return visibleJobs.reduce(
      (acc, job) => {
        acc.total += 1;
        if (job.status === "sent") acc.sent += 1;
        if (job.status === "failed") acc.failed += 1;
        if (job.status === "queued" || job.status === "processing") {
          acc.pending += 1;
        }
        if (job.deliveryAttemptSummary?.awaitingProviderAck) {
          acc.awaitingAck += 1;
        }
        if (job.deliveryAttemptSummary?.recoveredStaleLock) {
          acc.recoveredStale += 1;
        }
        if (isBenchmarkJob(job)) acc.benchmark += 1;
        return acc;
      },
      {
        total: 0,
        pending: 0,
        sent: 0,
        failed: 0,
        benchmark: 0,
        awaitingAck: 0,
        recoveredStale: 0,
      },
    );
  }, [visibleJobs]);

  const hasActiveFilters =
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    reportScopeFilter !== "all" ||
    academicSectionFilter !== "all";

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
            <Button
              variant="outline"
              size="default"
              className="h-10 rounded-xl px-4"
              onClick={() => void loadJobs({ force: true })}
              disabled={loading}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button size="default" className="h-10 rounded-xl px-4" onClick={runWorkerNow}>
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
            <span className="app-meta-chip">
              {summary.awaitingAck} waiting for provider ack
            </span>
            <span className="app-meta-chip">Manual worker fallback</span>
          </>
        }
        stats={[
          {
            label: "Filtered jobs",
            value: String(totalJobs),
            meta: "Matching jobs across all pages for the active filters.",
          },
          {
            label: "Pending on page",
            value: String(summary.pending),
            meta: "Queued or processing jobs on the current page.",
          },
          {
            label: "Sent on page",
            value: String(summary.sent),
            meta: "Jobs successfully processed on the current page.",
          },
          {
            label: "Failed on page",
            value: String(summary.failed),
            meta: "Jobs on this page that may need a retry or worker follow-up.",
          },
        ]}
      />

      {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}
      {notice ? <div className="app-feedback app-feedback-success">{notice}</div> : null}

      <Card className="analytics-card overflow-hidden">
        <CardHeader className="analytics-card-header">
          <div className="analytics-toolbar-row gap-4">
            <div className="analytics-toolbar-copy">
              <CardTitle className="analytics-card-title">Filters & Actions</CardTitle>
              <p className="analytics-card-description">
                Narrow the delivery queue by dispatch state, recipient type, report scope, and class-section context.
              </p>
            </div>
            <div className="analytics-toolbar-meta">
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                {totalJobs} matching
              </span>
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                {summary.failed} failed
              </span>
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                {summary.awaitingAck} waiting ack
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="analytics-toolbar">
            <div className="app-report-filter-layout">
              <div className="app-report-filter-grid">
                <div className="app-report-filter-card">
                  <p className="app-report-filter-label">Dispatch status</p>
                  <div className="app-report-filter-control">
                    <select
                      className="analytics-select w-full"
                      value={statusFilter}
                      onChange={(event) => {
                        setPage(1);
                        setStatusFilter(event.target.value);
                      }}
                    >
                      <option value="all">All statuses</option>
                      <option value="queued">Queued</option>
                      <option value="processing">Processing</option>
                      <option value="sent">Sent</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                </div>
                <div className="app-report-filter-card">
                  <p className="app-report-filter-label">Recipients</p>
                  <div className="app-report-filter-control">
                    <select
                      className="analytics-select w-full"
                      value={typeFilter}
                      onChange={(event) => {
                        setPage(1);
                        setTypeFilter(event.target.value as TypeFilter);
                      }}
                    >
                      <option value="all">All recipients</option>
                      <option value="student">Students</option>
                      <option value="teacher">Teachers</option>
                      <option value="admin">Admins</option>
                      <option value="exam">Exam team</option>
                    </select>
                  </div>
                </div>
                <div className="app-report-filter-card">
                  <p className="app-report-filter-label">Report scope</p>
                  <div className="app-report-filter-control">
                    <select
                      className="analytics-select w-full"
                      value={reportScopeFilter}
                      onChange={(event) => {
                        setPage(1);
                        setReportScopeFilter(
                          event.target.value as ReportScopeFilter,
                        );
                      }}
                    >
                      <option value="all">All report scopes</option>
                      <option value="benchmark">Benchmark reports</option>
                      <option value="student">Student reports</option>
                    </select>
                  </div>
                </div>
                <div className="app-report-filter-card">
                  <p className="app-report-filter-label">Class section</p>
                  <div className="app-report-filter-control">
                    <select
                      className="analytics-select w-full"
                      value={academicSectionFilter}
                      onChange={(event) => {
                        setPage(1);
                        setAcademicSectionFilter(event.target.value);
                      }}
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
              </div>
              <div className="app-report-filter-footer">
                <p className="app-report-filter-hint">
                  Filters refresh the queue directly from the server so each page stays lighter and quicker to open.
                </p>
                {hasActiveFilters ? (
                  <div className="app-filter-summary-actions">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl px-4"
                      onClick={() => {
                        setPage(1);
                        setStatusFilter("all");
                        setTypeFilter("all");
                        setReportScopeFilter("all");
                        setAcademicSectionFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="space-y-3">
                {summary.awaitingAck > 0 || summary.recoveredStale > 0 ? (
                  <div className="app-feedback app-feedback-warning text-xs">
                    {summary.awaitingAck > 0 ? (
                      <p>
                        {summary.awaitingAck} visible job(s) are waiting for
                        provider acknowledgement before the worker is allowed to
                        retry them.
                      </p>
                    ) : null}
                    {summary.recoveredStale > 0 ? (
                      <p>
                        {summary.recoveredStale} visible job(s) were recovered
                        from stale processing locks and now include an
                        operations trail in the queue.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="analytics-card overflow-hidden">
        <CardHeader className="analytics-card-header">
          <div className="analytics-toolbar-row gap-4">
            <div className="analytics-toolbar-copy">
              <CardTitle className="analytics-card-title">Dispatch Queue</CardTitle>
            </div>
            <div className="analytics-toolbar-meta">
              {loading && jobs.length > 0 ? (
                <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                  Refreshing...
                </span>
              ) : null}
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                {summary.pending} pending
              </span>
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                {summary.sent} sent
              </span>
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                {summary.awaitingAck} waiting ack
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <ListPagination
            page={page}
            totalPages={pages}
            totalItems={totalJobs}
            pageSize={REPORT_JOB_PAGE_SIZE}
            itemLabel="jobs"
            onPageChange={setPage}
            disabled={loading}
          />
          <div className="analytics-table-wrap rounded-none border-x-0 border-b-0 overflow-x-auto">
            <table className="min-w-[74rem] w-full text-sm">
              <thead>
                <tr>
                  <th className="analytics-th w-[16rem]">
                    Dispatch
                  </th>
                  <th className="analytics-th w-[13rem]">
                    Recipient
                  </th>
                  <th className="analytics-th w-[19rem]">
                    Report
                  </th>
                  <th className="analytics-th w-[16rem]">
                    WA delivery
                  </th>
                  <th className="analytics-th w-[14rem]">
                    Attempts
                  </th>
                  <th className="analytics-th w-[12rem]">
                    Issue & action
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleJobs.map((job) => (
                  <tr
                    key={job._id}
                    className="analytics-row align-top"
                  >
                    <td className="analytics-td align-top">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(job.status)}`}
                          >
                            {job.status}
                          </span>
                          {job.deliveryAttemptSummary?.awaitingProviderAck ? (
                            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                              Awaiting provider ack
                            </span>
                          ) : null}
                          {job.deliveryAttemptSummary?.recoveredStaleLock ? (
                            <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
                              Recovered stale lock
                            </span>
                          ) : null}
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {job.processingStartedAt && job.status === "processing" ? (
                            <p>
                              Processing since{" "}
                              {formatDateTime(job.processingStartedAt)}
                            </p>
                          ) : null}
                          {job.nextRetryAt ? (
                            <p>Next retry at {formatDateTime(job.nextRetryAt)}</p>
                          ) : null}
                          {job.deliveryAttemptSummary?.ackWaitUntil &&
                          job.deliveryAttemptSummary.awaitingProviderAck ? (
                            <p>
                              Provider ack wait until{" "}
                              {formatDateTime(
                                job.deliveryAttemptSummary.ackWaitUntil,
                              )}
                            </p>
                          ) : null}
                          {job.updatedAt ? (
                            <p>Updated {formatDateTime(job.updatedAt)}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="analytics-td align-top">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">
                          {job.studentName || "-"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getTypeLabel(job)}
                        </span>
                        <span className="break-words text-xs text-muted-foreground">
                          {job.mobileNumber || "No mobile number"}
                        </span>
                      </div>
                    </td>
                    <td className="analytics-td align-top">
                      <div className="flex flex-col gap-2">
                        <div className="space-y-1">
                          <span className="font-medium text-foreground">
                            {job.paperTitle || "-"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {getReportLabel(job)}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {getScopeLabel(job)}
                          </p>
                        </div>
                        {isBenchmarkJob(job) ? (
                          <div className="space-y-1">
                            <span className="inline-flex w-fit rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">
                              Benchmark included
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {getBenchmarkLabel(job)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Student-only analytics
                          </span>
                        )}
                        {job.reportUrl ? (
                          <Button
                            asChild
                            variant="outline"
                            size="default"
                            className="h-9 w-fit rounded-xl px-3.5 text-[13px]"
                          >
                            <a
                              href={job.reportUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open report
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Report file pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="analytics-td align-top">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${getDeliveryBadgeClass(job.deliveryStatus)}`}
                        >
                          {job.deliveryStatus || "-"}
                        </span>
                        {job.deliveryError ? (
                          <span className="break-words text-xs text-rose-600">
                            {job.deliveryError}
                          </span>
                        ) : null}
                        {job.providerMessageId ? (
                          <span
                            className="break-all text-xs text-slate-500"
                            title={job.providerMessageId}
                          >
                            {job.providerMessageId}
                          </span>
                        ) : null}
                        {job.providerAcceptedAt ? (
                          <span className="text-xs text-muted-foreground">
                            Accepted: {formatDateTime(job.providerAcceptedAt)}
                          </span>
                        ) : null}
                        {job.lastWebhookAt ? (
                          <span className="text-xs text-muted-foreground">
                            Last webhook: {formatDateTime(job.lastWebhookAt)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="analytics-td align-top">
                      <div className="flex flex-col gap-2">
                        <div className="font-medium text-foreground">
                          {job.attempts || 0}/{job.maxAttempts || 3}
                        </div>
                        {job.deliveryAttemptSummary ? (
                          <>
                            <div className="flex flex-wrap gap-2">
                              <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                                {job.deliveryAttemptSummary.totalTracked} tracked
                              </span>
                              {job.deliveryAttemptSummary.acceptedCount > 0 ? (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700">
                                  {job.deliveryAttemptSummary.acceptedCount} accepted
                                </span>
                              ) : null}
                              {job.deliveryAttemptSummary.pendingAckCount > 0 ? (
                                <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">
                                  {job.deliveryAttemptSummary.pendingAckCount} pending ack
                                </span>
                              ) : null}
                              {job.deliveryAttemptSummary.expiredCount > 0 ? (
                                <span className="inline-flex rounded-full bg-rose-100 px-2 py-1 text-[11px] font-medium text-rose-700">
                                  {job.deliveryAttemptSummary.expiredCount} expired
                                </span>
                              ) : null}
                            </div>
                            {job.deliveryAttemptSummary.latestAttempt ? (
                              <div className="space-y-1 text-xs text-muted-foreground">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${getAttemptStateBadgeClass(job.deliveryAttemptSummary.latestAttempt.state)}`}
                                  >
                                    Attempt #
                                    {job.deliveryAttemptSummary.latestAttempt.attemptNumber}{" "}
                                    {getAttemptStateLabel(
                                      job.deliveryAttemptSummary.latestAttempt.state,
                                    )}
                                  </span>
                                  {job.deliveryAttemptSummary.latestAttempt.deliveryStatus ? (
                                    <span
                                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${getDeliveryBadgeClass(job.deliveryAttemptSummary.latestAttempt.deliveryStatus)}`}
                                    >
                                      {
                                        job.deliveryAttemptSummary.latestAttempt
                                          .deliveryStatus
                                      }
                                    </span>
                                  ) : null}
                                </div>
                                {job.deliveryAttemptSummary.latestAttempt.createdAt ? (
                                  <p>
                                    Started{" "}
                                    {formatDateTime(
                                      job.deliveryAttemptSummary.latestAttempt
                                        .createdAt || undefined,
                                    )}
                                  </p>
                                ) : null}
                                {job.deliveryAttemptSummary.latestAttempt.acknowledgedAt ? (
                                  <p>
                                    Acknowledged{" "}
                                    {formatDateTime(
                                      job.deliveryAttemptSummary.latestAttempt
                                        .acknowledgedAt || undefined,
                                    )}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </td>
                    <td className="analytics-td align-top">
                      <div className="space-y-2">
                        <div
                          className="break-words text-xs text-rose-600"
                          title={job.error || ""}
                        >
                          {job.error || "No reported error"}
                        </div>
                        {job.deliveryAttemptSummary?.latestAttempt?.note &&
                        job.deliveryAttemptSummary.latestAttempt.note !==
                          job.error ? (
                          <div
                            className="break-words text-xs text-muted-foreground"
                            title={
                              job.deliveryAttemptSummary.latestAttempt.note || ""
                            }
                          >
                            {job.deliveryAttemptSummary.latestAttempt.note}
                          </div>
                        ) : null}
                        {job.status === "failed" ? (
                          <Button
                            size="default"
                            variant="outline"
                            className="h-9 rounded-xl px-3.5 text-[13px]"
                            onClick={() => retryJob(job._id)}
                            disabled={retryingId === job._id}
                          >
                            {retryingId === job._id ? "Retrying…" : "Retry now"}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No action needed
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleJobs.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="analytics-td py-8 text-center text-muted-foreground"
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
