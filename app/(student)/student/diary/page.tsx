import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import DiaryBoardFiltersClient from "@/components/diary/DiaryBoardFiltersClient";
import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { formatDiaryDateLabel, getTodayDiaryEntryDate } from "@/lib/diary/shared";
import { listStudentDiaryEntries } from "@/lib/server/diary";
import { getWorkspaceSubjects } from "@/lib/server/workspace-support-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StudentDiaryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function StudentDiaryPage({
  searchParams,
}: StudentDiaryPageProps) {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    session.user.accountType !== "school_user" ||
    session.user.role !== "student"
  ) {
    redirect("/auth/signin");
  }

  const schoolKey = String(session.user.schoolKey || "").trim();
  const studentId = String(session.user.id || "").trim();

  if (!schoolKey || !studentId) {
    redirect("/auth/signin");
  }

  const resolvedSearchParams = await searchParams;
  const selectedDate =
    getSearchParam(resolvedSearchParams, "entryDate") || getTodayDiaryEntryDate();
  const selectedSubjectId = getSearchParam(resolvedSearchParams, "subjectId") || "all";

  const [entries, subjects] = await Promise.all([
    listStudentDiaryEntries({
      schoolKey,
      studentId,
      studentPlacement: {
        classId: session.user.studentClassId,
        academicSectionId: session.user.studentAcademicSectionId,
      },
      filters: {
        entryDate: selectedDate,
        subjectId: selectedSubjectId !== "all" ? selectedSubjectId : undefined,
      },
    }),
    getWorkspaceSubjects(schoolKey),
  ]);

  return (
    <div className="app-student-page-shell app-diary-page">
      <PageHero
        className="app-learning-hero"
        eyebrow="Student Portal"
        title="Diary"
        variant="overview"
        density="compact"
        description="Check today’s subject instructions, homework, and resources, then mark work done when complete."
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
            meta: "Visible today",
          },
          {
            label: "Remaining",
            value: String(entries.filter((entry) => entry.state.status !== "completed").length),
            meta: "Not marked complete",
          },
          {
            label: "Completed",
            value: String(entries.filter((entry) => entry.state.status === "completed").length),
            meta: "Done",
          },
          {
            label: "Resources",
            value: String(entries.reduce((sum, entry) => sum + entry.content.resourceCount, 0)),
            meta: "Linked to today's work",
          },
        ]}
        toolbar={
          <DiaryBoardFiltersClient
            variant="embedded"
            date={selectedDate}
            defaultDate={getTodayDiaryEntryDate()}
            subjectId={selectedSubjectId}
            subjectOptions={subjects.map((subject) => ({
              value: subject._id,
              label: subject.name,
              description: subject.code || subject.description,
            }))}
          />
        }
      />

      {entries.length === 0 ? (
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>No diary entries for this day</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <p className="text-sm leading-6 text-muted-foreground">
              Your teachers have not published diary work for the selected date yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="app-diary-board-grid">
          {entries.map((entry) => (
            <Card key={entry._id} className="app-diary-entry-card flex flex-col">
              <CardHeader className="app-section-header gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>
                    {entry.state.status === "completed"
                      ? "Completed"
                      : entry.state.status === "seen"
                        ? "Seen"
                        : "Not seen"}
                  </Badge>
                  {entry.subject?.name ? (
                    <Badge variant="outline">{entry.subject.name}</Badge>
                  ) : null}
                  {entry.class?.name ? (
                    <Badge variant="outline">{entry.class.name}</Badge>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <CardTitle className="app-course-title">{entry.title}</CardTitle>
                  <p className="text-[13px] text-muted-foreground">
                    {entry.author?.name ? `Shared by ${entry.author.name}` : "Teacher update"}
                  </p>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {formatDiaryDateLabel(entry.entryDate) || entry.entryDate}
                  </p>
                </div>
              </CardHeader>

              <CardContent className="app-section-body flex flex-col gap-3">
                <div className="app-course-metric-grid">
                  <div className="app-course-metric-card">
                    <p className="app-course-metric-label">Status</p>
                    <p className="app-course-metric-value">
                      {entry.state.status === "completed"
                        ? "Completed"
                        : entry.state.status === "seen"
                          ? "Seen"
                          : "Not seen"}
                    </p>
                  </div>
                  <div className="app-course-metric-card">
                    <p className="app-course-metric-label">Shared by</p>
                    <p className="app-course-metric-value">
                      {entry.author?.name || "Teacher update"}
                    </p>
                  </div>
                  <div className="app-course-metric-card sm:col-span-2">
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
                  <Button asChild className="app-button-compact-primary app-course-action-button">
                    <AppPrefetchLink href={`/student/diary/${entry._id}`}>
                      View entry
                    </AppPrefetchLink>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
