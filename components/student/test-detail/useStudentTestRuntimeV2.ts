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
  autoStart?: boolean;
  allowStartWithoutFullscreen?: boolean;
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

function shouldLockExamUntilFullscreen(nextAttempt: StudentAttempt | null) {
  const nextAttemptStarted = Boolean(nextAttempt?._id && nextAttempt?.startedAt);
  const nextAttemptLocked =
    nextAttempt?.status === "submitted" || nextAttempt?.status === "auto_submitted";

  if (!nextAttemptStarted || nextAttemptLocked) {
    return false;
  }

  if (typeof document === "undefined") {
    return true;
  }

  const isVisible = document.visibilityState === "visible";
  const hasFocus = typeof document.hasFocus === "function" ? document.hasFocus() : true;

  return !isVisible || !hasFocus || !Boolean(document.fullscreenElement);
}

function isFullscreenActive() {
  if (typeof document === "undefined") {
    return false;
  }

  return Boolean(document.fullscreenElement);
}

function countPaperQuestions(paper: StudentPaper | null) {
  return (Array.isArray(paper?.sections) ? paper.sections : []).reduce(
    (total, section) =>
      total + (Array.isArray(section?.questions) ? section.questions.length : 0),
    0,
  );
}

export function useStudentTestRuntime({
  paperId,
  initialData,
  initialLoadError = null,
  returnToPath = "/student/tests",
  autoStart = false,
  allowStartWithoutFullscreen = false,
}: UseStudentTestRuntimeArgs) {
  const router = useRouter();
  const initialPaper = initialData?.paper || null;
  const initialAttempt = initialData?.attempt || null;
  const initialFullscreen = false;
  const fullscreenRequired = !allowStartWithoutFullscreen;
  const initialExamLocked = fullscreenRequired
    ? shouldLockExamUntilFullscreen(initialAttempt)
    : false;
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
  const [isHydratingQuestions, setIsHydratingQuestions] = useState(false);
  const [questionHydrationError, setQuestionHydrationError] = useState<string | null>(
    null,
  );
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
  const paperRef = useRef<StudentPaper | null>(initialPaper);
  const lastSavedSignatureRef = useRef<string>(initialHydration.signature);
  const skipInitialFetchRef = useRef(Boolean(initialPaper || initialLoadError));
  // When the server already gave us bootstrap paper data, keep that lightweight
  // payload on screen for first paint and avoid a blocking refetch on mount.
  const skipMountRefreshRef = useRef(Boolean(initialPaper));
  const backgroundPrefetchTriggeredRef = useRef(false);
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
  const recoveryNoticeRef = useRef<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(initialFullscreen);
  const [isExamLocked, setIsExamLocked] = useState(initialExamLocked);
  const isFullscreenRef = useRef(initialFullscreen);
  const isExamLockedRef = useRef(initialExamLocked);
  const requiresResumeRef = useRef(false);
  const autoStartTriggeredRef = useRef(false);
  const wasFullscreenRef = useRef(false);
  const hasSeenFocusRef = useRef(false);
  const fullscreenTransitionUntilRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastIntervalTickRef = useRef<number | null>(null);
  const loadTestRef = useRef<(mode?: "blocking" | "background") => Promise<void>>(
    async () => {},
  );
  const isHydratingQuestionsRef = useRef(false);
  const attemptLocked =
    attempt?.status === "submitted" || attempt?.status === "auto_submitted";
  const attemptStarted = Boolean(attempt?._id && attempt?.startedAt);
  const deferredAnswers = useDeferredValue(answers);

  const setIsExamLockedIfChanged = useCallback((nextIsExamLocked: boolean) => {
    if (isExamLockedRef.current === nextIsExamLocked) {
      return;
    }

    isExamLockedRef.current = nextIsExamLocked;
    setIsExamLocked(nextIsExamLocked);
  }, []);

  const startFullscreenTransition = useCallback((durationMs = 1600) => {
    fullscreenTransitionUntilRef.current = Date.now() + durationMs;
  }, []);

  const canRequireFullscreenResume = useCallback(() => {
    if (!fullscreenRequired) {
      return false;
    }
    if (!attemptStarted || attemptLocked) {
      return false;
    }

    return fullscreenTransitionUntilRef.current <= Date.now();
  }, [attemptLocked, attemptStarted, fullscreenRequired]);

  const requireFullscreenResume = useCallback(() => {
    if (!canRequireFullscreenResume()) {
      return;
    }

    requiresResumeRef.current = true;
    setIsExamLockedIfChanged(true);
  }, [canRequireFullscreenResume, setIsExamLockedIfChanged]);

  const setIsFullscreenIfChanged = useCallback((nextIsFullscreen: boolean) => {
    if (isFullscreenRef.current === nextIsFullscreen) {
      return;
    }

    isFullscreenRef.current = nextIsFullscreen;
    setIsFullscreen(nextIsFullscreen);
    if (!nextIsFullscreen && fullscreenRequired && canRequireFullscreenResume()) {
      requiresResumeRef.current = true;
      if (!isExamLockedRef.current) {
        isExamLockedRef.current = true;
        setIsExamLocked(true);
      }
    }
  }, [canRequireFullscreenResume, fullscreenRequired]);


  const computeExamLockState = useCallback((nextAttempt: StudentAttempt | null) => {
    if (!fullscreenRequired) {
      return false;
    }
    const nextAttemptStarted = Boolean(nextAttempt?._id && nextAttempt?.startedAt);
    const nextAttemptLocked =
      nextAttempt?.status === "submitted" || nextAttempt?.status === "auto_submitted";

    if (!nextAttemptStarted || nextAttemptLocked) {
      return false;
    }

    if (typeof document === "undefined") {
      return true;
    }

    const isNowFullscreen =
      Boolean(document.fullscreenElement) &&
      document.fullscreenElement === examContainerRef.current;

    return !isNowFullscreen || requiresResumeRef.current;
  }, [fullscreenRequired]);

  const enforceFullscreenLock = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    const isNowFullscreen =
      Boolean(document.fullscreenElement) &&
      document.fullscreenElement === examContainerRef.current;
    if (wasFullscreenRef.current && !isNowFullscreen && canRequireFullscreenResume()) {
      requiresResumeRef.current = true;
    }
    wasFullscreenRef.current = isNowFullscreen;
    setIsFullscreenIfChanged(isNowFullscreen);

    const root = document.documentElement;
    if (attemptStarted && !attemptLocked && isNowFullscreen) {
      root.setAttribute("data-exam-fullscreen", "true");
    } else if (root.getAttribute("data-exam-fullscreen") === "true") {
      root.removeAttribute("data-exam-fullscreen");
    }

    if (!attemptStarted || attemptLocked) {
      setIsExamLockedIfChanged(false);
      return;
    }

    if (!isNowFullscreen && canRequireFullscreenResume()) {
      requiresResumeRef.current = true;
    }

    setIsExamLockedIfChanged(
      computeExamLockState(attemptStarted && !attemptLocked ? attempt : null),
    );
  }, [
    attemptLocked,
    attemptStarted,
    attempt,
    computeExamLockState,
    canRequireFullscreenResume,
    setIsExamLockedIfChanged,
    setIsFullscreenIfChanged,
  ]);

  const requestFullscreenForExamInternal = useCallback(async () => {
    if (typeof document === "undefined") {
      return false;
    }

    if (!document.fullscreenEnabled) {
      return false;
    }

    if (examContainerRef.current) {
      startFullscreenTransition(2000);
      try {
        if (document.fullscreenElement === examContainerRef.current) {
          enforceFullscreenLock();
          return true;
        }

        if (
          document.fullscreenElement &&
          document.fullscreenElement !== examContainerRef.current
        ) {
          try {
            await document.exitFullscreen();
          } catch {}
        }

        await examContainerRef.current.requestFullscreen();
        enforceFullscreenLock();
        return document.fullscreenElement === examContainerRef.current;
      } catch {
        return false;
      }
    }

    return false;
  }, [enforceFullscreenLock, startFullscreenTransition]);

  const resumeFullscreenLock = useCallback(async () => {
    const didEnter = await requestFullscreenForExamInternal();
    if (!didEnter || typeof document === "undefined") {
      enforceFullscreenLock();
      return;
    }

    const start = Date.now();
    const waitForFullscreen = () => {
      const isNowFullscreen =
        Boolean(document.fullscreenElement) &&
        document.fullscreenElement === examContainerRef.current;

      if (isNowFullscreen) {
        requiresResumeRef.current = false;
        wasFullscreenRef.current = true;
        startFullscreenTransition(900);
        enforceFullscreenLock();
        return;
      }

      if (Date.now() - start >= 2000) {
        enforceFullscreenLock();
        return;
      }

      window.setTimeout(waitForFullscreen, 80);
    };

    waitForFullscreen();
  }, [enforceFullscreenLock, requestFullscreenForExamInternal, startFullscreenTransition]);

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
    paperRef.current = paper;
  }, [paper]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    isHydratingQuestionsRef.current = isHydratingQuestions;
  }, [isHydratingQuestions]);

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

  useEffect(() => {
    recoveryNoticeRef.current = recoveryNotice;
  }, [recoveryNotice]);

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

    setIsExamLockedIfChanged(computeExamLockState(nextAttempt));
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
      setIsExamLockedIfChanged(computeExamLockState(nextAttempt));
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

    async function loadTest(mode?: "blocking" | "background") {
      const hasExistingPaper = Boolean(paperRef.current);
      const shouldHydrateInBackground =
        (mode || (hasExistingPaper ? "background" : "blocking")) ===
        "background";

      if (
        shouldHydrateInBackground &&
        paperRef.current?.questionsHydrated !== false
      ) {
        return;
      }

      if (shouldHydrateInBackground && isHydratingQuestionsRef.current) {
        return;
      }

      try {
        if (shouldHydrateInBackground) {
          setIsHydratingQuestions(true);
          setQuestionHydrationError(null);
        } else {
          setLoading(true);
          setLoadError(null);
          setActionError(null);
        }
        const data = await fetchApiJson<any>(
          `/api/student/tests/${paperId}?delivery=full`,
          {
            cache: "no-store",
            fallbackMessage: "We couldn't load the online test.",
          },
        );
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

        if (hasExistingPaper && nextPaper) {
          const currentPayload = buildSectionAnswersPayloadFromState(
            nextPaper,
            answersRef.current,
          );
          const currentSignature = JSON.stringify(currentPayload);

          if (
            currentSignature !== nextSignature &&
            currentSignature !== lastSavedSignatureRef.current
          ) {
            nextAnswers = buildAnswerMap(
              {
                ...(nextAttempt || {}),
                sectionAnswers: currentPayload,
              } as StudentAttempt,
              nextPaper,
            );
            nextPayload = currentPayload;
            nextSignature = currentSignature;
            nextRecoveryNotice =
              nextRecoveryNotice || recoveryNoticeRef.current;
          }
        }

        const nextQuestionCount = countPaperQuestions(nextPaper);
        setIsExamLockedIfChanged(computeExamLockState(nextAttempt));
        setPaper(nextPaper);
        setAttempt(nextAttempt);
        attemptLastSavedAtRef.current = nextAttempt?.lastSavedAt || null;
        setTestStatus(String(data.status || "available"));
        setAnswers(nextAnswers);
        answersRef.current = nextAnswers;
        lastSavedSignatureRef.current = serverSignature;
        setDeadlineAt(data.deadlineAt || null);
        setRecoveryNotice(nextRecoveryNotice);
        setCurrentIndex((previousIndex) => {
          const nextIndex = Math.min(
            previousIndex,
            Math.max(0, nextQuestionCount - 1),
          );
          currentIndexRef.current = nextIndex;
          return nextIndex;
        });

        if (!shouldHydrateInBackground) {
          clearSaveRetryTimer();
          clearSubmitRetryTimer();
          saveRetryDelayMsRef.current = 3000;
          submitRetryDelayMsRef.current = 3000;
          submitRetryAutoRef.current = false;
        }
        setQuestionHydrationError(null);

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
        const message = error?.message || "We couldn't load the online test.";
        if (shouldHydrateInBackground && hasExistingPaper) {
          setQuestionHydrationError(message);
        } else {
          setLoadError(message);
          setPaper(null);
        }
      } finally {
        if (!mounted) {
          return;
        }

        if (shouldHydrateInBackground) {
          setIsHydratingQuestions(false);
        } else {
          setLoading(false);
        }
      }
    }

    loadTestRef.current = loadTest;

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
  }, [computeExamLockState, paperId, setIsExamLockedIfChanged]);

  useEffect(() => {
    if (!attemptStarted || attemptLocked || paper?.questionsHydrated !== false) {
      return;
    }

    if (backgroundPrefetchTriggeredRef.current) {
      return;
    }

    backgroundPrefetchTriggeredRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void loadTestRef.current("background");
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [attemptLocked, attemptStarted, paper?.questionsHydrated]);

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
          setIsExamLockedIfChanged(computeExamLockState(nextAttempt));
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

    if (!auto && !isFullscreenActive()) {
      await requestFullscreenForExamInternal();
    if (
      typeof document === "undefined" ||
      !document.fullscreenElement ||
      (examContainerRef.current &&
        document.fullscreenElement !== examContainerRef.current)
    ) {
      setActionError(
        "Please enter fullscreen to submit the test. Fullscreen is required for the entire test.",
      );
      return;
    }
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

  const startAttempt = useCallback(async () => {
    if (!paper || attemptStarted || isStarting || isSubmitting) {
      return;
    }

    setIsStarting(true);
    setActionError(null);
    setRecoveryNotice(null);

    try {
      if (fullscreenRequired) {
        if (!isFullscreenActive()) {
          await requestFullscreenForExamInternal();
        }

        if (
          typeof document === "undefined" ||
          !document.fullscreenElement ||
          (examContainerRef.current &&
            document.fullscreenElement !== examContainerRef.current)
        ) {
          const isAnyFullscreen = Boolean(document?.fullscreenElement);
          const isExamFullscreen =
            Boolean(document?.fullscreenElement) &&
            document.fullscreenElement === examContainerRef.current;
          const message =
            isAnyFullscreen && !isExamFullscreen
              ? "The test must be the fullscreen element. Close other fullscreen views and try again."
              : "Please enter fullscreen to start the test. Fullscreen is required for the entire test.";
          setActionError(message);
          return;
        }
      }

      requiresResumeRef.current = false;
      startFullscreenTransition(900);
      setIsExamLockedIfChanged(false);
      enforceFullscreenLock();

      const data = await fetchApiJsonWithTimeout<any>(
        `/api/student/tests/${paperId}/attempt`,
        {
          method: "POST",
          fallbackMessage: "We couldn't start your test.",
        },
        15000,
      );

      const nextAttempt = data.attempt || null;
      setIsExamLockedIfChanged(computeExamLockState(nextAttempt));
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
  }, [
    attemptStarted,
    computeExamLockState,
    enforceFullscreenLock,
    fullscreenRequired,
    isStarting,
    isSubmitting,
    paper,
    paperId,
    requestFullscreenForExamInternal,
    setIsExamLockedIfChanged,
    startFullscreenTransition,
  ]);

  saveAttemptRef.current = runSaveAttempt;
  submitAttemptRef.current = runSubmitAttempt;

  useEffect(() => {
    if (!autoStart || autoStartTriggeredRef.current) {
      return;
    }
    if (!paper || attemptStarted || isStarting || isSubmitting || loadError) {
      return;
    }
    autoStartTriggeredRef.current = true;
    void startAttempt();
  }, [autoStart, attemptStarted, isStarting, isSubmitting, loadError, paper, startAttempt]);

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
      if (
        !document.fullscreenElement ||
        document.fullscreenElement !== examContainerRef.current
      ) {
        requireFullscreenResume();
      }
      enforceFullscreenLock();
    };

    const handleVisibilityChange = () => {
      const nextVisible = document.visibilityState === "visible";
      if (!nextVisible) {
        requireFullscreenResume();
      }
      enforceFullscreenLock();
    };

    const handleBlur = () => {
      requireFullscreenResume();
      enforceFullscreenLock();
    };

    const handleFocus = () => {
      if (hasSeenFocusRef.current) {
        requireFullscreenResume();
      }
      hasSeenFocusRef.current = true;
      enforceFullscreenLock();
    };

    const handlePageHide = () => {
      requireFullscreenResume();
      enforceFullscreenLock();
    };

    const handlePageShow = () => {
      enforceFullscreenLock();
    };

    const handleWindowResize = () => {
      enforceFullscreenLock();
    };

    enforceFullscreenLock();
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("resize", handleWindowResize);

    const intervalId = window.setInterval(() => {
      const now = performance.now();
      if (lastIntervalTickRef.current !== null) {
        const delta = now - lastIntervalTickRef.current;
        if (delta > 1500) {
          requireFullscreenResume();
        }
      }
      lastIntervalTickRef.current = now;

      const nextVisible = document.visibilityState === "visible";
      const nextHasFocus =
        typeof document.hasFocus === "function" ? document.hasFocus() : true;
      const isMinimized =
        window.innerWidth === 0 ||
        window.innerHeight === 0 ||
        window.outerWidth === 0 ||
        window.outerHeight === 0;
      const isNowFullscreen =
        Boolean(document.fullscreenElement) &&
        document.fullscreenElement === examContainerRef.current;

      if (!nextVisible || !nextHasFocus || !isNowFullscreen || isMinimized) {
        requireFullscreenResume();
      }

      enforceFullscreenLock();
    }, 120);

    const startRafWatchdog = () => {
      const tick = (timestamp: number) => {
        const last = lastFrameTimeRef.current;
        lastFrameTimeRef.current = timestamp;
        if (
          last !== null &&
          attemptStarted &&
          !attemptLocked &&
          timestamp - last > 1200
        ) {
          requireFullscreenResume();
        }
        rafIdRef.current = window.requestAnimationFrame(tick);
      };

      rafIdRef.current = window.requestAnimationFrame(tick);
    };

    startRafWatchdog();

    return () => {
      const root = document.documentElement;
      if (root.getAttribute("data-exam-fullscreen") === "true") {
        root.removeAttribute("data-exam-fullscreen");
      }
      window.clearInterval(intervalId);
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [
    attemptLocked,
    attemptStarted,
    enforceFullscreenLock,
    requireFullscreenResume,
    setIsExamLockedIfChanged,
  ]);

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
      if (
        questionList[nextIndex]?.question.contentReady === false &&
        !isHydratingQuestionsRef.current
      ) {
        void loadTestRef.current("background");
      }
    },
    [questionList],
  );

  const toggleFullscreen = useCallback(async () => {
    try {
      await requestFullscreenForExamInternal();
    } catch {
      setActionError(
        "Fullscreen mode is not available right now. Fullscreen is required to continue.",
      );
    }
  }, [requestFullscreenForExamInternal]);

  const requestFullscreenForExam = useCallback(async () => {
    await requestFullscreenForExamInternal();
  }, [requestFullscreenForExamInternal]);

  const saveAttempt = useCallback(async (force = false) => {
    await saveAttemptRef.current(force);
  }, []);

  const submitAttempt = useCallback(async (auto = false) => {
    await submitAttemptRef.current(auto);
  }, []);

  const retryQuestionHydration = useCallback(async () => {
    await loadTestRef.current("background");
  }, []);

  return {
    paper,
    attempt,
    loading,
    isHydratingQuestions,
    questionHydrationError,
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
    isExamLocked,
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
    fullscreenRequired,
    jumpToQuestion,
    toggleFullscreen,
    requestFullscreenForExam,
    resumeFullscreenLock,
    retryQuestionHydration,
    updateSingleChoice,
    updateMultipleChoice,
    updateDescriptiveAnswer,
    updateMatrixSelection,
    clearCurrentAnswer,
  };
}
