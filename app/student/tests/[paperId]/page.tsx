"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { ContentRenderer } from "@/components/ContentRenderer";
import StudentPortalNav from "@/components/student/StudentPortalNav";
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
import PageLoadingState from "@/components/ui/page-loading-state";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { fetchApiJson } from "@/lib/client/api";
import { cn } from "@/lib/utils";

type StudentQuestion = {
  _id: string;
  content: string;
  type: "single" | "multiple" | "descriptive" | "matrix-match";
  options: Array<{ content: string }>;
  matrixRows?: string[];
  matrixColumns?: string[];
};

type StudentPaper = {
  _id: string;
  title: string;
  instructions: string;
  duration: number;
  passingMarks: number;
  totalMarks: number;
  sections: Array<{
    name: string;
    description?: string;
    marks: number;
    questions: Array<{
      question: StudentQuestion;
      marks: number;
      negativeMarks: number;
    }>;
  }>;
};

type StudentAttempt = {
  _id: string;
  status: string;
  startedAt?: string | null;
  submittedAt?: string | null;
  totalMarksAwarded?: number;
  sectionAnswers?: Array<{
    sectionName: string;
    answers: Array<{
      question: string;
      selectedOptions?: number[];
      answerText?: string;
      matrixSelections?: number[][];
    }>;
  }>;
};

type StudentAnswerState = {
  selectedOptions: number[];
  answerText: string;
  matrixSelections: number[][];
};

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

function getOptionLabel(index: number) {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

function normalizeSelectedOptions(value: unknown) {
  if (!Array.isArray(value)) return [] as number[];

  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && Number.isFinite(item)),
    ),
  ).sort((left, right) => left - right);
}

function normalizeMatrixSelections(value: unknown, rowCount = 0) {
  const rows = Array.isArray(value) ? value : [];
  return Array.from({ length: rowCount }, (_value, rowIndex) =>
    normalizeSelectedOptions(rows[rowIndex]),
  );
}

function createQuestionAnswerState(
  question: StudentQuestion,
  answer?: Partial<StudentAnswerState> & {
    selectedOptions?: number[];
    answerText?: string;
    matrixSelections?: number[][];
  },
) {
  const rowCount = Array.isArray(question.matrixRows)
    ? question.matrixRows.length
    : 0;

  return {
    selectedOptions: normalizeSelectedOptions(answer?.selectedOptions),
    answerText: String(answer?.answerText || ""),
    matrixSelections: normalizeMatrixSelections(answer?.matrixSelections, rowCount),
  };
}

function hasAnswerForQuestion(
  question: StudentQuestion,
  answer?: StudentAnswerState | null,
) {
  const current = createQuestionAnswerState(question, answer || undefined);

  if (question.type === "single" || question.type === "multiple") {
    return current.selectedOptions.length > 0;
  }

  if (question.type === "descriptive") {
    return current.answerText.trim().length > 0;
  }

  return current.matrixSelections.some((row) => row.length > 0);
}

function buildAnswerMap(attempt: StudentAttempt | null, paper: StudentPaper | null) {
  const rawAnswers = new Map<
    string,
    {
      selectedOptions?: number[];
      answerText?: string;
      matrixSelections?: number[][];
    }
  >();

  (Array.isArray(attempt?.sectionAnswers) ? attempt.sectionAnswers : []).forEach(
    (sectionAnswer) => {
      (Array.isArray(sectionAnswer?.answers) ? sectionAnswer.answers : []).forEach(
        (answer) => {
          rawAnswers.set(String(answer.question), {
            selectedOptions: Array.isArray(answer.selectedOptions)
              ? answer.selectedOptions
              : [],
            answerText: String(answer.answerText || ""),
            matrixSelections: Array.isArray(answer.matrixSelections)
              ? answer.matrixSelections
              : [],
          });
        },
      );
    },
  );

  const normalized: Record<string, StudentAnswerState> = {};
  (paper?.sections || []).forEach((section) => {
    (section.questions || []).forEach((entry) => {
      normalized[entry.question._id] = createQuestionAnswerState(
        entry.question,
        rawAnswers.get(entry.question._id),
      );
    });
  });

  return normalized;
}

