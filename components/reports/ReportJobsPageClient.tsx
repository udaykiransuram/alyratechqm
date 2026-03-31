"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { fetchApiJson } from "@/lib/client/api";
import { isMockedE2ETestMode } from "@/lib/test-mode";

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
      <div className="app-filter-panel p-4">
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
      <div className="app-surface p-4">
        <div className="space-y-3">
          <div className="h-6 w-36 rounded bg-muted/50" />
          <div className="h-60 rounded-xl border border-border/60 bg-muted/20" />
        </div>
      </div>
    ),
  },
);

const REPORT_JOBS_REFRESH_EVENT = "report-jobs:refresh";

export type ReportJobsPageClientProps = {
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
  const shouldRefreshMockedData = isMockedE2ETestMode();
  const [isPending, startTransition] = useTransition();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(loadError);
  const [visibleJobs, setVisibleJobs] = useState<ReportJob[]>(jobs);
  const [visibleTotalJobs, setVisibleTotalJobs] = useState(totalJobs);
  const [visiblePage, setVisiblePage] = useState(page);
  const [visiblePages, setVisiblePages] = useState(pages);
  const [visiblePageSize, setVisiblePageSize] = useState(pageSize);
  const [visibleAcademicSectionOptions, setVisibleAcademicSectionOptions] =
    useState<ReportFilterOption[]>(academicSectionOptions);

  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(initialTypeFilter);
  const [reportScopeFilter, setReportScopeFilter] =
    useState<ReportScopeFilter>(initialReportScopeFilter);
  const [academicSectionFilter, setAcademicSectionFilter] = useState(
    initialAcademicSectionFilter,
  );

  useEffect(() => {
    setVisibleJobs(jobs);
    setVisibleTotalJobs(totalJobs);
    setVisiblePage(page);
    setVisiblePages(pages);
    setVisiblePageSize(pageSize);
    setVisibleAcademicSectionOptions(academicSectionOptions);
    setError(loadError);
    setStatusFilter(initialStatusFilter);
    setTypeFilter(initialTypeFilter);
    setReportScopeFilter(initialReportScopeFilter);
    setAcademicSectionFilter(initialAcademicSectionFilter);
  }, [
    academicSectionOptions,
    initialAcademicSectionFilter,
    initialReportScopeFilter,
    initialStatusFilter,
    initialTypeFilter,
    jobs,
    loadError,
    page,
    pageSize,
    pages,
    totalJobs,
  ]);

  const summary = useMemo(() => {
    return visibleJobs.reduce(
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
  }, [visibleJobs]);

  const hasActiveFilters =
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    reportScopeFilter !== "all" ||
    academicSectionFilter !== "all";

  const buildJobsHref = useCallback((values: {
    nextPage?: number;
    nextStatus?: string;
    nextType?: TypeFilter;
    nextScope?: ReportScopeFilter;
    nextAcademicSection?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (values.nextStatus && values.nextStatus !== "all") {
      searchParams.set("status", values.nextStatus);
    }
    if (values.nextType && values.nextType !== "all") {
      searchParams.set("type", values.nextType);
    }
    if (values.nextScope && values.nextScope !== "all") {
      searchParams.set("scope", values.nextScope);
    }
    if (values.nextAcademicSection && values.nextAcademicSection !== "all") {
      searchParams.set("academicSectionId", values.nextAcademicSection);
    }
    if ((values.nextPage || 1) > 1) {
      searchParams.set("page", String(values.nextPage));
    }
    searchParams.set("limit", String(visiblePageSize));

    const href = searchParams.toString()
      ? `/workspace/manage/reports?${searchParams.toString()}`
      : "/workspace/manage/reports";

    return href;
  }, [visiblePageSize]);

  const loadJobs = useCallback(
    async ({
      nextPage = 1,
      nextStatus = statusFilter,
      nextType = typeFilter,
      nextScope = reportScopeFilter,
      nextAcademicSection = academicSectionFilter,
    }: {
      nextPage?: number;
      nextStatus?: string;
      nextType?: TypeFilter;
      nextScope?: ReportScopeFilter;
      nextAcademicSection?: string;
    }) => {
      const href = buildJobsHref({
        nextPage,
        nextStatus,
        nextType,
        nextScope,
        nextAcademicSection,
      });
      const apiHref = href.replace("/workspace/manage/reports", "/api/reports/jobs");

      const data = await fetchApiJson<{
        success?: boolean;
        jobs?: ReportJob[];
        total?: number;
        page?: number;
        pages?: number;
        limit?: number;
        filters?: {
          academicSections?: ReportFilterOption[];
        };
      }>(apiHref, {
        cache: "no-store",
        fallbackMessage: "Failed to load report jobs.",
      });

      setVisibleJobs(Array.isArray(data?.jobs) ? data.jobs : []);
      setVisibleTotalJobs(Math.max(0, Number(data?.total) || 0));
      setVisiblePage(Math.max(1, Number(data?.page) || nextPage));
      setVisiblePages(Math.max(1, Number(data?.pages) || 1));
      setVisiblePageSize(Math.max(1, Number(data?.limit) || visiblePageSize));
      setVisibleAcademicSectionOptions(
        Array.isArray(data?.filters?.academicSections)
          ? data.filters.academicSections
          : [],
      );
      setError(null);
    },
    [
      academicSectionFilter,
      buildJobsHref,
      reportScopeFilter,
      statusFilter,
      typeFilter,
      visiblePageSize,
    ],
  );

  useEffect(() => {
    if (!loadError && !shouldRefreshMockedData) {
      return;
    }

    let active = true;
    void loadJobs({
      nextPage: page,
      nextStatus: initialStatusFilter,
      nextType: initialTypeFilter,
      nextScope: initialReportScopeFilter,
      nextAcademicSection: initialAcademicSectionFilter,
    }).catch((loadJobsError: any) => {
      if (!active) {
        return;
      }

      setError(loadJobsError?.message || loadError || "Failed to load report jobs.");
    });

    return () => {
      active = false;
    };
  }, [
    initialAcademicSectionFilter,
    initialReportScopeFilter,
    initialStatusFilter,
    initialTypeFilter,
    loadError,
    loadJobs,
    page,
    shouldRefreshMockedData,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleRefresh = () => {
      void loadJobs({
        nextPage: visiblePage,
        nextStatus: statusFilter,
        nextType: typeFilter,
        nextScope: reportScopeFilter,
        nextAcademicSection: academicSectionFilter,
      }).catch((loadJobsError: any) => {
        setError(loadJobsError?.message || "Failed to refresh report jobs.");
      });
    };

    window.addEventListener(REPORT_JOBS_REFRESH_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(REPORT_JOBS_REFRESH_EVENT, handleRefresh);
    };
  }, [
    academicSectionFilter,
    loadJobs,
    reportScopeFilter,
    statusFilter,
    typeFilter,
    visiblePage,
  ]);

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
    const href = buildJobsHref({
      nextPage,
      nextStatus,
      nextType,
      nextScope,
      nextAcademicSection,
    });

    if (shouldRefreshMockedData) {
      window.history.pushState(null, "", href);
      void loadJobs({
        nextPage,
        nextStatus,
        nextType,
        nextScope,
        nextAcademicSection,
      }).catch((loadJobsError: any) => {
        setError(loadJobsError?.message || "Failed to load report jobs.");
      });
      return;
    }

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
      if (shouldRefreshMockedData) {
        await loadJobs({
          nextPage: visiblePage,
          nextStatus: statusFilter,
          nextType: typeFilter,
          nextScope: reportScopeFilter,
          nextAcademicSection: academicSectionFilter,
        });
      } else {
        router.refresh();
      }
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
    if (shouldRefreshMockedData) {
      window.history.pushState(null, "", "/workspace/manage/reports");
      void loadJobs({
        nextPage: 1,
        nextStatus: "all",
        nextType: "all",
        nextScope: "all",
        nextAcademicSection: "all",
      }).catch((loadJobsError: any) => {
        setError(loadJobsError?.message || "Failed to load report jobs.");
      });
      return;
    }

    startTransition(() => {
      router.push("/workspace/manage/reports");
    });
  };

  return (
    <>
      <div className="space-y-4">
        {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}
        {notice ? <div className="app-feedback app-feedback-success">{notice}</div> : null}

        <ReportJobsFiltersCard
          totalJobs={visibleTotalJobs}
          failedCount={summary.failed}
          awaitingAckCount={summary.awaitingAck}
          hasActiveFilters={hasActiveFilters}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          reportScopeFilter={reportScopeFilter}
          academicSectionFilter={academicSectionFilter}
          academicSectionOptions={visibleAcademicSectionOptions}
          onStatusChange={handleStatusChange}
          onTypeChange={handleTypeChange}
          onReportScopeChange={handleReportScopeChange}
          onAcademicSectionChange={handleAcademicSectionChange}
          onClearFilters={handleClearFilters}
        />

        <ReportJobsDispatchCard
          jobs={visibleJobs}
          totalJobs={visibleTotalJobs}
          page={visiblePage}
          pages={visiblePages}
          pageSize={visiblePageSize}
          isPending={isPending}
          retryingId={retryingId}
          pendingCount={summary.pending}
          sentCount={summary.sent}
          awaitingAckCount={summary.awaitingAck}
          hasActiveFilters={hasActiveFilters}
          onPageChange={(nextPage, options) =>
            navigateWithFilters({
              nextPage,
              preserveScroll: Boolean(options?.preserveScroll),
            })
          }
          onRetryJob={(jobId) => void retryJob(jobId)}
          onClearFilters={handleClearFilters}
        />
      </div>
    </>
  );
}
