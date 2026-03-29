"use client";

import { cn } from "@/lib/utils";

import { HOME_STORY_CHAPTERS, type HomeSceneKey } from "./home-content";

type HomeFallbackMediaProps = {
  chapterId: HomeSceneKey;
  className?: string;
  compact?: boolean;
  minimal?: boolean;
  stage?: boolean;
};

type NodePoint = {
  x: number;
  y: number;
  tone: "cool" | "warm" | "alert";
};

const chapterGlowMap: Record<HomeSceneKey, string> = {
  hero:
    "from-[hsl(var(--home-accent-strong)/0.34)] via-[hsl(var(--home-accent)/0.24)] to-[hsl(var(--home-accent-warm)/0.1)]",
  patterns:
    "from-[hsl(var(--home-accent-warm)/0.22)] via-[hsl(var(--home-accent-strong)/0.14)] to-transparent",
  drilldown:
    "from-[hsl(var(--home-accent-warm)/0.24)] via-[hsl(var(--home-accent)/0.14)] to-transparent",
  platform:
    "from-[hsl(var(--home-accent-strong)/0.2)] via-[hsl(var(--home-accent-warm)/0.16)] to-transparent",
};

function PaperPowerScene() {
  const answerRows = [
    { top: "19%", glow: "cool" },
    { top: "34%", glow: "warm" },
    { top: "49%", glow: "cool" },
    { top: "64%", glow: "warm" },
  ] as const;

  const liftedSignals = [
    { left: "54%", top: "24%", tone: "cool", size: "h-4 w-4" },
    { left: "60%", top: "18%", tone: "warm", size: "h-5 w-5" },
    { left: "66%", top: "28%", tone: "cool", size: "h-3.5 w-3.5" },
    { left: "72%", top: "22%", tone: "warm", size: "h-4.5 w-4.5" },
    { left: "77%", top: "30%", tone: "cool", size: "h-3.5 w-3.5" },
    { left: "69%", top: "38%", tone: "cool", size: "h-3 w-3" },
  ] as const;

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-x-[14%] top-[10%] h-28 rounded-full bg-[radial-gradient(circle,hsl(var(--home-accent-strong)/0.3)_0%,transparent_72%)] blur-3xl" />
      <div className="absolute right-[10%] top-[14%] h-32 w-32 rounded-full bg-[radial-gradient(circle,hsl(var(--home-accent-warm)/0.18)_0%,transparent_72%)] blur-3xl" />
      <div className="absolute left-[12%] right-[10%] top-[60%] h-[8.5rem] rounded-[50%] border border-[hsl(var(--home-border)/0.34)] bg-[radial-gradient(circle_at_50%_46%,hsl(var(--home-accent-strong)/0.18)_0%,transparent_56%),linear-gradient(180deg,hsl(var(--home-surface)/0.18)_0%,hsl(var(--home-surface-strong)/0.5)_100%)] [transform:perspective(1200px)_rotateX(78deg)]" />
      <div className="absolute left-[14%] right-[12%] top-[63%] h-[6rem] opacity-75 [background-image:linear-gradient(rgba(120,238,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(120,238,255,0.16)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(circle_at_center,rgba(0,0,0,0.92),transparent_84%)] [transform:perspective(1200px)_rotateX(78deg)]" />

      <div className="home-paper-sheet absolute left-[19%] top-[18%] h-[58%] w-[37%] rounded-[2rem] border border-[rgba(161,235,255,0.38)] bg-[linear-gradient(180deg,rgba(247,251,255,0.98)_0%,rgba(234,246,255,0.92)_100%)] shadow-[0_42px_92px_-46px_rgba(6,18,36,0.88)]">
        <div className="absolute inset-[0.4rem] rounded-[1.6rem] border border-[rgba(39,94,126,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(237,247,255,0.94)_100%)]" />
        <div className="absolute left-[12%] top-[10%] h-3 w-[32%] rounded-full bg-[rgba(85,211,255,0.22)]" />
        <div className="absolute left-[12%] top-[15%] h-2.5 w-[18%] rounded-full bg-[rgba(255,191,120,0.2)]" />

        {answerRows.map((row, rowIndex) => (
          <div
            key={`row-${row.top}`}
            className="absolute left-[11%] right-[12%]"
            style={{ top: row.top }}
          >
            <div className="h-[2px] w-full rounded-full bg-[rgba(27,66,98,0.12)]" />
            <div className="mt-3 flex items-center gap-3">
              {Array.from({ length: 5 }).map((_, dotIndex) => {
                const filled =
                  (rowIndex + dotIndex) % 3 === 0 || (rowIndex === 1 && dotIndex === 3);

                return (
                  <span
                    key={`dot-${rowIndex}-${dotIndex}`}
                    className={cn(
                      "inline-flex h-4 w-4 rounded-full border",
                      filled
                        ? row.glow === "warm"
                          ? "border-[rgba(255,187,108,0.44)] bg-[radial-gradient(circle,rgba(255,198,126,0.96)_0%,rgba(255,198,126,0.22)_60%,transparent_76%)] shadow-[0_0_16px_rgba(255,196,118,0.34)]"
                          : "border-[rgba(102,239,255,0.42)] bg-[radial-gradient(circle,rgba(124,246,255,0.98)_0%,rgba(124,246,255,0.18)_60%,transparent_76%)] shadow-[0_0_16px_rgba(105,239,255,0.34)]"
                        : "border-[rgba(22,58,88,0.18)] bg-white/80",
                    )}
                  />
                );
              })}
            </div>
          </div>
        ))}

        <div className="home-paper-scan-beam absolute inset-x-[10%] top-[43%] h-8 rounded-full bg-[linear-gradient(90deg,transparent_0%,rgba(113,241,255,0.06)_16%,rgba(128,246,255,0.44)_46%,rgba(255,198,118,0.28)_62%,transparent_100%)] blur-sm" />
      </div>

      <div className="absolute left-[51%] top-[16%] h-[42%] w-[34%]">
        <div className="home-paper-link absolute left-[4%] top-[42%] h-[2px] w-[52%] bg-[linear-gradient(90deg,rgba(122,245,255,0)_0%,rgba(122,245,255,0.88)_54%,rgba(255,195,115,0.36)_100%)]" />

        {liftedSignals.map((signal, index) => (
          <span
            key={`${signal.left}-${signal.top}`}
            className={cn(
              "home-paper-signal absolute rounded-full",
              signal.size,
              nodeToneClass(signal.tone),
            )}
            style={{
              left: signal.left,
              top: signal.top,
              animationDelay: `${index * 0.35}s`,
            }}
          />
        ))}

        <div className="home-paper-graph-card absolute right-[2%] top-[10%] w-[56%] rounded-[1.3rem] border border-[hsl(var(--home-border)/0.58)] bg-[linear-gradient(180deg,hsl(var(--home-surface)/0.62)_0%,hsl(var(--home-surface-strong)/0.88)_100%)] px-3 py-3 shadow-[0_26px_62px_-42px_hsl(var(--home-shadow)/0.84)]">
          <div className="h-1.5 w-[58%] rounded-full bg-[linear-gradient(90deg,rgba(116,246,255,0.98)_0%,rgba(116,246,255,0.2)_100%)]" />
          <div className="mt-3 grid grid-cols-3 items-end gap-2">
            <div className="h-10 rounded-full bg-[linear-gradient(180deg,rgba(116,246,255,0.24)_0%,rgba(116,246,255,0.86)_100%)]" />
            <div className="h-14 rounded-full bg-[linear-gradient(180deg,rgba(255,195,115,0.24)_0%,rgba(255,195,115,0.94)_100%)]" />
            <div className="h-8 rounded-full bg-[linear-gradient(180deg,rgba(116,246,255,0.18)_0%,rgba(116,246,255,0.74)_100%)]" />
          </div>
        </div>

        <div className="home-paper-graph-card home-paper-graph-card-secondary absolute left-[18%] top-[54%] w-[46%] rounded-[1.1rem] border border-[hsl(var(--home-border)/0.52)] bg-[linear-gradient(180deg,hsl(var(--home-surface)/0.56)_0%,hsl(var(--home-surface-strong)/0.84)_100%)] px-3 py-3 shadow-[0_24px_54px_-40px_hsl(var(--home-shadow)/0.8)]">
          <div className="h-1.5 w-[48%] rounded-full bg-[linear-gradient(90deg,rgba(255,195,115,0.94)_0%,rgba(255,195,115,0.2)_100%)]" />
          <div className="mt-3 space-y-2">
            <div className="h-1 rounded-full bg-[rgba(255,255,255,0.18)]" />
            <div className="h-1 w-[72%] rounded-full bg-[rgba(255,255,255,0.14)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

const constellationNodes: NodePoint[] = [
  { x: 18, y: 34, tone: "cool" },
  { x: 30, y: 45, tone: "warm" },
  { x: 44, y: 38, tone: "warm" },
  { x: 57, y: 28, tone: "warm" },
  { x: 70, y: 43, tone: "alert" },
  { x: 48, y: 61, tone: "warm" },
  { x: 30, y: 66, tone: "cool" },
  { x: 68, y: 67, tone: "cool" },
  { x: 82, y: 36, tone: "cool" },
];

const constellationEdges = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [1, 6],
  [6, 5],
  [5, 7],
  [3, 8],
  [5, 3],
] as const;

