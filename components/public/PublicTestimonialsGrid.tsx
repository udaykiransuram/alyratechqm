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
    <div className={cn("grid gap-6 md:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item, index) => {
        const meta = [item.role, item.school].filter(Boolean).join(" • ");
        const rating = Math.max(0, Math.min(5, item.rating ?? 5));

        return (
          <article
            key={`${item.author}-${index}`}
            className="public-testimonial-card public-card p-6 md:p-7"
          >
            <div className="mb-5 flex gap-1 text-[hsl(var(--public-warm))]">
              {Array.from({ length: rating }).map((_, starIndex) => (
                <span key={starIndex}>★</span>
              ))}
            </div>
            <p className="text-base leading-8 text-[hsl(var(--public-ink-soft))]">
              &quot;{item.quote}&quot;
            </p>
            <div className="mt-6 border-t border-[hsl(var(--public-border)/0.7)] pt-4">
              <p className="text-base font-semibold text-[hsl(var(--public-ink))]">
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

