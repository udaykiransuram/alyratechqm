import { Badge } from '@/components/ui/badge';

interface Tag {
  _id: string;
  name: string;
  type?: { name: string };
}

interface QuestionInPaper {
  question: {
    tags?: Tag[];
  };
  marks: number;
  negativeMarks: number;
}

interface Section {
  id: string;
  name: string;
  questions: QuestionInPaper[];
}

export function SectionTagSummary({ section }: { section: Section }) {
  const tagTypeCounts: Record<string, Record<string, number>> = {};

  section.questions.forEach(q => {
    (q.question.tags ?? []).forEach(tag => {
      const type = tag.type?.name || 'Other';
      if (!tagTypeCounts[type]) tagTypeCounts[type] = {};
      tagTypeCounts[type][tag.name] = (tagTypeCounts[type][tag.name] || 0) + 1;
    });
  });

  if (Object.keys(tagTypeCounts).length === 0) {
    return null; // Return nothing if there are no tags
  }

  const sortedTagTypes = Object.entries(tagTypeCounts).sort(([typeA], [typeB]) =>
    typeA.localeCompare(typeB),
  );

  return (
    <div className="grid gap-2.5 xl:grid-cols-2">
      {sortedTagTypes.map(([type, tags]) => {
        const sortedTags = Object.entries(tags).sort(
          ([nameA, countA], [nameB, countB]) => countB - countA || nameA.localeCompare(nameB),
        );

        return (
          <div
            key={type}
            className="rounded-[calc(var(--app-radius-md)+0.125rem)] border border-border/60 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.98)_0%,hsl(var(--app-surface-2)/0.76)_100%)] px-3 py-3 shadow-sm"
          >
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <span className="inline-flex items-center rounded-full border border-primary/16 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                {type}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {sortedTags.length} tags
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sortedTags.map(([name, count]) => (
                <Badge
                  key={name}
                  variant="outline"
                  className="border-border/70 bg-background/92 font-medium text-[11px] text-foreground shadow-sm"
                >
                  {name}
                  <span className="ml-1.5 inline-flex min-w-[1.45rem] items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    {count}
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
