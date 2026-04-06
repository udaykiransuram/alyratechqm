import dynamicComponent from "next/dynamic";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import ReturnBackButton from "@/components/navigation/ReturnBackButton";
import QuestionEditorLoadingState from "@/components/workspace/QuestionEditorLoadingState";
import {
  getWorkspaceClasses,
  getWorkspaceSubjects,
  getWorkspaceTagsWithSubjects,
} from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


const QuestionEditorClient = dynamicComponent(
  () => import("@/components/workspace/QuestionEditorClient"),
  {
    loading: () => <QuestionEditorLoadingState />,
  },
);

export default async function CreateQuestionPage() {
  const { schoolKey } = await requireWorkspaceStaffSession();

  let classes: Awaited<ReturnType<typeof getWorkspaceClasses>> = [];
  let subjects: Awaited<ReturnType<typeof getWorkspaceSubjects>> = [];
  let tags: Awaited<ReturnType<typeof getWorkspaceTagsWithSubjects>>["tags"] = [];
  let initialMessage: string | null = null;

  try {
    const [resolvedClasses, resolvedSubjects, tagResult] = await Promise.all([
      getWorkspaceClasses(schoolKey),
      getWorkspaceSubjects(schoolKey),
      getWorkspaceTagsWithSubjects(schoolKey),
    ]);
    classes = resolvedClasses;
    subjects = resolvedSubjects;
    tags = tagResult.tags;
  } catch (error) {
    initialMessage =
      error instanceof Error
        ? error.message
        : "Failed to load question setup data.";
  }

  return (
    <PageShell width="wide" padding="standard">
      <div className="space-y-3.5 sm:space-y-4">
        <PageHero
          variant="editor"
          density="compact"
          eyebrow="Question Bank"
          title="Create Question"
          description="Write the prompt, set the answer model, and attach the right metadata before the question enters the bank."
          actions={
            <ReturnBackButton fallbackPath="/workspace/questions" label="Back" />
          }
          meta={
            <>
              <span className="app-meta-chip">Question authoring</span>
              <span className="app-meta-chip">Cleaner setup flow</span>
            </>
          }
        />

        <QuestionEditorClient
          mode="create"
          initialClasses={classes}
          initialSubjects={subjects}
          initialTags={tags}
          initialMessage={initialMessage}
        />
      </div>
    </PageShell>
  );
}
