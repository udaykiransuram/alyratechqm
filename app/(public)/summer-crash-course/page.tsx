import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MessageCircleMore } from "lucide-react";
import {
  AcademicCapIcon,
  BoltIcon,
  ChartBarIcon,
  ChatBubbleBottomCenterTextIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  DevicePhoneMobileIcon,
} from "@heroicons/react/24/outline";

import { InnerHero } from "@/components/InnerHero";
import { LottieAnimation } from "@/components/LottieAnimation";
import { PublicFinalCta } from "@/components/public/PublicFinalCta";
import { PublicSectionIntro } from "@/components/public/PublicSectionIntro";
import SummerCrashSessionRedirect from "@/components/summer-crash/SummerCrashSessionRedirect";
import { getSummerCrashPublicConfig } from "@/lib/server/summer-crash";
import {
  SUMMER_CRASH_HELP_PATH,
  SUMMER_CRASH_REGISTER_PATH,
  SUMMER_CRASH_SIGNIN_PATH,
} from "@/lib/summer-crash/constants";
import { formatSummerCrashPrice } from "@/lib/summer-crash/shared";

export const metadata: Metadata = {
  title: "Summer Crash Course",
  description:
    "A parent-friendly Summer Crash Course page with a free diagnostic, structured foundation repair, and a guided maths recovery path.",
};

const summerSupportPillars = [
  {
    title: "Find the real gap first",
    copy:
      "The diagnostic shows the exact foundation that is weak, not just a low score.",
    icon: AcademicCapIcon,
  },
  {
    title: "Repair it in live classes",
    copy:
      "Teachers slow down the missed step, rebuild the idea, and check understanding before moving on.",
    icon: BoltIcon,
  },
  {
    title: "Practice in small daily steps",
    copy:
      "Short practice blocks make revision easier to continue at home without overwhelming the child.",
    icon: ClockIcon,
  },
  {
    title: "Clear parent next steps",
    copy:
      "Parents see the weak areas, stronger areas, and the next thing worth practicing.",
    icon: ChatBubbleBottomCenterTextIcon,
  },
] as const;

const familyJourneySteps = [
  {
    step: "01",
    title: "Register once",
    copy:
      "Use one parent phone number and create one password for all future summer sign-ins.",
  },
  {
    step: "02",
    title: "Take the free diagnostic",
    copy:
      "The test matches the selected class band and highlights the weak foundations first.",
  },
  {
    step: "03",
    title: "Start the support path",
    copy:
      "Move into the parent report, summer home, and guided lesson path without the regular school portal.",
  },
] as const;

const summerProgramHighlights = [
  {
    title: "Live class updates",
    copy:
      "Parents can quickly see what was taught and where the child still needs help.",
    icon: DevicePhoneMobileIcon,
  },
  {
    title: "Weak-area summary",
    copy:
      "The same weak topics stay visible, so support remains focused on the right basics.",
    icon: ChartBarIcon,
  },
  {
    title: "Practice for home",
    copy:
      "Parents get smaller follow-up questions for the same weak areas instead of broad revision.",
    icon: ChatBubbleLeftRightIcon,
  },
  {
    title: "Confidence Builder",
    copy:
      "A clearer recovery path helps confidence return faster and keeps children more willing to try again.",
    icon: BoltIcon,
    emphasis: "accent",
  },
] as const;

const summerSupportCardTreatments = [
  {
    borderColor: "hsl(0 0% 100% / 0.72)",
    backgroundImage:
      "linear-gradient(180deg, hsl(0 0% 100% / 0.97) 0%, hsl(190 30% 97% / 0.98) 100%)",
    chipBackground:
      "linear-gradient(180deg, hsl(0 0% 100% / 0.98) 0%, hsl(190 42% 95% / 0.98) 100%)",
  },
  {
    borderColor: "hsl(176 44% 92% / 0.92)",
    backgroundImage:
      "linear-gradient(180deg, hsl(180 55% 97% / 0.98) 0%, hsl(165 56% 94% / 0.98) 100%)",
    chipBackground:
      "linear-gradient(180deg, hsl(0 0% 100% / 0.98) 0%, hsl(170 64% 92% / 0.98) 100%)",
  },
  {
    borderColor: "hsl(203 52% 91% / 0.94)",
    backgroundImage:
      "linear-gradient(180deg, hsl(203 100% 98% / 0.98) 0%, hsl(197 76% 94% / 0.98) 100%)",
    chipBackground:
      "linear-gradient(180deg, hsl(0 0% 100% / 0.98) 0%, hsl(198 88% 92% / 0.98) 100%)",
  },
  {
    borderColor: "hsl(186 42% 92% / 0.94)",
    backgroundImage:
      "linear-gradient(180deg, hsl(48 100% 98% / 0.98) 0%, hsl(181 34% 95% / 0.98) 100%)",
    chipBackground:
      "linear-gradient(180deg, hsl(0 0% 100% / 0.98) 0%, hsl(47 84% 92% / 0.98) 100%)",
  },
] as const;

