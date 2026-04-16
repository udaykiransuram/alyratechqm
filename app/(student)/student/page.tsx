import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentLazySection from "@/components/student/StudentLazySection";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { formatDiaryDateLabel } from "@/lib/diary/shared";
import { getStudentDashboardData } from "@/lib/server/student-dashboard";
import { getSummerCrashStudentState } from "@/lib/server/summer-crash";
import { isSummerCrashSession } from "@/lib/summer-crash/shared";

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

  if (
    isSummerCrashSession({
      accountType: session.user.accountType,
      role: session.user.role,
      schoolKey,
    })
  ) {
    const summerState = await getSummerCrashStudentState({
      schoolKey,
      studentId,
      studentPlacement: {
        classId: session.user.studentClassId,
        academicSectionId: session.user.studentAcademicSectionId,
      },
    });

    redirect(summerState.destinationHref);
  }

  const dashboard = await getStudentDashboardData({
    schoolKey,
    studentId,
    studentPlacement: {
      classId: session.user.studentClassId,
      academicSectionId: session.user.studentAcademicSectionId,
    },
  });

  const latestLiveClass =
    dashboard.liveClasses.items.find((item) => item.status === "live") ||
    dashboard.liveClasses.items[0] ||
    null;
  const nextTest =
    dashboard.tests.items.find((item) => item.status === "in_progress") ||
    dashboard.tests.items.find((item) => item.status === "available") ||
    dashboard.tests.items[0] ||
    null;
  const nextDiary = dashboard.diary.items[0] || null;

  return (
    <div className="app-student-page-shell app-course-page">
      <header className="app-student-home-header">
        <div className="space-y-1">
          <p className="app-kicker">Student Portal</p>
          <h1 className="app-student-home-title">Home</h1>
          <p className="app-student-home-subtitle">Your next class, test, and homework.</p>
        </div>
        <div className="app-student-home-nav">
          <StudentPortalNav />
        </div>
      </header>

      <div className="grid gap-4">
        <Card className="app-surface">
          <CardHeader className="app-section-header">
            <CardTitle>Latest Live Class</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            {latestLiveClass ? (
              <div className="app-student-compact-card">
                <div className="app-student-compact-row">
                  <div>
                    <p className="app-student-compact-title">{latestLiveClass.title}</p>
                    <p className="app-student-compact-meta">
                      {formatLiveClassMeta(latestLiveClass)}
                    </p>
                  </div>
                  <div className="app-student-compact-actions">
                    <Button
                      asChild
                      variant="outline"
                      className="app-button-compact-secondary"
                    >
                      <AppPrefetchLink
                        href="/student/live-classes"
                        prefetchOnViewport={false}
                      >
                        View all
                      </AppPrefetchLink>
                    </Button>
                    <Button asChild className="app-button-compact-primary">
                      <AppPrefetchLink
                        href={`${latestLiveClass.href}${
                          latestLiveClass.canJoin ? "?join=1" : ""
                        }`}
                        prefetchOnViewport={false}
                      >
                        {latestLiveClass.canJoin ? "Join now" : "Open details"}
                      </AppPrefetchLink>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="app-student-compact-card">
                <p className="app-student-compact-meta">
                  No live class scheduled yet.
                </p>
                <div className="app-student-compact-actions">
                  <Button asChild variant="outline" className="app-button-compact-secondary">
                    <AppPrefetchLink href="/student/live-classes" prefetchOnViewport={false}>
                      View schedule
                    </AppPrefetchLink>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <StudentLazySection>
          <Card className="app-surface">
            <CardHeader className="app-section-header">
              <CardTitle>Next Test</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              {nextTest ? (
                <div className="app-student-compact-card">
                  <div className="app-student-compact-row">
                    <div>
                      <p className="app-student-compact-title">{nextTest.title}</p>
                      <p className="app-student-compact-meta">
                        {formatTestMeta(nextTest)}
                      </p>
                    </div>
                    <div className="app-student-compact-actions">
                      <Button
                        asChild
                        className="app-button-compact-primary"
                      >
                        <AppPrefetchLink
                          href={nextTest.href}
                          prefetchOnViewport={false}
                          requestFullscreenOnClick
                        >
                          {nextTest.status === "in_progress" ? "Resume" : "Open"}
                        </AppPrefetchLink>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="app-student-compact-card">
                  <p className="app-student-compact-meta">No tests assigned yet.</p>
                  <div className="app-student-compact-actions">
                    <Button asChild variant="outline" className="app-button-compact-secondary">
                      <AppPrefetchLink href="/student/tests" prefetchOnViewport={false}>
                        View tests
                      </AppPrefetchLink>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </StudentLazySection>

        <StudentLazySection>
          <Card className="app-surface">
            <CardHeader className="app-section-header">
              <CardTitle>Today&apos;s Homework</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              {nextDiary ? (
                <div className="app-student-compact-card">
                  <div className="app-student-compact-row">
                    <div>
                      <p className="app-student-compact-title">{nextDiary.title}</p>
                      <p className="app-student-compact-meta">
                        {nextDiary.subjectName || "Teacher update"} •{" "}
                        {formatDiaryDateLabel(nextDiary.entryDate) || nextDiary.entryDate}
                      </p>
                    </div>
                    <div className="app-student-compact-actions">
                      <Button
                        asChild
                        className="app-button-compact-primary"
                      >
                        <AppPrefetchLink href={nextDiary.href} prefetchOnViewport={false}>
                          Open
                        </AppPrefetchLink>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="app-student-compact-card">
                  <p className="app-student-compact-meta">
                    No diary work posted for {formatDiaryDateLabel(dashboard.diary.date) || dashboard.diary.date}.
                  </p>
                  <div className="app-student-compact-actions">
                    <Button asChild variant="outline" className="app-button-compact-secondary">
                      <AppPrefetchLink href="/student/diary" prefetchOnViewport={false}>
                        Open diary
                      </AppPrefetchLink>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </StudentLazySection>
      </div>
    </div>
  );
}
