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
import { resolveSectionSubjects } from "@/lib/question-paper/subjects";

import type {
  StudentAnswerState,
  StudentPaper,
  StudentQuestion,
  StudentQuestionListItem,
} from "./student-test-types";

type CountdownTone = "normal" | "warning" | "danger";

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

function useCountdownRemaining(deadlineAt?: string | null) {
  const deadlineMs = useMemo(() => toTimestamp(deadlineAt), [deadlineAt]);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    if (!deadlineMs) {
      setNowMs(null);
      return;
    }

    const updateNow = () => {
      setNowMs(Date.now());
    };

    updateNow();
    const intervalId = window.setInterval(updateNow, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [deadlineMs]);

  return deadlineMs && nowMs !== null ? Math.max(0, deadlineMs - nowMs) : null;
}

function getCountdownTone(remainingMs: number | null): CountdownTone {
  if (remainingMs === null) return "normal";
  if (remainingMs <= 5 * 60 * 1000) return "danger";
  if (remainingMs <= 15 * 60 * 1000) return "warning";
  return "normal";
}

function getCountdownBadgeLabel(remainingMs: number | null) {
  if (remainingMs === null) return "No timer";
  if (remainingMs <= 5 * 60 * 1000) return "Last 5 min";
  if (remainingMs <= 15 * 60 * 1000) return "Final 15 min";
  return "On track";
}

