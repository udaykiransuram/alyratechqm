import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PageShellWidth = "narrow" | "content" | "wide";
export type PageShellPadding = "standard" | "relaxed" | "none";

const widthClasses: Record<PageShellWidth, string> = {
  narrow: "max-w-6xl",
  content: "max-w-7xl",
  wide: "max-w-[88rem]",
};

const paddingClasses: Record<PageShellPadding, string> = {
  standard: "px-4 py-5 sm:px-0",
  relaxed: "px-4 py-6 sm:px-0",
  none: "px-0 py-0",
};

type PageShellProps = {
  children: ReactNode;
  width?: PageShellWidth;
  padding?: PageShellPadding;
  className?: string;
};

export default function PageShell({
  children,
  width,
  padding = "standard",
  className,
}: PageShellProps) {
  return (
    <div
      className={cn(
        "app-page-shell",
        paddingClasses[padding],
        width ? widthClasses[width] : null,
        className,
      )}
    >
      {children}
    </div>
  );
}