function buildSectionAnswersPayloadFromState(
  paper: StudentPaper | null,
  answers: Record<string, StudentAnswerState>,
) {
  if (!paper) return [];

  return paper.sections
    .map((section) => {
      const sectionAnswers = section.questions
        .map((entry) => {
          const state = createQuestionAnswerState(
            entry.question,
            answers[entry.question._id],
          );

          if (!hasAnswerForQuestion(entry.question, state)) {
            return null;
          }

          if (entry.question.type === "descriptive") {
            return {
              question: entry.question._id,
              answerText: state.answerText.trim(),
            };
          }

          if (entry.question.type === "matrix-match") {
            return {
              question: entry.question._id,
              matrixSelections: state.matrixSelections,
            };
          }

          return {
            question: entry.question._id,
            selectedOptions: state.selectedOptions,
          };
        })
        .filter(Boolean);

      if (sectionAnswers.length === 0) return null;

      return {
        sectionName: section.name,
        answers: sectionAnswers,
      };
    })
    .filter(Boolean);
}

export default function StudentTestPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = String(params?.paperId || "");

  const [paper, setPaper] = useState<StudentPaper | null>(null);
  const [attempt, setAttempt] = useState<StudentAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, StudentAnswerState>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingTimeMs, setRemainingTimeMs] = useState<number | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);

  const answersRef = useRef<Record<string, StudentAnswerState>>({});
  const lastSavedSignatureRef = useRef<string>("");
  const submitTriggeredRef = useRef(false);
  const saveAttemptRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const submitAttemptRef = useRef<(auto?: boolean) => Promise<void>>(async () => {});

  const questionList = useMemo(() => {
    return (paper?.sections || []).flatMap((section) =>
      (section.questions || []).map((entry) => ({
        sectionName: section.name,
        sectionDescription: section.description || "",
        sectionMarks: section.marks,
        marks: entry.marks,
        negativeMarks: entry.negativeMarks,
        question: entry.question,
      })),
    );
  }, [paper]);

  const hasManualReviewQuestions = useMemo(
    () =>
      questionList.some((item) => item.question.type === "descriptive"),
    [questionList],
  );

  const currentQuestion = questionList[currentIndex] || null;
  const currentAnswer = useMemo(() => {
    if (!currentQuestion) return null;
    return createQuestionAnswerState(
      currentQuestion.question,
      answers[currentQuestion.question._id],
    );
  }, [answers, currentQuestion]);

  const answeredCount = useMemo(() => {
    return questionList.filter((item) =>
      hasAnswerForQuestion(item.question, answers[item.question._id]),
    ).length;
  }, [answers, questionList]);

  const unansweredCount = Math.max(0, questionList.length - answeredCount);
  const attemptLocked =
    attempt?.status === "submitted" || attempt?.status === "auto_submitted";

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    let mounted = true;

    async function loadTest() {
      try {
        setLoading(true);
        setLoadError(null);
        setActionError(null);
        const data = await fetchApiJson<any>(`/api/student/tests/${paperId}`, {
          cache: "no-store",
          fallbackMessage: "Failed to load the online test.",
        });
        if (!mounted) return;

        const nextPaper = data.paper || null;
        const nextAttempt = data.attempt || null;
        const nextAnswers = buildAnswerMap(nextAttempt, nextPaper);

        setPaper(nextPaper);
        setAttempt(nextAttempt);
        setAnswers(nextAnswers);
        answersRef.current = nextAnswers;
        lastSavedSignatureRef.current = JSON.stringify(
          buildSectionAnswersPayloadFromState(nextPaper, nextAnswers),
        );
        setRemainingTimeMs(
          typeof data.remainingTimeMs === "number" ? data.remainingTimeMs : null,
        );
        setDeadlineAt(data.deadlineAt || null);
        setCurrentIndex(0);
      } catch (error: any) {
        if (!mounted) return;
        setLoadError(error?.message || "Failed to load the online test.");
        setPaper(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (paperId) {
      void loadTest();
    }

    return () => {
      mounted = false;
    };
  }, [paperId]);

  async function saveAttempt(force = false) {
    if (!paper || attemptLocked || isSubmitting || isSaving) return;

    const payload = buildSectionAnswersPayloadFromState(paper, answersRef.current);
    const signature = JSON.stringify(payload);
    if (!force && signature === lastSavedSignatureRef.current) {
      return;
    }

    setIsSaving(true);
    try {
      const data = await fetchApiJson<any>(`/api/student/tests/${paperId}/attempt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionAnswers: payload }),
        fallbackMessage: "Failed to save your attempt.",
      });
      setAttempt(data.attempt || null);
      setRemainingTimeMs(
        typeof data.remainingTimeMs === "number" ? data.remainingTimeMs : null,
      );
      lastSavedSignatureRef.current = signature;
      setActionError(null);
    } catch (error: any) {
      setActionError(error?.message || "Failed to save your attempt.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitAttempt(auto = false) {
    if (!paper || submitTriggeredRef.current || isSubmitting) return;

    submitTriggeredRef.current = true;
    setIsSubmitting(true);
    try {
      const data = await fetchApiJson<any>(`/api/student/tests/${paperId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionAnswers: buildSectionAnswersPayloadFromState(
            paper,
            answersRef.current,
          ),
        }),
        fallbackMessage: auto
          ? "Time expired and the test could not be submitted automatically."
          : "Failed to submit the online test.",
      });
      setAttempt(data.attempt || null);
      setSubmitDialogOpen(false);
      setActionError(null);
      router.push("/student/tests?submitted=1");
    } catch (error: any) {
      submitTriggeredRef.current = false;
      setActionError(error?.message || "Failed to submit the online test.");
    } finally {
      setIsSubmitting(false);
    }
  }

  saveAttemptRef.current = saveAttempt;
  submitAttemptRef.current = submitAttempt;

  useEffect(() => {
    if (!deadlineAt || attemptLocked) return;

    const interval = window.setInterval(() => {
      const nextRemainingTime = new Date(deadlineAt).getTime() - Date.now();
      if (nextRemainingTime <= 0) {
        setRemainingTimeMs(0);
        window.clearInterval(interval);
        void submitAttemptRef.current(true);
        return;
      }
      setRemainingTimeMs(nextRemainingTime);
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [attemptLocked, deadlineAt]);

  useEffect(() => {
    if (!paper || attemptLocked) return;

    const interval = window.setInterval(() => {
      void saveAttemptRef.current();
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [attemptLocked, paper]);

  function updateSingleChoice(questionId: string, optionIndex: number) {
    setAnswers((current) => ({
      ...current,
      [questionId]: {
        ...(current[questionId] || {
          selectedOptions: [],
          answerText: "",
          matrixSelections: [],
        }),
        selectedOptions: [optionIndex],
      },
    }));
  }

  function updateMultipleChoice(questionId: string, optionIndex: number) {
    setAnswers((current) => {
      const previous = createQuestionAnswerState(
        currentQuestion?.question || {
          _id: questionId,
          content: "",
          type: "multiple",
          options: [],
        },
        current[questionId],
      );
      const next = previous.selectedOptions.includes(optionIndex)
        ? previous.selectedOptions.filter((value) => value !== optionIndex)
        : [...previous.selectedOptions, optionIndex].sort(
            (left, right) => left - right,
          );

      return {
        ...current,
        [questionId]: {
          ...previous,
          selectedOptions: next,
        },
      };
    });
  }

  function updateDescriptiveAnswer(question: StudentQuestion, value: string) {
    setAnswers((current) => ({
      ...current,
      [question._id]: {
        ...createQuestionAnswerState(question, current[question._id]),
        answerText: value,
      },
    }));
  }

  function updateMatrixSelection(
    question: StudentQuestion,
    rowIndex: number,
    columnIndex: number,
  ) {
    setAnswers((current) => {
      const previous = createQuestionAnswerState(question, current[question._id]);
      const nextSelections = previous.matrixSelections.map((row, index) => {
        if (index !== rowIndex) return row;

        return row.includes(columnIndex)
          ? row.filter((value) => value !== columnIndex)
          : [...row, columnIndex].sort((left, right) => left - right);
      });

      return {
        ...current,
        [question._id]: {
          ...previous,
          matrixSelections: nextSelections,
        },
      };
    });
  }

  function clearCurrentAnswer() {
    if (!currentQuestion) return;

    setAnswers((current) => ({
      ...current,
      [currentQuestion.question._id]: createQuestionAnswerState(
        currentQuestion.question,
      ),
    }));
  }

  async function jumpToQuestion(index: number) {
    await saveAttempt();
    setCurrentIndex(index);
  }

  if (loading) {
    return (
      <PageLoadingState
        title="Loading online test"
        description="Preparing the paper, saved answers, and timer."
      />
    );
  }

  if (loadError || !paper) {
    return (
      <div className="app-page-shell max-w-6xl px-4 py-6 sm:px-0">
        <StudentPortalNav />
        <div className="app-spotlight-card app-spotlight-card-strong">
          <p className="app-spotlight-label">Student portal</p>
          <h1 className="app-spotlight-title">Unable to open this test</h1>
          <p className="app-spotlight-copy">
            The paper could not be prepared for this session. You can go back to
            the assigned-test list and try again.
          </p>
        </div>
        <div className="app-feedback app-feedback-error">
          {loadError || "The requested online test could not be loaded."}
        </div>
        <div className="flex justify-start">
          <Button asChild variant="outline">
            <Link href="/student/tests">Back to Tests</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (attemptLocked) {
    const submittedAtLabel = attempt?.submittedAt
      ? new Date(attempt.submittedAt).toLocaleString()
      : "Not available";
    const submissionStatus =
      attempt?.status === "auto_submitted" ? "Auto submitted" : "Submitted";

    return (
      <div className="app-page-shell max-w-5xl px-4 py-6 sm:px-0">
        <StudentPortalNav />
        <div className="app-spotlight-card app-spotlight-card-strong">
          <p className="app-spotlight-label">Submission complete</p>
          <h1 className="app-spotlight-title">{paper.title}</h1>
          <p className="app-spotlight-copy">
            This attempt has already been submitted, so the runner is now in review-only mode.
          </p>
          <div className="app-spotlight-actions">
            <span className="app-meta-chip">{submissionStatus}</span>
            <span className="app-meta-chip">Submitted at: {submittedAtLabel}</span>
          </div>
        </div>

        <Card className="app-surface">
          <CardHeader className="app-section-header">
            <CardTitle>Submission Summary</CardTitle>
          </CardHeader>
          <CardContent className="app-surface-body">
            <div className="app-inline-stat-grid">
              <div className="app-inline-stat">
                <p className="app-inline-stat-label">Status</p>
                <p className="app-inline-stat-value">{submissionStatus}</p>
                <p className="app-inline-stat-copy">
                  This attempt is now read-only in the runner.
                </p>
              </div>
              <div className="app-inline-stat">
                <p className="app-inline-stat-label">Submitted At</p>
                <p className="app-inline-stat-value">{submittedAtLabel}</p>
                <p className="app-inline-stat-copy">
                  Recorded using the server-side submission timestamp.
                </p>
              </div>
              <div className="app-inline-stat">
                <p className="app-inline-stat-label">
                  {hasManualReviewQuestions ? "Auto-Graded Score" : "Score"}
                </p>
                <p className="app-inline-stat-value">
                  {attempt?.totalMarksAwarded ?? 0} / {paper.totalMarks}
                </p>
                <p className="app-inline-stat-copy">
                  {hasManualReviewQuestions
                    ? "Final marks may change after manual review."
                    : "This score reflects the graded paper result."}
                </p>
              </div>
            </div>

            {hasManualReviewQuestions ? (
              <div className="app-exam-alert app-exam-alert-warning">
                Descriptive answers may still need manual review. The score shown here includes only the auto-graded portion so far.
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button asChild>
                <Link href="/student/tests">Back to Test List</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-page-shell max-w-7xl px-4 py-6 sm:px-0">
      <StudentPortalNav />

      <div className="app-spotlight-card app-spotlight-card-strong">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="app-spotlight-label">Active test</p>
              <h1 className="app-spotlight-title">{paper.title}</h1>
              <p className="app-spotlight-copy">
                Move through the palette, keep your answers updated, and submit once the paper is complete.
              </p>
            </div>
            <div className="app-page-meta">
              <span className="app-meta-chip">One attempt only</span>
              <span className="app-meta-chip">Autosave every 30 seconds</span>
              {hasManualReviewQuestions ? (
                <span className="app-meta-chip">Manual review after submit</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="app-meta-chip">
              {isSaving ? "Saving progress..." : "Autosave active"}
            </span>
            <Button asChild variant="outline" size="sm">
              <Link href="/student/tests">Back to Tests</Link>
            </Button>
          </div>
        </div>

        <div className="app-inline-stat-grid">
          <div className="app-inline-stat">
            <p className="app-inline-stat-label">Current Question</p>
            <p className="app-inline-stat-value">
              {Math.min(currentIndex + 1, questionList.length)} of {questionList.length}
            </p>
            <p className="app-inline-stat-copy">
              Navigate through the paper using the palette or the next and previous controls.
            </p>
          </div>
          <div className="app-inline-stat">
            <p className="app-inline-stat-label">Answered</p>
            <p className="app-inline-stat-value">
              {answeredCount} answered, {unansweredCount} remaining
            </p>
            <p className="app-inline-stat-copy">
              Only saved responses will be submitted with the attempt.
            </p>
          </div>
          <div className="app-inline-stat">
            <p className="app-inline-stat-label">Time Remaining</p>
            <p className="app-inline-stat-value">
              {formatRemainingTime(remainingTimeMs)}
            </p>
            <p className="app-inline-stat-copy">
              The server enforces the deadline even if the page stays open.
            </p>
          </div>
        </div>
      </div>

      {actionError ? (
        <div className="app-feedback app-feedback-error">{actionError}</div>
      ) : null}

      <div className="app-exam-shell">
        <aside className="app-exam-sidebar">
          <Card className="app-surface">
            <CardHeader className="app-section-header">
              <CardTitle>Exam Summary</CardTitle>
            </CardHeader>
            <CardContent className="app-surface-body">
              <div className="app-exam-alert app-exam-alert-warning">
                Time remaining: {formatRemainingTime(remainingTimeMs)}
              </div>

              {hasManualReviewQuestions ? (
                <div className="app-exam-alert app-exam-alert-info">
                  This paper includes descriptive answers that will be reviewed manually after submission.
                </div>
              ) : null}

              <div className="app-exam-summary-grid">
                <div className="app-exam-stat-card">
                  <p className="app-exam-stat-label">Questions</p>
                  <p className="app-exam-stat-value">{questionList.length}</p>
                </div>
                <div className="app-exam-stat-card">
                  <p className="app-exam-stat-label">Answered</p>
                  <p className="app-exam-stat-value">{answeredCount}</p>
                </div>
                <div className="app-exam-stat-card">
                  <p className="app-exam-stat-label">Total Marks</p>
                  <p className="app-exam-stat-value">{paper.totalMarks}</p>
                </div>
                <div className="app-exam-stat-card">
                  <p className="app-exam-stat-label">Passing Marks</p>
                  <p className="app-exam-stat-value">{paper.passingMarks}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    Question Palette
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {answeredCount}/{questionList.length} answered
                  </p>
                </div>
                <div className="app-exam-palette">
                  {questionList.map((item, index) => {
                    const selected = hasAnswerForQuestion(
                      item.question,
                      answers[item.question._id],
                    );
                    const active = index === currentIndex;

                    return (
                      <button
                        key={item.question._id}
                        type="button"
                        onClick={() => void jumpToQuestion(index)}
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
                    <span>Current</span>
                  </div>
                  <div className="app-exam-palette-legend-item">
                    <span className="app-exam-palette-swatch bg-emerald-400" />
                    <span>Answered</span>
                  </div>
                  <div className="app-exam-palette-legend-item">
                    <span className="app-exam-palette-swatch bg-border" />
                    <span>Unanswered</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <AlertDialog
                  open={submitDialogOpen}
                  onOpenChange={setSubmitDialogOpen}
                >
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" disabled={isSubmitting}>
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
                        onClick={() => void submitAttempt(false)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? <Spinner /> : "Confirm Submit"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => void saveAttempt(true)}
                  disabled={isSaving || isSubmitting}
                >
                  {isSaving ? <Spinner /> : "Save Progress"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>

        <main className="space-y-4">
          {paper.instructions ? (
            <Card className="app-surface">
              <CardHeader className="app-section-header">
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent className="app-surface-body prose prose-sm max-w-none dark:prose-invert">
                <p>{paper.instructions}</p>
              </CardContent>
            </Card>
          ) : null}

          {currentQuestion && currentAnswer ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <p className="app-spotlight-label">{currentQuestion.sectionName}</p>
                    <CardTitle className="text-2xl tracking-tight">
                      Question {currentIndex + 1} of {questionList.length}
                    </CardTitle>
                    {currentQuestion.sectionDescription ? (
                      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                        {currentQuestion.sectionDescription}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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
              <CardContent className="app-surface-body app-exam-question-shell">
                <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
                  <ContentRenderer htmlContent={currentQuestion.question.content} />
                </div>

                {currentQuestion.question.type === "single" ||
                currentQuestion.question.type === "multiple" ? (
                  <div className="space-y-3.5">
                    <div className="app-feedback app-feedback-info">
                      {currentQuestion.question.type === "multiple"
                        ? "Select one or more options. Every change is included in autosave."
                        : "Select the best answer. Choosing another option replaces the previous one."}
                    </div>
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
                                updateMultipleChoice(
                                  currentQuestion.question._id,
                                  optionIndex,
                                );
                                return;
                              }
                              updateSingleChoice(
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
                          <div className="app-exam-option-content">
                            <p className="app-exam-option-kicker">
                              {selected ? "Selected option" : "Answer option"}
                            </p>
                            <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
                              <ContentRenderer htmlContent={option.content} />
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : null}

                {currentQuestion.question.type === "descriptive" ? (
                  <div className="space-y-3">
                    <div className="app-exam-alert app-exam-alert-info">
                      Your response will be saved online and reviewed manually after submission.
                    </div>
                    <Textarea
                      value={currentAnswer.answerText}
                      onChange={(event) =>
                        updateDescriptiveAnswer(
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
                            <th className="border border-border/60 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              Match
                            </th>
                            {currentQuestion.question.matrixColumns.map(
                              (column, columnIndex) => (
                                <th
                                  key={columnIndex}
                                  className="border border-border/60 px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
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
                                          updateMatrixSelection(
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
                    <div className="app-feedback app-feedback-error">
                      This matrix question is missing row or column labels and cannot be answered online.
                    </div>
                  )
                ) : null}

                <div className="app-exam-nav-row">
                  <Button
                    variant="outline"
                    onClick={() =>
                      void jumpToQuestion(Math.max(0, currentIndex - 1))
                    }
                    disabled={currentIndex === 0}
                  >
                    Previous
                  </Button>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={clearCurrentAnswer}
                      disabled={!hasAnswerForQuestion(currentQuestion.question, currentAnswer)}
                    >
                      Clear Answer
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        void jumpToQuestion(
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
