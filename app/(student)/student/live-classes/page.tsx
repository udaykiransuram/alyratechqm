import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { listStudentLiveSessions } from "@/lib/server/live-sessions";

export const runtime = "nodejs";

type StudentLiveClassesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatStatusLabel(value: string) {
  return String(value || "").replace(/_/g, " ");
}

export default async function StudentLiveClassesPage({
  searchParams,
}: StudentLiveClassesPageProps) {
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
  const selectedStatus = getSearchParam(resolvedSearchParams, "status") || "";
  const selectedClassId = getSearchParam(resolvedSearchParams, "classId") || "";
  const selectedSubjectId =
    getSearchParam(resolvedSearchParams, "subjectId") || "";
  const selectedHostTeacherId =
    getSearchParam(resolvedSearchParams, "hostTeacherId") ||
    getSearchParam(resolvedSearchParams, "teacherId") ||
    "";

  const liveSessions = await listStudentLiveSessions({
    schoolKey,
    studentId,
    studentPlacement: {
      classId: session.user.studentClassId,
      academicSectionId: session.user.studentAcademicSectionId,
    },
  });

  const filteredLiveSessions = liveSessions.filter((item) => {
    const matchesStatus =
      !selectedStatus || item.status === selectedStatus;
    const matchesClass =
      !selectedClassId ||
      String(item.class?._id || "").trim() === selectedClassId;
    const matchesSubject =
      !selectedSubjectId ||
      String(item.subject?._id || "").trim() === selectedSubjectId;
    const matchesTeacher =
      !selectedHostTeacherId ||
      String(item.hostTeacher?._id || "").trim() === selectedHostTeacherId;

    return matchesStatus && matchesClass && matchesSubject && matchesTeacher;
  });

  const hasActiveFilters =
    Boolean(selectedStatus) ||
    Boolean(selectedClassId) ||
    Boolean(selectedSubjectId) ||
    Boolean(selectedHostTeacherId);
  const classOptions = Array.from(
    new Map(
      liveSessions
        .filter((item) => item.class?._id && item.class?.name)
        .map((item) => [
          String(item.class?._id || "").trim(),
          {
            value: String(item.class?._id || "").trim(),
            label: String(item.class?.name || "").trim(),
          },
        ]),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label));
  const subjectOptions = Array.from(
    new Map(
      liveSessions
        .filter((item) => item.subject?._id && item.subject?.name)
        .map((item) => [
          String(item.subject?._id || "").trim(),
          {
            value: String(item.subject?._id || "").trim(),
            label: String(item.subject?.name || "").trim(),
          },
        ]),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label));
  const hostTeacherOptions = Array.from(
    new Map(
      liveSessions
        .filter((item) => item.hostTeacher?._id && item.hostTeacher?.name)
        .map((item) => [
          String(item.hostTeacher?._id || "").trim(),
          {
            value: String(item.hostTeacher?._id || "").trim(),
            label: String(item.hostTeacher?.name || "").trim(),
          },
        ]),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label));

  const displaySessions = filteredLiveSessions;

  return (
    <div className="app-student-page-shell app-course-page">
      <PageHero
        className="app-learning-hero"
        eyebrow="Student Portal"
        title="Live Classes"
        variant="overview"
        density="compact"
        description="Join your scheduled live classes."
      >
        <StudentPortalNav />
      </PageHero>

      {liveSessions.length > 0 || hasActiveFilters ? (
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header gap-2">
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <form method="get" className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="status">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={selectedStatus}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="live">Live</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="classId">
                  Class
                </label>
                <select
                  id="classId"
                  name="classId"
                  defaultValue={selectedClassId}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All classes</option>
                  {classOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="subjectId">
                  Subject
                </label>
                <select
                  id="subjectId"
                  name="subjectId"
                  defaultValue={selectedSubjectId}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All subjects</option>
                  {subjectOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="hostTeacherId"
                >
                  Host teacher
                </label>
                <select
                  id="hostTeacherId"
                  name="hostTeacherId"
                  defaultValue={selectedHostTeacherId}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All hosts</option>
                  {hostTeacherOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-end gap-2 md:col-span-4">
                <Button type="submit" className="app-button-page">
                  Apply filters
                </Button>
                <Button asChild variant="outline" className="app-button-page">
                  <AppPrefetchLink href="/student/live-classes">
                    Reset
                  </AppPrefetchLink>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {liveSessions.length === 0 ? (
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>No live classes yet</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <p className="text-sm leading-6 text-muted-foreground">
              When your school schedules a live class for your class or section, it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : displaySessions.length === 0 ? (
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>No live classes match these filters</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <p className="text-sm leading-6 text-muted-foreground">
              Try resetting one or more filters to see your full live class schedule again.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {displaySessions.map((liveSession) => (
            <Card key={liveSession._id} className="app-surface overflow-hidden">
              <CardHeader className="app-section-header gap-2">
                <div className="app-student-compact-row">
                  <div className="min-w-0">
                    <CardTitle>{liveSession.title}</CardTitle>
                    <p className="app-student-compact-meta">
                      {liveSession.subject?.name || "Subject not set"}
                      {liveSession.hostTeacher?.name
                        ? ` • ${liveSession.hostTeacher.name}`
                        : ""}
                      {" • "}
                      {formatDateTime(liveSession.scheduledStartAt)}
                    </p>
                  </div>
                  <Badge className="capitalize">
                    {formatStatusLabel(liveSession.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="app-section-body">
                <div className="app-student-compact-row">
                  <p className="app-student-compact-meta">
                    {liveSession.canJoin ? "Join available" : "Details only"}
                    {liveSession.scheduledEndAt
                      ? ` • Ends ${formatDateTime(liveSession.scheduledEndAt)}`
                      : ""}
                  </p>
                  <div className="app-student-compact-actions">
                    <Button asChild variant="outline" className="app-button-compact-secondary">
                      <AppPrefetchLink href={`/student/live-classes/${liveSession._id}`}>
                        Open
                      </AppPrefetchLink>
                    </Button>
                    {liveSession.canJoin ? (
                      <Button asChild className="app-button-compact-primary">
                        <AppPrefetchLink
                          href={`/student/live-classes/${liveSession._id}?join=1`}
                        >
                          Join
                        </AppPrefetchLink>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
