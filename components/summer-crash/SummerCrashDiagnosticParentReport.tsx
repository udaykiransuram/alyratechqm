import { ArrowLeft, ArrowRight, BookOpen, CircleCheck, Sparkles } from "lucide-react";

import StaticContentRenderer from "@/components/StaticContentRenderer";
import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import SummerCrashPaymentCard from "@/components/summer-crash/SummerCrashPaymentCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  SummerCrashDiagnosticParentReport,
} from "@/lib/server/summer-crash-parent-report";
import {
  formatSummerCrashPrice,
} from "@/lib/summer-crash/shared";
import { SUMMER_CRASH_HOME_PATH } from "@/lib/summer-crash/constants";

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Recently submitted";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently submitted";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatAreaMeta(totalQuestions: number, weaknessPct: number) {
  return `${Math.round(weaknessPct)}% need support across ${totalQuestions} question${
    totalQuestions === 1 ? "" : "s"
  }`;
}

function statusBadgeVariant(status: "incorrect" | "unattempted") {
  return status === "incorrect" ? "warning" : "secondary";
}

function kindLabel(kind: string) {
  if (kind === "subskill") {
    return "Subskill";
  }
  if (kind === "topic") {
    return "Topic";
  }
  if (kind === "subject") {
    return "Subject";
  }
  return "Section";
}

function DonutChart({
  correct,
  incorrect,
  unattempted,
}: {
  correct: number;
  incorrect: number;
  unattempted: number;
}) {
  const total = Math.max(1, correct + incorrect + unattempted);
  const correctStop = (correct / total) * 360;
  const incorrectStop = correctStop + (incorrect / total) * 360;
  const background = `conic-gradient(
    rgb(16 185 129) 0deg ${correctStop}deg,
    rgb(245 158 11) ${correctStop}deg ${incorrectStop}deg,
    rgb(148 163 184) ${incorrectStop}deg 360deg
  )`;

  return (
    <div className="flex flex-col items-center gap-4 rounded-[1.75rem] border border-border/70 bg-background/90 px-5 py-5">
      <div
        className="relative flex h-40 w-40 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
        style={{ background }}
      >
        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-background/95 text-center shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Score
          </span>
          <span className="text-2xl font-semibold text-foreground">
            {Math.round((correct / total) * 100)}%
          </span>
        </div>
      </div>
      <div className="grid w-full gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-emerald-800">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">
            Correct
          </p>
          <p className="mt-1 text-lg font-semibold">{correct}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-amber-800">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">
            Incorrect
          </p>
          <p className="mt-1 text-lg font-semibold">{incorrect}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-slate-700">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">
            Skipped
          </p>
          <p className="mt-1 text-lg font-semibold">{unattempted}</p>
        </div>
      </div>
    </div>
  );
}

