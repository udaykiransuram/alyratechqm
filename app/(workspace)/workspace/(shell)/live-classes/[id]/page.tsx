import { ArrowLeft, Edit } from "lucide-react";

import WorkspaceLiveSessionDetailClient from "@/components/live-sessions/WorkspaceLiveSessionDetailClient";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
import { getWorkspaceLiveSessionById } from "@/lib/server/live-sessions";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

type LiveClassDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default async function LiveClassDetailPage({
  params,
}: LiveClassDetailPageProps) {
  const { schoolKey, viewerRole, viewerId } = await requireWorkspaceStaffSession();
  const { id } = await params;
  const liveSession = await getWorkspaceLiveSessionById({
    schoolKey,
    viewerRole,
    viewerId,
    liveSessionId: id,
  });

  return (
    <PageShell width="wide" padding="standard">
      <div className="app-course-page">
        <PageHero
          className="app-learning-hero"
          eyebrow="Teaching"
          title={liveSession?.title || "Live Class"}
          variant="editor"
          density="compact"
          description={
            liveSession?.description ||
            "The requested live class could not be loaded."
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="app-button-page">
                <AppPrefetchLink href="/workspace/live-classes">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </AppPrefetchLink>
              </Button>
              {liveSession ? (
                <Button asChild className="app-button-page">
                  <AppPrefetchLink href={`/workspace/live-classes/edit/${liveSession._id}`}>
                    <Edit className="h-4 w-4" />
                    Edit
                  </AppPrefetchLink>
                </Button>
              ) : null}
            </div>
          }
          meta={
            liveSession ? (
              <>
                <span className="app-meta-chip capitalize">
                  {liveSession.status}
                </span>
                {liveSession.class?.name ? (
                  <span className="app-meta-chip">{liveSession.class.name}</span>
                ) : null}
                {liveSession.subject?.name ? (
                  <span className="app-meta-chip">{liveSession.subject.name}</span>
                ) : null}
              </>
            ) : undefined
          }
          stats={
            liveSession
              ? [
                  {
                    label: "Starts",
                    value: formatDateTime(liveSession.scheduledStartAt),
                    meta: "Session start time",
                  },
                  {
                    label: "Audience",
                    value: String(liveSession.audienceCount),
                    meta: "Students in scope",
                  },
                  {
                    label: "Joined",
                    value: String(liveSession.joinedCount),
                    meta: "Students who clicked join",
                  },
                  {
                    label: "Present",
                    value: String(liveSession.presentCount),
                    meta: "Teacher-marked attendance",
                  },
                ]
              : undefined
          }
        />

        {liveSession ? (
          <WorkspaceLiveSessionDetailClient liveSession={liveSession} />
        ) : (
          <div className="app-feedback app-feedback-error">
            Live class not found.
          </div>
        )}
      </div>
    </PageShell>
  );
}
