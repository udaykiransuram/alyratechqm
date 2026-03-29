"use client";

import { HomeFallbackMedia } from "./HomeFallbackMedia";
import { HomeSceneCanvas } from "./HomeSceneCanvas";
import {
  HOME_STORY_CHAPTERS,
  type HomeRenderMode,
  type HomeSceneKey,
} from "./home-content";

type HomeSceneDirectorProps = {
  activeChapterId: HomeSceneKey;
  nextChapterId: HomeSceneKey;
  blend: number;
  renderMode: Exclude<HomeRenderMode, "poster">;
  reducedMotion: boolean;
};

export default function HomeSceneDirector({
  activeChapterId,
  nextChapterId,
  blend,
  renderMode,
  reducedMotion,
}: HomeSceneDirectorProps) {
  const activeChapter =
    HOME_STORY_CHAPTERS.find((chapter) => chapter.id === activeChapterId) ||
    HOME_STORY_CHAPTERS[0];
  const showWebgl = renderMode === "full3d";
  const fallback = (
    <HomeFallbackMedia chapterId={activeChapter.id} className="h-full" minimal />
  );

  return (
    <div className="home-stage-frame relative isolate h-[min(45rem,calc(100svh-10rem))] min-h-[31rem] w-full max-w-[48rem] overflow-hidden rounded-[2.9rem] xl:max-w-[52rem]">
      <div
        className={`absolute inset-0 ${
          showWebgl ? "opacity-[0.08]" : "opacity-[0.58]"
        }`}
      >
        {fallback}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_44%_24%,hsl(var(--home-accent-strong)/0.22)_0%,transparent_42%),radial-gradient(circle_at_76%_18%,hsl(var(--home-accent)/0.14)_0%,transparent_28%),radial-gradient(circle_at_72%_76%,hsl(var(--home-accent-warm)/0.16)_0%,transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--home-bg-0)/0.04)_0%,transparent_22%,transparent_72%,hsl(var(--home-shadow)/0.28)_100%)]" />

      <div className="absolute left-5 top-5 z-10 flex flex-wrap items-center gap-2 sm:left-6 sm:top-6">
        <div className="home-stage-badge">
          {activeChapter.chapterLabel} · {activeChapter.navLabel}
        </div>
        <div className="home-stage-badge home-stage-badge-subtle">
          Interactive scene
        </div>
      </div>

      <div className="absolute inset-0">
        {showWebgl ? (
          <HomeSceneCanvas
            activeChapterId={activeChapterId}
            nextChapterId={nextChapterId}
            blend={blend}
            renderMode={renderMode}
            reducedMotion={reducedMotion}
          />
        ) : (
          <HomeFallbackMedia chapterId={activeChapter.id} className="h-full" minimal />
        )}
      </div>

      <div className="pointer-events-none absolute bottom-5 left-5 right-5 z-10 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="home-stage-caption">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/46">
            Scene focus
          </p>
          <h3 className="mt-2 text-base font-semibold tracking-[-0.03em] text-white sm:text-[1.1rem]">
            {activeChapter.sceneLabel}
          </h3>
          <p className="mt-2 max-w-[34rem] text-sm leading-6 text-white/64 sm:text-[0.95rem]">
            {activeChapter.sceneSummary}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          {activeChapter.sceneMarkers.map((marker) => (
            <span key={marker} className="home-stage-marker">
              {marker}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
