"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { HOME_SCENES, type HomeSceneKey, type HomeStat } from "./home-content";

type HomeCinematicSceneProps = {
  sceneKey: HomeSceneKey;
  chapterIndex: number;
  chapterCount: number;
  chapterLabel: string;
  stats: HomeStat[];
  mode: "motion" | "static";
  compact?: boolean;
  fullscreen?: boolean;
};

type ScenePlacement = {
  className: string;
  x: number;
  y: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  scale: number;
  opacity: number;
  zIndex: number;
};

const panelPlacements: [ScenePlacement, ScenePlacement, ScenePlacement] = [
  {
    className: "left-[10%] top-[26%] w-[56%]",
    x: 0,
    y: 0,
    rotateX: 10,
    rotateY: -20,
    rotateZ: -5,
    scale: 1.03,
    opacity: 1,
    zIndex: 30,
  },
  {
    className: "right-[8%] top-[14%] w-[38%]",
    x: 0,
    y: -6,
    rotateX: 14,
    rotateY: 18,
    rotateZ: 7,
    scale: 0.92,
    opacity: 0.88,
    zIndex: 20,
  },
  {
    className: "left-[31%] bottom-[11%] w-[42%]",
    x: 0,
    y: 16,
    rotateX: 8,
    rotateY: -6,
    rotateZ: 6,
    scale: 0.88,
    opacity: 0.72,
    zIndex: 10,
  },
];

const compactPlacements: [ScenePlacement, ScenePlacement, ScenePlacement] = [
  {
    className: "left-[8%] top-[30%] w-[72%]",
    x: 0,
    y: 0,
    rotateX: 8,
    rotateY: -14,
    rotateZ: -4,
    scale: 1,
    opacity: 1,
    zIndex: 30,
  },
  {
    className: "right-[4%] top-[16%] w-[48%]",
    x: 0,
    y: -2,
    rotateX: 10,
    rotateY: 16,
    rotateZ: 6,
    scale: 0.84,
    opacity: 0.82,
    zIndex: 20,
  },
  {
    className: "left-[34%] bottom-[10%] w-[52%]",
    x: 0,
    y: 10,
    rotateX: 6,
    rotateY: -4,
    rotateZ: 5,
    scale: 0.78,
    opacity: 0.64,
    zIndex: 10,
  },
];

const stagePlacements: [ScenePlacement, ScenePlacement, ScenePlacement] = [
  {
    className: "left-[44%] top-[54%] w-[min(42rem,42vw)]",
    x: -72,
    y: -22,
    rotateX: 17,
    rotateY: -29,
    rotateZ: -10,
    scale: 1.1,
    opacity: 1,
    zIndex: 40,
  },
  {
    className: "right-[8%] top-[18%] w-[min(27rem,28vw)]",
    x: 10,
    y: -10,
    rotateX: 18,
    rotateY: 22,
    rotateZ: 9,
    scale: 0.93,
    opacity: 0.9,
    zIndex: 30,
  },
  {
    className: "left-[17%] bottom-[11%] w-[min(28rem,30vw)]",
    x: 34,
    y: 18,
    rotateX: 12,
    rotateY: -15,
    rotateZ: 8,
    scale: 0.88,
    opacity: 0.78,
    zIndex: 20,
  },
];

const chipPositionsDesktop = [
  "left-5 top-7",
  "right-8 top-20",
  "left-12 bottom-20",
];

const chipPositionsCompact = [
  "left-4 top-4",
  "right-4 top-16",
  "left-5 bottom-14",
];

const chipPositionsStage = [
  "left-[9%] top-[20%]",
  "left-[58%] top-[16%]",
  "left-[15%] bottom-[18%]",
];

const sceneWorldPresets: Record<
  HomeSceneKey,
  { x: number; y: number; rotateZ: number; scale: number }
> = {
  hero: { x: 0, y: 0, rotateZ: 0, scale: 1 },
  signal: { x: 18, y: -6, rotateZ: -1.4, scale: 1.01 },
  patterns: { x: 26, y: -10, rotateZ: 1.6, scale: 1.02 },
  intervention: { x: 10, y: 8, rotateZ: -0.8, scale: 1.01 },
  school: { x: -14, y: 4, rotateZ: -1.1, scale: 1.02 },
  class: { x: -24, y: -4, rotateZ: 1.3, scale: 1.03 },
  student: { x: -8, y: 10, rotateZ: -1.8, scale: 1.01 },
};

