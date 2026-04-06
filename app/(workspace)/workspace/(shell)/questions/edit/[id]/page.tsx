import dynamicComponent from "next/dynamic";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import ReturnBackButton from "@/components/navigation/ReturnBackButton";
import QuestionEditorLoadingState from "@/components/workspace/QuestionEditorLoadingState";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
import { getWorkspaceQuestionById } from "@/lib/server/workspace-assessment-data";
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

type EditQuestionPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function EditQuestionPage({
  params,
  searchParams,
}: EditQuestionPageProps) {
  const { id = "" } = await params;
  const resolvedSearchParams = await searchParams;
  const { schoolKey } = await requireWorkspaceStaffSession();
  const rawReturnTo = Array.isArray(resolvedSearchParams?.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams?.returnTo;
  const backHref = getSafeReturnToPath(rawReturnTo) || "/workspace/questions";

  const [question, supportResults] = await Promise.all([
    id ? getWorkspaceQuestionById(schoolKey, id) : Promise.resolve(null),
    Promise.allSettled([
      getWorkspaceClasses(schoolKey),
      getWorkspaceSubjects(schoolKey),
      getWorkspaceTagsWithSubjects(schoolKey),
    ]),
  ]);

  const classes =
    supportResults[0]?.status === "fulfilled" ? supportResults[0].value : [];
  const subjects =
    supportResults[1]?.status === "fulfilled" ? supportResults[1].value : [];
  const tags =
    supportResults[2]?.status === "fulfilled" ? supportResults[2].value.tags : [];
  const supportMessage = supportResults.some((result) => result.status === "rejected")
    ? "Some question metadata options could not be loaded. You can still edit the content, but class, subject, or tag controls may be limited until you refresh."
    : null;

  if (!question) {
    return (
      <PageShell width="wide" padding="standard">
        <PageHero
          variant="editor"
          eyebrow="Question Bank"
          title="Edit Question"
          description="The requested question could not be loaded."
          actions={
            <ReturnBackButton fallbackPath={backHref} label="Back" />
          }
        />
        <div className="app-empty-state">Question not found.</div>
      </PageShell>
    );
  }

  return (
    <PageShell width="wide" padding="standard">
      <div className="space-y-3.5 sm:space-y-4">
        <PageHero
          variant="editor"
          density="compact"
          eyebrow="Question Bank"
          title="Edit Question"
          description="Refine the prompt, metadata, and answer configuration without leaving the authoring flow."
          actions={<ReturnBackButton fallbackPath={backHref} label="Back" />}
          meta={
            <>
              <span className="app-meta-chip">Question maintenance</span>
              <span className="app-meta-chip">Focused editing</span>
            </>
          }
        />

        <QuestionEditorClient
          mode="edit"
          questionId={id}
          initialQuestion={question}
          initialClasses={classes}
          initialSubjects={subjects}
          initialTags={tags}
          initialMessage={supportMessage}
        />
      </div>
    </PageShell>
  );
}
