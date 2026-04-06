import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import ReturnBackButton from "@/components/navigation/ReturnBackButton";
import DiaryEditorClient from "@/components/workspace/diary/DiaryEditorClient";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
import { getWorkspaceDiaryById, getWorkspaceDiarySupportData } from "@/lib/server/diary";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


type EditDiaryPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function EditDiaryPage({
  params,
  searchParams,
}: EditDiaryPageProps) {
  const { schoolKey, viewerId } = await requireWorkspaceStaffSession();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const rawReturnTo = Array.isArray(resolvedSearchParams?.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams?.returnTo;
  const returnToPath = getSafeReturnToPath(rawReturnTo) || `/workspace/diary/${id}`;

  const [supportData, entry] = await Promise.all([
    getWorkspaceDiarySupportData({
      schoolKey,
      viewerId,
    }),
    getWorkspaceDiaryById({
      schoolKey,
      entryId: id,
      viewerId,
    }),
  ]);

  if (!entry) {
    return (
      <PageShell width="wide" padding="standard">
        <PageHero
          variant="editor"
          density="compact"
          eyebrow="Daily Learning"
          title="Diary Entry"
          description="The requested diary entry could not be loaded."
          actions={<ReturnBackButton fallbackPath="/workspace/diary" label="Back to Diary" />}
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide" padding="standard">
      <div className="app-diary-page">
        <PageHero
          className="app-learning-hero"
          variant="editor"
          density="compact"
          eyebrow="Daily Learning"
          title={`Edit ${entry.title}`}
          description="Update the daily notes, resources, and learner scope."
          actions={<ReturnBackButton fallbackPath={returnToPath} label="Back" />}
          meta={
            <>
              <span className="app-meta-chip capitalize">{entry.status}</span>
              {entry.class?.name ? (
                <span className="app-meta-chip">{entry.class.name}</span>
              ) : null}
              {entry.subject?.name ? (
                <span className="app-meta-chip">{entry.subject.name}</span>
              ) : null}
              <span className="app-meta-chip">
                {entry.resources.length} resource{entry.resources.length === 1 ? "" : "s"}
              </span>
            </>
          }
        />

        <DiaryEditorClient
          mode="edit"
          entryId={id}
          returnToPath={returnToPath}
          classes={supportData.classes}
          sections={supportData.sections}
          subjects={supportData.subjects}
          initialEntry={entry}
        />
      </div>
    </PageShell>
  );
}