const toneStyles = {
  teal: {
    badge:
      "border-teal-300/20 bg-teal-300/10 text-teal-100 shadow-[0_18px_36px_-30px_rgba(45,212,191,0.8)]",
    bar: "bg-gradient-to-r from-teal-300 via-cyan-300 to-emerald-300",
    dot: "#5eead4",
  },
  cyan: {
    badge:
      "border-sky-300/20 bg-sky-300/10 text-sky-100 shadow-[0_18px_36px_-30px_rgba(56,189,248,0.72)]",
    bar: "bg-gradient-to-r from-sky-300 via-cyan-300 to-blue-300",
    dot: "#7dd3fc",
  },
  amber: {
    badge:
      "border-amber-200/20 bg-amber-200/10 text-amber-100 shadow-[0_18px_36px_-30px_rgba(251,191,36,0.72)]",
    bar: "bg-gradient-to-r from-amber-200 via-yellow-200 to-orange-200",
    dot: "#fcd34d",
  },
  emerald: {
    badge:
      "border-emerald-300/20 bg-emerald-300/10 text-emerald-100 shadow-[0_18px_36px_-30px_rgba(52,211,153,0.72)]",
    bar: "bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300",
    dot: "#6ee7b7",
  },
  ink: {
    badge:
      "border-white/10 bg-white/[0.06] text-white/[0.72] shadow-[0_18px_36px_-30px_rgba(15,23,42,0.64)]",
    bar: "bg-gradient-to-r from-slate-300 via-slate-200 to-slate-100",
    dot: "#e2e8f0",
  },
} as const;

