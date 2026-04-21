import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  CircleCheck,
  ClipboardList,
  MessageCircleMore,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import StaticContentRenderer from "@/components/StaticContentRenderer";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import SummerCrashPaymentCard from "@/components/summer-crash/SummerCrashPaymentCard";
import SummerCrashWhatsappSummaryCard from "@/components/summer-crash/SummerCrashWhatsappSummaryCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  SummerCrashDiagnosticParentReport,
} from "@/lib/server/summer-crash-parent-report";
import { SUMMER_CRASH_HOME_PATH } from "@/lib/summer-crash/constants";
import { formatSummerCrashPrice } from "@/lib/summer-crash/shared";
import { cn } from "@/lib/utils";

type AreaSummary = SummerCrashDiagnosticParentReport["focusAreas"][number];
type ReviewQuestion = SummerCrashDiagnosticParentReport["reviewQuestions"][number];

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

function getLeadFocus(report: SummerCrashDiagnosticParentReport): AreaSummary | null {
  return report.focusAreas[0] || report.weakSubskills[0] || report.weakTopics[0] || null;
}

function getLeadStrength(
  report: SummerCrashDiagnosticParentReport,
): AreaSummary | null {
  return report.strengths[0] || null;
}

function getPerformanceHeadline(percent: number) {
  if (percent >= 70) {
    return "The basics are there. Now it is time to strengthen consistency.";
  }
  if (percent >= 40) {
    return "Some concepts are working, but weak foundations are still pulling the score down.";
  }
  return "This report shows a clear foundation gap, but it also shows where to begin.";
}

function getPerformanceNarrative(report: SummerCrashDiagnosticParentReport) {
  const leadFocus = getLeadFocus(report);
  const leadStrength = getLeadStrength(report);

  if (report.percent >= 70) {
    return `Your child already has a workable base${
      leadStrength ? `, especially in ${leadStrength.label}` : ""
    }. The next win is to tighten ${
      leadFocus ? leadFocus.label : "the weaker areas"
    } before the next term.`;
  }

  if (report.percent >= 40) {
    return `Some ideas are landing, but the result is still being pulled down by ${
      leadFocus ? leadFocus.label : "a few weak areas"
    }. A short, focused revision plan will help more than broad practice.`;
  }

  return `The score suggests that core maths foundations still need repair${
    leadFocus ? ` around ${leadFocus.label}` : ""
  }. The good news is that you do not need to revise everything at once. Start with the weak areas below and build back confidence step by step.`;
}

function getCourseStatusLabel(report: SummerCrashDiagnosticParentReport) {
  if (report.courseAccess.isUnlocked) {
    return "Lessons ready";
  }
  if (report.courseAccess.latestPaymentStatus === "pending") {
    return "Payment pending";
  }
  if (report.courseAccess.latestPaymentStatus === "failed") {
    return "Payment needs retry";
  }
  if (report.courseAccess.requiresPayment) {
    return `${formatSummerCrashPrice(
      report.courseAccess.price,
      report.courseAccess.currency,
    )} to unlock`;
  }

  return "Course available";
}

function MetaPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200/75 bg-white/82 px-3 py-1 text-xs font-medium text-slate-700 shadow-[0_12px_30px_-28px_rgba(15,23,42,0.45)]">
      {children}
    </span>
  );
}

function HeroInsightCard({
  label,
  value,
  meta,
  icon: Icon,
  toneClassName,
}: {
  label: string;
  value: string;
  meta: string;
  icon: LucideIcon;
  toneClassName: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.5rem] border px-4 py-4 shadow-[0_22px_46px_-34px_rgba(15,23,42,0.28)]",
        toneClassName,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-75">
            {label}
          </p>
          <p className="text-base font-semibold leading-6">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 opacity-80">{meta}</p>
    </div>
  );
}

