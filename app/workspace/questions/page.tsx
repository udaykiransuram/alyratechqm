import dynamicComponent from "next/dynamic";

import FeedbackNotice from "@/components/ui/feedback-notice";
import PageShell from "@/components/layout/PageShell";
import {
  getWorkspaceQuestionSupportData,
  listWorkspaceQuestions,
} from "@/lib/server/workspace-questions";
import {
  requireWorkspaceStaffSession,
  resolveWorkspaceListPage,
} from "@/lib/server/workspace-user-directory";

const QUESTIONS_PAGE_SIZE = 24;
const QUESTIONS_PATH = "/workspace/questions";
const QuestionsDirectoryClient = dynamicComponent(
  () => import("@/components/workspace/QuestionsDirectoryClient"),
);

type QuestionsPageProps = {
  searchParams: Promise<{
    page?: string | string[];
    limit?: string | string[];
    class?: string | string[];
    subject?: string | string[];
    tags?: string | string[];
    tagsMode?: string | string[];
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

function resolveQuestionsPageSize(value: string | string[] | undefined) {
  const numericValue = Number(resolveSearchParam(value));
  if (!Number.isFinite(numericValue) || numericValue < 1) {
    return QUESTIONS_PAGE_SIZE;
  }
  return Math.min(100, Math.max(1, Math.floor(numericValue)));
}

export const dynamic = "force-dynamic";

export default async function ViewQuestionsPage({
  searchParams,
}: QuestionsPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedPage = resolveWorkspaceListPage(resolvedSearchParams?.page);
  const requestedLimit = resolveQuestionsPageSize(resolvedSearchParams?.limit);
  const requestedClassId = resolveSearchParam(resolvedSearchParams?.class);
  const requestedSubjectId = resolveSearchParam(resolvedSearchParams?.subject);
  const requestedSearch = resolveSearchParam(resolvedSearchParams?.search);
  const requestedTagIds = resolveSearchParam(resolvedSearchParams?.tags)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const requestedTagsMode =
    resolveSearchParam(resolvedSearchParams?.tagsMode).toLowerCase() === "and"
      ? "and"
      : "or";

  const { schoolKey } = await requireWorkspaceStaffSession();

  try {
    const [supportData, questionsData] = await Promise.all([
      getWorkspaceQuestionSupportData({
        schoolKey,
        classId: requestedClassId,
      }),
      listWorkspaceQuestions({
        schoolKey,
        page: requestedPage,
        limit: requestedLimit,
        classId: requestedClassId,
        subjectId: requestedSubjectId,
        search: requestedSearch,
        tagIds: requestedTagIds,
        tagsMode: requestedTagsMode,
      }),
    ]);

    const clientSupportData = cloneForClientTransport(supportData);
    const clientQuestionsData = cloneForClientTransport(questionsData);

    return (
      <QuestionsDirectoryClient
        questions={clientQuestionsData.questions}
        classes={clientSupportData.classes}
        tags={clientSupportData.tags}
        subjects={clientSupportData.subjects}
        schoolKey={schoolKey}
        totalQuestions={Math.max(0, Number(clientQuestionsData.total) || 0)}
        page={Math.max(1, Number(clientQuestionsData.page) || requestedPage)}
        pages={Math.max(1, Number(clientQuestionsData.pages) || 1)}
        pageSize={Math.max(
          1,
          Number(clientQuestionsData.limit) || QUESTIONS_PAGE_SIZE,
        )}
        initialClassFilterId={clientQuestionsData.resolvedClassId}
        initialSubjectFilterId={clientQuestionsData.resolvedSubjectId}
        initialSearch={clientQuestionsData.resolvedSearch}
        initialTagIds={clientQuestionsData.resolvedTagIds}
        initialTagMode={clientQuestionsData.resolvedTagsMode}
        basePath={QUESTIONS_PATH}
      />
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "We couldn't load questions right now.";
    return (
      <PageShell width="wide" padding="standard">
        <FeedbackNotice variant="error">{message}</FeedbackNotice>
      </PageShell>
    );
  }
}
