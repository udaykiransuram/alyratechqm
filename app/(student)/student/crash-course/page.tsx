import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import SummerCrashPaymentCard from "@/components/summer-crash/SummerCrashPaymentCard";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { getSummerCrashStudentState } from "@/lib/server/summer-crash";
import {
  SUMMER_CRASH_HOME_PATH,
  SUMMER_CRASH_SIGNIN_PATH,
  SUMMER_CRASH_WELCOME_PATH,
} from "@/lib/summer-crash/constants";
import {
  formatSummerCrashPrice,
  isSummerCrashSession,
} from "@/lib/summer-crash/shared";

export const runtime = "nodejs";

type StudentSummerCrashHomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

export default async function StudentSummerCrashHomePage({
  searchParams,
}: StudentSummerCrashHomePageProps) {
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
  const resolvedSearchParams = await searchParams;
  const submitted = getSearchParam(resolvedSearchParams?.submitted) === "1";
  const mode = getSearchParam(resolvedSearchParams?.mode);

  if (submitted && mode === "diagnostic" && state.diagnostic?.reportHref) {
    redirect(state.diagnostic.reportHref);
  }

  const priceLabel = formatSummerCrashPrice(
    state.courseAccess.price,
    state.courseAccess.currency,
  );
  const isCourseLocked =
    state.courseAccess.requiresPayment && !state.courseAccess.isUnlocked;

  if (
    isCourseLocked &&
    state.diagnostic?.available &&
    state.diagnostic.launchHref
  ) {
    redirect(state.diagnostic.launchHref);
  }

  if (isCourseLocked) {
    return (
      <div className="app-student-page-shell app-course-page">
        <PageHero
          className="app-learning-hero"
          eyebrow="Summer Crash Course"
          title="Free Diagnostic"
          variant="overview"
          density="compact"
          description="Only the free diagnostic is available until payment is completed."
          actions={
            state.diagnostic?.available ? (
              <Button asChild className="app-button-primary">
                <AppPrefetchLink href={state.diagnostic.launchHref}>
                  Start Free Diagnostic
                </AppPrefetchLink>
              </Button>
            ) : undefined
          }
        >
          <StudentPortalNav />
        </PageHero>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Free Diagnostic Test</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">
                {state.diagnostic?.available
                  ? state.diagnostic.title
                  : "The diagnostic for this class band is not ready right now."}
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
                  <Button asChild className="app-button-primary w-full">
                    <AppPrefetchLink href={state.diagnostic.launchHref}>
                      {state.diagnostic.status === "started"
                        ? "Resume Diagnostic"
                        : "Start Free Diagnostic"}
                    </AppPrefetchLink>
                  </Button>
                </>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Unlock Lessons</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body space-y-3">
                <p className="text-sm leading-6 text-muted-foreground">
                  The free diagnostic stays open. To start lessons, complete the
                  course payment for this student.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="app-meta-chip">{priceLabel}</span>
                  <span className="app-meta-chip">
                    {state.courseAccess.latestPaymentStatus === "pending"
                      ? "Checking payment"
                      : state.courseAccess.latestPaymentStatus === "failed"
                        ? "Payment needs retry"
                        : "Lessons locked"}
                  </span>
                </div>
                <SummerCrashPaymentCard
                  price={state.courseAccess.price}
                  currency={state.courseAccess.currency}
                  latestPaymentStatus={state.courseAccess.latestPaymentStatus}
                />
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

  return (
    <div className="app-student-page-shell app-course-page">
      <PageHero
        className="app-learning-hero"
        eyebrow="Summer Crash Course"
        title="Your Summer Home"
        variant="overview"
        density="compact"
        description={
          isCourseLocked
            ? "The free diagnostic is ready now. Lessons will open here after payment."
            : state.courses.length > 0 || state.diagnostic
              ? "Open the assigned summer courses and the free diagnostic from here."
              : "Your summer lessons will appear here as soon as they are assigned."
        }
      >
        <StudentPortalNav />
      </PageHero>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Your Summer Lessons</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body space-y-3">
            {isCourseLocked ? (
              <div className="rounded-[1.25rem] border border-dashed border-border/70 p-5 text-sm leading-6 text-muted-foreground">
                Lessons will appear here automatically after the payment is
                confirmed for this student.
              </div>
            ) : null}

            {!isCourseLocked && state.courses.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-border/70 p-5 text-sm leading-6 text-muted-foreground">
                No summer lessons are assigned to this student yet.
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
          {state.diagnostic ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Free Diagnostic Test</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body space-y-3">
                <p className="text-sm leading-6 text-muted-foreground">
                  {state.diagnostic.available
                    ? state.diagnostic.title
                    : "The diagnostic for this class band is not ready right now."}
                </p>
                {state.diagnostic.available ? (
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
                    {state.diagnostic.percent !== null ? (
                      <p className="text-sm font-medium text-foreground">
                        Latest score: {state.diagnostic.score} ({state.diagnostic.percent}%)
                      </p>
                    ) : null}
                    <Button asChild className="app-button-primary w-full">
                      <AppPrefetchLink
                        href={
                          state.diagnostic.status === "submitted" &&
                          state.diagnostic.reportHref
                            ? state.diagnostic.reportHref
                            : state.diagnostic.launchHref
                        }
                      >
                        {state.diagnostic.status === "submitted"
                          ? "View Report"
                          : state.diagnostic.status === "started"
                            ? "Resume Diagnostic"
                            : "Take Free Diagnostic"}
                      </AppPrefetchLink>
                    </Button>
                  </>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {isCourseLocked ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Unlock Lessons</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body space-y-3">
                <p className="text-sm leading-6 text-muted-foreground">
                  The free diagnostic stays open. To start lessons, complete the
                  course payment for this student.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="app-meta-chip">{priceLabel}</span>
                  <span className="app-meta-chip">
                    {state.courseAccess.latestPaymentStatus === "pending"
                      ? "Checking payment"
                      : state.courseAccess.latestPaymentStatus === "failed"
                        ? "Payment needs retry"
                        : "Lessons locked"}
                  </span>
                </div>
                {state.courseAccess.latestPaymentStatus === "pending" ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Already paid? Refresh the status after a few seconds.
                  </p>
                ) : null}
                <SummerCrashPaymentCard
                  price={state.courseAccess.price}
                  currency={state.courseAccess.currency}
                  latestPaymentStatus={state.courseAccess.latestPaymentStatus}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Backup ID</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <p className="text-2xl font-bold tracking-[0.08em] text-foreground">
                {state.summerId}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Most families sign in with the parent phone number. Keep this ID
                only in case support asks for it.
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