function ReportHero({
  report,
  defaultBackHref,
  courseActionHref,
  courseActionLabel,
}: {
  report: SummerCrashDiagnosticParentReport;
  defaultBackHref: string;
  courseActionHref: string;
  courseActionLabel: string;
}) {
  const leadFocus = getLeadFocus(report);
  const leadStrength = getLeadStrength(report);

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-sky-200/70 bg-[linear-gradient(135deg,rgba(236,254,255,0.98)_0%,rgba(255,255,255,0.98)_44%,rgba(248,250,252,0.98)_100%)] px-5 py-5 shadow-[0_34px_70px_-48px_rgba(8,47,73,0.4)] sm:px-6 sm:py-7">
      <div className="absolute -left-16 top-0 h-48 w-48 rounded-full bg-sky-200/35 blur-3xl" />
      <div className="absolute -right-10 bottom-0 h-56 w-56 rounded-full bg-teal-200/45 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/85" />

      <div className="relative z-10 grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <MetaPill>Free Diagnostic Report</MetaPill>
            <MetaPill>{report.classBand}</MetaPill>
            <MetaPill>{report.paperTitle}</MetaPill>
          </div>

          <h1 className="mt-4 max-w-2xl text-pretty font-[family:var(--font-display)] text-[2rem] leading-tight text-slate-950 sm:text-[2.25rem]">
            {report.student}&apos;s maths snapshot
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700 sm:text-[15px]">
            A calmer parent view of what feels steady, what needs support, and what
            the next best step should be before the new term starts.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <MetaPill>Submitted {formatDateTime(report.submittedAt)}</MetaPill>
            {report.guardianName ? (
              <MetaPill>Parent: {report.guardianName}</MetaPill>
            ) : null}
            <MetaPill>{getCourseStatusLabel(report)}</MetaPill>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="outline" className="app-button-back">
              <AppPrefetchLink href={defaultBackHref}>
                <ArrowLeft className="h-4 w-4" />
                Back to Summer Home
              </AppPrefetchLink>
            </Button>
            <Button asChild className="app-button-primary">
              <AppPrefetchLink href={courseActionHref}>
                {courseActionLabel}
                <ArrowRight className="h-4 w-4" />
              </AppPrefetchLink>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 self-start">
          <HeroInsightCard
            label="Main focus"
            value={leadFocus?.label || "Review the weakest questions first"}
            meta={
              leadFocus
                ? formatAreaMeta(leadFocus.totalQuestions, leadFocus.weaknessPct)
                : "The questions below will show where help is needed first."
            }
            icon={TriangleAlert}
            toneClassName="border-amber-200/80 bg-amber-50/88 text-amber-950"
          />
          <HeroInsightCard
            label="Stronger area"
            value={leadStrength?.label || "The stronger area will become clearer after a few focused revisions"}
            meta={
              leadStrength
                ? `${leadStrength.accuracyPct}% accuracy across ${leadStrength.totalQuestions} question${
                    leadStrength.totalQuestions === 1 ? "" : "s"
                  }`
                : "This attempt is mainly showing the areas that need support first."
            }
            icon={Trophy}
            toneClassName="border-emerald-200/80 bg-emerald-50/88 text-emerald-950"
          />
          <HeroInsightCard
            label="Summer course"
            value={getCourseStatusLabel(report)}
            meta={
              report.courseAccess.isUnlocked
                ? "The guided lesson path is already available for this student."
                : "Unlock the guided lesson path after reading the weak-area summary below."
            }
            icon={Sparkles}
            toneClassName="border-sky-200/80 bg-sky-50/88 text-sky-950"
          />
        </div>
      </div>
    </div>
  );
}

function SummaryMetricCard({
  label,
  value,
  meta,
  icon: Icon,
  toneClassName,
}: {
  label: string;
  value: string;
  meta: string;
  icon: LucideIcon;
  toneClassName: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.45rem] border px-4 py-4 shadow-[0_20px_40px_-36px_rgba(15,23,42,0.32)]",
        toneClassName,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-75">
            {label}
          </p>
          <p className="mt-2 tabular-nums text-2xl font-semibold leading-tight">
            {value}
          </p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 opacity-80">{meta}</p>
    </div>
  );
}

