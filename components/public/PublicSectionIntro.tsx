import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PublicSectionIntroProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  align?: "left" | "center";
  compact?: boolean;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

export function PublicSectionIntro({
  eyebrow,
  title,
  description,
  actions,
  align = "center",
  compact = false,
  className,
  titleClassName,
  descriptionClassName,
}: PublicSectionIntroProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "public-section-intro",
        centered ? "mx-auto text-center" : "text-left",
        compact ? "max-w-xl" : "max-w-[46rem]",
        className,
      )}
    >
      {eyebrow ? (
        <div className={cn("public-eyebrow mb-4", centered && "mx-auto")}>
          {eyebrow}
        </div>
      ) : null}
      <h2
        className={cn(
          "public-heading text-[2rem] font-semibold tracking-tight md:text-[2.45rem] lg:text-[2.85rem]",
          titleClassName,
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "public-copy mt-4 text-[1rem] leading-7 md:text-[1.08rem] md:leading-8",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      ) : null}
      {actions ? (
        <div
          className={cn(
            "public-section-intro-actions mt-6 flex flex-wrap gap-2.5 sm:gap-3",
            centered ? "justify-center" : "justify-start",
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
