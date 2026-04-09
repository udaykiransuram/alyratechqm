"use client";

import {
  forwardRef,
  memo,
  startTransition,
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronUp, Expand } from "lucide-react";

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
import FeedbackNotice, {
  type FeedbackNoticeVariant,
} from "@/components/ui/feedback-notice";
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

function formatQuestionPositionLabel(current: number, total: number) {
  if (!total) return "Questions";
  return `Q ${current || 1} / ${total}`;
}

function formatQuestionRangeLabel(start: number, end: number) {
  if (!start || !end) return "Questions";
  return start === end ? `Q ${start}` : `Q ${start}-${end}`;
}

function formatSectionSummaryLabel(sectionIndex: number, name: string) {
  const baseLabel = `Section ${sectionIndex + 1}`;
  return labelsMatch(name, baseLabel) ? baseLabel : `${baseLabel} • ${name}`;
}

function formatScoreLabel(positive: number, negative: number) {
  const safePositive = Number(positive || 0);
  const safeNegative = Number(negative || 0);

  if (safeNegative > 0) {
    return `+${safePositive} / -${safeNegative}`;
  }

  return `+${safePositive}`;
}

function getQuestionJumpPaletteStyle(questionCount: number): CSSProperties {
  const columns = Math.max(1, Math.min(5, Number(questionCount) || 0));

  return {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
  };
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (target.isContentEditable) {
    return true;
  }

  return tagName === "input" || tagName === "textarea" || tagName === "select";
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
      <div className="app-exam-timer-card-main">
        <div className="app-exam-timer-card-copy">
          <p className="app-exam-timer-card-kicker">Time left</p>
          <span
            className={cn(
              "app-status-badge app-exam-timer-card-badge",
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
    </div>
  );
});

