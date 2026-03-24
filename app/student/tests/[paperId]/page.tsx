"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Expand, Minimize2 } from "lucide-react";

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
import FeedbackNotice from "@/components/ui/feedback-notice";
import PageLoadingState from "@/components/ui/page-loading-state";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiRequestError,
  fetchApiJson,
  getApiRequestErrorCode,
  getApiRequestErrorPayload,
  isRetryableApiError,
} from "@/lib/client/api";
import { announceNavigationStart } from "@/lib/client/navigation-feedback";
import {
  clearStudentTestDraft,
  readStudentTestDraft,
  writeStudentTestDraft,
} from "@/lib/student-test-draft";
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
  lastSavedAt?: string | null;
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

type StudentSectionAnswersPayload = Array<{
  sectionName: string;
  answers: Array<{
    question: string;
    selectedOptions?: number[];
    answerText?: string;
    matrixSelections?: number[][];
  }>;
}>;

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

function formatTimeOfDay(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getOptionLabel(index: number) {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getAutosaveIntervalMsByConnection() {
  if (typeof navigator === "undefined") {
    return 30000;
  }

  const connection = (navigator as any).connection;
  const effectiveType = String(connection?.effectiveType || "").toLowerCase();
  const downlink = Number(connection?.downlink || 0);
  if (
    effectiveType === "slow-2g" ||
    effectiveType === "2g" ||
    (Number.isFinite(downlink) && downlink > 0 && downlink <= 1)
  ) {
    return 45000;
  }

  if (effectiveType === "3g" || (Number.isFinite(downlink) && downlink <= 2.5)) {
    return 30000;
  }

  return 20000;
}

async function fetchApiJsonWithTimeout<T = any>(
  url: string,
  options: Parameters<typeof fetchApiJson<T>>[1],
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchApiJson<T>(url, {
      ...(options || {}),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new ApiRequestError({
        message:
          "The request took too long on this connection. We will retry automatically.",
        code: "CLIENT_TIMEOUT",
        retryable: true,
        httpStatus: 0,
        cause: error,
      });
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function clearDraftPersistTimeout(timeoutRef: { current: number | null }) {
  if (timeoutRef.current !== null) {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}

function persistStudentDraftSnapshot({
  paperId,
  attemptStarted,
  attemptLocked,
  attemptId,
  payload,
  signature,
  serverLastSavedAt,
}: {
  paperId: string;
  attemptStarted: boolean;
  attemptLocked: boolean;
  attemptId?: string | null;
  payload: StudentSectionAnswersPayload;
  signature: string;
  serverLastSavedAt?: string | null;
}) {
  if (!paperId) {
    return;
  }

  if (!attemptStarted || attemptLocked) {
    clearStudentTestDraft(paperId);
    return;
  }

  writeStudentTestDraft({
    paperId,
    attemptId: attemptId ? String(attemptId) : null,
    sectionAnswers: payload,
    answerSignature: signature,
    updatedAt: Date.now(),
    serverLastSavedAt: serverLastSavedAt || null,
  });
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
): StudentSectionAnswersPayload {
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
        answers: sectionAnswers as StudentSectionAnswersPayload[number]["answers"],
      };
    })
    .filter(Boolean) as StudentSectionAnswersPayload;
}

function readAttemptConflictPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {
      attempt: null as StudentAttempt | null,
      serverLastSavedAt: null as string | null,
    };
  }

  const root = payload as Record<string, unknown>;
  const details =
    root.details && typeof root.details === "object"
      ? (root.details as Record<string, unknown>)
      : null;
  const attemptValue = details?.attempt ?? root.attempt;
  const serverLastSavedAtValue =
    details?.serverLastSavedAt ?? root.serverLastSavedAt;

  return {
    attempt:
      attemptValue && typeof attemptValue === "object"
        ? (attemptValue as StudentAttempt)
        : null,
    serverLastSavedAt:
      typeof serverLastSavedAtValue === "string" ? serverLastSavedAtValue : null,
  };
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
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine === false,
  );
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [pendingSubmitRetry, setPendingSubmitRetry] = useState(false);
  const [saveRetryAtMs, setSaveRetryAtMs] = useState<number | null>(null);
  const [autosaveIntervalMs, setAutosaveIntervalMs] = useState(() =>
    getAutosaveIntervalMsByConnection(),
  );

  const answersRef = useRef<Record<string, StudentAnswerState>>({});
  const attemptLastSavedAtRef = useRef<string | null>(null);
  const lastSavedSignatureRef = useRef<string>("");
  const hasUnsavedChangesRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const saveRetryDelayMsRef = useRef(3000);
  const saveRetryTimerRef = useRef<number | null>(null);
  const submitTriggeredRef = useRef(false);
  const submitRetryDelayMsRef = useRef(3000);
  const submitRetryTimerRef = useRef<number | null>(null);
  const submitRetryAutoRef = useRef(false);
  const draftPersistTimerRef = useRef<number | null>(null);
  const saveAttemptRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const submitAttemptRef = useRef<(auto?: boolean) => Promise<void>>(async () => {});
  const examContainerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
  const answerPayload = useMemo(
    () => buildSectionAnswersPayloadFromState(paper, answers),
    [answers, paper],
  );
  const answerSignature = useMemo(() => JSON.stringify(answerPayload), [answerPayload]);
  const hasUnsavedChanges =
    attemptStarted &&
    !attemptLocked &&
    answerSignature !== lastSavedSignatureRef.current;
  const saveRetryPending = saveRetryAtMs !== null;
  const lastSavedTimeLabel = useMemo(
    () => formatTimeOfDay(attempt?.lastSavedAt),
    [attempt?.lastSavedAt],
  );
  const saveStatusLabel = isSubmitting
    ? "Submitting..."
    : pendingSubmitRetry
      ? "Submit retry queued"
    : isSaving
      ? "Saving..."
    : isOffline
      ? "Offline"
      : saveRetryPending
        ? "Retrying save soon"
        : hasUnsavedChanges
          ? "Unsaved changes"
          : lastSavedTimeLabel
            ? `Saved ${lastSavedTimeLabel}`
            : `Autosave ${Math.round(autosaveIntervalMs / 1000)}s`;

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    attemptLastSavedAtRef.current = attempt?.lastSavedAt || null;
  }, [attempt?.lastSavedAt]);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  function clearSaveRetryTimer(resetState = true) {
    if (saveRetryTimerRef.current !== null) {
      window.clearTimeout(saveRetryTimerRef.current);
      saveRetryTimerRef.current = null;
    }
    if (resetState) {
      setSaveRetryAtMs(null);
    }
  }

  function scheduleSaveRetry() {
    if (saveRetryTimerRef.current !== null || attemptLocked || !attemptStarted) {
      return;
    }

    const delay = Math.min(Math.max(2000, saveRetryDelayMsRef.current), 60000);
    saveRetryDelayMsRef.current = Math.min(delay * 2, 60000);
    setSaveRetryAtMs(Date.now() + delay);
    saveRetryTimerRef.current = window.setTimeout(() => {
      saveRetryTimerRef.current = null;
      setSaveRetryAtMs(null);
      void saveAttemptRef.current(true);
    }, delay);
  }

  function clearSubmitRetryTimer(resetState = true) {
    if (submitRetryTimerRef.current !== null) {
      window.clearTimeout(submitRetryTimerRef.current);
      submitRetryTimerRef.current = null;
    }
    if (resetState) {
      setPendingSubmitRetry(false);
    }
  }

  function scheduleSubmitRetry(auto = false) {
    if (submitRetryTimerRef.current !== null || attemptLocked || !attemptStarted) {
      return;
    }

    submitRetryAutoRef.current = auto || submitRetryAutoRef.current;
    const delay = Math.min(Math.max(2000, submitRetryDelayMsRef.current), 60000);
    submitRetryDelayMsRef.current = Math.min(delay * 2, 60000);
    setPendingSubmitRetry(true);
    submitRetryTimerRef.current = window.setTimeout(() => {
      submitRetryTimerRef.current = null;
      void submitAttemptRef.current(submitRetryAutoRef.current);
    }, delay);
  }

  function hydrateAttemptFromServerSnapshot(
    nextAttempt: StudentAttempt | null,
    serverLastSavedAt?: string | null,
  ) {
    if (!paper || !nextAttempt) {
      return false;
    }

    const nextAnswers = buildAnswerMap(nextAttempt, paper);
    const nextPayload = buildSectionAnswersPayloadFromState(paper, nextAnswers);
    const nextSignature = JSON.stringify(nextPayload);
    const nextAttemptStarted = Boolean(nextAttempt?._id && nextAttempt?.startedAt);
    const nextAttemptLocked =
      nextAttempt?.status === "submitted" || nextAttempt?.status === "auto_submitted";

    setAttempt(nextAttempt);
    setAnswers(nextAnswers);
    answersRef.current = nextAnswers;
    setTestStatus(String(nextAttempt.status || "in_progress"));
    lastSavedSignatureRef.current = nextSignature;
    attemptLastSavedAtRef.current =
      serverLastSavedAt || nextAttempt.lastSavedAt || null;
    persistStudentDraftSnapshot({
      paperId,
      attemptStarted: nextAttemptStarted,
      attemptLocked: nextAttemptLocked,
      attemptId: nextAttempt._id ? String(nextAttempt._id) : null,
      payload: nextPayload,
      signature: nextSignature,
      serverLastSavedAt:
        serverLastSavedAt || nextAttempt.lastSavedAt || null,
    });

    if (nextAttemptLocked) {
      setRemainingTimeMs(0);
      setDeadlineAt(nextAttempt.submittedAt || null);
    }

    return true;
  }

  function completeSubmittedFlow(nextAttempt?: StudentAttempt | null) {
    if (nextAttempt) {
      setAttempt(nextAttempt);
      setTestStatus(String(nextAttempt.status || "submitted"));
      attemptLastSavedAtRef.current = nextAttempt.lastSavedAt || null;
    }

    setSubmitDialogOpen(false);
    clearSaveRetryTimer();
    clearSubmitRetryTimer();
    saveRetryDelayMsRef.current = 3000;
    submitRetryDelayMsRef.current = 3000;
    submitRetryAutoRef.current = false;
    clearStudentTestDraft(paperId);
    setRecoveryNotice(null);
    setConnectionNotice(null);
    setActionError(null);
    announceNavigationStart("/student/tests?submitted=1");
    router.push("/student/tests?submitted=1");
  }

  useEffect(() => {
    let mounted = true;

    async function loadTest() {
      try {
        setLoading(true);
        setLoadError(null);
        setActionError(null);
        const data = await fetchApiJson<any>(`/api/student/tests/${paperId}`, {
          cache: "no-store",
          fallbackMessage: "We couldn't load the online test.",
        });
        if (!mounted) return;

        const nextPaper = data.paper || null;
        const nextAttempt = data.attempt || null;
        const serverAnswers = buildAnswerMap(nextAttempt, nextPaper);
        const serverPayload = buildSectionAnswersPayloadFromState(
          nextPaper,
          serverAnswers,
        );
        const serverSignature = JSON.stringify(serverPayload);
        let nextAnswers = serverAnswers;
        let nextPayload = serverPayload;
        let nextSignature = serverSignature;
        let nextRecoveryNotice: string | null = null;
        const nextAttemptStarted = Boolean(nextAttempt?._id && nextAttempt?.startedAt);
        const nextAttemptLocked =
          nextAttempt?.status === "submitted" || nextAttempt?.status === "auto_submitted";

        if (paperId && nextAttemptStarted && !nextAttemptLocked) {
          const localDraft = readStudentTestDraft(paperId);
          const attemptId = String(nextAttempt?._id || "");

          if (
            localDraft &&
            (!localDraft.attemptId || !attemptId || localDraft.attemptId === attemptId)
          ) {
            const draftAnswerMap = buildAnswerMap(
              {
                ...(nextAttempt || {}),
                sectionAnswers: localDraft.sectionAnswers,
              } as StudentAttempt,
              nextPaper,
            );
            const draftPayload = buildSectionAnswersPayloadFromState(
              nextPaper,
              draftAnswerMap,
            );
            const draftSignature = JSON.stringify(draftPayload);
            const serverSavedAtMs = toTimestamp(nextAttempt?.lastSavedAt);
            const localIsNewer = localDraft.updatedAt > serverSavedAtMs + 1500;

            if (localIsNewer && draftSignature !== serverSignature) {
              nextAnswers = draftAnswerMap;
              nextPayload = draftPayload;
              nextSignature = draftSignature;
              nextRecoveryNotice = `Recovered unsynced answers from this device (${formatDateTime(new Date(localDraft.updatedAt).toISOString())}).`;
            }
          }
        }

        setPaper(nextPaper);
        setAttempt(nextAttempt);
        attemptLastSavedAtRef.current = nextAttempt?.lastSavedAt || null;
        setTestStatus(String(data.status || "available"));
        setAnswers(nextAnswers);
        answersRef.current = nextAnswers;
        lastSavedSignatureRef.current = serverSignature;
        setRemainingTimeMs(
          typeof data.remainingTimeMs === "number" ? data.remainingTimeMs : null,
        );
        setDeadlineAt(data.deadlineAt || null);
        setRecoveryNotice(nextRecoveryNotice);
        setCurrentIndex(0);

        clearSaveRetryTimer();
        clearSubmitRetryTimer();
        saveRetryDelayMsRef.current = 3000;
        submitRetryDelayMsRef.current = 3000;
        submitRetryAutoRef.current = false;

        if (paperId) {
          if (nextAttemptStarted && !nextAttemptLocked) {
            writeStudentTestDraft({
              paperId,
              attemptId: nextAttempt?._id ? String(nextAttempt._id) : null,
              sectionAnswers: nextPayload,
              answerSignature: nextSignature,
              updatedAt: Date.now(),
              serverLastSavedAt: nextAttempt?.lastSavedAt || null,
            });
          } else {
            clearStudentTestDraft(paperId);
          }
        }
      } catch (error: any) {
        if (!mounted) return;
        setLoadError(error?.message || "We couldn't load the online test.");
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
      clearDraftPersistTimeout(draftPersistTimerRef);
    };
  }, [paperId]);

  async function saveAttempt(force = false) {
    if (!paper || !attemptStarted || attemptLocked || isSubmitting) {
      return;
    }

    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }

    saveInFlightRef.current = true;
    setIsSaving(true);

    try {
      let shouldForceSave = force;
      let requestBaseLastSavedAt = attemptLastSavedAtRef.current;

      while (true) {
        saveQueuedRef.current = false;

        const payload = buildSectionAnswersPayloadFromState(
          paper,
          answersRef.current,
        );
        const signature = JSON.stringify(payload);
        if (!shouldForceSave && signature === lastSavedSignatureRef.current) {
          break;
        }

        try {
          const data = await fetchApiJsonWithTimeout<any>(
            `/api/student/tests/${paperId}/attempt`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sectionAnswers: payload,
                baseLastSavedAt: requestBaseLastSavedAt,
              }),
              fallbackMessage: "We couldn't save your latest answers.",
            },
            15000,
          );
          const nextAttempt = data.attempt || null;
          setAttempt(nextAttempt);
          attemptLastSavedAtRef.current = nextAttempt?.lastSavedAt || null;
          requestBaseLastSavedAt = attemptLastSavedAtRef.current;
          setRemainingTimeMs(
            typeof data.remainingTimeMs === "number"
              ? data.remainingTimeMs
              : null,
          );
          setDeadlineAt(data.deadlineAt || null);
          setTestStatus(String(data.status || "in_progress"));
          lastSavedSignatureRef.current = signature;
          setActionError(null);
          clearSaveRetryTimer();
          saveRetryDelayMsRef.current = 3000;
          persistStudentDraftSnapshot({
            paperId,
            attemptStarted,
            attemptLocked,
            attemptId: nextAttempt?._id ? String(nextAttempt._id) : null,
            payload,
            signature,
            serverLastSavedAt: nextAttempt?.lastSavedAt || null,
          });
          if (typeof navigator !== "undefined" && navigator.onLine !== false) {
            setConnectionNotice(null);
          }
        } catch (error: any) {
          const message = error?.message || "We couldn't save your latest answers.";
          const code = getApiRequestErrorCode(error);
          const retryable = isRetryableApiError(error);
          const payloadData = getApiRequestErrorPayload(error);
          const conflictPayload = readAttemptConflictPayload(payloadData);
          setActionError(message);
          persistStudentDraftSnapshot({
            paperId,
            attemptStarted,
            attemptLocked,
            attemptId: attempt?._id ? String(attempt._id) : null,
            payload,
            signature,
            serverLastSavedAt:
              attemptLastSavedAtRef.current || attempt?.lastSavedAt || null,
          });
          if (code === "ATTEMPT_ALREADY_SUBMITTED") {
            completeSubmittedFlow(conflictPayload.attempt);
            break;
          }
          if (code === "ATTEMPT_STATE_CONFLICT") {
            clearSaveRetryTimer();
            saveRetryDelayMsRef.current = 3000;
            const hydrated = hydrateAttemptFromServerSnapshot(
              conflictPayload.attempt,
              conflictPayload.serverLastSavedAt,
            );
            if (hydrated) {
              setRecoveryNotice(
                "A newer server version was found from another session. We loaded the latest saved answers.",
              );
            }
            setConnectionNotice(null);
            break;
          }

          if (retryable) {
            scheduleSaveRetry();
            if (typeof navigator !== "undefined" && navigator.onLine !== false) {
              setConnectionNotice(
                "Connection is unstable. We will keep retrying your save in the background.",
              );
            }
          } else {
            clearSaveRetryTimer();
            setConnectionNotice(null);
          }
          break;
        }

        shouldForceSave = false;
        if (!saveQueuedRef.current) {
          break;
        }
      }
    } finally {
      saveInFlightRef.current = false;
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
      const payload = buildSectionAnswersPayloadFromState(paper, answersRef.current);
      const payloadSignature = JSON.stringify(payload);
      const requestBaseLastSavedAt = attemptLastSavedAtRef.current;
      persistStudentDraftSnapshot({
        paperId,
        attemptStarted,
        attemptLocked,
        attemptId: attempt?._id ? String(attempt._id) : null,
        payload,
        signature: payloadSignature,
        serverLastSavedAt: attempt?.lastSavedAt || null,
      });

      const data = await fetchApiJsonWithTimeout<any>(
        `/api/student/tests/${paperId}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionAnswers: payload,
            baseLastSavedAt: requestBaseLastSavedAt,
          }),
          fallbackMessage: auto
            ? "Time expired, but the final submission could not reach the server. Keep this tab open and reconnect so we can try again."
            : "We couldn't submit your test.",
        },
        20000,
      );
      completeSubmittedFlow(data.attempt || null);
    } catch (error: any) {
      submitTriggeredRef.current = false;
      const message = error?.message || "We couldn't submit your test.";
      const code = getApiRequestErrorCode(error);
      const retryable = isRetryableApiError(error);
      const payloadData = getApiRequestErrorPayload(error);
      const conflictPayload = readAttemptConflictPayload(payloadData);

      if (code === "ATTEMPT_ALREADY_SUBMITTED") {
        completeSubmittedFlow(conflictPayload.attempt);
        return;
      }

      if (code === "ATTEMPT_STATE_CONFLICT") {
        clearSaveRetryTimer();
        clearSubmitRetryTimer();
        saveRetryDelayMsRef.current = 3000;
        submitRetryDelayMsRef.current = 3000;
        submitRetryAutoRef.current = false;
        setSubmitDialogOpen(false);
        const hydrated = hydrateAttemptFromServerSnapshot(
          conflictPayload.attempt,
          conflictPayload.serverLastSavedAt,
        );
        if (hydrated) {
          setRecoveryNotice(
            "A newer server version was found from another session. We loaded the latest saved answers. Review and submit again.",
          );
        }
        setConnectionNotice(null);
        setActionError(
          hydrated
            ? `${message} Review the latest answers and submit again.`
            : message,
        );
        return;
      }

      if (retryable) {
        scheduleSubmitRetry(auto);
        setActionError(
          `${message} We will keep retrying your submission while this tab stays open.`,
        );
        if (typeof navigator !== "undefined" && navigator.onLine !== false) {
          setConnectionNotice(
            "Submission is waiting for a stable connection. Keep this tab open.",
          );
        }
      } else {
        clearSubmitRetryTimer();
        setConnectionNotice(null);
        setActionError(message);
      }
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
    setRecoveryNotice(null);

    try {
      const data = await fetchApiJsonWithTimeout<any>(
        `/api/student/tests/${paperId}/attempt`,
        {
          method: "POST",
          fallbackMessage: "We couldn't start your test.",
        },
        15000,
      );

      const nextAttempt = data.attempt || null;
      setAttempt(nextAttempt);
      attemptLastSavedAtRef.current = nextAttempt?.lastSavedAt || null;
      setTestStatus(String(data.status || "in_progress"));
      setRemainingTimeMs(
        typeof data.remainingTimeMs === "number" ? data.remainingTimeMs : null,
      );
      setDeadlineAt(data.deadlineAt || null);
      const payload = buildSectionAnswersPayloadFromState(paper, answersRef.current);
      const signature = JSON.stringify(payload);
      lastSavedSignatureRef.current = signature;
      if (paperId) {
        writeStudentTestDraft({
          paperId,
          attemptId: nextAttempt?._id ? String(nextAttempt._id) : null,
          sectionAnswers: payload,
          answerSignature: signature,
          updatedAt: Date.now(),
          serverLastSavedAt: nextAttempt?.lastSavedAt || null,
        });
      }
    } catch (error: any) {
      setActionError(error?.message || "We couldn't start your test.");
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
      if (pendingSubmitRetry) {
        void submitAttemptRef.current(submitRetryAutoRef.current);
        return;
      }

      if (hasUnsavedChangesRef.current) {
        void saveAttemptRef.current();
      }
    }, autosaveIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [attemptLocked, attemptStarted, autosaveIntervalMs, paper, pendingSubmitRetry]);

  useEffect(() => {
    if (
      !paper ||
      !attemptStarted ||
      attemptLocked ||
      isOffline ||
      isSubmitting ||
      !hasUnsavedChanges
    ) {
      return;
    }

    const debounceMs = Math.min(15000, Math.max(5000, Math.floor(autosaveIntervalMs / 2)));
    const timeoutId = window.setTimeout(() => {
      void saveAttemptRef.current();
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    answerSignature,
    attemptLocked,
    attemptStarted,
    autosaveIntervalMs,
    hasUnsavedChanges,
    isOffline,
    isSubmitting,
    paper,
  ]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    const connection = (navigator as any).connection;
    if (!connection || typeof connection.addEventListener !== "function") {
      return;
    }

    const handleConnectionChange = () => {
      setAutosaveIntervalMs(getAutosaveIntervalMsByConnection());
    };

    handleConnectionChange();
    connection.addEventListener("change", handleConnectionChange);
    return () => {
      connection.removeEventListener("change", handleConnectionChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOffline = () => {
      setIsOffline(true);
      setConnectionNotice(
        "You are offline. Keep this tab open. Your latest answers stay in this browser and will save again when the connection returns.",
      );
    };

    const handleOnline = () => {
      setIsOffline(false);
      setConnectionNotice(null);

      if (attemptStarted && !attemptLocked && pendingSubmitRetry) {
        clearSubmitRetryTimer();
        void submitAttemptRef.current(submitRetryAutoRef.current);
      } else if (attemptStarted && !attemptLocked && hasUnsavedChangesRef.current) {
        clearSaveRetryTimer();
        void saveAttemptRef.current(true);
      }
    };

    if (navigator.onLine === false) {
      handleOffline();
    } else {
      setIsOffline(false);
      setConnectionNotice(null);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [attemptLocked, attemptStarted, pendingSubmitRetry]);

  useEffect(() => {
    if (!paperId) return;

    if (!attemptStarted || attemptLocked) {
      clearStudentTestDraft(paperId);
      return;
    }

    clearDraftPersistTimeout(draftPersistTimerRef);
    draftPersistTimerRef.current = window.setTimeout(() => {
      persistStudentDraftSnapshot({
        paperId,
        attemptStarted,
        attemptLocked,
        attemptId: attempt?._id ? String(attempt._id) : null,
        payload: answerPayload,
        signature: answerSignature,
        serverLastSavedAt: attempt?.lastSavedAt || null,
      });
      draftPersistTimerRef.current = null;
    }, 350);

    return () => {
      clearDraftPersistTimeout(draftPersistTimerRef);
    };
  }, [
    answerPayload,
    answerSignature,
    attempt?._id,
    attempt?.lastSavedAt,
    attemptLocked,
    attemptStarted,
    paperId,
  ]);

  useEffect(() => {
    return () => {
      clearSaveRetryTimer(false);
      clearSubmitRetryTimer(false);
      clearDraftPersistTimeout(draftPersistTimerRef);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !attemptStarted || attemptLocked) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (
        !hasUnsavedChangesRef.current &&
        !isSaving &&
        !isSubmitting &&
        !pendingSubmitRetry
      ) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [attemptLocked, attemptStarted, isSaving, isSubmitting, pendingSubmitRetry]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === examContainerRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

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
    if (index === currentIndex) {
      return;
    }

    setCurrentIndex(index);
    if (!isOffline && hasUnsavedChangesRef.current) {
      void saveAttemptRef.current();
    }
  }

  async function toggleFullscreen() {
    if (typeof document === "undefined" || !examContainerRef.current) {
      return;
    }

    try {
      if (document.fullscreenElement === examContainerRef.current) {
        await document.exitFullscreen();
        return;
      }

      await examContainerRef.current.requestFullscreen();
    } catch {
      setActionError(
        "Fullscreen mode is not available right now. You can still continue the test normally.",
      );
    }
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
        <FeedbackNotice variant="error">
          {loadError || "We couldn't load the requested online test."}
        </FeedbackNotice>
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
              <FeedbackNotice variant="info">
                Manual review is still pending for descriptive answers.
              </FeedbackNotice>
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
          <FeedbackNotice variant="error">{actionError}</FeedbackNotice>
        ) : null}

        {testStatus === "upcoming" ? (
          <FeedbackNotice variant="info">
            This test has not opened yet. Online access starts at {effectiveStart}.
          </FeedbackNotice>
        ) : null}

        {testStatus === "expired" ? (
          <FeedbackNotice variant="error">
            This test is closed and can no longer be started.
          </FeedbackNotice>
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
          <FeedbackNotice variant="info">
            Descriptive answers will be reviewed after submission.
          </FeedbackNotice>
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
    <div
      ref={examContainerRef}
      className={cn(
        "app-page-shell app-exam-focus-shell max-w-[96rem] px-3 py-3 sm:px-4 sm:py-4",
        isFullscreen && "app-exam-focus-shell-fullscreen",
      )}
    >
      <div className="app-exam-focus-topbar">
        <div className="app-exam-focus-topbar-copy">
          <p className="app-spotlight-label">Active test</p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {paper.title}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {[paperSubjectLabel, paperClassLabel].filter(Boolean).join(" • ") ||
              `${questionList.length} questions`}
          </p>
        </div>
        <div className="app-exam-focus-topbar-meta">
          <span className="app-meta-chip">
            {formatRemainingTime(remainingTimeMs)}
          </span>
          <span className="app-meta-chip">
            {answeredCount}/{questionList.length} answered
          </span>
          <span className="app-meta-chip">
            Q{Math.min(currentIndex + 1, questionList.length)}/{questionList.length}
          </span>
          <span className="app-meta-chip">
            {saveStatusLabel}
          </span>
        </div>
        <div className="app-exam-focus-topbar-actions">
          <Button
            type="button"
            variant="outline"
            onClick={() => void saveAttempt(true)}
            disabled={isSaving || isSubmitting}
          >
            {isSaving ? <Spinner /> : "Save"}
          </Button>

          <Button type="button" variant="outline" onClick={() => void toggleFullscreen()}>
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
              <Button disabled={isSubmitting}>
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
            <CardContent className="app-section-body space-y-4">
              <div className="app-exam-summary-grid">
                <div className="app-exam-stat-card">
                  <p className="app-exam-stat-label">Time Left</p>
                  <div className="app-exam-stat-value">
                    {formatRemainingTime(remainingTimeMs)}
                  </div>
                </div>
                <div className="app-exam-stat-card">
                  <p className="app-exam-stat-label">Remaining</p>
                  <div className="app-exam-stat-value">{unansweredCount}</div>
                </div>
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

              {hasManualReviewQuestions ? (
                <FeedbackNotice variant="info">
                  Descriptive answers will still need manual review after submission.
                </FeedbackNotice>
              ) : null}

              {paper.instructions ? (
                <details className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-medium text-foreground">
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
              <CardContent className="app-section-body app-exam-question-body app-exam-question-shell">
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
                    <FeedbackNotice variant="error">
                      This matrix question is missing row or column labels and cannot be answered online.
                    </FeedbackNotice>
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
