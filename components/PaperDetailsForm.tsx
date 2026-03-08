import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

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
  classId: string;
  setClassId: (v: string) => void;
  subjectId: string;
  setSubjectId: (v: string) => void;
  classes: any[];
  subjects: any[];
  compact?: boolean;
  initialDataLoading?: boolean;
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
  classId,
  setClassId,
  subjectId,
  setSubjectId,
  classes,
  subjects,
  initialDataLoading,
}: PaperDetailsFormProps) {
  if (initialDataLoading) {
    return (
      <div className="app-surface app-surface-body">
        <div className="app-status-row justify-center">
          <Spinner />
          <span>Loading paper settings...</span>
        </div>
      </div>
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
