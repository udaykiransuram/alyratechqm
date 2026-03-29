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

function formatExamDate(value: string | null | undefined) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return format(date, 'PPP');
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return format(date, 'PPP p');
}

export function PaperSummary({ sections, totalPaperMarks, duration, passingMarks, examDate, onlineEnabled, onlineStartsAt, onlineEndsAt, subjects }: {
  sections: Section[];
  totalPaperMarks: number;
  duration: number;
  passingMarks: number;
  examDate: string;
  onlineEnabled: boolean;
  onlineStartsAt?: string | null;
  onlineEndsAt?: string | null;
  subjects?: Array<{ _id: string; name: string }>;
}) {
  const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0);

  const tagTypeCounts: Record<string, Record<string, number>> = {};
  sections.forEach(section => {
    section.questions.forEach(question => {
      (question.question.tags ?? []).forEach(tag => {
        const type = tag.type?.name || 'Other';
        if (!tagTypeCounts[type]) tagTypeCounts[type] = {};
        tagTypeCounts[type][tag.name] = (tagTypeCounts[type][tag.name] || 0) + 1;
      });
    });
  });

  const stats = [
    { label: 'Total Marks', value: totalPaperMarks, icon: ListOrdered },
    { label: 'Duration', value: `${duration} min`, icon: Clock },
    { label: 'Sections', value: sections.length, icon: Layers },
    { label: 'Questions', value: totalQuestions, icon: Hash },
    { label: 'Passing', value: passingMarks, icon: Award },
    { label: 'Date', value: formatExamDate(examDate), icon: CalendarDays },
  ];

  return (
    <Card className="app-surface overflow-hidden">
      <CardHeader className="app-section-header">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-primary" />
          Paper Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="app-section-body space-y-5">
        <div className="app-detail-grid">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="app-detail-item">
              <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4" />
                <span className="app-detail-label mb-0">{label}</span>
              </div>
              <div className="app-detail-value">{value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Delivery Mode
              </p>
              <p className="text-sm text-muted-foreground">
                {onlineEnabled
                  ? 'Online delivery enabled for student logins. Descriptive answers will still require manual review.'
                  : 'Offline/manual workflow only.'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Update these delivery settings in the Paper Details panel.
              </p>
            </div>
            <Badge variant={onlineEnabled ? 'default' : 'secondary'}>
              {onlineEnabled ? 'Online' : 'Offline'}
            </Badge>
          </div>

          {onlineEnabled ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Online Start
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {formatDateTime(onlineStartsAt || examDate)}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Online End
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {formatDateTime(onlineEndsAt)}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-3 border-t border-border/60 pt-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <TagIcon className="h-4 w-4" />
            Subject Mix
          </h4>
          {Array.isArray(subjects) && subjects.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {subjects.map((subject) => (
                <Badge key={subject._id} variant="secondary" className="font-normal">
                  {subject.name || subject._id}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Subjects will appear here once questions are added.
            </p>
          )}
        </div>

        <div className="space-y-3 border-t border-border/60 pt-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <TagIcon className="h-4 w-4" />
            Tag Summary
          </h4>
          {Object.keys(tagTypeCounts).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(tagTypeCounts).map(([type, tags]) => (
                <div key={type} className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {type}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(tags).map(([name, count]) => (
                      <Badge key={name} variant="secondary" className="font-normal">
                        {name}
                        <span className="ml-1 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-mono text-foreground">
                          {count}
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tags in this paper yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
