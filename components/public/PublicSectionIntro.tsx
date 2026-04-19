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
        compact ? "max-w-[40rem]" : "max-w-[47rem]",
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
          "public-heading text-balance text-[clamp(1.95rem,4.4vw,2.95rem)] font-semibold leading-[1.02] tracking-[-0.045em]",
          titleClassName,
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "public-copy mt-5 text-[0.98rem] leading-7 md:text-[1.04rem] md:leading-8",
            centered && "mx-auto",
            descriptionClassName,
          )}
        >
          {description}
        </p>
      ) : null}
      {actions ? (
        <div
          className={cn(
            "public-section-intro-actions mt-7 flex flex-wrap gap-2.5 sm:gap-3",
            centered ? "justify-center" : "justify-start",
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
