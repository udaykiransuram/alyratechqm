"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, MessageCircleMore, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  formatSummerCrashOfferDeadline,
  getSummerCrashCountdownParts,
  type SummerCrashCountdownParts,
  type SummerCrashEarlyBirdOffer,
} from "@/lib/summer-crash/offer";
import { formatSummerCrashPrice } from "@/lib/summer-crash/shared";

type SummerCrashEarlyBirdOfferProps = {
  offer: SummerCrashEarlyBirdOffer;
  variant?: "surface" | "soft" | "inverse" | "teal";
  compact?: boolean;
  title?: string;
  subtitle?: string;
  layout?: "default" | "aside";
  className?: string;
};

const variantClasses = {
  surface:
    "border-[hsl(184_44%_80%/0.75)] bg-[linear-gradient(145deg,rgba(255,255,255,0.96)_0%,rgba(236,254,255,0.96)_52%,rgba(240,253,250,0.96)_100%)] text-slate-950 shadow-[0_28px_56px_-40px_rgba(8,47,73,0.3)]",
  soft:
    "border-[hsl(184_34%_76%/0.82)] bg-[linear-gradient(145deg,rgba(247,254,255,0.98)_0%,rgba(240,249,255,0.96)_100%)] text-slate-950 shadow-[0_24px_46px_-40px_rgba(15,23,42,0.24)]",
  inverse:
    "border-white/14 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur",
  teal:
    "border-[hsl(177_56%_34%/0.42)] bg-[radial-gradient(circle_at_top_right,rgba(94,234,212,0.18)_0%,transparent_12rem),linear-gradient(145deg,rgba(13,148,136,0.98)_0%,rgba(15,118,110,0.98)_52%,rgba(19,78,74,1)_100%)] text-white shadow-[0_30px_64px_-42px_rgba(15,118,110,0.62)]",
} as const;

