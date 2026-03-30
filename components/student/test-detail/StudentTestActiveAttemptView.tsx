"use client";

import {
  forwardRef,
  memo,
  startTransition,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronUp, Expand, Minimize2 } from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const DESCRIPTIVE_SYNC_DEBOUNCE_MS = 220;

type DescriptiveAnswerEditorHandle = {
  flush: () => void;
};

type DescriptiveAnswerEditorProps = {
  question: StudentQuestion;
  value: string;
  onCommit: (question: StudentQuestion, value: string) => void;
};

const DescriptiveAnswerEditor = memo(
  forwardRef<DescriptiveAnswerEditorHandle, DescriptiveAnswerEditorProps>(
    function DescriptiveAnswerEditor({ question, value, onCommit }, ref) {
      const [draftValue, setDraftValue] = useState(value);
      const draftValueRef = useRef(value);
      const lastCommittedValueRef = useRef(value);
      const syncTimerRef = useRef<number | null>(null);

      const clearSyncTimer = useCallback(() => {
        if (syncTimerRef.current !== null) {
          window.clearTimeout(syncTimerRef.current);
          syncTimerRef.current = null;
        }
      }, []);

      const commitValue = useCallback(
        (nextValue: string, immediate = false) => {
          if (nextValue === lastCommittedValueRef.current) {
            return;
          }

          lastCommittedValueRef.current = nextValue;
          if (immediate) {
            onCommit(question, nextValue);
            return;
          }

          startTransition(() => {
            onCommit(question, nextValue);
          });
        },
        [onCommit, question],
      );

      const flushDraft = useCallback(() => {
        clearSyncTimer();
        commitValue(draftValueRef.current, true);
      }, [clearSyncTimer, commitValue]);

      useImperativeHandle(
        ref,
        () => ({
          flush: flushDraft,
        }),
        [flushDraft],
      );

      useEffect(() => {
        clearSyncTimer();
        setDraftValue(value);
        draftValueRef.current = value;
        lastCommittedValueRef.current = value;
      }, [clearSyncTimer, question._id, value]);

      useEffect(() => {
        if (draftValue === lastCommittedValueRef.current) {
          clearSyncTimer();
          return;
        }

        clearSyncTimer();
        syncTimerRef.current = window.setTimeout(() => {
          syncTimerRef.current = null;
          commitValue(draftValueRef.current);
        }, DESCRIPTIVE_SYNC_DEBOUNCE_MS);

        return clearSyncTimer;
      }, [clearSyncTimer, commitValue, draftValue]);

      useEffect(() => {
        if (typeof window === "undefined" || typeof document === "undefined") {
          return;
        }

        const handlePageHide = () => {
          flushDraft();
        };

        const handleVisibilityChange = () => {
          if (document.visibilityState === "hidden") {
            flushDraft();
          }
        };

        window.addEventListener("pagehide", handlePageHide);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
          window.removeEventListener("pagehide", handlePageHide);
          document.removeEventListener("visibilitychange", handleVisibilityChange);
          flushDraft();
        };
      }, [flushDraft]);

      return (
        <Textarea
          value={draftValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            draftValueRef.current = nextValue;
            setDraftValue(nextValue);
          }}
          onBlur={flushDraft}
          placeholder="Write your answer here..."
          className="min-h-[220px]"
        />
      );
    },
  ),
);
DescriptiveAnswerEditor.displayName = "DescriptiveAnswerEditor";

type SubjectProgressItem = {
  _id: string;
  name: string;
  answered: number;
  total: number;
};

type SectionNavigationGroup = {
  id: string;
  sectionIndex: number;
  name: string;
  description: string;
  instructions: string;
  defaultMarks: number;
  defaultNegativeMarks: number;
  totalMarks: number;
  subjects: Array<{ _id: string; name: string }>;
  items: Array<{
    questionId: string;
    globalIndex: number;
    answered: boolean;
  }>;
};

const CountdownStatusCard = memo(function CountdownStatusCard({
  deadlineAt,
}: {
  deadlineAt: string | null;
}) {
  const remainingMs = useCountdownRemaining(deadlineAt);
  const countdownTone = getCountdownTone(remainingMs);
  const countdownValue = formatRemainingTime(remainingMs);

  return (
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
  );
});

