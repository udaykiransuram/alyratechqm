"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";

import {
  HOME_SCENE_STATES,
  type HomeRenderMode,
  type HomeSceneKey,
  type HomeSceneState,
} from "./home-content";

export type HomeCinematicExperienceProps = {
  activeChapterId: HomeSceneKey;
  nextChapterId: HomeSceneKey;
  blend: number;
  renderMode: Exclude<HomeRenderMode, "poster">;
  reducedMotion: boolean;
};

const baseColumnPositions = [-2.55, -0.85, 0.85, 2.55] as const;
const baseModuleAngles = [-1.6, -0.52, 0.52, 1.6] as const;

function mixSceneState(
  current: HomeSceneState,
  next: HomeSceneState,
  blend: number,
): HomeSceneState {
  const mix = (from: number, to: number) => from + (to - from) * blend;
  const mixTuple = (
    from: [number, number, number],
    to: [number, number, number],
  ): [number, number, number] => [
    mix(from[0], to[0]),
    mix(from[1], to[1]),
    mix(from[2], to[2]),
  ];

  return {
    camera: mixTuple(current.camera, next.camera),
    target: mixTuple(current.target, next.target),
    coreScale: mix(current.coreScale, next.coreScale),
    ringScale: mix(current.ringScale, next.ringScale),
    ringTilt: mix(current.ringTilt, next.ringTilt),
    orbitRadius: mix(current.orbitRadius, next.orbitRadius),
    slabSpread: mix(current.slabSpread, next.slabSpread),
    slabLift: mix(current.slabLift, next.slabLift),
    slabOpacity: mix(current.slabOpacity, next.slabOpacity),
    columnBias: mix(current.columnBias, next.columnBias),
    columnHeights: [
      mix(current.columnHeights[0], next.columnHeights[0]),
      mix(current.columnHeights[1], next.columnHeights[1]),
      mix(current.columnHeights[2], next.columnHeights[2]),
      mix(current.columnHeights[3], next.columnHeights[3]),
    ],
    moduleArc: mix(current.moduleArc, next.moduleArc),
    moduleLift: mix(current.moduleLift, next.moduleLift),
    clusterScale: mix(current.clusterScale, next.clusterScale),
    latticeScale: mix(current.latticeScale, next.latticeScale),
    glow: mix(current.glow, next.glow),
    warmMix: mix(current.warmMix, next.warmMix),
  };
}

