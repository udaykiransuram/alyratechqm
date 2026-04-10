import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import ReturnBackButton from "@/components/navigation/ReturnBackButton";
import LiveSessionEditorClient from "@/components/live-sessions/LiveSessionEditorClient";
import { getWorkspaceLiveSessionSupportData } from "@/lib/server/live-sessions";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export default async function CreateLiveClassPage() {
  const { schoolKey, viewerRole, viewerId } = await requireWorkspaceStaffSession();
  const supportData = await getWorkspaceLiveSessionSupportData({
    schoolKey,
    viewerRole,
    viewerId,
  });

  return (
    <PageShell width="wide" padding="standard">
      <div className="app-course-page">
        <PageHero
          className="app-learning-hero"
          eyebrow="Teaching"
          title="Schedule Live Class"
          variant="editor"
          density="compact"
          description="Create a single live session, target the right class and sections, and trigger student reminders automatically."
          actions={
            <ReturnBackButton
              fallbackPath="/workspace/live-classes"
              label="Back"
            />
          }
          meta={
            <>
              <span className="app-meta-chip">Meeting-link first</span>
              <span className="app-meta-chip">Attendance ready</span>
            </>
          }
        />

        <LiveSessionEditorClient mode="create" supportData={supportData} />
      </div>
    </PageShell>
  );
}
