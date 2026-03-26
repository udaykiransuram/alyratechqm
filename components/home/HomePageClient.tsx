"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  ChevronRight,
  MessageCircleMore,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  HOME_CHAPTERS,
  HOME_PLATFORM_PILLARS,
  HOME_PLATFORM_RIBBON,
  type HomeChapter,
  type HomeFaq,
  type HomeStat,
  type HomeTestimonial,
} from "./home-content";
import { HomeCinematicScene } from "./HomeCinematicScene";

type HomePageClientProps = {
  stats: HomeStat[];
  testimonials: HomeTestimonial[];
  faqs: HomeFaq[];
  testPrice?: number;
  whatsappHref?: string;
};

type MaybeConnection = {
  saveData?: boolean;
};

type NavigatorWithPerformanceHints = Navigator & {
  connection?: MaybeConnection;
  mozConnection?: MaybeConnection;
  webkitConnection?: MaybeConnection;
  deviceMemory?: number;
};

const storyCardWidths = [
  "max-w-[44rem] mr-auto",
  "max-w-[32rem] ml-auto",
  "max-w-[33rem] mr-auto",
  "max-w-[32rem] ml-auto",
  "max-w-[34rem] mr-auto",
  "max-w-[32rem] ml-auto",
  "max-w-[33rem] mr-auto",
];

function formatPrice(price?: number) {
  if (typeof price !== "number") return null;
  return new Intl.NumberFormat("en-IN").format(price);
}

function clampRating(rating: number) {
  if (!Number.isFinite(rating)) return 5;
  return Math.max(1, Math.min(5, Math.round(rating)));
}

