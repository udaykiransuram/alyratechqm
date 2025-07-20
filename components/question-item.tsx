'use client';

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { Spinner } from './ui/spinner';
import Link from 'next/link';
import { ContentRenderer } from './ContentRenderer';

// Interfaces for populated data remain the same
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
  // You might also have an _id here if it comes from a database
  // _id: string; 
}

export interface Question {
  _id: string;
  content: string;
  subject: Subject;
  class: Class;
  tags: Tag[];
  options: QuestionOption[];
  answerIndexes: number[]; // <-- CHANGE for multi-select
  explanation?: string;
  createdAt: string;
}

interface QuestionItemProps {
  question: Question;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

export function QuestionItem({ question, onDelete, isDeleting }: QuestionItemProps) {
  return (
    <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow border-border/40">
      <CardHeader className="flex-row justify-between items-start gap-4">
        <div className="flex-1">
          {/* --- DISPLAY CLASS AND SUBJECT BADGES --- */}
          <div className="flex items-center gap-2 mb-2">
            {question.class && <Badge variant="secondary">{question.class.name}</Badge>}
            {question.subject && <Badge variant="outline">{question.subject.name}</Badge>}
          </div>
          <div className="prose prose-base dark:prose-invert max-w-none font-semibold text-foreground">
            <ContentRenderer htmlContent={question.content} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href={`/questions/edit/${question._id}`} passHref>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={isDeleting}>
              <Edit className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => onDelete(question._id)} disabled={isDeleting}>
            {isDeleting ? <Spinner /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      
      {/* --- SHOW OPTIONS --- */}
      <CardContent>
        <div className="space-y-2">
          {question.options.map((opt, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 rounded-lg px-3 py-2
                ${question.answerIndexes?.includes(idx)
                  ? "bg-accent-green/10 border border-accent-green"
                  : "bg-muted/60 border border-border"
                }`}
            >
              <Badge
                variant={question.answerIndexes?.includes(idx) ? "default" : "outline"}
                className={`min-w-[60px] px-2 py-1 text-xs font-semibold
                  ${question.answerIndexes?.includes(idx)
                    ? "bg-accent-green text-green-800"
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

      <CardFooter className="bg-muted/40 px-6 py-3 flex justify-between items-center">
        <div className="flex flex-wrap gap-2">
          {question.tags.map(tag => (
            <Badge key={tag._id} variant="secondary" className="capitalize font-normal">
              {tag.type.name}: {tag.name}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground flex-shrink-0 ml-4">
          {new Date(question.createdAt).toLocaleDateString()}
        </p>
      </CardFooter>
    </Card>
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