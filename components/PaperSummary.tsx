import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { Layers, ListOrdered, Clock, Award, CalendarDays, Hash, CheckCircle, Tag as TagIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Tag {
  _id: string;
  name: string;
  type?: { name: string };
}

interface Section {
  id: string;
  name: string;
  defaultMarks: number | undefined;
  defaultNegativeMarks: number | undefined;
  questions: {
    question: {
      tags?: Tag[];
    };
    marks: number;
    negativeMarks: number;
  }[];
}

export function PaperSummary({ sections, totalPaperMarks, duration, passingMarks, examDate }: {
  sections: Section[];
  totalPaperMarks: number;
  duration: number;
  passingMarks: number;
  examDate: string;
}) {
  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);

  // Aggregate all tags and their counts across the paper
  const tagTypeCounts: Record<string, Record<string, number>> = {};
  sections.forEach(section => {
    section.questions.forEach(q => {
      (q.question.tags ?? []).forEach(tag => {
        const type = tag.type?.name || 'Other';
        if (!tagTypeCounts[type]) tagTypeCounts[type] = {};
        tagTypeCounts[type][tag.name] = (tagTypeCounts[type][tag.name] || 0) + 1;
      });
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <CheckCircle className="w-5 h-5 text-primary" /> Paper Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">Total Marks:</span> {totalPaperMarks}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">Duration:</span> {duration} min
          </div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">Sections:</span> {sections.length}
          </div>
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">Questions:</span> {totalQuestions}
          </div>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">Passing:</span> {passingMarks}
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">Date:</span> {examDate ? format(new Date(examDate), 'PPP') : '-'}
          </div>
        </div>
        {/* Tag Summary for the whole paper */}
        <div className="pt-4 border-t">
          <h4 className="font-semibold mb-2 text-sm text-foreground flex items-center gap-2">
            <TagIcon className="w-4 h-4" /> Tag Summary
          </h4>
          {Object.keys(tagTypeCounts).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(tagTypeCounts).map(([type, tags]) => (
                <div key={type}>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{type}</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(tags).map(([name, count]) => (
                      <Badge key={name} variant="secondary" className="font-normal">
                        {name}
                        <span className="ml-1 px-1 py-0.5 rounded-full bg-background text-foreground text-xs font-mono">
                          {count}
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No tags in this paper.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}