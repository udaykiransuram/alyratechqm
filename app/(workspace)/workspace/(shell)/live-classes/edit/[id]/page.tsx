import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import ReturnBackButton from "@/components/navigation/ReturnBackButton";
import LiveSessionEditorClient from "@/components/live-sessions/LiveSessionEditorClient";
import {
  getWorkspaceLiveSessionById,
  getWorkspaceLiveSessionSupportData,
} from "@/lib/server/live-sessions";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

type EditLiveClassPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditLiveClassPage({
  params,
}: EditLiveClassPageProps) {
  const { schoolKey, viewerRole, viewerId } = await requireWorkspaceStaffSession();
  const { id } = await params;

  const [supportData, liveSession] = await Promise.all([
    getWorkspaceLiveSessionSupportData({
      schoolKey,
      viewerRole,
      viewerId,
    }),
    getWorkspaceLiveSessionById({
      schoolKey,
      viewerRole,
      viewerId,
      liveSessionId: id,
    }),
  ]);

  return (
    <PageShell width="wide" padding="standard">
      <div className="app-course-page">
        <PageHero
          className="app-learning-hero"
          eyebrow="Teaching"
          title="Edit Live Class"
          variant="editor"
          density="compact"
          description="Update timing, links, targeting, or the host teacher before the session begins."
          actions={
            <ReturnBackButton
              fallbackPath={liveSession ? `/workspace/live-classes/${liveSession._id}` : "/workspace/live-classes"}
              label="Back"
            />
          }
        />

        {liveSession ? (
          <LiveSessionEditorClient
            mode="edit"
            supportData={supportData}
            initialSession={liveSession}
          />
        ) : (
          <div className="app-feedback app-feedback-error">
            Live class not found.
          </div>
        )}
      </div>
    </PageShell>
  );
}
