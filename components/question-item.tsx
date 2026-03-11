'use client';

import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Eye, Trash2 } from 'lucide-react';
import { Spinner } from './ui/spinner';
import { ContentRenderer } from './ContentRenderer';
import { useReturnHrefBuilder } from '@/hooks/useReturnNavigation';

interface TagType {
  _id: string;
  name: string;
}

interface Tag {
  _id: string;
  name: string;
  type: TagType;
}

interface Subject { _id: string; name: string; }
interface Class { _id: string; name: string; }

interface QuestionOption {
  content: string;
}

export interface Question {
  _id: string;
  content: string;
  subject: Subject;
  class: Class;
  tags: Tag[];
  options: QuestionOption[];
  answerIndexes: number[];
  explanation?: string;
  marks: number;
  createdAt: string;
}

interface QuestionItemProps {
  question: Question;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  isDeleting?: boolean;
}

export function QuestionItem({ question, onDelete, onArchive, isDeleting = false }: QuestionItemProps) {
  const { buildReturnHref } = useReturnHrefBuilder('/questions');
  const tags = Array.isArray(question.tags) ? question.tags : [];
  const handleDelete = onArchive || onDelete;

  return (
    <Card className="app-surface overflow-hidden transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="flex flex-col gap-4 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {question.class ? <Badge variant="secondary">{question.class.name}</Badge> : null}
            {question.subject ? <Badge variant="outline">{question.subject.name}</Badge> : null}
            <Badge variant="secondary">{question.marks} Mark(s)</Badge>
          </div>
          <div className="prose prose-sm max-w-none font-medium text-foreground dark:prose-invert">
            <ContentRenderer htmlContent={question.content} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={buildReturnHref(`/questions/view/${question._id}`)} title="View question">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={isDeleting} aria-label="View question">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={buildReturnHref(`/questions/edit/${question._id}`)} title="Edit question">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={isDeleting} aria-label="Edit question">
              <Edit className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="destructive"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleDelete?.(question._id)}
            disabled={isDeleting || !handleDelete}
            aria-label="Archive question"
            title="Archive question"
          >
            {isDeleting ? <Spinner /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {question.options?.length ? (
        <CardContent className="space-y-2 px-5 py-4">
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

      <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-muted/10 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <Badge key={tag._id} variant="secondary" className="font-normal capitalize">
              {tag.type.name}: {tag.name}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground sm:text-right">
          {new Date(question.createdAt).toLocaleDateString()}
        </p>
      </CardFooter>
    </Card>
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
