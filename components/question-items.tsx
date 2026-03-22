'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { Spinner } from './ui/spinner';
import { ContentRenderer } from './ContentRenderer';
import { toast as showToast } from 'sonner';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';

const EditQuestionModal = dynamic(
  () => import('./EditQuestionModal').then((module) => module.EditQuestionModal),
  {
    ssr: false,
  },
);

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
  type: 'single' | 'multiple' | 'matrix-match' | 'descriptive';
}

export interface QuestionItemProps {
  question: Question;
  onDelete?: () => void;
  isDeleting?: boolean;
  classes: Class[];
  subjects: Subject[];
  allTags: Tag[];
  onSave?: (updated: Question) => Promise<void>;
  readOnly?: boolean;
  compact?: boolean;
  className?: string;
}

export function QuestionItem({
  question,
  onDelete,
  isDeleting = false,
  classes,
  subjects,
  allTags,
  onSave,
  readOnly = false,
  compact = false,
  className,
}: QuestionItemProps) {
  const [isEditModalOpen, setEditModalOpen] = useState(false);

  const subjectName = typeof question.subject === 'string'
    ? subjects.find(subject => subject._id === question.subject)?.name
    : question.subject?.name;
  const classNameValue = typeof question.class === 'string'
    ? classes.find(classItem => classItem._id === question.class)?.name
    : question.class?.name;
  const tags = Array.isArray(question.tags) ? question.tags : [];
  const showFooter = compact ? tags.length > 0 || Boolean(question.createdAt) : true;

  return (
    <>
      <Card
        className={cn(
          'app-surface w-full overflow-hidden transition-shadow duration-200',
          compact ? 'rounded-xl hover:shadow-none' : 'hover:shadow-md',
          className,
        )}
      >
        <CardHeader
          className={cn(
            'flex flex-col gap-3 border-b border-border/60 sm:flex-row sm:items-start sm:justify-between',
            compact ? 'px-4 py-3' : 'px-5 py-4',
          )}
        >
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {classNameValue ? <Badge variant="secondary">{classNameValue}</Badge> : null}
              {subjectName ? <Badge variant="outline">{subjectName}</Badge> : null}
              <Badge variant="secondary">{question.marks} Mark(s)</Badge>
            </div>
            <div className="prose prose-sm max-w-none font-medium text-foreground dark:prose-invert">
              <ContentRenderer htmlContent={question.content} />
            </div>
          </div>
          {!readOnly ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditModalOpen(true)}>
                <Edit className="h-4 w-4" />
              </Button>
              {onDelete ? (
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? <Spinner /> : <Trash2 className="h-4 w-4" />}
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardHeader>

        {question.options?.length ? (
          <CardContent className={cn('space-y-2', compact ? 'px-4 py-3' : 'px-5 py-4')}>
            {question.options.map((option, index) => {
              const isCorrect = question.answerIndexes?.includes(index);
              return (
                <div
                  key={index}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                    isCorrect
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200'
                      : 'border-border/60 bg-muted/20'
                  }`}
                >
                  <Badge variant={isCorrect ? 'default' : 'outline'} className="min-w-[72px] justify-center text-xs">
                    {isCorrect ? 'Correct' : `Option ${index + 1}`}
                  </Badge>
                  <div className="min-w-0 flex-1 prose prose-sm max-w-none dark:prose-invert">
                    <ContentRenderer htmlContent={option.content} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        ) : null}

        {showFooter ? (
          <CardFooter
            className={cn(
              'flex flex-col gap-3 border-t border-border/60 bg-muted/10 sm:flex-row sm:items-center sm:justify-between',
              compact ? 'px-4 py-2.5' : 'px-5 py-3',
            )}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-muted-foreground">
              {!compact && classNameValue ? <Badge variant="outline">{classNameValue}</Badge> : null}
              {!compact && subjectName ? <Badge variant="outline">{subjectName}</Badge> : null}
              {!compact && tags.length > 0 ? <Separator orientation="vertical" className="hidden h-4 sm:block" /> : null}
              {tags.slice(0, compact ? 4 : 3).map(tag => (
                <Badge key={tag._id} variant="secondary" className="font-normal">
                  {tag.name}
                </Badge>
              ))}
              {tags.length > (compact ? 4 : 3) ? (
                <Badge variant="outline" className="font-normal">+{tags.length - (compact ? 4 : 3)} more</Badge>
              ) : null}
            </div>
            {question.createdAt ? (
              <p className="text-xs text-muted-foreground sm:text-right">
                {new Date(question.createdAt).toLocaleDateString()}
              </p>
            ) : null}
          </CardFooter>
        ) : null}
      </Card>

      {!readOnly && isEditModalOpen ? (
        <EditQuestionModal
          open={isEditModalOpen}
          onOpenChange={setEditModalOpen}
          question={question}
          classes={classes}
          subjects={subjects}
          allTags={allTags}
          onSave={onSave ?? (async () => {})}
          toast={showToast}
        />
      ) : null}
    </>
  );
}

export function QuestionItemSkeleton() {
  return (
    <Card className="app-surface overflow-hidden animate-pulse">
      <CardHeader className="flex flex-col gap-4 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-20 rounded-full bg-muted" />
            <div className="h-6 w-24 rounded-full bg-muted" />
            <div className="h-6 w-20 rounded-full bg-muted" />
          </div>
          <div className="h-5 w-full rounded bg-muted" />
          <div className="h-5 w-3/4 rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded bg-muted" />
          <div className="h-8 w-8 rounded bg-muted" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-5 py-4">
        <div className="h-11 w-full rounded-xl bg-muted" />
        <div className="h-11 w-full rounded-xl bg-muted" />
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t border-border/60 bg-muted/10 px-5 py-3">
        <div className="flex gap-2">
          <div className="h-6 w-24 rounded-full bg-muted" />
          <div className="h-6 w-32 rounded-full bg-muted" />
        </div>
        <div className="h-4 w-24 rounded bg-muted" />
      </CardFooter>
    </Card>
  );
}
