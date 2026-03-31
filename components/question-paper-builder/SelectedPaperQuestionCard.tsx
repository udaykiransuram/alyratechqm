"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Edit, X } from "lucide-react";
import { toast as showToast } from "sonner";

import type { Question, Tag } from "@/components/question-items";
import { QuestionPreviewRenderer } from "@/components/question-paper-builder/QuestionPreviewRenderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const EditQuestionModal = dynamic(
  () => import("@/components/EditQuestionModal").then((module) => module.EditQuestionModal),
  {
    ssr: false,
  },
);

type SelectedPaperQuestion = {
  question: Question;
  marks: number;
  negativeMarks: number;
};

type SelectedPaperQuestionCardProps = {
  questionInPaper: SelectedPaperQuestion;
  questionIndex: number;
  classes: any[];
  subjects: any[];
  allTags: Tag[];
  onSave: (updated: Question) => Promise<void>;
  onRemove: () => void;
};

function getQuestionMeta(question: Question, classes: any[], subjects: any[]) {
  const subjectName =
    typeof question.subject === "string"
      ? subjects.find((subject) => subject._id === question.subject)?.name
      : question.subject?.name;
  const className =
    typeof question.class === "string"
      ? classes.find((classItem) => classItem._id === question.class)?.name
      : question.class?.name;

  return { subjectName, className };
}

function getCreatedAtLabel(createdAt?: string) {
  if (!createdAt) {
    return null;
  }

  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

function getQuestionTypeLabel(type: Question["type"]) {
  switch (type) {
    case "single":
      return "Single choice";
    case "multiple":
      return "Multiple choice";
    case "matrix-match":
      return "Matrix match";
    default:
      return "Descriptive";
  }
}

export function SelectedPaperQuestionCard({
  questionInPaper,
  questionIndex,
  classes,
  subjects,
  allTags,
  onSave,
  onRemove,
}: SelectedPaperQuestionCardProps) {
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const { question, marks, negativeMarks } = questionInPaper;
  const { subjectName, className: classNameValue } = useMemo(
    () => getQuestionMeta(question, classes, subjects),
    [classes, question, subjects],
  );
  const createdAtLabel = useMemo(() => getCreatedAtLabel(question.createdAt), [question.createdAt]);
  const tags = Array.isArray(question.tags) ? question.tags : [];
  const options = Array.isArray(question.options) ? question.options : [];
  const hasOptionPreview = options.length > 0;
  const showFooter = tags.length > 0 || Boolean(createdAtLabel);
  const questionLabel = `Q${questionIndex + 1}`;

  return (
    <>
      <Card className="relative w-full overflow-hidden rounded-[calc(var(--app-radius-lg)+0.125rem)] border border-border/68 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.998)_0%,hsl(var(--app-surface-2)/0.88)_100%)] shadow-[0_22px_38px_-30px_hsl(var(--app-shadow-deep)/0.16)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/36 to-transparent" />
        <div className="pointer-events-none absolute -right-8 top-0 h-24 w-24 rounded-full bg-primary/8 blur-3xl" />
        <CardHeader
          className={cn(
            "relative flex flex-col gap-3.5 bg-[linear-gradient(145deg,hsl(var(--app-surface-tint)/0.28)_0%,hsl(var(--app-surface-1)/0.985)_48%,hsl(var(--app-surface-2)/0.86)_100%)] px-4 py-4 sm:flex-row sm:items-start sm:justify-between",
            hasOptionPreview ? "border-b border-border/60" : "",
          )}
        >
          <div className="min-w-0 flex flex-1 items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] border border-primary/18 bg-primary/10 text-sm font-semibold text-primary shadow-[0_18px_30px_-24px_hsl(var(--primary)/0.34)]">
              {questionLabel}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-background/88 text-foreground shadow-sm">
                  {marks} Marks
                </Badge>
                <Badge
                  variant={negativeMarks > 0 ? "destructive" : "outline"}
                  className={negativeMarks > 0 ? "" : "bg-background/88 shadow-sm"}
                >
                  {negativeMarks > 0 ? `-${negativeMarks} Negative` : "0 Negative"}
                </Badge>
                <Badge variant="outline" className="bg-background/88 shadow-sm">
                  {getQuestionTypeLabel(question.type)}
                </Badge>
                {classNameValue ? (
                  <Badge variant="secondary" className="bg-background/88 text-foreground shadow-sm">
                    {classNameValue}
                  </Badge>
                ) : null}
                {subjectName ? (
                  <Badge variant="outline" className="bg-background/88 shadow-sm">
                    {subjectName}
                  </Badge>
                ) : null}
                <span className="rounded-full border border-border/60 bg-background/88 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                  ID: {question._id}
                </span>
              </div>
              <div className="rounded-[calc(var(--app-radius-md)+0.125rem)] border border-border/60 bg-background/88 p-3.5 shadow-[0_14px_24px_-24px_hsl(var(--app-shadow-deep)/0.12)]">
                <QuestionPreviewRenderer
                  htmlContent={question.content || ""}
                  className="prose-sm max-w-none font-medium text-foreground"
                />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:pl-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-2xl border-border/60 bg-background/88 shadow-sm"
              onClick={() => setEditModalOpen(true)}
              aria-label="Edit question"
              title="Edit question"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-2xl border border-border/60 bg-background/88 shadow-sm hover:bg-background"
              onClick={onRemove}
              aria-label="Remove question"
              title="Remove question"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {hasOptionPreview ? (
          <CardContent className="space-y-2.5 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.76)_0%,hsl(var(--app-surface-2)/0.54)_100%)] px-4 py-4">
            {options.map((option, index) => {
              const isCorrect = question.answerIndexes?.includes(index);

              return (
                <div
                  key={index}
                  className={cn(
                    "flex items-start gap-3 rounded-[calc(var(--app-radius-md)+0.125rem)] border px-3.5 py-3 text-sm shadow-sm",
                    isCorrect
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200"
                      : "border-border/60 bg-background/82",
                  )}
                >
                  <Badge
                    variant={isCorrect ? "default" : "outline"}
                    className={cn(
                      "min-w-[84px] justify-center text-xs shadow-sm",
                      !isCorrect && "bg-background/92",
                    )}
                  >
                    {isCorrect ? "Correct" : `Option ${index + 1}`}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <QuestionPreviewRenderer
                      htmlContent={option.content || ""}
                      className="prose-sm"
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        ) : null}

        {showFooter ? (
          <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.8)_0%,hsl(var(--app-surface-tint)/0.16)_100%)] px-4 pb-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-muted-foreground">
              {tags.slice(0, 4).map((tag) => (
                <Badge
                  key={tag._id}
                  variant="secondary"
                  className="bg-background/88 font-medium text-foreground shadow-sm"
                >
                  {tag.name}
                </Badge>
              ))}
              {tags.length > 4 ? (
                <Badge variant="outline" className="bg-background/88 font-medium shadow-sm">
                  +{tags.length - 4} more
                </Badge>
              ) : null}
              {createdAtLabel ? (
                <span className="inline-flex items-center rounded-full border border-border/60 bg-background/88 px-2.5 py-1 font-medium shadow-sm">
                  {createdAtLabel}
                </span>
              ) : null}
            </div>
          </CardFooter>
        ) : null}
      </Card>

      {isEditModalOpen ? (
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
      ) : null}
    </>
  );
}
