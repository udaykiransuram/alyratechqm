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
  toolbar?: ReactNode;
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
  toolbar,
  children,
  className,
}: PageHeroProps) {
  const toolbarContent = toolbar ?? children;

  return (
    <section className={cn("app-page-hero", className)}>
      <div className="app-page-hero-body">
        <div className="app-page-hero-header">
          <div className="app-page-hero-copy">
            {eyebrow ? <div className="app-page-eyebrow">{eyebrow}</div> : null}
            <h1 className="app-page-title-lg">{title}</h1>
            {description ? (
              <p className="app-page-description">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="app-page-hero-actions">{actions}</div> : null}
        </div>

        {meta ? <div className="app-page-meta">{meta}</div> : null}

        {stats?.length ? (
          <div className="app-metric-grid">
            {stats.map((stat, index) => (
              <div
                key={`${String(stat.label)}-${index}`}
                className="app-metric-card"
              >
                <p className="app-metric-label">{stat.label}</p>
                <div className="app-metric-value">{stat.value}</div>
                {stat.meta ? (
                  <p className="app-metric-meta">{stat.meta}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {toolbarContent ? <div className="space-y-3">{toolbarContent}</div> : null}
      </div>
    </section>
  );
}
