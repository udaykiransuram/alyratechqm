"use client";

import {
  ApiRequestError,
  fetchApiJson,
} from "@/lib/client/api";
import {
  clearStudentTestDraft,
  writeStudentTestDraft,
} from "@/lib/student-test-draft";

import type {
  StudentAnswerState,
  StudentAttempt,
  StudentPaper,
  StudentQuestion,
  StudentSectionAnswersPayload,
} from "./student-test-types";

export type AttemptConflictPayload = {
  attempt: StudentAttempt | null;
  serverLastSavedAt: string | null;
};

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function formatTimeOfDay(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getPaperSubjects(paper: StudentPaper | null) {
  const explicitSubjects = Array.isArray(paper?.subjects) ? paper.subjects : [];
  if (explicitSubjects.length > 0) {
    return explicitSubjects;
  }

  return paper?.subject ? [paper.subject] : [];
}

export function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getAutosaveIntervalMsByConnection() {
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

  if (
    effectiveType === "3g" ||
    (Number.isFinite(downlink) && downlink <= 2.5)
  ) {
    return 30000;
  }

  return 20000;
}

export async function fetchApiJsonWithTimeout<T = any>(
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

export function clearDraftPersistTimeout(timeoutRef: { current: number | null }) {
  if (timeoutRef.current !== null) {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}

export function persistStudentDraftSnapshot({
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

export function normalizeSelectedOptions(value: unknown) {
  if (!Array.isArray(value)) return [] as number[];

  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && Number.isFinite(item)),
    ),
  ).sort((left, right) => left - right);
}

export function normalizeMatrixSelections(value: unknown, rowCount = 0) {
  const rows = Array.isArray(value) ? value : [];
  return Array.from({ length: rowCount }, (_value, rowIndex) =>
    normalizeSelectedOptions(rows[rowIndex]),
  );
}

export function createQuestionAnswerState(
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

export function hasAnswerForQuestion(
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

export function buildAnswerMap(
  attempt: StudentAttempt | null,
  paper: StudentPaper | null,
) {
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

export function buildSectionAnswersPayloadFromState(
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

export function readAttemptConflictPayload(
  payload: unknown,
): AttemptConflictPayload {
  if (!payload || typeof payload !== "object") {
    return {
      attempt: null,
      serverLastSavedAt: null,
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
