import type { ReactNode } from "react";

import Link from "next/link";

import { cn } from "@/lib/utils";

type PublicAction = {
  href: string;
  label: string;
  external?: boolean;
};

type PublicFinalCtaProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  primaryAction: PublicAction;
  secondaryAction?: PublicAction;
  visual?: ReactNode;
  supplemental?: ReactNode;
  tone?: "brand" | "dark";
  className?: string;
};

function ActionLink({
  action,
  tone = "primary",
}: {
  action: PublicAction;
  tone?: "primary" | "secondary";
}) {
  const className =
    tone === "primary" ? "public-button-primary" : "public-button-secondary";

  if (action.external) {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {action.label}
      </a>
    );
  }

  return (
    <Link href={action.href} className={className}>
      {action.label}
    </Link>
  );
}

export function PublicFinalCta({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  visual,
  supplemental,
  tone = "brand",
  className,
}: PublicFinalCtaProps) {
  return (
    <section
      className={cn(
        tone === "brand" ? "public-cta" : "public-band-dark",
        "relative overflow-hidden p-8 sm:p-10 lg:p-12",
        className,
      )}
    >
      <div
        className={cn(
          "relative z-10 gap-8",
          visual
            ? "grid items-center lg:grid-cols-[0.85fr,1.15fr] lg:gap-12"
            : "mx-auto max-w-3xl text-center",
        )}
      >
        {visual ? (
          <div className="public-final-cta-visual flex justify-center">{visual}</div>
        ) : null}
        <div className={cn(!visual && "mx-auto max-w-3xl text-center")}>
          {eyebrow ? (
            <div
              className={cn(
                "public-eyebrow mb-6 border-white/12 bg-white/10 text-white/76",
                !visual && "mx-auto",
              )}
            >
              {eyebrow}
            </div>
          ) : null}
          <h2 className="text-balance text-[clamp(2rem,4vw,3.05rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-white">
            {title}
          </h2>
          {description ? (
            <p className="mt-5 max-w-[34rem] text-[0.98rem] leading-7 text-white/78 md:text-[1.05rem] md:leading-8">
              {description}
            </p>
          ) : null}
          <div
            className={cn(
              "mt-8 flex flex-wrap gap-3",
              visual ? "justify-start" : "justify-center",
            )}
          >
            <ActionLink action={primaryAction} />
            {secondaryAction ? (
              <ActionLink action={secondaryAction} tone="secondary" />
            ) : null}
          </div>
          {supplemental ? (
            <div className="mt-8 text-sm leading-7 text-white/72">
              {supplemental}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
