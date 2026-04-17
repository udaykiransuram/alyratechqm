import { Plus } from "lucide-react";
import { notFound } from "next/navigation";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Button } from "@/components/ui/button";
import PublicTestsPageClient from "@/components/workspace/public-tests/PublicTestsPageClient";
import { getWorkspacePublicTestsPageData } from "@/lib/server/workspace-public-tests";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";
import {
  SUMMER_AUTHOR_SIGNIN_PATH,
  SUMMER_CRASH_PUBLIC_TESTS_PATH,
  isSummerCrashSchoolKey,
} from "@/lib/summer-crash/constants";

type PublicTestsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function getPageParam(value: string | string[] | undefined, fallback = 1) {
  const parsed = Number.parseInt(getSearchParam(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function cloneForClientTransport<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default async function WorkspacePublicTestsPage({
  searchParams,
}: PublicTestsPageProps) {
  const [{ schoolKey }, resolvedSearchParams] = await Promise.all([
    requireWorkspaceStaffSession(),
    searchParams,
  ]);

  if (!isSummerCrashSchoolKey(schoolKey)) {
    notFound();
  }

  try {
    const pageData = await getWorkspacePublicTestsPageData({
      schoolKey,
      leadPage: getPageParam(resolvedSearchParams?.leadPage, 1),
      resultPage: getPageParam(resolvedSearchParams?.resultPage, 1),
      leadClassBand: getSearchParam(resolvedSearchParams?.leadClassBand),
      resultClassBand: getSearchParam(resolvedSearchParams?.resultClassBand),
    });

    const clientPageData = cloneForClientTransport(pageData);

    return (
      <PageShell width="wide" padding="standard" className="app-directory-stack">
        <PageHero
          variant="overview"
          density="compact"
          eyebrow="Summer Crash Workspace"
          title="Public Tests"
          description="Map one diagnostic paper per class band, track public registrations, and review submitted results without leaving the real workspace."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" className="app-button-page">
                <AppPrefetchLink href={`${SUMMER_AUTHOR_SIGNIN_PATH}?callbackUrl=${encodeURIComponent(SUMMER_CRASH_PUBLIC_TESTS_PATH)}`}>
                  Summer author sign-in
                </AppPrefetchLink>
              </Button>
              <Button asChild variant="outline" className="app-button-page">
                <AppPrefetchLink href="/workspace/questions">
                  Question bank
                </AppPrefetchLink>
              </Button>
              <Button asChild className="app-button-page">
                <AppPrefetchLink href={`/workspace/question-papers/create?returnTo=${encodeURIComponent(SUMMER_CRASH_PUBLIC_TESTS_PATH)}`}>
                  <Plus className="h-4 w-4" />
                  Create Paper
                </AppPrefetchLink>
              </Button>
            </div>
          }
          meta={
            <>
              <span className="app-meta-chip">Summer-only workspace page</span>
              <span className="app-meta-chip">One paper per class band</span>
              <span className="app-meta-chip">Leads + results</span>
            </>
          }
          stats={[
            {
              label: "Registrations",
              value: String(clientPageData.stats.totalRegistrations),
              meta: "Total active summer enrollments.",
            },
            {
              label: "Started",
              value: String(clientPageData.stats.totalDiagnosticStarted),
              meta: "Diagnostics that have been opened.",
            },
            {
              label: "Submitted",
              value: String(clientPageData.stats.totalDiagnosticSubmitted),
              meta: "Diagnostics with captured results.",
            },
            {
              label: "Class bands",
              value: String(clientPageData.config.classBandCards.length),
              meta: "Class 5 through Class 10 mappings.",
            },
          ]}
        />

        <PublicTestsPageClient
          basePath={SUMMER_CRASH_PUBLIC_TESTS_PATH}
          initialData={clientPageData}
        />
      </PageShell>
    );
  } catch (error) {
    return (
      <PageShell width="wide" padding="standard" className="app-directory-stack">
        <FeedbackNotice variant="error">
          {error instanceof Error
            ? error.message
            : "We couldn't load summer public tests right now."}
        </FeedbackNotice>
      </PageShell>
    );
  }
}
