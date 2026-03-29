"use client";

import { memo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ListPagination from "@/components/ui/list-pagination";

import type { ReportDispatchAttempt, ReportJob } from "./report-jobs-types";

type ReportJobsDispatchCardProps = {
  jobs: ReportJob[];
  totalJobs: number;
  page: number;
  pages: number;
  pageSize: number;
  isPending: boolean;
  retryingId: string | null;
  pendingCount: number;
  sentCount: number;
  awaitingAckCount: number;
  onPageChange: (
    nextPage: number,
    options?: { preserveScroll?: boolean },
  ) => void;
  onRetryJob: (jobId: string) => void;
};

function isBenchmarkJob(job: ReportJob) {
  return job.type !== "student";
}

function getTypeLabel(job: ReportJob) {
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

function getReportLabel(job: ReportJob) {
  return isBenchmarkJob(job) ? "Class benchmark report" : "Student report";
}

function getScopeLabel(job: ReportJob) {
  const classLabel = job.className?.trim() || "Class not available";
  if (job.academicSectionName?.trim()) {
    return `${classLabel} • ${job.academicSectionName.trim()}`;
  }
  return isBenchmarkJob(job) ? `${classLabel} • All class sections` : classLabel;
}

function getBenchmarkLabel(job: ReportJob) {
  if (!isBenchmarkJob(job)) {
    return "Not applicable";
  }
  if (job.academicSectionName?.trim()) {
    return `${job.academicSectionName.trim()} vs class average`;
  }
  return "All sections vs class average";
}

function getStatusBadgeClass(status: ReportJob["status"]) {
  switch (status) {
    case "sent":
      return "app-status-badge app-status-badge-success";
    case "failed":
      return "app-status-badge app-status-badge-danger";
    case "processing":
      return "app-status-badge app-status-badge-warning";
    default:
      return "app-status-badge app-status-badge-neutral";
  }
}

function getDeliveryBadgeClass(status?: ReportJob["deliveryStatus"]) {
  switch (status) {
    case "read":
      return "app-status-badge app-status-badge-success";
    case "delivered":
      return "app-status-badge app-status-badge-success";
    case "sent":
      return "app-status-badge app-status-badge-info";
    case "accepted":
      return "app-status-badge app-status-badge-info";
    case "failed":
      return "app-status-badge app-status-badge-danger";
    default:
      return "app-status-badge app-status-badge-neutral";
  }
}

function getAttemptStateBadgeClass(state?: ReportDispatchAttempt["state"] | null) {
  switch (state) {
    case "accepted":
      return "app-status-badge app-status-badge-success";
    case "expired":
      return "app-status-badge app-status-badge-danger";
    case "pending_ack":
      return "app-status-badge app-status-badge-warning";
    default:
      return "app-status-badge app-status-badge-neutral";
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

function ReportJobsDispatchCard({
  jobs,
  totalJobs,
  page,
  pages,
  pageSize,
  isPending,
  retryingId,
  pendingCount,
  sentCount,
  awaitingAckCount,
  onPageChange,
  onRetryJob,
}: ReportJobsDispatchCardProps) {
  return (
    <Card className="analytics-card overflow-hidden">
      <CardHeader className="analytics-card-header analytics-card-header-highlight">
        <div className="analytics-toolbar-row gap-4">
          <div className="analytics-toolbar-copy">
            <CardTitle className="analytics-card-title">Dispatch Queue</CardTitle>
          </div>
          <div className="analytics-toolbar-meta">
            {isPending ? (
              <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
                Refreshing...
              </span>
            ) : null}
            <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
              {pendingCount} pending
            </span>
            <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
              {sentCount} sent
            </span>
            <span className="analytics-toolbar-chip analytics-toolbar-chip-muted">
              {awaitingAckCount} waiting ack
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-3 sm:p-4">
        <ListPagination
          page={page}
          totalPages={pages}
          totalItems={totalJobs}
          pageSize={pageSize}
          itemLabel="jobs"
          onPageChange={onPageChange}
          disabled={isPending}
          className="analytics-table-pagination"
        />
        <div className="analytics-table-wrap rounded-none border-x-0 border-b-0 overflow-x-auto">
          <table className="min-w-[74rem] w-full text-sm">
            <thead>
              <tr>
                <th className="analytics-th w-[16rem]">Dispatch</th>
                <th className="analytics-th w-[13rem]">Recipient</th>
                <th className="analytics-th w-[19rem]">Report</th>
                <th className="analytics-th w-[16rem]">WA delivery</th>
                <th className="analytics-th w-[14rem]">Attempts</th>
                <th className="analytics-th w-[12rem]">Issue & action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job._id} className="analytics-row align-top">
                  <td className="analytics-td align-top">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        <span className={getStatusBadgeClass(job.status)}>{job.status}</span>
                        {job.deliveryAttemptSummary?.awaitingProviderAck ? (
                          <span className="app-status-badge app-status-badge-warning">
                            Awaiting provider ack
                          </span>
                        ) : null}
                        {job.deliveryAttemptSummary?.recoveredStaleLock ? (
                          <span className="app-status-badge app-status-badge-warning">
                            Recovered stale lock
                          </span>
                        ) : null}
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {job.processingStartedAt && job.status === "processing" ? (
                          <p className="analytics-table-measure-cell">
                            Processing since {formatDateTime(job.processingStartedAt)}
                          </p>
                        ) : null}
                        {job.nextRetryAt ? (
                          <p className="analytics-table-measure-cell">
                            Next retry at {formatDateTime(job.nextRetryAt)}
                          </p>
                        ) : null}
                        {job.deliveryAttemptSummary?.ackWaitUntil &&
                        job.deliveryAttemptSummary.awaitingProviderAck ? (
                          <p className="analytics-table-measure-cell">
                            Provider ack wait until{" "}
                            {formatDateTime(job.deliveryAttemptSummary.ackWaitUntil)}
                          </p>
                        ) : null}
                        {job.updatedAt ? (
                          <p className="analytics-table-measure-cell">
                            Updated {formatDateTime(job.updatedAt)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="analytics-td align-top">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">{job.studentName || "-"}</span>
                      <span className="text-xs text-muted-foreground">{getTypeLabel(job)}</span>
                      <span className="analytics-table-measure-cell break-words text-xs text-muted-foreground">
                        {job.mobileNumber || "No mobile number"}
                      </span>
                    </div>
                  </td>
                  <td className="analytics-td align-top">
                    <div className="flex flex-col gap-2">
                      <div className="space-y-1">
                        <span className="font-medium text-foreground">{job.paperTitle || "-"}</span>
                        <span className="text-xs text-muted-foreground">{getReportLabel(job)}</span>
                        <p className="text-xs text-muted-foreground">{getScopeLabel(job)}</p>
                      </div>
                      {isBenchmarkJob(job) ? (
                        <div className="space-y-1">
                          <span className="app-status-badge app-status-badge-info w-fit">
                            Benchmark included
                          </span>
                          <p className="text-xs text-muted-foreground">{getBenchmarkLabel(job)}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Student-only analytics</span>
                      )}
                      {job.reportUrl ? (
                        <Button
                          asChild
                          variant="outline"
                          size="default"
                          className="analytics-action-button-compact h-9 w-fit rounded-xl px-3.5 text-[13px]"
                        >
                          <a href={job.reportUrl} target="_blank" rel="noreferrer">
                            Open report
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Report file pending</span>
                      )}
                    </div>
                  </td>
                  <td className="analytics-td align-top">
                    <div className="flex flex-col gap-1">
                      <span className={`${getDeliveryBadgeClass(job.deliveryStatus)} w-fit`}>
                        {job.deliveryStatus || "-"}
                      </span>
                      {job.deliveryError ? (
                        <span className="break-words text-xs text-rose-600">{job.deliveryError}</span>
                      ) : null}
                      {job.providerMessageId ? (
                        <span className="break-all text-xs text-slate-500" title={job.providerMessageId}>
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
                      <div className="analytics-table-measure-cell font-medium text-foreground">
                        {job.attempts || 0}/{job.maxAttempts || 3}
                      </div>
                      {job.deliveryAttemptSummary ? (
                        <>
                          <div className="flex flex-wrap gap-2">
                            <span className="app-status-badge app-status-badge-neutral">
                              {job.deliveryAttemptSummary.totalTracked} tracked
                            </span>
                            {job.deliveryAttemptSummary.acceptedCount > 0 ? (
                              <span className="app-status-badge app-status-badge-success">
                                {job.deliveryAttemptSummary.acceptedCount} accepted
                              </span>
                            ) : null}
                            {job.deliveryAttemptSummary.pendingAckCount > 0 ? (
                              <span className="app-status-badge app-status-badge-warning">
                                {job.deliveryAttemptSummary.pendingAckCount} pending ack
                              </span>
                            ) : null}
                            {job.deliveryAttemptSummary.expiredCount > 0 ? (
                              <span className="app-status-badge app-status-badge-danger">
                                {job.deliveryAttemptSummary.expiredCount} expired
                              </span>
                            ) : null}
                          </div>
                          {job.deliveryAttemptSummary.latestAttempt ? (
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={getAttemptStateBadgeClass(
                                    job.deliveryAttemptSummary.latestAttempt.state,
                                  )}
                                >
                                  Attempt #{job.deliveryAttemptSummary.latestAttempt.attemptNumber}{" "}
                                  {getAttemptStateLabel(job.deliveryAttemptSummary.latestAttempt.state)}
                                </span>
                                {job.deliveryAttemptSummary.latestAttempt.deliveryStatus ? (
                                  <span
                                    className={getDeliveryBadgeClass(
                                      job.deliveryAttemptSummary.latestAttempt.deliveryStatus || undefined,
                                    )}
                                  >
                                    {job.deliveryAttemptSummary.latestAttempt.deliveryStatus}
                                  </span>
                                ) : null}
                              </div>
                              {job.deliveryAttemptSummary.latestAttempt.createdAt ? (
                                <p className="analytics-table-measure-cell">
                                  Started{" "}
                                  {formatDateTime(
                                    job.deliveryAttemptSummary.latestAttempt.createdAt || undefined,
                                  )}
                                </p>
                              ) : null}
                              {job.deliveryAttemptSummary.latestAttempt.acknowledgedAt ? (
                                <p className="analytics-table-measure-cell">
                                  Acknowledged{" "}
                                  {formatDateTime(
                                    job.deliveryAttemptSummary.latestAttempt.acknowledgedAt || undefined,
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
                      <div className="break-words text-xs text-rose-600" title={job.error || ""}>
                        {job.error || "No reported error"}
                      </div>
                      {job.deliveryAttemptSummary?.latestAttempt?.note &&
                      job.deliveryAttemptSummary.latestAttempt.note !== job.error ? (
                        <div
                          className="break-words text-xs text-muted-foreground"
                          title={job.deliveryAttemptSummary.latestAttempt.note || ""}
                        >
                          {job.deliveryAttemptSummary.latestAttempt.note}
                        </div>
                      ) : null}
                      {job.status === "failed" ? (
                        <Button
                          size="default"
                          variant="outline"
                          className="h-9 rounded-xl px-3.5 text-[13px]"
                          onClick={() => onRetryJob(job._id)}
                          disabled={retryingId === job._id}
                        >
                          {retryingId === job._id ? "Retrying..." : "Retry now"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No action needed</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="analytics-td py-8 text-center text-muted-foreground">
                    No jobs found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(ReportJobsDispatchCard);
