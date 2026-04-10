import { CalendarDays, ExternalLink, Video } from "lucide-react";
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

export default async function StudentLiveClassesPage() {
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

  const liveSessions = await listStudentLiveSessions({
    schoolKey,
    studentId,
    studentPlacement: {
      classId: session.user.studentClassId,
      academicSectionId: session.user.studentAcademicSectionId,
    },
  });

  const liveNowCount = liveSessions.filter((item) => item.status === "live").length;
  const upcomingCount = liveSessions.filter(
    (item) => item.status === "scheduled",
  ).length;
  const completedCount = liveSessions.filter(
    (item) => item.status === "completed",
  ).length;

  return (
    <div className="app-student-page-shell app-course-page">
      <PageHero
        className="app-learning-hero"
        eyebrow="Student Portal"
        title="Live Classes"
        variant="overview"
        density="compact"
        description="Track upcoming sessions, open live meeting details, and join class from one consistent workspace."
        meta={
          <>
            <span className="app-meta-chip">Meeting-link first</span>
            <span className="app-meta-chip">Notifications supported</span>
          </>
        }
        stats={[
          {
            label: "Sessions",
            value: String(liveSessions.length),
            meta: "Visible to your class.",
          },
          {
            label: "Live now",
            value: String(liveNowCount),
            meta: "Ready to join.",
          },
          {
            label: "Upcoming",
            value: String(upcomingCount),
            meta: "Scheduled next.",
          },
          {
            label: "Completed",
            value: String(completedCount),
            meta: "Past sessions.",
          },
        ]}
      >
        <StudentPortalNav />
      </PageHero>

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
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {liveSessions.map((liveSession) => (
            <Card key={liveSession._id} className="app-surface overflow-hidden">
              <CardHeader className="app-section-header gap-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>{liveSession.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {liveSession.subject?.name || "Subject not set"}
                      {liveSession.hostTeacher?.name
                        ? ` • ${liveSession.hostTeacher.name}`
                        : ""}
                    </p>
                  </div>
                  <Badge className="capitalize">
                    {formatStatusLabel(liveSession.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="app-section-body space-y-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  {liveSession.description || "Session details will appear here once the teacher adds them."}
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      Schedule
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {formatDateTime(liveSession.scheduledStartAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ends {formatDateTime(liveSession.scheduledEndAt)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      <Video className="h-4 w-4" />
                      Access
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {liveSession.canJoin ? "Join available" : "View details"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {liveSession.joinClicks > 0
                        ? `You joined ${liveSession.joinClicks} time${liveSession.joinClicks === 1 ? "" : "s"}`
                        : "Join activity will appear after your first click."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button asChild variant="outline" className="app-button-page">
                    <AppPrefetchLink href={`/student/live-classes/${liveSession._id}`}>
                      Open details
                    </AppPrefetchLink>
                  </Button>
                  {liveSession.canJoin ? (
                    <Button asChild className="app-button-page">
                      <a href={liveSession.joinHref}>
                        <ExternalLink className="h-4 w-4" />
                        Join class
                      </a>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
