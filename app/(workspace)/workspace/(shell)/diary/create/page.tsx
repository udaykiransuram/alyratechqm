import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import ReturnBackButton from "@/components/navigation/ReturnBackButton";
import DiaryEditorClient from "@/components/workspace/diary/DiaryEditorClient";
import { getWorkspaceDiarySupportData } from "@/lib/server/diary";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

export default async function CreateDiaryPage() {
  const { schoolKey, viewerId } = await requireWorkspaceStaffSession();
  const supportData = await getWorkspaceDiarySupportData({
    schoolKey,
    viewerId,
  });
  const canAuthorDiary =
    supportData.classes.length > 0 && supportData.subjects.length > 0;

  return (
    <PageShell width="wide" padding="standard">
      <div className="app-diary-page">
        <PageHero
          className="app-learning-hero"
          variant="editor"
          density="compact"
          eyebrow="Daily Learning"
          title="Create Diary Entry"
          description="Capture one subject, one date, and one learner scope with clear daily instructions."
          actions={
            <ReturnBackButton fallbackPath="/workspace/diary" label="Cancel" />
          }
          meta={
            <>
              <span className="app-meta-chip">Diary builder</span>
              <span className="app-meta-chip">Student-ready</span>
            </>
          }
        />

        {canAuthorDiary ? (
          <DiaryEditorClient
            mode="create"
            returnToPath="/workspace/diary"
            classes={supportData.classes}
            sections={supportData.sections}
            subjects={supportData.subjects}
          />
        ) : (
          <div className="app-surface rounded-[1.25rem] border border-border/70 px-6 py-6 text-sm text-muted-foreground">
            Your account does not currently have enough class or subject access to
            create diary entries. Ask an administrator to update your teaching scope.
          </div>
        )}
      </div>
    </PageShell>
  );
}
