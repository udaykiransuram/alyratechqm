"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

import HomeCtaCluster from "./HomeCtaCluster";
import {
  HOME_PLATFORM_ITEMS,
  HOME_STORY_CHAPTERS,
  type HomeChapter,
  type HomeSceneKey,
  type HomeStat,
} from "./home-content";

type HomeChapterPanelsProps = {
  activeChapterId: HomeSceneKey;
  stats: HomeStat[];
  whatsappHref?: string;
  testPrice?: number;
  className?: string;
};

function ChapterRail({
  activeChapterId,
  compact = false,
  className,
}: {
  activeChapterId: HomeSceneKey;
  compact?: boolean;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "mb-8 grid gap-2 sm:max-w-[30rem]",
        compact && "grid-cols-2 gap-3 sm:max-w-[36rem]",
        className,
      )}
    >
      {HOME_STORY_CHAPTERS.map((chapter, index) => {
        const active = chapter.id === activeChapterId;

        return (
          <a
            key={chapter.id}
            href={`#${chapter.anchor}`}
            className={cn(
              "home-story-rail-item",
              compact && "min-h-[3.35rem] gap-3 px-4 py-3",
              active && "home-story-rail-item-active",
            )}
          >
            <span className={cn("home-story-rail-index", compact && "h-10 w-10 text-[0.68rem]")}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="home-story-rail-copy">
              <span className={cn("home-story-rail-kicker", compact && "text-[0.58rem]")}>
                {chapter.chapterLabel}
              </span>
              <span className={cn("home-story-rail-label", compact && "text-[0.88rem]")}>
                {chapter.navLabel}
              </span>
            </span>
          </a>
        );
      })}
    </nav>
  );
}

function MetricChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="home-story-chip">
      <p className="home-story-chip-label">{label}</p>
      <p className="home-story-chip-value">{value}</p>
    </div>
  );
}

function HighlightLine({
  item,
  index,
  soft = false,
}: {
  item: string;
  index: number;
  soft?: boolean;
}) {
  return (
    <div
      className={cn(
        "home-story-highlight",
        soft && "home-story-highlight-soft",
      )}
    >
      <span className="home-story-highlight-step">
        {String(index + 1).padStart(2, "0")}
      </span>
      <p className="text-sm leading-7 text-[hsl(var(--home-text-muted))]">
        {item}
      </p>
    </div>
  );
}

