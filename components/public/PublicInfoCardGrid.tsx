import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PublicInfoCardItem = {
  eyebrow: ReactNode;
  title: ReactNode;
  supportingText?: ReactNode;
  icon?: ReactNode;
  href?: string;
};

type PublicInfoCardGridProps = {
  items: PublicInfoCardItem[];
  className?: string;
};

export function PublicInfoCardGrid({
  items,
  className,
}: PublicInfoCardGridProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-3", className)}>
      {items.map((item, index) => {
        const content = (
          <article key={`${item.eyebrow}-${index}`} className="public-info-card public-card p-6">
            <div className="flex items-start gap-4">
              {item.icon ? <div className="public-icon-chip">{item.icon}</div> : null}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--public-muted))]">
                  {item.eyebrow}
                </p>
                <div className="mt-3 text-base font-semibold leading-7 text-[hsl(var(--public-ink))]">
                  {item.title}
                </div>
                {item.supportingText ? (
                  <div className="mt-2 text-sm leading-6 text-[hsl(var(--public-muted))]">
                    {item.supportingText}
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        );

        if (!item.href) {
          return content;
        }

        return (
          <a key={`${item.eyebrow}-${index}`} href={item.href} className="block">
            {content}
          </a>
        );
      })}
    </div>
  );
}
