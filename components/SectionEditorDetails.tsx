'use client';

import { SectionTagSummary } from '@/components/SectionTagSummary';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Section {
  id: string;
  name: string;
  description: string;
  instructions: string;
  defaultMarks: number | undefined;
  defaultNegativeMarks: number | undefined;
  questions: any[];
}

export function SectionEditorDetails({
  section,
  onUpdate,
}: {
  section: Section;
  onUpdate: (field: string, value: any) => void;
}) {
  const hasQuestionTags = section.questions.some(
    (question) => Array.isArray(question?.question?.tags) && question.question.tags.length > 0,
  );

  return (
    <div className="relative overflow-hidden rounded-[calc(var(--app-radius-lg)+0.125rem)] border border-border/60 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.98)_0%,hsl(var(--app-surface-tint)/0.24)_100%)] p-3.5 shadow-[0_18px_34px_-30px_hsl(var(--app-shadow-deep)/0.14)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />

      <div className="grid gap-3.5 xl:grid-cols-2">
        <div className="rounded-[calc(var(--app-radius-md)+0.125rem)] border border-border/60 bg-background/90 p-3.5 shadow-sm">
          <Label className="app-field-label">Overview</Label>
          <Textarea
            value={section.description}
            onChange={(event) => onUpdate('description', event.target.value)}
            placeholder="Add a short overview for this section"
            className="mt-2.5 min-h-[108px] border-border/70 bg-[hsl(var(--app-surface-1)/0.98)] shadow-none"
            rows={3}
          />
        </div>

        <div className="rounded-[calc(var(--app-radius-md)+0.125rem)] border border-border/60 bg-background/90 p-3.5 shadow-sm">
          <Label className="app-field-label">Student Instructions</Label>
          <Textarea
            value={section.instructions}
            onChange={(event) => onUpdate('instructions', event.target.value)}
            placeholder="Add student-facing instructions for this section"
            className="mt-2.5 min-h-[108px] border-border/70 bg-[hsl(var(--app-surface-1)/0.98)] shadow-none"
            rows={3}
          />
        </div>
      </div>

      {hasQuestionTags ? (
        <div className="mt-3.5 rounded-[calc(var(--app-radius-lg)-0.05rem)] border border-primary/14 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.98)_0%,hsl(var(--app-surface-2)/0.78)_100%)] px-3.5 py-3.5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Tag Mix
            </p>
            <span className="inline-flex items-center rounded-full border border-border/60 bg-background/88 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
              {section.questions.length} linked prompts
            </span>
          </div>
          <div className="mt-3">
            <SectionTagSummary section={section} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
