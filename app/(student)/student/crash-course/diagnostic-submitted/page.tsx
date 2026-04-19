import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { getSummerCrashStudentState } from "@/lib/server/summer-crash";
import {
  SUMMER_CRASH_HOME_PATH,
  SUMMER_CRASH_SIGNIN_PATH,
} from "@/lib/summer-crash/constants";
import { isSummerCrashSession } from "@/lib/summer-crash/shared";

export const runtime = "nodejs";

export default async function SummerCrashDiagnosticSubmittedPage() {
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
    includeCourses: false,
  });

  const reportHref = state.diagnostic?.reportHref || "";
  const scoreLabel =
    state.diagnostic?.percent !== null && state.diagnostic?.percent !== undefined
      ? `${state.diagnostic.score} (${state.diagnostic.percent}%)`
      : null;

  return (
    <div className="app-student-page-shell app-course-page">
      <PageHero
        className="app-learning-hero"
        eyebrow="Free Diagnostic"
        title="Your child's diagnostic report is ready"
        variant="overview"
        density="compact"
        description="See the weak subskills, weak topics, and the next best step before starting the Summer Crash Course."
      />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Diagnostic Summary</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body space-y-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {state.diagnostic?.available
                  ? state.diagnostic.title
                  : "Diagnostic report is being prepared."}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {state.diagnostic?.available
                  ? "Use the report to see weak subskills and the next best step."
                  : "You can return to the summer home now. We will unlock the report as soon as it is ready."}
              </p>
            </div>
            {state.diagnostic?.available ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <span className="app-meta-chip">
                    {state.diagnostic.totalMarks} marks
                  </span>
                  <span className="app-meta-chip">
                    {state.diagnostic.duration} min
                  </span>
                  <span className="app-meta-chip">
                    {state.diagnostic.status}
                  </span>
                </div>
                {scoreLabel ? (
                  <p className="text-sm font-medium text-foreground">
                    Latest score: {scoreLabel}
                  </p>
                ) : null}
                {reportHref ? (
                  <div className="flex flex-wrap gap-3">
                    <Button asChild className="app-button-primary">
                      <AppPrefetchLink href={reportHref}>
                        View Diagnostic Report
                      </AppPrefetchLink>
                    </Button>
                    <Button asChild variant="outline" className="app-button-compact">
                      <AppPrefetchLink href={SUMMER_CRASH_HOME_PATH}>
                        Back to Summer Home
                      </AppPrefetchLink>
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    The report link will appear here once it is ready.
                  </p>
                )}
              </>
            ) : (
              <Button asChild variant="outline" className="app-button-compact">
                <AppPrefetchLink href={SUMMER_CRASH_HOME_PATH}>
                  Back to Summer Home
                </AppPrefetchLink>
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Next steps</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">
                Use the report to identify weak areas, then continue from the summer home when you are ready.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