function WeakAreaBars({
  areas,
}: {
  areas: SummerCrashDiagnosticParentReport["focusAreas"];
}) {
  if (areas.length === 0) {
    return (
      <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/75 px-4 py-4 text-sm leading-6 text-muted-foreground">
        We could not identify topic-level weak areas for this test yet, but the question review below still shows where support is needed.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {areas.slice(0, 5).map((area) => (
        <div
          key={`${area.kind}-${area.label}`}
          className="rounded-[1.25rem] border border-border/68 bg-background/84 px-4 py-3"
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{area.label}</p>
              <p className="text-xs text-muted-foreground">
                {kindLabel(area.kind)}
              </p>
            </div>
            <span className="text-sm font-semibold text-amber-700">
              {Math.round(area.weaknessPct)}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
              style={{ width: `${Math.max(10, Math.round(area.weaknessPct))}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatAreaMeta(area.totalQuestions, area.weaknessPct)}
          </p>
        </div>
      ))}
    </div>
  );
}

function JoinCard({ report }: { report: SummerCrashDiagnosticParentReport }) {
  const priceLabel = formatSummerCrashPrice(
    report.courseAccess.price,
    report.courseAccess.currency,
  );

  if (report.courseAccess.isUnlocked) {
    return (
      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Summer lessons are ready</CardTitle>
        </CardHeader>
        <CardContent className="app-section-body space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            Your child can start the Summer Crash Course now and work on the weak areas shown in this report.
          </p>
          <div className="space-y-2 rounded-[1.25rem] border border-emerald-200/80 bg-emerald-50/80 px-4 py-4 text-sm text-emerald-900">
            <div className="flex items-start gap-3">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Guided lessons already unlocked for this student.</p>
            </div>
            <div className="flex items-start gap-3">
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Open the course and begin with the weakest areas first.</p>
            </div>
          </div>
          <Button asChild className="app-button-primary w-full">
            <AppPrefetchLink href={SUMMER_CRASH_HOME_PATH}>
              Open Summer Course
            </AppPrefetchLink>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="app-surface overflow-hidden">
      <CardHeader className="app-section-header">
        <CardTitle>Want help with these weak areas?</CardTitle>
      </CardHeader>
      <CardContent className="app-section-body space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">
          These weak subskills and topics are exactly what the Summer Crash Course is built to improve.
        </p>
        <div className="space-y-2 rounded-[1.25rem] border border-primary/20 bg-primary/5 px-4 py-4 text-sm text-foreground">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>Short lessons focused on the weak areas in this report.</p>
          </div>
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>Guided practice instead of random revision.</p>
          </div>
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>Clear progress support before the next school term starts.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="app-meta-chip">{priceLabel}</span>
          <span className="app-meta-chip">
            {report.courseAccess.latestPaymentStatus === "pending"
              ? "Checking payment"
              : report.courseAccess.latestPaymentStatus === "failed"
                ? "Payment needs retry"
                : "Lessons locked"}
          </span>
        </div>
        <SummerCrashPaymentCard
          price={report.courseAccess.price}
          currency={report.courseAccess.currency}
          latestPaymentStatus={report.courseAccess.latestPaymentStatus}
        />
      </CardContent>
    </Card>
  );
}

export default function SummerCrashDiagnosticParentReport({
  report,
  defaultBackHref,
}: {
  report: SummerCrashDiagnosticParentReport;
  defaultBackHref: string;
}) {
  return (
    <div className="app-student-page-shell">
      <PageHero
        className="app-learning-hero"
        eyebrow="Free Diagnostic Report"
        title={`${report.student}'s learning summary`}
        variant="overview"
        density="compact"
        description="We found the main subskills and topics where your child needs more support. Review the summary below, then continue into the Summer Crash Course for guided help."
        actions={
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="app-button-back">
              <AppPrefetchLink href={defaultBackHref}>
                <ArrowLeft className="h-4 w-4" />
                Back to Summer Home
              </AppPrefetchLink>
            </Button>
            <Button asChild className="app-button-primary">
              <a href="#summer-join-card">
                Join Summer Course
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">{report.classBand}</span>
            <span className="app-meta-chip">{report.paperTitle}</span>
            <span className="app-meta-chip">
              Submitted {formatDateTime(report.submittedAt)}
            </span>
            {report.guardianName ? (
              <span className="app-meta-chip">Parent: {report.guardianName}</span>
            ) : null}
          </>
        }
        stats={[
          {
            label: "Score",
            value:
              report.totalMarks > 0
                ? `${report.score} / ${report.totalMarks}`
                : String(report.score),
            meta: `${report.percent}% overall`,
          },
          {
            label: "Correct",
            value: String(report.overview.correct),
            meta: `${report.overview.answered} answered`,
          },
          {
            label: "Incorrect",
            value: String(report.overview.incorrect),
            meta: "Need more support",
          },
          {
            label: "Skipped",
            value: String(report.overview.unattempted),
            meta: "Needs revision",
          },
        ]}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>At a glance</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body grid gap-5 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
              <DonutChart
                correct={report.overview.correct}
                incorrect={report.overview.incorrect}
                unattempted={report.overview.unattempted}
              />
              <div className="space-y-4">
                <div className="rounded-[1.25rem] border border-border/70 bg-background/84 px-4 py-4">
                  <p className="text-sm font-semibold text-foreground">
                    What this means
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    This test shows the parts your child is already comfortable with and the parts that need extra support before the next school term.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-border/70 bg-background/84 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Needs support
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-amber-700">
                      {report.overview.incorrect + report.overview.unattempted}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      questions need follow-up
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] border border-border/70 bg-background/84 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Best next move
                    </p>
                    <p className="mt-2 text-sm font-medium leading-6 text-foreground">
                      Start with the weakest subskill or topic shown below, not with everything at once.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Where your child is doing well</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              {report.strengths.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {report.strengths.map((area) => (
                    <div
                      key={`${area.kind}-${area.label}`}
                      className="rounded-[1.25rem] border border-emerald-200/80 bg-emerald-50/75 px-4 py-4 text-emerald-950"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="success">{kindLabel(area.kind)}</Badge>
                        <span className="text-sm font-semibold">
                          {area.accuracyPct}%
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-semibold">{area.label}</p>
                      <p className="mt-1 text-xs text-emerald-900/75">
                        Stronger performance across {area.totalQuestions} question
                        {area.totalQuestions === 1 ? "" : "s"}.
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/75 px-4 py-4 text-sm leading-6 text-muted-foreground">
                  This report is mainly showing the areas that need help next. Once those improve, the stronger areas will become clearer too.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Needs support next</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body space-y-5">
              <WeakAreaBars areas={report.focusAreas} />

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.25rem] border border-border/68 bg-background/84 px-4 py-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      Weak subskills
                    </p>
                    <Badge variant="warning">Focus first</Badge>
                  </div>
                  <div className="space-y-3">
                    {report.weakSubskills.length > 0 ? (
                      report.weakSubskills.map((area) => (
                        <div
                          key={`subskill-${area.label}`}
                          className="rounded-2xl border border-border/60 bg-background/85 px-3 py-3"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {area.label}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatAreaMeta(area.totalQuestions, area.weaknessPct)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm leading-6 text-muted-foreground">
                        No separate subskill tags were available for this test, so use the topic summary below as the main guide.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.25rem] border border-border/68 bg-background/84 px-4 py-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      Weak topics
                    </p>
                    <Badge variant="secondary">Revision plan</Badge>
                  </div>
                  <div className="space-y-3">
                    {report.weakTopics.length > 0 ? (
                      report.weakTopics.map((area) => (
                        <div
                          key={`topic-${area.kind}-${area.label}`}
                          className="rounded-2xl border border-border/60 bg-background/85 px-3 py-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {area.label}
                            </p>
                            <Badge variant="outline">{kindLabel(area.kind)}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatAreaMeta(area.totalQuestions, area.weaknessPct)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm leading-6 text-muted-foreground">
                        Topic-level labels were not available for this test, so use the question review section below as the main guide.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>What to do at home next</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <div className="space-y-3">
                {report.nextSteps.map((step, index) => (
                  <div
                    key={`${step}-${index}`}
                    className="flex items-start gap-3 rounded-[1.25rem] border border-border/68 bg-background/84 px-4 py-4"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-foreground">{step}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Questions to review together</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">
                Open only the questions that need attention. Focus first on the weak area shown on each card.
              </p>
              {report.reviewQuestions.map((review) => (
                <details
                  key={`${review.status}-${review.questionId}`}
                  className="rounded-[1.35rem] border border-border/68 bg-background/90"
                >
                  <summary className="cursor-pointer list-none px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={statusBadgeVariant(review.status)}>
                            {review.status === "incorrect" ? "Incorrect" : "Skipped"}
                          </Badge>
                          {review.weakAreaLabel ? (
                            <Badge variant="outline">{review.weakAreaLabel}</Badge>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm font-semibold text-foreground">
                          Question {review.questionNumber}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {review.promptPreview || "Open to review this question."}
                        </p>
                      </div>
                      <div className="shrink-0 text-sm text-muted-foreground">
                        Tap to review
                      </div>
                    </div>
                  </summary>

                  <div className="border-t border-border/60 px-4 py-4">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
                      <div className="min-w-0 space-y-4">
                        <div className="rounded-[1.25rem] border border-border/60 bg-background/85 px-4 py-4">
                          <p className="mb-3 text-sm font-semibold text-foreground">
                            Question preview
                          </p>
                          <StaticContentRenderer
                            htmlContent={review.promptHtml}
                            className="prose-sm"
                          />
                        </div>
                        {review.explanationHtml ? (
                          <div className="rounded-[1.25rem] border border-border/60 bg-background/85 px-4 py-4">
                            <p className="mb-3 text-sm font-semibold text-foreground">
                              Explanation
                            </p>
                            <StaticContentRenderer
                              htmlContent={review.explanationHtml}
                              className="prose-sm"
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-[1.25rem] border border-border/60 bg-background/85 px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Your child&apos;s answer
                          </p>
                          <p className="mt-2 text-sm leading-6 text-foreground">
                            {review.studentAnswerSummary}
                          </p>
                        </div>
                        <div className="rounded-[1.25rem] border border-emerald-200/75 bg-emerald-50/70 px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-800">
                            Correct answer
                          </p>
                          <p className="mt-2 text-sm leading-6 text-emerald-950">
                            {review.correctAnswerSummary}
                          </p>
                        </div>
                        <div className="rounded-[1.25rem] border border-border/60 bg-background/85 px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Area to revise
                          </p>
                          <p className="mt-2 text-sm font-medium text-foreground">
                            {review.topicLabel || review.subjectLabel || review.weakAreaLabel}
                          </p>
                        </div>
                        <Button asChild variant="outline" className="w-full">
                          <AppPrefetchLink href={review.detailHref}>
                            Open full question
                          </AppPrefetchLink>
                        </Button>
                      </div>
                    </div>
                  </div>
                </details>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5 lg:sticky lg:top-24">
          <div id="summer-join-card" className="scroll-mt-24">
            <JoinCard report={report} />
          </div>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Need help?</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">
                {report.supportContact
                  ? `Support: ${report.supportContact}`
                  : "If you need help with payment or access, contact the support team."}
              </p>
              <Button asChild variant="outline" className="w-full">
                <AppPrefetchLink href={defaultBackHref}>
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
