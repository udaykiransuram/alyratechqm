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
  SUMMER_CRASH_WELCOME_PATH,
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
  });

  if (state.requiresPasswordSetup) {
    redirect(SUMMER_CRASH_WELCOME_PATH);
  }

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
        title="Student analysis is ready"
        variant="overview"
        density="compact"
        description="Review the diagnostic insights and open the detailed report."
        actions={
          reportHref ? (
            <Button asChild className="app-button-primary">
              <AppPrefetchLink href={reportHref}>
                Open Analysis Report
              </AppPrefetchLink>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Diagnostic Summary</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">
              {state.diagnostic?.available
                ? state.diagnostic.title
                : "The diagnostic report is still being prepared."}
            </p>
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
                  <Button asChild className="app-button-primary w-full">
                    <AppPrefetchLink href={reportHref}>
                      Open Analysis Report
                    </AppPrefetchLink>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    The report link will appear here once it is ready.
                  </p>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Next steps</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">
                You can return to the summer home at any time or open the
                analysis report directly.
              </p>
              <Button asChild variant="outline" className="app-button-compact">
                <AppPrefetchLink href={SUMMER_CRASH_HOME_PATH}>
                  Back to Summer Home
                </AppPrefetchLink>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
