import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
import QuestionPapersDirectoryClient from "@/components/workspace/QuestionPapersDirectoryClient";

import {
  getPaperQuestionCount,
  type QuestionPaperDirectoryAcademicSectionItem,
  type QuestionPaperDirectoryClassItem,
  type QuestionPaperDirectoryPaper,
} from "./question-paper-directory-shared";

type QuestionPapersPageShellProps = {
  papers: QuestionPaperDirectoryPaper[];
  classes: QuestionPaperDirectoryClassItem[];
  academicSections: QuestionPaperDirectoryAcademicSectionItem[];
  schoolKey: string;
  totalPapers: number;
  page: number;
  pages: number;
  pageSize: number;
  initialClassFilterId: string;
  initialSectionFilterId: string;
  initialSearch: string;
  basePath: string;
};

export default function QuestionPapersPageShell({
  papers,
  classes,
  academicSections,
  schoolKey,
  totalPapers,
  page,
  pages,
  pageSize,
  initialClassFilterId,
  initialSectionFilterId,
  initialSearch,
  basePath,
}: QuestionPapersPageShellProps) {
  const hasActiveFilters =
    initialClassFilterId !== "all" ||
    initialSectionFilterId !== "all" ||
    initialSearch.trim().length > 0;
  const selectedClassLabel =
    initialClassFilterId === "all"
      ? ""
      : classes.find((item) => item._id === initialClassFilterId)?.name ||
        "Selected class";
  const selectedSectionLabel =
    initialSectionFilterId === "all"
      ? ""
      : academicSections.find((item) => item._id === initialSectionFilterId)
          ?.name || "Selected section";
  const questionCountInPage = papers.reduce(
    (total, paper) => total + getPaperQuestionCount(paper),
    0,
  );
  const onlineEnabledCount = papers.filter((paper) =>
    Boolean(paper?.onlineEnabled),
  ).length;

  return (
    <PageShell width="wide" padding="standard" className="app-directory-stack">
      <PageHero
        variant="directory"
        density="compact"
        eyebrow="Assessments"
        title="Question Papers"
        description="Manage paper scope, responses, analytics, downloads, and report actions from one assessment directory built for school operations."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild className="app-button-page">
              <AppPrefetchLink
                href="/workspace/question-papers/create"
                prefetchOnMount
                relatedApiPrefetches={[
                  "/api/classes",
                  "/api/sections",
                  "/api/subjects",
                  "/api/tags/with-subjects",
                ]}
              >
                Create Paper
              </AppPrefetchLink>
            </Button>
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">
              {hasActiveFilters ? "Filtered directory" : "All papers"}
            </span>
            {selectedClassLabel ? (
              <span className="app-meta-chip">{selectedClassLabel}</span>
            ) : null}
            {selectedSectionLabel ? (
              <span className="app-meta-chip">{selectedSectionLabel}</span>
            ) : null}
          </>
        }
        stats={[
          {
            label: "Matched papers",
            value: String(totalPapers),
            meta: "Papers matching the current server-side filters.",
          },
          {
            label: "This page",
            value: String(papers.length),
            meta: "Rows currently loaded for this page.",
          },
          {
            label: "Questions in page",
            value: String(questionCountInPage),
            meta: "Questions represented in the currently visible rows.",
          },
          {
            label: "Online enabled",
            value: String(onlineEnabledCount),
            meta: "Online-enabled papers in the current page.",
          },
        ]}
      />

      <QuestionPapersDirectoryClient
        papers={papers}
        classes={classes}
        academicSections={academicSections}
        schoolKey={schoolKey}
        totalPapers={totalPapers}
        page={page}
        pages={pages}
        pageSize={pageSize}
        initialClassFilterId={initialClassFilterId}
        initialSectionFilterId={initialSectionFilterId}
        initialSearch={initialSearch}
        basePath={basePath}
      />
    </PageShell>
  );
}
