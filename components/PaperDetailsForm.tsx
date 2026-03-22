import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';
import MultiSelectChecklist from '@/components/multi-select-checklist';

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
  examDate: Date | null;
  setExamDate: (v: Date | null) => void;
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

function padDateSegment(value: number) {
  return String(value).padStart(2, '0');
}

function parseDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function parseTimeInput(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return { hours, minutes };
}

function formatDateInput(value: Date | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return `${date.getFullYear()}-${padDateSegment(date.getMonth() + 1)}-${padDateSegment(date.getDate())}`;
}

function formatTimeInput(value: Date | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return `${padDateSegment(date.getHours())}:${padDateSegment(date.getMinutes())}`;
}

function combineDateAndTimeInput(
  dateValue: string,
  timeValue: string,
  options?: { defaultTime?: string },
) {
  if (!dateValue) return null;

  const parsedDate = parseDateInput(dateValue);
  const parsedTime = parseTimeInput(
    timeValue || options?.defaultTime || '00:00',
  );
  if (!parsedDate || !parsedTime) return null;

  parsedDate.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
  return parsedDate;
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
  const [examDateInput, setExamDateInput] = useState(() =>
    formatDateInput(examDate),
  );
  const [onlineStartsAtDateInput, setOnlineStartsAtDateInput] = useState(() =>
    formatDateInput(onlineStartsAt),
  );
  const [onlineStartsAtTimeInput, setOnlineStartsAtTimeInput] = useState(() =>
    formatTimeInput(onlineStartsAt),
  );
  const [onlineEndsAtDateInput, setOnlineEndsAtDateInput] = useState(() =>
    formatDateInput(onlineEndsAt),
  );
  const [onlineEndsAtTimeInput, setOnlineEndsAtTimeInput] = useState(() =>
    formatTimeInput(onlineEndsAt),
  );
  const examDateTimestamp = examDate ? examDate.getTime() : null;
  const onlineStartsAtTimestamp = onlineStartsAt ? onlineStartsAt.getTime() : null;
  const onlineEndsAtTimestamp = onlineEndsAt ? onlineEndsAt.getTime() : null;

  useEffect(() => {
    setExamDateInput(formatDateInput(examDate));
  }, [examDate, examDateTimestamp]);

  useEffect(() => {
    setOnlineStartsAtDateInput(formatDateInput(onlineStartsAt));
    setOnlineStartsAtTimeInput(formatTimeInput(onlineStartsAt));
  }, [onlineStartsAt, onlineStartsAtTimestamp]);

  useEffect(() => {
    setOnlineEndsAtDateInput(formatDateInput(onlineEndsAt));
    setOnlineEndsAtTimeInput(formatTimeInput(onlineEndsAt));
  }, [onlineEndsAt, onlineEndsAtTimestamp]);

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
              value={examDateInput}
              onChange={(e) => {
                const nextValue = e.target.value;
                setExamDateInput(nextValue);
                if (!nextValue) {
                  setExamDate(null);
                  return;
                }

                const parsedDate = parseDateInput(nextValue);
                if (parsedDate) {
                  setExamDate(parsedDate);
                }
              }}
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
            <Label className="app-field-label">Delivery Mode</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant={onlineEnabled ? 'outline' : 'default'}
                size="sm"
                className="app-button-compact w-full"
                onClick={() => setOnlineEnabled(false)}
              >
                Offline
              </Button>
              <Button
                type="button"
                variant={onlineEnabled ? 'default' : 'outline'}
                size="sm"
                className="app-button-compact w-full"
                onClick={() => setOnlineEnabled(true)}
              >
                Online
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {onlineEnabled
                ? 'Online delivery is enabled for student logins. Objective and matrix questions are auto-graded; descriptive answers still need manual review.'
                : 'Offline/manual workflow only. Enable online mode when students should log in and take the paper digitally.'}
            </p>

            {onlineEnabled ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="app-field-group">
                  <Label htmlFor="onlineStartsAt" className="app-field-label">
                    Online Start
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
                    <Input
                      id="onlineStartsAt"
                      type="date"
                      value={onlineStartsAtDateInput}
                      onChange={(e) => {
                        const nextDateValue = e.target.value;
                        setOnlineStartsAtDateInput(nextDateValue);
                        if (!nextDateValue) {
                          setOnlineStartsAt(null);
                          return;
                        }

                        const effectiveTimeValue =
                          onlineStartsAtTimeInput || '00:00';
                        if (!onlineStartsAtTimeInput) {
                          setOnlineStartsAtTimeInput(effectiveTimeValue);
                        }

                        const parsedDate = combineDateAndTimeInput(
                          nextDateValue,
                          effectiveTimeValue,
                        );
                        if (parsedDate) {
                          setOnlineStartsAt(parsedDate);
                        }
                      }}
                    />
                    <Input
                      type="time"
                      step={60}
                      value={onlineStartsAtTimeInput}
                      onChange={(e) => {
                        const effectiveTimeValue =
                          e.target.value || (onlineStartsAtDateInput ? '00:00' : '');
                        setOnlineStartsAtTimeInput(effectiveTimeValue);
                        if (!onlineStartsAtDateInput) {
                          setOnlineStartsAt(null);
                          return;
                        }

                        const parsedDate = combineDateAndTimeInput(
                          onlineStartsAtDateInput,
                          effectiveTimeValue,
                        );
                        if (parsedDate) {
                          setOnlineStartsAt(parsedDate);
                        }
                      }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-xl px-2.5 text-xs"
                      onClick={() => {
                        setOnlineStartsAtDateInput('');
                        setOnlineStartsAtTimeInput('');
                        setOnlineStartsAt(null);
                      }}
                      disabled={!onlineStartsAtDateInput && !onlineStartsAtTimeInput}
                    >
                      Clear start
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Leave blank to start from the paper exam date.
                  </p>
                </div>

                <div className="app-field-group">
                  <Label htmlFor="onlineEndsAt" className="app-field-label">
                    Online End
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
                    <Input
                      id="onlineEndsAt"
                      type="date"
                      value={onlineEndsAtDateInput}
                      onChange={(e) => {
                        const nextDateValue = e.target.value;
                        setOnlineEndsAtDateInput(nextDateValue);
                        if (!nextDateValue) {
                          setOnlineEndsAt(null);
                          return;
                        }

                        const effectiveTimeValue =
                          onlineEndsAtTimeInput || '00:00';
                        if (!onlineEndsAtTimeInput) {
                          setOnlineEndsAtTimeInput(effectiveTimeValue);
                        }

                        const parsedDate = combineDateAndTimeInput(
                          nextDateValue,
                          effectiveTimeValue,
                        );
                        if (parsedDate) {
                          setOnlineEndsAt(parsedDate);
                        }
                      }}
                    />
                    <Input
                      type="time"
                      step={60}
                      value={onlineEndsAtTimeInput}
                      onChange={(e) => {
                        const effectiveTimeValue =
                          e.target.value || (onlineEndsAtDateInput ? '00:00' : '');
                        setOnlineEndsAtTimeInput(effectiveTimeValue);
                        if (!onlineEndsAtDateInput) {
                          setOnlineEndsAt(null);
                          return;
                        }

                        const parsedDate = combineDateAndTimeInput(
                          onlineEndsAtDateInput,
                          effectiveTimeValue,
                        );
                        if (parsedDate) {
                          setOnlineEndsAt(parsedDate);
                        }
                      }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-xl px-2.5 text-xs"
                      onClick={() => {
                        setOnlineEndsAtDateInput('');
                        setOnlineEndsAtTimeInput('');
                        setOnlineEndsAt(null);
                      }}
                      disabled={!onlineEndsAtDateInput && !onlineEndsAtTimeInput}
                    >
                      Clear end
                    </Button>
                  </div>
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