function SummarySnapshot({
  report,
}: {
  report: SummerCrashDiagnosticParentReport;
}) {
  const summaryItems = [
    {
      label: "Score",
      value:
        report.totalMarks > 0
          ? `${report.score} / ${report.totalMarks}`
          : String(report.score),
      meta: `${report.percent}% overall`,
      icon: Target,
      toneClassName: "border-sky-200/80 bg-sky-50/88 text-sky-950",
    },
    {
      label: "Correct",
      value: String(report.overview.correct),
      meta: `${report.overview.answered} answered`,
      icon: CircleCheck,
      toneClassName: "border-emerald-200/80 bg-emerald-50/88 text-emerald-950",
    },
    {
      label: "Incorrect",
      value: String(report.overview.incorrect),
      meta: "Need more support",
      icon: TriangleAlert,
      toneClassName: "border-amber-200/80 bg-amber-50/88 text-amber-950",
    },
    {
      label: "Skipped",
      value: String(report.overview.unattempted),
      meta: "Questions to revisit",
      icon: ClipboardList,
      toneClassName: "border-slate-200/85 bg-slate-50/92 text-slate-900",
    },
  ] as const;

  return (
    <section
      aria-label="Diagnostic summary"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {summaryItems.map((item) => (
        <SummaryMetricCard
          key={item.label}
          label={item.label}
          value={item.value}
          meta={item.meta}
          icon={item.icon}
          toneClassName={item.toneClassName}
        />
      ))}
    </section>
  );
}

