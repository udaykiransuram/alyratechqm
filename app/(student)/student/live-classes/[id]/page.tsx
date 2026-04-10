import { ArrowLeft, ExternalLink, Video } from "lucide-react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { getStudentLiveSessionById } from "@/lib/server/live-sessions";

export const runtime = "nodejs";

type StudentLiveClassDetailPageProps = {
  params: Promise<{ id: string }>;
};

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
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatStatusLabel(value: string) {
  return String(value || "").replace(/_/g, " ");
}

export default async function StudentLiveClassDetailPage({
  params,
}: StudentLiveClassDetailPageProps) {
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

  const { id } = await params;
  const liveSession = await getStudentLiveSessionById({
    schoolKey,
    studentId,
    studentPlacement: {
      classId: session.user.studentClassId,
      academicSectionId: session.user.studentAcademicSectionId,
    },
    liveSessionId: id,
  });

  return (
    <div className="app-student-page-shell app-course-page">
      <PageHero
        className="app-learning-hero"
        eyebrow="Student Portal"
        title={liveSession?.title || "Live Class"}
        variant="overview"
        density="compact"
        description={
          liveSession?.description || "The requested live class could not be loaded."
        }
        meta={
          liveSession ? (
            <>
              <span className="app-meta-chip capitalize">
                {formatStatusLabel(liveSession.status)}
              </span>
              {liveSession.subject?.name ? (
                <span className="app-meta-chip">{liveSession.subject.name}</span>
              ) : null}
              {liveSession.hostTeacher?.name ? (
                <span className="app-meta-chip">{liveSession.hostTeacher.name}</span>
              ) : null}
            </>
          ) : undefined
        }
        stats={
          liveSession
            ? [
                {
                  label: "Starts",
                  value: formatDateTime(liveSession.scheduledStartAt),
                  meta: "Session start time",
                },
                {
                  label: "Ends",
                  value: formatDateTime(liveSession.scheduledEndAt),
                  meta: "Session end time",
                },
                {
                  label: "Join status",
                  value: liveSession.attendanceStatus || "invited",
                  meta: "Updated automatically after you join.",
                },
                {
                  label: "Join clicks",
                  value: String(liveSession.joinClicks),
                  meta: "Tracked for attendance.",
                },
              ]
            : undefined
        }
      >
        <StudentPortalNav />
      </PageHero>

      {!liveSession ? (
        <div className="app-feedback app-feedback-error">Live class not found.</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header gap-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Session Details</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Review the meeting information before opening the live class.
                  </p>
                </div>
                <Badge className="capitalize">
                  {formatStatusLabel(liveSession.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="app-section-body space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    Start
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {formatDateTime(liveSession.scheduledStartAt)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    End
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {formatDateTime(liveSession.scheduledEndAt)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-sm font-semibold text-foreground">Instructions</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {liveSession.joinInstructions ||
                    "No extra join instructions were added yet."}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="text-sm font-semibold text-foreground">Meeting code</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {liveSession.meetingCode || "Not provided"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="text-sm font-semibold text-foreground">Passcode</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {liveSession.meetingPasscode || "Not provided"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header gap-2">
              <CardTitle>Actions</CardTitle>
              <p className="text-sm text-muted-foreground">
                Open the meeting only when the session is ready to join.
              </p>
            </CardHeader>
            <CardContent className="app-section-body space-y-4">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Video className="h-4 w-4" />
                  Join flow
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {liveSession.studentJoinUrlLabel}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Button asChild variant="outline" className="app-button-page">
                  <AppPrefetchLink href="/student/live-classes">
                    <ArrowLeft className="h-4 w-4" />
                    Back to live classes
                  </AppPrefetchLink>
                </Button>

                {liveSession.canJoin ? (
                  <Button asChild className="app-button-page">
                    <a href={liveSession.joinHref}>
                      <ExternalLink className="h-4 w-4" />
                      Join live class
                    </a>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