const activePathEdges = [
  [1, 2],
  [2, 3],
  [3, 4],
  [6, 5],
  [5, 3],
] as const;

function lineStyle(from: NodePoint, to: NodePoint) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return {
    left: `${from.x}%`,
    top: `${from.y}%`,
    width: `${length}%`,
    transform: `translateY(-50%) rotate(${angle}deg)`,
    transformOrigin: "0 50%",
  } as const;
}

function nodeToneClass(tone: NodePoint["tone"]) {
  if (tone === "alert") {
    return "bg-[radial-gradient(circle,hsl(var(--home-accent-warm))_0%,#ff8e72_44%,transparent_72%)] shadow-[0_0_24px_rgba(255,160,120,0.45)]";
  }
  if (tone === "warm") {
    return "bg-[radial-gradient(circle,hsl(var(--home-accent-warm))_0%,rgba(255,205,130,0.44)_52%,transparent_74%)] shadow-[0_0_20px_rgba(247,192,116,0.38)]";
  }
  return "bg-[radial-gradient(circle,hsl(var(--home-accent-strong))_0%,rgba(101,230,255,0.46)_54%,transparent_74%)] shadow-[0_0_22px_rgba(96,224,255,0.4)]";
}

function TerrainScene({ chapterId }: { chapterId: HomeSceneKey }) {
  const focusValley = chapterId === "patterns";

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-x-[10%] top-[12%] h-40 rounded-full bg-[radial-gradient(circle,hsl(var(--home-accent-strong)/0.16)_0%,transparent_72%)] blur-3xl" />
      <div className="absolute left-[8%] right-[8%] top-[45%] h-[13rem] rounded-[50%] border border-[hsl(var(--home-border)/0.34)] bg-[radial-gradient(circle_at_50%_48%,hsl(var(--home-accent-strong)/0.08)_0%,transparent_48%),linear-gradient(180deg,hsl(var(--home-surface)/0.12)_0%,hsl(var(--home-surface-strong)/0.44)_100%)] [transform:perspective(1200px)_rotateX(76deg)]" />
      <div className="absolute left-[14%] right-[14%] top-[49%] h-[10rem] opacity-70 [background-image:linear-gradient(rgba(103,230,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(103,230,255,0.18)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(circle_at_center,rgba(0,0,0,0.92),transparent_84%)] [transform:perspective(1200px)_rotateX(76deg)]" />

      <div className="absolute left-[18%] top-[34%] h-20 w-24 rounded-full bg-[radial-gradient(circle_at_50%_46%,rgba(107,233,255,0.36)_0%,transparent_74%)] blur-xl" />
      <div className="absolute left-[44%] top-[42%] h-24 w-28 rounded-full bg-[radial-gradient(circle_at_50%_46%,rgba(255,184,105,0.36)_0%,transparent_76%)] blur-xl" />
      <div className="absolute right-[14%] top-[36%] h-20 w-24 rounded-full bg-[radial-gradient(circle_at_50%_46%,rgba(110,225,255,0.28)_0%,transparent_72%)] blur-xl" />

      {[
        { left: "23%", top: "41%", height: "5.1rem", tone: "cool" },
        { left: "43%", top: "49%", height: focusValley ? "6rem" : "4.2rem", tone: "warm" },
        { left: "63%", top: "42%", height: "4.4rem", tone: "cool" },
        { left: "74%", top: "54%", height: "3.5rem", tone: "warm" },
      ].map((marker) => (
        <div
          key={`${marker.left}-${marker.top}`}
          className="absolute"
          style={{ left: marker.left, top: marker.top }}
        >
          <div
            className={cn(
              "absolute left-1/2 top-0 w-[2px] -translate-x-1/2 rounded-full",
              marker.tone === "warm"
                ? "bg-[linear-gradient(180deg,rgba(255,199,118,0.84)_0%,rgba(255,199,118,0.06)_100%)]"
                : "bg-[linear-gradient(180deg,rgba(111,233,255,0.92)_0%,rgba(111,233,255,0.08)_100%)]",
            )}
            style={{ height: marker.height }}
          />
          <div
            className={cn(
              "absolute left-1/2 -translate-x-1/2 rounded-full",
              marker.tone === "warm"
                ? "h-4 w-4 bg-[radial-gradient(circle,hsl(var(--home-accent-warm))_0%,rgba(255,205,130,0.48)_50%,transparent_72%)] shadow-[0_0_18px_rgba(247,192,116,0.36)]"
                : "h-4 w-4 bg-[radial-gradient(circle,hsl(var(--home-accent-strong))_0%,rgba(101,230,255,0.48)_50%,transparent_72%)] shadow-[0_0_18px_rgba(101,230,255,0.34)]",
            )}
            style={{ top: `calc(${marker.height} - 0.45rem)` }}
          />
          <div
            className={cn(
              "absolute left-1/2 top-[calc(100%+0.4rem)] h-10 w-10 -translate-x-1/2 rounded-full border",
              marker.tone === "warm"
                ? "border-[rgba(247,192,116,0.24)]"
                : "border-[rgba(101,230,255,0.22)]",
            )}
            style={{
              transform:
                "translateX(-50%) perspective(1000px) rotateX(78deg)",
            }}
          />
        </div>
      ))}

      {focusValley ? (
        <>
          <div className="absolute left-[38%] top-[46%] h-28 w-28 rounded-full border border-[rgba(247,192,116,0.2)] [transform:perspective(1000px)_rotateX(78deg)]" />
          <div className="absolute left-[35%] top-[43%] h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(255,184,105,0.16)_0%,transparent_70%)] blur-2xl" />
        </>
      ) : null}
    </div>
  );
}

