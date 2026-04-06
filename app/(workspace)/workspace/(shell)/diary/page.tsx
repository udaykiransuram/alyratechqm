import { ArrowRight, Plus } from "lucide-react";

import DiaryBoardFiltersClient from "@/components/diary/DiaryBoardFiltersClient";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ListPaginationLinks from "@/components/ui/list-pagination-links";
import { formatDiaryDateLabel, getTodayDiaryEntryDate } from "@/lib/diary/shared";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import { getWorkspaceDiarySupportData, listWorkspaceDiaryEntries } from "@/lib/server/diary";
import {
  requireWorkspaceStaffSession,
  resolveWorkspaceListPage,
} from "@/lib/server/workspace-user-directory";

const DIARY_BASE_PATH = "/workspace/diary";
const DIARY_PAGE_SIZE = 10;

type DiaryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDiaryEntryStatusLabel(status: string) {
  return status === "published" ? "Published" : "Draft";
}

function getDiaryEntryStatusVariant(status: string) {
  return status === "published" ? "success" : "warning";
}

function formatDiarySectionScope(
  sections: Array<{
    name: string;
  }>,
) {
  return sections.length > 0
    ? sections.map((section) => section.name).join(", ")
    : "All sections in the selected class";
}

function getDiaryContentLabels(content: {
  hasLessonSummary: boolean;
  hasHomework: boolean;
  hasTeacherNote: boolean;
  resourceCount: number;
}) {
  const labels: string[] = [];

  if (content.hasLessonSummary) {
    labels.push("Lesson");
  }
  if (content.hasHomework) {
    labels.push("Homework");
  }
  if (content.hasTeacherNote) {
    labels.push("Teacher Note");
  }
  if (content.resourceCount > 0) {
    labels.push(
      `${content.resourceCount} Resource${content.resourceCount === 1 ? "" : "s"}`,
    );
  }

  return labels;
}

function getSearchParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function DiaryPage({ searchParams }: DiaryPageProps) {
  const { schoolKey, viewerId } = await requireWorkspaceStaffSession();
  const resolvedSearchParams = await searchParams;
  const requestedPage = resolveWorkspaceListPage(resolvedSearchParams?.page);

  const selectedDate =
    getSearchParam(resolvedSearchParams, "entryDate") || getTodayDiaryEntryDate();
  const selectedClassId = getSearchParam(resolvedSearchParams, "classId") || "all";
  const selectedSectionId = getSearchParam(resolvedSearchParams, "sectionId") || "all";
  const selectedSubjectId = getSearchParam(resolvedSearchParams, "subjectId") || "all";
  const selectedStatus = getSearchParam(resolvedSearchParams, "status") || "all";

  const [supportData, diaryDirectory] = await Promise.all([
    getWorkspaceDiarySupportData({
      schoolKey,
      viewerId,
    }),
    listWorkspaceDiaryEntries({
      schoolKey,
      viewerId,
      filters: {
        entryDate: selectedDate,
        classId: selectedClassId !== "all" ? selectedClassId : undefined,
        sectionId: selectedSectionId !== "all" ? selectedSectionId : undefined,
        subjectId: selectedSubjectId !== "all" ? selectedSubjectId : undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
      },
      page: requestedPage,
      limit: DIARY_PAGE_SIZE,
    }),
  ]);
  const entries = diaryDirectory.entries;
  const totalEntries = diaryDirectory.total;
  const page = diaryDirectory.page;
  const pages = diaryDirectory.pages;

  const filteredSections =
    selectedClassId !== "all"
      ? supportData.sections.filter((section) => {
          const sectionClassId =
            typeof section.class === "string" ? section.class : section.class?._id || "";
          return !sectionClassId || sectionClassId === selectedClassId;
        })
      : supportData.sections;
  const canCreateDiary =
    supportData.classes.length > 0 && supportData.subjects.length > 0;
  const buildDiaryPageHref = (nextPage: number) => {
    const nextSearchParams = new URLSearchParams();

    nextSearchParams.set("entryDate", selectedDate);
    if (selectedClassId !== "all") {
      nextSearchParams.set("classId", selectedClassId);
    }
    if (selectedSectionId !== "all") {
      nextSearchParams.set("sectionId", selectedSectionId);
    }
    if (selectedSubjectId !== "all") {
      nextSearchParams.set("subjectId", selectedSubjectId);
    }
    if (selectedStatus !== "all") {
      nextSearchParams.set("status", selectedStatus);
    }
    if (nextPage > 1) {
      nextSearchParams.set("page", String(nextPage));
    }

    const query = nextSearchParams.toString();
    return `${DIARY_BASE_PATH}${query ? `?${query}` : ""}`;
  };
  const currentPath = buildDiaryPageHref(page);
  const previousHref = page > 1 ? buildDiaryPageHref(page - 1) : null;
  const nextHref = page < pages ? buildDiaryPageHref(page + 1) : null;

  return (
    <PageShell width="wide" padding="standard">
      <div className="app-diary-page">
        <PageHero
          className="app-learning-hero"
          variant="directory"
          density="compact"
          eyebrow="Daily Learning"
          title="E-Diary"
          description="Plan one school day at a time, publish subject-specific instructions, and track who has seen or completed the work."
          actions={
            canCreateDiary ? (
              <Button asChild className="app-button-page">
                <AppPrefetchLink href="/workspace/diary/create">
                  <Plus className="h-4 w-4" />
                  Create Diary Entry
                </AppPrefetchLink>
              </Button>
            ) : undefined
          }
          meta={
            <>
              <span className="app-meta-chip">
                {formatDiaryDateLabel(selectedDate) || selectedDate}
              </span>
              <span className="app-meta-chip">Date-first board</span>
            </>
          }
          stats={[
            {
              label: "Entries",
              value: String(totalEntries),
              meta: "Matching the current date and filters.",
            },
            {
              label: "This page",
              value: String(entries.length),
              meta: "Entries loaded in the current slice.",
            },
            {
              label: "Published",
              value: String(entries.filter((entry) => entry.status === "published").length),
              meta: "Visible to students in scope.",
            },
            {
              label: "Assigned students",
              value: String(
                entries.reduce(
                  (sum, entry) => sum + Number(entry.progressSummary.assignedStudents || 0),
                  0,
                ),
              ),
              meta: "Across the matching diary entries.",
            },
          ]}
          toolbar={
            <DiaryBoardFiltersClient
              variant="embedded"
              date={selectedDate}
              defaultDate={getTodayDiaryEntryDate()}
              classId={selectedClassId}
              classOptions={supportData.classes.map((item) => ({
                value: item._id,
                label: item.name,
                description: item.description,
              }))}
              sectionId={selectedSectionId}
              sectionOptions={filteredSections.map((section) => ({
                value: section._id,
                label: section.name,
                description:
                  typeof section.class === "object" ? section.class?.name : undefined,
              }))}
              subjectId={selectedSubjectId}
              subjectOptions={supportData.subjects.map((subject) => ({
                value: subject._id,
                label: subject.name,
                description: subject.code || subject.description,
              }))}
              status={selectedStatus}
              statusOptions={[
                { value: "draft", label: "Draft" },
                { value: "published", label: "Published" },
              ]}
              showClassFilter
              showSectionFilter
              showStatusFilter
            />
          }
        />

        {!canCreateDiary ? (
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Diary authoring is unavailable</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <p className="text-sm leading-6 text-muted-foreground">
                This account needs at least one assigned class and subject before it
                can create diary entries.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {totalEntries === 0 ? (
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>No diary entries found</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <p className="text-sm leading-6 text-muted-foreground">
                Create the first diary entry for this day, or widen the filters to see
                more subjects and classes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <ListPaginationLinks
              page={page}
              totalPages={pages}
              totalItems={totalEntries}
              pageSize={DIARY_PAGE_SIZE}
              itemLabel="entries"
              previousHref={previousHref}
              nextHref={nextHref}
            />
            <div className="app-diary-entry-list">
              {entries.map((entry) => {
                const viewHref = buildHrefWithReturnTo(
                  `/workspace/diary/${entry._id}`,
                  currentPath,
                );
                const editHref = buildHrefWithReturnTo(
                  `/workspace/diary/edit/${entry._id}`,
                  `/workspace/diary/${entry._id}`,
                );
                const sectionSummary = formatDiarySectionScope(
                  entry.assignedAcademicSections,
                );
                const authorLabel =
                  entry.updatedBy?.name || entry.author?.name || "";
                const contentLabels = getDiaryContentLabels(entry.content);
                const subline = [
                  sectionSummary,
                  authorLabel ? `Updated by ${authorLabel}` : null,
                ]
                  .filter(Boolean)
                  .join(" • ");

                return (
                  <Card key={entry._id} className="app-diary-entry-card">
                    <CardContent className="app-diary-list-row">
                      <div className="app-diary-list-main">
                        <div className="app-diary-list-badges">
                          <Badge variant={getDiaryEntryStatusVariant(entry.status)}>
                            {formatDiaryEntryStatusLabel(entry.status)}
                          </Badge>
                          {entry.subject?.name ? (
                            <Badge variant="outline">{entry.subject.name}</Badge>
                          ) : null}
                          {entry.class?.name ? (
                            <Badge variant="outline">{entry.class.name}</Badge>
                          ) : null}
                        </div>

                        <div className="space-y-1.5">
                          <CardTitle className="app-course-title">{entry.title}</CardTitle>
                          <p className="app-diary-list-subline">{subline}</p>
                        </div>

                        {contentLabels.length > 0 ? (
                          <div className="app-diary-list-content">
                            {contentLabels.map((label) => (
                              <Badge key={`${entry._id}-${label}`} variant="outline">
                                {label}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="app-diary-list-stats">
                        <div className="app-diary-list-stat">
                          <span className="app-diary-list-stat-label">Students</span>
                          <span className="app-diary-list-stat-value">
                            {entry.progressSummary.assignedStudents}
                          </span>
                        </div>
                        <div className="app-diary-list-stat">
                          <span className="app-diary-list-stat-label">Seen</span>
                          <span className="app-diary-list-stat-value">
                            {entry.progressSummary.seenStudents}
                          </span>
                        </div>
                        <div className="app-diary-list-stat">
                          <span className="app-diary-list-stat-label">Completed</span>
                          <span className="app-diary-list-stat-value">
                            {entry.progressSummary.completedStudents}
                          </span>
                        </div>
                      </div>

                      <div className="app-diary-list-actions">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="app-diary-list-button"
                        >
                          <AppPrefetchLink href={editHref}>Edit</AppPrefetchLink>
                        </Button>
                        <Button asChild size="sm" className="app-diary-list-button">
                          <AppPrefetchLink href={viewHref}>
                            Open Entry
                            <ArrowRight className="h-4 w-4" />
                          </AppPrefetchLink>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