export function HomeCinematicScene({
  sceneKey,
  chapterIndex,
  chapterCount,
  chapterLabel,
  stats,
  mode,
  compact = false,
  fullscreen = false,
}: HomeCinematicSceneProps) {
  const scene = HOME_SCENES[sceneKey];
  const placements = compact
    ? compactPlacements
    : fullscreen
      ? stagePlacements
      : panelPlacements;
  const chipPositions = compact
    ? chipPositionsCompact
    : fullscreen
      ? chipPositionsStage
      : chipPositionsDesktop;
  const motionEnabled = mode === "motion";
  const worldPreset = sceneWorldPresets[scene.id];

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-[#071117]",
        fullscreen
          ? "h-full w-full rounded-none border-none shadow-none"
          : "rounded-[2rem] border border-white/10 shadow-[0_40px_120px_-44px_rgba(0,0,0,0.72)]",
        compact ? "h-[22rem]" : !fullscreen ? "h-full min-h-[36rem]" : "",
      )}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${scene.id}-backdrop`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <Image
            src={scene.imageSrc}
            alt={scene.imageAlt}
            fill
            priority={scene.id === "hero"}
            sizes={
              fullscreen
                ? "100vw"
                : compact
                  ? "100vw"
                  : "(max-width: 1279px) 46vw, 40vw"
            }
            className={cn(
              "object-cover object-center scale-[1.04]",
              fullscreen ? "opacity-[0.22]" : "opacity-28",
            )}
          />
          <div
            className={cn(
              "absolute inset-0",
              fullscreen
                ? "bg-[linear-gradient(180deg,rgba(4,9,13,0.2)_0%,rgba(4,9,13,0.68)_42%,rgba(4,9,13,0.92)_100%)]"
                : "bg-[linear-gradient(180deg,rgba(4,9,13,0.12)_0%,rgba(4,9,13,0.72)_58%,rgba(4,9,13,0.94)_100%)]",
            )}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 18% 18%, ${scene.glowA} 0%, transparent 30%), radial-gradient(circle at 74% 66%, ${scene.glowB} 0%, transparent 36%)`,
            }}
          />
        </motion.div>
      </AnimatePresence>

      <div className="home-story-grid absolute inset-0 opacity-40" />
      <div className="home-story-noise absolute inset-0 opacity-[0.08]" />

      {fullscreen ? (
        <>
          <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(3,9,12,0.72),transparent)]" />
          <div className="absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(180deg,transparent,rgba(3,9,12,0.84))]" />
          <div className="absolute bottom-[-16%] left-1/2 h-[42%] w-[94%] -translate-x-1/2 rounded-[50%] border border-white/[0.08] bg-[radial-gradient(circle,rgba(94,234,212,0.12)_0%,rgba(7,17,23,0)_60%)] [transform:translateX(-50%)_perspective(1400px)_rotateX(74deg)]" />
          <motion.div
            className="absolute left-[58%] top-[18%] h-[46%] w-px bg-[linear-gradient(180deg,rgba(148,247,223,0)_0%,rgba(148,247,223,0.38)_30%,rgba(137,204,255,0.18)_72%,rgba(148,247,223,0)_100%)]"
            animate={
              motionEnabled
                ? {
                    opacity: [0.18, 0.38, 0.18],
                    scaleY: [0.98, 1.05, 0.98],
                  }
                : undefined
            }
            transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      ) : null}

      <motion.div
        className={cn(
          "absolute rounded-full blur-3xl",
          fullscreen
            ? "-left-10 top-16 h-72 w-72"
            : "-left-16 top-6 h-56 w-56",
        )}
        style={{ background: scene.glowA }}
        animate={
          motionEnabled
            ? {
                opacity: [0.26, 0.52, 0.26],
                scale: [1, 1.08, 1],
                x: [0, 10, 0],
                y: [0, -8, 0],
              }
            : undefined
        }
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={cn(
          "absolute rounded-full blur-3xl",
          fullscreen
            ? "-right-8 bottom-10 h-72 w-72"
            : "-right-12 bottom-6 h-52 w-52",
        )}
        style={{ background: scene.glowB }}
        animate={
          motionEnabled
            ? {
                opacity: [0.16, 0.34, 0.16],
                scale: [1, 1.06, 1],
                x: [0, -10, 0],
                y: [0, 8, 0],
              }
            : undefined
        }
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex h-full flex-col">
        <div
          className={cn(
            "flex items-start justify-between gap-4 border-b border-white/10",
            fullscreen
              ? "px-6 pb-5 pt-[5.4rem] sm:px-8 lg:px-10"
              : compact
                ? "px-4 pb-3 pt-4"
                : "px-6 pb-5 pt-5",
          )}
        >
          <div className="min-w-0">
            <Badge className="border-white/10 bg-white/[0.08] text-white/[0.84] backdrop-blur-sm">
              {scene.badge}
            </Badge>
            <p
              className={cn(
                "mt-3 max-w-lg text-white/[0.68]",
                fullscreen
                  ? "max-w-xl text-sm leading-6 sm:text-[15px]"
                  : compact
                    ? "text-xs leading-5"
                    : "text-[13px] leading-5",
              )}
            >
              {scene.headline}
            </p>
          </div>

          {!compact && stats.length > 0 ? (
            <div
              className={cn(
                "hidden gap-2 md:grid",
                fullscreen ? "min-w-[14rem]" : "min-w-[12rem]",
              )}
            >
              {stats.slice(0, fullscreen ? 3 : 2).map((stat) => (
                <div
                  key={`scene-stat-${stat.key}`}
                  className="rounded-[1.15rem] border border-white/10 bg-white/[0.06] px-3 py-2 backdrop-blur-md"
                >
                  <div className="text-sm font-semibold tracking-[-0.03em] text-white">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/[0.45]">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "relative flex-1 overflow-hidden",
            fullscreen ? "px-6 pb-6 pt-3 sm:px-8 lg:px-10" : "px-4 pb-4 pt-3 sm:px-5",
          )}
        >
          {!compact ? (
            <div
              className={cn(
                "absolute hidden md:block",
                fullscreen
                  ? "left-[8%] top-[24%] max-w-[18rem]"
                  : "left-5 top-4 max-w-[15rem]",
              )}
            >
              <p className="text-[11px] uppercase tracking-[0.26em] text-white/[0.36]">
                Scene note
              </p>
              <p className="mt-2 text-[13px] leading-6 text-white/[0.56]">
                {scene.supporting}
              </p>
            </div>
          ) : null}

          <div
            className={cn(
              "absolute inset-0",
              fullscreen ? "[perspective:2400px]" : "[perspective:1700px]",
            )}
          >
            <motion.div
              className={cn(
                "absolute left-1/2 top-1/2 rounded-full border border-white/10",
                fullscreen
                  ? "h-64 w-64 -translate-x-1/2 -translate-y-1/2"
                  : "h-48 w-48 -translate-x-1/2 -translate-y-1/2",
              )}
              animate={
                motionEnabled
                  ? {
                      scale: [1, 1.08, 1],
                      opacity: [0.14, 0.26, 0.14],
                    }
                  : undefined
              }
              transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className={cn(
                "absolute left-1/2 top-1/2 rounded-full border border-white/[0.06]",
                fullscreen
                  ? "h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2"
                  : "h-72 w-72 -translate-x-1/2 -translate-y-1/2",
              )}
              animate={
                motionEnabled
                  ? {
                      rotate: [0, 360],
                      opacity: [0.12, 0.22, 0.12],
                    }
                  : undefined
              }
              transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={scene.id}
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{
                  opacity: 1,
                  scale: worldPreset.scale,
                  x: worldPreset.x,
                  y: worldPreset.y,
                  rotateZ: worldPreset.rotateZ,
                }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                className="absolute inset-0"
                style={{ transformStyle: "preserve-3d" }}
              >
                {scene.chips.map((chip, index) => (
                  <motion.div
                    key={`${scene.id}-${chip}`}
                    className={cn(
                      "absolute rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/[0.74] backdrop-blur-lg",
                      chipPositions[index],
                    )}
                    animate={
                      motionEnabled
                        ? {
                            y: [0, index % 2 === 0 ? -10 : 8, 0],
                            x: [0, index === 1 ? -4 : 4, 0],
                          }
                        : undefined
                    }
                    transition={{
                      duration: 5 + index,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    {chip}
                  </motion.div>
                ))}

                {scene.cards.map((card, index) => {
                  const placement = placements[index];
                  const tone = toneStyles[card.tone];

                  return (
                    <motion.div
                      key={`${scene.id}-${card.level}-${card.title}`}
                      className={cn(
                        "home-depth-card absolute overflow-hidden",
                        fullscreen ? "p-5 sm:p-6" : "p-4 sm:p-5",
                        placement.className,
                        compact ? "rounded-[1.4rem]" : "rounded-[1.75rem]",
                      )}
                      initial={
                        motionEnabled
                          ? {
                              opacity: 0,
                              scale: 0.84,
                              x: placement.x * 0.4,
                              y: placement.y * 0.35,
                            }
                          : false
                      }
                      animate={{
                        opacity: placement.opacity,
                        scale: placement.scale,
                        x: placement.x,
                        y: placement.y,
                        rotateX: placement.rotateX,
                        rotateY: placement.rotateY,
                        rotateZ: placement.rotateZ,
                      }}
                      transition={{
                        duration: motionEnabled ? 0.65 : 0,
                        ease: "easeOut",
                        delay: motionEnabled ? index * 0.06 : 0,
                      }}
                      style={{
                        zIndex: placement.zIndex,
                        transformStyle: "preserve-3d",
                      }}
                    >
                      <div className="absolute inset-x-0 top-0 h-px bg-white/[0.18]" />
                      <div className="absolute -right-10 top-0 h-20 w-20 rounded-full bg-white/[0.05] blur-2xl" />

                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]",
                              tone.badge,
                            )}
                          >
                            {card.level}
                          </span>
                          <h3
                            className={cn(
                              "mt-3 font-semibold tracking-[-0.03em] text-white",
                              fullscreen ? "text-lg sm:text-[1.35rem]" : "text-base sm:text-lg",
                            )}
                          >
                            {card.title}
                          </h3>
                        </div>
                        <span
                          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: tone.dot }}
                        />
                      </div>

                      <p
                        className={cn(
                          "mt-2 leading-5 text-white/[0.62]",
                          fullscreen ? "text-[13px] sm:text-sm" : "text-xs sm:text-[13px]",
                        )}
                      >
                        {card.footer}
                      </p>

                      <div className={cn("space-y-3", fullscreen ? "mt-5" : "mt-4")}>
                        {card.rows.map((row) => (
                          <div key={`${card.level}-${row.label}`}>
                            <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/50">
                              <span>{row.label}</span>
                              <span>{row.value}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/10">
                              <motion.div
                                className={cn("h-full rounded-full", tone.bar)}
                                initial={motionEnabled ? { width: 0 } : false}
                                animate={{ width: `${row.value}%` }}
                                transition={{
                                  duration: motionEnabled ? 0.78 + index * 0.08 : 0,
                                  ease: "easeOut",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div
          className={cn(
            "relative flex items-center justify-between gap-4 border-t border-white/10 text-[11px] uppercase tracking-[0.24em] text-white/[0.42]",
            fullscreen ? "px-6 py-5 sm:px-8 lg:px-10" : "px-5 py-4 sm:px-6",
          )}
        >
          <div className="flex items-center gap-3">
            <span>{String(chapterIndex + 1).padStart(2, "0")}</span>
            <span className="h-px w-10 bg-white/10" />
            <span className="hidden sm:inline">{chapterLabel}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: chapterCount }).map((_, index) => (
              <span
                key={`scene-progress-${index}`}
                className={cn(
                  "h-1.5 w-6 rounded-full bg-white/10 transition-all duration-300",
                  index === chapterIndex && "w-10 bg-white/[0.52]",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomeCinematicScene;
