import FeedbackNotice from "@/components/ui/feedback-notice";
import PageShell from "@/components/layout/PageShell";
import QuestionPapersPageShell from "@/components/workspace/question-papers/QuestionPapersPageShell";
import {
  getWorkspaceQuestionPaperSupportData,
  listWorkspaceQuestionPapers,
} from "@/lib/server/workspace-question-papers";
import {
  requireWorkspaceStaffSession,
  resolveWorkspaceListPage,
} from "@/lib/server/workspace-user-directory";

const QUESTION_PAPERS_PAGE_SIZE = 20;
const QUESTION_PAPERS_PATH = "/workspace/question-papers";

type QuestionPapersPageProps = {
  searchParams: Promise<{
    page?: string | string[];
    class?: string | string[];
    academicSectionId?: string | string[];
    search?: string | string[];
  }>;
};

function cloneForClientTransport<T>(value: T): T {
  if (typeof value === "undefined") {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveSearchParam(value: string | string[] | undefined) {
  return String(Array.isArray(value) ? value[0] : value || "").trim();
}


export default async function QuestionPapersPage({
  searchParams,
}: QuestionPapersPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedPage = resolveWorkspaceListPage(resolvedSearchParams?.page);
  const requestedClassId = resolveSearchParam(resolvedSearchParams?.class);
  const requestedSectionId = resolveSearchParam(
    resolvedSearchParams?.academicSectionId,
  );
  const requestedSearch = resolveSearchParam(resolvedSearchParams?.search);

  const { schoolKey } = await requireWorkspaceStaffSession();

  try {
    const [supportData, papersData] = await Promise.all([
      getWorkspaceQuestionPaperSupportData({ schoolKey }),
      listWorkspaceQuestionPapers({
        schoolKey,
        summary: true,
        page: requestedPage,
        limit: QUESTION_PAPERS_PAGE_SIZE,
        classId: requestedClassId,
        sectionId: requestedSectionId,
        search: requestedSearch,
      }),
    ]);

    const clientSupportData = cloneForClientTransport(supportData);
    const clientPapersData = cloneForClientTransport(papersData);

    return (
      <QuestionPapersPageShell
        papers={clientPapersData.papers}
        classes={clientSupportData.classes}
        academicSections={clientSupportData.academicSections}
        schoolKey={schoolKey}
        totalPapers={Math.max(0, Number(clientPapersData.total) || 0)}
        page={Math.max(1, Number(clientPapersData.page) || requestedPage)}
        pages={Math.max(1, Number(clientPapersData.pages) || 1)}
        pageSize={Math.max(
          1,
          Number(clientPapersData.limit) || QUESTION_PAPERS_PAGE_SIZE,
        )}
        initialClassFilterId={clientPapersData.resolvedClassId || "all"}
        initialSectionFilterId={clientPapersData.resolvedSectionId || "all"}
        initialSearch={requestedSearch}
        basePath={QUESTION_PAPERS_PATH}
      />
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "We couldn't load question papers right now.";
    return (
      <PageShell width="wide" padding="standard">
        <FeedbackNotice variant="error">{message}</FeedbackNotice>
      </PageShell>
    );
  }
}
