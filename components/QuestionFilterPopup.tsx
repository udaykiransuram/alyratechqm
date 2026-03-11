import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { MetadataSelector } from '@/components/MetadataSelector';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Checkbox } from '@/components/ui/checkbox';
import { QuestionItem } from '@/components/question-items';
import { Button } from '@/components/ui/button';

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
  initialDataLoading: boolean;
  modalSearch: string;
  setModalSearch: (search: string) => void;
  loadingQuestions: boolean;
  modalAvailableQuestions: any[];
  selectedQuestionIds: (string | number)[];
  setSelectedQuestionIds: React.Dispatch<React.SetStateAction<(string | number)[]>>;
  handleConfirmQuestions: () => void;
  toast: any;
  handleEditQuestionSave: (updated: any) => Promise<void>;
  availableQuestions: any[];
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
  const handleToggleQuestion = (id: string | number) => {
    setSelectedQuestionIds(
      selectedQuestionIds.includes(id)
        ? selectedQuestionIds.filter((item) => item !== id)
        : [...selectedQuestionIds, id],
    );
  };

  const allQuestionsToShow = modalAvailableQuestions;
  const disableClassSubject = selectedQuestionIds.length > 0;
  const selectedCount = selectedQuestionIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[100dvh] overflow-hidden p-0 sm:h-[90vh] sm:max-w-[min(96vw,1280px)]"
        onInteractOutside={(event) => {
          if (
            (event.target as HTMLElement).closest('.tag-popover-content') ||
            (event.target as HTMLElement).closest('[data-tag-popover]')
          ) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader className="border-b border-border/60 bg-muted/20 px-6 py-5 text-left">
          <DialogTitle className="text-xl">Add Questions to Section</DialogTitle>
          <DialogDescription>
            Filter the bank, review the matches, and add the questions you want in one pass.
          </DialogDescription>
        </DialogHeader>

        <div className="grid flex-1 grid-cols-1 gap-6 overflow-hidden bg-background p-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto pr-1">
            <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/10 p-4">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">Filters</h3>
                <p className="text-sm text-muted-foreground">
                  Narrow the question bank before selecting items for this section.
                </p>
              </div>

              <div className="app-field-group">
                <label htmlFor="question-filter-search" className="app-field-label">
                  Search Content
                </label>
                <Input
                  id="question-filter-search"
                  type="text"
                  value={modalSearch}
                  onChange={(event) => setModalSearch(event.target.value)}
                  placeholder="Search by content..."
                />
              </div>

              <MetadataSelector
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

              {selectedCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Clear the current selection before changing class or subject.
                </p>
              ) : null}
            </div>
          </aside>

          <main className="app-surface flex min-h-0 flex-col overflow-hidden shadow-none">
            <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Available Questions <span className="text-muted-foreground">({modalAvailableQuestions.length})</span>
                </h3>
                <p className="text-sm text-muted-foreground">
                  Review the filtered results and select the questions to add.
                </p>
              </div>
              <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
            </div>

            <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3 text-sm">
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
              <label htmlFor="select-all-questions" className="cursor-pointer select-none text-sm font-medium text-foreground">
                Select All
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {loadingQuestions ? (
                <div className="app-empty-state flex h-full items-center justify-center">
                  <div className="app-status-row">
                    <Spinner />
                    <span>Loading questions...</span>
                  </div>
                </div>
              ) : modalAvailableQuestions.length === 0 ? (
                <div className="app-empty-state flex h-full items-center justify-center">
                  <p>No questions found for the selected filters.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allQuestionsToShow.map((question) => {
                    const isSelected = selectedQuestionIds.includes(question._id);
                    return (
                      <div
                        key={question._id}
                        onClick={() => handleToggleQuestion(question._id)}
                        className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors ${
                          isSelected
                            ? 'border-primary bg-accent ring-2 ring-primary/20'
                            : 'border-border/60 bg-muted/10 hover:bg-muted/20'
                        }`}
                        data-state={isSelected ? 'checked' : 'unchecked'}
                      >
                        <Checkbox
                          id={`q-select-${question._id}`}
                          checked={isSelected}
                          className="mt-1"
                          aria-label={`Select question ${question._id}`}
                          tabIndex={-1}
                        />
                        <div className="min-w-0 flex-1">
                          <QuestionItem
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
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>

        <DialogFooter className="border-t border-border/60 bg-muted/10 px-6 py-4">
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
