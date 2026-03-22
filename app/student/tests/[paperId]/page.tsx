"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { ContentRenderer } from "@/components/ContentRenderer";
import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
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
import { announceNavigationStart } from "@/lib/client/navigation-feedback";
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
  examDate?: string | null;
  onlineStartsAt?: string | null;
  onlineEndsAt?: string | null;
  class?: { _id: string; name: string } | null;
  subject?: { _id: string; name: string } | null;
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

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  in_progress: "In Progress",
  upcoming: "Upcoming",
  submitted: "Submitted",
  auto_submitted: "Auto Submitted",
  expired: "Expired",
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

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
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
  const testsHref = "/student/tests";

  const [paper, setPaper] = useState<StudentPaper | null>(null);
  const [attempt, setAttempt] = useState<StudentAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, StudentAnswerState>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState("available");
  const [isStarting, setIsStarting] = useState(false);
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
  const attemptStarted = Boolean(attempt?._id && attempt?.startedAt);
  const paperSubjectLabel = String(paper?.subject?.name || "").trim();
  const paperClassLabel = String(paper?.class?.name || "").trim();

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
        setTestStatus(String(data.status || "available"));
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
    if (!paper || !attemptStarted || attemptLocked || isSubmitting || isSaving) {
      return;
    }

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
      setDeadlineAt(data.deadlineAt || null);
      setTestStatus(String(data.status || "in_progress"));
      lastSavedSignatureRef.current = signature;
      setActionError(null);
    } catch (error: any) {
      setActionError(error?.message || "Failed to save your attempt.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitAttempt(auto = false) {
    if (!paper || !attemptStarted || submitTriggeredRef.current || isSubmitting) {
      return;
    }

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
      announceNavigationStart("/student/tests?submitted=1");
      router.push("/student/tests?submitted=1");
    } catch (error: any) {
      submitTriggeredRef.current = false;
      setActionError(error?.message || "Failed to submit the online test.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function startAttempt() {
    if (!paper || attemptStarted || isStarting || isSubmitting) {
      return;
    }

    setIsStarting(true);
    setActionError(null);

    try {
      const data = await fetchApiJson<any>(`/api/student/tests/${paperId}/attempt`, {
        method: "POST",
        fallbackMessage: "Failed to start the online test.",
      });

      const nextAttempt = data.attempt || null;
      setAttempt(nextAttempt);
      setTestStatus(String(data.status || "in_progress"));
      setRemainingTimeMs(
        typeof data.remainingTimeMs === "number" ? data.remainingTimeMs : null,
      );
      setDeadlineAt(data.deadlineAt || null);
      lastSavedSignatureRef.current = JSON.stringify(
        buildSectionAnswersPayloadFromState(paper, answersRef.current),
      );
    } catch (error: any) {
      setActionError(error?.message || "Failed to start the online test.");
    } finally {
      setIsStarting(false);
    }
  }

  saveAttemptRef.current = saveAttempt;
  submitAttemptRef.current = submitAttempt;

  useEffect(() => {
    if (!deadlineAt || !attemptStarted || attemptLocked) return;

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
  }, [attemptLocked, attemptStarted, deadlineAt]);

  useEffect(() => {
    if (!paper || !attemptStarted || attemptLocked) return;

    const interval = window.setInterval(() => {
      void saveAttemptRef.current();
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [attemptLocked, attemptStarted, paper]);

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
        title="Loading test"
        description="Preparing your exam."
      />
    );
  }

  if (loadError || !paper) {
    return (
      <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
        <PageHero
          eyebrow="Student Portal"
          title="Test"
          actions={
            <Button asChild variant="outline">
              <AppPrefetchLink href={testsHref} prefetchOnMount>
                Back to Tests
              </AppPrefetchLink>
            </Button>
          }
        >
          <StudentPortalNav />
        </PageHero>
        <div className="app-feedback app-feedback-error">
          {loadError || "The requested online test could not be loaded."}
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
      <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
        <PageHero
          eyebrow="Student Portal"
          title={paper.title}
          actions={
            <Button asChild variant="outline">
              <AppPrefetchLink href={testsHref} prefetchOnMount>
                Back to Tests
              </AppPrefetchLink>
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="app-page-meta">
              {paperSubjectLabel ? (
                <span className="app-meta-chip">{paperSubjectLabel}</span>
              ) : null}
              {paperClassLabel ? (
                <span className="app-meta-chip">{paperClassLabel}</span>
              ) : null}
              <span className="app-meta-chip">{submissionStatus}</span>
              <span className="app-meta-chip">{submittedAtLabel}</span>
            </div>
            <StudentPortalNav />
          </div>
        </PageHero>

        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Submission Summary</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <div className="app-detail-grid">
              <div className="app-detail-item">
                <p className="app-detail-label">Status</p>
                <div className="app-detail-value">{submissionStatus}</div>
              </div>
              <div className="app-detail-item">
                <p className="app-detail-label">
                  {hasManualReviewQuestions ? "Auto-Graded Score" : "Score"}
                </p>
                <div className="app-detail-value">
                  {attempt?.totalMarksAwarded ?? 0} / {paper.totalMarks}
                </div>
              </div>
              <div className="app-detail-item">
                <p className="app-detail-label">Questions</p>
                <div className="app-detail-value">{questionList.length}</div>
              </div>
              <div className="app-detail-item">
                <p className="app-detail-label">Submitted</p>
                <div className="app-detail-value">{submittedAtLabel}</div>
              </div>
            </div>

            {hasManualReviewQuestions ? (
              <div className="app-feedback app-feedback-info">
                Manual review is still pending for descriptive answers.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!attemptStarted) {
    const effectiveStart = formatDateTime(paper.onlineStartsAt || paper.examDate);
    const effectiveEnd = formatDateTime(paper.onlineEndsAt);
    const statusLabel = STATUS_LABELS[testStatus] || testStatus;
    const canStartNow = testStatus === "available";

    return (
      <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
        <PageHero
          eyebrow="Student Portal"
          title={paper.title}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline">
                <AppPrefetchLink href={testsHref} prefetchOnMount>
                  Back to Tests
                </AppPrefetchLink>
              </Button>
              <Button
                onClick={() => void startAttempt()}
                disabled={!canStartNow || isStarting}
              >
                {isStarting ? <Spinner /> : "Start Test"}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="app-page-meta">
              <span className="app-meta-chip">{statusLabel}</span>
              {paperSubjectLabel ? (
                <span className="app-meta-chip">{paperSubjectLabel}</span>
              ) : null}
              {paperClassLabel ? (
                <span className="app-meta-chip">{paperClassLabel}</span>
              ) : null}
              <span className="app-meta-chip">{paper.duration} min</span>
            </div>
            <StudentPortalNav />
          </div>
        </PageHero>

        {actionError ? (
          <div className="app-feedback app-feedback-error">{actionError}</div>
        ) : null}

        {testStatus === "upcoming" ? (
          <div className="app-feedback app-feedback-info">
            This test has not opened yet. Online access starts at {effectiveStart}.
          </div>
        ) : null}

        {testStatus === "expired" ? (
          <div className="app-feedback app-feedback-error">
            This test is closed and can no longer be started.
          </div>
        ) : null}

        <div className="app-toolbar">
          <div className="app-toolbar-row">
            <div className="flex flex-wrap items-center gap-2">
              <span className="app-meta-chip">{questionList.length} questions</span>
              <span className="app-meta-chip">Opens {effectiveStart}</span>
              <span className="app-meta-chip">Closes {effectiveEnd}</span>
              <span className="app-meta-chip">Passing {paper.passingMarks}</span>
            </div>
          </div>
        </div>

        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Test Details</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <div className="app-detail-grid">
              <div className="app-detail-item">
                <p className="app-detail-label">Status</p>
                <div className="app-detail-value">{statusLabel}</div>
              </div>
              <div className="app-detail-item">
                <p className="app-detail-label">Subject</p>
                <div className="app-detail-value">{paperSubjectLabel || "—"}</div>
              </div>
              <div className="app-detail-item">
                <p className="app-detail-label">Class</p>
                <div className="app-detail-value">{paperClassLabel || "—"}</div>
              </div>
              <div className="app-detail-item">
                <p className="app-detail-label">Questions</p>
                <div className="app-detail-value">{questionList.length}</div>
              </div>
              <div className="app-detail-item">
                <p className="app-detail-label">Duration</p>
                <div className="app-detail-value">{paper.duration} min</div>
              </div>
              <div className="app-detail-item">
                <p className="app-detail-label">Passing Marks</p>
                <div className="app-detail-value">{paper.passingMarks}</div>
              </div>
              <div className="app-detail-item">
                <p className="app-detail-label">Total Marks</p>
                <div className="app-detail-value">{paper.totalMarks}</div>
              </div>
              <div className="app-detail-item">
                <p className="app-detail-label">Online Start</p>
                <div className="app-detail-value">{effectiveStart}</div>
              </div>
              <div className="app-detail-item">
                <p className="app-detail-label">Online End</p>
                <div className="app-detail-value">{effectiveEnd}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {hasManualReviewQuestions ? (
          <div className="app-feedback app-feedback-info">
            Descriptive answers will be reviewed after submission.
          </div>
        ) : null}

        {paper.instructions ? (
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Instructions</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body prose prose-sm max-w-none dark:prose-invert">
              <p>{paper.instructions}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="Student Portal"
        title={paper.title}
        actions={
          <Button asChild variant="outline">
            <AppPrefetchLink href={testsHref} prefetchOnMount>
              Back to Tests
            </AppPrefetchLink>
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="app-page-meta">
            {paperSubjectLabel ? (
              <span className="app-meta-chip">{paperSubjectLabel}</span>
            ) : null}
            {paperClassLabel ? (
              <span className="app-meta-chip">{paperClassLabel}</span>
            ) : null}
            <span className="app-meta-chip">{paper.duration} min</span>
          </div>
          <StudentPortalNav />
        </div>
      </PageHero>

      {actionError ? (
        <div className="app-feedback app-feedback-error">{actionError}</div>
      ) : null}

      <div className="app-toolbar">
        <div className="app-toolbar-row">
          <div className="flex flex-wrap items-center gap-2">
            <span className="app-meta-chip">
              {formatRemainingTime(remainingTimeMs)}
            </span>
            <span className="app-meta-chip">
              {answeredCount}/{questionList.length} answered
            </span>
            <span className="app-meta-chip">
              Question {Math.min(currentIndex + 1, questionList.length)} of {questionList.length}
            </span>
            <span className="app-meta-chip">
              {isSaving ? "Saving..." : "Autosave on"}
            </span>
          </div>
        </div>
      </div>

      <div className="app-exam-shell">
        <aside className="app-exam-sidebar">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Session Summary</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="app-detail-item">
                  <p className="app-detail-label">Time Left</p>
                  <div className="app-detail-value">
                    {formatRemainingTime(remainingTimeMs)}
                  </div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Questions</p>
                  <div className="app-detail-value">{questionList.length}</div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Answered</p>
                  <div className="app-detail-value">{answeredCount}</div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Remaining</p>
                  <div className="app-detail-value">{unansweredCount}</div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Total Marks</p>
                  <div className="app-detail-value">{paper.totalMarks}</div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Passing Marks</p>
                  <div className="app-detail-value">{paper.passingMarks}</div>
                </div>
              </div>

              {hasManualReviewQuestions ? (
                <div className="app-feedback app-feedback-info">
                  Descriptive answers need manual review after submission.
                </div>
              ) : null}

              <div className="space-y-2 border-t border-border/60 pt-4">
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

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Question Palette</CardTitle>
                <span className="app-meta-chip">
                  {answeredCount}/{questionList.length} answered
                </span>
              </div>
            </CardHeader>
            <CardContent className="app-section-body space-y-4">
              <p className="text-sm text-muted-foreground">
                Jump to any question at any time.
              </p>
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
            </CardContent>
          </Card>
        </aside>

        <main className="space-y-4">
          {paper.instructions ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body prose prose-sm max-w-none dark:prose-invert">
                <p>{paper.instructions}</p>
              </CardContent>
            </Card>
          ) : null}

          {currentQuestion && currentAnswer ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
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
              <CardContent className="app-section-body app-exam-question-shell">
                <div className="prose prose-sm max-w-none text-foreground dark:prose-invert">
                  <ContentRenderer htmlContent={currentQuestion.question.content} />
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
                          <div className="min-w-0 flex-1">
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
