import { cn } from "@/lib/utils";

export type PublicTestimonialItem = {
  quote: string;
  author: string;
  role?: string;
  school?: string;
  rating?: number;
};

type PublicTestimonialsGridProps = {
  items: PublicTestimonialItem[];
  className?: string;
};

export function PublicTestimonialsGrid({
  items,
  className,
}: PublicTestimonialsGridProps) {
  return (
    <div className={cn("grid gap-5 md:grid-cols-2 xl:grid-cols-3", className)}>
      {items.map((item, index) => {
        const meta = [item.role, item.school].filter(Boolean).join(" • ");
        const rating = Math.max(0, Math.min(5, item.rating ?? 5));

        return (
          <article
            key={`${item.author}-${index}`}
            className="public-testimonial-card public-card flex h-full flex-col p-5 md:p-6"
          >
            <div className="mb-4 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, starIndex) => (
                <span
                  key={starIndex}
                  className={cn(
                    "text-base leading-none",
                    starIndex < rating
                      ? "text-[hsl(var(--public-warm))]"
                      : "text-[hsl(var(--public-border))]",
                  )}
                  aria-hidden
                >
                  ★
                </span>
              ))}
            </div>
            <p className="text-[0.98rem] leading-7 text-[hsl(var(--public-ink-soft))]">
              &quot;{item.quote}&quot;
            </p>
            <div className="mt-auto border-t border-[hsl(var(--public-border)/0.7)] pt-4">
              <p className="text-[1rem] font-semibold text-[hsl(var(--public-ink))]">
                {item.author}
              </p>
              {meta ? (
                <p className="mt-1 text-sm text-[hsl(var(--public-muted))]">
                  {meta}
                </p>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