function HeroOverlay({
  chapter,
  stats,
  whatsappHref,
  priceLabel,
}: {
  chapter: HomeChapter;
  stats: HomeStat[];
  whatsappHref?: string;
  priceLabel: string | null;
}) {
  return (
    <div className="relative max-w-[44rem]">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-white/[0.42]">
        <span>01</span>
        <span className="h-px w-14 bg-white/10" />
        <span>{chapter.eyebrow}</span>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Badge className="border-white/10 bg-white/[0.08] text-white/[0.82] backdrop-blur-md">
          Hidden thinking patterns
        </Badge>
        <Badge className="border-teal-300/20 bg-teal-300/10 text-teal-100">
          Trust-first diagnostic story
        </Badge>
      </div>

      <h1 className="mt-8 max-w-[10.5ch] text-[clamp(4rem,9vw,7.4rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-white [text-wrap:balance]">
        We reveal the{" "}
        <span className="bg-[linear-gradient(135deg,#95f6df_0%,#dffbff_58%,#8bc8ff_100%)] bg-clip-text text-transparent">
          hidden thinking patterns
        </span>{" "}
        that marks usually hide.
      </h1>

      <p className="mt-6 max-w-[34rem] text-base leading-8 text-white/[0.74] sm:text-lg">
        {chapter.description}
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          asChild
          size="xl"
          className="h-12 rounded-full bg-white px-6 text-slate-950 shadow-[0_24px_50px_-24px_rgba(255,255,255,0.48)] hover:-translate-y-0.5 hover:bg-white"
        >
          <Link href="/contact">
            Book Demo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>

        <Button
          asChild
          size="xl"
          className="h-12 rounded-full border border-white/10 bg-white/[0.08] px-6 text-white shadow-none hover:-translate-y-0.5 hover:bg-white/[0.12]"
        >
          <Link href="/talent-test">
            Start Baseline Test
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>

        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-6 text-sm font-semibold text-emerald-100 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-emerald-300/[0.14]"
          >
            <MessageCircleMore className="h-4 w-4" />
            <span>WhatsApp Support</span>
          </a>
        ) : null}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={`hero-stat-${stat.key}`}
            className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] px-4 py-4 backdrop-blur-xl shadow-[0_26px_60px_-36px_rgba(0,0,0,0.44)]"
          >
            <div className="text-2xl font-semibold tracking-[-0.05em] text-white sm:text-3xl">
              {stat.value}
            </div>
            <div className="mt-2 text-[11px] uppercase tracking-[0.22em] text-white/[0.44]">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {chapter.bullets.map((bullet) => (
          <div
            key={bullet}
            className="flex items-start gap-3 rounded-[1.4rem] border border-white/10 bg-black/[0.22] px-4 py-4 text-sm leading-6 text-white/[0.72] backdrop-blur-xl"
          >
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-200" />
            <span>{bullet}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-white/[0.56]">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-teal-200" />
          Built for leadership reviews, teachers, and intervention teams
        </span>
        {priceLabel ? (
          <span className="inline-flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-200" />
            Baseline assessments start from ₹{priceLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StoryBeatCard({
  chapter,
  index,
}: {
  chapter: HomeChapter;
  index: number;
}) {
  return (
    <div className="home-story-beat-card relative overflow-hidden p-6 sm:p-7 md:p-8">
      <div className="absolute inset-x-0 top-0 h-px bg-white/[0.18]" />

      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/[0.4]">
            {chapter.eyebrow}
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-[2.6rem]">
            {chapter.title}
          </h2>
        </div>
        <div className="hidden text-right sm:block">
          <div className="text-[11px] uppercase tracking-[0.28em] text-white/[0.34]">
            Chapter
          </div>
          <div className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-white/[0.7]">
            {String(index + 1).padStart(2, "0")}
          </div>
        </div>
      </div>

      <p className="mt-5 text-base leading-8 text-white/[0.7] sm:text-lg">
        {chapter.description}
      </p>

      <div className="mt-7 space-y-3">
        {chapter.bullets.map((bullet) => (
          <div
            key={`${chapter.id}-${bullet}`}
            className="flex items-start gap-3 rounded-[1.2rem] border border-white/10 bg-black/[0.18] px-4 py-4 text-sm leading-6 text-white/[0.74]"
          >
            <span className="mt-1.5 h-2 w-2 rounded-full bg-teal-200" />
            <span>{bullet}</span>
          </div>
        ))}
      </div>

      <div className="mt-7 rounded-[1.4rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/[0.38]">
          {chapter.metricLabel}
        </p>
        <div className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
          {chapter.metricValue}
        </div>
        <p className="mt-3 text-sm leading-7 text-white/[0.62]">
          {chapter.metricNote}
        </p>
      </div>
    </div>
  );
}

function PlatformSection() {
  return (
    <section
      aria-labelledby="platform-heading"
      className="relative overflow-hidden border-t border-slate-200/70 bg-[linear-gradient(180deg,#eee6da_0%,#faf7f0_32%,#f2f6f4_100%)] py-24 text-slate-950"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.1),transparent_30rem),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.08),transparent_24rem)]" />

      <div className="relative mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <Badge
            variant="outline"
            className="border-slate-300 bg-white/80 px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] text-slate-700"
          >
            Platform chapter
          </Badge>
          <h2
            id="platform-heading"
            className="mt-6 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl lg:text-5xl"
          >
            A calmer operating system for diagnosis, action, and school rhythm.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg">
            The product lands better when it feels like one premium system
            instead of a pile of modules. This section reframes the platform as
            a connected operating layer.
          </p>
        </div>

        <div className="mt-14 grid gap-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <div className="home-proof-card overflow-hidden p-0">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="p-6 sm:p-8 md:p-10">
                <Badge className="border-slate-300 bg-slate-950 text-white">
                  Platform overview
                </Badge>

                <h3 className="mt-6 max-w-md text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-3xl">
                  Leadership signal, classroom action, and proof all stay in one
                  frame.
                </h3>
                <p className="mt-4 max-w-lg text-base leading-7 text-slate-700">
                  Diagnose learning patterns, coordinate teacher follow-through,
                  and keep operational modules visually aligned so the product
                  feels serious during real use.
                </p>

                <div className="mt-8 flex flex-wrap gap-2">
                  {HOME_PLATFORM_RIBBON.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.label}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.18)]"
                      >
                        <Icon className="h-3.5 w-3.5 text-teal-700" />
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative min-h-[22rem] overflow-hidden border-t border-slate-200/70 bg-[#0a1619] lg:min-h-[30rem] lg:border-l lg:border-t-0">
                <Image
                  src="/images/source-frontend/ttf-gemini-6cards.png"
                  alt="Alyra Tech platform preview"
                  fill
                  sizes="(max-width: 1280px) 100vw, 44vw"
                  className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,13,16,0.08)_0%,rgba(6,13,16,0.68)_62%,rgba(6,13,16,0.88)_100%)]" />
                <div className="absolute left-5 top-5 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/[0.82] backdrop-blur-xl">
                  Premium command view
                </div>
                <div className="absolute bottom-5 left-5 right-5 grid gap-3 sm:grid-cols-3">
                  {[
                    "Leadership-ready analytics",
                    "Teacher-ready interventions",
                    "Evidence that survives reviews",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-[1.15rem] border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white/80 backdrop-blur-xl"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5">
            {HOME_PLATFORM_PILLARS.map((pillar) => {
              const Icon = pillar.icon;

              return (
                <div key={pillar.title} className="home-platform-card p-6 sm:p-7">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-teal-200 bg-teal-50 text-teal-700 shadow-[0_18px_30px_-26px_rgba(13,148,136,0.32)]">
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        {pillar.eyebrow}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                        {pillar.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-slate-700">
                        {pillar.description}
                      </p>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {pillar.modules.map((module) => (
                          <span
                            key={`${pillar.title}-${module}`}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600"
                          >
                            {module}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({
  testimonial,
}: {
  testimonial: HomeTestimonial;
}) {
  const rating = clampRating(testimonial.rating);

  return (
    <div className="home-proof-card h-full p-6 sm:p-7">
      <div className="flex items-center justify-between">
        <Quote className="h-8 w-8 text-teal-700" />
        <div className="flex items-center gap-1 text-amber-500">
          {Array.from({ length: rating }).map((_, index) => (
            <Star
              key={`star-${testimonial.author}-${index}`}
              className="h-4 w-4 fill-current"
            />
          ))}
        </div>
      </div>

      <p className="mt-6 text-base leading-8 text-slate-800">
        &quot;{testimonial.quote}&quot;
      </p>

      <div className="mt-6 flex items-center gap-3 border-t border-slate-200/70 pt-5">
        {testimonial.image ? (
          <Image
            src={testimonial.image}
            alt={testimonial.author}
            width={44}
            height={44}
            unoptimized
            className="h-11 w-11 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
            {testimonial.author.charAt(0)}
          </div>
        )}

        <div>
          <p className="font-semibold text-slate-950">{testimonial.author}</p>
          <p className="text-sm text-slate-600">{testimonial.role}</p>
        </div>
      </div>
    </div>
  );
}

function ProofSection({
  stats,
  testimonials,
  faqs,
  testPrice,
  whatsappHref,
}: {
  stats: HomeStat[];
  testimonials: HomeTestimonial[];
  faqs: HomeFaq[];
  testPrice?: number;
  whatsappHref?: string;
}) {
  const priceLabel = formatPrice(testPrice);

  return (
    <section
      aria-labelledby="proof-heading"
      className="relative overflow-hidden border-t border-slate-200/70 bg-[linear-gradient(180deg,#edf3f1_0%,#f8fbfa_34%,#ffffff_100%)] py-24 text-slate-950"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.08),transparent_26rem),radial-gradient(circle_at_bottom_left,rgba(8,145,178,0.06),transparent_22rem)]" />

      <div className="relative mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <Badge
            variant="outline"
            className="border-slate-300 bg-white/80 px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] text-slate-700"
          >
            Proof chapter
          </Badge>
          <h2
            id="proof-heading"
            className="mt-6 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl lg:text-5xl"
          >
            Trusted when clarity, confidence, and follow-through matter.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg">
            The last section shifts into proof, voice, and conversion so the
            page ends on trust rather than visual fatigue.
          </p>
        </div>

        <div
          className={cn(
            "mt-10 grid gap-4",
            stats.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3",
          )}
        >
          {stats.map((stat) => (
            <div
              key={`proof-stat-${stat.key}`}
              className="home-proof-card px-5 py-6 text-center sm:px-6"
            >
              <div className="text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl">
                {stat.value}
              </div>
              <div className="mt-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {testimonials.length > 0 ? (
          <div className="mt-16">
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.26em] text-slate-500">
                  Real voices
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-3xl">
                  Proof that feels human, not decorative.
                </h3>
              </div>
              <p className="max-w-lg text-sm leading-7 text-slate-600">
                Testimonials keep the page credible without collapsing into a
                standard SaaS card wall.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <TestimonialCard
                  key={`${testimonial.author}-${testimonial.quote.slice(0, 24)}`}
                  testimonial={testimonial}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "mt-16 grid gap-6",
            faqs.length > 0 && "xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]",
          )}
        >
          <div className="home-proof-card p-6 sm:p-7 md:p-8">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
              What changed in this redesign
            </p>

            <div className="mt-6 space-y-5">
              {[
                "The first half now behaves like one full-screen guided story instead of a stack of similar panels.",
                "The scene is larger, more layered, and visibly more dimensional, so the page finally feels premium in motion.",
                "The visual hierarchy stays consistent from hero to CTA, which makes the product feel more intentional in actual use.",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.16)]"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                  <span className="text-sm leading-7 text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {faqs.length > 0 ? (
            <div className="home-proof-card p-4 sm:p-6 md:p-8">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                FAQ
              </p>
              <Accordion type="single" collapsible className="mt-4">
                {faqs.map((faq, index) => (
                  <AccordionItem
                    key={`${faq.question}-${index}`}
                    value={`faq-${index}`}
                    className="border-slate-200/80"
                  >
                    <AccordionTrigger className="py-5 text-left text-base font-semibold text-slate-950 hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 text-base leading-7 text-slate-700">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ) : null}
        </div>

        <div className="home-final-band mt-16 overflow-hidden rounded-[2rem] p-6 sm:p-8 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-2xl">
              <Badge className="border-white/[0.16] bg-white/10 text-white/[0.84]">
                Final conversion band
              </Badge>
              <h3 className="mt-6 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
                Book the walkthrough while the story is still fresh.
              </h3>
              <p className="mt-4 text-base leading-8 text-white/[0.72] sm:text-lg">
                See the school-to-student diagnostic flow on your priorities,
                then let teams start from baseline testing when they are ready.
                {priceLabel
                  ? ` Baseline assessments start from ₹${priceLabel} per assessment.`
                  : ""}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
              <Button
                asChild
                size="xl"
                className="h-12 rounded-full bg-white px-6 text-slate-950 shadow-[0_24px_50px_-24px_rgba(255,255,255,0.44)] hover:-translate-y-0.5 hover:bg-white"
              >
                <Link href="/contact">
                  Book Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button
                asChild
                size="xl"
                className="h-12 rounded-full border border-white/[0.16] bg-white/[0.08] px-6 text-white shadow-none hover:-translate-y-0.5 hover:bg-white/[0.12]"
              >
                <Link href="/talent-test">
                  Start Baseline Test
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>

              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-emerald-300/[0.16] bg-emerald-300/10 px-6 text-sm font-semibold text-emerald-100 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-emerald-300/[0.14]"
                >
                  <MessageCircleMore className="h-4 w-4" />
                  <span>WhatsApp</span>
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePageClient({
  stats,
  testimonials,
  faqs,
  testPrice,
  whatsappHref,
}: HomePageClientProps) {
  const reducedMotion = useReducedMotion();
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [sceneMode, setSceneMode] = useState<"motion" | "static">("static");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const navigation = navigator as NavigatorWithPerformanceHints;
    const connection =
      navigation.connection ||
      navigation.mozConnection ||
      navigation.webkitConnection;
    const desktopQuery = window.matchMedia("(min-width: 1024px)");

    const updateSceneMode = () => {
      const lowMemory =
        typeof navigation.deviceMemory === "number" &&
        navigation.deviceMemory <= 4;
      const shouldReduce =
        Boolean(reducedMotion) ||
        Boolean(connection?.saveData) ||
        lowMemory ||
        !desktopQuery.matches;

      setSceneMode(shouldReduce ? "static" : "motion");
    };

    updateSceneMode();
    desktopQuery.addEventListener?.("change", updateSceneMode);
    window.addEventListener("resize", updateSceneMode);

    return () => {
      desktopQuery.removeEventListener?.("change", updateSceneMode);
      window.removeEventListener("resize", updateSceneMode);
    };
  }, [reducedMotion]);

  useEffect(() => {
    const nodes = chapterRefs.current.filter(Boolean) as HTMLElement[];
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (!visible.length) return;
        const next = Number(
          (visible[0].target as HTMLElement).dataset.chapterIndex || 0,
        );

        setActiveIndex((current) => (current === next ? current : next));
      },
      {
        threshold: [0.2, 0.35, 0.5, 0.65],
        rootMargin: "-18% 0px -18% 0px",
      },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const priceLabel = formatPrice(testPrice);
  const heroStats = stats.slice(0, 3);
  const proofStats = stats.slice(0, 4);
  const activeChapter = HOME_CHAPTERS[activeIndex] ?? HOME_CHAPTERS[0];

  return (
    <div className="relative -mt-20 overflow-clip text-slate-950">
      <section className="relative isolate overflow-hidden bg-[#061116] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.16),transparent_24rem),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_26rem),linear-gradient(180deg,#061116_0%,#071219_42%,#081219_74%,#0a1418_100%)]" />
        <div className="home-story-noise absolute inset-0 opacity-[0.08]" />

        <div className="hidden lg:block">
          <div className="sticky top-0 h-[100svh]">
            <HomeCinematicScene
              sceneKey={activeChapter.sceneKey}
              chapterIndex={activeIndex}
              chapterCount={HOME_CHAPTERS.length}
              chapterLabel={activeChapter.shortLabel}
              stats={heroStats}
              mode={sceneMode}
              fullscreen
            />

            <div className="pointer-events-none absolute right-8 top-1/2 hidden -translate-y-1/2 xl:flex flex-col gap-3">
              {HOME_CHAPTERS.map((chapter, index) => (
                <div
                  key={`chapter-rail-${chapter.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-full border px-3 py-2 backdrop-blur-xl transition-all duration-300",
                    index === activeIndex
                      ? "border-white/[0.14] bg-white/[0.1] text-white"
                      : "border-white/[0.08] bg-black/[0.18] text-white/[0.48]",
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      index === activeIndex ? "bg-teal-200" : "bg-white/[0.24]",
                    )}
                  />
                  <span className="text-[10px] uppercase tracking-[0.22em]">
                    {chapter.shortLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 lg:-mt-[100svh]">
          {HOME_CHAPTERS.map((chapter, index) => (
            <article
              key={chapter.id}
              ref={(node) => {
                chapterRefs.current[index] = node;
              }}
              data-chapter-index={index}
              className={cn(
                "relative min-h-[112svh] lg:min-h-[118svh]",
                index === 0 && "min-h-[100svh] lg:min-h-[108svh]",
              )}
            >
              <div className="mx-auto flex min-h-[100svh] max-w-[92rem] items-center px-4 pb-12 pt-[calc(var(--app-header-height)+2.5rem)] sm:px-6 lg:px-8 lg:pb-16 lg:pt-[calc(var(--app-header-height)+4rem)]">
                <div className={cn("w-full", storyCardWidths[index])}>
                  <div className="mb-8 lg:hidden">
                    <HomeCinematicScene
                      sceneKey={chapter.sceneKey}
                      chapterIndex={index}
                      chapterCount={HOME_CHAPTERS.length}
                      chapterLabel={chapter.shortLabel}
                      stats={heroStats}
                      mode="static"
                      compact
                    />
                  </div>

                  {index === 0 ? (
                    <HeroOverlay
                      chapter={chapter}
                      stats={heroStats}
                      whatsappHref={whatsappHref}
                      priceLabel={priceLabel}
                    />
                  ) : (
                    <StoryBeatCard chapter={chapter} index={index} />
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <PlatformSection />

      <ProofSection
        stats={proofStats}
        testimonials={testimonials}
        faqs={faqs}
        testPrice={testPrice}
        whatsappHref={whatsappHref}
      />
    </div>
  );
}
