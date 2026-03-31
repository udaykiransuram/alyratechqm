import dynamicComponent from "next/dynamic";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import ReportJobsHeroActions from "@/components/reports/ReportJobsHeroActions";
import {
  DEFAULT_REPORT_JOB_PAGE_SIZE,
  getReportJobsPageData,
} from "@/app/api/reports/jobs/data";
import {
  requireWorkspaceStaffSession,
  resolveWorkspaceListPage,
} from "@/lib/server/workspace-user-directory";
import { connectDB } from "@/lib/db";
import { isMockedE2ETestMode } from "@/lib/test-mode";

const ReportJobsPageClient = dynamicComponent(
  () => import("@/components/reports/ReportJobsPageClient"),
);

function summarizeReportJobs(jobs: Awaited<ReturnType<typeof getReportJobsPageData>>["jobs"]) {
  return (Array.isArray(jobs) ? jobs : []).reduce(
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
}

export const dynamic = "force-dynamic";

type ReportJobsPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    type?: string | string[];
    scope?: string | string[];
    academicSectionId?: string | string[];
    page?: string | string[];
    limit?: string | string[];
  }>;
};

function readSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ManageReportJobsPage({
  searchParams,
}: ReportJobsPageProps) {
  const { schoolKey } = await requireWorkspaceStaffSession();
  const resolvedSearchParams = await searchParams;

  const statusFilter = String(readSearchValue(resolvedSearchParams.status) || "").trim();
  const typeFilter = String(readSearchValue(resolvedSearchParams.type) || "").trim();
  const scopeFilter = String(readSearchValue(resolvedSearchParams.scope) || "").trim();
  const academicSectionFilter = String(
    readSearchValue(resolvedSearchParams.academicSectionId) || "",
  ).trim();
  const requestedPage = resolveWorkspaceListPage(readSearchValue(resolvedSearchParams.page));
  const limitFilter = Number(
    readSearchValue(resolvedSearchParams.limit) || DEFAULT_REPORT_JOB_PAGE_SIZE,
  );

  if (!isMockedE2ETestMode()) {
    await connectDB();
  }

  let jobsResult: Awaited<ReturnType<typeof getReportJobsPageData>> = {
    jobs: [],
    total: 0,
    page: requestedPage,
    pages: 1,
    limit: DEFAULT_REPORT_JOB_PAGE_SIZE,
    filters: {
      academicSections: [],
    },
  };
  let loadError: string | null = null;

  if (!isMockedE2ETestMode()) {
    try {
      jobsResult = await getReportJobsPageData({
        schoolKey,
        query: {
          status: statusFilter,
          type: typeFilter,
          scope: scopeFilter,
          academicSectionId: academicSectionFilter,
          page: requestedPage,
          limit: limitFilter,
          compactView: true,
        },
      });
    } catch (error: any) {
      loadError = error?.message || "Failed to load report jobs.";
    }
  }

  const summary = summarizeReportJobs(jobsResult.jobs);

  return (
    <PageShell width="wide" padding="relaxed">
      <PageHero
        variant="operations"
        eyebrow="School Workspace"
        title="Report Delivery Queue"
        description="Track dispatch jobs, refresh delivery state, and run the worker manually."
        actions={<ReportJobsHeroActions schoolKey={schoolKey} />}
        meta={
          <>
            <span className="app-meta-chip">
              {schoolKey ? `School: ${schoolKey}` : "No school selected"}
            </span>
            <span className="app-meta-chip">
              {summary.awaitingAck} waiting for provider ack
            </span>
          </>
        }
        stats={[
          {
            label: "Filtered jobs",
            value: String(Math.max(0, Number(jobsResult.total) || 0)),
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

      <ReportJobsPageClient
        jobs={Array.isArray(jobsResult.jobs) ? jobsResult.jobs : []}
        totalJobs={Math.max(0, Number(jobsResult.total) || 0)}
        page={Math.max(1, Number(jobsResult.page) || requestedPage)}
        pages={Math.max(1, Number(jobsResult.pages) || 1)}
        pageSize={Math.max(1, Number(jobsResult.limit) || DEFAULT_REPORT_JOB_PAGE_SIZE)}
        schoolKey={schoolKey}
        initialStatusFilter={statusFilter || "all"}
        initialTypeFilter={
          typeFilter === "student" ||
          typeFilter === "teacher" ||
          typeFilter === "admin" ||
          typeFilter === "exam"
            ? typeFilter
            : "all"
        }
        initialReportScopeFilter={
          scopeFilter === "benchmark" || scopeFilter === "student"
            ? scopeFilter
            : "all"
        }
        initialAcademicSectionFilter={academicSectionFilter || "all"}
        academicSectionOptions={
          Array.isArray(jobsResult?.filters?.academicSections)
            ? jobsResult.filters.academicSections
            : []
        }
        loadError={loadError}
      />
    </PageShell>
  );
}