export default function HomeCinematicExperience({
  activeChapterId,
  nextChapterId,
  blend,
  renderMode,
  reducedMotion,
}: HomeCinematicExperienceProps) {
  const scene = useMemo(
    () =>
      mixSceneState(
        HOME_SCENE_STATES[activeChapterId],
        HOME_SCENE_STATES[nextChapterId],
        blend,
      ),
    [activeChapterId, blend, nextChapterId],
  );

  const motionFactor = reducedMotion ? 0.28 : renderMode === "lite" ? 0.72 : 1;
  const volumeStyle: CSSProperties = {
    transform: [
      `rotateX(${10 + scene.columnBias * 7}deg)`,
      `rotateY(${scene.camera[0] * 5.6}deg)`,
      `scale(${0.94 + scene.coreScale * 0.12})`,
    ].join(" "),
  };

  const auraStyle: CSSProperties = {
    background: [
      `radial-gradient(circle at 22% 18%, hsl(var(--home-accent-strong) / ${0.18 + scene.glow * 0.08}) 0%, transparent 26rem)`,
      `radial-gradient(circle at 78% 16%, hsl(var(--home-accent) / ${0.16 + scene.glow * 0.06}) 0%, transparent 28rem)`,
      `radial-gradient(circle at 50% 84%, hsl(var(--home-accent-warm) / ${0.08 + scene.warmMix * 0.12}) 0%, transparent 22rem)`,
    ].join(", "),
  };

  const coreStyle: CSSProperties = {
    transform: `translate(-50%, -50%) translateZ(${110 + scene.glow * 36}px) scale(${scene.coreScale})`,
    background: `linear-gradient(145deg, hsl(var(--home-accent-strong)) 0%, hsl(var(--home-accent)) 62%, hsl(var(--home-accent-warm) / ${0.48 + scene.warmMix * 0.2}) 100%)`,
    boxShadow: `0 0 ${60 + scene.glow * 30}px hsl(var(--home-accent-strong) / 0.34), 0 28px 70px -26px hsl(var(--home-shadow) / 0.82)`,
    animation: reducedMotion
      ? "none"
      : `home-scene-pulse ${5.8 - motionFactor * 1.6}s ease-in-out infinite`,
  };

  const innerCoreStyle: CSSProperties = {
    transform: `translate(-50%, -50%) translateZ(${150 + scene.glow * 42}px) scale(${0.62 + scene.coreScale * 0.08})`,
    background: `radial-gradient(circle, hsl(var(--home-accent-strong) / 0.96) 0%, hsl(var(--home-accent) / 0.76) 50%, transparent 80%)`,
    boxShadow: `0 0 ${40 + scene.glow * 18}px hsl(var(--home-accent-strong) / 0.4)`,
  };

  const floorStyle: CSSProperties = {
    transform: `translate(-50%, -50%) rotateX(78deg) scale(${0.82 + scene.latticeScale * 0.26})`,
    opacity: 0.22 + scene.glow * 0.12,
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="home-scene-shell absolute inset-0">
        <div className="home-scene-aura absolute inset-0" style={auraStyle} />
        <div className="home-scene-depth-grid absolute inset-0" />

        <div className="home-scene-volume" style={volumeStyle}>
          <div className="home-scene-floor" style={floorStyle} />

          {[0, 1, 2].map((index) => {
            const size = 17 + index * 4 + scene.ringScale * 2.8;
            const style: CSSProperties = {
              width: `${size}rem`,
              height: `${size * 0.46}rem`,
              transform: [
                "translate(-50%, -50%)",
                `translateZ(${index * 40}px)`,
                `rotateX(${76 + scene.ringTilt * 12}deg)`,
                `rotateZ(${index * 16 + scene.ringTilt * 18}deg)`,
                `scale(${0.88 + scene.ringScale * 0.18})`,
              ].join(" "),
              opacity: 0.2 + scene.glow * 0.16 - index * 0.03,
              animation: reducedMotion
                ? "none"
                : `home-scene-spin ${16 + index * 5}s linear infinite`,
            };

            return (
              <div
                key={`ring-${index}`}
                className="home-scene-ring"
                style={style}
              />
            );
          })}

          {Array.from({ length: 6 }).map((_, index) => {
            const direction = index % 2 === 0 ? -1 : 1;
            const layer = Math.floor(index / 2) - 1;
            const style: CSSProperties = {
              transform: [
                "translate(-50%, -50%)",
                `translate3d(${direction * scene.slabSpread * 2.4}rem, ${layer * 4.2 + direction * scene.slabLift * 0.45}rem, ${-40 + layer * 35}px)`,
                `rotateY(${direction * (22 + scene.ringTilt * 18)}deg)`,
                "rotateX(-8deg)",
              ].join(" "),
              opacity: Math.min(0.46, scene.slabOpacity + 0.12),
            };

            return (
              <div
                key={`slab-${index}`}
                className="home-scene-slab"
                style={style}
              />
            );
          })}

          {baseColumnPositions.map((position, index) => {
            const height = scene.columnHeights[index] || 1.4;
            const style: CSSProperties = {
              height: `${height * 4.5}rem`,
              transform: [
                "translateX(-50%)",
                `translate3d(${(position + scene.columnBias) * 4.2}rem, 0, ${-40 + index * 18}px)`,
              ].join(" "),
              opacity: 0.28 + scene.glow * 0.14,
            };

            return (
              <div
                key={`column-${index}`}
                className="home-scene-column"
                style={style}
              />
            );
          })}

          {baseModuleAngles.map((angle, index) => {
            const style: CSSProperties = {
              transform: [
                "translate(-50%, -50%)",
                `translate3d(${Math.sin(angle) * scene.moduleArc * 5.4}rem, ${Math.cos(angle) * scene.moduleLift * 2.9}rem, ${80 - Math.abs(angle) * 22}px)`,
                `rotateY(${angle * 18}deg)`,
                "rotateX(-10deg)",
              ].join(" "),
              opacity: 0.48 + scene.glow * 0.08,
            };

            return (
              <div
                key={`module-${index}`}
                className="home-scene-module"
                style={style}
              >
                <div className="home-scene-module-line" />
                <div className="home-scene-module-line short" />
              </div>
            );
          })}

          {Array.from({ length: 8 }).map((_, index) => {
            const style: CSSProperties = {
              transform: `translate(-50%, -50%) rotate(${index * 45}deg)`,
              animation: reducedMotion
                ? "none"
                : `home-scene-spin ${9 + index * 1.4}s linear infinite`,
            };
            const dotStyle: CSSProperties = {
              transform: `translateX(${scene.orbitRadius * 2.25}rem) translateY(${((index % 2 === 0 ? -1 : 1) * (0.4 + (index % 3) * 0.16))}rem)`,
              opacity: 0.6 + scene.glow * 0.14,
            };

            return (
              <div key={`orbit-${index}`} className="home-scene-orbit" style={style}>
                <div className="home-scene-orbit-dot" style={dotStyle} />
              </div>
            );
          })}

          {Array.from({ length: 5 }).map((_, index) => {
            const radius = 1.3 + index * 0.34;
            const style: CSSProperties = {
              transform: [
                "translate(-50%, -50%)",
                `translate3d(${Math.cos(index * 1.25) * radius * scene.clusterScale * 4.2}rem, ${Math.sin(index * 1.12) * radius * scene.clusterScale * 2.4}rem, ${20 + index * 12}px)`,
              ].join(" "),
              opacity: 0.44 + scene.glow * 0.12,
              animation: reducedMotion
                ? "none"
                : `home-scene-float ${5.4 + index * 0.9}s ease-in-out infinite`,
            };

            return (
              <div
                key={`cluster-${index}`}
                className="home-scene-cluster"
                style={style}
              />
            );
          })}

          <div className="home-scene-core" style={coreStyle} />
          <div className="home-scene-core-inner" style={innerCoreStyle} />
        </div>

        <div
          className="home-scene-lens-flare absolute inset-x-[14%] top-[14%] h-44 rounded-full blur-3xl"
          style={{
            opacity: 0.28 + scene.glow * 0.12,
            transform: `translateY(${scene.target[1] * 0.8}rem) scale(${1 + scene.glow * 0.14})`,
          }}
        />
      </div>
    </div>
  );
}
