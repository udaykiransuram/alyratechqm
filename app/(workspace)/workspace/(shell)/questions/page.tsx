import dynamicComponent from "next/dynamic";
import { Plus } from "lucide-react";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import PageHero from "@/components/layout/PageHero";
import FeedbackNotice from "@/components/ui/feedback-notice";
import PageShell from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
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

function countAppliedQuestionFilters({
  classId,
  subjectId,
  tagIds,
  search,
}: {
  classId: string;
  subjectId: string;
  tagIds: string[];
  search: string;
}) {
  return (
    (classId ? 1 : 0) +
    (subjectId ? 1 : 0) +
    (tagIds.length > 0 ? 1 : 0) +
    (search.trim() ? 1 : 0)
  );
}

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
    const appliedFilterCount = countAppliedQuestionFilters({
      classId: clientQuestionsData.resolvedClassId,
      subjectId: clientQuestionsData.resolvedSubjectId,
      tagIds: clientQuestionsData.resolvedTagIds,
      search: clientQuestionsData.resolvedSearch,
    });
    const appliedTagModeLabel =
      Array.isArray(clientQuestionsData.resolvedTagIds) &&
      clientQuestionsData.resolvedTagIds.length > 1
        ? clientQuestionsData.resolvedTagsMode === "all"
          ? "All selected tags"
          : "Any selected tag"
        : null;

    return (
      <PageShell width="wide" padding="standard" className="app-directory-stack">
        <PageHero
          variant="directory"
          density="compact"
          eyebrow="Question Bank"
          title="Questions"
          description="Search, filter, and review the question bank from one directory built for assessment authorship and quick paper-building."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" className="app-button-page">
                <AppPrefetchLink href="/workspace/questions/bulk-upload">
                  Bulk Upload
                </AppPrefetchLink>
              </Button>
              <Button asChild className="app-button-page">
                <AppPrefetchLink
                  href="/workspace/questions/create"
                  prefetchOnMount
                  relatedApiPrefetches={[
                    "/api/classes",
                    "/api/subjects",
                    "/api/tags/with-subjects",
                  ]}
                >
                  <Plus className="h-4 w-4" />
                  Create Question
                </AppPrefetchLink>
              </Button>
            </div>
          }
          meta={
            <>
              <span className="app-meta-chip">
                {appliedFilterCount === 0
                  ? "All questions"
                  : `${appliedFilterCount} active filter${appliedFilterCount === 1 ? "" : "s"}`}
              </span>
              {appliedTagModeLabel ? (
                <span className="app-meta-chip">{appliedTagModeLabel}</span>
              ) : null}
            </>
          }
          stats={[
            {
              label: "Questions",
              value: String(Math.max(0, Number(clientQuestionsData.total) || 0)),
              meta: "Current filtered result count.",
            },
            {
              label: "Available classes",
              value: String(clientSupportData.classes.length),
              meta: "School class filters.",
            },
            {
              label: "Tag library",
              value: String(clientSupportData.tags.length),
              meta: "Reusable tag filters.",
            },
            {
              label: "Current page",
              value: `${Math.max(1, Number(clientQuestionsData.page) || requestedPage)} / ${Math.max(1, Number(clientQuestionsData.pages) || 1)}`,
              meta: "Server-paginated view.",
            },
          ]}
        />

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
      </PageShell>
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
