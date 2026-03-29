import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function OptionTagModal({
  isOpen,
  onClose,
  option,
  tag,
  isCorrect,
  students,
}: {
  isOpen: boolean;
  onClose: () => void;
  option: string;
  tag: string;
  isCorrect: boolean;
  students: { name: string; rollNumber: string }[];
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>
            {option}: {tag}
          </DialogTitle>
          <DialogDescription>
            {isCorrect ? 'Correct' : 'Incorrect'} option-tag selections for this group.
          </DialogDescription>
        </DialogHeader>

        <div className="analytics-dialog-panel">
          <div className="analytics-dialog-stat-strip">
            <span className={`analytics-badge ${isCorrect ? 'analytics-badge-success' : 'analytics-badge-danger'}`}>
              {isCorrect ? 'Correct' : 'Incorrect'}
            </span>
            <span className="analytics-badge border-border/60 bg-background text-foreground">
              {students.length} student{students.length === 1 ? '' : 's'}
            </span>
          </div>

          {students.length > 0 ? (
            <ul className="analytics-dialog-list text-sm text-foreground">
              {students.map((student, index) => (
                <li
                  key={`${student.rollNumber}-${student.name}-${index}`}
                  className="analytics-dialog-list-item"
                >
                  <span className="font-medium">{student.name}</span>
                  <span className="text-muted-foreground">{student.rollNumber}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="app-empty-state py-8">No students recorded for this option tag.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
