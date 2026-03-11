import type { Dispatch, SetStateAction, MouseEvent } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MetadataSelector } from '@/components/MetadataSelector';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Checkbox } from '@/components/ui/checkbox';
import { QuestionItem } from '@/components/question-items';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

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
  const allQuestionsToShow = modalAvailableQuestions;
  const disableClassSubject = selectedQuestionIds.length > 0;
  const selectedCount = selectedQuestionIds.length;
  const hasActiveFilters = modalSearch.trim().length > 0 || selectedTags.length > 0;
  const canShowSelectionControls = !loadingQuestions && allQuestionsToShow.length > 0;
  const hasClassAndSubject = Boolean(String(classId || '').trim() && String(subjectId || '').trim());

  const handleToggleQuestion = (id: string | number) => {
    setSelectedQuestionIds(
      selectedQuestionIds.includes(id)
        ? selectedQuestionIds.filter((item) => item !== id)
        : [...selectedQuestionIds, id],
    );
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
                  <p className="text-sm text-muted-foreground">Choose the paper scope, then refine by tags or search.</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
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
                disableClassSubject={disableClassSubject}
              />

              <div className="app-field-group">
                <Label className="app-field-label">Tag Match</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={questionTagMatchMode === 'any' ? 'default' : 'outline'}
                    className="h-9 w-full"
                    onClick={() => setQuestionTagMatchMode('any')}
                    disabled={selectedTags.length === 0}
                  >
                    Any Tag
                  </Button>
                  <Button
                    type="button"
                    variant={questionTagMatchMode === 'all' ? 'default' : 'outline'}
                    className="h-9 w-full"
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

              {selectedCount > 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Clear the current selection before changing class or subject.
                </div>
              ) : null}
            </div>
          </aside>

          <main className="app-surface flex min-h-0 min-w-0 flex-col overflow-hidden shadow-none">
            <div className="app-section-header py-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground">
                    Available Questions <span className="text-muted-foreground">({allQuestionsToShow.length})</span>
                  </h3>
                  <p className="text-sm text-muted-foreground">Review the matches and select the questions to add.</p>
                </div>
                <span className="inline-flex w-fit rounded-full border border-border/60 bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {selectedCount} selected
                </span>
              </div>
            </div>

            {canShowSelectionControls ? (
              <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/10 px-4 py-2.5 text-sm sm:px-5">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all-questions"
                    checked={selectedCount === allQuestionsToShow.length && allQuestionsToShow.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedQuestionIds(allQuestionsToShow.map((question) => question._id));
                      } else {
                        setSelectedQuestionIds([]);
                      }
                    }}
                    ref={(element) => {
                      if (element) {
                        const input = element.querySelector('input[type="checkbox"]');
                        if (input) {
                          (input as HTMLInputElement).indeterminate =
                            selectedCount > 0 && selectedCount < allQuestionsToShow.length;
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
              ) : !hasClassAndSubject ? (
                <div className="app-empty-state flex h-full min-h-[280px] items-center justify-center text-center">
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">Select class and subject to load questions.</p>
                    <p className="text-sm text-muted-foreground">
                      Pick the paper class and subject first, then refine with tags or search.
                    </p>
                  </div>
                </div>
              ) : allQuestionsToShow.length === 0 ? (
                <div className="app-empty-state flex h-full min-h-[280px] items-center justify-center text-center">
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">No questions found.</p>
                    <p className="text-sm text-muted-foreground">
                      Try clearing some filters or add more questions to this class and subject.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {allQuestionsToShow.map((question) => {
                    const isSelected = selectedQuestionIds.includes(question._id);

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
                              allTags={allTags.map((tag) => ({
                                ...tag,
                                type: {
                                  _id: (tag.type as any)?._id ?? '',
                                  name: (tag.type as any)?.name ?? '',
                                },
                              }))}
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
