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

  return (
    <div className="space-y-1.5">
      {Object.entries(tagTypeCounts).map(([type, tags]) => (
        <div key={type} className="flex items-baseline gap-2">
          <p className="text-xs font-medium text-muted-foreground whitespace-nowrap">{type}:</p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(tags).map(([name, count]) => (
              <Badge key={name} variant="outline" className="font-normal text-xs">
                {name}
                <span className="ml-1.5 font-mono text-[10px] bg-muted text-muted-foreground rounded-full px-1">
                  {count}
                </span>
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}