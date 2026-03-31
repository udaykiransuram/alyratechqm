'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Trash2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function SectionEditorDetailsLoadingState() {
  return (
    <div className="space-y-3.5 border-t border-border/60 pt-3.5">
      <div className="h-20 animate-pulse rounded-2xl bg-muted/70" />
      <div className="h-24 animate-pulse rounded-2xl bg-muted/70" />
      <div className="h-12 animate-pulse rounded-2xl bg-muted/50" />
    </div>
  );
}

const SectionEditorDetails = dynamic(
  () =>
    import('@/components/SectionEditorDetails').then(
      (module) => module.SectionEditorDetails,
    ),
  {
    loading: () => <SectionEditorDetailsLoadingState />,
  },
);

interface Section {
  id: string;
  name: string;
  description: string;
  instructions: string;
  defaultMarks: number | undefined;
  defaultNegativeMarks: number | undefined;
  questions: any[];
}

export function SectionEditor({
  section,
  onUpdate,
  onRemove,
  onAddQuestions,
  canAddQuestions,
  sectionTotalMarks,
  children,
}: {
  section: Section;
  onUpdate: (field: string, value: any) => void;
  onRemove: () => void;
  onAddQuestions: () => void;
  canAddQuestions: boolean;
  sectionTotalMarks: number;
  children?: React.ReactNode;
}) {
  const [showDetails, setShowDetails] = useState(
    Boolean(section.description?.trim() || section.instructions?.trim()),
  );

  useEffect(() => {
    if (section.description?.trim() || section.instructions?.trim()) {
      setShowDetails(true);
    }
  }, [section.description, section.instructions]);

  const sectionNameInputId = `section-name-${section.id}`;
  const hasDetailsContent = Boolean(
    section.description?.trim() || section.instructions?.trim(),
  );
  const detailsStatusLabel = hasDetailsContent ? 'Added' : 'Optional';
  const detailToggleClasses = cn(
    "h-8 w-fit rounded-full px-3 text-[11px] font-semibold shadow-sm",
    showDetails
      ? "border-primary/18 bg-primary/10 text-primary hover:bg-primary/12"
      : "border-border/60 bg-background/88 hover:bg-background",
  );

  return (
    <>
      <div className="relative space-y-4 border-b border-border/60 bg-[linear-gradient(145deg,hsl(var(--app-surface-tint)/0.5)_0%,hsl(var(--app-surface-1)/0.995)_42%,hsl(var(--app-surface-2)/0.92)_100%)] px-4 py-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="pointer-events-none absolute -right-12 top-0 h-24 w-24 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-20 w-20 rounded-full bg-primary/6 blur-3xl" />
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.92fr)] xl:items-start">
          <div className="min-w-0 rounded-[calc(var(--app-radius-lg)+0.125rem)] border border-border/60 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.99)_0%,hsl(var(--app-surface-2)/0.82)_100%)] p-3.5 shadow-[0_18px_30px_-26px_hsl(var(--app-shadow-deep)/0.14)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Label
                htmlFor={sectionNameInputId}
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                Section Name
              </Label>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-border/60 bg-background/88 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
                  {section.questions.length}{' '}
                  {section.questions.length === 1 ? 'Question' : 'Questions'}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-2xl border border-border/60 bg-background/88 shadow-sm hover:bg-background"
                  onClick={onRemove}
                  aria-label="Remove section"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            <Input
              id={sectionNameInputId}
              value={section.name}
              onChange={(event) => onUpdate('name', event.target.value)}
              className="mt-2.5 h-11 border-border/70 bg-background/96 text-base font-semibold shadow-none"
              aria-label="Section name"
              placeholder="Untitled Section"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-border/60 bg-background/88 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
                Defaults: +{section.defaultMarks ?? 0} / -{section.defaultNegativeMarks ?? 0}
              </span>
              <span className="inline-flex items-center rounded-full border border-primary/16 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm">
                {sectionTotalMarks} total marks
              </span>
            </div>
          </div>

          <div className="rounded-[calc(var(--app-radius-lg)+0.125rem)] border border-border/60 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.98)_0%,hsl(var(--app-surface-2)/0.8)_100%)] px-3 py-3 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Defaults & Details
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={detailToggleClasses}
                onClick={() => setShowDetails((current) => !current)}
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </Button>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div className="flex min-h-[84px] flex-col justify-between rounded-[calc(var(--app-radius-lg)-0.05rem)] border border-primary/14 bg-primary/5 p-2.5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Total Marks
                </p>
                <p className="text-base font-semibold tracking-[-0.03em] text-primary">
                  {sectionTotalMarks}
                </p>
              </div>
              <div className="flex min-h-[84px] flex-col justify-between rounded-[calc(var(--app-radius-lg)-0.05rem)] border border-border/60 bg-background/88 p-2.5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Notes
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {detailsStatusLabel}
                </p>
              </div>

              <div className="flex min-h-[84px] flex-col justify-between rounded-[calc(var(--app-radius-lg)-0.05rem)] border border-primary/14 bg-primary/5 p-2.5 shadow-sm">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Default Positive
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={section.defaultMarks ?? ''}
                  onChange={(event) =>
                    onUpdate(
                      'defaultMarks',
                      event.target.value === ''
                        ? undefined
                        : Number(event.target.value),
                    )
                  }
                  className="mt-2 h-9 w-full border-border/70 bg-background shadow-none"
                  aria-label="Default marks"
                  required
                />
              </div>
              <div className="flex min-h-[84px] flex-col justify-between rounded-[calc(var(--app-radius-lg)-0.05rem)] border border-border/60 bg-background/88 p-2.5 shadow-sm">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Default Negative
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={section.defaultNegativeMarks ?? ''}
                  onChange={(event) =>
                    onUpdate(
                      'defaultNegativeMarks',
                      event.target.value === ''
                        ? undefined
                        : Number(event.target.value),
                    )
                  }
                  className="mt-2 h-9 w-full border-border/70 bg-background shadow-none"
                  aria-label="Default negative marks"
                />
              </div>
            </div>
          </div>
        </div>

        {showDetails ? (
          <SectionEditorDetails section={section} onUpdate={onUpdate} />
        ) : null}
      </div>

      <div className="space-y-4 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.88)_0%,hsl(var(--app-surface-2)/0.56)_100%)] px-4 py-4">
        {children}
        <div className="flex flex-col gap-3 rounded-[calc(var(--app-radius-lg)+0.125rem)] border border-border/60 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.98)_0%,hsl(var(--app-surface-2)/0.78)_100%)] px-3.5 py-3 shadow-sm sm:flex-row sm:items-center">
          <Button
            variant={canAddQuestions ? 'default' : 'outline'}
            className="app-button-inline shadow-sm"
            onClick={onAddQuestions}
            disabled={!canAddQuestions}
          >
            <Plus className="h-4 w-4" />
            Add / Manage Questions
          </Button>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm",
              canAddQuestions
                ? "border-emerald-300/55 bg-emerald-50 text-emerald-800 dark:border-emerald-700/45 dark:bg-emerald-950/35 dark:text-emerald-200"
                : "border-amber-300/55 bg-amber-50 text-amber-800 dark:border-amber-700/45 dark:bg-amber-950/35 dark:text-amber-200",
            )}
          >
            {canAddQuestions ? 'Ready for question selection' : 'Complete setup first'}
          </span>
          <span className="sm:ml-auto inline-flex items-center rounded-full border border-primary/16 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
            Section Total: {sectionTotalMarks} Marks
          </span>
        </div>
      </div>
    </>
  );
}
