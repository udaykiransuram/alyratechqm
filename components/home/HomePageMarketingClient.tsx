"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  MessageCircleMore,
  Quote,
  ShieldCheck,
  Star,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClientRuntimeSignals } from "@/lib/client/runtime-signals";
import { cn } from "@/lib/utils";

import { HomeFallbackMedia } from "./HomeFallbackMedia";
import {
  HOME_DEFAULT_FAQS,
  HOME_DEFAULT_TESTIMONIALS,
  HOME_FOUNDER_NOTE,
  HOME_PLATFORM_ITEMS,
  HOME_PROOF_POINTS,
  HOME_STORY_CHAPTERS,
  HOME_TRUST_STRIP,
  type HomeFaq,
  type HomeSceneKey,
  type HomeStat,
  type HomeTestimonial,
} from "./home-content";

type HomePageMarketingClientProps = {
  stats: HomeStat[];
  testimonials: HomeTestimonial[];
  faqs: HomeFaq[];
  testPrice?: number;
  whatsappHref?: string;
};

function formatPrice(price?: number) {
  if (typeof price !== "number") {
    return null;
  }

  return new Intl.NumberFormat("en-IN").format(price);
}

function clampRating(rating: number) {
  if (!Number.isFinite(rating)) {
    return 5;
  }

  return Math.max(1, Math.min(5, Math.round(rating)));
}

function clampUnit(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function HeroActions({
  whatsappHref,
}: {
  whatsappHref?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Button
        asChild
        size="hero"
        className="rounded-full border-0 px-7 text-[hsl(var(--home-bg-0))] shadow-[0_30px_68px_-34px_hsl(var(--home-shadow)/0.9)] hover:-translate-y-0.5"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--home-glow-cyan)) 0%, hsl(var(--home-glow-teal)) 100%)",
        }}
      >
        <Link href="/contact">
          Book a Demo
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>

      <Button
        asChild
        size="hero"
        variant="outline"
        className="rounded-full border-[hsl(var(--home-border)/0.84)] bg-[hsl(var(--home-surface)/0.28)] px-7 text-[hsl(var(--home-text))] backdrop-blur-xl hover:-translate-y-0.5 hover:bg-[hsl(var(--home-surface)/0.46)]"
      >
        <Link href="/talent-test">
          Start Baseline Test
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>

      {whatsappHref ? (
        <Button
          asChild
          size="hero"
          variant="outline"
          className="rounded-full border-[hsl(var(--home-accent-gold)/0.28)] bg-[linear-gradient(135deg,hsl(var(--home-accent-gold)/0.14)_0%,hsl(var(--home-surface)/0.18)_100%)] px-7 text-[hsl(var(--home-text))] backdrop-blur-xl hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,hsl(var(--home-accent-gold)/0.2)_0%,hsl(var(--home-surface)/0.24)_100%)]"
        >
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <MessageCircleMore className="h-4 w-4" />
            WhatsApp
          </a>
        </Button>
      ) : null}
    </div>
  );
}

