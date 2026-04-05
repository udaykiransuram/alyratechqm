"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
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

import type {
  StudentAnswerState,
  StudentAttempt,
  StudentPaper,
  StudentQuestion,
  StudentQuestionListItem,
  StudentTestDetailResponse,
} from "./student-test-types";
import {
  areAnswerStatesEqual,
  buildAnswerMap,
  buildSectionAnswersPayloadFromState,
  clearDraftPersistTimeout,
  createQuestionAnswerState,
  fetchApiJsonWithTimeout,
  formatDateTime,
  formatTimeOfDay,
  getAutosaveIntervalMsByConnection,
  getPaperSubjects,
  hasAnswerForQuestion,
  persistStudentDraftSnapshot,
  readAttemptConflictPayload,
  toTimestamp,
} from "./student-test-runtime-utils";

type UseStudentTestRuntimeArgs = {
  paperId: string;
  initialData: StudentTestDetailResponse | null;
  initialLoadError?: string | null;
  returnToPath?: string;
};

function shouldRetainQuestionState(
  question: StudentQuestion,
  nextState: StudentAnswerState,
) {
  if (question.type === "descriptive") {
    return nextState.answerText.length > 0;
  }

  return hasAnswerForQuestion(question, nextState);
}

function applyQuestionAnswerUpdate(
  current: Record<string, StudentAnswerState>,
  question: StudentQuestion,
  nextState: StudentAnswerState,
) {
  const previousEntry = current[question._id];
  const previousState = createQuestionAnswerState(question, previousEntry);

  if (areAnswerStatesEqual(previousState, nextState)) {
    return current;
  }

  if (!shouldRetainQuestionState(question, nextState)) {
    if (!previousEntry) {
      return current;
    }

    const nextAnswers = { ...current };
    delete nextAnswers[question._id];
    return nextAnswers;
  }

  return {
    ...current,
    [question._id]: nextState,
  };
}

