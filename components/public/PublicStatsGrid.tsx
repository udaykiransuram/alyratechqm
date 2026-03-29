import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PublicStatItem = {
  value: ReactNode;
  label: ReactNode;
  icon?: ReactNode;
  note?: ReactNode;
};

type PublicStatsGridProps = {
  items: PublicStatItem[];
  columns?: 2 | 3 | 4;
  tone?: "light" | "dark";
  className?: string;
};

const columnClassMap: Record<NonNullable<PublicStatsGridProps["columns"]>, string> =
  {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
  };

export function PublicStatsGrid({
  items,
  columns = 4,
  tone = "light",
  className,
}: PublicStatsGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6",
        columnClassMap[columns],
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={`public-stat-${index}`}
          className={cn(
            "public-stat-card p-6 text-center md:p-7",
            tone === "dark" && "public-stat-card-dark",
          )}
        >
          {item.icon ? (
            <div className="public-icon-chip mx-auto mb-4">{item.icon}</div>
          ) : null}
          <div className="text-3xl font-semibold tracking-[-0.05em] text-current md:text-4xl">
            {item.value}
          </div>
          <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-current/70">
            {item.label}
          </div>
          {item.note ? (
            <div className="mt-3 text-sm leading-6 text-current/70">
              {item.note}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

