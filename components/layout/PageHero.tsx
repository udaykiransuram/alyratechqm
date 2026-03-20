import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeroStat = {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
};

type PageHeroProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  stats?: PageHeroStat[];
  children?: ReactNode;
  className?: string;
};

export default function PageHero({
  eyebrow,
  title,
  description,
  actions,
  meta,
  stats,
  children,
  className,
}: PageHeroProps) {
  const visibleStats = Array.isArray(stats)
    ? stats.filter((stat) => stat && stat.label)
    : [];

  return (
    <section className={cn("app-page-hero", className)}>
      <div className="app-page-hero-body">
        <div className="app-page-hero-header">
          <div className="app-page-hero-copy">
            {eyebrow ? <div className="app-page-eyebrow">{eyebrow}</div> : null}
            <div className="space-y-2">
              <h1 className="app-page-title-lg">{title}</h1>
              {description ? (
                <p className="app-page-description">{description}</p>
              ) : null}
            </div>
            {meta ? <div className="app-page-meta">{meta}</div> : null}
          </div>
          {actions ? <div className="app-page-hero-actions">{actions}</div> : null}
        </div>

        {children ? <div>{children}</div> : null}

        {visibleStats.length > 0 ? (
          <div className="app-metric-grid">
            {visibleStats.map((stat) => (
              <div key={stat.label} className="app-metric-card">
                <p className="app-metric-label">{stat.label}</p>
                <p className="app-metric-value">{stat.value}</p>
                {stat.meta ? <p className="app-metric-meta">{stat.meta}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
