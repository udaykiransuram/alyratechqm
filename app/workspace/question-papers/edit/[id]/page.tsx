import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import QuestionPaperForm from "@/components/QuestionPaperForm";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
import {
  deriveSectionDefaultMarks,
  deriveSectionDefaultNegativeMarks,
} from "@/lib/question-paper/sections";
import { getWorkspaceQuestionPaperById } from "@/lib/server/workspace-assessment-data";
import {
  getWorkspaceClasses,
  getWorkspaceSections,
  getWorkspaceSubjects,
  getWorkspaceTagsWithSubjects,
} from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

function buildQuestionPaperInitialData(rawData: any) {
  return {
    _id: rawData._id,
    title: rawData.title ?? "",
    instructions: rawData.instructions ?? "",
    duration: rawData.duration ?? 60,
    passingMarks: rawData.passingMarks ?? 0,
    examDate: rawData.examDate ?? "",
    onlineEnabled: Boolean(rawData.onlineEnabled),
    onlineStartsAt: rawData.onlineStartsAt ?? "",
    onlineEndsAt: rawData.onlineEndsAt ?? "",
    classId: rawData.class?._id ?? "",
    assignedAcademicSectionIds: (rawData.assignedAcademicSections || []).map(
      (section: any) => String(section?._id || section),
    ),
    sections: (rawData.sections || []).map((section: any, sectionIndex: number) => ({
      id: section._id || `section-${sectionIndex + 1}`,
      name: section.name ?? "",
      description: section.description ?? "",
      instructions: section.instructions ?? "",
      defaultMarks: deriveSectionDefaultMarks(section, 1),
      defaultNegativeMarks: deriveSectionDefaultNegativeMarks(section, 0),
      questions: (section.questions || []).map((question: any) => ({
        question:
          typeof question.question === "object" && question.question
            ? question.question
            : {},
        marks: question.marks ?? section.marks ?? 1,
        negativeMarks: question.negativeMarks ?? 0,
      })),
    })),
  };
}

type EditQuestionPaperPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function EditQuestionPaperPage({
  params,
  searchParams,
}: EditQuestionPaperPageProps) {
  const { id = "" } = await params;
  const resolvedSearchParams = await searchParams;
  const { schoolKey } = await requireWorkspaceStaffSession();
  const rawReturnTo = Array.isArray(resolvedSearchParams?.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams?.returnTo;
  const backHref =
    getSafeReturnToPath(rawReturnTo) ||
    (id ? `/workspace/question-papers/view/${id}` : "/workspace/question-papers");

  const [paper, supportResults] = await Promise.all([
    id ? getWorkspaceQuestionPaperById(schoolKey, id) : Promise.resolve(null),
    Promise.allSettled([
      getWorkspaceClasses(schoolKey),
      getWorkspaceSections(schoolKey),
      getWorkspaceSubjects(schoolKey),
      getWorkspaceTagsWithSubjects(schoolKey),
    ]),
  ]);

  let supportMessage: string | null = null;
  const classes =
    supportResults[0]?.status === "fulfilled" ? supportResults[0].value : [];
  const sections =
    supportResults[1]?.status === "fulfilled" ? supportResults[1].value : [];
  const subjects =
    supportResults[2]?.status === "fulfilled" ? supportResults[2].value : [];
  const tags =
    supportResults[3]?.status === "fulfilled" ? supportResults[3].value.tags : [];

  if (supportResults.some((result) => result.status === "rejected")) {
    supportMessage =
      "Some editor options could not be loaded. You can still edit the paper, but class, section, or tag controls may be limited until you refresh.";
  }

  if (!paper) {
    return (
      <PageShell width="wide" padding="standard">
        <PageHero
          variant="editor"
          eyebrow="Assessments"
          title="Edit Question Paper"
          description="The requested paper could not be loaded."
          actions={
            <Button asChild variant="outline" className="app-button-back">
              <AppPrefetchLink href={backHref}>Back</AppPrefetchLink>
            </Button>
          }
        />
        <div className="app-empty-state">Question paper not found.</div>
      </PageShell>
    );
  }

  return (
    <QuestionPaperForm
      initialData={buildQuestionPaperInitialData(paper)}
      isEditMode
      initialClasses={classes}
      initialSubjects={subjects}
      initialTags={tags}
      initialAcademicSections={sections}
      initialSupportDataLoaded
      initialSupportMessage={supportMessage}
    />
  );
}