function ConstellationScene({
  includeModules = false,
}: {
  includeModules?: boolean;
}) {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-x-[18%] top-[16%] h-24 rounded-full bg-[radial-gradient(circle,hsl(var(--home-accent-strong)/0.18)_0%,transparent_72%)] blur-3xl" />

      <div className="absolute inset-x-[10%] top-[18%] bottom-[16%]">
        {constellationEdges.map(([fromIndex, toIndex]) => {
          const from = constellationNodes[fromIndex];
          const to = constellationNodes[toIndex];

          return (
            <span
              key={`edge-${fromIndex}-${toIndex}`}
              className="absolute h-px bg-[linear-gradient(90deg,rgba(104,231,255,0.08)_0%,rgba(104,231,255,0.34)_50%,rgba(104,231,255,0.08)_100%)]"
              style={lineStyle(from, to)}
            />
          );
        })}

        {activePathEdges.map(([fromIndex, toIndex]) => {
          const from = constellationNodes[fromIndex];
          const to = constellationNodes[toIndex];

          return (
            <span
              key={`active-${fromIndex}-${toIndex}`}
              className="absolute h-[2px] bg-[linear-gradient(90deg,rgba(247,192,116,0.08)_0%,rgba(247,192,116,0.94)_50%,rgba(247,192,116,0.08)_100%)] shadow-[0_0_14px_rgba(247,192,116,0.28)]"
              style={lineStyle(from, to)}
            />
          );
        })}

        {constellationNodes.map((node, index) => (
          <span
            key={`node-${index}`}
            className={cn(
              "absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full",
              nodeToneClass(node.tone),
            )}
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
            }}
          />
        ))}
      </div>

      {includeModules ? (
        <div className="absolute inset-x-[10%] bottom-[12%] flex items-end justify-between gap-3">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={`module-${index}`}
              className="w-[22%] rounded-[1.2rem] border border-[hsl(var(--home-border)/0.62)] bg-[linear-gradient(180deg,hsl(var(--home-surface)/0.34)_0%,hsl(var(--home-surface-strong)/0.74)_100%)] px-3 py-3 shadow-[0_22px_48px_-36px_hsl(var(--home-shadow)/0.72)]"
            >
              <div
                className={cn(
                  "h-1 rounded-full",
                  index === 2
                    ? "bg-[linear-gradient(90deg,rgba(247,192,116,0.92)_0%,rgba(247,192,116,0.18)_100%)]"
                    : "bg-[linear-gradient(90deg,rgba(104,231,255,0.92)_0%,rgba(104,231,255,0.18)_100%)]",
                )}
              />
              <div className="mt-3 h-1 rounded-full bg-[rgba(255,255,255,0.16)]" />
              <div className="mt-2 h-1 w-2/3 rounded-full bg-[rgba(255,255,255,0.1)]" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HomeFallbackMedia({
  chapterId,
  className,
  compact = false,
  minimal = false,
  stage = false,
}: HomeFallbackMediaProps) {
  const chapter =
    HOME_STORY_CHAPTERS.find((item) => item.id === chapterId) ||
    HOME_STORY_CHAPTERS[0];
  const heroMode = chapter.id === "hero";
  const constellationMode = chapter.id === "drilldown";
  const platformMode = chapter.id === "platform";

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden",
        stage
          ? compact
            ? "min-h-[18rem] p-0"
            : "min-h-[28rem] p-0"
          : "home-flagship-surface rounded-[2rem] border border-[hsl(var(--home-border)/0.88)] shadow-[0_54px_120px_-74px_hsl(var(--home-shadow)/0.94)]",
        !stage && (compact ? "min-h-[18rem] p-4" : "min-h-[28rem] p-5 sm:p-6"),
        className,
      )}
    >
      {!stage ? <div className="home-flagship-grid absolute inset-0 opacity-45" /> : null}
      {!stage ? <div className="home-flagship-noise absolute inset-0 opacity-90" /> : null}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-[12%] top-[8%] h-52 rounded-full bg-gradient-to-br blur-3xl",
          chapterGlowMap[chapter.id],
        )}
      />

      {!minimal && !stage ? (
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-full border border-[hsl(var(--home-border)/0.82)] bg-[hsl(var(--home-surface-strong)/0.72)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--home-text-muted))]">
            {chapter.chapterLabel}
          </div>
          <div className="inline-flex items-center rounded-full border border-[hsl(var(--home-border)/0.68)] bg-[hsl(var(--home-surface)/0.5)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--home-text-muted))]">
            {chapter.sceneLabel}
          </div>
        </div>
      ) : null}

      {heroMode ? (
        <PaperPowerScene />
      ) : constellationMode ? (
        <ConstellationScene />
      ) : platformMode ? (
        <>
          <TerrainScene chapterId={chapter.id} />
          <ConstellationScene includeModules />
        </>
      ) : (
        <TerrainScene chapterId={chapter.id} />
      )}

      {!minimal && !stage ? (
        <div className="absolute bottom-4 left-4 right-4 z-10 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.4rem] border border-[hsl(var(--home-border)/0.82)] bg-[hsl(var(--home-surface-strong)/0.66)] px-4 py-4 backdrop-blur-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--home-text-muted))]">
              {chapter.metric.label}
            </p>
            <p className="mt-3 text-lg font-semibold tracking-[-0.04em] text-[hsl(var(--home-text))]">
              {chapter.metric.value}
            </p>
          </div>
          <div className="rounded-[1.4rem] border border-[hsl(var(--home-border)/0.82)] bg-[linear-gradient(180deg,hsl(var(--home-surface)/0.72)_0%,hsl(var(--home-surface-strong)/0.76)_100%)] px-4 py-4 backdrop-blur-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--home-text-muted))]">
              {chapter.support.label}
            </p>
            <p className="mt-3 text-lg font-semibold tracking-[-0.04em] text-[hsl(var(--home-text))]">
              {chapter.support.value}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
