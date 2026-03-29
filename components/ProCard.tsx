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
  teal:    { border: "border-teal-500/18",    topBar: "bg-teal-500/65",    iconBg: "bg-teal-500/10",    iconText: "text-teal-700 dark:text-teal-300" },
  emerald: { border: "border-emerald-500/18", topBar: "bg-emerald-500/65", iconBg: "bg-emerald-500/10", iconText: "text-emerald-700 dark:text-emerald-300" },
  cyan:    { border: "border-cyan-500/18",    topBar: "bg-cyan-500/65",    iconBg: "bg-cyan-500/10",    iconText: "text-cyan-700 dark:text-cyan-300" },
  blue:    { border: "border-blue-500/18",    topBar: "bg-blue-500/65",    iconBg: "bg-blue-500/10",    iconText: "text-blue-700 dark:text-blue-300" },
  indigo:  { border: "border-indigo-500/18",  topBar: "bg-indigo-500/65",  iconBg: "bg-indigo-500/10",  iconText: "text-indigo-700 dark:text-indigo-300" },
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
        "group relative h-full overflow-hidden rounded-[1.6rem] border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,249,249,0.92))] p-7 text-slate-900 shadow-[0_22px_52px_-34px_rgba(15,23,42,0.22)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-[0_28px_60px_-34px_rgba(8,15,23,0.28)] md:p-8",
        styles.border,
        "motion-safe:translate-y-2 motion-safe:opacity-95 will-change-transform",
        className
      )}
    >
      <div
        aria-hidden
        className="absolute inset-x-6 top-0 h-px bg-white/75"
      />
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-7 top-0 h-1 rounded-b-full opacity-90",
          styles.topBar,
        )}
      />
      <div
        aria-hidden
        className="absolute right-0 top-0 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(13,148,136,0.12),transparent_72%)]"
      />

      <div className="relative z-10 flex items-start gap-4 md:gap-5">
        {icon && (
          <div
            className={cn(
              "flex h-11 w-11 flex-none items-center justify-center rounded-[1rem] border border-white/70 text-2xl shadow-[0_18px_30px_-24px_rgba(15,23,42,0.18)] transition-transform duration-300 group-hover:scale-105 md:h-12 md:w-12 md:text-3xl",
              styles.iconBg,
              styles.iconText
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="mb-1.5 text-lg font-semibold tracking-[-0.03em] text-slate-950 md:text-xl">
            {title}
          </h3>
          <p className="text-sm leading-relaxed text-slate-700 md:text-base">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ProCard;

// dev-hmr-check: safe no-op comment to confirm HMR and auto-reload are working
