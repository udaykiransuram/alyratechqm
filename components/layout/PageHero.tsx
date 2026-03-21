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
  actions,
  children,
  className,
}: PageHeroProps) {
  return (
    <section className={cn("app-page-hero", className)}>
      <div className="app-page-hero-body">
        <div className="app-page-hero-header">
          <div className="app-page-hero-copy">
            {eyebrow ? <div className="app-page-eyebrow">{eyebrow}</div> : null}
            <h1 className="app-page-title-lg">{title}</h1>
          </div>
          {actions ? <div className="app-page-hero-actions">{actions}</div> : null}
        </div>

        {children ? <div>{children}</div> : null}
      </div>
    </section>
  );
}
