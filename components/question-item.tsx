'use client';

import AppPrefetchLink from '@/components/navigation/AppPrefetchLink';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Eye, Trash2 } from 'lucide-react';
import { Spinner } from './ui/spinner';
import { ContentRenderer } from './ContentRenderer';
import { useReturnHrefBuilder } from '@/hooks/useReturnNavigation';
import { sanitizeRichTextHtml } from '@/lib/security/html-sanitize';

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
  const { buildReturnHref } = useReturnHrefBuilder('/workspace/questions');
  const tags = Array.isArray(question.tags) ? question.tags : [];
  const handleDelete = onArchive || onDelete;
  const sanitizedQuestionContent = sanitizeRichTextHtml(question.content);

  return (
    <Card className="app-surface overflow-hidden transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-[0_28px_42px_-34px_hsl(var(--app-shadow-deep)/0.16)]">
      <CardHeader className="app-section-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {question.class ? <Badge variant="secondary">{question.class.name}</Badge> : null}
            {question.subject ? <Badge variant="outline">{question.subject.name}</Badge> : null}
            <Badge variant="info">{question.marks} Mark(s)</Badge>
          </div>
          <div className="prose prose-sm max-w-none font-medium text-foreground dark:prose-invert">
            <ContentRenderer htmlContent={sanitizedQuestionContent} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AppPrefetchLink
            href={buildReturnHref(`/workspace/questions/view/${question._id}`)}
            title="View question"
            relatedApiPrefetches={[`/api/questions/${question._id}`]}
          >
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={isDeleting} aria-label="View question">
              <Eye className="h-4 w-4" />
            </Button>
          </AppPrefetchLink>
          <AppPrefetchLink
            href={buildReturnHref(`/workspace/questions/edit/${question._id}`)}
            title="Edit question"
            relatedApiPrefetches={[
              `/api/questions/${question._id}`,
              '/api/classes',
              '/api/tags/with-subjects',
            ]}
          >
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={isDeleting} aria-label="Edit question">
              <Edit className="h-4 w-4" />
            </Button>
          </AppPrefetchLink>
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
        <CardContent className="space-y-2 px-5 py-5">
          {question.options.map((option, index) => {
            const isCorrect = question.answerIndexes?.includes(index);
            return (
              <div
                key={index}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                  isCorrect
                    ? 'border-[hsl(var(--app-success)/0.22)] bg-[hsl(var(--app-success)/0.08)] text-foreground'
                    : 'border-border/60 bg-[hsl(var(--app-surface-2)/0.4)]'
                }`}
              >
                <Badge variant={isCorrect ? 'success' : 'outline'} className="min-w-[72px] justify-center text-xs">
                  {isCorrect ? 'Correct' : `Option ${index + 1}`}
                </Badge>
                <div className="min-w-0 flex-1 prose prose-sm max-w-none dark:prose-invert">
                  <ContentRenderer htmlContent={sanitizeRichTextHtml(option.content)} />
                </div>
              </div>
            );
          })}
        </CardContent>
      ) : null}

      <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-[hsl(var(--app-surface-2)/0.44)] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
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