type ExamTopbarProps = {
  paper: StudentPaper;
  paperSubjects: Array<{ _id: string; name: string }>;
  paperSubjectLabel: string;
  paperClassLabel: string;
  deadlineAt: string | null;
  answeredCompactLabel: string;
  currentSectionName: string | null;
  showCurrentSectionChip: boolean;
  saveStateToneClass: string;
  saveStateBadgeLabel: string;
  saveStatusLabel: string;
  submitDialogOpen: boolean;
  setSubmitDialogOpen: (open: boolean) => void;
  answeredCount: number;
  questionCount: number;
  unansweredCount: number;
  hasManualReviewQuestions: boolean;
  isSaving: boolean;
  isSubmitting: boolean;
  isFullscreen: boolean;
  onSaveAttempt: (force?: boolean) => Promise<void>;
  onToggleFullscreen: () => Promise<void>;
  onSubmitAttempt: (auto?: boolean) => Promise<void>;
};

const ExamTopbar = memo(function ExamTopbar({
  paper,
  paperSubjects,
  paperSubjectLabel,
  paperClassLabel,
  deadlineAt,
  answeredCompactLabel,
  currentSectionName,
  showCurrentSectionChip,
  saveStateToneClass,
  saveStateBadgeLabel,
  saveStatusLabel,
  submitDialogOpen,
  setSubmitDialogOpen,
  answeredCount,
  questionCount,
  unansweredCount,
  hasManualReviewQuestions,
  isSaving,
  isSubmitting,
  isFullscreen,
  onSaveAttempt,
  onToggleFullscreen,
  onSubmitAttempt,
}: ExamTopbarProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const showPaperSubjectChips = paperSubjects.length > 1;

  return (
    <div className="app-exam-focus-topbar">
      <div className="app-exam-focus-topbar-copy">
        <h1 className="app-exam-focus-topbar-title text-[1.25rem] font-semibold leading-tight tracking-[-0.024em] text-foreground sm:text-[1.45rem]">
          {paper.title}
        </h1>
        <p className="app-copy-muted app-exam-focus-topbar-subtitle">
          {[paperSubjectLabel, paperClassLabel, `${paper.duration} min`]
            .filter(Boolean)
            .join(" • ") || `${questionCount} questions`}
        </p>
        {showPaperSubjectChips ? (
          <div className="mt-1.5 hidden flex-wrap gap-1.5 sm:flex">
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
        {showCurrentSectionChip && currentSectionName ? (
          <div className="app-exam-focus-topbar-stat app-exam-focus-topbar-stat-current">
            <span className="app-exam-focus-topbar-stat-label">Current</span>
            <span
              className="app-exam-focus-topbar-stat-value app-exam-focus-topbar-stat-value-soft"
              title={currentSectionName}
            >
              {currentSectionName}
            </span>
          </div>
        ) : null}
        <div className="app-exam-focus-topbar-stat">
          <span className="app-exam-focus-topbar-stat-label">Save</span>
          <span
            className={cn("app-status-badge w-fit", saveStateToneClass)}
            title={saveStatusLabel}
          >
            {saveStateBadgeLabel}
          </span>
        </div>
      </div>
      <div className="app-exam-focus-topbar-side">
        <CountdownStatusCard deadlineAt={deadlineAt} />
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
              <Minimize2 className="mr-1.5 h-4 w-4 sm:mr-2" />
            ) : (
              <Expand className="mr-1.5 h-4 w-4 sm:mr-2" />
            )}
            {isFullscreen ? (
              <>
                <span className="sm:hidden">Exit</span>
                <span className="hidden sm:inline">Exit fullscreen</span>
              </>
            ) : (
              <>
                <span className="sm:hidden">Screen</span>
                <span className="hidden sm:inline">Fullscreen</span>
              </>
            )}
          </Button>

          {hasMounted ? (
            <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  className="app-button-compact app-exam-topbar-action app-exam-topbar-action-submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Spinner /> : "Submit"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Submit this test?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You have answered {answeredCount} of {questionCount} questions.
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
              className="app-button-compact app-exam-topbar-action app-exam-topbar-action-submit"
              disabled
            >
              Submit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

type ExamSidebarProps = {
  answeredCount: number;
  questionCount: number;
  unansweredCount: number;
  currentQuestionNumber: number;
  subjectProgress: SubjectProgressItem[];
  sectionNavigation: SectionNavigationGroup[];
  currentIndex: number;
  instructions: string;
  onJumpToQuestion: (index: number) => Promise<void>;
};

const ExamSidebar = memo(function ExamSidebar({
  answeredCount,
  questionCount,
  unansweredCount,
  currentQuestionNumber,
  subjectProgress,
  sectionNavigation,
  currentIndex,
  instructions,
  onJumpToQuestion,
}: ExamSidebarProps) {
  return (
    <aside className="app-exam-sidebar app-exam-sidebar-focus hidden xl:block">
      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Question Navigation</CardTitle>
            <span className="app-meta-chip">
              {answeredCount}/{questionCount} answered
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
                    <span className="font-medium text-foreground">{subject.name}</span>
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
                        {section.items.length === 1 ? "" : "s"} • {section.totalMarks} marks
                        • +{section.defaultMarks} / -{section.defaultNegativeMarks}
                      </p>
                    </div>
                    {sectionActive ? (
                      <span className="app-status-badge app-status-badge-info w-fit">
                        Current
                      </span>
                    ) : null}
                  </div>
                  {section.subjects.length > 0 ? (
                    <div className="app-exam-sidebar-subjects mt-2 flex flex-wrap gap-1.5">
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

          {instructions ? (
            <details className="app-exam-sidebar-panel px-3.5 py-2.5">
              <summary className="app-title-sm cursor-pointer">
                View instructions
              </summary>
              <div className="prose prose-sm mt-3 max-w-none text-foreground dark:prose-invert">
                <p>{instructions}</p>
              </div>
            </details>
          ) : null}
        </CardContent>
      </Card>
    </aside>
  );
});

type ExamMobileNavigationProps = {
  answeredCount: number;
  questionCount: number;
  unansweredCount: number;
  currentQuestionNumber: number;
  currentIndex: number;
  currentSectionName: string | null;
  saveStateToneClass: string;
  saveStateBadgeLabel: string;
  subjectProgress: SubjectProgressItem[];
  sectionNavigation: SectionNavigationGroup[];
  instructions: string;
  onJumpToQuestion: (index: number) => Promise<void>;
};

const ExamMobileNavigation = memo(function ExamMobileNavigation({
  answeredCount,
  questionCount,
  unansweredCount,
  currentQuestionNumber,
  currentIndex,
  currentSectionName,
  saveStateToneClass,
  saveStateBadgeLabel,
  subjectProgress,
  sectionNavigation,
  instructions,
  onJumpToQuestion,
}: ExamMobileNavigationProps) {
  const activeSectionId = useMemo(() => {
    const activeSection = sectionNavigation.find((section) =>
      section.items.some((item) => item.globalIndex === currentIndex),
    );

    return activeSection?.id ?? sectionNavigation[0]?.id ?? null;
  }, [currentIndex, sectionNavigation]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    activeSectionId,
  );

  useEffect(() => {
    setSelectedSectionId(activeSectionId);
  }, [activeSectionId]);

  const selectedSection = useMemo(() => {
    return (
      sectionNavigation.find((section) => section.id === selectedSectionId) ??
      sectionNavigation.find((section) => section.id === activeSectionId) ??
      sectionNavigation[0] ??
      null
    );
  }, [activeSectionId, sectionNavigation, selectedSectionId]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleOpenSheet = useCallback(() => {
    setSelectedSectionId(activeSectionId);
    setSheetOpen(true);
  }, [activeSectionId]);

  const handleJumpFromSheet = useCallback(
    async (index: number) => {
      setSheetOpen(false);
      await onJumpToQuestion(index);
    },
    [onJumpToQuestion],
  );

  return (
    <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
      <div className="app-exam-mobile-nav-bar xl:hidden" aria-label="Question navigation">
        <div className="app-exam-mobile-nav-bar-copy">
          <p className="app-exam-mobile-nav-bar-label">
            Question {currentQuestionNumber || "—"} of {questionCount || "—"}
          </p>
          <div className="app-exam-mobile-nav-bar-meta">
            <span className="app-exam-mobile-nav-bar-chip">
              {answeredCount}/{questionCount} answered
            </span>
            {unansweredCount > 0 ? (
              <span className="app-exam-mobile-nav-bar-chip">
                {unansweredCount} left
              </span>
            ) : null}
            {currentSectionName ? (
              <span
                className="app-exam-mobile-nav-bar-chip app-exam-mobile-nav-bar-chip-current"
                title={currentSectionName}
              >
                {currentSectionName}
              </span>
            ) : null}
          </div>
        </div>
        <div className="app-exam-mobile-nav-bar-actions">
          <span
            className={cn(
              "app-status-badge hidden min-[400px]:inline-flex",
              saveStateToneClass,
            )}
          >
            {saveStateBadgeLabel}
          </span>
          <Button
            type="button"
            size="sm"
            className="app-exam-mobile-nav-open"
            onClick={handleOpenSheet}
          >
            Questions
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <DialogContent className="app-exam-mobile-sheet inset-x-0 bottom-0 top-auto h-auto max-h-[min(82dvh,42rem)] w-screen translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 rounded-t-[calc(var(--app-radius-xl)+0.125rem)] rounded-b-none border-x-0 border-b-0 p-0 sm:inset-x-0 sm:bottom-0 sm:top-auto sm:h-auto sm:max-h-[min(82dvh,42rem)] sm:w-screen sm:max-w-none sm:translate-x-0 sm:translate-y-0 sm:rounded-t-[calc(var(--app-radius-xl)+0.125rem)] sm:rounded-b-none sm:border-x-0 sm:border-b-0 xl:hidden">
        <DialogHeader className="app-exam-mobile-sheet-header">
          <div className="app-exam-mobile-sheet-title-row">
            <div className="min-w-0">
              <DialogTitle>Question Navigation</DialogTitle>
              <p className="app-copy-meta">
                Question {currentQuestionNumber || "—"} of {questionCount || "—"}
              </p>
            </div>
            <span className={cn("app-status-badge w-fit", saveStateToneClass)}>
              {saveStateBadgeLabel}
            </span>
          </div>
        </DialogHeader>

        <div className="app-exam-mobile-sheet-body">
          <section className="app-exam-mobile-nav">
            <div className="app-exam-mobile-nav-summary">
              <span className="app-meta-chip">
                {answeredCount}/{questionCount} answered
              </span>
              {unansweredCount > 0 ? (
                <span className="app-meta-chip">{unansweredCount} left</span>
              ) : null}
              {currentSectionName ? (
                <span className="app-meta-chip" title={currentSectionName}>
                  {currentSectionName}
                </span>
              ) : null}
            </div>

            {sectionNavigation.length > 1 ? (
              <div className="app-exam-mobile-section-tabs" aria-label="Sections">
                {sectionNavigation.map((section) => {
                  const sectionIsSelected = section.id === selectedSection?.id;
                  const sectionIsCurrent = section.items.some(
                    (item) => item.globalIndex === currentIndex,
                  );

                  return (
                    <button
                      key={section.id}
                      type="button"
                      aria-pressed={sectionIsSelected}
                      className={cn(
                        "app-exam-mobile-section-tab",
                        sectionIsSelected && "app-exam-mobile-section-tab-active",
                      )}
                      onClick={() => setSelectedSectionId(section.id)}
                      title={`Section ${section.sectionIndex + 1}: ${section.name}`}
                    >
                      <span className="app-exam-mobile-section-tab-label">
                        {`Section ${section.sectionIndex + 1}`}
                      </span>
                      <span className="app-exam-mobile-section-tab-meta">
                        {section.items.length}Q
                      </span>
                      {sectionIsCurrent ? (
                        <span className="app-exam-mobile-section-tab-status">
                          Now
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {selectedSection ? (
              <div className="app-exam-mobile-section-panel">
                <div className="app-exam-mobile-section-panel-head">
                  <div className="app-exam-mobile-section-panel-copy">
                    <p className="app-title-sm">
                      {`Section ${selectedSection.sectionIndex + 1}: ${selectedSection.name}`}
                    </p>
                    <p className="app-copy-meta">
                      {selectedSection.items.length} question
                      {selectedSection.items.length === 1 ? "" : "s"} •{" "}
                      {selectedSection.totalMarks} marks • +
                      {selectedSection.defaultMarks} / -
                      {selectedSection.defaultNegativeMarks}
                    </p>
                  </div>
                  {selectedSection.id === activeSectionId ? (
                    <span className="app-status-badge app-status-badge-info w-fit">
                      Current
                    </span>
                  ) : null}
                </div>

                {selectedSection.subjects.length > 0 ? (
                  <div className="app-exam-mobile-section-meta">
                    {selectedSection.subjects.map((subject) => (
                      <span
                        key={`${selectedSection.id}-${subject._id}`}
                        className="app-meta-chip"
                      >
                        {subject.name || subject._id}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div
                  className="app-exam-mobile-palette-grid"
                  aria-label={`Question navigation for section ${selectedSection.sectionIndex + 1}`}
                >
                  {selectedSection.items.map((item) => (
                    <button
                      key={`${selectedSection.id}-${item.questionId || item.globalIndex}`}
                      type="button"
                      onClick={() => void handleJumpFromSheet(item.globalIndex)}
                      className={cn(
                        "app-exam-palette-button app-exam-mobile-palette-button",
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
            ) : null}

            {subjectProgress.length > 1 || instructions ? (
              <details className="app-exam-mobile-details">
                <summary className="app-title-sm cursor-pointer">
                  More details
                </summary>
                {subjectProgress.length > 1 ? (
                  <div className="app-exam-mobile-progress">
                    {subjectProgress.map((subject) => (
                      <div
                        key={subject._id}
                        className="app-exam-mobile-progress-item"
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
                ) : null}
                {instructions ? (
                  <div className="prose prose-sm mt-3 max-w-none text-foreground dark:prose-invert">
                    <p>{instructions}</p>
                  </div>
                ) : null}
              </details>
            ) : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
});

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
  const descriptiveEditorRef = useRef<DescriptiveAnswerEditorHandle | null>(null);
  const subjectProgress = useMemo<SubjectProgressItem[]>(() => {
    const progressMap = new Map<string, SubjectProgressItem>();

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
  const sectionNavigation = useMemo<SectionNavigationGroup[]>(() => {
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
  const flushDescriptiveAnswer = useCallback(() => {
    descriptiveEditorRef.current?.flush();
  }, []);
  const handleSaveAttempt = useCallback(
    async (force?: boolean) => {
      flushDescriptiveAnswer();
      await onSaveAttempt(force);
    },
    [flushDescriptiveAnswer, onSaveAttempt],
  );
  const handleSubmitAttempt = useCallback(
    async (auto?: boolean) => {
      flushDescriptiveAnswer();
      await onSubmitAttempt(auto);
    },
    [flushDescriptiveAnswer, onSubmitAttempt],
  );
  const handleJumpToQuestion = useCallback(
    async (index: number) => {
      flushDescriptiveAnswer();
      await onJumpToQuestion(index);
    },
    [flushDescriptiveAnswer, onJumpToQuestion],
  );
  const handleClearCurrentAnswer = useCallback(() => {
    flushDescriptiveAnswer();
    onClearCurrentAnswer();
  }, [flushDescriptiveAnswer, onClearCurrentAnswer]);

  return (
    <div
      ref={examContainerRef}
      className={cn(
        "app-page-shell app-exam-focus-shell max-w-[96rem] px-3 pt-3 pb-28 sm:px-4 sm:pt-4 sm:pb-32 xl:py-4",
        isFullscreen && "app-exam-focus-shell-fullscreen",
      )}
    >
      <ExamTopbar
        paper={paper}
        paperSubjects={paperSubjects}
        paperSubjectLabel={paperSubjectLabel}
        paperClassLabel={paperClassLabel}
        deadlineAt={deadlineAt}
        answeredCompactLabel={answeredCompactLabel}
        currentSectionName={currentSection?.name || null}
        showCurrentSectionChip={showCurrentSectionChip}
        saveStateToneClass={saveStateToneClass}
        saveStateBadgeLabel={saveStateBadgeLabel}
        saveStatusLabel={saveStatusLabel}
        submitDialogOpen={submitDialogOpen}
        setSubmitDialogOpen={setSubmitDialogOpen}
        answeredCount={answeredCount}
        questionCount={totalQuestions}
        unansweredCount={unansweredCount}
        hasManualReviewQuestions={hasManualReviewQuestions}
        isSaving={isSaving}
        isSubmitting={isSubmitting}
        isFullscreen={isFullscreen}
        onSaveAttempt={handleSaveAttempt}
        onToggleFullscreen={onToggleFullscreen}
        onSubmitAttempt={handleSubmitAttempt}
      />

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

      <ExamMobileNavigation
        answeredCount={answeredCount}
        questionCount={totalQuestions}
        unansweredCount={unansweredCount}
        currentQuestionNumber={currentQuestionNumber}
        currentIndex={currentIndex}
        currentSectionName={currentSection?.name || null}
        saveStateToneClass={saveStateToneClass}
        saveStateBadgeLabel={saveStateBadgeLabel}
        subjectProgress={subjectProgress}
        sectionNavigation={sectionNavigation}
        instructions={paper.instructions}
        onJumpToQuestion={handleJumpToQuestion}
      />

      <div className="app-exam-shell app-exam-shell-focus">
        <ExamSidebar
          answeredCount={answeredCount}
          questionCount={totalQuestions}
          unansweredCount={unansweredCount}
          currentQuestionNumber={currentQuestionNumber}
          subjectProgress={subjectProgress}
          sectionNavigation={sectionNavigation}
          currentIndex={currentIndex}
          instructions={paper.instructions}
          onJumpToQuestion={handleJumpToQuestion}
        />

        <main className="app-exam-main-focus">
          {currentQuestion && currentAnswer ? (
            <Card className="app-surface app-exam-question-card overflow-hidden">
              <CardHeader className="app-section-header">
                <div className="app-exam-question-header">
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
                  <div className="app-exam-question-meta">
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
                    <DescriptiveAnswerEditor
                      ref={descriptiveEditorRef}
                      question={currentQuestion.question}
                      value={currentAnswer.answerText}
                      onCommit={onUpdateDescriptiveAnswer}
                    />
                  </div>
                ) : null}

                {currentQuestion.question.type === "matrix-match" ? (
                  currentQuestion.question.matrixRows?.length &&
                  currentQuestion.question.matrixColumns?.length ? (
                    <div className="space-y-3">
                      <div className="app-exam-matrix-stack sm:hidden">
                        {currentQuestion.question.matrixRows.map((row, rowIndex) => (
                          <div key={rowIndex} className="app-exam-matrix-card">
                            <div className="app-exam-matrix-card-head">
                              <span className="app-exam-matrix-card-kicker">
                                {`Row ${rowIndex + 1}`}
                              </span>
                              <p className="app-exam-matrix-card-title">
                                {row || `Row ${rowIndex + 1}`}
                              </p>
                            </div>
                            <div className="app-exam-matrix-choice-grid">
                              {currentQuestion.question.matrixColumns?.map(
                                (column, columnIndex) => {
                                  const checked =
                                    currentAnswer.matrixSelections[rowIndex]?.includes(
                                      columnIndex,
                                    ) || false;

                                  return (
                                    <label
                                      key={columnIndex}
                                      className={cn(
                                        "app-exam-matrix-choice",
                                        checked &&
                                          "app-exam-matrix-choice-selected",
                                      )}
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
                                        className="sr-only"
                                      />
                                      <span
                                        className={cn(
                                          "app-exam-matrix-choice-indicator",
                                          checked &&
                                            "app-exam-matrix-choice-indicator-selected",
                                        )}
                                      >
                                        {checked
                                          ? "✓"
                                          : getOptionLabel(columnIndex)}
                                      </span>
                                      <span className="app-exam-matrix-choice-label">
                                        {column || `Column ${columnIndex + 1}`}
                                      </span>
                                    </label>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="app-table-wrap hidden overflow-x-auto sm:block">
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
                    className="app-student-action-compact app-exam-nav-button"
                    onClick={() =>
                      void handleJumpToQuestion(Math.max(0, currentIndex - 1))
                    }
                    disabled={currentIndex === 0}
                  >
                    Previous
                  </Button>
                  <div className="app-exam-nav-actions">
                    <Button
                      variant="ghost"
                      size="md"
                      className="app-student-action-compact app-exam-nav-button"
                      onClick={handleClearCurrentAnswer}
                      disabled={!currentQuestionAnswered}
                    >
                      Clear Answer
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      className="app-student-action-compact app-exam-nav-button"
                      onClick={() =>
                        void handleJumpToQuestion(
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
