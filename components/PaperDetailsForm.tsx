import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import MultiSelectChecklist from '@/components/multi-select-checklist';
import { Checkbox } from '@/components/ui/checkbox';

interface AcademicSectionItem {
  _id: string;
  name: string;
}

export interface PaperDetailsFormProps {
  paperTitle: string;
  setPaperTitle: (v: string) => void;
  instructions: string;
  setInstructions: (v: string) => void;
  duration: number;
  setDuration: (v: number) => void;
  passingMarks: number;
  setPassingMarks: (v: number) => void;
  examDate: Date;
  setExamDate: (v: Date) => void;
  onlineEnabled: boolean;
  setOnlineEnabled: (v: boolean) => void;
  onlineStartsAt: Date | null;
  setOnlineStartsAt: (v: Date | null) => void;
  onlineEndsAt: Date | null;
  setOnlineEndsAt: (v: Date | null) => void;
  classId: string;
  setClassId: (v: string) => void;
  subjectId: string;
  setSubjectId: (v: string) => void;
  classes: any[];
  subjects: any[];
  availableAcademicSections: AcademicSectionItem[];
  assignedAcademicSectionIds: string[];
  setAssignedAcademicSectionIds: (ids: string[]) => void;
  compact?: boolean;
  initialDataLoading?: boolean;
}

function formatDateTimeLocal(value: Date | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localValue = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localValue.toISOString().slice(0, 16);
}

export function PaperDetailsForm({
  paperTitle,
  setPaperTitle,
  instructions,
  setInstructions,
  duration,
  setDuration,
  passingMarks,
  setPassingMarks,
  examDate,
  setExamDate,
  onlineEnabled,
  setOnlineEnabled,
  onlineStartsAt,
  setOnlineStartsAt,
  onlineEndsAt,
  setOnlineEndsAt,
  classId,
  setClassId,
  subjectId,
  setSubjectId,
  classes,
  subjects,
  availableAcademicSections,
  assignedAcademicSectionIds,
  setAssignedAcademicSectionIds,
  initialDataLoading,
}: PaperDetailsFormProps) {
  if (initialDataLoading) {
    return (
      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            Paper Details
          </CardTitle>
        </CardHeader>
        <CardContent className="app-section-body space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted/70" />
                <div className="h-10 w-full animate-pulse rounded-xl bg-muted/60" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-muted/70" />
            <div className="h-24 w-full animate-pulse rounded-2xl bg-muted/60" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted/70" />
            <div className="h-28 w-full animate-pulse rounded-2xl bg-muted/60" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="app-surface overflow-hidden">
      <CardHeader className="app-section-header">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4 text-primary" />
          Paper Details
        </CardTitle>
      </CardHeader>
      <CardContent className="app-section-body space-y-4">
        <div className="app-field-group">
          <Label htmlFor="paper-title" className="app-field-label">Paper Title</Label>
          <Input
            id="paper-title"
            value={paperTitle}
            onChange={e => setPaperTitle(e.target.value)}
            placeholder="e.g., Mid-Term Mathematics Test"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="app-field-group">
            <Label htmlFor="class" className="app-field-label">Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger id="class"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {classes.map(cls => (
                  <SelectItem key={cls._id} value={cls._id}>{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="app-field-group">
            <Label htmlFor="subject" className="app-field-label">Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger id="subject"><SelectValue placeholder="Select subject" /></SelectTrigger>
              <SelectContent>
                {subjects.map(sub => (
                  <SelectItem key={sub._id} value={sub._id}>{sub.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="app-field-group sm:col-span-2">
            <Label className="app-field-label">Assigned Class Sections</Label>
            {!classId ? (
              <div className="rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
                Select a class first to assign sections.
              </div>
            ) : availableAcademicSections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
                No sections for this class yet.
              </div>
            ) : (
              <MultiSelectChecklist
                items={availableAcademicSections.map((section) => ({
                  id: section._id,
                  label: section.name,
                }))}
                selectedIds={assignedAcademicSectionIds}
                onChange={setAssignedAcademicSectionIds}
              />
            )}
          </div>

          <div className="app-field-group">
            <Label htmlFor="examDate" className="app-field-label">Exam Date</Label>
            <Input
              id="examDate"
              type="date"
              value={examDate ? examDate.toISOString().slice(0, 10) : ''}
              onChange={e => setExamDate(new Date(e.target.value))}
            />
          </div>

          <div className="app-field-group">
            <Label htmlFor="duration" className="app-field-label">Duration (min)</Label>
            <Input
              id="duration"
              type="number"
              min={1}
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              placeholder="e.g., 60"
            />
          </div>

          <div className="app-field-group sm:col-span-2">
            <Label htmlFor="passingMarks" className="app-field-label">Passing Marks</Label>
            <Input
              id="passingMarks"
              type="number"
              min={0}
              value={passingMarks}
              onChange={e => setPassingMarks(Number(e.target.value))}
              placeholder="e.g., 33"
            />
          </div>

          <div className="app-field-group sm:col-span-2 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="onlineEnabled"
                checked={onlineEnabled}
                onCheckedChange={(checked) => setOnlineEnabled(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="onlineEnabled" className="app-field-label">
                  Enable Online Test Delivery
                </Label>
                <p className="text-sm text-muted-foreground">
                  Objective and matrix questions are auto-graded online.
                  Descriptive questions are allowed, but they still need manual review after submission.
                </p>
              </div>
            </div>

            {onlineEnabled ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="app-field-group">
                  <Label htmlFor="onlineStartsAt" className="app-field-label">
                    Online Start
                  </Label>
                  <Input
                    id="onlineStartsAt"
                    type="datetime-local"
                    value={formatDateTimeLocal(onlineStartsAt)}
                    onChange={e =>
                      setOnlineStartsAt(e.target.value ? new Date(e.target.value) : null)
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Leave blank to start from the paper exam date.
                  </p>
                </div>

                <div className="app-field-group">
                  <Label htmlFor="onlineEndsAt" className="app-field-label">
                    Online End
                  </Label>
                  <Input
                    id="onlineEndsAt"
                    type="datetime-local"
                    value={formatDateTimeLocal(onlineEndsAt)}
                    onChange={e =>
                      setOnlineEndsAt(e.target.value ? new Date(e.target.value) : null)
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Optional global cutoff. Student timers still respect the
                    paper duration.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="app-field-group">
          <Label htmlFor="instructions" className="app-field-label">Instructions</Label>
          <Textarea
            id="instructions"
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Add any instructions for the students..."
            className="min-h-[110px]"
          />
        </div>
      </CardContent>
    </Card>
  );
}
