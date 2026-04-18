'use client';

import AppPrefetchLink from '@/components/navigation/AppPrefetchLink';
import QuestionTagList from '@/components/questions/QuestionTagList';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Archive, Edit, Eye, Globe } from 'lucide-react';
import { Spinner } from './ui/spinner';
import { ContentRenderer } from './ContentRenderer';
import { useReturnHrefBuilder } from '@/hooks/useReturnNavigation';
import { getQuestionTypeLabel } from '@/lib/question-display';
import {
  sanitizeRichTextHtml,
  trimTrailingBlankRichTextBlocks,
} from '@/lib/security/html-sanitize';

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
  type?: 'single' | 'multiple' | 'matrix-match' | 'descriptive' | string;
}

interface QuestionItemProps {
  question: Question;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  onCopyToGlobal?: (id: string) => void;
  isDeleting?: boolean;
  isCopying?: boolean;
}

export function QuestionItem({
  question,
  onDelete,
  onArchive,
  onCopyToGlobal,
  isDeleting = false,
  isCopying = false,
}: QuestionItemProps) {
  const { buildReturnHref } = useReturnHrefBuilder('/workspace/questions');
  const tags = Array.isArray(question.tags) ? question.tags : [];
  const handleDelete = onArchive || onDelete;
  const sanitizedQuestionContent = trimTrailingBlankRichTextBlocks(
    sanitizeRichTextHtml(question.content),
  );
  const createdAtLabel = new Date(question.createdAt).toLocaleDateString();
  const hasOptionPreview = Boolean(question.options?.length);

  return (
    <Card className="app-surface overflow-hidden transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-[0_28px_42px_-34px_hsl(var(--app-shadow-deep)/0.16)]">
      <CardHeader className={`app-section-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${hasOptionPreview ? 'pb-2.5 sm:pb-3' : ''}`}>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {question.class ? <Badge variant="secondary">{question.class.name}</Badge> : null}
            {question.subject ? <Badge variant="outline">{question.subject.name}</Badge> : null}
            <Badge variant="info">{question.marks} Mark(s)</Badge>
            <Badge variant="outline">{getQuestionTypeLabel(question.type)}</Badge>
          </div>
          <div className="app-question-card-richtext">
            <ContentRenderer htmlContent={sanitizedQuestionContent} />
          </div>
        </div>
        <div className="app-row-action-group shrink-0">
          <AppPrefetchLink
            href={buildReturnHref(`/workspace/questions/view/${question._id}`)}
            title="View question"
            relatedApiPrefetches={[`/api/questions/${question._id}`]}
          >
            <Button
              variant="outline"
              size="sm"
              className="app-row-action-button"
              disabled={isDeleting}
              aria-label="View question"
              title="View question"
            >
              <Eye className="h-4 w-4" />
              View
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
          <Button
            variant="outline"
            size="sm"
            className="app-row-action-button app-row-action-button-accent"
            disabled={isDeleting}
            aria-label="Edit question"
            title="Edit question"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        </AppPrefetchLink>
        <Button
          variant="outline"
          size="sm"
          className="app-row-action-button"
          onClick={() => onCopyToGlobal?.(question._id)}
          disabled={isDeleting || isCopying || !onCopyToGlobal}
          aria-label="Copy to global bank"
          title="Copy to global bank"
        >
          {isCopying ? <Spinner /> : <Globe className="h-4 w-4" />}
          Copy to global
        </Button>
        <Button
          variant="outline"
          size="sm"
            className="app-row-action-button app-row-action-button-danger"
            onClick={() => handleDelete?.(question._id)}
            disabled={isDeleting || !handleDelete}
            aria-label="Archive question"
            title="Archive question"
          >
            {isDeleting ? <Spinner /> : <Archive className="h-4 w-4" />}
            Archive
          </Button>
        </div>
      </CardHeader>

      {hasOptionPreview ? (
        <CardContent className="space-y-2 px-5 pb-3 pt-1.5">
          {question.options.map((option, index) => {
            const isCorrect = question.answerIndexes?.includes(index);
            const sanitizedOptionContent = trimTrailingBlankRichTextBlocks(
              sanitizeRichTextHtml(option.content),
            );
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
                <div className="app-question-card-option-richtext min-w-0 flex-1">
                  <ContentRenderer htmlContent={sanitizedOptionContent} />
                </div>
              </div>
            );
          })}
        </CardContent>
      ) : null}

      <CardFooter className="block border-t border-border/60 bg-transparent p-0 sm:p-0">
        <div className="flex w-full flex-col gap-3 px-5 pb-4 pt-5 sm:flex-row sm:items-start sm:justify-between">
          <QuestionTagList
            tags={tags}
            maxVisible={4}
            className="app-question-card-tag-list min-w-0"
          />
          <p className="text-xs text-muted-foreground sm:pt-0.5 sm:text-right">
            {createdAtLabel}
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}

export function QuestionItemSkeleton() {
  return (
    <Card className="app-surface overflow-hidden animate-pulse">
      <CardHeader className="flex flex-col gap-4 border-b border-border/60 px-5 pb-3 pt-4 sm:flex-row sm:items-start sm:justify-between sm:pb-3.5">
        <div className="flex-1 space-y-2.5">
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
      <CardContent className="space-y-2 px-5 pb-3 pt-1.5">
        <div className="h-11 w-full rounded-xl bg-muted" />
        <div className="h-11 w-full rounded-xl bg-muted" />
      </CardContent>
      <CardFooter className="block border-t border-border/60 bg-transparent p-0 sm:p-0">
        <div className="flex items-center justify-between px-5 pb-4 pt-5">
          <div className="flex gap-2">
            <div className="h-6 w-24 rounded-full bg-muted" />
            <div className="h-6 w-32 rounded-full bg-muted" />
          </div>
          <div className="h-4 w-24 rounded bg-muted" />
        </div>
      </CardFooter>
    </Card>
  );
}