function HomeStatsRail({
  stats,
}: {
  stats: HomeStat[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={`hero-stat-${stat.key}`}
          className="home-marketing-stat-card px-4 py-5 text-[hsl(var(--home-text))]"
        >
          <p className="text-[2rem] font-semibold tracking-[-0.06em]">
            {stat.value}
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--home-text-muted))]">
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function StageScene({
  chapterId,
  className,
  interactive = false,
  glassFade = 0,
}: {
  chapterId: HomeSceneKey;
  className?: string;
  interactive?: boolean;
  glassFade?: number;
}) {
  const chapter =
    HOME_STORY_CHAPTERS.find((item) => item.id === chapterId) ||
    HOME_STORY_CHAPTERS[0];
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const shellFade = clampUnit(glassFade);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x, y });
  };

  const resetTilt = () => {
    if (!interactive) {
      return;
    }

    setTilt({ x: 0, y: 0 });
  };

  const stageTransform = interactive
    ? `perspective(1800px) rotateX(${(-tilt.y * 6).toFixed(2)}deg) rotateY(${(
        tilt.x * 8
      ).toFixed(2)}deg) scale3d(1.015,1.015,1.015)`
    : undefined;
  const shellStyle: CSSProperties = {
    border: `1px solid hsl(var(--home-border) / ${0.16 - shellFade * 0.14})`,
    background: `linear-gradient(180deg, hsl(var(--home-surface) / ${
      0.56 - shellFade * 0.54
    }) 0%, hsl(var(--home-surface-strong) / ${0.78 - shellFade * 0.75}) 100%)`,
    boxShadow: `0 48px 120px -72px hsl(var(--home-shadow) / ${
      0.76 - shellFade * 0.7
    })`,
    backdropFilter: `blur(${16 - shellFade * 15}px)`,
    WebkitBackdropFilter: `blur(${16 - shellFade * 15}px)`,
  };
  const badgeStyle: CSSProperties = {
    borderColor: `hsl(0 0% 100% / ${0.09 - shellFade * 0.07})`,
    backgroundColor: `hsl(0 0% 0% / ${0.16 - shellFade * 0.15})`,
    backdropFilter: `blur(${18 - shellFade * 16}px)`,
    WebkitBackdropFilter: `blur(${18 - shellFade * 16}px)`,
  };
  const infoCardStyle: CSSProperties = {
    borderColor: `hsl(0 0% 100% / ${0.09 - shellFade * 0.07})`,
    backgroundColor: `hsl(0 0% 0% / ${0.18 - shellFade * 0.17})`,
    backdropFilter: `blur(${18 - shellFade * 16}px)`,
    WebkitBackdropFilter: `blur(${18 - shellFade * 16}px)`,
  };

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[2.4rem] bg-[linear-gradient(180deg,hsl(var(--home-surface)/0.64)_0%,hsl(var(--home-surface-strong)/0.88)_100%)] shadow-[0_48px_120px_-72px_hsl(var(--home-shadow)/0.88)]",
        className,
      )}
      style={shellStyle}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
    >
      <div
        className="home-cinematic-grid absolute inset-0"
        style={{ opacity: 0.18 - shellFade * 0.17 }}
      />
      <div
        className="home-cinematic-noise absolute inset-0"
        style={{ opacity: 0.28 - shellFade * 0.26 }}
      />
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out will-change-transform"
        style={stageTransform ? { transform: stageTransform } : undefined}
      >
        <HomeFallbackMedia
          chapterId={chapter.id}
          stage
          minimal
          className="h-full min-h-0 w-full"
        />
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--home-bg-0)/0.04)_0%,transparent_28%,transparent_72%,hsl(var(--home-shadow)/0.26)_100%)]"
        style={{ opacity: 0.92 - shellFade * 0.86 }}
      />
      <div className="pointer-events-none absolute inset-x-6 top-6 z-10 flex flex-wrap items-center gap-2">
        <span
          className="inline-flex min-h-8 items-center rounded-full border px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/76"
          style={badgeStyle}
        >
          {chapter.chapterLabel}
        </span>
        <span
          className="inline-flex min-h-8 items-center rounded-full border px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/54"
          style={badgeStyle}
        >
          {chapter.sceneLabel}
        </span>
      </div>
      <div
        className="pointer-events-none absolute inset-x-6 bottom-6 z-10 max-w-[24rem] rounded-[1.4rem] border px-4 py-4"
        style={infoCardStyle}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/46">
          Scene focus
        </p>
        <p className="mt-2 text-sm leading-7 text-white/72">
          {chapter.sceneSummary}
        </p>
      </div>
    </div>
  );
}

