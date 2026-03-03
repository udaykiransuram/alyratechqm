"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Job = {
  _id: string;
  type: "student" | "exam";
  status: "queued" | "processing" | "sent" | "failed";
  mobileNumber?: string;
  error?: string;
  attempts?: number;
  maxAttempts?: number;
  updatedAt?: string;
  createdAt?: string;
};

function getSchoolKeyFromCookie() {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export default function ManageReportJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const schoolKey = useMemo(() => getSchoolKeyFromCookie(), []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams();
      if (statusFilter !== "all") qs.set("status", statusFilter);
      if (schoolKey) qs.set("school", schoolKey);
      const res = await fetch(`/api/reports/jobs?${qs.toString()}`, {
        cache: "no-store",
        headers: schoolKey ? { "x-school-key": schoolKey } : {},
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.message || "Failed to load report jobs");
        return;
      }
      setJobs(data.jobs || []);
    } catch {
      alert("Failed to load report jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const retryJob = async (jobId: string) => {
    try {
      setRetryingId(jobId);
      const q = schoolKey ? `?school=${encodeURIComponent(schoolKey)}` : "";
      const res = await fetch(`/api/reports/jobs/${jobId}/retry${q}`, {
        method: "POST",
        headers: schoolKey ? { "x-school-key": schoolKey } : {},
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.message || "Retry failed");
        return;
      }
      await loadJobs();
    } catch {
      alert("Retry failed");
    } finally {
      setRetryingId(null);
    }
  };

  const runWorkerNow = async () => {
    try {
      const q = schoolKey ? `?school=${encodeURIComponent(schoolKey)}` : "";
      const res = await fetch(`/api/reports/worker${q}`, {
        method: "POST",
        headers: schoolKey ? { "x-school-key": schoolKey } : {},
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.message || "Worker failed");
        return;
      }
      alert(
        `Processed ${data.processed}, sent ${data.sent}, failed ${data.failed}`,
      );
      await loadJobs();
    } catch {
      alert("Worker run failed");
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Report Dispatch Jobs</h1>
        <div className="flex items-center gap-2">
          <select
            className="border rounded px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
          <Button variant="outline" onClick={loadJobs} disabled={loading}>
            Refresh
          </Button>
          <Button onClick={runWorkerNow}>Run Worker</Button>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Mobile</th>
              <th className="px-3 py-2 text-left">Attempts</th>
              <th className="px-3 py-2 text-left">Updated</th>
              <th className="px-3 py-2 text-left">Error</th>
              <th className="px-3 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job._id} className="border-t">
                <td className="px-3 py-2 capitalize">{job.status}</td>
                <td className="px-3 py-2 capitalize">{job.type}</td>
                <td className="px-3 py-2">{job.mobileNumber || "-"}</td>
                <td className="px-3 py-2">
                  {job.attempts || 0}/{job.maxAttempts || 3}
                </td>
                <td className="px-3 py-2">
                  {job.updatedAt
                    ? new Date(job.updatedAt).toLocaleString()
                    : "-"}
                </td>
                <td className="px-3 py-2 text-red-600 max-w-[420px] truncate">
                  {job.error || "-"}
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
                    "-"
                  )}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td
                  colSpan={7}
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
