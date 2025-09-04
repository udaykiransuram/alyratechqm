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
  availableQuestions,
}: QuestionFilterPopupProps) {
  const handleToggleQuestion = (id: string | number) => {
    setSelectedQuestionIds(
      selectedQuestionIds.includes(id)
        ? selectedQuestionIds.filter(i => i !== id)
        : [...selectedQuestionIds, id]
    );
  };

  const allQuestionsToShow = modalAvailableQuestions;
  const disableClassSubject = selectedQuestionIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[95vw] h-[90vh] flex flex-col p-0"
        onInteractOutside={e => {
          if (
            (e.target as HTMLElement).closest('.tag-popover-content') ||
            (e.target as HTMLElement).closest('[data-tag-popover]')
          ) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="p-6 pb-4 border-b bg-muted/50">
          <DialogTitle className="text-2xl">Add Questions to Section</DialogTitle>
          <DialogDescription>
            Filter and select questions from the available list.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1 overflow-hidden p-6 bg-background">
          <aside className="md:col-span-1 flex flex-col gap-6 border-r pr-6 overflow-y-auto">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Filters</h3>
              <p className="text-sm text-muted-foreground">Refine the question list.</p>
            </div>
            <Input
              type="text"
              value={modalSearch}
              onChange={e => setModalSearch(e.target.value)}
              placeholder="Search by content..."
              className="mb-2"
            />
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
              disableClassSubject={disableClassSubject} // <-- Only disables class/subject filters
            />
            {selectedQuestionIds.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Deselect all questions to change class or subject.
              </p>
            )}
          </aside>

          <main className="md:col-span-3 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Available Questions <span className="text-muted-foreground">({modalAvailableQuestions.length})</span>
              </h3>
              <span className="text-sm text-muted-foreground">
                {selectedQuestionIds.length} selected
              </span>
            </div>
            <div className="flex items-center mb-2">
              {/*
                The Checkbox component does not support the 'indeterminate' prop directly.
                Use a ref to set the indeterminate property on the underlying input element.
              */}
              <Checkbox
                id="select-all-questions"
                checked={selectedQuestionIds.length === allQuestionsToShow.length && allQuestionsToShow.length > 0}
                onCheckedChange={checked => {
                  if (checked) {
                    setSelectedQuestionIds(allQuestionsToShow.map(q => q._id));
                  } else {
                    setSelectedQuestionIds([]);
                  }
                }}
                className="mr-2"
                ref={el => {
                  if (el) {
                    const input = el.querySelector('input[type="checkbox"]');
                    if (input) {
                      (input as HTMLInputElement).indeterminate = selectedQuestionIds.length > 0 && selectedQuestionIds.length < allQuestionsToShow.length;
                    }
                  }
                }}
              />
              <label htmlFor="select-all-questions" className="text-sm cursor-pointer select-none">
                Select All
              </label>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
              {loadingQuestions ? (
                <div className="flex items-center justify-center h-full"><Spinner /></div>
              ) : modalAvailableQuestions.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                  <p>No questions found for the selected filters.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allQuestionsToShow.map(q => (
                    <div
                      key={q._id}
                      onClick={() => handleToggleQuestion(q._id)}
                      className={`flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-colors
                        ${selectedQuestionIds.includes(q._id)
                          ? 'bg-accent border-primary ring-2 ring-primary/30'
                          : 'hover:bg-muted/40'}
                      `}
                      data-state={selectedQuestionIds.includes(q._id) ? 'checked' : 'unchecked'}
                    >
                      <Checkbox
                        id={`q-select-${q._id}`}
                        checked={selectedQuestionIds.includes(q._id)}
                        className="mt-1"
                        aria-label={`Select question ${q._id}`}
                        tabIndex={-1}
                      />
                      <div className="flex-1">
                        <QuestionItem
                          question={q}
                          onDelete={() => {}}
                          isDeleting={false}
                          classes={classes}
                          subjects={subjects}
                          allTags={allTags.map(tag => ({
                            ...tag,
                            type: {
                              _id: (tag.type as any)._id ?? '',
                              name: tag.type.name
                            }
                          }))}
                          onSave={handleEditQuestionSave}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
        <DialogFooter className="p-4 border-t bg-muted/50">
          <span className="mr-auto text-sm text-muted-foreground">
            {selectedQuestionIds.length} question(s) selected
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirmQuestions}>
            Add Selected Questions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}