function HeroSection({
  stats,
  priceLabel,
  whatsappHref,
  allowInteractiveStage,
}: {
  stats: HomeStat[];
  priceLabel: string | null;
  whatsappHref?: string;
  allowInteractiveStage: boolean;
}) {
  const heroRef = useRef<HTMLElement | null>(null);
  const heroChapter = HOME_STORY_CHAPTERS[0];
  const heroTrustItems = [
    { label: "Signal", body: HOME_TRUST_STRIP[0] },
    { label: "Drill-down", body: HOME_TRUST_STRIP[1] },
    { label: "Workflow", body: HOME_TRUST_STRIP[2] },
  ];
  const [glassFade, setGlassFade] = useState(0);

  useEffect(() => {
    let frame = 0;

    const updateGlassFade = () => {
      frame = 0;

      const heroElement = heroRef.current;
      if (!heroElement) {
        return;
      }

      const rect = heroElement.getBoundingClientRect();
      const fadeDistance = Math.max(window.innerHeight * 0.55, rect.height * 0.42);
      const nextGlassFade = clampUnit(-rect.top / fadeDistance);

      setGlassFade((current) =>
        Math.abs(current - nextGlassFade) < 0.01 ? current : nextGlassFade,
      );
    };

    const requestUpdate = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(updateGlassFade);
    };

    updateGlassFade();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  return (
    <section
      ref={heroRef}
      className="home-cinematic-stage relative isolate min-h-[100svh] overflow-hidden text-white"
    >
      <div className="home-hero-canvas-container absolute inset-0 z-0">
        <div className="home-cinematic-grid absolute inset-0 opacity-24" />
        <div className="home-cinematic-noise absolute inset-0 opacity-48" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_16%,hsl(var(--home-glow-cyan)/0.18)_0%,transparent_24rem),radial-gradient(circle_at_84%_14%,hsl(var(--home-glow-teal)/0.2)_0%,transparent_30rem),radial-gradient(circle_at_58%_78%,hsl(var(--home-accent-gold)/0.12)_0%,transparent_22rem)]" />
        <div className="absolute inset-y-0 right-0 left-[40%] hidden lg:block">
          <StageScene
            chapterId="hero"
            interactive={allowInteractiveStage}
            glassFade={glassFade}
            className="h-full rounded-none bg-transparent shadow-none"
          />
        </div>
      </div>

      <div className="home-hero-ui-overlay pointer-events-none relative z-10 min-h-[100svh]">
        <div className="mx-auto flex min-h-[100svh] max-w-[96rem] flex-col justify-center px-4 pb-16 pt-[calc(var(--app-header-height)+3.5rem)] sm:px-6 lg:px-8">
          <div className="pointer-events-auto max-w-[40rem]">
            <Badge className="home-marketing-kicker border-[hsl(var(--home-accent-strong)/0.18)] bg-[linear-gradient(135deg,hsl(var(--home-accent-strong)/0.16)_0%,hsl(var(--home-accent)/0.14)_100%)] px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/86">
              Diagnostic intelligence for schools
            </Badge>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/54">
              <span>{heroChapter.metric.label}</span>
              <span className="h-1 w-1 rounded-full bg-[hsl(var(--home-glow-cyan))]" />
              <span>{heroChapter.sceneLabel}</span>
            </div>

            <h1 className="home-display-title mt-6 max-w-[11ch] text-[clamp(3.2rem,8vw,7rem)] leading-[0.9] tracking-[-0.08em] text-white">
              Reveal learning gaps before performance slips.
            </h1>

            <p className="mt-6 max-w-[37rem] text-base leading-8 text-white/72 sm:text-lg">
              Alyra turns paper tests and OMR capture into a clear
              school-to-student diagnostic signal, so principals, academic
              heads, and teachers can review risk earlier and act with
              confidence.
              {priceLabel
                ? ` Baseline assessments start from Rs. ${priceLabel}.`
                : ""}
            </p>

            <div className="mt-8">
              <HeroActions whatsappHref={whatsappHref} />
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {heroTrustItems.map((item) => (
                <div
                  key={item.label}
                  className="home-marketing-dark-card px-4 py-4"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/46">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-white/72">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pointer-events-auto mt-10 lg:hidden">
            <StageScene chapterId="hero" glassFade={glassFade} className="min-h-[24rem]" />
          </div>

          <div className="pointer-events-auto mt-10">
            <HomeStatsRail stats={stats} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StorySection() {
  const chapters = HOME_STORY_CHAPTERS.filter(
    (chapter) => chapter.id === "patterns" || chapter.id === "drilldown",
  );

  return (
    <section
      id="story"
      className="relative overflow-hidden bg-[linear-gradient(180deg,hsl(var(--home-bg-0))_0%,hsl(var(--public-bg))_24%,hsl(var(--public-surface))_100%)] py-24 scroll-mt-28 sm:py-28"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,hsl(var(--home-glow-cyan)/0.12)_0%,transparent_22rem),radial-gradient(circle_at_82%_10%,hsl(var(--home-accent-gold)/0.1)_0%,transparent_24rem)]" />
      <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <Badge className="home-marketing-kicker home-marketing-kicker-light px-4 py-1.5 text-[11px] uppercase tracking-[0.18em]">
            From signal to action
          </Badge>
          <h2 className="home-display-title mt-6 text-[clamp(2.6rem,4.6vw,4.8rem)] leading-[0.94] tracking-[-0.06em] text-white">
            Move from hidden academic pressure to a precise next move.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/68 sm:text-lg">
            Alyra helps teams move through the same sequence they follow in a
            real review meeting: find the pressure point, isolate the concept,
            and land on the class or learner who needs support next.
          </p>
        </div>

        <div className="mt-16 space-y-24">
          {chapters.map((chapter, index) => (
            <article
              key={chapter.id}
              className="grid gap-10 lg:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)] lg:items-center"
            >
              <div className={cn(index % 2 === 1 ? "lg:order-2" : "")}>
                <StageScene chapterId={chapter.id} className="min-h-[26rem] lg:min-h-[38rem]" />
              </div>

              <div className={cn("space-y-6", index % 2 === 1 ? "lg:order-1" : "")}>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex rounded-full border border-[hsl(var(--public-border)/0.76)] bg-[hsl(var(--public-surface)/0.9)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--public-ink-soft))]">
                      {chapter.chapterLabel}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--public-muted))]">
                      {chapter.navLabel}
                    </span>
                  </div>

                  <h3 className="home-display-title text-[clamp(2.3rem,4vw,4rem)] leading-[0.96] tracking-[-0.05em] text-[hsl(var(--public-ink))]">
                    {chapter.title}
                  </h3>

                  <p className="text-base leading-8 text-[hsl(var(--public-ink-soft))] sm:text-lg">
                    {chapter.body}
                  </p>
                </div>

                <div className="grid gap-3">
                  {chapter.highlights.map((highlight) => (
                    <div
                      key={`${chapter.id}-${highlight}`}
                      className="home-marketing-light-card px-4 py-4 text-sm leading-7 text-[hsl(var(--public-ink-soft))]"
                    >
                      {highlight}
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="home-marketing-light-card home-marketing-light-card-accent px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--public-muted))]">
                      {chapter.metric.label}
                    </p>
                    <p className="mt-3 text-base font-semibold tracking-[-0.03em] text-[hsl(var(--public-ink))]">
                      {chapter.metric.value}
                    </p>
                  </div>
                  <div className="home-marketing-light-card home-marketing-light-card-warm px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--public-muted))]">
                      {chapter.support.label}
                    </p>
                    <p className="mt-3 text-base font-semibold tracking-[-0.03em] text-[hsl(var(--public-ink))]">
                      {chapter.support.value}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlatformSection() {
  const platformChapter =
    HOME_STORY_CHAPTERS.find((chapter) => chapter.id === "platform") ||
    HOME_STORY_CHAPTERS[HOME_STORY_CHAPTERS.length - 1];

  return (
    <section
      id="platform"
      className="relative py-24 text-white scroll-mt-28 sm:py-28"
    >
      <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2.8rem] bg-[linear-gradient(180deg,hsl(var(--home-bg-0))_0%,hsl(var(--home-bg-1))_38%,hsl(var(--home-bg-2))_100%)] px-6 py-8 shadow-[0_56px_140px_-72px_hsl(var(--home-shadow)/0.84)] sm:px-8 lg:px-10 lg:py-10">
          <div className="home-cinematic-grid absolute inset-0 opacity-24" />
          <div className="home-cinematic-noise absolute inset-0 opacity-40" />
          <div className="absolute inset-y-0 right-0 left-[48%] hidden xl:block">
            <StageScene chapterId="platform" className="h-full rounded-none bg-transparent shadow-none" />
          </div>

          <div className="relative z-10 max-w-[42rem]">
            <Badge className="home-marketing-kicker border-white/12 bg-white/6 px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/82">
              Connected platform
            </Badge>
            <h2 className="home-display-title mt-6 text-[clamp(2.5rem,4vw,4.4rem)] leading-[0.95] tracking-[-0.06em] text-white">
              {platformChapter.title}
            </h2>
            <p className="mt-5 text-base leading-8 text-white/70 sm:text-lg">
              {platformChapter.body}
            </p>
          </div>

          <div className="relative z-10 mt-10 grid gap-4 md:grid-cols-2 xl:max-w-[42rem]">
            {HOME_PLATFORM_ITEMS.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="home-marketing-dark-card px-4 py-5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/10 bg-black/12 text-[hsl(var(--home-glow-cyan))]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-white/66">
                    {item.body}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="relative z-10 mt-10 xl:hidden">
            <StageScene chapterId="platform" className="min-h-[28rem]" />
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
    <div className="home-proof-panel h-full p-6 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <Quote className="h-8 w-8 text-[hsl(var(--public-accent))]" />
        <div className="flex items-center gap-1 text-amber-500">
          {Array.from({ length: rating }).map((_, index) => (
            <Star
              key={`${testimonial.author}-${index}`}
              className="h-4 w-4 fill-current"
            />
          ))}
        </div>
      </div>

      <p className="mt-6 text-base leading-8 text-[hsl(var(--public-ink-soft))]">
        &quot;{testimonial.quote}&quot;
      </p>

      <div className="mt-6 flex items-center gap-3 border-t border-[hsl(var(--public-border)/0.72)] pt-5">
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
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(var(--public-accent)_/_0.14)] text-sm font-semibold text-[hsl(var(--public-ink))]">
            {testimonial.author.charAt(0)}
          </div>
        )}

        <div>
          <p className="font-semibold text-[hsl(var(--public-ink))]">
            {testimonial.author}
          </p>
          <p className="text-sm text-[hsl(var(--public-muted))]">
            {testimonial.role}
          </p>
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
  const proofTestimonials = testimonials.length
    ? testimonials
    : HOME_DEFAULT_TESTIMONIALS;
  const proofFaqs = faqs.length ? faqs : HOME_DEFAULT_FAQS;

  return (
    <section
      id="proof"
      aria-labelledby="homepage-proof"
      className="public-proof-section relative overflow-hidden py-24 text-[hsl(var(--public-ink))] scroll-mt-28 sm:py-28"
    >
      <div className="relative mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <Badge className="home-marketing-kicker home-marketing-kicker-light px-4 py-1.5 text-[11px] uppercase tracking-[0.18em]">
            Evidence and trust
          </Badge>
          <h2
            id="homepage-proof"
            className="home-display-title mt-6 text-[clamp(2.4rem,4vw,4rem)] leading-[0.96] tracking-[-0.06em] text-[hsl(var(--public-ink))]"
          >
            Give school teams proof they can trust after the first impression.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[hsl(var(--public-ink-soft))] sm:text-lg">
            What matters next is clarity: real reach, credible academic
            positioning, and a direct route into a walkthrough for your team.
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
              className="home-proof-panel px-5 py-6 text-center sm:px-6"
            >
              <div className="text-3xl font-semibold tracking-[-0.05em] text-[hsl(var(--public-ink))] sm:text-4xl">
                {stat.value}
              </div>
              <div className="mt-3 text-[11px] uppercase tracking-[0.24em] text-[hsl(var(--public-muted))]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="home-proof-panel p-6 sm:p-7 md:p-8">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[hsl(var(--public-muted))]">
              Why teams trust it
            </p>
            <h3 className="home-display-title mt-5 text-[2rem] leading-[0.98] tracking-[-0.05em] text-[hsl(var(--public-ink))] sm:text-[2.4rem]">
              “{HOME_FOUNDER_NOTE.quote}”
            </h3>
            <div className="mt-6 flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--public-brand-start)) 0%, hsl(var(--public-brand-end)) 100%)",
                  boxShadow:
                    "0 24px 44px -28px hsl(var(--public-shadow) / 0.45)",
                }}
              >
                AT
              </div>
              <div>
                <p className="font-semibold text-[hsl(var(--public-ink))]">
                  {HOME_FOUNDER_NOTE.author}
                </p>
                <p className="text-sm text-[hsl(var(--public-muted))]">
                  {HOME_FOUNDER_NOTE.role}
                </p>
              </div>
            </div>

            <div className="mt-7 space-y-3">
              {HOME_PROOF_POINTS.map((item) => (
                <div
                  key={item.title}
                  className="home-marketing-light-card flex items-start gap-3 px-4 py-4 text-sm leading-7 text-[hsl(var(--public-ink-soft))]"
                >
                  <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[hsl(var(--public-accent))]" />
                  <span>{item.body}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="home-proof-panel p-4 sm:p-6 md:p-8">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[hsl(var(--public-muted))]">
              FAQ
            </p>
            <Accordion type="single" collapsible className="mt-4">
              {proofFaqs.map((faq, index) => (
                <AccordionItem
                  key={`${faq.question}-${index}`}
                  value={`faq-${index}`}
                  className="border-[hsl(var(--public-border)/0.8)]"
                >
                  <AccordionTrigger className="py-5 text-left text-base font-semibold text-[hsl(var(--public-ink))] hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-base leading-7 text-[hsl(var(--public-ink-soft))]">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        <div className="mt-16">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.26em] text-[hsl(var(--public-muted))]">
                School voices
              </p>
              <h3 className="home-display-title mt-2 text-[1.9rem] leading-[0.98] tracking-[-0.04em] text-[hsl(var(--public-ink))] sm:text-[2.45rem]">
                Trusted by teams that need sharper academic decisions.
              </h3>
            </div>
            <p className="max-w-lg text-sm leading-7 text-[hsl(var(--public-muted))]">
              These are the schools and academic teams that value clearer
              review conversations, faster reteach planning, and stronger
              follow-through after assessment.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {proofTestimonials.map((testimonial) => (
              <TestimonialCard
                key={`${testimonial.author}-${testimonial.quote.slice(0, 28)}`}
                testimonial={testimonial}
              />
            ))}
          </div>
        </div>

        <div className="home-final-band mt-16 overflow-hidden rounded-[var(--public-panel-radius)] p-6 sm:p-8 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-2xl">
              <Badge className="home-marketing-kicker border-white/12 bg-white/[0.08] text-white/[0.84]">
                See Alyra in action
              </Badge>
              <h3 className="home-display-title mt-6 text-[2rem] leading-[0.98] tracking-[-0.05em] text-white sm:text-[2.8rem]">
                Bring calm, evidence-led review into your next assessment cycle.
              </h3>
              <p className="mt-4 text-base leading-8 text-white/[0.72] sm:text-lg">
                Walk through the school-to-student flow with your own academic
                team, then move into baseline testing when you are ready.
                {priceLabel
                  ? ` Baseline assessments start from Rs. ${priceLabel}.`
                  : ""}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
              <Button
                asChild
                size="hero"
                className="rounded-full px-7 text-white shadow-[0_24px_50px_-24px_hsl(var(--public-shadow)/0.44)] hover:-translate-y-0.5"
                style={{
                  borderColor: "hsl(var(--public-accent-strong) / 0.26)",
                  background:
                    "linear-gradient(135deg, hsl(var(--public-accent-strong)) 0%, hsl(var(--public-accent)) 100%)",
                }}
              >
                <Link href="/contact">
                  Book a Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button
                asChild
                size="hero"
                className="rounded-full border px-7 text-white shadow-none hover:-translate-y-0.5"
                style={{
                  borderColor: "hsl(var(--public-border) / 0.16)",
                  background:
                    "linear-gradient(180deg, hsl(var(--public-surface) / 0.12) 0%, hsl(var(--public-surface) / 0.08) 100%)",
                }}
              >
                <Link href="/talent-test">
                  Start Baseline Test
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>

              {whatsappHref ? (
                <Button
                  asChild
                  size="hero"
                  className="rounded-full border px-7 text-white shadow-none hover:-translate-y-0.5"
                  style={{
                    borderColor: "hsl(var(--public-success) / 0.26)",
                    background:
                      "linear-gradient(135deg, hsl(var(--public-success) / 0.16) 0%, hsl(var(--public-surface) / 0.08) 100%)",
                  }}
                >
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircleMore className="h-4 w-4" />
                    WhatsApp
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePageMarketingClient({
  stats,
  testimonials,
  faqs,
  testPrice,
  whatsappHref,
}: HomePageMarketingClientProps) {
  const runtimeSignals = useClientRuntimeSignals();
  const heroStats = stats.slice(0, 4);
  const proofStats = stats.slice(0, 4);
  const priceLabel = formatPrice(testPrice);
  const allowInteractiveStage =
    !runtimeSignals.prefersReducedMotion &&
    !runtimeSignals.saveData &&
    !(runtimeSignals.lowBandwidth && runtimeSignals.lowPower) &&
    !runtimeSignals.compactViewport;

  return (
    <div className="home-cinematic-page relative -mt-20 overflow-clip text-[hsl(var(--public-ink))]">
      <HeroSection
        stats={heroStats}
        priceLabel={priceLabel}
        whatsappHref={whatsappHref}
        allowInteractiveStage={allowInteractiveStage}
      />
      <StorySection />
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
