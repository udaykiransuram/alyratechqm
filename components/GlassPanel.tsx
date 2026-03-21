"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  /** Override background classes, e.g. "bg-white/5 dark:bg-white/0" */
  bgClassName?: string;
  /** Override blur/saturate classes, e.g. "backdrop-blur-md" */
  blurClassName?: string;
  /** Disable the inner highlight sheen if true */
  noHighlight?: boolean;
  /** Optional border color utility, e.g. "border-white/30" */
  borderClassName?: string;
  /** Optional seamless texture inside the panel (e.g., "/images/tt-black-linen-2.png") */
  textureUrl?: string;
  /** Tailwind opacity utility for texture intensity (e.g., "opacity-10"). Defaults to opacity-10 */
  textureOpacityClass?: string;
  /** Optional subtle grain/noise overlay to enhance glass diffusion */
  noiseUrl?: string;
  /** Tailwind opacity for noise layer. Defaults to opacity-10 */
  noiseOpacityClass?: string;
  /** Add a specular highlight sweep for stronger glass feel */
  specular?: boolean;
  /** Add a faint inner edge highlight for glass border */
  edgeHighlight?: boolean;
  /** Optional white veil overlay to add frost over the texture (e.g., "bg-white/20") */
  veilClassName?: string;
  /** Border radius utility to apply consistently to container and overlays. Defaults to rounded-3xl */
  radiusClassName?: string;
}

/**
 * Reusable glassmorphism panel with subtle teal-friendly border,
 * soft inner highlight and strong backdrop blur.
 */
export default function GlassPanel({ children, className, bgClassName, blurClassName, noHighlight, borderClassName, textureUrl, textureOpacityClass, noiseUrl, noiseOpacityClass, specular, edgeHighlight, veilClassName, radiusClassName }: GlassPanelProps) {
  const radius = radiusClassName ?? "rounded-3xl";
  return (
    <div
      className={cn(
        "relative border group",
        radius,
        borderClassName ?? "border-teal-500/20",
        bgClassName ?? "bg-white/5 dark:bg-white/5",
        blurClassName ?? "backdrop-blur-3xl backdrop-saturate-150",
        "shadow-[0_8px_30px_rgba(0,0,0,0.08)]",
        className
      )}
    >
      {/* Optional inner edge highlight to sell the glass edge */}
      {edgeHighlight && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0",
            radius,
            // subtle inner ring using inset box-shadow via utility classes is limited; use gradient
            "[box-shadow:inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.06)]"
          )}
        />
      )}
      {/* Optional seamless texture layer clipped to panel radius */}
      {textureUrl && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 bg-repeat",
            radius,
            textureOpacityClass ?? "opacity-10"
          )}
          style={{ backgroundImage: `url('${textureUrl}')`, backgroundSize: 'auto' }}
        />
      )}
      {/* Optional noise grain layer for diffusion */}
      {noiseUrl && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 bg-[length:600px_600px] bg-repeat",
            radius,
            noiseOpacityClass ?? "opacity-10"
          )}
          style={{ backgroundImage: `url('${noiseUrl}')` }}
        />
      )}
      {/* Optional veil overlay for frosted effect over texture */}
      {veilClassName && (
        <div aria-hidden className={cn("pointer-events-none absolute inset-0", radius, veilClassName)} />
      )}
      {/* Hover sheen for premium glass feel */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.22),transparent)] opacity-0 group-hover:opacity-100 transition-opacity duration-700",
          radius
        )}
      />
      {/* Specular highlight sweep (very soft) */}
      {specular && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0",
            radius,
            "bg-[conic-gradient(from_200deg_at_10%_0%,rgba(255,255,255,0.20)_0deg,transparent_120deg)] opacity-40"
          )}
        />
      )}
      {/* Soft inner highlight to enhance glass look */}
      {!noHighlight && (
        <div aria-hidden className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-[0.12]", radius)} />
      )}
      {children}
    </div>
  );
}
