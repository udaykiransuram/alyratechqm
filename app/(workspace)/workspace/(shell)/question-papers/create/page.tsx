import dynamicComponent from "next/dynamic";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import ReturnBackButton from "@/components/navigation/ReturnBackButton";
import QuestionPaperFormLoadingState from "@/components/QuestionPaperFormLoadingState";
import {
  getWorkspaceClasses,
  getWorkspaceSections,
  getWorkspaceSubjects,
  getWorkspaceTagsWithSubjects,
} from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

const CreateQuestionPaperPageClient = dynamicComponent(
  () => import("./CreateQuestionPaperPageClient"),
  {
    loading: () => <QuestionPaperFormLoadingState />,
  },
);

export default async function CreateQuestionPaperPage() {
  const { schoolKey } = await requireWorkspaceStaffSession();

  let classes: Awaited<ReturnType<typeof getWorkspaceClasses>> = [];
  let sections: Awaited<ReturnType<typeof getWorkspaceSections>> = [];
  let subjects: Awaited<ReturnType<typeof getWorkspaceSubjects>> = [];
  let tags: Awaited<ReturnType<typeof getWorkspaceTagsWithSubjects>>["tags"] = [];
  let initialMessage: string | null = null;

  try {
    const [
      resolvedClasses,
      resolvedSections,
      resolvedSubjects,
      tagResult,
    ] = await Promise.all([
      getWorkspaceClasses(schoolKey),
      getWorkspaceSections(schoolKey),
      getWorkspaceSubjects(schoolKey),
      getWorkspaceTagsWithSubjects(schoolKey),
    ]);
    classes = resolvedClasses;
    sections = resolvedSections;
    subjects = resolvedSubjects;
    tags = tagResult.tags;
  } catch (error) {
    initialMessage =
      error instanceof Error
        ? error.message
        : "Failed to load question paper setup data.";
  }

  return (
    <PageShell width="wide" padding="standard">
      <div className="space-y-4 sm:space-y-5">
        <PageHero
          variant="editor"
          density="compact"
          eyebrow="Assessments"
          title="Create Question Paper"
          description="Build a new paper with consistent sections, question selection, and scoring rules."
          actions={
            <ReturnBackButton
              fallbackPath="/workspace/question-papers"
              label="Cancel"
            />
          }
          meta={
            <>
              <span className="app-meta-chip">Paper builder</span>
              <span className="app-meta-chip">Offline / online configurable</span>
            </>
          }
          stats={[
            {
              label: "Sections",
              value: "0",
              meta: "Add sections, defaults, and questions as you build the paper.",
            },
            {
              label: "Questions",
              value: "0",
              meta: "The builder will organize questions section by section.",
            },
            {
              label: "Total marks",
              value: "0",
              meta: "Marks will accumulate as sections and questions are configured.",
            },
          ]}
        />

        <CreateQuestionPaperPageClient
          initialClasses={classes}
          initialSections={sections}
          initialSubjects={subjects}
          initialTags={tags}
          initialMessage={initialMessage}
        />
      </div>
    </PageShell>
  );
}
