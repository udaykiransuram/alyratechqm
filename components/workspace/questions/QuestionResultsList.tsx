"use client";

import { memo } from "react";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { QuestionItem } from "@/components/question-item";
import type { Question } from "@/components/question-item";
import { Button } from "@/components/ui/button";

type QuestionResultsListProps = {
  questions: Question[];
  isDeleting: boolean;
  questionToArchive: string | null;
  onArchive: (id: string) => void;
};

const QuestionResultsList = memo(function QuestionResultsList({
  questions,
  isDeleting,
  questionToArchive,
  onArchive,
}: QuestionResultsListProps) {
  if (questions.length === 0) {
    return (
      <div className="app-empty-state">
        <p>No questions match your current filters.</p>
        <div className="mt-4 flex justify-center">
          <Button asChild variant="outline" className="app-button-page">
            <AppPrefetchLink
              href="/workspace/questions/create"
              relatedApiPrefetches={[
                "/api/classes",
                "/api/subjects",
                "/api/tags/with-subjects",
              ]}
            >
              Create your first question
            </AppPrefetchLink>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {questions.map((question) => (
        <QuestionItem
          key={question._id}
          question={question}
          onArchive={() => onArchive(question._id)}
          isDeleting={isDeleting && questionToArchive === question._id}
        />
      ))}
    </div>
  );
});

export default QuestionResultsList;
