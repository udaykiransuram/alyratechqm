type StudentTestSectionAnswer = {
  sectionName: string;
  answers: Array<{
    question: string;
    selectedOptions?: number[];
    answerText?: string;
    matrixSelections?: number[][];
  }>;
};

export type StudentTestDraftRecord = {
  version: 1;
  paperId: string;
  attemptId: string | null;
  sectionAnswers: StudentTestSectionAnswer[];
  answerSignature: string;
  updatedAt: number;
  serverLastSavedAt: string | null;
};

export type StudentTestDraftMeta = Pick<
  StudentTestDraftRecord,
  "paperId" | "attemptId" | "answerSignature" | "updatedAt" | "serverLastSavedAt"
>;

const STUDENT_TEST_DRAFT_PREFIX = "student-test-draft:v1:";

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizePaperId(paperId: string) {
  return String(paperId || "").trim();
}

function getDraftKey(paperId: string) {
  return `${STUDENT_TEST_DRAFT_PREFIX}${normalizePaperId(paperId)}`;
}

function normalizeSectionAnswers(sectionAnswers: unknown) {
  if (!Array.isArray(sectionAnswers)) {
    return [] as StudentTestSectionAnswer[];
  }

  return sectionAnswers
    .map((section) => ({
      sectionName: String((section as any)?.sectionName || ""),
      answers: Array.isArray((section as any)?.answers)
        ? (section as any).answers.map((answer: any) => ({
            question: String(answer?.question || ""),
            selectedOptions: Array.isArray(answer?.selectedOptions)
              ? answer.selectedOptions
                  .map((option: unknown) => Number(option))
                  .filter((option: number) => Number.isInteger(option))
              : undefined,
            answerText:
              typeof answer?.answerText === "string" ? answer.answerText : undefined,
            matrixSelections: Array.isArray(answer?.matrixSelections)
              ? answer.matrixSelections.map((row: unknown) =>
                  Array.isArray(row)
                    ? row
                        .map((option: unknown) => Number(option))
                        .filter((option: number) => Number.isInteger(option))
                    : [],
                )
              : undefined,
          }))
        : [],
    }))
    .filter((section) => section.sectionName);
}

function parseDraftRecord(rawValue: string | null, expectedPaperId: string) {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<StudentTestDraftRecord> & {
      version?: unknown;
    };
    const paperId = normalizePaperId(String(parsed?.paperId || ""));
    if (!paperId || paperId !== expectedPaperId) {
      return null;
    }
    if (parsed.version !== 1) {
      return null;
    }

    const updatedAtRaw = Number(parsed?.updatedAt || 0);
    const updatedAt =
      Number.isFinite(updatedAtRaw) && updatedAtRaw > 0 ? updatedAtRaw : Date.now();

    return {
      version: 1 as const,
      paperId,
      attemptId: parsed?.attemptId ? String(parsed.attemptId) : null,
      sectionAnswers: normalizeSectionAnswers(parsed?.sectionAnswers),
      answerSignature: String(parsed?.answerSignature || ""),
      updatedAt,
      serverLastSavedAt: parsed?.serverLastSavedAt
        ? String(parsed.serverLastSavedAt)
        : null,
    };
  } catch {
    return null;
  }
}

export function readStudentTestDraft(paperId: string) {
  const normalizedPaperId = normalizePaperId(paperId);
  if (!normalizedPaperId || !canUseLocalStorage()) {
    return null;
  }

  return parseDraftRecord(
    window.localStorage.getItem(getDraftKey(normalizedPaperId)),
    normalizedPaperId,
  );
}

export function writeStudentTestDraft(
  draft: Omit<StudentTestDraftRecord, "version">,
) {
  const paperId = normalizePaperId(draft.paperId);
  if (!paperId || !canUseLocalStorage()) {
    return;
  }

  const record: StudentTestDraftRecord = {
    version: 1,
    paperId,
    attemptId: draft.attemptId ? String(draft.attemptId) : null,
    sectionAnswers: normalizeSectionAnswers(draft.sectionAnswers),
    answerSignature: String(draft.answerSignature || ""),
    updatedAt: Number.isFinite(draft.updatedAt) ? Math.max(0, draft.updatedAt) : Date.now(),
    serverLastSavedAt: draft.serverLastSavedAt
      ? String(draft.serverLastSavedAt)
      : null,
  };

  try {
    window.localStorage.setItem(getDraftKey(paperId), JSON.stringify(record));
  } catch {
    // Ignore localStorage quota and serialization issues.
  }
}

export function clearStudentTestDraft(paperId: string) {
  const normalizedPaperId = normalizePaperId(paperId);
  if (!normalizedPaperId || !canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(getDraftKey(normalizedPaperId));
  } catch {
    // Ignore localStorage removal issues.
  }
}

export function listStudentTestDraftMeta() {
  if (!canUseLocalStorage()) {
    return [] as StudentTestDraftMeta[];
  }

  const drafts: StudentTestDraftMeta[] = [];

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith(STUDENT_TEST_DRAFT_PREFIX)) {
        continue;
      }

      const paperId = normalizePaperId(
        key.slice(STUDENT_TEST_DRAFT_PREFIX.length),
      );
      if (!paperId) continue;

      const record = parseDraftRecord(window.localStorage.getItem(key), paperId);
      if (!record) continue;

      drafts.push({
        paperId: record.paperId,
        attemptId: record.attemptId,
        answerSignature: record.answerSignature,
        updatedAt: record.updatedAt,
        serverLastSavedAt: record.serverLastSavedAt,
      });
    }
  } catch {
    return [];
  }

  return drafts.sort((left, right) => right.updatedAt - left.updatedAt);
}
