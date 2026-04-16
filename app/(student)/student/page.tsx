import { ExternalLink } from "lucide-react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { formatDiaryDateLabel } from "@/lib/diary/shared";
import { getStudentDashboardData } from "@/lib/server/student-dashboard";

export const runtime = "nodejs";

function formatDateLabel(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatRemainingTimeLabel(value?: number | null) {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return null;
  }

  const totalMinutes = Math.max(1, Math.floor(Number(value) / (60 * 1000)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }

  return `${minutes}m left`;
}

function formatTestMeta(item: {
  remainingTimeMs: number | null;
  onlineStartsAt: string | null;
  examDate: string | null;
}) {
  const remaining = formatRemainingTimeLabel(item.remainingTimeMs);
  if (remaining) {
    return remaining;
  }

  const startLabel =
    formatDateLabel(item.onlineStartsAt) || formatDateLabel(item.examDate);
  return startLabel ? `Scheduled ${startLabel}` : "Open test";
}

function formatCourseMeta(item: {
  status: string;
  completionPercent: number;
  dueAt: string | null;
}) {
  const dueLabel = formatDateLabel(item.dueAt);
  if (item.status === "completed") {
    return "Completed";
  }

  if (dueLabel) {
    return `Due ${dueLabel}`;
  }

  return `${Math.max(0, Math.min(100, Math.round(item.completionPercent)))}% complete`;
}

function formatDiaryStatusLabel(status: string) {
  if (status === "completed") return "Completed";
  if (status === "seen") return "Seen";
  return "Not seen";
}

function formatNotificationDate(value?: string | null) {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatLiveClassMeta(item: {
  status: string;
  scheduledStartAt: string | null;
  subjectName: string | null;
  teacherName: string | null;
}) {
  if (item.status === "live") {
    return item.teacherName
      ? `Live now with ${item.teacherName}`
      : "Live now";
  }

  const startLabel = formatDateLabel(item.scheduledStartAt);
  const context = item.subjectName || item.teacherName || "Live class";
  return startLabel ? `${context} • ${startLabel}` : context;
}

export default async function StudentHomePage() {
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

  const dashboard = await getStudentDashboardData({
    schoolKey,
    studentId,
    studentPlacement: {
      classId: session.user.studentClassId,
      academicSectionId: session.user.studentAcademicSectionId,
    },
  });

  return (
    <div className="app-student-page-shell app-course-page">
      <PageHero
        className="app-learning-hero"
        eyebrow="Student Portal"
        title="Home"
        variant="overview"
        density="compact"
        description="See what needs attention first across tests, courses, diary work, and notifications."
        meta={
          <>
            <span className="app-meta-chip">
              {dashboard.notifications.unreadCount} unread notification
              {dashboard.notifications.unreadCount === 1 ? "" : "s"}
            </span>
            <span className="app-meta-chip">
              {dashboard.diary.total} diary item
              {dashboard.diary.total === 1 ? "" : "s"} today
            </span>
          </>
        }
        stats={[
          {
            label: "Active tests",
            value: String(
              dashboard.tests.inProgress + dashboard.tests.available,
            ),
            meta: "Ready to continue or start.",
          },
          {
            label: "Live classes",
            value: String(
              dashboard.liveClasses.liveNow + dashboard.liveClasses.upcoming,
            ),
            meta: "Live now and upcoming.",
          },
          {
            label: "Courses",
            value: String(dashboard.courses.inProgress),
            meta: "Currently in progress.",
          },
          {
            label: "Diary remaining",
            value: String(dashboard.diary.remaining),
            meta: formatDiaryDateLabel(dashboard.diary.date) || dashboard.diary.date,
          },
        ]}
      >
        <StudentPortalNav />
      </PageHero>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Upcoming Live Classes</CardTitle>
                <p className="text-sm text-muted-foreground">
                  The next meeting-linked sessions scheduled for your class.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Badge variant="outline">
                  {dashboard.liveClasses.liveNow} live now
                </Badge>
                <Button asChild variant="outline" className="app-button-compact-primary">
                  <AppPrefetchLink href="/student/live-classes" prefetchOnViewport={false}>
                    View all
                  </AppPrefetchLink>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="app-section-body space-y-3">
            {dashboard.liveClasses.items.length === 0 ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  No live classes are scheduled right now.
                </p>
                <div className="flex justify-end">
                  <Button asChild variant="outline" className="app-button-compact-primary">
                    <AppPrefetchLink
                      href="/student/live-classes"
                      prefetchOnViewport={false}
                    >
                      Open live classes page
                    </AppPrefetchLink>
                  </Button>
                </div>
              </div>
            ) : (
              dashboard.liveClasses.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatLiveClassMeta(item)}
                      </p>
                    </div>
                    <Badge className="capitalize">{item.status}</Badge>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button asChild variant="outline" className="app-button-compact-primary">
                      <AppPrefetchLink href={item.href} prefetchOnViewport={false}>
                        Open details
                      </AppPrefetchLink>
                    </Button>
                    {item.canJoin ? (
                      <Button asChild className="app-button-compact-primary">
                        <a href={item.joinHref}>
                          <ExternalLink className="h-4 w-4" />
                          Join
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Tests</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Prioritized from your current queue.
                </p>
              </div>
              <Badge variant="outline">
                {dashboard.tests.inProgress} in progress
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="app-section-body space-y-3">
            {dashboard.tests.items.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                No active tests right now.
              </p>
            ) : (
              dashboard.tests.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTestMeta(item)}
                      </p>
                    </div>
                    <Badge className="capitalize">
                      {item.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex justify-end">
                    <Button asChild className="app-button-compact-primary">
                      <AppPrefetchLink
                        href={item.href}
                        prefetchOnViewport={false}
                        requestFullscreenOnClick
                      >
                        {item.status === "in_progress" ? "Resume test" : "Open test"}
                      </AppPrefetchLink>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Courses</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Continue learning paths without hunting through the full list.
                </p>
              </div>
              <Badge variant="outline">
                {dashboard.courses.dueSoon} due soon
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="app-section-body space-y-3">
            {dashboard.courses.items.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                No courses assigned yet.
              </p>
            ) : (
              dashboard.courses.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCourseMeta(item)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="capitalize">
                        {item.status.replace("_", " ")}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {item.availabilityStatus.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 overflow-hidden rounded-full bg-muted/20">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, Math.round(item.completionPercent)),
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button asChild className="app-button-compact-primary">
                        <AppPrefetchLink href={item.href} prefetchOnViewport={false}>
                          {item.status === "not_started"
                            ? "Start course"
                            : "Open course"}
                        </AppPrefetchLink>
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Today&apos;s Diary</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Work published for {formatDiaryDateLabel(dashboard.diary.date) || dashboard.diary.date}.
                </p>
              </div>
              <Badge variant="outline">
                {dashboard.diary.remaining} remaining
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="app-section-body space-y-3">
            {dashboard.diary.items.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                No diary work has been published for today yet.
              </p>
            ) : (
              dashboard.diary.items.map((item) => (
                <div key={item.id} className="app-diary-inline-row">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.subjectName || "Teacher update"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Badge
                      variant={
                        item.status === "completed"
                          ? "success"
                          : item.status === "seen"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {formatDiaryStatusLabel(item.status)}
                    </Badge>
                    <Button asChild size="sm" className="app-diary-list-button">
                      <AppPrefetchLink href={item.href} prefetchOnViewport={false}>
                        View entry
                      </AppPrefetchLink>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Notifications</CardTitle>
                <p className="text-sm text-muted-foreground">
                  The newest updates from tests, courses, and diary posts.
                </p>
              </div>
              <Badge variant="outline">
                {dashboard.notifications.unreadCount} unread
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="app-section-body space-y-3">
            {dashboard.notifications.items.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                You&apos;re all caught up.
              </p>
            ) : (
              dashboard.notifications.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">
                        {item.title}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {!item.readAt ? <Badge>Unread</Badge> : null}
                        <Badge variant="outline" className="capitalize">
                          {item.type.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {item.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatNotificationDate(item.createdAt)}
                    </p>
                  </div>
                  {item.linkUrl ? (
                    <div className="flex justify-end">
                      <Button asChild className="app-button-compact-primary">
                        <AppPrefetchLink
                          href={item.linkUrl}
                          prefetchOnViewport={false}
                        >
                          Open
                        </AppPrefetchLink>
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
