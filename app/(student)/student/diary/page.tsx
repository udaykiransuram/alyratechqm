import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import DiaryBoardFiltersClient from "@/components/diary/DiaryBoardFiltersClient";
import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ListPaginationLinks from "@/components/ui/list-pagination-links";
import { authOptions } from "@/lib/auth";
import { formatDiaryDateLabel, getTodayDiaryEntryDate } from "@/lib/diary/shared";
import { listStudentDiaryEntriesPage } from "@/lib/server/diary";

export const runtime = "nodejs";
const STUDENT_DIARY_PAGE_SIZE = 10;

type StudentDiaryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatStudentDiaryStatusLabel(status: string) {
  if (status === "completed") {
    return "Completed";
  }

  if (status === "seen") {
    return "Seen";
  }

  return "Not seen";
}

function getStudentDiaryStatusVariant(status: string) {
  if (status === "completed") {
    return "success";
  }

  if (status === "seen") {
    return "warning";
  }

  return "neutral";
}

function getSearchParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function resolvePageParam(value: string | undefined) {
  const parsedValue = Number(value || "");
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return 1;
  }

  return Math.floor(parsedValue);
}

function buildStudentDiaryPageHref(params: {
  entryDate: string;
  defaultDate: string;
  subjectId: string;
  page: number;
}) {
  const searchParams = new URLSearchParams();

  if (params.entryDate && params.entryDate !== params.defaultDate) {
    searchParams.set("entryDate", params.entryDate);
  }

  if (params.subjectId && params.subjectId !== "all") {
    searchParams.set("subjectId", params.subjectId);
  }

  if (params.page > 1) {
    searchParams.set("page", String(params.page));
  }

  const query = searchParams.toString();
  return query ? `/student/diary?${query}` : "/student/diary";
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
  const defaultDate = getTodayDiaryEntryDate();
  const selectedDate =
    getSearchParam(resolvedSearchParams, "entryDate") || defaultDate;
  const selectedSubjectId = getSearchParam(resolvedSearchParams, "subjectId") || "all";
  const requestedPage = resolvePageParam(getSearchParam(resolvedSearchParams, "page"));

  const diaryList = await listStudentDiaryEntriesPage({
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
    page: requestedPage,
    limit: STUDENT_DIARY_PAGE_SIZE,
  });
  const entries = diaryList.entries;
  const previousPageHref =
    diaryList.page > 1
      ? buildStudentDiaryPageHref({
          entryDate: selectedDate,
          defaultDate,
          subjectId: selectedSubjectId,
          page: diaryList.page - 1,
        })
      : null;
  const nextPageHref =
    diaryList.page < diaryList.pages
      ? buildStudentDiaryPageHref({
          entryDate: selectedDate,
          defaultDate,
          subjectId: selectedSubjectId,
          page: diaryList.page + 1,
        })
      : null;

  return (
    <div className="app-student-page-shell app-diary-page">
      <PageHero
        className="app-learning-hero"
        eyebrow="Student Portal"
        title="Diary"
        variant="overview"
        density="compact"
        description="Today’s homework and teacher notes."
        toolbar={
          <DiaryBoardFiltersClient
            variant="embedded"
            date={selectedDate}
            defaultDate={defaultDate}
            subjectId={selectedSubjectId}
            subjectOptions={diaryList.subjectOptions.map((subject) => ({
              value: subject._id,
              label: subject.name,
            }))}
          />
        }
      >
        <StudentPortalNav />
      </PageHero>

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
        <div className="app-diary-entry-list">
          {entries.map((entry) => {
            const subline = [
              entry.author?.name ? `Shared by ${entry.author.name}` : "Teacher update",
              formatDiaryDateLabel(entry.entryDate) || entry.entryDate,
            ].join(" • ");

            return (
              <Card key={entry._id} className="app-diary-entry-card">
                <CardContent className="app-diary-list-row app-diary-list-row-student">
                  <div className="app-diary-list-main">
                    <div className="app-diary-list-badges">
                      <Badge variant={getStudentDiaryStatusVariant(entry.state.status)}>
                        {formatStudentDiaryStatusLabel(entry.state.status)}
                      </Badge>
                      {entry.subject?.name ? (
                        <Badge variant="outline">{entry.subject.name}</Badge>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <CardTitle className="app-course-title">{entry.title}</CardTitle>
                      <p className="app-diary-list-subline">{subline}</p>
                    </div>

                  </div>

                  <div className="app-diary-list-actions app-diary-list-actions-student">
                    <Button asChild size="sm" className="app-diary-list-button">
                      <AppPrefetchLink
                        href={`/student/diary/${entry._id}`}
                        prefetchOnViewport={false}
                      >
                        Open
                      </AppPrefetchLink>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ListPaginationLinks
        page={diaryList.page}
        totalPages={diaryList.pages}
        totalItems={diaryList.total}
        pageSize={diaryList.limit}
        itemLabel="entries"
        previousHref={previousPageHref}
        nextHref={nextPageHref}
      />
    </div>
  );
}
