import dynamicComponent from "next/dynamic";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import ReturnBackButton from "@/components/navigation/ReturnBackButton";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
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

type CreateQuestionPaperPageProps = {
  searchParams?: Promise<{ returnTo?: string | string[] }>;
};

export default async function CreateQuestionPaperPage({
  searchParams,
}: CreateQuestionPaperPageProps) {
  const { schoolKey } = await requireWorkspaceStaffSession();
  const resolvedSearchParams = await searchParams;
  const rawReturnTo = Array.isArray(resolvedSearchParams?.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams?.returnTo;
  const returnToPath = getSafeReturnToPath(rawReturnTo);

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
      <div className="space-y-3.5 sm:space-y-4">
        <PageHero
          variant="editor"
          density="compact"
          eyebrow="Assessments"
          title="Create Question Paper"
          description="Set the paper structure, section defaults, and question mix in one cleaner builder."
          actions={
            <ReturnBackButton
              fallbackPath={returnToPath || "/workspace/question-papers"}
              label="Cancel"
            />
          }
          meta={
            <>
              <span className="app-meta-chip">Section-based builder</span>
              <span className="app-meta-chip">Online or offline delivery</span>
            </>
          }
        />

        <CreateQuestionPaperPageClient
          initialClasses={classes}
          initialSections={sections}
          initialSubjects={subjects}
          initialTags={tags}
          initialMessage={initialMessage}
          returnTo={returnToPath || null}
        />
      </div>
    </PageShell>
  );
}
