import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { Dispatch, SetStateAction, MouseEvent } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function MetadataSelectorLoadingState() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded-xl bg-muted/70" />
        </div>
      ))}
    </div>
  );
}

function QuestionCardLoadingState() {
  return (
    <div className="rounded-2xl border border-border/60 bg-background p-4 shadow-none">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-muted/60" />
      </div>
    </div>
  );
}

const MetadataSelector = dynamic(
  () =>
    import('@/components/MetadataSelector').then(
      (module) => module.MetadataSelector,
    ),
  {
    loading: () => <MetadataSelectorLoadingState />,
  },
);

const QuestionItem = dynamic(
  () =>
    import('@/components/question-items').then((module) => module.QuestionItem),
  {
    loading: () => <QuestionCardLoadingState />,
  },
);

type QuestionFilterPopupProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: any[];
  classId: string | number;
  setClassId: (id: string | number) => void;
  subjects: any[];
  subjectId: string | number;
  setSubjectId: (id: string | number) => void;
  subjectsLoading: boolean;
  allTags: any[];
  selectedTags: any[];
  setSelectedTags: (tags: any[]) => void;
  questionTagMatchMode: 'any' | 'all';
  setQuestionTagMatchMode: Dispatch<SetStateAction<'any' | 'all'>>;
  initialDataLoading: boolean;
  modalSearch: string;
  setModalSearch: (search: string) => void;
  loadingQuestions: boolean;
  modalAvailableQuestions: any[];
  selectedQuestionIds: (string | number)[];
  setSelectedQuestionIds: Dispatch<SetStateAction<(string | number)[]>>;
  handleConfirmQuestions: () => void;
  toast: any;
  handleEditQuestionSave: (updated: any) => Promise<void>;
};

