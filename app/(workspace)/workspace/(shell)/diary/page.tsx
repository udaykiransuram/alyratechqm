import { ArrowRight, Plus } from "lucide-react";

import DiaryBoardFiltersClient from "@/components/diary/DiaryBoardFiltersClient";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDiaryDateLabel, getTodayDiaryEntryDate } from "@/lib/diary/shared";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import { getWorkspaceDiarySupportData, listWorkspaceDiaryEntries } from "@/lib/server/diary";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

type DiaryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

  const selectedDate =
    getSearchParam(resolvedSearchParams, "entryDate") || getTodayDiaryEntryDate();
  const selectedClassId = getSearchParam(resolvedSearchParams, "classId") || "all";
  const selectedSectionId = getSearchParam(resolvedSearchParams, "sectionId") || "all";
  const selectedSubjectId = getSearchParam(resolvedSearchParams, "subjectId") || "all";
  const selectedStatus = getSearchParam(resolvedSearchParams, "status") || "all";

  const [supportData, entries] = await Promise.all([
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
    }),
  ]);

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
              value: String(entries.length),
              meta: "Matching the current date and filters.",
            },
            {
              label: "Published",
              value: String(entries.filter((entry) => entry.status === "published").length),
              meta: "Visible to students in scope.",
            },
            {
              label: "Drafts",
              value: String(entries.filter((entry) => entry.status === "draft").length),
              meta: "Internal only.",
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

        {entries.length === 0 ? (
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
          <div className="app-diary-board-grid">
            {entries.map((entry) => {
              const viewHref = buildHrefWithReturnTo(
                `/workspace/diary/${entry._id}`,
                "/workspace/diary",
              );
              const editHref = buildHrefWithReturnTo(
                `/workspace/diary/edit/${entry._id}`,
                `/workspace/diary/${entry._id}`,
              );

              return (
                <Card key={entry._id} className="app-diary-entry-card flex flex-col">
                  <CardHeader className="app-section-header space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge className="capitalize">{entry.status}</Badge>
                      {entry.subject?.name ? (
                        <Badge variant="outline">{entry.subject.name}</Badge>
                      ) : null}
                      {entry.class?.name ? (
                        <Badge variant="outline">{entry.class.name}</Badge>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <CardTitle className="app-course-title">{entry.title}</CardTitle>
                      <p className="app-course-summary">
                        {entry.assignedAcademicSections.length > 0
                          ? entry.assignedAcademicSections
                              .map((section) => section.name)
                              .join(", ")
                          : "All sections in the selected class"}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="app-section-body flex flex-1 flex-col gap-4">
                    <div className="app-course-metric-grid">
                      <div className="app-course-metric-card">
                        <p className="app-course-metric-label">Students</p>
                        <p className="app-course-metric-value">
                          {entry.progressSummary.assignedStudents}
                        </p>
                      </div>
                      <div className="app-course-metric-card">
                        <p className="app-course-metric-label">Seen</p>
                        <p className="app-course-metric-value">
                          {entry.progressSummary.seenStudents}
                        </p>
                      </div>
                      <div className="app-course-metric-card">
                        <p className="app-course-metric-label">Completed</p>
                        <p className="app-course-metric-value">
                          {entry.progressSummary.completedStudents}
                        </p>
                      </div>
                      <div className="app-course-metric-card">
                        <p className="app-course-metric-label">Content</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {entry.content.hasLessonSummary ? (
                            <Badge variant="outline">Lesson</Badge>
                          ) : null}
                          {entry.content.hasHomework ? (
                            <Badge variant="outline">Homework</Badge>
                          ) : null}
                          {entry.content.hasTeacherNote ? (
                            <Badge variant="outline">Teacher Note</Badge>
                          ) : null}
                          {entry.content.resourceCount > 0 ? (
                            <Badge variant="outline">
                              {entry.content.resourceCount} Resource
                              {entry.content.resourceCount === 1 ? "" : "s"}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="app-course-action-row">
                      <Button
                        asChild
                        variant="outline"
                        className="app-button-compact-secondary app-course-action-button"
                      >
                        <AppPrefetchLink href={editHref}>Edit</AppPrefetchLink>
                      </Button>
                      <Button asChild className="app-button-compact-primary app-course-action-button">
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
        )}
      </div>
    </PageShell>
  );
}
