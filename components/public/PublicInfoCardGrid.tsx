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
    <div className={cn("grid gap-5 md:grid-cols-2 xl:grid-cols-3", className)}>
      {items.map((item, index) => {
        const content = (
          <article
            key={`public-info-card-${index}`}
            className="public-info-card public-card flex h-full flex-col p-5 md:p-6"
          >
            <div className="flex h-full items-start gap-4">
              {item.icon ? <div className="public-icon-chip mt-0.5">{item.icon}</div> : null}
              <div className="flex min-h-full min-w-0 flex-1 flex-col">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--public-muted))]">
                  {item.eyebrow}
                </p>
                <div className="mt-2.5 text-[1.02rem] font-semibold leading-7 text-[hsl(var(--public-ink))]">
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
          <a key={`public-info-card-link-${index}`} href={item.href} className="block h-full">
            {content}
          </a>
        );
      })}
    </div>
  );
}
