import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { getSummerCrashStudentState } from "@/lib/server/summer-crash";
import { SUMMER_CRASH_SIGNIN_PATH, SUMMER_CRASH_WELCOME_PATH } from "@/lib/summer-crash/constants";
import { isSummerCrashSession } from "@/lib/summer-crash/shared";

export const runtime = "nodejs";

export default async function StudentSummerCrashHomePage() {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    !isSummerCrashSession({
      accountType: session.user.accountType,
      role: session.user.role,
      schoolKey: session.user.schoolKey,
    })
  ) {
    redirect(
      session?.user?.accountType === "school_user" &&
        session?.user?.role === "student"
        ? "/student"
        : SUMMER_CRASH_SIGNIN_PATH,
    );
  }

  const state = await getSummerCrashStudentState({
    schoolKey: String(session.user.schoolKey || ""),
    studentId: String(session.user.id || ""),
    studentPlacement: {
      classId: session.user.studentClassId,
      academicSectionId: session.user.studentAcademicSectionId,
    },
  });

  if (state.requiresPasswordSetup) {
    redirect(SUMMER_CRASH_WELCOME_PATH);
  }

  if (state.courses.length === 1) {
    redirect(`/student/courses/${state.courses[0]._id}`);
  }

  return (
    <div className="app-student-page-shell app-course-page">
      <PageHero
        className="app-learning-hero"
        eyebrow="Summer Crash Course"
        title="Your Summer Home"
        variant="overview"
        density="compact"
        description={
          state.courses.length > 0
            ? "Open the assigned summer courses from here."
            : "Your summer lessons will appear here as soon as they are assigned."
        }
      >
        <StudentPortalNav />
      </PageHero>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Assigned Summer Courses</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body space-y-3">
            {state.courses.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-border/70 p-5 text-sm leading-6 text-muted-foreground">
                No summer course is assigned to this student yet.
              </div>
            ) : null}

            {state.courses.map((course) => (
              <div
                key={course._id}
                className="rounded-[1.35rem] border border-border/70 bg-background/80 p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1.5">
                    <p className="text-lg font-semibold text-foreground">
                      {course.title}
                    </p>
                    {course.summary ? (
                      <p className="text-sm leading-6 text-muted-foreground">
                        {course.summary}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="app-meta-chip">
                        {course.class?.name || state.classBand}
                      </span>
                      <span className="app-meta-chip">
                        {course.blockCount} lesson blocks
                      </span>
                      <span className="app-meta-chip">
                        {Math.round(Number(course.completionPercent || 0))}%
                        complete
                      </span>
                    </div>
                  </div>

                  <Button asChild className="app-button-primary">
                    <AppPrefetchLink href={`/student/courses/${course._id}`}>
                      Open Course
                    </AppPrefetchLink>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Summer ID</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <p className="text-2xl font-bold tracking-[0.08em] text-foreground">
                {state.summerId}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Keep this ID safe for summer-only sign in.
              </p>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Need help?</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <p className="text-sm leading-6 text-muted-foreground">
                {state.supportContact
                  ? `Support: ${state.supportContact}`
                  : "Contact the support team if you need help with access."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
