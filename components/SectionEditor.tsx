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
  const setupStatusLabel = canAddQuestions ? 'Ready for questions' : 'Needs name + marks';
  const questionCountLabel = `${section.questions.length} ${
    section.questions.length === 1 ? 'question' : 'questions'
  }`;
  const hasQuestions = section.questions.length > 0;

  return (
    <>
      <div className="space-y-3 border-b border-border/60 bg-[hsl(var(--app-surface-1)/0.95)] px-3.5 py-3.5">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-start">
          <div className="min-w-0 rounded-[calc(var(--app-radius-lg)+0.125rem)] border border-border/60 bg-[hsl(var(--app-surface-1)/0.96)] p-3.5 shadow-[0_12px_24px_-24px_hsl(var(--app-shadow-deep)/0.08)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Required Setup
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  canAddQuestions
                    ? "border-emerald-300/55 bg-emerald-50 text-emerald-800 dark:border-emerald-700/45 dark:bg-emerald-950/35 dark:text-emerald-200"
                    : "border-amber-300/55 bg-amber-50 text-amber-800 dark:border-amber-700/45 dark:bg-amber-950/35 dark:text-amber-200",
                )}
              >
                {setupStatusLabel}
              </span>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_132px_132px]">
              <div className="space-y-1.5">
                <Label
                  htmlFor={sectionNameInputId}
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Section Name
                </Label>
                <Input
                  id={sectionNameInputId}
                  value={section.name}
                  onChange={(event) => onUpdate('name', event.target.value)}
                  className="h-11 border-border/70 bg-background/96 text-base font-semibold shadow-none"
                  aria-label="Section name"
                  placeholder="Untitled Section"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  + Marks
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
                  className="h-11 border-border/70 bg-background shadow-none"
                  aria-label="Default marks"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  - Marks
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
                  className="h-11 border-border/70 bg-background shadow-none"
                  aria-label="Default negative marks"
                />
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Set the section name and default marking first. Notes can stay optional until you need them.
            </p>
          </div>

          <div className="rounded-[calc(var(--app-radius-lg)+0.125rem)] border border-border/60 bg-[hsl(var(--app-surface-1)/0.94)] p-3.5 shadow-[0_10px_22px_-24px_hsl(var(--app-shadow-deep)/0.07)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  At a Glance
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                  {sectionTotalMarks}
                </p>
                <p className="text-xs text-muted-foreground">section marks</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full border border-border/60 bg-background/92 shadow-none hover:bg-background"
                onClick={onRemove}
                aria-label="Remove section"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border/60 bg-background/92 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                {questionCountLabel}
              </span>
              <span className="rounded-full border border-border/60 bg-background/92 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                Notes {detailsStatusLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-[calc(var(--app-radius-lg)+0.05rem)] border border-border/60 bg-background/84 px-3.5 py-2.5 sm:flex-row sm:items-center">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground">Optional notes</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Add an overview or student instructions only if this section needs extra context.
            </p>
          </div>
          <Button
            type="button"
            variant={showDetails ? 'secondary' : 'outline'}
            size="sm"
            className="sm:ml-auto"
            onClick={() => setShowDetails((current) => !current)}
          >
            {showDetails ? 'Hide notes' : 'Add notes'}
          </Button>
        </div>

        {showDetails ? <SectionEditorDetails section={section} onUpdate={onUpdate} /> : null}
      </div>

      <div className="space-y-3.5 bg-[hsl(var(--app-surface-1)/0.94)] px-3.5 py-3.5">
        {children}
        <div className="flex flex-col gap-3 rounded-[calc(var(--app-radius-lg)+0.125rem)] border border-border/60 bg-[hsl(var(--app-surface-1)/0.96)] px-3.5 py-3 shadow-[0_10px_22px_-24px_hsl(var(--app-shadow-deep)/0.07)] sm:flex-row sm:items-center">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground">Questions in this section</p>
            <p className="text-xs leading-5 text-muted-foreground">
              {canAddQuestions
                ? 'Add prompts, review their order, and adjust marks here.'
                : 'Finish the section name and defaults above before adding questions.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm",
                canAddQuestions
                  ? "border-emerald-300/55 bg-emerald-50 text-emerald-800 dark:border-emerald-700/45 dark:bg-emerald-950/35 dark:text-emerald-200"
                  : "border-amber-300/55 bg-amber-50 text-amber-800 dark:border-amber-700/45 dark:bg-amber-950/35 dark:text-amber-200",
              )}
            >
              {canAddQuestions ? 'Ready' : 'Setup first'}
            </span>
            <Button
              variant={canAddQuestions ? 'default' : 'outline'}
              className="app-button-inline shadow-sm"
              onClick={onAddQuestions}
              disabled={!canAddQuestions}
            >
              <Plus className="h-4 w-4" />
              {hasQuestions ? 'Manage Questions' : 'Add Questions'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