const summerExperienceCardStyle = {
  borderColor: "hsl(184 58% 62% / 0.22)",
  backgroundImage:
    "radial-gradient(circle at top right, hsl(183 78% 66% / 0.16) 0%, transparent 16rem), linear-gradient(135deg, hsl(186 74% 26%) 0%, hsl(198 56% 18%) 100%)",
} as const;

const summerExperienceVisualCardStyle = {
  borderColor: "hsl(184 64% 68% / 0.24)",
  backgroundImage:
    "radial-gradient(circle at 18% 18%, hsl(183 96% 72% / 0.18) 0%, transparent 14rem), radial-gradient(circle at 82% 16%, hsl(201 86% 72% / 0.16) 0%, transparent 16rem), linear-gradient(145deg, hsl(188 74% 24%) 0%, hsl(203 58% 18%) 100%)",
} as const;

const summerExperienceAccentCardStyle = {
  borderColor: "hsl(184 58% 62% / 0.24)",
  backgroundImage:
    "radial-gradient(circle at top right, hsl(183 86% 70% / 0.18) 0%, transparent 15rem), linear-gradient(135deg, hsl(181 81% 30%) 0%, hsl(196 60% 19%) 100%)",
} as const;

const summerIntroTitleClass =
  "max-w-[14ch] text-[clamp(2rem,4.1vw,2.9rem)] leading-[1.02] tracking-[-0.05em]";

const summerIntroDescriptionClass =
  "max-w-[39rem] text-[0.98rem] leading-7 text-[hsl(var(--public-muted))] md:text-[1.04rem] md:leading-8";

const summerMetricCardClass =
  "group relative overflow-hidden rounded-[1.9rem] border p-5 shadow-[0_30px_72px_-44px_rgba(8,47,73,0.22)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_38px_88px_-46px_rgba(8,47,73,0.28)] sm:p-6 md:min-h-[19.25rem] md:p-7";

const summerMetricValueClass =
  "mt-6 text-[2.1rem] font-semibold leading-none tracking-[-0.06em] md:text-[2.4rem]";

const summerMetricTitleClass =
  "mt-3 text-[1.08rem] font-semibold leading-snug tracking-[-0.03em] text-[hsl(var(--public-ink-strong))] md:text-[1.16rem]";

const summerMetricNoteClass =
  "mt-3 max-w-[24ch] text-[0.95rem] leading-7 text-[hsl(var(--public-ink-soft))]";

const summerMetricPillClass =
  "inline-flex items-center rounded-full border border-white/55 bg-white/55 px-3 py-1 text-[10px] font-semibold tracking-[0.01em] text-[hsl(var(--public-ink-strong))] shadow-[0_18px_30px_-28px_rgba(15,23,42,0.26)] backdrop-blur-sm";

const summerLightCardClass =
  "h-full rounded-[1.55rem] border p-6 shadow-[0_24px_54px_-42px_rgba(15,23,42,0.24)] backdrop-blur-sm md:p-7";

const summerLightCardTitleClass =
  "mt-4 text-[1.08rem] font-semibold tracking-[-0.03em] text-[hsl(var(--public-ink))] md:text-[1.16rem]";

const summerLightCardCopyClass =
  "mt-3 text-[0.95rem] leading-7 text-[hsl(var(--public-muted))]";

const summerDarkCardClass =
  "h-full rounded-[1.55rem] border p-6 shadow-[0_24px_54px_-42px_rgba(15,23,42,0.28)] backdrop-blur-sm md:p-8";

const summerDarkCardTitleClass =
  "mt-5 text-[1.08rem] font-semibold tracking-[-0.03em] text-white md:text-[1.16rem]";