function HeroSignalBoard({
  chapter,
  stats,
}: {
  chapter: HomeChapter;
  stats: HomeStat[];
}) {
  const heroStats = stats.slice(0, 4);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricChip label={chapter.metric.label} value={chapter.metric.value} />
        <MetricChip label={chapter.support.label} value={chapter.support.value} />
      </div>

      {heroStats.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {heroStats.map((stat) => (
            <div key={stat.key} className="home-story-stat">
              <p className="text-[1.65rem] font-semibold tracking-[-0.06em] text-[hsl(var(--home-text))]">
                {stat.value}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--home-text-muted))]">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function HeroOpeningPanel({
  activeChapter,
  stats,
  whatsappHref,
  testPrice,
}: {
  activeChapter: HomeChapter;
  stats: HomeStat[];
  whatsappHref?: string;
  testPrice?: number;
}) {
  return (
    <div className="relative z-10 flex min-h-0 items-center">
      <div className="home-story-scrollbox w-full max-w-[36rem] py-8 xl:max-w-[39rem] xl:py-10">
        <ChapterRail activeChapterId={activeChapter.id} compact className="mb-6" />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeChapter.id}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -22 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
            <div className="space-y-4">
              <div className="home-story-kicker">{activeChapter.eyebrow}</div>

              <div className="space-y-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--home-text-muted))]">
                  {activeChapter.chapterLabel} / {activeChapter.navLabel}
                </p>
                <h1 className="home-flagship-display max-w-[12ch] text-[clamp(2.72rem,4.45vw,4.8rem)] leading-[0.95] text-[hsl(var(--home-text))]">
                  {activeChapter.title}
                </h1>
                <p className="max-w-[30rem] text-[0.95rem] leading-[1.8] text-[hsl(var(--home-text-muted))] xl:text-[0.98rem]">
                  {activeChapter.body}
                </p>
              </div>
            </div>

            <HomeCtaCluster
              whatsappHref={whatsappHref}
              testPrice={testPrice}
              tone="dark"
              className="max-w-[34rem]"
            />

            <div className="grid gap-3">
              {activeChapter.highlights.map((item, index) => (
                <HighlightLine
                  key={item}
                  item={item}
                  index={index}
                  soft
                />
              ))}
            </div>

            <HeroSignalBoard chapter={activeChapter} stats={stats} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function HomeChapterPanels({
  activeChapterId,
  stats,
  whatsappHref,
  testPrice,
  className,
}: HomeChapterPanelsProps) {
  const activeChapter =
    HOME_STORY_CHAPTERS.find((chapter) => chapter.id === activeChapterId) ||
    HOME_STORY_CHAPTERS[0];
  const activeIndex = Math.max(
    0,
    HOME_STORY_CHAPTERS.findIndex((chapter) => chapter.id === activeChapter.id),
  );

  if (activeChapter.id === "hero") {
    return (
      <HeroOpeningPanel
        activeChapter={activeChapter}
        stats={stats}
        whatsappHref={whatsappHref}
        testPrice={testPrice}
      />
    );
  }

  return (
    <div className={cn("relative z-10 flex min-h-0 items-center", className)}>
      <div className="home-story-scrollbox w-full max-w-[42rem] py-12">
        <ChapterRail activeChapterId={activeChapter.id} />

        <div className="home-story-panel relative overflow-hidden rounded-[2.5rem] px-6 py-7 sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute right-5 top-2 text-[6.5rem] font-semibold tracking-[-0.08em] text-white/[0.05] sm:text-[7.5rem]">
            {String(activeIndex + 1).padStart(2, "0")}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeChapter.id}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -22 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 space-y-7"
            >
              <div className="space-y-5">
                <div className="home-story-kicker">{activeChapter.eyebrow}</div>

                <div className="space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[hsl(var(--home-text-muted))]">
                    {activeChapter.chapterLabel} / {activeChapter.navLabel}
                  </p>
                  <h2 className="home-flagship-display max-w-[14ch] text-[clamp(2.7rem,4vw,4.35rem)] leading-[0.98] text-[hsl(var(--home-text))]">
                    {activeChapter.title}
                  </h2>
                  <p className="max-w-[38rem] text-base leading-8 text-[hsl(var(--home-text-muted))] sm:text-[1.05rem]">
                    {activeChapter.body}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <MetricChip
                  label={activeChapter.metric.label}
                  value={activeChapter.metric.value}
                />
                <MetricChip
                  label={activeChapter.support.label}
                  value={activeChapter.support.value}
                />
              </div>

              <div className="grid gap-3">
                {activeChapter.highlights.map((item, index) => (
                  <HighlightLine key={item} item={item} index={index} />
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {activeChapter.beats.map((beat) => (
                  <div
                    key={`${activeChapter.id}-${beat.title}`}
                    className="home-story-beat"
                  >
                    <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--home-border)/0.72)] bg-[hsl(var(--home-surface-strong)/0.56)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--home-text-muted))]">
                      <span>{beat.label}</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold tracking-[-0.03em] text-[hsl(var(--home-text))]">
                      {beat.title}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-[hsl(var(--home-text-muted))]">
                      {beat.body}
                    </p>
                  </div>
                ))}
              </div>

              {activeChapter.id === "platform" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {HOME_PLATFORM_ITEMS.slice(0, 4).map((item) => {
                    const Icon = item.icon;

                    return (
                      <div key={item.title} className="home-story-beat">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[hsl(var(--home-border)/0.72)] bg-[linear-gradient(180deg,hsl(var(--home-accent-strong)/0.18)_0%,hsl(var(--home-surface)/0.52)_100%)] text-[hsl(var(--home-text))]">
                            <Icon className="h-5 w-5" />
                          </div>
                          <h3 className="text-sm font-semibold tracking-[-0.02em] text-[hsl(var(--home-text))]">
                            {item.title}
                          </h3>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-[hsl(var(--home-text-muted))]">
                          {item.body}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
