"use client";

import { useEffect, useMemo, useState } from "react";
import { Expand, Minimize2 } from "lucide-react";

import { ContentRenderer } from "@/components/ContentRenderer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type {
  StudentAnswerState,
  StudentPaper,
  StudentQuestion,
  StudentQuestionListItem,
} from "./student-test-types";

function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatRemainingTime(value: number | null) {
  if (value === null) return "—";
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function StudentTestCountdownText({ deadlineAt }: { deadlineAt?: string | null }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const deadlineMs = toTimestamp(deadlineAt);

  useEffect(() => {
    if (!deadlineMs) {
      return;
    }

    setNowMs(Date.now());
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [deadlineMs]);

  const remainingMs = deadlineMs ? Math.max(0, deadlineMs - nowMs) : null;
  return <>{formatRemainingTime(remainingMs)}</>;
}

function getOptionLabel(index: number) {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

type StudentTestActiveAttemptViewProps = {
  examContainerRef: { current: HTMLDivElement | null };
  paper: StudentPaper;
  paperSubjects: Array<{ _id: string; name: string }>;
  paperSubjectLabel: string;
  paperClassLabel: string;
  deadlineAt: string | null;
  answeredCount: number;
  questionList: StudentQuestionListItem[];
  currentIndex: number;
  saveStatusLabel: string;
  isSaving: boolean;
  isSubmitting: boolean;
  isFullscreen: boolean;
  submitDialogOpen: boolean;
  setSubmitDialogOpen: (open: boolean) => void;
  unansweredCount: number;
  hasManualReviewQuestions: boolean;
  connectionNotice: string | null;
  recoveryNotice: string | null;
  pendingSubmitRetry: boolean;
  saveRetryPending: boolean;
  actionError: string | null;
  answeredQuestionIds: Set<string>;
  currentQuestion: StudentQuestionListItem | null;
  currentAnswer: StudentAnswerState | null;
  onSaveAttempt: (force?: boolean) => Promise<void>;
  onToggleFullscreen: () => Promise<void>;
  onSubmitAttempt: (auto?: boolean) => Promise<void>;
  onJumpToQuestion: (index: number) => Promise<void>;
  onUpdateMultipleChoice: (questionId: string, optionIndex: number) => void;
  onUpdateSingleChoice: (questionId: string, optionIndex: number) => void;
  onUpdateDescriptiveAnswer: (question: StudentQuestion, value: string) => void;
  onUpdateMatrixSelection: (
    question: StudentQuestion,
    rowIndex: number,
    columnIndex: number,
  ) => void;
  onClearCurrentAnswer: () => void;
};

export default function StudentTestActiveAttemptView({
  examContainerRef,
  paper,
  paperSubjects,
  paperSubjectLabel,
  paperClassLabel,
  deadlineAt,
  answeredCount,
  questionList,
  currentIndex,
  saveStatusLabel,
  isSaving,
  isSubmitting,
  isFullscreen,
  submitDialogOpen,
  setSubmitDialogOpen,
  unansweredCount,
  hasManualReviewQuestions,
  connectionNotice,
  recoveryNotice,
  pendingSubmitRetry,
  saveRetryPending,
  actionError,
  answeredQuestionIds,
  currentQuestion,
  currentAnswer,
  onSaveAttempt,
  onToggleFullscreen,
  onSubmitAttempt,
  onJumpToQuestion,
  onUpdateMultipleChoice,
  onUpdateSingleChoice,
  onUpdateDescriptiveAnswer,
  onUpdateMatrixSelection,
  onClearCurrentAnswer,
}: StudentTestActiveAttemptViewProps) {
  const subjectProgress = useMemo(() => {
    const progressMap = new Map<
      string,
      { _id: string; name: string; answered: number; total: number }
    >();

    questionList.forEach((item) => {
      const fallbackSubject =
        paperSubjects.length === 1 ? paperSubjects[0] : null;
      const subject = item.question.subject || fallbackSubject;
      const subjectId = String(subject?._id || "unknown-subject").trim();
      const subjectName =
        String(subject?.name || "").trim() || "Unknown Subject";
      const current = progressMap.get(subjectId) || {
        _id: subjectId,
        name: subjectName,
        answered: 0,
        total: 0,
      };

      current.total += 1;
      if (answeredQuestionIds.has(item.question._id)) {
        current.answered += 1;
      }

      progressMap.set(subjectId, current);
    });

    return Array.from(progressMap.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [answeredQuestionIds, paperSubjects, questionList]);

  const currentQuestionAnswered = currentQuestion
    ? answeredQuestionIds.has(currentQuestion.question._id)
    : false;
  const currentQuestionHtml = useMemo(
    () => (currentQuestion ? currentQuestion.question.content : ""),
    [currentQuestion],
  );
  const currentOptionHtml = useMemo(
    () =>
      Array.isArray(currentQuestion?.question.options)
        ? currentQuestion.question.options.map((option) => option.content)
        : [],
    [currentQuestion],
  );

  return (
    <div
      ref={examContainerRef}
      className={cn(
        "app-page-shell app-exam-focus-shell max-w-[96rem] px-3 py-3 sm:px-4 sm:py-4",
        isFullscreen && "app-exam-focus-shell-fullscreen",
      )}
    >
      <div className="app-exam-focus-topbar">
        <div className="app-exam-focus-topbar-copy">
          <p className="app-kicker">Test session</p>
          <h1 className="text-[1.35rem] font-semibold leading-tight tracking-[-0.026em] text-foreground sm:text-[1.6rem]">
            {paper.title}
          </h1>
          <p className="app-copy-muted">
            {[paperSubjectLabel, paperClassLabel].filter(Boolean).join(" • ") ||
              `${questionList.length} questions`}
          </p>
          {paperSubjects.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {paperSubjects.map((subject) => (
                <span key={subject._id} className="app-meta-chip">
                  {subject.name || subject._id}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="app-exam-focus-topbar-meta">
          <span className="app-meta-chip">
            Time left <StudentTestCountdownText deadlineAt={deadlineAt} />
          </span>
          <span className="app-meta-chip">
            {answeredCount}/{questionList.length} answered
          </span>
          <span className="app-meta-chip">
            Question {Math.min(currentIndex + 1, questionList.length)} of {questionList.length}
          </span>
          <span className="app-meta-chip">
            Status {saveStatusLabel}
          </span>
        </div>
        <div className="app-exam-focus-topbar-actions">
          <Button
            type="button"
            variant="outline"
            size="md"
            className="app-student-action-compact"
            onClick={() => void onSaveAttempt(true)}
            disabled={isSaving || isSubmitting}
          >
            {isSaving ? <Spinner /> : "Save Progress"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="md"
            className="app-student-action-compact"
            onClick={() => void onToggleFullscreen()}
          >
            {isFullscreen ? (
              <Minimize2 className="mr-2 h-4 w-4" />
            ) : (
              <Expand className="mr-2 h-4 w-4" />
            )}
            {isFullscreen ? "Exit Full Screen" : "Full Screen"}
          </Button>

          <AlertDialog
            open={submitDialogOpen}
            onOpenChange={setSubmitDialogOpen}
          >
            <AlertDialogTrigger asChild>
              <Button
                size="md"
                className="app-student-action-compact"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Spinner /> : "Submit Test"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Submit this test?</AlertDialogTitle>
                <AlertDialogDescription>
                  You have answered {answeredCount} of {questionList.length} questions.
                  {unansweredCount > 0
                    ? ` ${unansweredCount} question${unansweredCount === 1 ? "" : "s"} will be left unanswered.`
                    : " All questions have a saved answer."}
                  {hasManualReviewQuestions
                    ? " Descriptive responses may remain pending review after submission."
                    : ""}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSubmitting}>
                  Continue Reviewing
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void onSubmitAttempt(false)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Spinner /> : "Confirm Submit"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {connectionNotice ? (
        <FeedbackNotice variant="warning">{connectionNotice}</FeedbackNotice>
      ) : null}

      {recoveryNotice ? (
        <FeedbackNotice variant="info">{recoveryNotice}</FeedbackNotice>
      ) : null}

      {pendingSubmitRetry ? (
        <FeedbackNotice variant="warning">
          Submission is pending because your connection is unstable. Keep this tab open and we will continue retrying automatically.
        </FeedbackNotice>
      ) : null}

      {saveRetryPending && !pendingSubmitRetry ? (
        <FeedbackNotice variant="info">
          Save retry queued in the background. Your latest answers are safe on this device.
        </FeedbackNotice>
      ) : null}

      {actionError ? (
        <FeedbackNotice variant="error">{actionError}</FeedbackNotice>
      ) : null}

      <div className="app-exam-shell app-exam-shell-focus">
        <aside className="app-exam-sidebar app-exam-sidebar-focus">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Question Navigation</CardTitle>
                <span className="app-meta-chip">
                  {answeredCount}/{questionList.length} answered
                </span>
              </div>
            </CardHeader>
            <CardContent className="app-section-body space-y-3.5">
              <div className="flex items-center justify-between rounded-[1rem] border border-border/60 bg-[hsl(var(--app-surface-2)/0.58)] px-3 py-2 app-copy-meta font-medium">
                <span>{unansweredCount} unanswered</span>
                <span>
                  <StudentTestCountdownText deadlineAt={deadlineAt} /> left
                </span>
              </div>
              {subjectProgress.length > 1 ? (
                <div className="rounded-[1.1rem] border border-border/60 bg-muted/15 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Subject progress
                  </p>
                  <div className="space-y-2">
                    {subjectProgress.map((subject) => (
                      <div
                        key={subject._id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="font-medium text-foreground">
                          {subject.name}
                        </span>
                        <span className="text-muted-foreground">
                          {subject.answered}/{subject.total}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="app-exam-palette">
                {questionList.map((item, index) => {
                  const selected = answeredQuestionIds.has(item.question._id);
                  const active = index === currentIndex;

                  return (
                    <button
                      key={item.question._id}
                      type="button"
                      onClick={() => void onJumpToQuestion(index)}
                      className={cn(
                        "app-exam-palette-button",
                        active && "app-exam-palette-button-active",
                        !active &&
                          selected &&
                          "app-exam-palette-button-complete",
                      )}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>

              <div className="app-exam-palette-legend">
                <div className="app-exam-palette-legend-item">
                  <span className="app-exam-palette-swatch bg-primary" />
                  Current
                </div>
                <div className="app-exam-palette-legend-item">
                  <span className="app-exam-palette-swatch bg-emerald-400" />
                  Answered
                </div>
                <div className="app-exam-palette-legend-item">
                  <span className="app-exam-palette-swatch bg-muted" />
                  Unanswered
                </div>
              </div>

              {paper.instructions ? (
                <details className="rounded-[1.35rem] border border-border/60 bg-muted/15 px-4 py-3">
                  <summary className="app-title-sm cursor-pointer">
                    View instructions
                  </summary>
                  <div className="prose prose-sm mt-3 max-w-none text-foreground dark:prose-invert">
                    <p>{paper.instructions}</p>
                  </div>
                </details>
              ) : null}
            </CardContent>
          </Card>
        </aside>

        <main className="app-exam-main-focus">
          {currentQuestion && currentAnswer ? (
            <Card className="app-surface app-exam-question-card overflow-hidden">
              <CardHeader className="app-section-header">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <p className="app-spotlight-label">{currentQuestion.sectionName}</p>
                    <CardTitle className="text-2xl tracking-tight">
                      Question {currentIndex + 1} of {questionList.length}
                    </CardTitle>
                    {currentQuestion.sectionDescription ? (
                      <p className="app-copy-muted max-w-3xl">
                        {currentQuestion.sectionDescription}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {currentQuestion.question.subject?.name ? (
                      <div className="app-meta-chip">
                        {currentQuestion.question.subject.name}
                      </div>
                    ) : null}
                    <div className="app-meta-chip capitalize">
                      {currentQuestion.question.type.replace("-", " ")}
                    </div>
                    <div className="app-meta-chip">
                      {currentQuestion.marks} mark(s)
                    </div>
                    {currentQuestion.negativeMarks > 0 ? (
                      <div className="app-meta-chip">
                        -{currentQuestion.negativeMarks} negative
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="app-section-body app-exam-question-body app-exam-question-shell">
                <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
                  <ContentRenderer htmlContent={currentQuestionHtml} />
                </div>

                {currentQuestion.question.type === "single" ||
                currentQuestion.question.type === "multiple" ? (
                  <div className="space-y-3.5">
                    {currentQuestion.question.options.map((option, optionIndex) => {
                      const selected =
                        currentAnswer.selectedOptions.includes(optionIndex);

                      return (
                        <label
                          key={optionIndex}
                          className={cn(
                            "app-exam-option",
                            selected && "app-exam-option-selected",
                          )}
                        >
                          <input
                            type={
                              currentQuestion.question.type === "multiple"
                                ? "checkbox"
                                : "radio"
                            }
                            name={currentQuestion.question._id}
                            checked={selected}
                            aria-label={`Option ${getOptionLabel(optionIndex)}`}
                            onChange={() => {
                              if (currentQuestion.question.type === "multiple") {
                                onUpdateMultipleChoice(
                                  currentQuestion.question._id,
                                  optionIndex,
                                );
                                return;
                              }
                              onUpdateSingleChoice(
                                currentQuestion.question._id,
                                optionIndex,
                              );
                            }}
                            className="sr-only"
                          />
                          <span
                            className={cn(
                              "app-exam-option-indicator",
                              selected &&
                                "app-exam-option-indicator-selected",
                            )}
                          >
                            {getOptionLabel(optionIndex)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
                              <ContentRenderer
                                htmlContent={currentOptionHtml[optionIndex] || ""}
                              />
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : null}

                {currentQuestion.question.type === "descriptive" ? (
                  <div className="space-y-3">
                    <Textarea
                      value={currentAnswer.answerText}
                      onChange={(event) =>
                        onUpdateDescriptiveAnswer(
                          currentQuestion.question,
                          event.target.value,
                        )
                      }
                      placeholder="Write your answer here..."
                      className="min-h-[240px]"
                    />
                  </div>
                ) : null}

                {currentQuestion.question.type === "matrix-match" ? (
                  currentQuestion.question.matrixRows?.length &&
                  currentQuestion.question.matrixColumns?.length ? (
                    <div className="app-table-wrap overflow-x-auto">
                      <table className="min-w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-muted/30">
                            <th className="border border-border/60 px-3 py-2.5 text-left text-[12px] font-medium tracking-[0.03em] text-muted-foreground">
                              Match
                            </th>
                            {currentQuestion.question.matrixColumns.map(
                              (column, columnIndex) => (
                                <th
                                  key={columnIndex}
                                  className="border border-border/60 px-3 py-2.5 text-center text-[12px] font-medium tracking-[0.03em] text-muted-foreground"
                                >
                                  {column || `Column ${columnIndex + 1}`}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {currentQuestion.question.matrixRows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              <td className="border border-border/60 px-3 py-3 font-medium text-foreground">
                                {row || `Row ${rowIndex + 1}`}
                              </td>
                              {currentQuestion.question.matrixColumns?.map(
                                (_column, columnIndex) => {
                                  const checked =
                                    currentAnswer.matrixSelections[rowIndex]?.includes(
                                      columnIndex,
                                    ) || false;

                                  return (
                                    <td
                                      key={columnIndex}
                                      className="border border-border/60 px-3 py-3 text-center"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() =>
                                          onUpdateMatrixSelection(
                                            currentQuestion.question,
                                            rowIndex,
                                            columnIndex,
                                          )
                                        }
                                        className="h-4 w-4"
                                      />
                                    </td>
                                  );
                                },
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <FeedbackNotice variant="error">
                      This matrix question is missing row or column labels and cannot be answered online.
                    </FeedbackNotice>
                  )
                ) : null}

                <div className="app-exam-nav-row">
                  <Button
                    variant="outline"
                    size="md"
                    className="app-student-action-compact"
                    onClick={() =>
                      void onJumpToQuestion(Math.max(0, currentIndex - 1))
                    }
                    disabled={currentIndex === 0}
                  >
                    Previous
                  </Button>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="md"
                      className="app-student-action-compact"
                      onClick={onClearCurrentAnswer}
                      disabled={!currentQuestionAnswered}
                    >
                      Clear Answer
                    </Button>
                    <Button
                      variant="outline"
                      size="md"
                      className="app-student-action-compact"
                      onClick={() =>
                        void onJumpToQuestion(
                          Math.min(questionList.length - 1, currentIndex + 1),
                        )
                      }
                      disabled={currentIndex >= questionList.length - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="app-surface">
              <CardContent className="app-empty-state py-12">
                No questions are available in this paper.
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
