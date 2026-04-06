import QuestionPaperResponsesPageClient from "@/components/workspace/question-paper-responses/QuestionPaperResponsesPageClient";
import {
  getWorkspacePaperResponsesSummary,
  type WorkspacePaperResponsesSummaryData,
} from "@/lib/server/workspace-paper-responses";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

const PAPER_RESPONSES_PAGE_SIZE = 40;

type QuestionPaperResponsesPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string | string[];
    academicSectionId?: string | string[];
  }>;
};

function resolveSearchValue(value: string | string[] | undefined) {
  return String(Array.isArray(value) ? value[0] : value || "").trim();
}

function resolvePositiveInteger(value: string) {
  const parsed = Number(value || "");
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

const EMPTY_INITIAL_DATA: WorkspacePaperResponsesSummaryData = {
  responses: [],
  academicSections: [],
  total: 0,
  page: 1,
  pages: 1,
  limit: PAPER_RESPONSES_PAGE_SIZE,
};


export default async function QuestionPaperResponsesPage({
  params,
  searchParams,
}: QuestionPaperResponsesPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const { schoolKey } = await requireWorkspaceStaffSession();

  const selectedAcademicSection =
    resolveSearchValue(resolvedSearchParams.academicSectionId) || "all";
  const requestedPage = resolvePositiveInteger(
    resolveSearchValue(resolvedSearchParams.page),
  );

  let initialData = EMPTY_INITIAL_DATA;
  let initialError: string | null = null;

  try {
    initialData = await getWorkspacePaperResponsesSummary({
      schoolKey,
      paperId: id,
      academicSectionId:
        selectedAcademicSection === "all" ? undefined : selectedAcademicSection,
      page: requestedPage,
      limit: PAPER_RESPONSES_PAGE_SIZE,
    });
  } catch (error) {
    initialError =
      error instanceof Error
        ? error.message
        : "The response list could not be loaded.";
  }

  return (
    <QuestionPaperResponsesPageClient
      paperId={id}
      schoolKey={schoolKey}
      initialData={initialData}
      initialAcademicSection={selectedAcademicSection}
      initialError={initialError}
    />
  );
}