type ExamTopbarProps = {
  dialogContainer?: HTMLElement | null;
  paper: StudentPaper;
  paperSubjects: Array<{ _id: string; name: string }>;
  paperSubjectLabel: string;
  paperClassLabel: string;
  deadlineAt: string | null;
  answeredCompactLabel: string;
  currentSectionName: string | null;
  showCurrentSectionChip: boolean;
  showSaveStateBadge: boolean;
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
  dialogContainer,
  paper,
  paperSubjects,
  paperSubjectLabel,
  paperClassLabel,
  deadlineAt,
  answeredCompactLabel,
  currentSectionName,
  showCurrentSectionChip,
  showSaveStateBadge,
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
    <div
      className={cn(
        "app-exam-focus-topbar",
        isFullscreen && "app-exam-focus-topbar-fullscreen",
      )}
    >
      <div className="app-exam-focus-topbar-main">
        <div className="app-exam-focus-topbar-copy">
          <h1 className="app-exam-focus-topbar-title text-[1rem] font-semibold leading-tight tracking-[-0.022em] text-foreground sm:text-[1.08rem] xl:text-[1.16rem]">
            {paper.title}
          </h1>
          <div className="app-exam-focus-topbar-meta">
            <p className="app-copy-muted app-exam-focus-topbar-subtitle">
              {[paperSubjectLabel, paperClassLabel, `${paper.duration} min`]
                .filter(Boolean)
                .join(" • ") || `${questionCount} questions`}
            </p>
            {showPaperSubjectChips ? (
              <div className="app-exam-focus-topbar-subjects">
                {paperSubjects.map((subject) => (
                  <span key={subject._id} className="app-meta-chip">
                    {subject.name || subject._id}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div
          className={cn(
            "app-exam-focus-topbar-side",
            isFullscreen && "app-exam-focus-topbar-side-fullscreen",
          )}
        >
          <CountdownStatusCard deadlineAt={deadlineAt} />
          <div
            className={cn(
              "app-exam-focus-topbar-actions",
              isFullscreen && "app-exam-focus-topbar-actions-fullscreen",
            )}
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

            {!isFullscreen ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="app-button-compact app-exam-topbar-action"
                onClick={() => void onToggleFullscreen()}
              >
                <Expand className="mr-1.5 h-4 w-4 sm:mr-2" />
                <span className="sm:hidden">Screen</span>
                <span className="hidden sm:inline">Fullscreen</span>
              </Button>
            ) : null}

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
                <AlertDialogContent container={dialogContainer}>
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
      <div
        className={cn(
          "app-exam-focus-topbar-status",
          isFullscreen && "app-exam-focus-topbar-status-fullscreen",
        )}
        aria-label="Test status"
      >
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
        {showSaveStateBadge ? (
          <div
            className="app-exam-focus-topbar-stat app-exam-focus-topbar-stat-save"
            aria-label={`Save status ${saveStatusLabel}`}
          >
            <span className="sr-only">Save status</span>
            <span
              className={cn("app-status-badge w-fit", saveStateToneClass)}
              title={saveStatusLabel}
            >
              {saveStateBadgeLabel}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
});

type ExamSidebarProps = {
  questionCount: number;
  subjectProgress: SubjectProgressItem[];
  sectionNavigation: SectionNavigationGroup[];
  currentIndex: number;
  instructions: string;
  onJumpToQuestion: (index: number) => Promise<void>;
  isFullscreen?: boolean;
  compact?: boolean;
};

const ExamSidebar = memo(function ExamSidebar({
  questionCount,
  subjectProgress,
  sectionNavigation,
  currentIndex,
  instructions,
  onJumpToQuestion,
  isFullscreen = false,
  compact = false,
}: ExamSidebarProps) {
  const activeSectionId = useMemo(() => {
    const activeSection = sectionNavigation.find((section) =>
      section.items.some((item) => item.globalIndex === currentIndex),
    );

    return activeSection?.id ?? sectionNavigation[0]?.id ?? null;
  }, [currentIndex, sectionNavigation]);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(
    activeSectionId,
  );

  useEffect(() => {
    setExpandedSectionId(activeSectionId);
  }, [activeSectionId]);

  const answeredSummaryCount = subjectProgress.reduce(
    (sum, subject) => sum + subject.answered,
    0,
  );
  const activeSection =
    sectionNavigation.find((section) => section.id === activeSectionId) ??
    sectionNavigation[0] ??
    null;
  const fullQuestionRangeLabel = formatQuestionRangeLabel(
    questionCount > 0 ? 1 : 0,
    questionCount,
  );
  const hasMultipleSections = sectionNavigation.length > 1;
  const compactSectionStart = (activeSection?.items[0]?.globalIndex ?? 0) + 1;
  const compactSectionEnd =
    (activeSection?.items[activeSection?.items.length - 1]?.globalIndex ?? 0) + 1;
  const compactSectionAnsweredCount = activeSection
    ? activeSection.items.filter((item) => item.answered).length
    : 0;
  const showCompactSectionRule = Boolean(
    activeSection &&
      (activeSection.defaultMarks > 0 || activeSection.defaultNegativeMarks > 0),
  );
  const showCompactSectionSubjects = Boolean(
    activeSection && activeSection.subjects.length > 1,
  );

  return (
    <aside
      className={cn(
        "app-exam-sidebar app-exam-sidebar-focus hidden xl:block",
        compact && "app-exam-sidebar-compact",
        isFullscreen && "app-exam-sidebar-focus-fullscreen",
      )}
    >
      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{isFullscreen ? "Jump" : "Questions"}</CardTitle>
            <div className="flex flex-wrap gap-1.5">
              <span className="app-meta-chip">{fullQuestionRangeLabel}</span>
              <span className="app-meta-chip">
                {questionCount > 0
                  ? `${answeredSummaryCount}/${questionCount} done`
                  : "No questions"}
              </span>
              {hasMultipleSections ? (
                <span className="app-meta-chip">
                  {sectionNavigation.length} sections
                </span>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="app-section-body space-y-3">
          {compact && activeSection ? (
            <div className="space-y-3">
              <div className="app-exam-sidebar-summary-card">
                <span className="app-exam-sidebar-summary-label">
                  {formatQuestionRangeLabel(compactSectionStart, compactSectionEnd)}
                </span>
                <span className="app-exam-sidebar-summary-value">
                  {compactSectionAnsweredCount}/{activeSection.items.length} done
                </span>
                {activeSection.totalMarks > 0 ? (
                  <span className="app-exam-sidebar-summary-meta">
                    {activeSection.totalMarks} total marks
                  </span>
                ) : null}
              </div>
              {showCompactSectionRule || showCompactSectionSubjects ? (
                <div className="flex flex-wrap gap-1.5">
                  {showCompactSectionRule ? (
                    <span className="app-meta-chip">
                      {formatScoreLabel(
                        activeSection.defaultMarks || 0,
                        activeSection.defaultNegativeMarks || 0,
                      )}{" "}
                      each
                    </span>
                  ) : null}
                  {showCompactSectionSubjects
                    ? activeSection.subjects.map((subject) => (
                        <span
                          key={`${activeSection.id}-${subject._id}`}
                          className="app-meta-chip"
                        >
                          {subject.name || subject._id}
                        </span>
                      ))
                    : null}
                </div>
              ) : null}
              <div
                className="app-exam-palette app-exam-sidebar-compact-palette"
                aria-label="Question navigation"
                style={getQuestionJumpPaletteStyle(activeSection.items.length)}
              >
                {activeSection.items.map((item) => (
                  <button
                    key={`${activeSection.id}-${item.questionId || item.globalIndex}`}
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
          ) : (
            <div className="app-exam-sidebar-section-list">
              {sectionNavigation.map((section) => {
                const sectionActive = section.id === activeSectionId;
                const sectionExpanded =
                  section.id === (expandedSectionId ?? activeSectionId);
                const sectionAnsweredCount = section.items.filter(
                  (item) => item.answered,
                ).length;
                const sectionStart = (section.items[0]?.globalIndex ?? 0) + 1;
                const sectionEnd =
                  (section.items[section.items.length - 1]?.globalIndex ?? 0) + 1;
                const sectionRangeLabel = formatQuestionRangeLabel(
                  sectionStart,
                  sectionEnd,
                );
                const showSectionRule =
                  section.defaultMarks > 0 || section.defaultNegativeMarks > 0;
                const showSectionSubjects = section.subjects.length > 1;

                return (
                  <div
                    key={section.id}
                    className={cn(
                      "app-exam-sidebar-section",
                      sectionActive && "app-exam-sidebar-section-active",
                    )}
                  >
                    <button
                      type="button"
                      className="app-exam-sidebar-section-trigger"
                      onClick={() => setExpandedSectionId(section.id)}
                      aria-expanded={sectionExpanded}
                    >
                      <div className="app-exam-sidebar-section-copy">
                        <p className="app-exam-sidebar-section-title">
                          {sectionRangeLabel}
                        </p>
                        <div className="app-exam-sidebar-section-summary">
                          {hasMultipleSections ? (
                            <span>
                              {formatSectionSummaryLabel(
                                section.sectionIndex,
                                section.name,
                              )}
                            </span>
                          ) : null}
                          <span>
                            {sectionAnsweredCount}/{section.items.length} done
                          </span>
                          {section.totalMarks > 0 ? (
                            <span>{section.totalMarks} marks</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pl-2">
                        <ChevronUp
                          className={cn(
                            "app-exam-sidebar-section-chevron",
                            !sectionExpanded &&
                              "app-exam-sidebar-section-chevron-collapsed",
                          )}
                        />
                      </div>
                    </button>
                    {sectionExpanded ? (
                      <div className="app-exam-sidebar-section-body">
                        {showSectionRule || showSectionSubjects ? (
                          <div className="flex flex-wrap gap-1.5">
                            {showSectionRule ? (
                              <span className="app-meta-chip">
                                {formatScoreLabel(
                                  section.defaultMarks || 0,
                                  section.defaultNegativeMarks || 0,
                                )}{" "}
                                each
                              </span>
                            ) : null}
                            {showSectionSubjects
                              ? section.subjects.map((subject) => (
                                  <span
                                    key={`${section.id}-${subject._id}`}
                                    className="app-meta-chip"
                                  >
                                    {subject.name || subject._id}
                                  </span>
                                ))
                              : null}
                          </div>
                        ) : null}
                        <div
                          className="app-exam-palette"
                          aria-label={`Question navigation for section ${section.sectionIndex + 1}`}
                          style={getQuestionJumpPaletteStyle(section.items.length)}
                        >
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
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {subjectProgress.length > 1 || instructions ? (
            <details className="app-exam-sidebar-panel px-3.5 py-2.5">
              <summary className="app-title-sm cursor-pointer">
                More details
              </summary>
              {subjectProgress.length > 1 ? (
                <div className="mt-3 space-y-2">
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
              ) : null}
              {instructions ? (
                <div className="prose prose-sm mt-3 max-w-none text-foreground dark:prose-invert">
                  <p>{instructions}</p>
                </div>
              ) : null}
            </details>
          ) : null}
        </CardContent>
      </Card>
    </aside>
  );
});

type ExamQuestionPanelProps = {
  dialogContainer?: HTMLElement | null;
  descriptiveEditorRef: RefObject<DescriptiveAnswerEditorHandle>;
  currentQuestion: StudentQuestionListItem | null;
  currentAnswer: StudentAnswerState | null;
  currentIndex: number;
  totalQuestions: number;
  currentQuestionAnswered: boolean;
  currentSection: SectionNavigationGroup | null;
  hasMultipleSections: boolean;
  paperSubjectLabel: string;
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

const ExamQuestionPanel = memo(function ExamQuestionPanel({
  dialogContainer,
  descriptiveEditorRef,
  currentQuestion,
  currentAnswer,
  currentIndex,
  totalQuestions,
  currentQuestionAnswered,
  currentSection,
  hasMultipleSections,
  paperSubjectLabel,
  onJumpToQuestion,
  onUpdateMultipleChoice,
  onUpdateSingleChoice,
  onUpdateDescriptiveAnswer,
  onUpdateMatrixSelection,
  onClearCurrentAnswer,
}: ExamQuestionPanelProps) {
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
  const currentQuestionNumber = totalQuestions
    ? Math.min(currentIndex + 1, totalQuestions)
    : 0;
  const currentQuestionScoreLabel = formatScoreLabel(
    currentQuestion?.marks || 0,
    currentQuestion?.negativeMarks || 0,
  );
  const currentSectionRuleLabel = formatScoreLabel(
    currentSection?.defaultMarks || currentQuestion?.marks || 0,
    currentSection?.defaultNegativeMarks || currentQuestion?.negativeMarks || 0,
  );
  const currentSectionQuestionCount = currentSection?.items.length || 0;
  const showSectionRuleChip = Boolean(
    currentSection &&
      currentSectionQuestionCount > 1 &&
      (currentSection.defaultMarks > 0 || currentSection.defaultNegativeMarks > 0),
  );
  const showSectionTotalChip = Boolean(
    currentSection && currentSectionQuestionCount > 1 && currentSection.totalMarks > 0,
  );
  const sectionRuleMatchesQuestion = Boolean(
    currentSection &&
      (currentSection.defaultMarks || 0) === (currentQuestion?.marks || 0) &&
      (currentSection.defaultNegativeMarks || 0) ===
        (currentQuestion?.negativeMarks || 0),
  );
  const showQuestionScoreChip = Boolean(
    currentQuestion && (!showSectionRuleChip || !sectionRuleMatchesQuestion),
  );
  const currentQuestionTitle = currentQuestion
    ? `Question ${currentIndex + 1}`
    : "Question";
  const currentQuestionPositionLabel = formatQuestionPositionLabel(
    currentQuestionNumber,
    totalQuestions,
  );
  const showQuestionEyebrow = Boolean(
    currentQuestion?.sectionName && hasMultipleSections,
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
  const showClearAnswerAction = currentQuestionAnswered;
  const isSingleQuestionActionRow = totalQuestions <= 1;
  const showQuestionNavigationRow =
    totalQuestions > 1 || showClearAnswerAction;

  if (!currentQuestion || !currentAnswer) {
    return (
      <Card className="app-surface">
        <CardContent className="app-empty-state py-10">
          No questions are available in this paper.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="app-surface app-exam-question-card overflow-hidden">
      <CardHeader className="app-section-header">
        <div className="app-exam-question-header">
          <div className="app-exam-question-header-copy">
            {showQuestionEyebrow ? (
              <p className="app-spotlight-label">
                {currentQuestion.sectionName}
              </p>
            ) : null}
            <CardTitle className="app-exam-question-title">
              {currentQuestionTitle}
            </CardTitle>
            {currentQuestion.sectionDescription ? (
              <p className="app-copy-muted app-exam-question-section-description max-w-3xl whitespace-pre-line">
                {currentQuestion.sectionDescription}
              </p>
            ) : null}
            {currentSection ? (
              <div className="app-exam-question-section-meta">
                {visibleCurrentSectionSubjects.map((subject) => (
                  <span
                    key={`${currentSection.id}-${subject._id}`}
                    className="app-meta-chip"
                  >
                    {subject.name || subject._id}
                  </span>
                ))}
                {showSectionRuleChip ? (
                  <span className="app-meta-chip">
                    {currentSectionRuleLabel} each
                  </span>
                ) : null}
                {showSectionTotalChip ? (
                  <span className="app-meta-chip">
                    {currentSection.totalMarks} total
                  </span>
                ) : null}
              </div>
            ) : null}
            {currentQuestion.sectionInstructions ? (
              <div className="app-exam-question-context-note whitespace-pre-line">
                {currentQuestion.sectionInstructions}
              </div>
            ) : null}
          </div>
          <div className="app-exam-question-meta">
            {showQuestionSubjectChip ? (
              <div className="app-meta-chip">{currentQuestionSubjectName}</div>
            ) : null}
            {showQuestionScoreChip ? (
              <div className="app-meta-chip">{currentQuestionScoreLabel}</div>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="app-section-body app-exam-question-body app-exam-question-shell">
        <div className="app-exam-question-content">
          <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
            <ContentRenderer
              htmlContent={currentQuestionHtml}
              enableImageZoom
              dialogContainer={dialogContainer}
            />
          </div>
        </div>

        {currentQuestion.question.type === "single" ||
        currentQuestion.question.type === "multiple" ? (
          <div className="app-exam-question-option-list">
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
                    readOnly
                    onClick={(event) => {
                      event.preventDefault();
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
                      selected && "app-exam-option-indicator-selected",
                    )}
                  >
                    {getOptionLabel(optionIndex)}
                  </span>
                  <div className="app-exam-option-content">
                    <div className="prose prose-sm app-exam-option-richtext max-w-none text-foreground dark:prose-invert">
                      <ContentRenderer
                        htmlContent={currentOptionHtml[optionIndex] || ""}
                        enableImageZoom
                        dialogContainer={dialogContainer}
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
                                checked && "app-exam-matrix-choice-selected",
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
                                {checked ? "✓" : getOptionLabel(columnIndex)}
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

        {showQuestionNavigationRow ? (
          <div
            className={cn(
              "app-exam-nav-row",
              isSingleQuestionActionRow && "app-exam-nav-row-single",
            )}
          >
            {!isSingleQuestionActionRow ? (
              <div className="app-exam-nav-row-copy">
                <span className="app-meta-chip">
                  {currentQuestionPositionLabel}
                </span>
              </div>
            ) : null}
            <div
              className={cn(
                "app-exam-nav-row-actions",
                isSingleQuestionActionRow &&
                  "app-exam-nav-row-actions-end",
              )}
            >
              {!isSingleQuestionActionRow ? (
                <Button
                  variant="outline"
                  size="md"
                  className="app-student-action-compact app-exam-nav-button"
                  onClick={() =>
                    void onJumpToQuestion(Math.max(0, currentIndex - 1))
                  }
                  disabled={currentIndex === 0}
                >
                  Previous
                </Button>
              ) : null}
              <div
                className={cn(
                  "app-exam-nav-actions",
                  (!showClearAnswerAction || isSingleQuestionActionRow) &&
                    "app-exam-nav-actions-single",
                )}
              >
                {showClearAnswerAction ? (
                  <Button
                    variant="ghost"
                    size="md"
                    className="app-student-action-compact app-exam-nav-button"
                    onClick={onClearCurrentAnswer}
                  >
                    Clear
                  </Button>
                ) : null}
                {!isSingleQuestionActionRow ? (
                  <Button
                    variant="primary"
                    size="md"
                    className="app-student-action-compact app-exam-nav-button"
                    onClick={() =>
                      void onJumpToQuestion(
                        Math.min(totalQuestions - 1, currentIndex + 1),
                      )
                    }
                    disabled={currentIndex >= totalQuestions - 1}
                  >
                    Next
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
});

type ExamMobileNavigationProps = {
  dialogContainer?: HTMLElement | null;
  answeredCount: number;
  questionCount: number;
  unansweredCount: number;
  currentQuestionNumber: number;
  currentIndex: number;
  currentSectionName: string | null;
  showSaveStateBadge: boolean;
  saveStateToneClass: string;
  saveStateBadgeLabel: string;
  subjectProgress: SubjectProgressItem[];
  sectionNavigation: SectionNavigationGroup[];
  instructions: string;
  onJumpToQuestion: (index: number) => Promise<void>;
};

const ExamMobileNavigation = memo(function ExamMobileNavigation({
  dialogContainer,
  answeredCount,
  questionCount,
  unansweredCount,
  currentQuestionNumber,
  currentIndex,
  currentSectionName,
  showSaveStateBadge,
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
  const selectedSectionAnsweredCount = selectedSection
    ? selectedSection.items.filter((item) => item.answered).length
    : 0;
  const selectedSectionStart = selectedSection
    ? (selectedSection.items[0]?.globalIndex ?? 0) + 1
    : 0;
  const selectedSectionEnd = selectedSection
    ? (selectedSection.items[selectedSection.items.length - 1]?.globalIndex ?? 0) +
      1
    : 0;
  const [sheetOpen, setSheetOpen] = useState(false);
  const fullQuestionRangeLabel = formatQuestionRangeLabel(
    questionCount > 0 ? 1 : 0,
    questionCount,
  );
  const currentQuestionLabel = formatQuestionPositionLabel(
    currentQuestionNumber,
    questionCount,
  );
  const hasMultipleSections = sectionNavigation.length > 1;
  const showQuestionJump = questionCount > 1;
  const showMobileDetailsAccess = Boolean(
    showQuestionJump || subjectProgress.length > 1 || instructions,
  );
  const mobileSheetTitle = showQuestionJump ? "Questions" : "Details";
  const mobileSheetSubtitle = showQuestionJump
    ? fullQuestionRangeLabel
    : currentQuestionLabel;
  const mobileSheetTriggerLabel = showQuestionJump ? "Jump" : "Details";

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

  if (!showMobileDetailsAccess) {
    return null;
  }

  return (
    <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
      <div
        className="app-exam-mobile-nav-bar xl:hidden"
        aria-label={showQuestionJump ? "Question navigation" : "Test details"}
      >
        <div className="app-exam-mobile-nav-bar-copy">
          <p className="app-exam-mobile-nav-bar-label">{currentQuestionLabel}</p>
          <div className="app-exam-mobile-nav-bar-meta">
            <span className="app-exam-mobile-nav-bar-chip">
              {answeredCount}/{questionCount} done
            </span>
            {unansweredCount > 0 ? (
              <span className="app-exam-mobile-nav-bar-chip">
                {unansweredCount} left
              </span>
            ) : null}
            {hasMultipleSections && currentSectionName ? (
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
          {showSaveStateBadge ? (
            <span
              className={cn(
                "app-status-badge hidden min-[400px]:inline-flex",
                saveStateToneClass,
              )}
            >
              {saveStateBadgeLabel}
            </span>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="app-exam-mobile-nav-open"
            onClick={handleOpenSheet}
          >
            {mobileSheetTriggerLabel}
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <DialogContent
        container={dialogContainer}
        className="app-exam-mobile-sheet inset-x-0 bottom-0 top-auto h-auto max-h-[min(82dvh,42rem)] w-screen translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 rounded-t-[calc(var(--app-radius-xl)+0.125rem)] rounded-b-none border-x-0 border-b-0 p-0 sm:inset-x-0 sm:bottom-0 sm:top-auto sm:h-auto sm:max-h-[min(82dvh,42rem)] sm:w-screen sm:max-w-none sm:translate-x-0 sm:translate-y-0 sm:rounded-t-[calc(var(--app-radius-xl)+0.125rem)] sm:rounded-b-none sm:border-x-0 sm:border-b-0 xl:hidden"
      >
        <DialogHeader className="app-exam-mobile-sheet-header">
          <div className="app-exam-mobile-sheet-title-row">
            <div className="min-w-0">
              <DialogTitle>{mobileSheetTitle}</DialogTitle>
              <p className="app-copy-meta">{mobileSheetSubtitle}</p>
            </div>
            {showSaveStateBadge ? (
              <span className={cn("app-status-badge w-fit", saveStateToneClass)}>
                {saveStateBadgeLabel}
              </span>
            ) : null}
          </div>
        </DialogHeader>

        <div className="app-exam-mobile-sheet-body">
          <section className="app-exam-mobile-nav">
            <div className="app-exam-mobile-nav-summary">
              <span className="app-meta-chip">{answeredCount}/{questionCount} done</span>
              {unansweredCount > 0 ? (
                <span className="app-meta-chip">{unansweredCount} left</span>
              ) : null}
              {hasMultipleSections && currentSectionName ? (
                <span className="app-meta-chip" title={currentSectionName}>
                  {currentSectionName}
                </span>
              ) : null}
            </div>

            {showQuestionJump && hasMultipleSections ? (
              <div className="app-exam-mobile-section-tabs" aria-label="Sections">
                {sectionNavigation.map((section) => {
                  const sectionIsSelected = section.id === selectedSection?.id;
                  const sectionAnsweredCount = section.items.filter(
                    (item) => item.answered,
                  ).length;
                  const sectionStart = (section.items[0]?.globalIndex ?? 0) + 1;
                  const sectionEnd =
                    (section.items[section.items.length - 1]?.globalIndex ?? 0) + 1;

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
                        {formatQuestionRangeLabel(sectionStart, sectionEnd)}
                      </span>
                      <span className="app-exam-mobile-section-tab-meta">
                        {sectionAnsweredCount}/{section.items.length} done
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {showQuestionJump && selectedSection ? (
              <div className="app-exam-mobile-section-panel">
                <div className="app-exam-mobile-section-panel-head">
                  <div className="app-exam-mobile-section-panel-copy">
                    <p className="app-title-sm">
                      {formatQuestionRangeLabel(
                        selectedSectionStart,
                        selectedSectionEnd,
                      )}
                    </p>
                    <p className="app-copy-meta">
                      {hasMultipleSections
                        ? `${formatSectionSummaryLabel(
                            selectedSection.sectionIndex,
                            selectedSection.name,
                          )} • `
                        : ""}
                      {selectedSectionAnsweredCount}/{selectedSection.items.length} done
                      {selectedSection.totalMarks > 0
                        ? ` • ${selectedSection.totalMarks} marks`
                        : ""}
                    </p>
                  </div>
                </div>

                {selectedSection.subjects.length > 1 ? (
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
                  style={getQuestionJumpPaletteStyle(selectedSection.items.length)}
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
  dialogContainer: HTMLDivElement | null;
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
  isExamLocked: boolean;
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
  dialogContainer,
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
  isExamLocked,
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
  const descriptiveEditorRef = useRef<DescriptiveAnswerEditorHandle>(null);
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
      : "Saved";
  const showSaveStateBadge = Boolean(
    isSubmitting || isSaving || actionError || pendingSubmitRetry || saveRetryPending,
  );
  const runtimeNotice = useMemo<
    { variant: FeedbackNoticeVariant; message: string } | null
  >(() => {
    if (actionError) {
      return {
        variant: "error",
        message: actionError,
      };
    }

    if (pendingSubmitRetry) {
      return {
        variant: "warning",
        message: "Submission pending. Keep this tab open while we retry.",
      };
    }

    if (connectionNotice && saveRetryPending) {
      return {
        variant: "warning",
        message: `${connectionNotice} Save retry queued in the background.`,
      };
    }

    if (connectionNotice) {
      return {
        variant: "warning",
        message: connectionNotice,
      };
    }

    if (saveRetryPending) {
      return {
        variant: "info",
        message: "Save retry queued in the background. Latest answers are safe on this device.",
      };
    }

    if (recoveryNotice) {
      return {
        variant: "success",
        message: recoveryNotice,
      };
    }

    return null;
  }, [
    actionError,
    connectionNotice,
    pendingSubmitRetry,
    recoveryNotice,
    saveRetryPending,
  ]);
  const answeredCompactLabel = totalQuestions
    ? `${answeredCount}/${totalQuestions}`
    : "—";
  const hasMultipleSections = sectionNavigation.length > 1;
  const showDesktopSidebar = Boolean(
    totalQuestions > 1 || subjectProgress.length > 1 || paper.instructions,
  );
  const useCompactSidebar = Boolean(
    showDesktopSidebar && !hasMultipleSections && totalQuestions <= 12,
  );
  const showMobileExamDrawer = Boolean(
    totalQuestions > 1 || subjectProgress.length > 1 || paper.instructions,
  );
  const showCurrentSectionChip = Boolean(
    currentSection && hasMultipleSections,
  );
  const isExamInteractionLocked = isExamLocked || !isFullscreen;
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
  const handleKeyboardSave = useCallback(() => {
    if (isSaving || isSubmitting) {
      return;
    }

    void handleSaveAttempt(true);
  }, [handleSaveAttempt, isSaving, isSubmitting]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
        return;
      }

      if (isEditableKeyboardTarget(event.target)) {
        return;
      }

      if (document.querySelector("[role='dialog']")) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "arrowleft") {
        if (currentIndex > 0) {
          event.preventDefault();
          void handleJumpToQuestion(Math.max(0, currentIndex - 1));
        }
        return;
      }

      if (key === "arrowright") {
        if (currentIndex < questionList.length - 1) {
          event.preventDefault();
          void handleJumpToQuestion(
            Math.min(questionList.length - 1, currentIndex + 1),
          );
        }
        return;
      }

      if (key === "s") {
        event.preventDefault();
        handleKeyboardSave();
        return;
      }

      if (!currentQuestion) {
        return;
      }

      if (
        currentQuestion.question.type !== "single" &&
        currentQuestion.question.type !== "multiple"
      ) {
        return;
      }

      if (!/^[1-9]$/.test(key)) {
        return;
      }

      const optionIndex = Number.parseInt(key, 10) - 1;
      if (optionIndex >= currentQuestion.question.options.length) {
        return;
      }

      event.preventDefault();
      if (currentQuestion.question.type === "multiple") {
        onUpdateMultipleChoice(currentQuestion.question._id, optionIndex);
        return;
      }

      onUpdateSingleChoice(currentQuestion.question._id, optionIndex);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    currentIndex,
    currentQuestion,
    handleJumpToQuestion,
    handleKeyboardSave,
    onUpdateMultipleChoice,
    onUpdateSingleChoice,
    questionList.length,
  ]);

  return (
    <div
      className={cn(
        "app-page-shell app-exam-focus-shell max-w-[96rem] px-3 pt-3 sm:px-4 sm:pt-4 xl:py-4",
        showMobileExamDrawer ? "pb-28 sm:pb-32" : "pb-16 sm:pb-20",
        isFullscreen && "app-exam-focus-shell-fullscreen",
      )}
    >
      <div className={cn(isExamInteractionLocked && "app-exam-content-locked")}>
        <ExamTopbar
          dialogContainer={dialogContainer}
          paper={paper}
          paperSubjects={paperSubjects}
          paperSubjectLabel={paperSubjectLabel}
          paperClassLabel={paperClassLabel}
          deadlineAt={deadlineAt}
          answeredCompactLabel={answeredCompactLabel}
          currentSectionName={currentSection?.name || null}
          showCurrentSectionChip={showCurrentSectionChip}
          showSaveStateBadge={showSaveStateBadge}
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

      {runtimeNotice ? (
        <FeedbackNotice
          variant={runtimeNotice.variant}
          className="app-exam-runtime-feedback"
        >
          {runtimeNotice.message}
        </FeedbackNotice>
      ) : null}

      <ExamMobileNavigation
        dialogContainer={dialogContainer}
        answeredCount={answeredCount}
        questionCount={totalQuestions}
        unansweredCount={unansweredCount}
        currentQuestionNumber={currentQuestionNumber}
        currentIndex={currentIndex}
        currentSectionName={currentSection?.name || null}
        showSaveStateBadge={showSaveStateBadge}
        saveStateToneClass={saveStateToneClass}
        saveStateBadgeLabel={saveStateBadgeLabel}
        subjectProgress={subjectProgress}
        sectionNavigation={sectionNavigation}
        instructions={paper.instructions}
        onJumpToQuestion={handleJumpToQuestion}
      />

      <div
        className={cn(
          "app-exam-shell app-exam-shell-focus",
          useCompactSidebar && "app-exam-shell-focus-compact-sidebar",
          !showDesktopSidebar && "app-exam-shell-focus-no-sidebar",
          isFullscreen && "app-exam-shell-focus-fullscreen",
        )}
      >
        {showDesktopSidebar ? (
          <ExamSidebar
            questionCount={totalQuestions}
            subjectProgress={subjectProgress}
            sectionNavigation={sectionNavigation}
            currentIndex={currentIndex}
            instructions={paper.instructions}
            onJumpToQuestion={handleJumpToQuestion}
            isFullscreen={isFullscreen}
            compact={useCompactSidebar}
          />
        ) : null}

        <main className="app-exam-main-focus">
          <ExamQuestionPanel
            dialogContainer={dialogContainer}
            descriptiveEditorRef={descriptiveEditorRef}
            currentQuestion={currentQuestion}
            currentAnswer={currentAnswer}
            currentIndex={currentIndex}
            totalQuestions={totalQuestions}
            currentQuestionAnswered={currentQuestionAnswered}
            currentSection={currentSection}
            hasMultipleSections={hasMultipleSections}
            paperSubjectLabel={paperSubjectLabel}
            onJumpToQuestion={handleJumpToQuestion}
            onUpdateMultipleChoice={onUpdateMultipleChoice}
            onUpdateSingleChoice={onUpdateSingleChoice}
            onUpdateDescriptiveAnswer={onUpdateDescriptiveAnswer}
            onUpdateMatrixSelection={onUpdateMatrixSelection}
            onClearCurrentAnswer={handleClearCurrentAnswer}
          />
        </main>
      </div>
      </div>
    </div>
  );
}
