'use client';

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ContentRenderer } from './ContentRenderer';

interface TagType {
  _id: string;
  name: string;
}

interface Tag {
  _id: string;
  name: string;
  type: TagType;
}

interface QuestionOption {
  content: string;
}

export interface Question {
  _id: string;
  content: string;
  tags: Tag[];
  options: QuestionOption[];
  answerIndexes: number[];
  explanation?: string;
  createdAt: string;
}

interface QuestionItemPaperProps {
  question: Question;
}

export function QuestionItemPaper({ question }: QuestionItemPaperProps) {
  return (
    <Card className="overflow-hidden shadow-sm border-border/40 mb-4 print:shadow-none print:border-none">
      <CardHeader className="pb-2">
        <div className="prose prose-base dark:prose-invert max-w-none font-semibold text-foreground mb-1">
          <ContentRenderer htmlContent={question.content} />
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2">
          {question.options.map((opt, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 border
                ${question.answerIndexes?.includes(idx)
                  ? "bg-green-50 border-green-400"
                  : "bg-muted/60 border-border"
                }`}
            >
              <Badge
                variant={question.answerIndexes?.includes(idx) ? "default" : "outline"}
                className={`min-w-[60px] px-2 py-1 text-xs font-semibold
                  ${question.answerIndexes?.includes(idx)
                    ? "bg-green-600 text-white"
                    : "bg-muted text-muted-foreground"
                  }`}
              >
                {question.answerIndexes?.includes(idx) ? "Correct" : `Option ${idx + 1}`}
              </Badge>
              <span className="prose prose-sm dark:prose-invert font-medium">
                <ContentRenderer htmlContent={opt.content} />
              </span>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="bg-muted/40 px-6 py-3 flex justify-between items-center print:bg-transparent">
        <div className="flex flex-wrap gap-2">
          {question.tags.map(tag => (
            <Badge key={tag._id} variant="secondary" className="capitalize font-normal text-xs px-2 py-1">
              {tag.type.name}: {tag.name}
            </Badge>
          ))}
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
          <span>{new Date(question.createdAt).toLocaleDateString()}</span>
        </div>
      </CardFooter>
    </Card>
  );
}