function SectionShell({
  eyebrow,
  title,
  description,
  className,
  contentClassName,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden border border-slate-200/80 bg-white/95 shadow-[0_30px_60px_-48px_rgba(15,23,42,0.34)]",
        className,
      )}
    >
      <CardHeader className="border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.9)_0%,rgba(255,255,255,0.98)_100%)] px-5 py-5 sm:px-6">
        <div className="space-y-1.5">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {eyebrow}
            </p>
          ) : null}
          <CardTitle className="text-pretty text-[1.35rem] font-semibold text-slate-950">
            {title}
          </CardTitle>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              {description}
            </p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className={cn("px-5 py-5 sm:px-6 sm:py-6", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
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

  const legendItems = [
    {
      label: "Correct",
      value: correct,
      className:
        "border-emerald-200/80 bg-emerald-50/88 text-emerald-950",
    },
    {
      label: "Incorrect",
      value: incorrect,
      className:
        "border-amber-200/80 bg-amber-50/88 text-amber-950",
    },
    {
      label: "Skipped",
      value: unattempted,
      className: "border-slate-200/80 bg-slate-50/92 text-slate-900",
    },
  ] as const;

  return (
    <div className="rounded-[1.75rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.92)_0%,rgba(255,255,255,0.98)_100%)] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
      <div className="flex flex-col items-center gap-5">
        <div
          className="relative flex h-44 w-44 items-center justify-center rounded-full shadow-[0_24px_50px_-36px_rgba(15,23,42,0.3)]"
          style={{ background }}
        >
          <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-slate-950 text-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-100/70">
              Overall
            </span>
            <span className="mt-1 font-[family:var(--font-display)] text-[2rem] leading-none">
              {Math.round((correct / total) * 100)}%
            </span>
          </div>
        </div>

        <div className="grid w-full gap-2 text-sm sm:grid-cols-3">
          {legendItems.map((item) => (
            <div
              key={item.label}
              className={cn(
                "rounded-[1.15rem] border px-3 py-3 shadow-[0_18px_36px_-34px_rgba(15,23,42,0.24)]",
                item.className,
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-75">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {item.value}
              </p>
            </div>
          ))}
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
      <div className="rounded-[1.35rem] border border-dashed border-slate-200/80 bg-slate-50/70 px-4 py-4 text-sm leading-6 text-slate-600">
        We could not identify topic-level weak areas for this test yet, but the
        question review below still shows where support is needed.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {areas.slice(0, 5).map((area, index) => (
        <div
          key={`${area.kind}-${area.label}`}
          className="rounded-[1.35rem] border border-slate-200/80 bg-white/92 px-4 py-4 shadow-[0_18px_36px_-34px_rgba(15,23,42,0.22)]"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-100 px-2 text-[11px] font-semibold text-amber-900">
                  {index + 1}
                </span>
                <p className="text-sm font-semibold text-slate-950">{area.label}</p>
              </div>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                {kindLabel(area.kind)}
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-amber-700">
              {Math.round(area.weaknessPct)}%
            </span>
          </div>

          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/85">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500"
              style={{ width: `${Math.max(12, Math.round(area.weaknessPct))}%` }}
            />
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-600">
            {formatAreaMeta(area.totalQuestions, area.weaknessPct)}
          </p>
        </div>
      ))}
    </div>
  );
}

function LearningSignalsSection({
  report,
}: {
  report: SummerCrashDiagnosticParentReport;
}) {
  const leadFocus = getLeadFocus(report);

  return (
    <SectionShell
      eyebrow="Overview"
      title="What this report is telling us"
      description="Start here first. It shows whether the basics are holding, which area is weakest, and what kind of follow-up will help most."
    >
      <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <DonutChart
          correct={report.overview.correct}
          incorrect={report.overview.incorrect}
          unattempted={report.overview.unattempted}
        />

        <div className="min-w-0 space-y-4">
          <div className="rounded-[1.7rem] bg-[linear-gradient(135deg,rgba(8,47,73,0.98)_0%,rgba(15,118,110,0.95)_100%)] px-5 py-5 text-white shadow-[0_30px_56px_-42px_rgba(8,47,73,0.66)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-100/75">
              Parent takeaway
            </p>
            <h3 className="mt-3 text-pretty font-[family:var(--font-display)] text-[1.55rem] leading-tight">
              {getPerformanceHeadline(report.percent)}
            </h3>
            <p className="mt-3 text-sm leading-7 text-sky-50/90">
              {getPerformanceNarrative(report)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.35rem] border border-slate-200/80 bg-slate-50/80 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Needs support now
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
                {report.overview.incorrect + report.overview.unattempted}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                questions still need a follow-up review.
              </p>
            </div>

            <div className="rounded-[1.35rem] border border-slate-200/80 bg-slate-50/80 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Best next move
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-950">
                {leadFocus?.label || "Start with the weakest question group first."}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Start with one weak area at a time instead of revising the whole syllabus.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-950">
              Start with these weak areas first
            </p>
            <p className="text-sm leading-6 text-slate-600">
              These are the topics or subskills causing the biggest drag on the score.
            </p>
          </div>
        </div>
        <WeakAreaBars areas={report.focusAreas} />
      </div>
    </SectionShell>
  );
}

function StrengthsAndFocusSection({
  report,
}: {
  report: SummerCrashDiagnosticParentReport;
}) {
  return (
    <SectionShell
      eyebrow="Learning pattern"
      title="Where confidence is holding and where support should begin"
      description="This gives parents two simple views: the areas that already feel steadier, and the exact subskills or topics to start repairing next."
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-[1.7rem] border border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.95)_0%,rgba(255,255,255,0.98)_100%)] px-4 py-4 shadow-[0_24px_44px_-40px_rgba(5,150,105,0.38)]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Trophy className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-emerald-950">
                Where your child is doing well
              </p>
              <p className="text-sm leading-6 text-emerald-900/75">
                These areas can be used to rebuild confidence.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {report.strengths.length > 0 ? (
              report.strengths.slice(0, 3).map((area) => (
                <div
                  key={`${area.kind}-${area.label}`}
                  className="rounded-[1.25rem] border border-emerald-200/80 bg-white/82 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="success">{kindLabel(area.kind)}</Badge>
                    <span className="text-sm font-semibold tabular-nums text-emerald-800">
                      {area.accuracyPct}%
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-emerald-950">
                    {area.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-emerald-900/75">
                    Stronger performance across {area.totalQuestions} question
                    {area.totalQuestions === 1 ? "" : "s"}.
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-emerald-200/80 bg-white/82 px-4 py-4 text-sm leading-6 text-emerald-900/75">
                This attempt is mostly highlighting the areas that need support first.
                Once those improve, the stronger areas will become clearer too.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.7rem] border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.96)_0%,rgba(255,255,255,0.98)_100%)] px-4 py-4 shadow-[0_24px_44px_-40px_rgba(217,119,6,0.38)]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Target className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-950">
                Needs support next
              </p>
              <p className="text-sm leading-6 text-amber-900/75">
                Begin with the weak subskills, then move into the related topics.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-[1.3rem] border border-amber-200/75 bg-white/82 px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-amber-950">
                  Weak subskills
                </p>
                <Badge variant="warning">Start here</Badge>
              </div>
              <div className="space-y-3">
                {report.weakSubskills.length > 0 ? (
                  report.weakSubskills.map((area) => (
                    <div
                      key={`subskill-${area.label}`}
                      className="rounded-[1.05rem] border border-amber-100/90 bg-amber-50/80 px-3 py-3"
                    >
                      <p className="text-sm font-medium text-amber-950">
                        {area.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-amber-900/70">
                        {formatAreaMeta(area.totalQuestions, area.weaknessPct)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-amber-900/75">
                    No separate subskill tags were available for this test, so use
                    the weak topics as the main guide.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[1.3rem] border border-amber-200/75 bg-white/82 px-4 py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-amber-950">
                  Weak topics
                </p>
                <Badge variant="secondary">Then revise these</Badge>
              </div>
              <div className="space-y-3">
                {report.weakTopics.length > 0 ? (
                  report.weakTopics.map((area) => (
                    <div
                      key={`topic-${area.kind}-${area.label}`}
                      className="rounded-[1.05rem] border border-amber-100/90 bg-amber-50/80 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-amber-950">
                          {area.label}
                        </p>
                        <Badge variant="outline">{kindLabel(area.kind)}</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-amber-900/70">
                        {formatAreaMeta(area.totalQuestions, area.weaknessPct)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-amber-900/75">
                    Topic-level labels were not available for this test, so use the
                    question review section below as the main guide.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function NextStepsSection({
  report,
  supportWhatsappHref,
  supportLabel,
}: {
  report: SummerCrashDiagnosticParentReport;
  supportWhatsappHref: string;
  supportLabel: string;
}) {
  return (
    <SectionShell
      eyebrow="Action plan"
      title="What to do next at home"
      description="Short, specific follow-up works better than broad revision. Use these as the first few steps after reading the report."
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-3">
          {report.nextSteps.map((step, index) => (
            <div
              key={`${step}-${index}`}
              className="flex items-start gap-3 rounded-[1.35rem] border border-slate-200/80 bg-slate-50/85 px-4 py-4 shadow-[0_20px_40px_-38px_rgba(15,23,42,0.24)]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-800">
                {index + 1}
              </div>
              <p className="text-sm leading-7 text-slate-900">{step}</p>
            </div>
          ))}
        </div>

        <div className="rounded-[1.7rem] bg-[linear-gradient(145deg,rgba(12,74,110,0.98)_0%,rgba(8,47,73,0.98)_100%)] px-5 py-5 text-white shadow-[0_28px_54px_-40px_rgba(8,47,73,0.7)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-100/72">
            Parent note
          </p>
          <p className="mt-3 text-pretty font-[family:var(--font-display)] text-[1.45rem] leading-tight">
            Do not try to fix everything in one go.
          </p>
          <p className="mt-3 text-sm leading-7 text-sky-50/88">
            Start with one weak area, review a few similar questions, then stop.
            Short, repeatable practice helps more than longer revision that feels heavy.
          </p>
          {report.supportContact ? (
            <a
              href={supportWhatsappHref || undefined}
              target={supportWhatsappHref ? "_blank" : undefined}
              rel={supportWhatsappHref ? "noreferrer" : undefined}
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white underline-offset-4 transition hover:underline"
            >
              <MessageCircleMore className="h-4 w-4" />
              {supportLabel}
            </a>
          ) : null}
        </div>
      </div>
    </SectionShell>
  );
}

function QuestionReviewCard({ review }: { review: ReviewQuestion }) {
  return (
    <details className="group rounded-[1.5rem] border border-slate-200/80 bg-white/96 shadow-[0_22px_42px_-38px_rgba(15,23,42,0.24)]">
      <summary className="list-none cursor-pointer px-5 py-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusBadgeVariant(review.status)}>
                {review.status === "incorrect" ? "Incorrect" : "Skipped"}
              </Badge>
              {review.weakAreaLabel ? (
                <span className="inline-flex rounded-full border border-slate-200/80 bg-slate-50/90 px-3 py-1 text-xs font-medium text-slate-700">
                  {review.weakAreaLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-base font-semibold text-slate-950">
              Question {review.questionNumber}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {review.promptPreview || "Open to review this question."}
            </p>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="hidden max-w-[14rem] truncate lg:inline">
              {review.topicLabel || review.subjectLabel || "Open review"}
            </span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/90 transition group-open:rotate-180">
              <ChevronDown className="h-4 w-4" />
            </span>
          </div>
        </div>
      </summary>

      <div className="border-t border-slate-200/80 px-5 py-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18.5rem]">
          <div className="min-w-0 space-y-4">
            <div className="rounded-[1.3rem] border border-slate-200/75 bg-slate-50/70 px-4 py-4">
              <p className="mb-3 text-sm font-semibold text-slate-950">
                Question preview
              </p>
              <StaticContentRenderer
                htmlContent={review.promptHtml}
                className="prose-sm"
              />
            </div>

            {review.explanationHtml ? (
              <div className="rounded-[1.3rem] border border-slate-200/75 bg-slate-50/70 px-4 py-4">
                <p className="mb-3 text-sm font-semibold text-slate-950">
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
            <div className="rounded-[1.25rem] border border-slate-200/75 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                Your child&apos;s answer
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-900">
                {review.studentAnswerSummary}
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-emerald-200/75 bg-emerald-50/80 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-800">
                Correct answer
              </p>
              <p className="mt-2 text-sm leading-6 text-emerald-950">
                {review.correctAnswerSummary}
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-amber-200/75 bg-amber-50/78 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-800">
                Area to revise
              </p>
              <p className="mt-2 text-sm font-medium text-amber-950">
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
  );
}

function ReviewQuestionsSection({
  report,
}: {
  report: SummerCrashDiagnosticParentReport;
}) {
  return (
    <SectionShell
      eyebrow="Review together"
      title="Questions to review together"
      description="Open only the questions that need attention. Focus on the weak area on each card instead of trying to cover everything."
    >
      <div className="space-y-3">
        {report.reviewQuestions.length > 0 ? (
          report.reviewQuestions.map((review) => (
            <QuestionReviewCard
              key={`${review.status}-${review.questionId}`}
              review={review}
            />
          ))
        ) : (
          <div className="rounded-[1.35rem] border border-dashed border-emerald-200/80 bg-emerald-50/75 px-4 py-4 text-sm leading-6 text-emerald-900">
            There are no incorrect or skipped questions to review from this attempt.
          </div>
        )}
      </div>
    </SectionShell>
  );
}

function JoinCard({ report }: { report: SummerCrashDiagnosticParentReport }) {
  const priceLabel = formatSummerCrashPrice(
    report.courseAccess.price,
    report.courseAccess.currency,
  );
  const summerCourseHref = report.courseAccess.isUnlocked
    ? SUMMER_CRASH_HOME_PATH
    : `${SUMMER_CRASH_HOME_PATH}#summer-unlock-lessons`;

  if (report.courseAccess.isUnlocked) {
    return (
      <Card className="overflow-hidden border border-emerald-200/80 bg-[linear-gradient(160deg,rgba(236,253,245,0.96)_0%,rgba(255,255,255,0.98)_100%)] shadow-[0_32px_60px_-46px_rgba(5,150,105,0.42)]">
        <CardHeader className="border-b border-emerald-200/80 px-5 py-5">
          <CardTitle className="text-xl text-emerald-950">
            Summer lessons are ready
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-5 py-5">
          <p className="text-sm leading-7 text-emerald-950/80">
            Use the weak areas in this report as the order for starting the Summer
            course. The first lessons should match the weakest foundations shown here.
          </p>

          <div className="space-y-2 rounded-[1.35rem] border border-emerald-200/80 bg-white/84 px-4 py-4 text-sm text-emerald-950">
            <div className="flex items-start gap-3">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Begin with the weakest subskill or topic first.</p>
            </div>
            <div className="flex items-start gap-3">
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Use this report as the family guide while lessons are in progress.</p>
            </div>
          </div>

          <Button asChild className="app-button-primary w-full">
            <AppPrefetchLink href={summerCourseHref}>
              Open Summer Course
            </AppPrefetchLink>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border border-slate-900/10 bg-[linear-gradient(145deg,rgba(12,74,110,0.98)_0%,rgba(8,47,73,1)_100%)] text-white shadow-[0_36px_66px_-46px_rgba(8,47,73,0.78)]">
      <div className="absolute -right-12 -top-10 h-36 w-36 rounded-full bg-sky-300/20 blur-3xl" />
      <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-teal-300/20 blur-3xl" />

      <CardHeader className="relative border-b border-white/10 px-5 py-5">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-100/72">
            Next step
          </p>
          <CardTitle className="text-2xl text-white">
            Join the Summer Crash Course
          </CardTitle>
          <p className="text-sm leading-7 text-sky-50/84">
            The weak areas in this report are exactly what the Summer course is built
            to repair with guided lessons and focused practice.
          </p>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4 px-5 py-5">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-white/14 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            {priceLabel}
          </span>
          <span className="inline-flex rounded-full border border-white/14 bg-white/10 px-3 py-1 text-xs font-semibold text-white/88">
            {getCourseStatusLabel(report)}
          </span>
        </div>

        <div className="space-y-2 rounded-[1.4rem] border border-white/12 bg-white/8 px-4 py-4 text-sm text-white/92">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
            <p>Short lessons focused on the weak areas shown in this report.</p>
          </div>
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
            <p>Guided practice instead of broad, random revision.</p>
          </div>
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
            <p>A clearer recovery path before the next school term begins.</p>
          </div>
        </div>

        <div className="rounded-[1.35rem] bg-white/10 px-4 py-4">
          <SummerCrashPaymentCard
            price={report.courseAccess.price}
            currency={report.courseAccess.currency}
            latestPaymentStatus={report.courseAccess.latestPaymentStatus}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SupportCard({
  defaultBackHref,
  supportHref,
  supportLabel,
  hasSupportContact,
}: {
  defaultBackHref: string;
  supportHref: string;
  supportLabel: string;
  hasSupportContact: boolean;
}) {
  return (
    <Card className="overflow-hidden border border-slate-200/80 bg-white/96 shadow-[0_28px_58px_-48px_rgba(15,23,42,0.3)]">
      <CardHeader className="border-b border-slate-200/80 px-5 py-5">
        <CardTitle className="text-xl text-slate-950">Need help?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-5 py-5">
        <p className="text-sm leading-7 text-slate-600">
          If you need help with access, payment, or choosing the right next step,
          the support team can help.
        </p>

        {hasSupportContact ? (
          <a
            href={supportHref || undefined}
            target={supportHref ? "_blank" : undefined}
            rel={supportHref ? "noreferrer" : undefined}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-900 underline-offset-4 transition hover:text-slate-950 hover:underline"
          >
            <MessageCircleMore className="h-4 w-4" />
            {supportLabel}
          </a>
        ) : null}

        <Button asChild variant="outline" className="w-full">
          <AppPrefetchLink href={defaultBackHref}>
            Back to Summer Home
          </AppPrefetchLink>
        </Button>
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
  const isCourseUnlocked = report.courseAccess.isUnlocked;
  const courseActionHref = isCourseUnlocked
    ? SUMMER_CRASH_HOME_PATH
    : `${SUMMER_CRASH_HOME_PATH}#summer-unlock-lessons`;
  const courseActionLabel = isCourseUnlocked
    ? "Open Summer Course"
    : "Join Summer Course";
  const supportWhatsappHref = report.supportHref;
  const supportLabel = supportWhatsappHref
    ? "WhatsApp support"
    : report.supportContact;

  return (
    <div className="app-student-page-shell">
      <div className="space-y-5 md:space-y-6">
        <section className="space-y-4 md:space-y-5">
          <ReportHero
            report={report}
            defaultBackHref={defaultBackHref}
            courseActionHref={courseActionHref}
            courseActionLabel={courseActionLabel}
          />
          <SummarySnapshot report={report} />
        </section>

        {!isCourseUnlocked ? (
          <div id="summer-join-card" className="scroll-mt-24 lg:hidden">
            <JoinCard report={report} />
          </div>
        ) : null}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-6">
            <LearningSignalsSection report={report} />
            <StrengthsAndFocusSection report={report} />
            <NextStepsSection
              report={report}
              supportWhatsappHref={supportWhatsappHref}
              supportLabel={supportLabel}
            />
            <SummerCrashWhatsappSummaryCard
              summaryText={report.whatsappSummaryText}
            />
            <ReviewQuestionsSection report={report} />
          </div>

          <div className="space-y-5 lg:sticky lg:top-24">
            <div
              id={isCourseUnlocked ? "summer-join-card" : undefined}
              className={isCourseUnlocked ? "scroll-mt-24" : "hidden lg:block"}
            >
              <JoinCard report={report} />
            </div>

            <SupportCard
              defaultBackHref={defaultBackHref}
              supportHref={supportWhatsappHref}
              supportLabel={supportLabel}
              hasSupportContact={Boolean(report.supportContact)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
