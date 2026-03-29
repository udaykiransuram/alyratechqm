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
        compact ? "max-w-2xl" : "max-w-3xl",
        className,
      )}
    >
      {eyebrow ? (
        <div className={cn("public-eyebrow mb-5", centered && "mx-auto")}>
          {eyebrow}
        </div>
      ) : null}
      <h2
        className={cn(
          "public-heading text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl",
          titleClassName,
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "public-copy mt-5 text-base leading-8 md:text-lg",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      ) : null}
      {actions ? (
        <div
          className={cn(
            "public-section-intro-actions mt-8 flex flex-wrap gap-3",
            centered ? "justify-center" : "justify-start",
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

