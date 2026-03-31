import { notFound } from "next/navigation";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import ReturnBackButton from "@/components/navigation/ReturnBackButton";
import QuestionImportReviewClient from "@/components/workspace/QuestionImportReviewClient";
import { summarizeQuestionImportReviewState } from "@/lib/question-import/review";
import { getWorkspaceQuestionImportDraft } from "@/lib/server/question-imports";
import {
  getWorkspaceClasses,
  getWorkspaceSections,
  getWorkspaceSubjects,
} from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

type QuestionImportReviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuestionImportReviewPage({
  params,
}: QuestionImportReviewPageProps) {
  const { id } = await params;
  const { schoolKey } = await requireWorkspaceStaffSession();

  const [draft, supportResults] = await Promise.all([
    id ? getWorkspaceQuestionImportDraft(schoolKey, id) : Promise.resolve(null),
    Promise.allSettled([
      getWorkspaceClasses(schoolKey),
      getWorkspaceSections(schoolKey),
      getWorkspaceSubjects(schoolKey),
    ]),
  ]);

  if (!draft) {
    notFound();
  }

  const classes =
    supportResults[0]?.status === "fulfilled" ? supportResults[0].value : [];
  const sections =
    supportResults[1]?.status === "fulfilled" ? supportResults[1].value : [];
  const subjects =
    supportResults[2]?.status === "fulfilled" ? supportResults[2].value : [];
  const reviewState = summarizeQuestionImportReviewState(draft.payload);

  return (
    <PageShell width="wide" padding="standard">
      <div className="space-y-4 sm:space-y-5">
        <PageHero
          variant="editor"
          density="compact"
          eyebrow="DOCX Import"
          title="Review Import Draft"
          description="Confirm the parsed paper setup, edit questions in a create-like workflow, and approve only the questions that should be published."
          actions={
            <ReturnBackButton fallbackPath="/workspace/upload" label="Back" />
          }
          meta={
            <>
              <span className="app-meta-chip">{draft.sourceFile.name}</span>
              <span className="app-meta-chip">
                Template v{draft.payload.templateVersion}
              </span>
              <span className="app-meta-chip">
                {reviewState.status === "ready_to_publish"
                  ? "Ready to publish"
                  : "Review required"}
              </span>
            </>
          }
          stats={[
            {
              label: "Questions",
              value: String(draft.payload.questions.length),
              meta: "Parsed question blocks currently in this draft.",
            },
            {
              label: "Sections",
              value: String(draft.payload.paperSections.length),
              meta: "Paper sections that will be created in the draft paper.",
            },
            {
              label: "Approved",
              value: String(reviewState.includedQuestions.filter(
                (question) => question.approvalStatus === "approved",
              ).length),
              meta: "Approved questions are eligible for publish.",
            },
            {
              label: "Blocking issues",
              value: String(
                reviewState.blockingWarnings.length +
                  reviewState.unmappedMathFragments.length +
                  reviewState.questionsMissingSubjectToken.length +
                  reviewState.missingSubjectMappings.length,
              ),
              meta: "Publish stays locked until these are resolved.",
            },
          ]}
        />

        <QuestionImportReviewClient
          initialDraft={draft}
          classes={classes}
          sections={sections}
          subjects={subjects}
        />
      </div>
    </PageShell>
  );
}
