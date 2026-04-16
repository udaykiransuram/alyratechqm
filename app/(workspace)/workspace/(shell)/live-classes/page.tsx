import { CalendarDays, Eye, Plus, Users } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getWorkspaceLiveSessionSupportData, listWorkspaceLiveSessions } from "@/lib/server/live-sessions";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

type LiveClassesPageProps = {
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

export default async function LiveClassesPage({
  searchParams,
}: LiveClassesPageProps) {
  const { schoolKey, viewerRole, viewerId } = await requireWorkspaceStaffSession();
  const resolvedSearchParams = await searchParams;
  const selectedStatus = getSearchParam(resolvedSearchParams, "status") || "";
  const selectedClassId = getSearchParam(resolvedSearchParams, "classId") || "";
  const selectedSubjectId = getSearchParam(resolvedSearchParams, "subjectId") || "";
  const selectedHostTeacherId =
    getSearchParam(resolvedSearchParams, "hostTeacherId") || "";

  const [supportData, liveSessions] = await Promise.all([
    getWorkspaceLiveSessionSupportData({
      schoolKey,
      viewerRole,
      viewerId,
    }),
    listWorkspaceLiveSessions({
      schoolKey,
      viewerRole,
      viewerId,
      filters: {
        status: selectedStatus || undefined,
        classId: selectedClassId || undefined,
        subjectId: selectedSubjectId || undefined,
        hostTeacherId: selectedHostTeacherId || undefined,
      },
    }),
  ]);

  const liveCount = liveSessions.filter((session) => session.status === "live").length;
  const scheduledCount = liveSessions.filter(
    (session) => session.status === "scheduled",
  ).length;
  const completedCount = liveSessions.filter(
    (session) => session.status === "completed",
  ).length;

  return (
    <PageShell width="wide" padding="standard">
      <div className="app-course-page">
        <PageHero
          className="app-learning-hero"
          eyebrow="Teaching"
          title="Live Classes"
          variant="directory"
          density="compact"
          description="Schedule meeting-link-based live sessions, track join activity, and keep attendance updates in one place."
          actions={
            <Button asChild className="app-button-page">
              <AppPrefetchLink href="/workspace/live-classes/create">
                <Plus className="h-4 w-4" />
                Schedule live class
              </AppPrefetchLink>
            </Button>
          }
          meta={
            <>
              <span className="app-meta-chip">External meeting links</span>
              <span className="app-meta-chip">Student notifications enabled</span>
            </>
          }
          stats={[
            {
              label: "Sessions",
              value: String(liveSessions.length),
              meta: "Across every status.",
            },
            {
              label: "Live now",
              value: String(liveCount),
              meta: "Currently in progress.",
            },
            {
              label: "Scheduled",
              value: String(scheduledCount),
              meta: "Upcoming sessions.",
            },
            {
              label: "Completed",
              value: String(completedCount),
              meta: "Historical sessions.",
            },
          ]}
        />

        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header gap-2">
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <form className="grid gap-4 md:grid-cols-4">
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
                  <option value="draft">Draft</option>
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
                  {supportData.classes.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
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
                  {supportData.subjects.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
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
                  {supportData.teachers.map((teacher) => (
                    <option key={teacher._id} value={teacher._id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-end gap-2 md:col-span-4">
                <Button type="submit" className="app-button-page">
                  Apply filters
                </Button>
                <Button asChild variant="outline" className="app-button-page">
                  <AppPrefetchLink href="/workspace/live-classes">
                    Reset
                  </AppPrefetchLink>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {liveSessions.length === 0 ? (
            <Card className="app-surface overflow-hidden xl:col-span-2">
              <CardHeader className="app-section-header">
                <CardTitle>No live classes match these filters</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body">
                <p className="text-sm leading-6 text-muted-foreground">
                  Adjust the filters or schedule a new live class to populate this directory.
                </p>
              </CardContent>
            </Card>
          ) : (
            liveSessions.map((session) => (
              <Card key={session._id} className="app-surface overflow-hidden">
                <CardHeader className="app-section-header gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle>{session.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {session.subject?.name || "Subject not set"}
                        {session.class?.name ? ` • ${session.class.name}` : ""}
                      </p>
                    </div>
                    <Badge className="capitalize">{session.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="app-section-body space-y-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {session.description || "No session description added yet."}
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        <CalendarDays className="h-4 w-4" />
                        Schedule
                      </div>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {formatDateTime(session.scheduledStartAt)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ends {formatDateTime(session.scheduledEndAt)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        <Users className="h-4 w-4" />
                        Attendance
                      </div>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {session.joinedCount} joined / {session.audienceCount} targeted
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.presentCount} present • {session.absentCount} absent
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button asChild variant="outline" className="app-button-page">
                    <AppPrefetchLink href={`/workspace/live-classes/edit/${session._id}`}>
                        Edit
                      </AppPrefetchLink>
                    </Button>
                    <Button asChild className="app-button-page">
                      <AppPrefetchLink href={`/workspace/live-classes/${session._id}`}>
                        <Eye className="h-4 w-4" />
                        Open
                      </AppPrefetchLink>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </PageShell>
  );
}
