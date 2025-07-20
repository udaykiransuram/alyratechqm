import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';

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
}

export function PaperDetailsForm({
  paperTitle, setPaperTitle,
  instructions, setInstructions,
  duration, setDuration,
  passingMarks, setPassingMarks,
  examDate, setExamDate,
  classId, setClassId,
  subjectId, setSubjectId,
  classes, subjects,
}: PaperDetailsFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <BookOpen className="w-5 h-5 text-primary" /> Paper Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="paper-title" className="text-sm font-medium">Paper Title</Label>
          <Input
            id="paper-title"
            value={paperTitle}
            onChange={e => setPaperTitle(e.target.value)}
            placeholder="e.g., Mid-Term Mathematics Test"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="class" className="text-sm font-medium">Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map(cls => <SelectItem key={cls._id} value={cls._id}>{cls.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="subject" className="text-sm font-medium">Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId} disabled={!classId || subjects.length === 0}>
              <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
              <SelectContent>{subjects.map(sub => <SelectItem key={sub._id} value={sub._id}>{sub.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="examDate" className="text-sm font-medium">Exam Date</Label>
            <Input
              id="examDate"
              type="date"
              value={examDate ? examDate.toISOString().slice(0, 10) : ''}
              onChange={e => setExamDate(new Date(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="duration" className="text-sm font-medium">Duration (min)</Label>
            <Input
              id="duration"
              type="number"
              min={1}
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              placeholder="e.g., 60"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="passingMarks" className="text-sm font-medium">Passing Marks</Label>
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
        <div className="space-y-1">
          <Label htmlFor="instructions" className="text-sm font-medium">Instructions</Label>
          <Textarea
            id="instructions"
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Add any instructions for the students..."
            className="min-h-[80px]"
          />
        </div>
      </CardContent>
    </Card>
  );
}