"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
    } catch {
      alert("Failed to load report jobs");
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
      await fetchApiJson(`/api/reports/jobs/${jobId}/retry`, {
        method: "POST",
        schoolKey,
        fallbackMessage: "Retry failed.",
      });
      await loadJobs();
    } catch {
      alert("Retry failed");
    } finally {
      setRetryingId(null);
    }
  };

  const runWorkerNow = async () => {
    try {
      const data = await fetchApiJson<any>(`/api/reports/worker`, {
        method: "POST",
        schoolKey,
        fallbackMessage: "Worker failed.",
      });
      alert(
        `Processed ${data.processed}, sent ${data.sent}, failed ${data.failed}`,
      );
      await loadJobs();
    } catch {
      alert("Worker run failed");
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

  return (
    <div className="w-full space-y-4 px-4 py-4 sm:px-5 lg:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Report Dispatch Jobs</h1>
          <p className="text-sm text-slate-600">
            Jobs start processing automatically after they are queued. Use the
            worker button as a manual fallback for backlog or retries. Class
            jobs use benchmark workbooks. Student jobs use individual PDFs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded border px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
          <select
            className="rounded border px-3 py-2 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          >
            <option value="all">All recipients</option>
            <option value="student">Students</option>
            <option value="teacher">Teachers</option>
            <option value="admin">Admins</option>
            <option value="exam">Exam team</option>
          </select>
          <select
            className="rounded border px-3 py-2 text-sm"
            value={reportScopeFilter}
            onChange={(e) =>
              setReportScopeFilter(e.target.value as ReportScopeFilter)
            }
          >
            <option value="all">All report scopes</option>
            <option value="benchmark">Benchmark reports</option>
            <option value="student">Student reports</option>
          </select>
          <select
            className="min-w-[220px] rounded border px-3 py-2 text-sm"
            value={academicSectionFilter}
            onChange={(e) => setAcademicSectionFilter(e.target.value)}
          >
            <option value="all">All class sections</option>
            {academicSectionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={loadJobs} disabled={loading}>
            Refresh
          </Button>
          <Button onClick={runWorkerNow}>Run Worker Now</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Visible Jobs
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {summary.total}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Pending
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-600">
            {summary.pending}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Sent
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">
            {summary.sent}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Failed
          </p>
          <p className="mt-2 text-2xl font-semibold text-rose-600">
            {summary.failed}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Benchmark Jobs
          </p>
          <p className="mt-2 text-2xl font-semibold text-indigo-600">
            {summary.benchmark}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">WA Delivery</th>
              <th className="px-3 py-2 text-left">Recipient</th>
              <th className="px-3 py-2 text-left">Report</th>
              <th className="px-3 py-2 text-left">Scope</th>
              <th className="px-3 py-2 text-left">Benchmark</th>
              <th className="px-3 py-2 text-left">File</th>
              <th className="px-3 py-2 text-left">Mobile</th>
              <th className="px-3 py-2 text-left">Attempts</th>
              <th className="px-3 py-2 text-left">Updated</th>
              <th className="px-3 py-2 text-left">Error</th>
              <th className="px-3 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleJobs.map((job) => (
              <tr key={job._id} className="border-t align-top">
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
                    <span className="font-medium text-slate-900">
                      {job.studentName || "-"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {getTypeLabel(job)}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex min-w-[220px] flex-col gap-1">
                    <span className="font-medium text-slate-900">
                      {job.paperTitle || "-"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {getReportLabel(job)}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="min-w-[220px] text-sm text-slate-700">
                    {getScopeLabel(job)}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {isBenchmarkJob(job) ? (
                    <div className="flex min-w-[220px] flex-col gap-1">
                      <span className="inline-flex w-fit rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">
                        Benchmark included
                      </span>
                      <span className="text-xs text-slate-600">
                        {getBenchmarkLabel(job)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">
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
                      className="inline-flex rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      Open report
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500">Pending file</span>
                  )}
                </td>
                <td className="px-3 py-2">{job.mobileNumber || "-"}</td>
                <td className="px-3 py-2">
                  {job.attempts || 0}/{job.maxAttempts || 3}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
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
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
            {visibleJobs.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  className="px-3 py-6 text-center text-slate-500"
                >
                  No jobs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