export default function SummerCrashEarlyBirdOffer({
  offer,
  variant = "surface",
  compact = false,
  title = "Early bird course price",
  subtitle,
  layout = "default",
  className,
}: SummerCrashEarlyBirdOfferProps) {
  const router = useRouter();
  const refreshTriggeredRef = useRef(false);
  const [countdown, setCountdown] = useState<SummerCrashCountdownParts | null>(
    null,
  );

  useEffect(() => {
    const syncCountdown = () => {
      setCountdown(getSummerCrashCountdownParts({ endsAt: offer.endsAt }));
    };

    syncCountdown();
    const timer = window.setInterval(syncCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [offer.endsAt]);

  useEffect(() => {
    if (!countdown?.expired || refreshTriggeredRef.current) {
      return;
    }

    refreshTriggeredRef.current = true;
    router.refresh();
  }, [countdown?.expired, router]);

  const priceLabel = useMemo(
    () => formatSummerCrashPrice(offer.price, offer.currency),
    [offer.currency, offer.price],
  );
  const originalPriceLabel = useMemo(
    () => formatSummerCrashPrice(offer.originalPrice, offer.currency),
    [offer.currency, offer.originalPrice],
  );
  const savingsLabel = useMemo(
    () => formatSummerCrashPrice(offer.savingsAmount, offer.currency),
    [offer.currency, offer.savingsAmount],
  );
  const deadlineLabel = useMemo(
    () => formatSummerCrashOfferDeadline(offer.endsAt),
    [offer.endsAt],
  );
  const deadlineCompactLabel = useMemo(() => {
    const parsedDate = new Date(offer.endsAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return deadlineLabel;
    }

    try {
      return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
      }).format(parsedDate);
    } catch {
      return deadlineLabel;
    }
  }, [deadlineLabel, offer.endsAt]);
  const displayLabel = useMemo(() => {
    const normalizedLabel = String(offer.label || "").trim();
    if (!normalizedLabel) {
      return "Priority pricing";
    }

    if (normalizedLabel.toLowerCase() === "early bird offer") {
      return "Priority pricing";
    }

    return normalizedLabel;
  }, [offer.label]);

  const toneClasses = variantClasses[variant];
  const isDarkTone = variant === "inverse" || variant === "teal";
  const mutedTextClassName = isDarkTone ? "text-white/78" : "text-slate-600";
  const subtleTextClassName = isDarkTone ? "text-white/62" : "text-slate-500";
  const headingTextClassName = isDarkTone ? "text-white" : "text-slate-950";
  const badgeTextClassName = isDarkTone ? "text-white/80" : "text-teal-700";
  const savingsTextClassName = isDarkTone ? "text-emerald-100" : "text-teal-700";
  const timerPanelClassName =
    isDarkTone
      ? "border-white/14 bg-white/[0.08]"
      : "border-slate-200/90 bg-white/78";
  const dividerClassName = isDarkTone ? "border-white/12" : "border-slate-200/85";
  const countdownStatusLabel = countdown?.expired
    ? "Price ended"
    : "Price holds for";
  const countdownParts = [
    { label: "Days", value: countdown ? String(countdown.days) : "--" },
    { label: "Hours", value: countdown ? String(countdown.hours) : "--" },
    { label: "Min", value: countdown ? String(countdown.minutes) : "--" },
    { label: "Sec", value: countdown ? String(countdown.seconds) : "--" },
  ];
  const showTitle = String(title || "").trim().length > 0;
  const resolvedMainTitle = showTitle ? title : "Course price";
  const resolvedAsideSubtitle = String(subtitle || "").trim();
  const resolvedDefaultSubtitle =
    subtitle ||
    `Discounted course price stays available until ${deadlineLabel}. The free diagnostic remains open separately.`;
  const resolvedCompactSubtitle = resolvedAsideSubtitle || "";
  const savingsNarrative = `Save ${savingsLabel} before ${
    deadlineCompactLabel || deadlineLabel
  }.`;
  const countdownTickerLabel = countdown?.expired
    ? "00d 00h 00m 00s"
    : countdown
      ? `${String(countdown.days).padStart(2, "0")}d ${String(
          countdown.hours,
        ).padStart(2, "0")}h ${String(countdown.minutes).padStart(2, "0")}m ${String(
          countdown.seconds,
        ).padStart(2, "0")}s`
      : "--d --h --m --s";
  const countdownSweepWidth = countdown?.expired
    ? "100%"
    : `${Math.max(
        10,
        (((59 - (countdown?.seconds ?? 59)) / 59) * 100) || 0,
      )}%`;

  if (layout === "aside") {
    return (
      <div
        className={cn(
          "relative px-1 pb-3",
          className,
        )}
      >
        <div className="pointer-events-none absolute bottom-0 left-7 h-5 w-5 rotate-45 rounded-[0.45rem] border border-white/10 bg-[hsl(187_58%_24%)] shadow-[0_18px_34px_-26px_rgba(4,30,36,0.88)]" />
        <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(94,234,212,0.18)_0%,transparent_12rem),linear-gradient(150deg,rgba(18,109,116,0.98)_0%,rgba(10,71,79,0.98)_54%,rgba(6,44,52,1)_100%)] px-4 py-4 text-white shadow-[0_38px_82px_-42px_rgba(4,31,38,0.84)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0)_42%)]" />

          <div className="relative space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/10 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <MessageCircleMore className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/58">
                    Message
                  </p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/92">
                    {displayLabel}
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/18 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100/90">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300/70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-200" />
                </span>
                Live
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-base font-semibold leading-6 tracking-[-0.03em] text-white">
                {resolvedMainTitle}
              </p>
              {resolvedAsideSubtitle ? (
                <p className="text-[13px] leading-5 text-white/74">
                  {resolvedAsideSubtitle}
                </p>
              ) : null}
            </div>

            <div className="rounded-[1.28rem] border border-white/10 bg-white/[0.08] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/56">
                Current course price
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
                <span className="text-[2.05rem] font-semibold leading-none tracking-[-0.06em] text-white">
                  {priceLabel}
                </span>
                <span className="pb-1 text-sm text-white/50 line-through decoration-2">
                  {originalPriceLabel}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-emerald-100">
                {savingsNarrative}
              </p>
            </div>

            <div className="rounded-[1.15rem] border border-white/10 bg-black/10 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-3.5 w-3.5 text-emerald-100/88" />
                  {countdownStatusLabel}
                </div>
                <span className="text-emerald-100/84">Updates live</span>
              </div>
              <div className="mt-2 font-mono text-[0.98rem] font-semibold tracking-[0.22em] text-white">
                {countdownTickerLabel}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(94,234,212,0.65)_0%,rgba(153,246,228,1)_52%,rgba(94,234,212,0.65)_100%)] transition-[width] duration-700 ease-out"
                  style={{ width: countdownSweepWidth }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.55rem] border",
        compact ? "p-3 sm:p-3.5" : "p-5",
        toneClasses,
        className,
      )}
    >
        <div
          className={cn(
            "grid gap-3",
            compact
              ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-3"
              : "lg:grid-cols-[minmax(0,1fr)_15.75rem] lg:gap-5",
          )}
        >
        <div className="pointer-events-none absolute inset-0" />
        <div className={cn("space-y-2.5", compact && "space-y-2")}>
          <div
            className={cn(
              "inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]",
              badgeTextClassName,
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {displayLabel}
          </div>
          <div className={cn("space-y-2.5", compact && "space-y-2")}>
            <p
              className={cn(
                "font-semibold tracking-[-0.03em]",
                compact ? "text-[1.02rem]" : "text-[1.22rem]",
                headingTextClassName,
              )}
            >
              {resolvedMainTitle}
            </p>
            <div className={cn("flex flex-wrap items-end", compact ? "gap-2" : "gap-x-4 gap-y-3")}>
              <span
                className={cn(
                  "block font-semibold tracking-[-0.05em]",
                  compact ? "text-[1.55rem]" : "text-[2rem]",
                )}
              >
                {priceLabel}
              </span>
              <div
                className={cn(
                  "flex items-center gap-2",
                  compact ? "text-xs" : "flex-col items-start gap-2 pb-1",
                )}
              >
                <span
                  className={cn(
                    "line-through decoration-2",
                    compact ? "text-[11px]" : "text-sm",
                    mutedTextClassName,
                  )}
                >
                  {originalPriceLabel}
                </span>
                <p
                  className={cn(
                    "font-medium",
                    compact ? "text-[11px]" : "text-sm",
                    savingsTextClassName,
                  )}
                >
                  {savingsNarrative}
                </p>
              </div>
            </div>
          </div>
          {compact ? (
            resolvedCompactSubtitle ? (
              <p className={cn("text-[12px] leading-5", mutedTextClassName)}>
                {resolvedCompactSubtitle}
              </p>
            ) : null
          ) : (
            <div className="space-y-1">
              <p className={cn("text-sm leading-6", mutedTextClassName)}>
                {resolvedDefaultSubtitle}
              </p>
            </div>
          )}
        </div>

        <div
          className={cn(
            compact ? "rounded-[1rem] border p-2" : "rounded-[1.3rem] border p-3.5",
            timerPanelClassName,
          )}
        >
          <div
            className={cn(
              compact
                ? "mb-2 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em]"
                : "mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]",
              subtleTextClassName,
            )}
          >
            <Clock3 className="h-3.5 w-3.5" />
            {countdownStatusLabel}
          </div>
          <div
            className={cn(
              "grid gap-x-2 gap-y-2",
              compact ? "grid-cols-4" : "grid-cols-2",
            )}
          >
            {countdownParts.map((part) => (
              <div
                key={part.label}
                className={cn("space-y-1", compact && "text-center")}
              >
                <div
                  className={cn(
                    "font-semibold tracking-[-0.04em]",
                    compact ? "text-[0.95rem]" : "text-[1.35rem]",
                    headingTextClassName,
                  )}
                >
                  {typeof part.value === "string" && part.value === "--"
                    ? part.value
                    : String(part.value).padStart(2, "0")}
                </div>
                <div
                  className={cn(
                    compact ? "text-[9px] uppercase tracking-[0.14em]" : "text-[10px] uppercase tracking-[0.16em]",
                    subtleTextClassName,
                  )}
                >
                  {part.label}
                </div>
              </div>
            ))}
          </div>
          {compact ? null : (
            <p
              className={cn(
                "mt-4 border-t pt-3 text-[11px] leading-5",
                mutedTextClassName,
                dividerClassName,
              )}
            >
              Until {deadlineLabel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