export function QuestionFilterPopup({
  open,
  onOpenChange,
  classes,
  classId,
  setClassId,
  subjects,
  subjectId,
  setSubjectId,
  subjectsLoading,
  allTags,
  selectedTags,
  setSelectedTags,
  questionTagMatchMode,
  setQuestionTagMatchMode,
  initialDataLoading,
  modalSearch,
  setModalSearch,
  loadingQuestions,
  modalAvailableQuestions,
  selectedQuestionIds,
  setSelectedQuestionIds,
  handleConfirmQuestions,
  toast,
  handleEditQuestionSave,
}: QuestionFilterPopupProps) {
  const normalizedAllTags = useMemo(
    () =>
      allTags.map((tag) => ({
        ...tag,
        type: {
          _id: (tag.type as any)?._id ?? '',
          name: (tag.type as any)?.name ?? '',
        },
      })),
    [allTags],
  );
  const allQuestionsToShow = modalAvailableQuestions;
  const normalizeQuestionId = (id: string | number) => String(id);
  const selectedQuestionIdSet = new Set(selectedQuestionIds.map((id) => normalizeQuestionId(id)));
  const visibleQuestionIds = allQuestionsToShow.map((question) => normalizeQuestionId(question._id));
  const visibleQuestionIdSet = new Set(visibleQuestionIds);
  const visibleSelectedCount = visibleQuestionIds.filter((id) =>
    selectedQuestionIdSet.has(id),
  ).length;
  const selectedCount = selectedQuestionIds.length;
  const hiddenSelectedCount = Math.max(selectedCount - visibleSelectedCount, 0);
  const hasActiveFilters =
    modalSearch.trim().length > 0 ||
    selectedTags.length > 0 ||
    String(classId) !== 'all' ||
    String(subjectId) !== 'all';
  const canShowSelectionControls = !loadingQuestions && allQuestionsToShow.length > 0;

  const handleToggleQuestion = (id: string | number) => {
    const normalizedId = normalizeQuestionId(id);
    setSelectedQuestionIds((currentIds) => {
      const currentIdSet = new Set(currentIds.map((item) => normalizeQuestionId(item)));
      if (currentIdSet.has(normalizedId)) {
        return currentIds.filter((item) => normalizeQuestionId(item) !== normalizedId);
      }

      return [...currentIds.map((item) => normalizeQuestionId(item)), normalizedId];
    });
  };

  const handleQuestionCardClick = (event: MouseEvent<HTMLDivElement>, id: string | number) => {
    const target = event.target as HTMLElement;
    if (target.closest('a, button, input, label, select, textarea')) {
      return;
    }

    handleToggleQuestion(id);
  };

  const handleClearFilters = () => {
    setModalSearch('');
    setSelectedTags([]);
    setQuestionTagMatchMode('any');
    setClassId('all');
    setSubjectId('all');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden p-0 sm:h-[min(92vh,860px)] sm:max-h-[min(92vh,860px)] sm:w-[min(96vw,1320px)] sm:max-w-[1320px]"
        onInteractOutside={(event) => {
          if (
            (event.target as HTMLElement).closest('.tag-popover-content') ||
            (event.target as HTMLElement).closest('[data-tag-popover]')
          ) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader className="border-b border-border/60 bg-muted/20 px-4 py-3.5 pr-12 text-left sm:px-5 sm:pr-14">
          <DialogTitle className="text-lg sm:text-xl">Add Questions to Section</DialogTitle>
          <DialogDescription>
            Filter the question bank, review the matches, and add them in one pass.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 bg-muted/20 p-3 sm:p-4 lg:grid-cols-[minmax(300px,320px)_minmax(0,1fr)]">
          <aside className="app-surface flex min-h-0 flex-col overflow-hidden shadow-none">
            <div className="app-section-header py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground">Question Bank Filters</h3>
                  <p className="text-sm text-muted-foreground">Class and subject filters are optional. You can browse across the whole bank, mix questions from different classes, and assign the final paper scope later.</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-xl px-2.5 text-xs"
                  onClick={handleClearFilters}
                  disabled={!hasActiveFilters}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="app-section-body min-h-0 space-y-3.5 overflow-y-auto">
              <div className="app-field-group">
                <Label htmlFor="question-filter-search" className="app-field-label">
                  Search Content
                </Label>
                <Input
                  id="question-filter-search"
                  type="text"
                  value={modalSearch}
                  onChange={(event) => setModalSearch(event.target.value)}
                  placeholder="Search by content..."
                />
              </div>

              <MetadataSelector
                variant="plain"
                contentClassName="space-y-3"
                classes={classes}
                classId={String(classId)}
                setClassId={setClassId}
                subjects={subjects}
                subjectId={String(subjectId)}
                setSubjectId={setSubjectId}
                subjectsLoading={subjectsLoading}
                allTags={allTags}
                selectedTags={selectedTags}
                setSelectedTags={setSelectedTags}
                recommendedTagIds={[]}
                initialDataLoading={initialDataLoading}
                resetCounter={0}
                toast={toast}
                onCreateNewTag={async () => null}
                allowAllClassOption
                allowAllSubjectOption
                allClassLabel="All question classes"
                allSubjectLabel="All subjects"
              />

              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Selected questions stay selected while you change class, subject, tag, or search filters.
              </div>

              <div className="app-field-group">
                <Label className="app-field-label">Tag Match</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={questionTagMatchMode === 'any' ? 'default' : 'outline'}
                    className="app-button-compact w-full"
                    onClick={() => setQuestionTagMatchMode('any')}
                    disabled={selectedTags.length === 0}
                  >
                    Any Tag
                  </Button>
                  <Button
                    type="button"
                    variant={questionTagMatchMode === 'all' ? 'default' : 'outline'}
                    className="app-button-compact w-full"
                    onClick={() => setQuestionTagMatchMode('all')}
                    disabled={selectedTags.length === 0}
                  >
                    All Tags
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedTags.length === 0
                    ? 'Select one or more tags to choose the match mode.'
                    : questionTagMatchMode === 'all'
                      ? 'Only questions containing every selected tag are shown.'
                      : 'Questions containing any selected tag are shown.'}
                </p>
              </div>

            </div>
          </aside>

          <main className="app-surface flex min-h-0 min-w-0 flex-col overflow-hidden shadow-none">
            <div className="app-section-header py-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground">
                    Available Questions <span className="text-muted-foreground">({allQuestionsToShow.length})</span>
                  </h3>
                  <p className="text-sm text-muted-foreground">Review the matches and select the questions to add. Selections from other filters stay queued until you confirm.</p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {selectedCount} selected
                  {hiddenSelectedCount > 0 ? ` • ${hiddenSelectedCount} outside current view` : ''}
                </span>
              </div>
            </div>

            {canShowSelectionControls ? (
              <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/10 px-4 py-2.5 text-sm sm:px-5">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all-questions"
                    checked={visibleSelectedCount === allQuestionsToShow.length && allQuestionsToShow.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedQuestionIds((currentIds) => {
                          const next = new Set(currentIds.map((id) => String(id)));
                          visibleQuestionIds.forEach((id) => next.add(id));
                          return Array.from(next);
                        });
                      } else {
                        setSelectedQuestionIds((currentIds) =>
                          currentIds.filter((id) => !visibleQuestionIdSet.has(String(id))),
                        );
                      }
                    }}
                    ref={(element) => {
                      if (element) {
                        const input = element.querySelector('input[type="checkbox"]');
                        if (input) {
                          (input as HTMLInputElement).indeterminate =
                            visibleSelectedCount > 0 &&
                            visibleSelectedCount < allQuestionsToShow.length;
                        }
                      }
                    }}
                  />
                  <label
                    htmlFor="select-all-questions"
                    className="cursor-pointer select-none text-sm font-medium text-foreground"
                  >
                    Select All
                  </label>
                </div>
                <span className="text-xs text-muted-foreground">{allQuestionsToShow.length} result(s)</span>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
              {loadingQuestions ? (
                <div className="app-empty-state flex h-full min-h-[280px] items-center justify-center">
                  <div className="app-status-row">
                    <Spinner />
                    <span>Loading questions...</span>
                  </div>
                </div>
              ) : allQuestionsToShow.length === 0 ? (
                <div className="app-empty-state flex h-full min-h-[280px] items-center justify-center text-center">
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">No questions found.</p>
                    <p className="text-sm text-muted-foreground">
                      Try clearing some filters, broadening the class or subject scope, or add more questions to the bank.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {allQuestionsToShow.map((question) => {
                    const isSelected = selectedQuestionIdSet.has(
                      normalizeQuestionId(question._id),
                    );

                    return (
                      <div
                        key={question._id}
                        onClick={(event) => handleQuestionCardClick(event, question._id)}
                        className={cn(
                          'rounded-2xl border border-transparent p-1 transition-all',
                          isSelected
                            ? 'bg-primary/5 ring-2 ring-primary/20'
                            : 'hover:border-border/40 hover:bg-muted/20',
                        )}
                        data-state={isSelected ? 'checked' : 'unchecked'}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={`q-select-${question._id}`}
                            checked={isSelected}
                            className="ml-3 mt-3 shrink-0"
                            aria-label={`Select question ${question._id}`}
                            onCheckedChange={() => handleToggleQuestion(question._id)}
                          />
                          <div className="min-w-0 flex-1 py-1 pr-1">
                            <QuestionItem
                              compact
                              className={cn(
                            'w-full border-border/50 bg-background shadow-none',
                            isSelected ? 'border-primary/60' : 'hover:border-border/60',
                          )}
                              question={question}
                              classes={classes}
                              subjects={subjects}
                              allTags={normalizedAllTags}
                              onSave={handleEditQuestionSave}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>

        <DialogFooter className="border-t border-border/60 bg-muted/10 px-4 py-3 sm:px-5">
          <span className="mr-auto text-left text-sm text-muted-foreground">
            {selectedCount} question(s) selected
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirmQuestions}>Add Selected Questions</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
