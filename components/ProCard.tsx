"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ProCardProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  accent?: "teal" | "emerald" | "cyan" | "blue" | "indigo";
  className?: string;
}

// Explicit class maps so Tailwind includes these in the build
const accentStyles: Record<NonNullable<ProCardProps["accent"]>, {
  border: string;
  topBar: string;
  iconBg: string;
  iconText: string;
}> = {
  teal:    { border: "border-teal-500/20",    topBar: "bg-teal-400/40",    iconBg: "bg-teal-500/10",    iconText: "text-teal-600 dark:text-teal-300" },
  emerald: { border: "border-emerald-500/20", topBar: "bg-emerald-400/40", iconBg: "bg-emerald-500/10", iconText: "text-emerald-600 dark:text-emerald-300" },
  cyan:    { border: "border-cyan-500/20",    topBar: "bg-cyan-400/40",    iconBg: "bg-cyan-500/10",    iconText: "text-cyan-600 dark:text-cyan-300" },
  blue:    { border: "border-blue-500/20",    topBar: "bg-blue-400/40",    iconBg: "bg-blue-500/10",    iconText: "text-blue-600 dark:text-blue-300" },
  indigo:  { border: "border-indigo-500/20",  topBar: "bg-indigo-400/40",  iconBg: "bg-indigo-500/10",  iconText: "text-indigo-600 dark:text-indigo-300" },
};

export function ProCard({ icon, title, description, accent = "teal", className }: ProCardProps) {
  const styles = accentStyles[accent];
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Mobile-friendly scroll-in hover-ish effect: add .in-view when intersecting
  useEffect(() => {
    if (!rootRef.current) return;
    const el = rootRef.current;
    let seen = false;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !seen) {
            el.classList.add("in-view");
            seen = true;
          }
        });
      },
      { rootMargin: "120px 0px", threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Clean, valid glassmorphism card
  return (
    <div
      ref={rootRef}
      data-observe-card
      className={cn(
        // Match testimonial card style
        "group relative h-full overflow-hidden rounded-2xl border border-white/30 bg-white/60 backdrop-blur-sm text-slate-900 p-7 md:p-8 shadow-md transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_16px_48px_rgba(0,0,0,0.25)] hover:bg-white/70 hover:border-white/50",
        // Mobile scroll hover effect: slight lift when card enters viewport
        "motion-safe:translate-y-2 motion-safe:opacity-95 will-change-transform",
        className
      )}
    >
      {/* Minimal overlays to mirror testimonial simplicity */}

      {/* Top accent bar removed per feedback for a cleaner glass look */}

      <div className="relative z-10 flex items-start gap-4 md:gap-5">
        {icon && (
          <div
            className={cn(
              // Icon badge styled similarly to testimonial card surface
              "flex h-10 w-10 md:h-12 md:w-12 flex-none items-center justify-center rounded-xl border border-white/30 bg-white/60 text-2xl md:text-3xl shadow-sm transition-transform duration-300 group-hover:scale-110",
              styles.iconText
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg md:text-xl font-semibold tracking-tight text-slate-900 mb-1.5">{title}</h3>
          <p className="text-sm md:text-base leading-relaxed text-slate-900/90">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default ProCard;

// dev-hmr-check: safe no-op comment to confirm HMR and auto-reload are working