export function useStudentTestRuntime({
  paperId,
  initialData,
  initialLoadError = null,
  returnToPath = "/student/tests",
}: UseStudentTestRuntimeArgs) {
  const router = useRouter();
  const initialPaper = initialData?.paper || null;
  const initialAttempt = initialData?.attempt || null;
  const initialHydration = useMemo(() => {
    const answers = buildAnswerMap(initialAttempt, initialPaper);
    const payload = buildSectionAnswersPayloadFromState(initialPaper, answers);

    return {
      answers,
      signature: JSON.stringify(payload),
    };
  }, [initialAttempt, initialPaper]);

  const [paper, setPaper] = useState<StudentPaper | null>(initialPaper);
  const [attempt, setAttempt] = useState<StudentAttempt | null>(initialAttempt);
  const [answers, setAnswers] = useState<Record<string, StudentAnswerState>>(
    initialHydration.answers,
  );
  const [loading, setLoading] = useState(() => !initialPaper && !initialLoadError);
  const [loadError, setLoadError] = useState<string | null>(initialLoadError);
  const [actionError, setActionError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState(
    String(initialData?.status || "available"),
  );
  const [isStarting, setIsStarting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(
    initialData?.deadlineAt || null,
  );
  const [isOffline, setIsOffline] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [pendingSubmitRetry, setPendingSubmitRetry] = useState(false);
  const [saveRetryAtMs, setSaveRetryAtMs] = useState<number | null>(null);
  const [autosaveIntervalMs, setAutosaveIntervalMs] = useState(30000);

  const answersRef = useRef<Record<string, StudentAnswerState>>(
    initialHydration.answers,
  );
  const attemptLastSavedAtRef = useRef<string | null>(
    initialAttempt?.lastSavedAt || null,
  );
  const lastSavedSignatureRef = useRef<string>(initialHydration.signature);
  const skipInitialFetchRef = useRef(Boolean(initialPaper || initialLoadError));
  const skipMountRefreshRef = useRef(Boolean(initialPaper));
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
  const currentIndexRef = useRef(0);
  const isOfflineRef = useRef(false);
  const answeredQuestionIdsRef = useRef<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const deferredAnswers = useDeferredValue(answers);

  const questionList = useMemo<StudentQuestionListItem[]>(() => {
    return (paper?.sections || []).flatMap((section) =>
      (section.questions || []).map((entry) => ({
        sectionName: section.name,
        sectionDescription: section.description || "",
        sectionInstructions: section.instructions || "",
        sectionDefaultMarks: Number(section.defaultMarks || 0),
        sectionDefaultNegativeMarks: Number(section.defaultNegativeMarks || 0),
        sectionMarks: section.marks,
        marks: entry.marks,
        negativeMarks: entry.negativeMarks,
        question: entry.question,
      })),
    );
  }, [paper]);

  const hasManualReviewQuestions = useMemo(
    () => questionList.some((item) => item.question.type === "descriptive"),
    [questionList],
  );

  const currentQuestion = questionList[currentIndex] || null;
  const currentQuestionState = currentQuestion
    ? answers[currentQuestion.question._id]
    : undefined;
  const currentAnswer = useMemo(() => {
    if (!currentQuestion) return null;
    return createQuestionAnswerState(
      currentQuestion.question,
      currentQuestionState,
    );
  }, [currentQuestion, currentQuestionState]);
  const questionLookup = useMemo(
    () =>
      new Map(
        questionList.map((item) => [item.question._id, item.question] as const),
      ),
    [questionList],
  );

  const answeredQuestionIds = useMemo(() => {
    const nextIds = new Set<string>();

    questionList.forEach((item) => {
      if (hasAnswerForQuestion(item.question, deferredAnswers[item.question._id])) {
        nextIds.add(item.question._id);
      }
    });

    const previousIds = answeredQuestionIdsRef.current;
    if (previousIds.size === nextIds.size) {
      let changed = false;

      for (const questionId of nextIds) {
        if (!previousIds.has(questionId)) {
          changed = true;
          break;
        }
      }

      if (!changed) {
        return previousIds;
      }
    }

    answeredQuestionIdsRef.current = nextIds;
    return nextIds;
  }, [deferredAnswers, questionList]);
  const answeredCount = answeredQuestionIds.size;
  const unansweredCount = Math.max(0, questionList.length - answeredCount);
  const attemptLocked =
    attempt?.status === "submitted" || attempt?.status === "auto_submitted";
  const attemptStarted = Boolean(attempt?._id && attempt?.startedAt);
  const paperSubjects = useMemo(() => getPaperSubjects(paper), [paper]);
  const paperSubjectLabel = paperSubjects
    .map((subject) => String(subject?.name || "").trim())
    .filter(Boolean)
    .join(", ");
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

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline]);

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
      serverLastSavedAt: serverLastSavedAt || nextAttempt.lastSavedAt || null,
    });

    if (nextAttemptLocked) {
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
    const redirectHref =
      returnToPath && returnToPath !== "/student/tests"
        ? returnToPath
        : "/student/tests?submitted=1";
    announceNavigationStart(redirectHref);
    router.push(redirectHref);
  }

  useEffect(() => {
    if (!paperId || !skipInitialFetchRef.current) {
      return;
    }

    skipInitialFetchRef.current = false;

    const nextAttemptStarted = Boolean(attempt?._id && attempt?.startedAt);
    const nextAttemptLocked =
      attempt?.status === "submitted" || attempt?.status === "auto_submitted";

    if (!paper || !nextAttemptStarted || nextAttemptLocked) {
      return;
    }

    const localDraft = readStudentTestDraft(paperId);
    const attemptId = String(attempt?._id || "");

    if (
      !localDraft ||
      (localDraft.attemptId && attemptId && localDraft.attemptId !== attemptId)
    ) {
      return;
    }

    const draftAnswerMap = buildAnswerMap(
      {
        ...(attempt || {}),
        sectionAnswers: localDraft.sectionAnswers,
      } as StudentAttempt,
      paper,
    );
    const draftPayload = buildSectionAnswersPayloadFromState(paper, draftAnswerMap);
    const draftSignature = JSON.stringify(draftPayload);
    const serverSavedAtMs = toTimestamp(attempt?.lastSavedAt);
    const localIsNewer = localDraft.updatedAt > serverSavedAtMs + 1500;

    if (localIsNewer && draftSignature !== lastSavedSignatureRef.current) {
      setAnswers(draftAnswerMap);
      answersRef.current = draftAnswerMap;
      setRecoveryNotice(
        `Recovered unsynced answers from this device (${formatDateTime(new Date(localDraft.updatedAt).toISOString())}).`,
      );
    }
  }, [attempt, paper, paperId]);

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

    if (skipMountRefreshRef.current) {
      skipMountRefreshRef.current = false;
      return () => {
        mounted = false;
        clearDraftPersistTimeout(draftPersistTimerRef);
      };
    }

    if (paperId) {
      void loadTest();
    }

    return () => {
      mounted = false;
      clearDraftPersistTimeout(draftPersistTimerRef);
    };
  }, [paperId]);

  async function runSaveAttempt(force = false) {
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
                attemptId: attempt?._id ? String(attempt._id) : null,
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

  async function runSubmitAttempt(auto = false) {
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
            attemptId: attempt?._id ? String(attempt._id) : null,
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

  saveAttemptRef.current = runSaveAttempt;
  submitAttemptRef.current = runSubmitAttempt;

  useEffect(() => {
    if (!deadlineAt || !attemptStarted || attemptLocked) return;

    const timeoutMs = new Date(deadlineAt).getTime() - Date.now();
    if (!Number.isFinite(timeoutMs)) {
      return;
    }

    if (timeoutMs <= 0) {
      void submitAttemptRef.current(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void submitAttemptRef.current(true);
    }, timeoutMs + 50);

    return () => {
      window.clearTimeout(timeoutId);
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

    const debounceMs = Math.min(
      15000,
      Math.max(5000, Math.floor(autosaveIntervalMs / 2)),
    );
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

  const updateSingleChoice = useCallback(
    (questionId: string, optionIndex: number) => {
      const question = questionLookup.get(questionId);
      if (!question) {
        return;
      }

      const currentAnswers = answersRef.current;
      const previous = createQuestionAnswerState(question, currentAnswers[questionId]);
      const nextAnswers = applyQuestionAnswerUpdate(currentAnswers, question, {
        ...previous,
        selectedOptions: previous.selectedOptions.includes(optionIndex)
          ? []
          : [optionIndex],
      });

      if (nextAnswers === currentAnswers) {
        return;
      }

      answersRef.current = nextAnswers;
      hasUnsavedChangesRef.current = true;
      setAnswers(nextAnswers);
    },
    [questionLookup],
  );

  const updateMultipleChoice = useCallback(
    (questionId: string, optionIndex: number) => {
      const question = questionLookup.get(questionId);
      if (!question) {
        return;
      }

      const currentAnswers = answersRef.current;
      const previous = createQuestionAnswerState(question, currentAnswers[questionId]);
      const next = previous.selectedOptions.includes(optionIndex)
        ? previous.selectedOptions.filter((value) => value !== optionIndex)
        : [...previous.selectedOptions, optionIndex].sort(
            (left, right) => left - right,
          );

      const nextAnswers = applyQuestionAnswerUpdate(currentAnswers, question, {
        ...previous,
        selectedOptions: next,
      });

      if (nextAnswers === currentAnswers) {
        return;
      }

      answersRef.current = nextAnswers;
      hasUnsavedChangesRef.current = true;
      setAnswers(nextAnswers);
    },
    [questionLookup],
  );

  const updateDescriptiveAnswer = useCallback(
    (question: StudentQuestion, value: string) => {
      const currentAnswers = answersRef.current;
      const nextAnswers = applyQuestionAnswerUpdate(currentAnswers, question, {
        ...createQuestionAnswerState(question, currentAnswers[question._id]),
        answerText: value,
      });

      if (nextAnswers === currentAnswers) {
        return;
      }

      answersRef.current = nextAnswers;
      hasUnsavedChangesRef.current = true;
      setAnswers(nextAnswers);
    },
    [],
  );

  const updateMatrixSelection = useCallback(
    (question: StudentQuestion, rowIndex: number, columnIndex: number) => {
      const currentAnswers = answersRef.current;
      const previous = createQuestionAnswerState(question, currentAnswers[question._id]);
      const nextSelections = previous.matrixSelections.map((row, index) => {
        if (index !== rowIndex) return row;

        return row.includes(columnIndex)
          ? row.filter((value) => value !== columnIndex)
          : [...row, columnIndex].sort((left, right) => left - right);
      });

      const nextAnswers = applyQuestionAnswerUpdate(currentAnswers, question, {
        ...previous,
        matrixSelections: nextSelections,
      });

      if (nextAnswers === currentAnswers) {
        return;
      }

      answersRef.current = nextAnswers;
      hasUnsavedChangesRef.current = true;
      setAnswers(nextAnswers);
    },
    [],
  );

  const clearCurrentAnswer = useCallback(() => {
    if (!currentQuestion) return;

    const currentAnswers = answersRef.current;
    if (!currentAnswers[currentQuestion.question._id]) {
      return;
    }

    const nextAnswers = { ...currentAnswers };
    delete nextAnswers[currentQuestion.question._id];
    answersRef.current = nextAnswers;
    hasUnsavedChangesRef.current = true;
    setAnswers(nextAnswers);
  }, [currentQuestion]);

  const jumpToQuestion = useCallback(
    async (index: number) => {
      if (questionList.length === 0) {
        return;
      }

      const nextIndex = Math.min(Math.max(index, 0), questionList.length - 1);
      if (nextIndex === currentIndexRef.current) {
        return;
      }

      currentIndexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
      if (!isOfflineRef.current && hasUnsavedChangesRef.current) {
        void saveAttemptRef.current();
      }
    },
    [questionList.length],
  );

  const toggleFullscreen = useCallback(async () => {
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
  }, []);

  const saveAttempt = useCallback(async (force = false) => {
    await saveAttemptRef.current(force);
  }, []);

  const submitAttempt = useCallback(async (auto = false) => {
    await submitAttemptRef.current(auto);
  }, []);

  return {
    paper,
    attempt,
    loading,
    loadError,
    actionError,
    testStatus,
    isStarting,
    isSaving,
    isSubmitting,
    submitDialogOpen,
    setSubmitDialogOpen,
    currentIndex,
    deadlineAt,
    isOffline,
    connectionNotice,
    recoveryNotice,
    pendingSubmitRetry,
    saveRetryPending,
    autosaveIntervalMs,
    isFullscreen,
    examContainerRef,
    questionList,
    hasManualReviewQuestions,
    currentQuestion,
    currentAnswer,
    answeredQuestionIds,
    answeredCount,
    unansweredCount,
    attemptLocked,
    attemptStarted,
    paperSubjects,
    paperSubjectLabel,
    paperClassLabel,
    saveStatusLabel,
    startAttempt,
    saveAttempt,
    submitAttempt,
    jumpToQuestion,
    toggleFullscreen,
    updateSingleChoice,
    updateMultipleChoice,
    updateDescriptiveAnswer,
    updateMatrixSelection,
    clearCurrentAnswer,
  };
}
