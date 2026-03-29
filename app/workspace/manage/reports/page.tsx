import dynamicComponent from "next/dynamic";

import {
  DEFAULT_REPORT_JOB_PAGE_SIZE,
  getReportJobsPageData,
} from "@/app/api/reports/jobs/data";
import {
  requireWorkspaceStaffSession,
  resolveWorkspaceListPage,
} from "@/lib/server/workspace-user-directory";
import { connectDB } from "@/lib/db";

const ReportJobsPageClient = dynamicComponent(
  () => import("@/components/reports/ReportJobsPageClient"),
);

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

  await connectDB();

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

  return (
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
  );
}
