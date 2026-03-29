"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, MessageCircleMore } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HomeCtaClusterProps = {
  whatsappHref?: string;
  testPrice?: number;
  tone?: "dark" | "light";
  compact?: boolean;
  className?: string;
};

function formatPrice(price?: number) {
  if (typeof price !== "number") {
    return null;
  }

  return new Intl.NumberFormat("en-IN").format(price);
}

export default function HomeCtaCluster({
  whatsappHref,
  testPrice,
  tone = "dark",
  compact = false,
  className,
}: HomeCtaClusterProps) {
  const priceLabel = formatPrice(testPrice);
  const darkTone = tone === "dark";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          asChild
          size={compact ? "lg" : "hero"}
          className={cn(
            "rounded-full border-0 px-7 shadow-[0_30px_72px_-34px_hsl(var(--home-shadow)/0.88)] transition-transform duration-200 hover:-translate-y-0.5",
            darkTone
              ? "text-[hsl(var(--home-bg-0))]"
              : "text-[hsl(var(--home-proof-text))]",
          )}
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--home-accent-strong)) 0%, hsl(var(--home-accent)) 100%)",
          }}
        >
          <Link href="/contact">
            Book a Demo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>

        <Button
          asChild
          size={compact ? "lg" : "hero"}
          variant="outline"
          className={cn(
            "rounded-full px-7 backdrop-blur-xl transition-transform duration-200 hover:-translate-y-0.5",
            darkTone
              ? "border-[hsl(var(--home-border)/0.88)] bg-[hsl(var(--home-surface)/0.48)] text-[hsl(var(--home-text))] hover:bg-[hsl(var(--home-surface)/0.66)]"
              : "border-[hsl(var(--home-proof-border)/0.88)] bg-[hsl(var(--home-proof-surface)/0.92)] text-[hsl(var(--home-proof-text))] hover:bg-white",
          )}
        >
          <Link href="/talent-test">
            Start Baseline Test
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>

        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5",
              darkTone
                ? "border-[hsl(var(--home-accent-warm)/0.24)] bg-[linear-gradient(135deg,hsl(var(--home-accent-warm)/0.18)_0%,hsl(var(--home-surface)/0.22)_100%)] text-[hsl(var(--home-text))]"
                : "border-[hsl(var(--home-proof-border)/0.88)] bg-[linear-gradient(135deg,hsl(var(--home-accent-warm)/0.14)_0%,white_100%)] text-[hsl(var(--home-proof-text))]",
            )}
          >
            <MessageCircleMore className="h-4 w-4" />
            <span>WhatsApp</span>
          </a>
        ) : null}
      </div>

      {priceLabel ? (
        <p
          className={cn(
            "text-sm leading-6",
            darkTone
              ? "text-[hsl(var(--home-text-muted))]"
              : "text-[hsl(var(--home-proof-muted))]",
          )}
        >
          Baseline assessment available from{" "}
          <span className="font-semibold text-current">Rs. {priceLabel}</span>.
        </p>
      ) : null}
    </div>
  );
}
