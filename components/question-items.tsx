'use client';

import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { Spinner } from './ui/spinner';
import { ContentRenderer } from './ContentRenderer';
import { EditQuestionModal } from './EditQuestionModal';
import { toast as showToast } from 'sonner';
import { Separator } from './ui/separator';

export interface TagType { _id: string; name: string; }
export interface Tag { _id: string; name: string; type: TagType; }
export interface Subject { _id: string; name: string; }
export interface Class { _id: string; name: string; }
export interface QuestionOption { content: string; }
export interface Question {
  _id: string;
  content: string;
  subject: Subject | string;
  class: Class | string;
  tags: Tag[];
  options: QuestionOption[];
  answerIndexes: number[];
  explanation?: string;
  marks: number;
  createdAt: string;
  type: 'single' | 'multiple' | 'matrix-match';
}

export interface QuestionItemProps {
  question: Question;
  onDelete?: () => void;
  isDeleting?: boolean;
  classes: Class[];
  subjects: Subject[];
  allTags: Tag[];
  onSave: (updated: Question) => Promise<void>;
  readOnly?: boolean; // Add readOnly prop
}

export function QuestionItem({
  question,
  onDelete,
  isDeleting = false,
  classes,
  subjects,
  allTags,
  onSave,
  readOnly = false, // Set default value
}: QuestionItemProps) {
  const [isEditModalOpen, setEditModalOpen] = useState(false);

  const subjectName = typeof question.subject === 'string' ? subjects.find(s => s._id === question.subject)?.name : question.subject?.name;
  const className = typeof question.class === 'string' ? classes.find(c => c._id === question.class)?.name : question.class?.name;

  return (
    <>
      <Card className="bg-card/50 hover:shadow-sm transition-shadow w-full">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <ContentRenderer htmlContent={question.content} />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{question.marks} Mark(s)</Badge>
              {/* Conditionally render edit/delete buttons */}
              {!readOnly && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditModalOpen(true)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  {onDelete && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete} disabled={isDeleting}>
                      {isDeleting ? <Spinner /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        {question.options && question.options.length > 0 && (
          <CardContent className="space-y-2 pb-4">
            {question.options.map((opt, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 rounded-md p-3 text-sm
                  ${question.answerIndexes?.includes(idx)
                    ? "bg-green-500/10 border border-green-500/20 text-green-800 dark:text-green-300"
                    : "bg-muted/50"
                  }`}
              >
                <div className="font-semibold">
                  {question.answerIndexes?.includes(idx) ? '✓' : '○'}
                </div>
                <div className="flex-1">
                  <ContentRenderer htmlContent={opt.content} />
                </div>
              </div>
            ))}
          </CardContent>
        )}
        <CardFooter className="bg-muted/30 px-4 py-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {className && <Badge variant="outline">{className}</Badge>}
            {subjectName && <Badge variant="outline">{subjectName}</Badge>}
            {question.tags.length > 0 && <Separator orientation="vertical" className="h-4" />}
            {question.tags.slice(0, 3).map((tag: any) => (
              <Badge key={tag._id || tag} variant="outline" className="font-normal">
                {typeof tag === 'string' ? allTags.find(t => t._id === tag)?.name : tag.name}
              </Badge>
            ))}
            {question.tags.length > 3 && (
              <Badge variant="outline" className="font-normal">+{question.tags.length - 3} more</Badge>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Conditionally render the modal */}
      {!readOnly && (
        <EditQuestionModal
          open={isEditModalOpen}
          onOpenChange={setEditModalOpen}
          question={question}
          classes={classes}
          subjects={subjects}
          allTags={allTags}
          onSave={onSave}
          toast={showToast}
        />
      )}
    </>
  );
}

export function QuestionItemSkeleton() {
  return (
    <Card className="overflow-hidden animate-pulse">
      <CardHeader className="flex-row justify-between items-start gap-4">
        <div className="flex-1 space-y-2">
          {/* --- SKELETON FOR BADGES --- */}
          <div className="flex items-center gap-2">
            <div className="h-6 w-20 bg-muted rounded-full"></div>
            <div className="h-6 w-24 bg-muted rounded-full"></div>
          </div>
          <div className="h-5 w-full bg-muted rounded"></div>
          <div className="h-5 w-3/4 bg-muted rounded"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-8 bg-muted rounded"></div>
          <div className="h-8 w-8 bg-muted rounded"></div>
        </div>
      </CardHeader>
      <CardFooter className="bg-muted/40 px-6 py-3 flex justify-between items-center">
        <div className="flex gap-2">
          <div className="h-6 w-24 bg-muted rounded-full"></div>
          <div className="h-6 w-32 bg-muted rounded-full"></div>
        </div>
        <div className="h-4 w-24 bg-muted rounded"></div>
      </CardFooter>
    </Card>
  );
}