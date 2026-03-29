import { cn } from "@/lib/utils";

export type PublicFaqItem = {
  question: string;
  answer: string;
};

type PublicFaqStackProps = {
  items: PublicFaqItem[];
  className?: string;
};

export function PublicFaqStack({ items, className }: PublicFaqStackProps) {
  return (
    <div className={cn("space-y-4 md:space-y-5", className)}>
      {items.map((item, index) => (
        <article key={`${item.question}-${index}`} className="public-faq-card public-card p-6">
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-[hsl(var(--public-ink))]">
            {item.question}
          </h3>
          <p className="mt-3 text-base leading-8 text-[hsl(var(--public-ink-soft))]">
            {item.answer}
          </p>
        </article>
      ))}
    </div>
  );
}