function normalizeLabel(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function labelsMatch(left: unknown, right: unknown) {
  const normalizedLeft = normalizeLabel(left);
  const normalizedRight = normalizeLabel(right);
  return Boolean(normalizedLeft) && normalizedLeft === normalizedRight;
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
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

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
  const sectionNavigation = useMemo(() => {
    let runningIndex = 0;

    return (Array.isArray(paper.sections) ? paper.sections : [])
      .map((section, sectionIndex) => {
        const sectionQuestions = Array.isArray(section?.questions)
          ? section.questions
          : [];
        const items = sectionQuestions.map((entry, questionIndex) => {
          const globalIndex = runningIndex + questionIndex;
          const questionId = String(entry?.question?._id || "").trim();

          return {
            questionId,
            globalIndex,
            answered: questionId ? answeredQuestionIds.has(questionId) : false,
          };
        });
        runningIndex += sectionQuestions.length;

        return {
          id: `${sectionIndex}-${String(section?.name || "section").trim()}`,
          sectionIndex,
          name: String(section?.name || "").trim() || `Section ${sectionIndex + 1}`,
          description: String(section?.description || "").trim(),
          instructions: String(section?.instructions || "").trim(),
          defaultMarks: Number(section?.defaultMarks || 0),
          defaultNegativeMarks: Number(section?.defaultNegativeMarks || 0),
          totalMarks: Number(section?.marks || 0),
          subjects: resolveSectionSubjects(section, paperSubjects),
          items,
        };
      })
      .filter((section) => section.items.length > 0);
  }, [answeredQuestionIds, paper.sections, paperSubjects]);
  const currentSection = useMemo(
    () =>
      sectionNavigation.find((section) =>
        section.items.some((item) => item.globalIndex === currentIndex),
      ) || null,
    [currentIndex, sectionNavigation],
  );

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
  const remainingMs = useCountdownRemaining(deadlineAt);
  const countdownTone = getCountdownTone(remainingMs);
  const countdownValue = formatRemainingTime(remainingMs);
  const totalQuestions = questionList.length;
  const currentQuestionNumber = totalQuestions
    ? Math.min(currentIndex + 1, totalQuestions)
    : 0;
  const saveStateToneClass =
    isSubmitting || isSaving
      ? "app-status-badge-info"
      : actionError
        ? "app-status-badge-danger"
        : pendingSubmitRetry || saveRetryPending
          ? "app-status-badge-warning"
          : "app-status-badge-success";
  const saveStateBadgeLabel = isSubmitting
    ? "Submitting"
    : isSaving
      ? "Syncing"
      : actionError
        ? "Needs check"
        : pendingSubmitRetry || saveRetryPending
      ? "Retrying"
      : "Protected";
  const currentSectionRuleLabel = currentSection
    ? `+${currentSection.defaultMarks || currentQuestion?.marks || 0} / -${currentSection.defaultNegativeMarks || currentQuestion?.negativeMarks || 0}`
    : `+${currentQuestion?.marks || 0} / -${currentQuestion?.negativeMarks || 0}`;
  const showPaperSubjectChips = paperSubjects.length > 1;
  const answeredCompactLabel = totalQuestions
    ? `${answeredCount}/${totalQuestions}`
    : "—";
  const showCurrentSectionChip = Boolean(
    currentSection &&
      (sectionNavigation.length > 1 ||
        !labelsMatch(currentSection.name, paperSubjectLabel)),
  );
  const showQuestionEyebrow = Boolean(
    currentQuestion?.sectionName &&
      (sectionNavigation.length > 1 ||
        !labelsMatch(currentQuestion.sectionName, paperSubjectLabel)),
  );
  const currentQuestionSubjectName = String(
    currentQuestion?.question.subject?.name || "",
  ).trim();
  const showQuestionSubjectChip = Boolean(
    currentQuestionSubjectName &&
      !labelsMatch(currentQuestionSubjectName, paperSubjectLabel) &&
      !labelsMatch(currentQuestionSubjectName, currentQuestion?.sectionName),
  );
  const visibleCurrentSectionSubjects = currentSection
    ? currentSection.subjects.filter((subject) => {
        const subjectLabel = String(subject?.name || subject?._id || "").trim();
        if (!subjectLabel) {
          return false;
        }

        if (currentSection.subjects.length > 1) {
          return true;
        }

        return (
          !labelsMatch(subjectLabel, currentQuestion?.sectionName) &&
          !labelsMatch(subjectLabel, paperSubjectLabel)
        );
      })
    : [];

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
          <h1 className="text-[1.25rem] font-semibold leading-tight tracking-[-0.024em] text-foreground sm:text-[1.45rem]">
            {paper.title}
          </h1>
          <p className="app-copy-muted">
            {[paperSubjectLabel, paperClassLabel, `${paper.duration} min`]
              .filter(Boolean)
              .join(" • ") ||
              `${questionList.length} questions`}
          </p>
          {showPaperSubjectChips ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {paperSubjects.map((subject) => (
                <span key={subject._id} className="app-meta-chip">
                  {subject.name || subject._id}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="app-exam-focus-topbar-status" aria-label="Test status">
          <div className="app-exam-focus-topbar-stat">
            <span className="app-exam-focus-topbar-stat-label">Answered</span>
            <span className="app-exam-focus-topbar-stat-value">
              {answeredCompactLabel}
            </span>
          </div>
          {showCurrentSectionChip && currentSection ? (
            <div className="app-exam-focus-topbar-stat">
              <span className="app-exam-focus-topbar-stat-label">Current</span>
              <span
                className="app-exam-focus-topbar-stat-value app-exam-focus-topbar-stat-value-soft"
                title={currentSection.name}
              >
                {currentSection.name}
              </span>
            </div>
          ) : null}
          <div className="app-exam-focus-topbar-stat">
            <span className="app-exam-focus-topbar-stat-label">Save</span>
            <span className={cn("app-status-badge w-fit", saveStateToneClass)}>
              {saveStateBadgeLabel}
            </span>
          </div>
        </div>
        <div className="app-exam-focus-topbar-side">
          <div
            className={cn(
              "app-exam-timer-card",
              countdownTone === "warning" && "app-exam-timer-card-warning",
              countdownTone === "danger" && "app-exam-timer-card-danger",
            )}
          >
            <div className="app-exam-timer-card-head">
              <p className="app-exam-timer-card-kicker">Time left</p>
              <span
                className={cn(
                  "app-status-badge w-fit",
                  countdownTone === "warning"
                    ? "app-status-badge-warning"
                    : countdownTone === "danger"
                      ? "app-status-badge-danger"
                      : "app-status-badge-info",
                )}
              >
                {getCountdownBadgeLabel(remainingMs)}
              </span>
            </div>
            <div className="app-exam-timer-card-value" suppressHydrationWarning>
              {countdownValue}
            </div>
          </div>
          <div
            className="app-exam-focus-topbar-actions"
            role="group"
            aria-label="Test actions"
          >
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="app-button-compact app-exam-topbar-action"
              onClick={() => void onSaveAttempt(true)}
              disabled={isSaving || isSubmitting}
            >
              {isSaving ? <Spinner /> : "Save"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="app-button-compact app-exam-topbar-action"
              onClick={() => void onToggleFullscreen()}
            >
              {isFullscreen ? (
                <Minimize2 className="mr-2 h-4 w-4" />
              ) : (
                <Expand className="mr-2 h-4 w-4" />
              )}
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </Button>

            {hasMounted ? (
              <AlertDialog
                open={submitDialogOpen}
                onOpenChange={setSubmitDialogOpen}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="app-button-compact app-exam-topbar-action"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <Spinner /> : "Submit"}
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
            ) : (
              <Button
                type="button"
                size="sm"
                className="app-button-compact app-exam-topbar-action"
                disabled
              >
                Submit
              </Button>
            )}
          </div>
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
          Submission is pending due to connection issues. Keep this tab open while we retry.
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
            <CardContent className="app-section-body space-y-3">
              <div className="app-exam-sidebar-summary">
                <div className="app-exam-sidebar-summary-card">
                  <span className="app-exam-sidebar-summary-label">Answered</span>
                  <span className="app-exam-sidebar-summary-value">{answeredCount}</span>
                  <span className="app-exam-sidebar-summary-meta">Saved responses</span>
                </div>
                <div className="app-exam-sidebar-summary-card">
                  <span className="app-exam-sidebar-summary-label">Remaining</span>
                  <span className="app-exam-sidebar-summary-value">{unansweredCount}</span>
                  <span className="app-exam-sidebar-summary-meta">Still to review</span>
                </div>
                <div className="app-exam-sidebar-summary-card">
                  <span className="app-exam-sidebar-summary-label">Current</span>
                  <span className="app-exam-sidebar-summary-value">
                    Q {currentQuestionNumber || "—"}
                  </span>
                  <span className="app-exam-sidebar-summary-meta">
                    Jump with the palette
                  </span>
                </div>
              </div>
              {subjectProgress.length > 1 ? (
                <div className="app-exam-sidebar-panel">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
              <div className="space-y-3">
                {sectionNavigation.map((section) => {
                  const sectionActive = section.items.some(
                    (item) => item.globalIndex === currentIndex,
                  );

                  return (
                    <div key={section.id} className="app-exam-sidebar-panel">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {`Section ${section.sectionIndex + 1}: ${section.name}`}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {section.items.length} question
                            {section.items.length === 1 ? "" : "s"} • {section.totalMarks} marks • +{section.defaultMarks} / -{section.defaultNegativeMarks}
                          </p>
                        </div>
                        {sectionActive ? (
                          <span className="app-status-badge app-status-badge-info w-fit">
                            Current
                          </span>
                        ) : null}
                      </div>
                      {section.subjects.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {section.subjects.map((subject) => (
                            <span
                              key={`${section.id}-${subject._id}`}
                              className="app-meta-chip"
                            >
                              {subject.name || subject._id}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="app-exam-palette mt-3">
                        {section.items.map((item) => (
                          <button
                            key={`${section.id}-${item.questionId || item.globalIndex}`}
                            type="button"
                            onClick={() => void onJumpToQuestion(item.globalIndex)}
                            className={cn(
                              "app-exam-palette-button",
                              item.globalIndex === currentIndex &&
                                "app-exam-palette-button-active",
                              item.globalIndex !== currentIndex &&
                                item.answered &&
                                "app-exam-palette-button-complete",
                            )}
                          >
                            {item.globalIndex + 1}
                          </button>
                        ))}
                      </div>
                    </div>
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
                <details className="app-exam-sidebar-panel px-3.5 py-2.5">
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
                    {showQuestionEyebrow ? (
                      <p className="app-spotlight-label">
                        {currentQuestion.sectionName}
                      </p>
                    ) : null}
                    <CardTitle className="text-xl tracking-tight sm:text-2xl">
                      Question {currentIndex + 1} of {questionList.length}
                    </CardTitle>
                    {currentQuestion.sectionDescription ? (
                      <p className="app-copy-muted max-w-3xl">
                        {currentQuestion.sectionDescription}
                      </p>
                    ) : null}
                    {currentSection ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {visibleCurrentSectionSubjects.map((subject) => (
                          <span
                            key={`${currentSection.id}-${subject._id}`}
                            className="app-meta-chip"
                          >
                            {subject.name || subject._id}
                          </span>
                        ))}
                        <span className="app-meta-chip">
                          Rule {currentSectionRuleLabel}
                          {currentSection.totalMarks > 0
                            ? ` • ${currentSection.totalMarks} total`
                            : ""}
                        </span>
                      </div>
                    ) : null}
                    {currentQuestion.sectionInstructions ? (
                      <div className="rounded-[1.15rem] border border-border/60 bg-muted/15 px-4 py-3 text-sm leading-6 text-foreground/82">
                        {currentQuestion.sectionInstructions}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {showQuestionSubjectChip ? (
                      <div className="app-meta-chip">
                        {currentQuestionSubjectName}
                      </div>
                    ) : null}
                    <div className="app-meta-chip">
                      {currentQuestion.marks} mark
                      {currentQuestion.marks === 1 ? "" : "s"}
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
                  <div className="space-y-3">
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
                      className="min-h-[220px]"
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
                      variant="ghost"
                      size="md"
                      className="app-student-action-compact"
                      onClick={onClearCurrentAnswer}
                      disabled={!currentQuestionAnswered}
                    >
                      Clear Answer
                    </Button>
                    <Button
                      variant="primary"
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
              <CardContent className="app-empty-state py-10">
                No questions are available in this paper.
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