const summerDarkCardCopyClass = "mt-3 text-[0.95rem] leading-7 text-white";

export default async function SummerCrashCourseLandingPage() {
  const config = await getSummerCrashPublicConfig();

  const hasPaidCourseAccess = Number(config.price) > 0;
  const priceLabel = formatSummerCrashPrice(config.price, config.currency);
  const diagnosticCtaLabel = "Register & Write Test";
  const registerCourseLabel = hasPaidCourseAccess
    ? "Register for Summer Course"
    : "Register Free";
  const accessNote = hasPaidCourseAccess
    ? `Free diagnostic first. Guided lessons unlock after payment (${priceLabel}).`
    : "The free diagnostic and the Summer lesson track are both open at no cost right now.";
  const supportWhatsappHref = String(config.supportHref || "").trim();
  const summerHeroMetricCards = [
    {
      eyebrow: "Observed scale",
      value: "2,000+",
      title: "Learning patterns reviewed",
      note: "The Summer plan is shaped around the weak places where maths foundations usually break first.",
      pills: ["Pattern-backed", "Clearer starting point"],
      icon: ChartBarIcon,
      cardStyle: {
        borderColor: "hsl(188 68% 78% / 0.62)",
        backgroundImage:
          "radial-gradient(circle at top right, hsl(187 84% 70% / 0.22) 0%, transparent 16rem), linear-gradient(180deg, hsl(0 0% 100% / 0.98) 0%, hsl(188 58% 96% / 0.98) 100%)",
      },
      iconStyle: {
        color: "hsl(186 74% 30%)",
        backgroundImage:
          "linear-gradient(180deg, hsl(0 0% 100% / 0.98) 0%, hsl(188 70% 92% / 0.98) 100%)",
      },
      eyebrowStyle: {
        borderColor: "hsl(188 68% 78% / 0.58)",
        background: "hsl(0 0% 100% / 0.78)",
        color: "hsl(188 52% 25%)",
      },
      valueClassName: "text-[hsl(188_52%_24%)]",
    },
    {
      eyebrow: "Coverage",
      value: "Class 5-10",
      title: "Class-matched support",
      note: "Each child is routed into the right diagnostic and lesson path for the selected class band.",
      pills: ["Class-based routing"],
      icon: AcademicCapIcon,
      cardStyle: {
        borderColor: "hsl(204 70% 82% / 0.62)",
        backgroundImage:
          "radial-gradient(circle at top right, hsl(203 88% 76% / 0.2) 0%, transparent 16rem), linear-gradient(180deg, hsl(0 0% 100% / 0.98) 0%, hsl(203 76% 96% / 0.98) 100%)",
      },
      iconStyle: {
        color: "hsl(206 62% 34%)",
        backgroundImage:
          "linear-gradient(180deg, hsl(0 0% 100% / 0.98) 0%, hsl(203 90% 92% / 0.98) 100%)",
      },
      eyebrowStyle: {
        borderColor: "hsl(204 70% 82% / 0.58)",
        background: "hsl(0 0% 100% / 0.78)",
        color: "hsl(206 48% 29%)",
      },
      valueClassName: "text-[hsl(206_50%_28%)]",
    },
    {
      eyebrow: hasPaidCourseAccess ? "Course unlock" : "Open access",
      value: hasPaidCourseAccess ? priceLabel : "Free",
      title: hasPaidCourseAccess ? "Free test + course access" : "Summer access",
      note: hasPaidCourseAccess
        ? "Parents can start with the diagnostic and unlock guided lessons later."
        : "Families can start the diagnostic and the course without a payment step right now.",
      pills: hasPaidCourseAccess
        ? ["Free diagnostic first", "Parent report included"]
        : ["Diagnostic open", "Lessons open"],
      icon: BoltIcon,
      cardStyle: {
        borderColor: "hsl(173 58% 78% / 0.62)",
        backgroundImage:
          "radial-gradient(circle at top right, hsl(168 82% 70% / 0.22) 0%, transparent 16rem), linear-gradient(180deg, hsl(0 0% 100% / 0.98) 0%, hsl(167 56% 95% / 0.98) 100%)",
      },
      iconStyle: {
        color: "hsl(169 68% 28%)",
        backgroundImage:
          "linear-gradient(180deg, hsl(0 0% 100% / 0.98) 0%, hsl(168 78% 91% / 0.98) 100%)",
      },
      eyebrowStyle: {
        borderColor: "hsl(173 58% 78% / 0.58)",
        background: "hsl(0 0% 100% / 0.78)",
        color: "hsl(168 52% 24%)",
      },
      valueClassName: "text-[hsl(168_52%_24%)]",
    },
  ] as const;

  return (
    <main className="public-page">
      <Suspense fallback={null}>
        <SummerCrashSessionRedirect />
      </Suspense>
      <InnerHero
        title={
          <>
            Repair weak maths foundations
            <span className="block text-[hsl(var(--public-accent))]">
              before the next term begins
            </span>
          </>
        }
        subtitle="A simple Summer maths recovery program that helps families find weak foundations, understand the next steps, and rebuild confidence before the next term."
        pillText="Summer Crash Course"
        variant="flagship"
        lottieLeft="/animations/teacher-classroom.lottie"
        whatsappHref={supportWhatsappHref || undefined}
      >
        <Link
          href={`${SUMMER_CRASH_REGISTER_PATH}?entry=diagnostic`}
          className="public-button-primary"
        >
          {diagnosticCtaLabel}
        </Link>
        <Link
          href={`${SUMMER_CRASH_REGISTER_PATH}?entry=direct_registration`}
          className="public-button-secondary"
        >
          {registerCourseLabel}
        </Link>
        <div className="basis-full flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2 text-sm">
          <Link href={SUMMER_CRASH_SIGNIN_PATH} className="public-text-link">
            Already registered? Sign in
          </Link>
          <Link href={SUMMER_CRASH_HELP_PATH} className="public-text-link">
            Need sign-in help?
          </Link>
        </div>
      </InnerHero>

      <section className="public-section pt-8 md:pt-12">
        <div className="public-shell">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 xl:gap-6">
            {summerHeroMetricCards.map((card) => {
              const Icon = card.icon;

              return (
                <article
                  key={card.title}
                  className={summerMetricCardClass}
                  style={card.cardStyle}
                >
                  <div className="pointer-events-none absolute inset-0 opacity-80">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                    <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/20 blur-2xl" />
                    <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-white/18 to-transparent" />
                  </div>

                  <div className="relative flex h-full flex-col items-start text-left">
                    <div className="flex w-full items-start justify-between gap-4">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl border shadow-[0_18px_34px_-28px_rgba(15,23,42,0.18)]"
                        style={{
                          borderColor: "hsl(0 0% 100% / 0.72)",
                          ...card.iconStyle,
                        }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span
                        className="inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                        style={card.eyebrowStyle}
                      >
                        {card.eyebrow}
                      </span>
                    </div>

                    <div className="mt-6 h-1.5 w-14 rounded-full bg-white/80 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.28)]" />
                    <div className={`${summerMetricValueClass} ${card.valueClassName}`}>
                      {card.value}
                    </div>
                    <h3 className={summerMetricTitleClass}>
                      {card.title}
                    </h3>
                    <div className={summerMetricNoteClass}>
                      {card.note}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {card.pills.map((pill) => (
                        <span key={pill} className={summerMetricPillClass}>
                          {pill}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="public-section pt-0">
        <div className="public-shell">
          <div className="space-y-8 md:space-y-10">
            <div className="grid gap-6 lg:grid-cols-[1.02fr,0.98fr] lg:items-start xl:gap-8">
              <PublicSectionIntro
                eyebrow="What Families Get"
                title="A Summer plan parents can understand quickly"
                description="Families start with a free diagnostic, see the real weak area, and move into guided support that feels calm, specific, and easier to follow."
                align="left"
                compact
                className="max-w-none"
                titleClassName={summerIntroTitleClass}
                descriptionClassName={summerIntroDescriptionClass}
              />

              <div
                className="h-full rounded-[1.75rem] border p-7 shadow-[0_30px_64px_-42px_rgba(15,23,42,0.34)] md:p-8"
                style={{
                  borderColor: "hsl(184 58% 62% / 0.24)",
                  backgroundImage:
                    "radial-gradient(circle at top right, hsl(183 78% 66% / 0.18) 0%, transparent 16rem), linear-gradient(135deg, hsl(186 74% 26%) 0%, hsl(198 56% 18%) 100%)",
                }}
              >
                <div className="max-w-[33rem] space-y-4 text-left">
                  <div className="public-eyebrow border-white/16 bg-white/10 text-white shadow-[0_18px_36px_-30px_rgba(15,23,42,0.44)]">
                    Parent-friendly
                  </div>
                  <h3 className="text-[1.85rem] font-semibold leading-[1.05] tracking-[-0.04em] text-white md:text-[2.05rem]">
                    Clear support for the child and less guesswork for the family
                  </h3>
                  <p className="text-[0.98rem] leading-7 text-white">
                    We combine live teaching, short practice, and simple next
                    steps so the child gets steady support without the usual
                    summer confusion.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-white/42 bg-gradient-to-b from-teal-300 via-teal-250 to-teal-200 p-6 shadow-[0_36px_76px_-48px_rgba(15,23,42,0.24)] md:p-8 lg:p-10">
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -right-16 top-0 h-56 w-56 rounded-full bg-white/22 blur-3xl" />
                <div className="absolute -left-14 bottom-0 h-48 w-48 rounded-full bg-teal-100/30 blur-3xl" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:64px_64px] opacity-25 [mask-image:radial-gradient(ellipse_78%_68%_at_50%_50%,#000_64%,transparent_100%)]" />
              </div>

              <div className="relative grid gap-8 lg:grid-cols-[1.08fr,0.92fr] lg:items-end xl:gap-10">
                <div className="grid gap-5 sm:grid-cols-2">
                  {summerSupportPillars.map((item, index) => {
                    const Icon = item.icon;
                    const treatment =
                      summerSupportCardTreatments[
                        index % summerSupportCardTreatments.length
                      ];

                    return (
                      <article
                        key={item.title}
                        className={summerLightCardClass}
                        style={{
                          borderColor: treatment.borderColor,
                          backgroundImage: treatment.backgroundImage,
                        }}
                      >
                        <div
                          className="public-icon-chip"
                          style={{
                            backgroundImage: treatment.chipBackground,
                          }}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <h3 className={summerLightCardTitleClass}>
                          {item.title}
                        </h3>
                        <p className={summerLightCardCopyClass}>
                          {item.copy}
                        </p>
                      </article>
                    );
                  })}
                </div>

                <div className="flex h-full items-center justify-center pt-2 lg:min-h-[31rem] lg:pt-4">
                  <LottieAnimation
                    src="/animations/exams-preparation.lottie"
                    respectLiteMode={false}
                    className="mx-auto h-[280px] w-full max-w-md drop-shadow-[0_28px_46px_rgba(15,23,42,0.12)] md:h-[360px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section pt-0">
        <div className="public-shell">
          <div className="grid gap-12 lg:grid-cols-[0.9fr,1.1fr] lg:items-center">
            <div className="public-panel flex items-center justify-center p-7 md:p-10">
              <LottieAnimation
                src="/animations/learning-books.lottie"
                respectLiteMode={false}
                className="h-[240px] w-full max-w-lg md:h-[310px]"
              />
            </div>

            <div className="space-y-8">
              <PublicSectionIntro
                eyebrow="How Families Start"
                title="A simple path from registration to recovery"
                description="No school picker, no confusing branches, and no extra setup before the child gets started."
                align="left"
                compact
                titleClassName={summerIntroTitleClass}
                descriptionClassName={summerIntroDescriptionClass}
              />

              <div className="grid gap-5 md:grid-cols-3">
                {familyJourneySteps.map((step) => (
                  <article key={step.step} className="public-card-soft h-full p-7 md:p-8">
                    <div className="text-[0.8rem] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--public-accent))]">
                      {step.step}
                    </div>
                    <h3 className="mt-4 text-[1.08rem] font-semibold tracking-[-0.03em] text-[hsl(var(--public-ink))] md:text-[1.16rem]">
                      {step.title}
                    </h3>
                    <p className={summerLightCardCopyClass}>
                      {step.copy}
                    </p>
                  </article>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`${SUMMER_CRASH_REGISTER_PATH}?entry=diagnostic`}
                  className="public-button-primary"
                >
                  {diagnosticCtaLabel}
                </Link>
                <Link
                  href={`${SUMMER_CRASH_REGISTER_PATH}?entry=direct_registration`}
                  className="public-button-secondary"
                >
                  {registerCourseLabel}
                </Link>
                <Link href={SUMMER_CRASH_HELP_PATH} className="public-text-link">
                  Need sign-in help?
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-shell">
          <div className="relative overflow-hidden rounded-[2.15rem] border border-teal-200/80 bg-gradient-to-br from-teal-100 via-cyan-50 to-white p-8 shadow-[0_38px_80px_-50px_rgba(15,23,42,0.2)] md:p-10 lg:p-12">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -right-20 top-0 h-64 w-64 rounded-full bg-teal-200/34 blur-3xl" />
              <div className="absolute -left-14 bottom-0 h-52 w-52 rounded-full bg-cyan-100/38 blur-3xl" />
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30 [mask-image:radial-gradient(ellipse_82%_70%_at_50%_48%,#000_62%,transparent_100%)]" />
            </div>

            <div className="relative space-y-8 xl:space-y-10">
              <article
                className="overflow-hidden rounded-[1.9rem] border p-6 shadow-[0_34px_74px_-48px_rgba(15,23,42,0.32)] md:p-8 xl:p-10"
                style={summerExperienceVisualCardStyle}
              >
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(18rem,0.96fr)] lg:items-center xl:gap-8">
                  <div className="max-w-none text-left">
                    <div className="mb-5 inline-flex items-center rounded-full border border-white/16 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white shadow-[0_18px_36px_-30px_rgba(15,23,42,0.44)]">
                      Summer Experience
                    </div>
                    <h2 className={`${summerIntroTitleClass} text-white`}>
                      Simple updates parents can actually use
                    </h2>
                    <p
                      className="mt-5 max-w-[39rem] text-[0.98rem] leading-7 md:text-[1.04rem] md:leading-8"
                      style={{ color: "hsl(0 0% 100% / 0.82)" }}
                    >
                      Parents see the weak areas, class progress, and the next
                      best practice step without a confusing dashboard.
                    </p>
                  </div>

                  <div className="flex min-h-[12.5rem] items-center justify-center p-2 md:p-4">
                    <LottieAnimation
                      src="/animations/rocket-success.lottie"
                      respectLiteMode={false}
                      className="mx-auto h-[170px] w-full max-w-sm drop-shadow-[0_28px_46px_rgba(15,23,42,0.22)] md:h-[210px]"
                    />
                  </div>
                </div>
              </article>

              <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {summerProgramHighlights.map((item) => {
                  const Icon = item.icon;
                  const cardStyle =
                    "emphasis" in item && item.emphasis === "accent"
                      ? summerExperienceAccentCardStyle
                      : summerExperienceCardStyle;

                  return (
                    <article
                      key={item.title}
                      className={summerDarkCardClass}
                      style={cardStyle}
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/16 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className={summerDarkCardTitleClass}>
                        {item.title}
                      </h3>
                      <p className={summerDarkCardCopyClass}>
                        {item.copy}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section pt-0">
        <div className="public-shell">
          <PublicFinalCta
            eyebrow="Start This Summer"
            title="Give your child a clearer plan before the next school term begins"
            description="Start with the free diagnostic, understand the weak areas clearly, and then move into guided support with more confidence."
            primaryAction={{
              href: `${SUMMER_CRASH_REGISTER_PATH}?entry=diagnostic`,
              label: diagnosticCtaLabel,
            }}
            secondaryAction={{
              href: `${SUMMER_CRASH_REGISTER_PATH}?entry=direct_registration`,
              label: registerCourseLabel,
            }}
            visual={
              <LottieAnimation
                src="/animations/success-graduation.lottie"
                respectLiteMode={false}
                className="h-[220px] w-full max-w-sm md:h-[260px]"
              />
            }
            supplemental={
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                {supportWhatsappHref ? (
                  <span className="inline-flex items-center gap-3">
                    <span>Need help before you start?</span>
                    <a
                      href={supportWhatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Message on WhatsApp"
                      title="Message on WhatsApp"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/18 bg-white/10 text-white transition-colors hover:bg-white/16"
                    >
                      <MessageCircleMore className="h-4 w-4" />
                    </a>
                  </span>
                ) : (
                  <span>Need help before you start?</span>
                )}
                <Link href={SUMMER_CRASH_SIGNIN_PATH} className="font-semibold text-white">
                  Already registered? Sign in
                </Link>
              </div>
            }
          />
        </div>
      </section>
    </main>
  );
}
