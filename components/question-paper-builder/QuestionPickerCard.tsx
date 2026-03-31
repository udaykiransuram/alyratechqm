"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Edit } from "lucide-react";
import { toast as showToast } from "sonner";

import type { Question, Tag } from "@/components/question-items";
import { QuestionPreviewRenderer } from "@/components/question-paper-builder/QuestionPreviewRenderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const EditQuestionModal = dynamic(
  () => import("@/components/EditQuestionModal").then((module) => module.EditQuestionModal),
  {
    ssr: false,
  },
);

type QuestionPickerCardProps = {
  question: Question;
  classes: any[];
  subjects: any[];
  allTags: Tag[];
  onSave?: (updated: Question) => Promise<void>;
  className?: string;
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

export function QuestionPickerCard({
  question,
  classes,
  subjects,
  allTags,
  onSave,
  className,
}: QuestionPickerCardProps) {
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const { subjectName, className: classNameValue } = useMemo(
    () => getQuestionMeta(question, classes, subjects),
    [classes, question, subjects],
  );
  const createdAtLabel = useMemo(() => getCreatedAtLabel(question.createdAt), [question.createdAt]);
  const tags = Array.isArray(question.tags) ? question.tags : [];
  const options = Array.isArray(question.options) ? question.options : [];
  const hasOptionPreview = options.length > 0;
  const showFooter = tags.length > 0 || Boolean(createdAtLabel);

  return (
    <>
      <Card
        className={cn(
          "app-surface w-full overflow-hidden rounded-xl border-border/50 bg-background shadow-none transition-colors",
          className,
        )}
      >
        <CardHeader
          className={cn(
            "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between",
            hasOptionPreview ? "border-b border-border/60" : "",
          )}
        >
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {classNameValue ? <Badge variant="secondary">{classNameValue}</Badge> : null}
              {subjectName ? <Badge variant="outline">{subjectName}</Badge> : null}
              <Badge variant="secondary">{question.marks} Mark(s)</Badge>
              <Badge variant="outline">{getQuestionTypeLabel(question.type)}</Badge>
            </div>
            <QuestionPreviewRenderer
              htmlContent={question.content || ""}
              className="prose-sm font-medium text-foreground"
            />
          </div>
          {onSave ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setEditModalOpen(true)}
            >
              <Edit className="h-4 w-4" />
            </Button>
          ) : null}
        </CardHeader>

        {hasOptionPreview ? (
          <CardContent className="space-y-2 px-4 py-3">
            {options.map((option, index) => {
              const isCorrect = question.answerIndexes?.includes(index);

              return (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2 text-sm",
                    isCorrect
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200"
                      : "border-border/60 bg-muted/20",
                  )}
                >
                  <Badge
                    variant={isCorrect ? "default" : "outline"}
                    className="min-w-[72px] justify-center text-xs"
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
          <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-muted/10 px-4 pb-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-muted-foreground">
              {tags.length > 0 ? (
                <>
                  {tags.slice(0, 4).map((tag) => (
                    <Badge key={tag._id} variant="secondary" className="font-normal">
                      {tag.name}
                    </Badge>
                  ))}
                  {tags.length > 4 ? (
                    <Badge variant="outline" className="font-normal">
                      +{tags.length - 4} more
                    </Badge>
                  ) : null}
                </>
              ) : null}
              {tags.length > 0 && createdAtLabel ? (
                <Separator orientation="vertical" className="hidden h-4 sm:block" />
              ) : null}
              {createdAtLabel ? (
                <p className="text-xs text-muted-foreground sm:text-right">{createdAtLabel}</p>
              ) : null}
            </div>
          </CardFooter>
        ) : null}
      </Card>

      {onSave && isEditModalOpen ? (
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
