import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { MessageCircleMore } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import SummerCrashPaymentCard from "@/components/summer-crash/SummerCrashPaymentCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { getSummerCrashStudentState } from "@/lib/server/summer-crash";
import { SUMMER_CRASH_SIGNIN_PATH } from "@/lib/summer-crash/constants";
import { formatSummerCrashPrice, isSummerCrashSession } from "@/lib/summer-crash/shared";

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

  const [state, resolvedSearchParams] = await Promise.all([
    getSummerCrashStudentState({
      schoolKey: String(session.user.schoolKey || ""),
      studentId: String(session.user.id || ""),
      studentPlacement: {
        classId: session.user.studentClassId,
        academicSectionId: session.user.studentAcademicSectionId,
      },
    }),
    searchParams,
  ]);
  const submitted = getSearchParam(resolvedSearchParams?.submitted) === "1";
  const mode = getSearchParam(resolvedSearchParams?.mode);
  const promptPayment = getSearchParam(resolvedSearchParams?.promptPayment) === "1";

  if (submitted && mode === "diagnostic" && state.diagnostic?.reportHref) {
    redirect(state.diagnostic.reportHref);
  }

  const priceLabel = formatSummerCrashPrice(
    state.courseAccess.price,
    state.courseAccess.currency,
  );
  const isCourseLocked =
    state.courseAccess.requiresPayment && !state.courseAccess.isUnlocked;
  const lockedDiagnosticHref =
    state.diagnostic?.available
      ? state.diagnostic.status === "submitted" && state.diagnostic.reportHref
        ? state.diagnostic.reportHref
        : state.diagnostic.launchHref
      : "";
  const lockedDiagnosticLabel =
    state.diagnostic?.status === "submitted" && state.diagnostic?.reportHref
      ? "View Diagnostic Report"
      : state.diagnostic?.status === "started"
        ? "Resume Diagnostic"
        : "Start Free Diagnostic";
  const diagnosticStatusLabel = state.diagnostic?.available
    ? state.diagnostic.status === "submitted"
      ? "Completed"
      : state.diagnostic.status === "started"
        ? "In Progress"
        : "Ready"
    : "Not ready";
  const courseAccessLabel = isCourseLocked ? "Locked" : "Unlocked";
  const quickSummaryCopy =
    state.courses.length > 0 || state.diagnostic
      ? "Continue from the diagnostic report, summer lessons, and the next best step from one place."
      : "Your summer lessons will appear here as soon as they are assigned.";
  const supportWhatsappHref = state.supportHref;

  if (isCourseLocked) {
    return (
      <div className="app-student-page-shell app-course-page">
        <PageHero
          className="app-learning-hero app-summer-crash-hero"
          eyebrow="Summer Crash Course"
          title="Free Diagnostic"
          variant="overview"
          density="compact"
          description={
            state.diagnostic?.status === "submitted"
              ? "Your diagnostic report is ready. Lessons unlock as soon as payment is completed."
              : "Start with the free diagnostic now, then unlock the guided lesson path for this student."
          }
          actions={
            lockedDiagnosticHref ? (
              <Button asChild className="app-button-primary">
                <AppPrefetchLink href={lockedDiagnosticHref}>
                  {lockedDiagnosticLabel}
                </AppPrefetchLink>
              </Button>
            ) : undefined
          }
        />

        <div className="app-summer-crash-grid">
          <Card className="app-surface app-summer-crash-panel overflow-hidden">
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
                    <AppPrefetchLink
                      href={lockedDiagnosticHref || state.diagnostic.launchHref}
                      prefetch={false}
                      prefetchOnIntent={false}
                      prefetchOnViewport={false}
                    >
                      {lockedDiagnosticLabel}
                    </AppPrefetchLink>
                  </Button>
                </>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card
              id="summer-unlock-lessons"
              className="app-surface app-summer-crash-panel overflow-hidden"
            >
              <CardHeader className="app-section-header">
                <CardTitle>Unlock Lessons</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body space-y-3">
                <p className="text-sm leading-6 text-muted-foreground">
                  The free diagnostic stays open. Complete the course payment to
                  unlock the guided lesson path for this student.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="app-meta-chip">{priceLabel}</span>
                  {state.courseAccess.earlyBirdOffer ? (
                    <span className="app-meta-chip">Early bird live</span>
                  ) : null}
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
                  earlyBirdOffer={state.courseAccess.earlyBirdOffer}
                  autoOpen={promptPayment}
                />
              </CardContent>
            </Card>

            <Card className="app-surface app-summer-crash-panel overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Need help?</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body">
                {state.supportContact ? (
                  <a
                    href={supportWhatsappHref || undefined}
                    target={supportWhatsappHref ? "_blank" : undefined}
                    rel={supportWhatsappHref ? "noreferrer" : undefined}
                    className="inline-flex items-center gap-2 text-sm font-medium text-foreground/90 underline-offset-4 transition hover:text-foreground hover:underline"
                  >
                    <MessageCircleMore className="h-4 w-4" />
                    {state.supportContact}
                  </a>
                ) : (
                  <p className="text-sm leading-6 text-muted-foreground">
                    Contact the support team if you need help with access.
                  </p>
                )}
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
        className="app-learning-hero app-summer-crash-hero"
        eyebrow="Summer Crash Course"
        title="Your Summer Home"
        variant="overview"
        density="compact"
        description={
          state.courses.length > 0 || state.diagnostic
            ? "Continue from the diagnostic report, summer lessons, and the next best step from one place."
            : "Your summer lessons will appear here as soon as they are assigned."
        }
      />

      <div className="app-summer-crash-strip">
        <div className="app-summer-crash-strip-card">
          <p className="app-summer-crash-strip-label">Class Band</p>
          <p className="app-summer-crash-strip-value">{state.classBand}</p>
        </div>
        <div className="app-summer-crash-strip-card">
          <p className="app-summer-crash-strip-label">Diagnostic</p>
          <p className="app-summer-crash-strip-value">{diagnosticStatusLabel}</p>
        </div>
        <div className="app-summer-crash-strip-card">
          <p className="app-summer-crash-strip-label">Course Access</p>
          <p className="app-summer-crash-strip-value">{courseAccessLabel}</p>
        </div>
        <div className="app-summer-crash-strip-note">
          {quickSummaryCopy}
        </div>
      </div>

      <div className="app-summer-crash-grid">
        <Card className="app-surface app-summer-crash-panel overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Your Summer Lessons</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body space-y-3">
            {state.courses.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-border/70 p-5 text-sm leading-6 text-muted-foreground">
                No summer lessons are assigned to this student yet.
              </div>
            ) : null}

            {state.courses.map((course) => {
              const courseHref = `/student/courses/${course._id}`;

              return (
                <article key={course._id} className="app-summer-crash-course-card">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="space-y-1.5">
                        <AppPrefetchLink
                          href={courseHref}
                          className="inline-flex text-lg font-semibold text-foreground transition-colors hover:text-primary"
                        >
                          {course.title}
                        </AppPrefetchLink>
                        {course.summary ? (
                          <p className="text-sm leading-6 text-muted-foreground">
                            {course.summary}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
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

                    <Button asChild className="app-button-primary w-full md:w-auto">
                      <AppPrefetchLink href={courseHref}>
                        Continue Course
                      </AppPrefetchLink>
                    </Button>
                  </div>
                </article>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {state.diagnostic ? (
            <Card className="app-surface app-summer-crash-panel overflow-hidden">
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
                        prefetch={false}
                        prefetchOnIntent={false}
                        prefetchOnViewport={false}
                      >
                        {state.diagnostic.status === "submitted"
                          ? "View Diagnostic Report"
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

          <Card className="app-surface app-summer-crash-panel overflow-hidden">
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

          <Card className="app-surface app-summer-crash-panel overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Need help?</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              {state.supportContact ? (
                <a
                  href={supportWhatsappHref || undefined}
                  target={supportWhatsappHref ? "_blank" : undefined}
                  rel={supportWhatsappHref ? "noreferrer" : undefined}
                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground/90 underline-offset-4 transition hover:text-foreground hover:underline"
                >
                  <MessageCircleMore className="h-4 w-4" />
                  {state.supportContact}
                </a>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  Contact the support team if you need help with access.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
