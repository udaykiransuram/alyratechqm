"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Wrench } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { fetchApiJson } from "@/lib/client/api";

import type {
  ReportFilterOption,
  ReportJob,
  ReportScopeFilter,
  TypeFilter,
} from "./report-jobs-types";

const ReportJobsFiltersCard = dynamic(
  () => import("@/components/reports/ReportJobsFiltersCard"),
  {
    loading: () => (
      <div className="analytics-card overflow-hidden p-4">
        <div className="space-y-3">
          <div className="h-6 w-44 rounded bg-muted/50" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 rounded-xl border border-border/60 bg-muted/20" />
            ))}
          </div>
        </div>
      </div>
    ),
  },
);

const ReportJobsDispatchCard = dynamic(
  () => import("@/components/reports/ReportJobsDispatchCard"),
  {
    loading: () => (
      <div className="analytics-card overflow-hidden p-4">
        <div className="space-y-3">
          <div className="h-6 w-36 rounded bg-muted/50" />
          <div className="h-60 rounded-xl border border-border/60 bg-muted/20" />
        </div>
      </div>
    ),
  },
);

type ReportJobsPageClientProps = {
  jobs: ReportJob[];
  totalJobs: number;
  page: number;
  pages: number;
  pageSize: number;
  schoolKey: string;
  initialStatusFilter: string;
  initialTypeFilter: TypeFilter;
  initialReportScopeFilter: ReportScopeFilter;
  initialAcademicSectionFilter: string;
  academicSectionOptions: ReportFilterOption[];
  loadError?: string | null;
};

export default function ReportJobsPageClient({
  jobs,
  totalJobs,
  page,
  pages,
  pageSize,
  schoolKey,
  initialStatusFilter,
  initialTypeFilter,
  initialReportScopeFilter,
  initialAcademicSectionFilter,
  academicSectionOptions,
  loadError = null,
}: ReportJobsPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(loadError);

  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(initialTypeFilter);
  const [reportScopeFilter, setReportScopeFilter] =
    useState<ReportScopeFilter>(initialReportScopeFilter);
  const [academicSectionFilter, setAcademicSectionFilter] = useState(
    initialAcademicSectionFilter,
  );

  const summary = useMemo(() => {
    return jobs.reduce(
      (accumulator, job) => {
        accumulator.total += 1;
        if (job.status === "sent") accumulator.sent += 1;
        if (job.status === "failed") accumulator.failed += 1;
        if (job.status === "queued" || job.status === "processing") {
          accumulator.pending += 1;
        }
        if (job.deliveryAttemptSummary?.awaitingProviderAck) {
          accumulator.awaitingAck += 1;
        }
        return accumulator;
      },
      {
        total: 0,
        pending: 0,
        sent: 0,
        failed: 0,
        awaitingAck: 0,
      },
    );
  }, [jobs]);

  const hasActiveFilters =
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    reportScopeFilter !== "all" ||
    academicSectionFilter !== "all";

  const navigateWithFilters = ({
    nextPage = 1,
    nextStatus = statusFilter,
    nextType = typeFilter,
    nextScope = reportScopeFilter,
    nextAcademicSection = academicSectionFilter,
    preserveScroll = false,
  }: {
    nextPage?: number;
    nextStatus?: string;
    nextType?: TypeFilter;
    nextScope?: ReportScopeFilter;
    nextAcademicSection?: string;
    preserveScroll?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextType !== "all") params.set("type", nextType);
    if (nextScope !== "all") params.set("scope", nextScope);
    if (nextAcademicSection !== "all") {
      params.set("academicSectionId", nextAcademicSection);
    }
    if (nextPage > 1) params.set("page", String(nextPage));
    params.set("limit", String(pageSize));

    const href = params.toString()
      ? `/workspace/manage/reports?${params.toString()}`
      : "/workspace/manage/reports";

    startTransition(() => {
      router.push(href, { scroll: !preserveScroll });
    });
  };

  const retryJob = async (jobId: string) => {
    try {
      setRetryingId(jobId);
      setNotice(null);
      setError(null);
      await fetchApiJson(`/api/reports/jobs/${jobId}/retry`, {
        method: "POST",
        schoolKey,
        fallbackMessage: "Retry failed.",
      });
      setNotice("Retry request queued successfully.");
      router.refresh();
    } catch (retryError: any) {
      setError(retryError?.message || "Retry failed.");
    } finally {
      setRetryingId(null);
    }
  };

  const handleStatusChange = (nextStatus: string) => {
    setStatusFilter(nextStatus);
    navigateWithFilters({ nextPage: 1, nextStatus });
  };

  const handleTypeChange = (nextType: TypeFilter) => {
    setTypeFilter(nextType);
    navigateWithFilters({ nextPage: 1, nextType });
  };

  const handleReportScopeChange = (nextScope: ReportScopeFilter) => {
    setReportScopeFilter(nextScope);
    navigateWithFilters({ nextPage: 1, nextScope });
  };

  const handleAcademicSectionChange = (nextAcademicSection: string) => {
    setAcademicSectionFilter(nextAcademicSection);
    navigateWithFilters({ nextPage: 1, nextAcademicSection });
  };

  const handleClearFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setReportScopeFilter("all");
    setAcademicSectionFilter("all");
    startTransition(() => {
      router.push("/workspace/manage/reports");
    });
  };

  const runWorkerNow = async () => {
    try {
      setNotice(null);
      setError(null);
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
      router.refresh();
    } catch (workerError: any) {
      setError(workerError?.message || "Worker run failed.");
    }
  };

  return (
    <PageShell width="wide" padding="relaxed">
      <PageHero
        variant="operations"
        eyebrow="School Workspace"
        title="Report Delivery Queue"
        description="Track dispatch jobs, refresh delivery state, and run the worker manually when queued or failed report delivery needs attention."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="default"
              className="h-10 rounded-xl px-4"
              onClick={() => router.refresh()}
              disabled={isPending}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              size="default"
              className="h-10 rounded-xl px-4"
              onClick={() => void runWorkerNow()}
            >
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
          {
            label: "Awaiting ack",
            value: String(summary.awaitingAck),
            meta: "Jobs waiting for provider acknowledgement before retry.",
          },
        ]}
      />

      {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}
      {notice ? <div className="app-feedback app-feedback-success">{notice}</div> : null}

      <ReportJobsFiltersCard
        totalJobs={totalJobs}
        failedCount={summary.failed}
        awaitingAckCount={summary.awaitingAck}
        hasActiveFilters={hasActiveFilters}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        reportScopeFilter={reportScopeFilter}
        academicSectionFilter={academicSectionFilter}
        academicSectionOptions={academicSectionOptions}
        onStatusChange={handleStatusChange}
        onTypeChange={handleTypeChange}
        onReportScopeChange={handleReportScopeChange}
        onAcademicSectionChange={handleAcademicSectionChange}
        onClearFilters={handleClearFilters}
      />

      <ReportJobsDispatchCard
        jobs={jobs}
        totalJobs={totalJobs}
        page={page}
        pages={pages}
        pageSize={pageSize}
        isPending={isPending}
        retryingId={retryingId}
        pendingCount={summary.pending}
        sentCount={summary.sent}
        awaitingAckCount={summary.awaitingAck}
        onPageChange={(nextPage, options) =>
          navigateWithFilters({
            nextPage,
            preserveScroll: Boolean(options?.preserveScroll),
          })
        }
        onRetryJob={(jobId) => void retryJob(jobId)}
      />
    </PageShell>
  );
}
