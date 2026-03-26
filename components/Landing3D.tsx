"use client";

import type { ReactNode } from "react";

import { HomeCinematicScene } from "@/components/home/HomeCinematicScene";
import { HOME_CHAPTERS, type HomeStat } from "@/components/home/home-content";
import { cn } from "@/lib/utils";

const previewStats: HomeStat[] = [
  { key: "tested", label: "Students assessed", value: "50K+" },
  { key: "schools", label: "Schools supported", value: "500+" },
  { key: "time", label: "Teacher time saved", value: "40%" },
];

export function Hero3D(_: { whatsappHref?: string }) {
  const heroChapter = HOME_CHAPTERS[0];

  return (
    <div className="relative h-[80vh] min-h-[32rem] overflow-hidden bg-[#061116] p-4 sm:p-6">
      <HomeCinematicScene
        sceneKey={heroChapter.sceneKey}
        chapterIndex={0}
        chapterCount={HOME_CHAPTERS.length}
        chapterLabel={heroChapter.shortLabel}
        stats={previewStats}
        mode="static"
      />
    </div>
  );
}

export function FeatureCard3D({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "home-depth-card rounded-[1.6rem] p-5 text-white shadow-[0_32px_80px_-44px_rgba(0,0,0,0.58)]",
      )}
    >
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.08] text-lg text-teal-100">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold tracking-[-0.03em] text-white">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-white/[0.68]">{description}</p>
    </div>
  );
}
