import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import QuestionEditorClient from "@/components/workspace/QuestionEditorClient";
import PageHero from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
import { getWorkspaceQuestionById } from "@/lib/server/workspace-assessment-data";
import {
  getWorkspaceClasses,
  getWorkspaceSubjects,
  getWorkspaceTagsWithSubjects,
} from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

type EditQuestionPageProps = {
  params: { id: string };
  searchParams?: { returnTo?: string | string[] };
};

export default async function EditQuestionPage({
  params,
  searchParams,
}: EditQuestionPageProps) {
  const id = params.id || "";
  const { schoolKey } = await requireWorkspaceStaffSession();
  const rawReturnTo = Array.isArray(searchParams?.returnTo)
    ? searchParams?.returnTo[0]
    : searchParams?.returnTo;
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
      <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
        <PageHero
          eyebrow="Question Bank"
          title="Edit Question"
          description="The requested question could not be loaded."
          actions={
            <Button asChild variant="outline">
              <AppPrefetchLink href={backHref}>Back</AppPrefetchLink>
            </Button>
          }
        />
        <div className="app-empty-state">Question not found.</div>
      </div>
    );
  }

  return (
    <QuestionEditorClient
      mode="edit"
      questionId={id}
      initialQuestion={question}
      initialClasses={classes}
      initialSubjects={subjects}
      initialTags={tags}
      initialMessage={supportMessage}
    />
  );
}
