import { connectDB } from "@/lib/db";
import { buildArchiveFilter } from "@/lib/archive";
import { getTenantModels } from "@/lib/db-tenant";
import {
  getStudentTestModels,
  loadOnlinePaperById,
  loadOnlinePapersForClass,
  loadStudentUser,
} from "@/lib/student-test-server";
import {
  gradeObjectiveSectionAnswers,
  validateStudentSectionAnswers,
} from "@/lib/question-paper/grading";
import {
  deriveStudentTestStatus,
  getPaperWindowEnd,
  getPaperWindowStart,
  isStudentEligibleForPaper,
  paperRequiresManualReview,
  paperSupportsOnlineDelivery,
  sanitizePaperForStudent,
  serializeStudentAttempt,
} from "@/lib/student-tests";
import {
  cacheExamSnapshotPayload,
  claimExamAttemptLock,
  consumeAutosaveRateLimit,
  readCachedExamSnapshotPayload,
  releaseExamAttemptLock,
} from "@/lib/redis";

type ExamSnapshotStatus = "active" | "superseded" | "disabled";
type ExamAttemptStatus = "in_progress" | "submitted" | "auto_submitted";

export type ExamRuntimeErrorCode =
  | "EXAM_RUNTIME_UNAVAILABLE"
  | "EXAM_RUNTIME_INTERNAL_ERROR"
  | "STUDENT_NOT_FOUND"
  | "ONLINE_TEST_NOT_FOUND"
  | "ONLINE_TEST_SNAPSHOT_NOT_FOUND"
  | "ONLINE_TEST_UNSUPPORTED"
  | "ONLINE_TEST_NOT_ASSIGNED"
  | "ONLINE_TEST_NOT_OPEN_YET"
  | "ONLINE_TEST_CLOSED"
  | "ONLINE_TEST_SNAPSHOT_NOT_READY"
  | "ATTEMPT_NOT_STARTED"
  | "ATTEMPT_ALREADY_SUBMITTED"
  | "ATTEMPT_LOCKED"
  | "ATTEMPT_SUBMIT_FAILED"
  | "ATTEMPT_STATE_CONFLICT"
  | "ATTEMPT_SAVE_RATE_LIMITED"
  | "INVALID_ANSWERS_PAYLOAD";

type ExamRuntimeErrorShape = {
  success: false;
  message: string;
  code: string;
  retryable: boolean;
  httpStatus: number;
  details?: unknown;
};

export class ExamRuntimeError extends Error {
  code: string;
  httpStatus: number;
  retryable: boolean;
  details?: unknown;

  constructor(params: {
    message: string;
    code: ExamRuntimeErrorCode | string;
    httpStatus: number;
    retryable?: boolean;
    details?: unknown;
    cause?: unknown;
  }) {
    super(String(params.message || "Exam runtime request failed."));
    this.name = "ExamRuntimeError";
    this.code = String(params.code || "EXAM_RUNTIME_INTERNAL_ERROR");
    this.httpStatus = Number.isInteger(params.httpStatus)
      ? Number(params.httpStatus)
      : 500;
    this.retryable = Boolean(params.retryable);
    this.details = params.details;
    if (typeof params.cause !== "undefined") {
      (this as Error & { cause?: unknown }).cause = params.cause;
    }
  }
}

type ExamPaperSnapshot = {
  id: string;
  schoolKey: string;
  mongoPaperId: string;
  snapshotVersion: number;
  status: ExamSnapshotStatus;
  classId: string;
  subjectId: string;
  assignedSectionIds: string[];
  title: string;
  instructions: string;
  durationMinutes: number;
  passingMarks: number;
  totalMarks: number;
  examDate: string | null;
  onlineStartsAt: string | null;
  onlineEndsAt: string | null;
  requiresManualReview: boolean;
  paperJson: any;
  gradingJson: any;
  createdAt: string | null;
  updatedAt: string | null;
};

type ExamAttempt = {
  id: string;
  schoolKey: string;
  snapshotId: string;
  mongoPaperId: string;
  studentId: string;
  status: ExamAttemptStatus;
  startedAt: string | null;
  deadlineAt: string | null;
  submittedAt: string | null;
  lastSavedAt: string | null;
  totalMarksAwarded: number;
  manualReviewRequired: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type ExamAnswerRow = {
  attemptId: string;
  questionId: string;
  sectionIndex: number;
  questionIndex: number;
  selectedOptions: number[] | null;
  matrixSelections: number[][] | null;
  answerText: string | null;
  marksAwarded: number | null;
  updatedAt: string | null;
};

type ResolvedAttemptBundle = {
  attempt: ExamAttempt;
  answerRows: ExamAnswerRow[];
  mongoResponseId?: string;
};

type RuntimeSnapshotPayload = {
  paperJson: any;
  gradingJson: any;
};

type PreparedExamPaperSnapshotPayload = {
  classId: string;
  subjectId: string;
  assignedSectionIds: string[];
  title: string;
  instructions: string;
  durationMinutes: number;
  passingMarks: number;
  totalMarks: number;
  examDate: unknown;
  onlineStartsAt: unknown;
  onlineEndsAt: unknown;
  requiresManualReview: boolean;
  paperJson: any;
  gradingJson: any;
};

type ExamRuntimeClient = import("@neondatabase/serverless").PoolClient;
type ExamRuntimePool = import("@neondatabase/serverless").Pool;

const SNAPSHOT_METADATA_COLUMNS = `
  id,
  school_key,
  mongo_paper_id,
  snapshot_version,
  status,
  class_id,
  subject_id,
  assigned_section_ids,
  title,
  instructions,
  duration_minutes,
  passing_marks,
  total_marks,
  exam_date,
  online_starts_at,
  online_ends_at,
  requires_manual_review,
  created_at,
  updated_at
`;

const SNAPSHOT_FULL_COLUMNS = `
  ${SNAPSHOT_METADATA_COLUMNS},
  paper_json,
  grading_json
`;

const ATTEMPT_COLUMNS = `
  id,
  school_key,
  snapshot_id,
  mongo_paper_id,
  student_id,
  status,
  started_at,
  deadline_at,
  submitted_at,
  last_saved_at,
  total_marks_awarded,
  manual_review_required,
  created_at,
  updated_at
`;

const ATTEMPT_STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  available: 1,
  upcoming: 2,
  auto_submitted: 3,
  submitted: 4,
  expired: 5,
};

const EXAM_RUNTIME_ERROR_META_BY_MESSAGE: Record<
  string,
  {
    code: ExamRuntimeErrorCode;
    httpStatus: number;
    retryable: boolean;
  }
> = {
  "Student profile not found.": {
    code: "STUDENT_NOT_FOUND",
    httpStatus: 404,
    retryable: false,
  },
  "Online test not found.": {
    code: "ONLINE_TEST_NOT_FOUND",
    httpStatus: 404,
    retryable: false,
  },
  "Online test snapshot not found.": {
    code: "ONLINE_TEST_SNAPSHOT_NOT_FOUND",
    httpStatus: 404,
    retryable: false,
  },
  "This paper cannot be delivered online because it contains unsupported question types.": {
    code: "ONLINE_TEST_UNSUPPORTED",
    httpStatus: 400,
    retryable: false,
  },
  "You are not assigned to this online test.": {
    code: "ONLINE_TEST_NOT_ASSIGNED",
    httpStatus: 403,
    retryable: false,
  },
  "This online test is not open yet.": {
    code: "ONLINE_TEST_NOT_OPEN_YET",
    httpStatus: 403,
    retryable: false,
  },
  "This online test is closed.": {
    code: "ONLINE_TEST_CLOSED",
    httpStatus: 403,
    retryable: false,
  },
  "Online test snapshot is not ready yet.": {
    code: "ONLINE_TEST_SNAPSHOT_NOT_READY",
    httpStatus: 409,
    retryable: true,
  },
  "Start the test before saving answers.": {
    code: "ATTEMPT_NOT_STARTED",
    httpStatus: 409,
    retryable: false,
  },
  "Start the test before submitting it.": {
    code: "ATTEMPT_NOT_STARTED",
    httpStatus: 409,
    retryable: false,
  },
  "This attempt has already been submitted.": {
    code: "ATTEMPT_ALREADY_SUBMITTED",
    httpStatus: 409,
    retryable: false,
  },
  "Another test update is already in progress. Please retry.": {
    code: "ATTEMPT_LOCKED",
    httpStatus: 409,
    retryable: true,
  },
  "Too many save requests were sent at once. Please wait a few seconds and try again.": {
    code: "ATTEMPT_SAVE_RATE_LIMITED",
    httpStatus: 429,
    retryable: true,
  },
  "This attempt could not be submitted.": {
    code: "ATTEMPT_SUBMIT_FAILED",
    httpStatus: 409,
    retryable: false,
  },
  "Exam runtime database is not configured.": {
    code: "EXAM_RUNTIME_UNAVAILABLE",
    httpStatus: 503,
    retryable: true,
  },
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXAM_RUNTIME_SCHEMA_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS exam_paper_snapshots (
      id UUID PRIMARY KEY,
      school_key TEXT NOT NULL,
      mongo_paper_id TEXT NOT NULL,
      snapshot_version INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'superseded', 'disabled')),
      class_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      assigned_section_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      title TEXT NOT NULL,
      instructions TEXT NOT NULL DEFAULT '',
      duration_minutes INTEGER NOT NULL,
      passing_marks NUMERIC NOT NULL DEFAULT 0,
      total_marks NUMERIC NOT NULL DEFAULT 0,
      exam_date TIMESTAMPTZ NOT NULL,
      online_starts_at TIMESTAMPTZ NULL,
      online_ends_at TIMESTAMPTZ NULL,
      requires_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
      paper_json JSONB NOT NULL,
      grading_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (school_key, mongo_paper_id, snapshot_version)
    )
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS exam_paper_snapshots_active_unique
    ON exam_paper_snapshots (school_key, mongo_paper_id)
    WHERE status = 'active'
  `,
  `
    CREATE INDEX IF NOT EXISTS exam_paper_snapshots_lookup
    ON exam_paper_snapshots (school_key, mongo_paper_id, status, snapshot_version DESC)
  `,
  `
    CREATE TABLE IF NOT EXISTS exam_attempts (
      id UUID PRIMARY KEY,
      school_key TEXT NOT NULL,
      snapshot_id UUID NOT NULL REFERENCES exam_paper_snapshots(id),
      mongo_paper_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted', 'auto_submitted')),
      started_at TIMESTAMPTZ NOT NULL,
      deadline_at TIMESTAMPTZ NULL,
      submitted_at TIMESTAMPTZ NULL,
      last_saved_at TIMESTAMPTZ NULL,
      total_marks_awarded NUMERIC NOT NULL DEFAULT 0,
      manual_review_required BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (school_key, mongo_paper_id, student_id)
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS exam_attempts_student_lookup
    ON exam_attempts (school_key, student_id, status, started_at DESC)
  `,
  `
    CREATE INDEX IF NOT EXISTS exam_attempts_snapshot_lookup
    ON exam_attempts (snapshot_id)
  `,
  `
    CREATE TABLE IF NOT EXISTS exam_answers (
      attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      section_index INTEGER NOT NULL,
      question_index INTEGER NOT NULL,
      selected_options INTEGER[] NULL,
      matrix_selections JSONB NULL,
      answer_text TEXT NULL,
      marks_awarded NUMERIC NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (attempt_id, question_id)
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS exam_answers_attempt_order_lookup
    ON exam_answers (attempt_id, section_index, question_index)
  `,
];

const EXAM_RUNTIME_DATABASE_URL = String(
  process.env.EXAM_RUNTIME_DATABASE_URL || process.env.DATABASE_URL || "",
).trim();
const EXAM_RUNTIME_POOL_MAX = Math.max(
  10,
  Number.parseInt(String(process.env.EXAM_RUNTIME_POOL_MAX || "20"), 10) || 20,
);
const EXAM_RUNTIME_POOL_IDLE_TIMEOUT_MS = 30_000;
const EXAM_RUNTIME_POOL_CONNECTION_TIMEOUT_MS = 15_000;
const EXAM_RUNTIME_SNAPSHOT_CACHE_TTL_MS = Math.max(
  5_000,
  Number.parseInt(
    String(process.env.EXAM_RUNTIME_SNAPSHOT_CACHE_TTL_MS || "120000"),
    10,
  ) || 120_000,
);

let examRuntimePoolPromise: Promise<ExamRuntimePool | null> | null = null;
let examRuntimeSchemaPromise: Promise<boolean> | null = null;
let examRuntimeDriverErrorLogged = false;

function toExamRuntimeError(
  error: unknown,
  fallbackMessage = "Exam runtime request failed.",
): ExamRuntimeError {
  if (error instanceof ExamRuntimeError) {
    return error;
  }

  const message = String(
    (error as { message?: unknown } | null)?.message || fallbackMessage,
  ).trim() || fallbackMessage;

  if (message in EXAM_RUNTIME_ERROR_META_BY_MESSAGE) {
    const meta = EXAM_RUNTIME_ERROR_META_BY_MESSAGE[message];
    return new ExamRuntimeError({
      message,
      code: meta.code,
      httpStatus: meta.httpStatus,
      retryable: meta.retryable,
      cause: error,
    });
  }

  if (message.startsWith("Section ") || message.startsWith("Invalid ")) {
    return new ExamRuntimeError({
      message,
      code: "INVALID_ANSWERS_PAYLOAD",
      httpStatus: 400,
      retryable: false,
      cause: error,
    });
  }

  return new ExamRuntimeError({
    message,
    code: "EXAM_RUNTIME_INTERNAL_ERROR",
    httpStatus: 500,
    retryable: true,
    cause: error,
  });
}

function throwExamRuntimeError(params: {
  message: string;
  code: ExamRuntimeErrorCode | string;
  httpStatus: number;
  retryable?: boolean;
  details?: unknown;
}): never {
  throw new ExamRuntimeError(params);
}

export function buildExamRuntimeErrorPayload(
  error: unknown,
  fallbackMessage = "Exam runtime request failed.",
): ExamRuntimeErrorShape {
  const runtimeError = toExamRuntimeError(error, fallbackMessage);
  return {
    success: false,
    message: runtimeError.message,
    code: runtimeError.code,
    retryable: runtimeError.retryable,
    httpStatus: runtimeError.httpStatus,
    ...(typeof runtimeError.details !== "undefined"
      ? { details: runtimeError.details }
      : {}),
  };
}

function toSerializableValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && typeof value !== "undefined";
}

function normalizeDateValue(value: unknown) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function normalizeNumberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function parseJsonValue<T>(value: unknown, fallback: T) {
  if (value === null || typeof value === "undefined") {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  return value as T;
}

type CacheEntry<T> = {
  expiresAt: number;
  hasValue: boolean;
  value?: T;
  promise?: Promise<T>;
};

function getExamRuntimeResourceCache() {
  const globalState = global as typeof globalThis & {
    __examRuntimeResourceCache?: Map<string, CacheEntry<unknown>>;
  };

  if (!globalState.__examRuntimeResourceCache) {
    globalState.__examRuntimeResourceCache = new Map();
  }

  return globalState.__examRuntimeResourceCache;
}

function createExamRuntimeCacheKey(namespace: string, ...parts: unknown[]) {
  return [namespace, ...parts.map((part) => String(part || "").trim())].join("::");
}

async function getCachedExamRuntimeResource<T>(
  cacheKey: string,
  ttlMs: number,
  loader: () => Promise<T>,
) {
  const cache = getExamRuntimeResourceCache();
  const now = Date.now();
  const existingEntry = cache.get(cacheKey) as CacheEntry<T> | undefined;

  if (existingEntry?.hasValue && existingEntry.expiresAt > now) {
    return existingEntry.value as T;
  }

  if (existingEntry?.promise) {
    return existingEntry.promise;
  }

  const promise = loader()
    .then((value) => {
      cache.set(cacheKey, {
        expiresAt: Date.now() + ttlMs,
        hasValue: true,
        value,
      });
      return value;
    })
    .catch((error) => {
      cache.delete(cacheKey);
      throw error;
    });

  cache.set(cacheKey, {
    expiresAt: now + ttlMs,
    hasValue: false,
    promise,
  });

  return promise;
}

function setCachedExamRuntimeResource<T>(
  cacheKey: string,
  ttlMs: number,
  value: T,
) {
  getExamRuntimeResourceCache().set(cacheKey, {
    expiresAt: Date.now() + ttlMs,
    hasValue: true,
    value,
  });
}

function deleteCachedExamRuntimeResource(cacheKey: string) {
  getExamRuntimeResourceCache().delete(cacheKey);
}

function getExamSnapshotByIdCacheKey(snapshotId: string) {
  return createExamRuntimeCacheKey("snapshot-by-id", snapshotId);
}

function getActiveExamSnapshotCacheKey(schoolKey: string, paperId: string) {
  return createExamRuntimeCacheKey("active-snapshot", schoolKey, paperId);
}

function getEnsureActiveExamSnapshotCacheKey(schoolKey: string, paperId: string) {
  return createExamRuntimeCacheKey("ensure-active-snapshot", schoolKey, paperId);
}

function cacheExamSnapshotInMemory(snapshot: ExamPaperSnapshot) {
  setCachedExamRuntimeResource(
    getExamSnapshotByIdCacheKey(snapshot.id),
    EXAM_RUNTIME_SNAPSHOT_CACHE_TTL_MS,
    snapshot,
  );
  setCachedExamRuntimeResource(
    getActiveExamSnapshotCacheKey(snapshot.schoolKey, snapshot.mongoPaperId),
    EXAM_RUNTIME_SNAPSHOT_CACHE_TTL_MS,
    snapshot,
  );
}

function clearCachedActiveExamSnapshot(schoolKey: string, paperId: string) {
  deleteCachedExamRuntimeResource(
    getActiveExamSnapshotCacheKey(schoolKey, paperId),
  );
  deleteCachedExamRuntimeResource(
    getEnsureActiveExamSnapshotCacheKey(schoolKey, paperId),
  );
}

async function loadExamRuntimePool() {
  if (!EXAM_RUNTIME_DATABASE_URL) {
    return null;
  }

  if (!examRuntimePoolPromise) {
    examRuntimePoolPromise = import("@neondatabase/serverless")
      .then(({ Pool }) => {
        const poolConfig = {
          connectionString: EXAM_RUNTIME_DATABASE_URL,
          max: EXAM_RUNTIME_POOL_MAX,
          idleTimeoutMillis: EXAM_RUNTIME_POOL_IDLE_TIMEOUT_MS,
          connectionTimeoutMillis: EXAM_RUNTIME_POOL_CONNECTION_TIMEOUT_MS,
        } as any;

        return new Pool(poolConfig);
      })
      .catch((error) => {
        if (!examRuntimeDriverErrorLogged) {
          examRuntimeDriverErrorLogged = true;
          console.error(
            "Exam runtime disabled because @neondatabase/serverless is unavailable:",
            error,
          );
        }
        return null;
      });
  }

  return examRuntimePoolPromise;
}

async function ensureExamRuntimeSchema() {
  const pool = await loadExamRuntimePool();
  if (!pool) {
    return false;
  }

  if (!examRuntimeSchemaPromise) {
    examRuntimeSchemaPromise = (async () => {
      for (const statement of EXAM_RUNTIME_SCHEMA_STATEMENTS) {
        await pool.query(statement);
      }

      return true;
    })().catch((error) => {
      examRuntimeSchemaPromise = null;
      console.error("Failed to ensure exam runtime schema:", error);
      return false;
    });
  }

  return examRuntimeSchemaPromise;
}

export async function isExamRuntimeEnabled() {
  if (!EXAM_RUNTIME_DATABASE_URL) {
    return false;
  }

  return ensureExamRuntimeSchema();
}

async function queryExamRuntime<Row = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
) {
  const ready = await ensureExamRuntimeSchema();
  const pool = await loadExamRuntimePool();
  if (!ready || !pool) {
    throwExamRuntimeError({
      message: "Exam runtime database is not configured.",
      code: "EXAM_RUNTIME_UNAVAILABLE",
      httpStatus: 503,
      retryable: true,
    });
  }

  return pool.query<Row>(text, params);
}

async function withExamRuntimeTransaction<T>(
  handler: (client: ExamRuntimeClient) => Promise<T>,
) {
  const ready = await ensureExamRuntimeSchema();
  const pool = await loadExamRuntimePool();
  if (!ready || !pool) {
    throwExamRuntimeError({
      message: "Exam runtime database is not configured.",
      code: "EXAM_RUNTIME_UNAVAILABLE",
      httpStatus: 503,
      retryable: true,
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function mapSnapshotMetadataRow(row: any) {
  return {
    id: String(row?.id || ""),
    schoolKey: String(row?.school_key || ""),
    mongoPaperId: String(row?.mongo_paper_id || ""),
    snapshotVersion: Number(row?.snapshot_version || 0),
    status: String(row?.status || "disabled") as ExamSnapshotStatus,
    classId: String(row?.class_id || ""),
    subjectId: String(row?.subject_id || ""),
    assignedSectionIds: parseJsonValue<string[]>(
      row?.assigned_section_ids,
      [],
    ),
    title: String(row?.title || ""),
    instructions: String(row?.instructions || ""),
    durationMinutes: Number(row?.duration_minutes || 0),
    passingMarks: normalizeNumberValue(row?.passing_marks),
    totalMarks: normalizeNumberValue(row?.total_marks),
    examDate: normalizeDateValue(row?.exam_date),
    onlineStartsAt: normalizeDateValue(row?.online_starts_at),
    onlineEndsAt: normalizeDateValue(row?.online_ends_at),
    requiresManualReview: Boolean(row?.requires_manual_review),
    createdAt: normalizeDateValue(row?.created_at),
    updatedAt: normalizeDateValue(row?.updated_at),
  };
}

function mapSnapshotFullRow(row: any): ExamPaperSnapshot {
  return {
    ...mapSnapshotMetadataRow(row),
    paperJson: parseJsonValue<any>(row?.paper_json, null),
    gradingJson: parseJsonValue<any>(row?.grading_json, null),
  };
}

function mapAttemptRow(row: any): ExamAttempt {
  return {
    id: String(row?.id || ""),
    schoolKey: String(row?.school_key || ""),
    snapshotId: String(row?.snapshot_id || ""),
    mongoPaperId: String(row?.mongo_paper_id || ""),
    studentId: String(row?.student_id || ""),
    status: String(row?.status || "in_progress") as ExamAttemptStatus,
    startedAt: normalizeDateValue(row?.started_at),
    deadlineAt: normalizeDateValue(row?.deadline_at),
    submittedAt: normalizeDateValue(row?.submitted_at),
    lastSavedAt: normalizeDateValue(row?.last_saved_at),
    totalMarksAwarded: normalizeNumberValue(row?.total_marks_awarded),
    manualReviewRequired: Boolean(row?.manual_review_required),
    createdAt: normalizeDateValue(row?.created_at),
    updatedAt: normalizeDateValue(row?.updated_at),
  };
}

function mapAnswerRow(row: any): ExamAnswerRow {
  return {
    attemptId: String(row?.attempt_id || ""),
    questionId: String(row?.question_id || ""),
    sectionIndex: Number(row?.section_index || 0),
    questionIndex: Number(row?.question_index || 0),
    selectedOptions: Array.isArray(row?.selected_options)
      ? row.selected_options.map((value: unknown) => Number(value))
      : null,
    matrixSelections: parseJsonValue<number[][] | null>(
      row?.matrix_selections,
      null,
    ),
    answerText:
      typeof row?.answer_text === "string" ? row.answer_text : null,
    marksAwarded:
      row?.marks_awarded === null || typeof row?.marks_awarded === "undefined"
        ? null
        : normalizeNumberValue(row.marks_awarded),
    updatedAt: normalizeDateValue(row?.updated_at),
  };
}

async function hydrateSnapshotMetadataRow(row: any) {
  const metadata = mapSnapshotMetadataRow(row);
  const cachedPayload = await readCachedExamSnapshotPayload<RuntimeSnapshotPayload>(
    metadata.schoolKey,
    metadata.mongoPaperId,
    metadata.snapshotVersion,
  );

  if (cachedPayload?.paperJson && cachedPayload?.gradingJson) {
    const snapshot = {
      ...metadata,
      paperJson: cachedPayload.paperJson,
      gradingJson: cachedPayload.gradingJson,
    } satisfies ExamPaperSnapshot;
    cacheExamSnapshotInMemory(snapshot);
    return snapshot;
  }

  const payloadResult = await queryExamRuntime<{
    paper_json: unknown;
    grading_json: unknown;
  }>(
    `
      SELECT paper_json, grading_json
      FROM exam_paper_snapshots
      WHERE id = $1
      LIMIT 1
    `,
    [metadata.id],
  );
  const payloadRow = payloadResult.rows[0];

  const snapshot: ExamPaperSnapshot = {
    ...metadata,
    paperJson: parseJsonValue<any>(payloadRow?.paper_json, null),
    gradingJson: parseJsonValue<any>(payloadRow?.grading_json, null),
  };

  if (snapshot.paperJson && snapshot.gradingJson) {
    await cacheExamSnapshotPayload(
      snapshot.schoolKey,
      snapshot.mongoPaperId,
      snapshot.snapshotVersion,
      {
        paperJson: snapshot.paperJson,
        gradingJson: snapshot.gradingJson,
      },
    ).catch(() => undefined);
  }

  cacheExamSnapshotInMemory(snapshot);
  return snapshot;
}

async function getExamSnapshotById(snapshotId: string) {
  const normalizedSnapshotId = String(snapshotId || "").trim();
  if (!UUID_PATTERN.test(normalizedSnapshotId)) {
    return null;
  }

  return getCachedExamRuntimeResource(
    getExamSnapshotByIdCacheKey(normalizedSnapshotId),
    EXAM_RUNTIME_SNAPSHOT_CACHE_TTL_MS,
    async () => {
      const result = await queryExamRuntime(
        `
          SELECT ${SNAPSHOT_METADATA_COLUMNS}
          FROM exam_paper_snapshots
          WHERE id = $1
          LIMIT 1
        `,
        [normalizedSnapshotId],
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return hydrateSnapshotMetadataRow(row);
    },
  );
}

async function getExamSnapshotsByIds(snapshotIds: string[]) {
  const normalizedIds = Array.from(
    new Set(snapshotIds.map((value) => String(value || "").trim()).filter(Boolean)),
  );
  if (normalizedIds.length === 0) {
    return [];
  }

  const result = await queryExamRuntime(
    `
      SELECT ${SNAPSHOT_METADATA_COLUMNS}
      FROM exam_paper_snapshots
      WHERE id = ANY($1::uuid[])
    `,
    [normalizedIds],
  );

  const snapshots = await Promise.all(
    result.rows.map((row) => hydrateSnapshotMetadataRow(row)),
  );

  snapshots.forEach((snapshot) => {
    cacheExamSnapshotInMemory(snapshot);
  });

  return snapshots;
}

async function getActiveExamSnapshotByPaperId(
  schoolKey: string,
  paperId: string,
) {
  const normalizedPaperId = String(paperId || "").trim();
  if (!normalizedPaperId) {
    return null;
  }

  return getCachedExamRuntimeResource(
    getActiveExamSnapshotCacheKey(schoolKey, normalizedPaperId),
    EXAM_RUNTIME_SNAPSHOT_CACHE_TTL_MS,
    async () => {
      const result = await queryExamRuntime(
        `
          SELECT ${SNAPSHOT_METADATA_COLUMNS}
          FROM exam_paper_snapshots
          WHERE school_key = $1
            AND mongo_paper_id = $2
            AND status = 'active'
          ORDER BY snapshot_version DESC
          LIMIT 1
        `,
        [schoolKey, normalizedPaperId],
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return hydrateSnapshotMetadataRow(row);
    },
  );
}

async function getActiveExamSnapshotByPaperIdInTransaction(
  client: ExamRuntimeClient,
  schoolKey: string,
  paperId: string,
) {
  const result = await client.query(
    `
      SELECT ${SNAPSHOT_FULL_COLUMNS}
      FROM exam_paper_snapshots
      WHERE school_key = $1
        AND mongo_paper_id = $2
        AND status = 'active'
      ORDER BY snapshot_version DESC
      LIMIT 1
    `,
    [schoolKey, paperId],
  );

  const row = result.rows[0];
  return row ? mapSnapshotFullRow(row) : null;
}

async function listExamAttemptsForStudent(
  schoolKey: string,
  studentId: string,
) {
  const result = await queryExamRuntime(
    `
      SELECT ${ATTEMPT_COLUMNS}
      FROM exam_attempts
      WHERE school_key = $1
        AND student_id = $2
      ORDER BY started_at DESC
    `,
    [schoolKey, studentId],
  );

  return result.rows.map(mapAttemptRow);
}

async function listExamAttemptsForPaper(
  schoolKey: string,
  paperId: string,
) {
  const result = await queryExamRuntime(
    `
      SELECT ${ATTEMPT_COLUMNS}
      FROM exam_attempts
      WHERE school_key = $1
        AND mongo_paper_id = $2
      ORDER BY started_at DESC
    `,
    [schoolKey, paperId],
  );

  return result.rows.map(mapAttemptRow);
}

async function getExamAttemptByPaperId(
  schoolKey: string,
  studentId: string,
  paperId: string,
) {
  const result = await queryExamRuntime(
    `
      SELECT ${ATTEMPT_COLUMNS}
      FROM exam_attempts
      WHERE school_key = $1
        AND student_id = $2
        AND mongo_paper_id = $3
      LIMIT 1
    `,
    [schoolKey, studentId, paperId],
  );

  const row = result.rows[0];
  return row ? mapAttemptRow(row) : null;
}

async function getExamAttemptById(attemptId: string) {
  const normalizedId = String(attemptId || "").trim();
  if (!UUID_PATTERN.test(normalizedId)) {
    return null;
  }

  const result = await queryExamRuntime(
    `
      SELECT ${ATTEMPT_COLUMNS}
      FROM exam_attempts
      WHERE id = $1
      LIMIT 1
    `,
    [normalizedId],
  );

  const row = result.rows[0];
  return row ? mapAttemptRow(row) : null;
}

async function listExamAnswerRowsByAttemptIds(attemptIds: string[]) {
  const normalizedIds = Array.from(
    new Set(attemptIds.map((value) => String(value || "").trim()).filter(Boolean)),
  );
  if (normalizedIds.length === 0) {
    return [];
  }

  const result = await queryExamRuntime(
    `
      SELECT attempt_id, question_id, section_index, question_index, selected_options,
             matrix_selections, answer_text, marks_awarded, updated_at
      FROM exam_answers
      WHERE attempt_id = ANY($1::uuid[])
      ORDER BY attempt_id ASC, section_index ASC, question_index ASC
    `,
    [normalizedIds],
  );

  return result.rows.map(mapAnswerRow);
}

function buildAnswerRowsByAttemptId(answerRows: ExamAnswerRow[]) {
  const rowsByAttemptId = new Map<string, ExamAnswerRow[]>();

  answerRows.forEach((row) => {
    const attemptId = String(row?.attemptId || "").trim();
    if (!attemptId) {
      return;
    }

    const currentRows = rowsByAttemptId.get(attemptId);
    if (currentRows) {
      currentRows.push(row);
      return;
    }

    rowsByAttemptId.set(attemptId, [row]);
  });

  return rowsByAttemptId;
}

function buildQuestionPositionLookup(paper: any) {
  const lookup = new Map<
    string,
    {
      sectionName: string;
      sectionIndex: number;
      questionIndex: number;
      questionId: string;
    }
  >();

  (Array.isArray(paper?.sections) ? paper.sections : []).forEach(
    (section: any, sectionIndex: number) => {
      const sectionName = String(section?.name || "").trim();
      (Array.isArray(section?.questions) ? section.questions : []).forEach(
        (entry: any, questionIndex: number) => {
          const questionId = String(
            entry?.question?._id || entry?.question || "",
          ).trim();
          if (!sectionName || !questionId) {
            return;
          }

          lookup.set(`${sectionName}::${questionId}`, {
            sectionName,
            sectionIndex,
            questionIndex,
            questionId,
          });
        },
      );
    },
  );

  return lookup;
}

function buildStoredSectionAnswers(
  paper: any,
  answerRows: ExamAnswerRow[],
) {
  const grouped = new Map<
    number,
    {
      sectionName: string;
      answers: Array<Record<string, unknown>>;
    }
  >();

  answerRows
    .slice()
    .sort((left, right) => {
      if (left.sectionIndex !== right.sectionIndex) {
        return left.sectionIndex - right.sectionIndex;
      }
      return left.questionIndex - right.questionIndex;
    })
    .forEach((answerRow) => {
      const section = Array.isArray(paper?.sections)
        ? paper.sections[answerRow.sectionIndex]
        : null;
      const sectionName = String(section?.name || "").trim();
      if (!sectionName) {
        return;
      }

      if (!grouped.has(answerRow.sectionIndex)) {
        grouped.set(answerRow.sectionIndex, {
          sectionName,
          answers: [],
        });
      }

      const normalizedAnswer: Record<string, unknown> = {
        question: answerRow.questionId,
      };

      if (
        Array.isArray(answerRow.selectedOptions) &&
        answerRow.selectedOptions.length > 0
      ) {
        normalizedAnswer.selectedOptions = answerRow.selectedOptions;
      }

      if (Array.isArray(answerRow.matrixSelections)) {
        normalizedAnswer.matrixSelections = answerRow.matrixSelections;
      }

      if (typeof answerRow.answerText === "string") {
        normalizedAnswer.answerText = answerRow.answerText;
      }

      if (answerRow.marksAwarded !== null) {
        normalizedAnswer.marksAwarded = answerRow.marksAwarded;
      }

      grouped.get(answerRow.sectionIndex)?.answers.push(normalizedAnswer);
    });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left - right)
    .map(([, value]) => value)
    .filter((section) => section.answers.length > 0);
}

function flattenSectionAnswersForStorage(
  sectionAnswers: Array<{
    sectionName: string;
    answers: Array<{
      question: string;
      selectedOptions?: number[];
      matrixSelections?: number[][];
      answerText?: string;
      marksAwarded?: number;
    }>;
  }>,
  paper: any,
) {
  const lookup = buildQuestionPositionLookup(paper);

  return (Array.isArray(sectionAnswers) ? sectionAnswers : [])
    .flatMap((sectionAnswer) =>
      (Array.isArray(sectionAnswer?.answers) ? sectionAnswer.answers : [])
        .map((answer) => {
          const key = `${String(sectionAnswer?.sectionName || "").trim()}::${String(
            answer?.question || "",
          ).trim()}`;
          const metadata = lookup.get(key);
          if (!metadata) {
            return null;
          }

          return {
            questionId: metadata.questionId,
            sectionIndex: metadata.sectionIndex,
            questionIndex: metadata.questionIndex,
            selectedOptions:
              Array.isArray(answer?.selectedOptions) &&
              answer.selectedOptions.length > 0
                ? answer.selectedOptions.map((value) => Number(value))
                : null,
            matrixSelections: Array.isArray(answer?.matrixSelections)
              ? answer.matrixSelections
              : null,
            answerText:
              typeof answer?.answerText === "string" ? answer.answerText : null,
            marksAwarded:
              typeof answer?.marksAwarded === "number"
                ? answer.marksAwarded
                : null,
          };
        })
        .filter(isDefined),
    )
    .sort((left, right) => {
      if (left.sectionIndex !== right.sectionIndex) {
        return left.sectionIndex - right.sectionIndex;
      }
      return left.questionIndex - right.questionIndex;
    });
}

function serializeRuntimeAttempt(
  attempt: ExamAttempt,
  paper: any,
  answerRows: ExamAnswerRow[],
  options?: {
    responseId?: string;
    sectionAnswers?: Array<{
      sectionName: string;
      answers: Array<{
        question: string;
        selectedOptions?: number[];
        matrixSelections?: number[][];
        answerText?: string;
        marksAwarded?: number;
      }>;
    }>;
  },
) {
  const responseId = String(options?.responseId || "").trim();

  return {
    ...serializeStudentAttempt({
      _id: responseId || attempt.id,
      paper: attempt.mongoPaperId,
      student: attempt.studentId,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      status: attempt.status,
      lastSavedAt: attempt.lastSavedAt,
      totalMarksAwarded: attempt.totalMarksAwarded,
      sectionAnswers: Array.isArray(options?.sectionAnswers)
        ? options.sectionAnswers
        : buildStoredSectionAnswers(paper, answerRows),
    }),
    runtimeAttemptId: attempt.id,
    mongoResponseId: responseId || undefined,
  };
}

function buildMongoAttemptProjectionKey(paperId: string, studentId: string) {
  return `${String(paperId || "").trim()}::${String(studentId || "").trim()}`;
}

function buildAttemptStateForStatus(attempt: ExamAttempt | null) {
  if (!attempt) {
    return null;
  }

  return {
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    status: attempt.status,
  };
}

function getAttemptRemainingTimeMs(attempt: ExamAttempt | null, now = new Date()) {
  if (!attempt?.deadlineAt) {
    return null;
  }

  const deadlineMs = new Date(attempt.deadlineAt).getTime();
  if (!Number.isFinite(deadlineMs)) {
    return null;
  }

  return Math.max(0, deadlineMs - now.getTime());
}

function parseTimestampMs(value: unknown) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(String(value)).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function buildRuntimeSectionAnswersSignature(
  sectionAnswers: unknown,
  gradingPaper: any,
) {
  const normalized = validateStudentSectionAnswers(
    sectionAnswers ?? [],
    gradingPaper,
    { allowEmpty: true },
  );

  return JSON.stringify(normalized.ok ? normalized.sectionAnswers : []);
}

async function replaceAttemptAnswerRows(
  client: ExamRuntimeClient,
  attemptId: string,
  rows: Array<{
    questionId: string;
    sectionIndex: number;
    questionIndex: number;
    selectedOptions: number[] | null;
    matrixSelections: number[][] | null;
    answerText: string | null;
    marksAwarded: number | null;
  }>,
) {
  const questionIds = rows.map((row) => row.questionId);

  if (questionIds.length === 0) {
    await client.query("DELETE FROM exam_answers WHERE attempt_id = $1", [
      attemptId,
    ]);
    return;
  }

  await client.query(
    `
      DELETE FROM exam_answers
      WHERE attempt_id = $1
        AND NOT (question_id = ANY($2::text[]))
    `,
    [attemptId, questionIds],
  );

  const values: Array<string | number | number[] | null> = [];
  const tuples = rows.map((row, index) => {
    const offset = index * 8;
    values.push(
      attemptId,
      row.questionId,
      row.sectionIndex,
      row.questionIndex,
      row.selectedOptions,
      row.matrixSelections === null ? null : JSON.stringify(row.matrixSelections),
      row.answerText,
      row.marksAwarded,
    );

    return `(
      $${offset + 1},
      $${offset + 2},
      $${offset + 3},
      $${offset + 4},
      $${offset + 5},
      $${offset + 6}::jsonb,
      $${offset + 7},
      $${offset + 8},
      NOW()
    )`;
  });

  await client.query(
    `
      INSERT INTO exam_answers (
        attempt_id,
        question_id,
        section_index,
        question_index,
        selected_options,
        matrix_selections,
        answer_text,
        marks_awarded,
        updated_at
      )
      VALUES ${tuples.join(",\n")}
      ON CONFLICT (attempt_id, question_id)
      DO UPDATE SET
        section_index = EXCLUDED.section_index,
        question_index = EXCLUDED.question_index,
        selected_options = EXCLUDED.selected_options,
        matrix_selections = EXCLUDED.matrix_selections,
        answer_text = EXCLUDED.answer_text,
        marks_awarded = EXCLUDED.marks_awarded,
        updated_at = NOW()
    `,
    values,
  );
}

async function loadSnapshotSourcePaper(schoolKey: string, paperId: string) {
  await connectDB();

  const {
    QuestionPaper: QuestionPaperModel,
    Question: QuestionModel,
    Class: ClassModel,
    Subject: SubjectModel,
    AcademicSection: AcademicSectionModel,
  } = await getTenantModels(schoolKey, [
    "QuestionPaper",
    "Question",
    "Class",
    "Subject",
    "AcademicSection",
  ]);

  return QuestionPaperModel.findOne({
    _id: paperId,
    onlineEnabled: true,
    ...buildArchiveFilter(false),
  })
    .select(
      "title instructions class subject duration passingMarks examDate onlineEnabled onlineStartsAt onlineEndsAt totalMarks assignedAcademicSections sections",
    )
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({ path: "subject", model: SubjectModel, select: "name" })
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      select: "name class",
      populate: { path: "class", model: ClassModel, select: "name" },
    })
    .populate({
      path: "sections.questions.question",
      model: QuestionModel,
      select: "content options type answerIndexes matrixOptions matrixAnswers",
    })
    .lean();
}

function buildPreparedExamPaperSnapshotPayload(
  sourcePaper: any,
): PreparedExamPaperSnapshotPayload {
  return {
    classId: String(sourcePaper?.class?._id || sourcePaper?.class || "").trim(),
    subjectId: String(
      sourcePaper?.subject?._id || sourcePaper?.subject || "",
    ).trim(),
    assignedSectionIds: Array.isArray(sourcePaper?.assignedAcademicSections)
      ? sourcePaper.assignedAcademicSections
          .map((section: any) => String(section?._id || section || "").trim())
          .filter(Boolean)
      : [],
    title: String(sourcePaper?.title || ""),
    instructions: String(sourcePaper?.instructions || ""),
    durationMinutes: Number(sourcePaper?.duration || 0),
    passingMarks: Number(sourcePaper?.passingMarks || 0),
    totalMarks: Number(sourcePaper?.totalMarks || 0),
    examDate: sourcePaper?.examDate || null,
    onlineStartsAt: sourcePaper?.onlineStartsAt || null,
    onlineEndsAt: sourcePaper?.onlineEndsAt || null,
    requiresManualReview: paperRequiresManualReview(sourcePaper),
    paperJson: toSerializableValue(sanitizePaperForStudent(sourcePaper)),
    gradingJson: toSerializableValue(sourcePaper),
  };
}

async function acquireExamPaperSnapshotLock(
  client: ExamRuntimeClient,
  schoolKey: string,
  paperId: string,
) {
  await client.query(
    `
      SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))
    `,
    [schoolKey, paperId],
  );
}

async function insertExamPaperSnapshot(
  client: ExamRuntimeClient,
  schoolKey: string,
  paperId: string,
  payload: PreparedExamPaperSnapshotPayload,
) {
  const versionResult = await client.query<{ next_version: number }>(
    `
      SELECT COALESCE(MAX(snapshot_version), 0) + 1 AS next_version
      FROM exam_paper_snapshots
      WHERE school_key = $1
        AND mongo_paper_id = $2
    `,
    [schoolKey, paperId],
  );

  const snapshotVersion = Number(versionResult.rows[0]?.next_version || 1);

  await client.query(
    `
      UPDATE exam_paper_snapshots
      SET status = 'superseded',
          updated_at = NOW()
      WHERE school_key = $1
        AND mongo_paper_id = $2
        AND status = 'active'
    `,
    [schoolKey, paperId],
  );

  const result = await client.query(
    `
      INSERT INTO exam_paper_snapshots (
        id,
        school_key,
        mongo_paper_id,
        snapshot_version,
        status,
        class_id,
        subject_id,
        assigned_section_ids,
        title,
        instructions,
        duration_minutes,
        passing_marks,
        total_marks,
        exam_date,
        online_starts_at,
        online_ends_at,
        requires_manual_review,
        paper_json,
        grading_json,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'active',
        $5,
        $6,
        $7::jsonb,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17::jsonb,
        $18::jsonb,
        NOW(),
        NOW()
      )
      RETURNING ${SNAPSHOT_FULL_COLUMNS}
    `,
    [
      crypto.randomUUID(),
      schoolKey,
      paperId,
      snapshotVersion,
      payload.classId,
      payload.subjectId,
      JSON.stringify(payload.assignedSectionIds),
      payload.title,
      payload.instructions,
      payload.durationMinutes,
      payload.passingMarks,
      payload.totalMarks,
      payload.examDate,
      payload.onlineStartsAt,
      payload.onlineEndsAt,
      payload.requiresManualReview,
      JSON.stringify(payload.paperJson),
      JSON.stringify(payload.gradingJson),
    ],
  );

  return mapSnapshotFullRow(result.rows[0]);
}

async function cacheExamSnapshot(snapshot: ExamPaperSnapshot) {
  cacheExamSnapshotInMemory(snapshot);
  await cacheExamSnapshotPayload(
    snapshot.schoolKey,
    snapshot.mongoPaperId,
    snapshot.snapshotVersion,
    {
      paperJson: snapshot.paperJson,
      gradingJson: snapshot.gradingJson,
    },
  ).catch(() => undefined);
}

export async function disableExamPaperSnapshotsForPaperId(
  schoolKey: string,
  paperId: string,
) {
  if (!(await isExamRuntimeEnabled())) {
    return false;
  }

  await queryExamRuntime(
    `
      UPDATE exam_paper_snapshots
      SET status = 'disabled',
          updated_at = NOW()
      WHERE school_key = $1
        AND mongo_paper_id = $2
        AND status = 'active'
    `,
    [schoolKey, paperId],
  );

  clearCachedActiveExamSnapshot(schoolKey, paperId);
  return true;
}

export async function syncExamPaperSnapshotForPaperId(
  schoolKey: string,
  paperId: string,
) {
  if (!(await isExamRuntimeEnabled())) {
    return null;
  }

  const sourcePaper = await loadSnapshotSourcePaper(schoolKey, paperId);
  if (!sourcePaper || !paperSupportsOnlineDelivery(sourcePaper)) {
    await disableExamPaperSnapshotsForPaperId(schoolKey, paperId);
    return null;
  }

  clearCachedActiveExamSnapshot(schoolKey, paperId);
  const snapshotPayload = buildPreparedExamPaperSnapshotPayload(sourcePaper);

  const insertedSnapshot = await withExamRuntimeTransaction(async (client) => {
    await acquireExamPaperSnapshotLock(client, schoolKey, paperId);
    return insertExamPaperSnapshot(client, schoolKey, paperId, snapshotPayload);
  });

  await cacheExamSnapshot(insertedSnapshot);

  return insertedSnapshot;
}

async function ensureActiveExamSnapshotForPaperId(
  schoolKey: string,
  paperId: string,
) {
  const normalizedPaperId = String(paperId || "").trim();
  if (!normalizedPaperId) {
    return null;
  }

  const existingSnapshot = await getActiveExamSnapshotByPaperId(
    schoolKey,
    normalizedPaperId,
  );
  if (existingSnapshot) {
    return existingSnapshot;
  }

  return getCachedExamRuntimeResource(
    getEnsureActiveExamSnapshotCacheKey(schoolKey, normalizedPaperId),
    EXAM_RUNTIME_SNAPSHOT_CACHE_TTL_MS,
    async () => {
      const cachedSnapshot = await getActiveExamSnapshotByPaperId(
        schoolKey,
        normalizedPaperId,
      );
      if (cachedSnapshot) {
        return cachedSnapshot;
      }

      if (!(await isExamRuntimeEnabled())) {
        return null;
      }

      const sourcePaper = await loadSnapshotSourcePaper(
        schoolKey,
        normalizedPaperId,
      );
      if (!sourcePaper || !paperSupportsOnlineDelivery(sourcePaper)) {
        await disableExamPaperSnapshotsForPaperId(schoolKey, normalizedPaperId);
        return null;
      }

      const snapshotPayload = buildPreparedExamPaperSnapshotPayload(sourcePaper);
      const snapshot = await withExamRuntimeTransaction(async (client) => {
        await acquireExamPaperSnapshotLock(client, schoolKey, normalizedPaperId);

        const lockedExistingSnapshot =
          await getActiveExamSnapshotByPaperIdInTransaction(
            client,
            schoolKey,
            normalizedPaperId,
          );
        if (lockedExistingSnapshot) {
          return lockedExistingSnapshot;
        }

        return insertExamPaperSnapshot(
          client,
          schoolKey,
          normalizedPaperId,
          snapshotPayload,
        );
      });

      await cacheExamSnapshot(snapshot);
      return snapshot;
    },
  );
}

async function getAttemptAnswerBundle(
  attempt: ExamAttempt | null,
  snapshot: ExamPaperSnapshot | null,
) {
  if (!attempt || !snapshot) {
    return { attempt: null, snapshot: null, answerRows: [] as ExamAnswerRow[] };
  }

  const answerRows = await listExamAnswerRowsByAttemptIds([attempt.id]);

  return {
    attempt,
    snapshot,
    answerRows,
  };
}

async function upsertMongoAttemptProjection(params: {
  schoolKey: string;
  attempt: ExamAttempt;
  snapshot: ExamPaperSnapshot;
  answerRows: ExamAnswerRow[];
  sectionAnswers?: Array<{
    sectionName: string;
    answers: Array<{
      question: string;
      selectedOptions?: number[];
      matrixSelections?: number[][];
      answerText?: string;
      marksAwarded?: number;
    }>;
  }>;
}) {
  await connectDB();
  const { QuestionPaperResponse: QuestionPaperResponseModel } =
    await getTenantModels(params.schoolKey, ["QuestionPaperResponse"]);

  const sectionAnswers = Array.isArray(params.sectionAnswers)
    ? params.sectionAnswers
    : buildStoredSectionAnswers(params.snapshot.paperJson, params.answerRows);

  const projection = await QuestionPaperResponseModel.findOneAndUpdate(
    {
      paper: params.attempt.mongoPaperId,
      student: params.attempt.studentId,
    },
    {
      $set: {
        startedAt: params.attempt.startedAt,
        submittedAt: params.attempt.submittedAt,
        status: params.attempt.status,
        lastSavedAt: params.attempt.lastSavedAt,
        totalMarksAwarded: params.attempt.totalMarksAwarded,
        sectionAnswers,
      },
      $setOnInsert: {
        paper: params.attempt.mongoPaperId,
        student: params.attempt.studentId,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  )
    .select("_id")
    .lean();

  const projectionId = String(projection?._id || "").trim();
  return projectionId || undefined;
}

async function loadMongoAttemptProjectionIdMap(
  schoolKey: string,
  attempts: Array<{
    mongoPaperId: string;
    studentId: string;
  }>,
) {
  const normalizedAttempts = attempts.filter(
    (attempt) => attempt?.mongoPaperId && attempt?.studentId,
  );
  if (normalizedAttempts.length === 0) {
    return new Map<string, string>();
  }

  await connectDB();
  const { QuestionPaperResponse: QuestionPaperResponseModel } =
    await getTenantModels(schoolKey, ["QuestionPaperResponse"]);

  const paperIds = Array.from(
    new Set(normalizedAttempts.map((attempt) => String(attempt.mongoPaperId))),
  );
  const studentIds = Array.from(
    new Set(normalizedAttempts.map((attempt) => String(attempt.studentId))),
  );

  const projections = await QuestionPaperResponseModel.find({
    paper: { $in: paperIds },
    student: { $in: studentIds },
  })
    .select("_id paper student")
    .lean();

  return new Map<string, string>(
    projections
      .map((projection: any) => {
        const projectionId = String(projection?._id || "").trim();
        const paperId = String(projection?.paper || "").trim();
        const studentId = String(projection?.student || "").trim();
        if (!projectionId || !paperId || !studentId) {
          return null;
        }

        return [
          buildMongoAttemptProjectionKey(paperId, studentId),
          projectionId,
        ] as const;
      })
      .filter(isDefined),
  );
}

export async function syncExamRuntimeMongoProjectionsForPaper(
  schoolKey: string,
  paperId: string,
) {
  if (!(await isExamRuntimeEnabled())) {
    return new Map<string, string>();
  }

  const normalizedPaperId = String(paperId || "").trim();
  if (!normalizedPaperId) {
    return new Map<string, string>();
  }

  const attempts = await listExamAttemptsForPaper(schoolKey, normalizedPaperId);
  if (attempts.length === 0) {
    return new Map<string, string>();
  }

  const [snapshots, answerRows, existingProjectionIds] = await Promise.all([
    getExamSnapshotsByIds(attempts.map((attempt) => attempt.snapshotId)),
    listExamAnswerRowsByAttemptIds(attempts.map((attempt) => attempt.id)),
    loadMongoAttemptProjectionIdMap(schoolKey, attempts),
  ]);

  const snapshotsById = new Map(
    snapshots.map((snapshot) => [snapshot.id, snapshot]),
  );
  const answerRowsByAttemptId = buildAnswerRowsByAttemptId(answerRows);
  const projectionIdsByKey = new Map(existingProjectionIds);
  let activeSnapshot: ExamPaperSnapshot | null | undefined;

  for (const attempt of attempts) {
    const projectionKey = buildMongoAttemptProjectionKey(
      attempt.mongoPaperId,
      attempt.studentId,
    );
    if (projectionIdsByKey.has(projectionKey)) {
      continue;
    }

    let snapshot = snapshotsById.get(attempt.snapshotId) || null;
    if (!snapshot) {
      if (typeof activeSnapshot === "undefined") {
        activeSnapshot = await ensureActiveExamSnapshotForPaperId(
          schoolKey,
          normalizedPaperId,
        );
      }

      snapshot = activeSnapshot || null;
    }

    if (!snapshot) {
      continue;
    }

    const projectionId = await upsertMongoAttemptProjection({
      schoolKey,
      attempt,
      snapshot,
      answerRows: answerRowsByAttemptId.get(attempt.id) || [],
    });
    if (projectionId) {
      projectionIdsByKey.set(projectionKey, projectionId);
    }
  }

  return projectionIdsByKey;
}

export async function resolveExamRuntimeMongoResponseId(
  schoolKey: string,
  referenceId: string,
) {
  try {
    if (!(await isExamRuntimeEnabled())) {
      return undefined;
    }

    const normalizedReferenceId = String(referenceId || "").trim();
    if (!UUID_PATTERN.test(normalizedReferenceId)) {
      return undefined;
    }

    const attempt = await getExamAttemptById(normalizedReferenceId);
    if (!attempt || attempt.schoolKey !== schoolKey) {
      return undefined;
    }

    const snapshot =
      (await getExamSnapshotById(attempt.snapshotId)) ||
      (await ensureActiveExamSnapshotForPaperId(
        schoolKey,
        attempt.mongoPaperId,
      ));
    if (!snapshot) {
      return undefined;
    }

    const answerRows = await listExamAnswerRowsByAttemptIds([attempt.id]);

    return upsertMongoAttemptProjection({
      schoolKey,
      attempt,
      snapshot,
      answerRows,
    });
  } catch (error) {
    console.error(
      "Failed to resolve an exam runtime attempt into a Mongo response projection:",
      error,
    );
    return undefined;
  }
}

async function finalizeAttemptFromRows(params: {
  schoolKey: string;
  attempt: ExamAttempt;
  snapshot: ExamPaperSnapshot;
  answerRows: ExamAnswerRow[];
  submittedAt: Date;
  autoSubmitted?: boolean;
}): Promise<ResolvedAttemptBundle> {
  const normalized = validateStudentSectionAnswers(
    buildStoredSectionAnswers(params.snapshot.paperJson, params.answerRows),
    params.snapshot.gradingJson,
    { allowEmpty: true },
  );

  const graded = gradeObjectiveSectionAnswers(
    normalized.ok ? normalized.sectionAnswers : [],
    params.snapshot.gradingJson,
  );
  const storedRows = flattenSectionAnswersForStorage(
    graded.sectionAnswers,
    params.snapshot.gradingJson,
  );

  const nextAttempt = await withExamRuntimeTransaction(async (client) => {
    await replaceAttemptAnswerRows(client, params.attempt.id, storedRows);

    const result = await client.query(
      `
        UPDATE exam_attempts
        SET status = $2,
            submitted_at = $3,
            last_saved_at = $3,
            total_marks_awarded = $4,
            updated_at = NOW()
        WHERE id = $1
          AND status = 'in_progress'
        RETURNING ${ATTEMPT_COLUMNS}
      `,
      [
        params.attempt.id,
        params.autoSubmitted ? "auto_submitted" : "submitted",
        params.submittedAt.toISOString(),
        graded.totalMarksAwarded,
      ],
    );

    const row = result.rows[0];
    return row ? mapAttemptRow(row) : null;
  });

  const resolvedAttempt =
    nextAttempt ||
    (await getExamAttemptByPaperId(
      params.schoolKey,
      params.attempt.studentId,
      params.attempt.mongoPaperId,
    ));

  if (!resolvedAttempt) {
    throwExamRuntimeError({
      message: "This attempt could not be submitted.",
      code: "ATTEMPT_SUBMIT_FAILED",
      httpStatus: 409,
      retryable: false,
    });
  }

  const resolvedRows = await listExamAnswerRowsByAttemptIds([resolvedAttempt.id]);

  const mongoResponseId = await upsertMongoAttemptProjection({
    schoolKey: params.schoolKey,
    attempt: resolvedAttempt,
    snapshot: params.snapshot,
    answerRows: resolvedRows,
    sectionAnswers: graded.sectionAnswers,
  });

  return {
    attempt: resolvedAttempt,
    answerRows: resolvedRows,
    mongoResponseId,
  };
}

async function autoSubmitExpiredAttemptIfNeeded(params: {
  schoolKey: string;
  attempt: ExamAttempt;
  snapshot: ExamPaperSnapshot;
  answerRows?: ExamAnswerRow[];
  now?: Date;
}): Promise<ResolvedAttemptBundle> {
  const now = params.now || new Date();
  const deadlineMs = params.attempt.deadlineAt
    ? new Date(params.attempt.deadlineAt).getTime()
    : NaN;

  if (
    params.attempt.status !== "in_progress" ||
    !Number.isFinite(deadlineMs) ||
    now.getTime() <= deadlineMs
  ) {
    const answerRows =
      params.answerRows ||
      (await listExamAnswerRowsByAttemptIds([params.attempt.id]));

    return {
      attempt: params.attempt,
      answerRows,
      mongoResponseId: undefined,
    };
  }

  return finalizeAttemptFromRows({
    schoolKey: params.schoolKey,
    attempt: params.attempt,
    snapshot: params.snapshot,
    answerRows:
      params.answerRows ||
      (await listExamAnswerRowsByAttemptIds([params.attempt.id])),
    submittedAt: new Date(deadlineMs),
    autoSubmitted: true,
  });
}

async function withAttemptLock<T>(
  schoolKey: string,
  paperId: string,
  studentId: string,
  handler: () => Promise<T>,
) {
  const lockToken = crypto.randomUUID();
  const claimed = await claimExamAttemptLock(
    schoolKey,
    paperId,
    studentId,
    lockToken,
  );

  if (claimed === false) {
    throwExamRuntimeError({
      message: "Another test update is already in progress. Please retry.",
      code: "ATTEMPT_LOCKED",
      httpStatus: 409,
      retryable: true,
    });
  }

  try {
    return await handler();
  } finally {
    await releaseExamAttemptLock(
      schoolKey,
      paperId,
      studentId,
      lockToken,
    ).catch(() => undefined);
  }
}

function buildPaperListItem(
  paper: any,
  attempt: ExamAttempt | null,
  serializedAttempt: any,
  now: Date,
) {
  const paperForStatus = paper || {};
  const status = deriveStudentTestStatus(
    paperForStatus,
    buildAttemptStateForStatus(attempt),
    now,
  );

  return {
    _id: String(paperForStatus?._id || ""),
    title: String(paperForStatus?.title || ""),
    duration: Number(paperForStatus?.duration || 0),
    passingMarks: Number(paperForStatus?.passingMarks || 0),
    totalMarks: Number(paperForStatus?.totalMarks || 0),
    examDate: paperForStatus?.examDate || null,
    onlineStartsAt: paperForStatus?.onlineStartsAt || null,
    onlineEndsAt: paperForStatus?.onlineEndsAt || null,
    class: paperForStatus?.class || null,
    subject: paperForStatus?.subject || null,
    assignedAcademicSections: Array.isArray(paperForStatus?.assignedAcademicSections)
      ? paperForStatus.assignedAcademicSections
      : [],
    requiresManualReview: paperRequiresManualReview(paperForStatus),
    status,
    remainingTimeMs: getAttemptRemainingTimeMs(attempt, now),
    attempt: serializedAttempt,
  };
}

function didAttemptStateChange(
  previousAttempt: ExamAttempt,
  nextAttempt: ExamAttempt,
) {
  return (
    previousAttempt.status !== nextAttempt.status ||
    previousAttempt.submittedAt !== nextAttempt.submittedAt ||
    previousAttempt.lastSavedAt !== nextAttempt.lastSavedAt ||
    previousAttempt.totalMarksAwarded !== nextAttempt.totalMarksAwarded
  );
}

function isStudentEligibleForSnapshot(snapshot: ExamPaperSnapshot, student: any) {
  const studentClassId = String(student?.class?._id || student?.class || "").trim();
  if (!studentClassId || studentClassId !== snapshot.classId) {
    return false;
  }

  const assignedSectionIds = new Set(
    (Array.isArray(snapshot.assignedSectionIds)
      ? snapshot.assignedSectionIds
      : []
    )
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );

  if (assignedSectionIds.size === 0) {
    return true;
  }

  const studentSectionId = String(
    student?.academicSection?._id || student?.academicSection || "",
  ).trim();
  return Boolean(studentSectionId && assignedSectionIds.has(studentSectionId));
}

export async function listStudentExamRuntimeTests(
  schoolKey: string,
  studentId: string,
) {
  const models = await getStudentTestModels(schoolKey);
  const { User: UserModel } = models;
  const now = new Date();

  const student = await loadStudentUser(UserModel, studentId, {
    schoolKey,
    useCache: true,
  });
  if (!student) {
    throwExamRuntimeError({
      message: "Student profile not found.",
      code: "STUDENT_NOT_FOUND",
      httpStatus: 404,
      retryable: false,
    });
  }

  const studentClassId = String(student.class?._id || student.class || "").trim();
  const [currentPapers, attempts] = await Promise.all([
    studentClassId
      ? loadOnlinePapersForClass(models, schoolKey, studentClassId)
      : Promise.resolve([]),
    listExamAttemptsForStudent(schoolKey, studentId),
  ]);
  const eligibleCurrentPapers = currentPapers.filter(
    (paper: any) =>
      paperSupportsOnlineDelivery(paper) &&
      isStudentEligibleForPaper(paper, student),
  );

  const snapshotsById = new Map(
    (
      await getExamSnapshotsByIds(attempts.map((attempt) => attempt.snapshotId))
    ).map((snapshot) => [snapshot.id, snapshot]),
  );
  const initialAnswerRowsByAttemptId = buildAnswerRowsByAttemptId(
    attempts.length > 0
      ? await listExamAnswerRowsByAttemptIds(attempts.map((attempt) => attempt.id))
      : [],
  );

  const attemptRowsById = new Map<string, ExamAnswerRow[]>();
  const mongoProjectionIdByKey = new Map<string, string>();
  let attemptsChanged = false;

  for (const attempt of attempts) {
    const snapshot = snapshotsById.get(attempt.snapshotId) || null;
    if (!snapshot) {
      continue;
    }

    const answerRows = initialAnswerRowsByAttemptId.get(attempt.id) || [];
    const nextAttemptBundle = await autoSubmitExpiredAttemptIfNeeded({
      schoolKey,
      attempt,
      snapshot,
      answerRows,
      now,
    });
    attemptRowsById.set(nextAttemptBundle.attempt.id, nextAttemptBundle.answerRows);
    snapshotsById.set(snapshot.id, snapshot);
    if (didAttemptStateChange(attempt, nextAttemptBundle.attempt)) {
      attemptsChanged = true;
    }
    if (nextAttemptBundle.mongoResponseId) {
      attemptsChanged = true;
      mongoProjectionIdByKey.set(
        buildMongoAttemptProjectionKey(
          nextAttemptBundle.attempt.mongoPaperId,
          nextAttemptBundle.attempt.studentId,
        ),
        nextAttemptBundle.mongoResponseId,
      );
    }
  }

  const refreshedAttempts = attemptsChanged
    ? await listExamAttemptsForStudent(schoolKey, studentId)
    : attempts;
  if (refreshedAttempts.length > 0) {
    const existingProjectionIds = await loadMongoAttemptProjectionIdMap(
      schoolKey,
      refreshedAttempts,
    );
    existingProjectionIds.forEach((value, key) => {
      mongoProjectionIdByKey.set(key, value);
    });
  }
  const refreshedAttemptsByPaperId = new Map(
    refreshedAttempts.map((attempt) => [attempt.mongoPaperId, attempt]),
  );

  const testsByPaperId = new Map<string, any>();

  for (const paper of eligibleCurrentPapers) {
    const paperId = String(paper?._id || "").trim();
    if (!paperId) {
      continue;
    }

    const attempt = refreshedAttemptsByPaperId.get(paperId) || null;
    const snapshot = attempt
      ? snapshotsById.get(attempt.snapshotId) ||
        (await ensureActiveExamSnapshotForPaperId(schoolKey, paperId))
      : null;
    const answerRows = attempt ? attemptRowsById.get(attempt.id) || [] : [];
    const mongoResponseId =
      attempt && snapshot
        ? mongoProjectionIdByKey.get(
            buildMongoAttemptProjectionKey(
              attempt.mongoPaperId,
              attempt.studentId,
            ),
          ) ||
          (await upsertMongoAttemptProjection({
            schoolKey,
            attempt,
            snapshot,
            answerRows,
          }))
        : undefined;
    const serializedAttempt =
      attempt && snapshot
        ? serializeRuntimeAttempt(attempt, snapshot.paperJson, answerRows, {
            responseId: mongoResponseId,
          })
        : attempt
          ? serializeRuntimeAttempt(
              attempt,
              sanitizePaperForStudent(paper),
              answerRows,
              { responseId: mongoResponseId },
            )
        : null;

    testsByPaperId.set(
      paperId,
      buildPaperListItem(
        attempt && snapshot
          ? snapshot.paperJson
          : sanitizePaperForStudent(paper),
        attempt,
        serializedAttempt,
        now,
      ),
    );
  }

  for (const attempt of refreshedAttempts) {
    if (testsByPaperId.has(attempt.mongoPaperId)) {
      continue;
    }

    const snapshot = snapshotsById.get(attempt.snapshotId) || null;
    if (!snapshot) {
      continue;
    }

    const answerRows = attemptRowsById.get(attempt.id) || [];
    const mongoResponseId =
      mongoProjectionIdByKey.get(
        buildMongoAttemptProjectionKey(
          attempt.mongoPaperId,
          attempt.studentId,
        ),
      ) ||
      (await upsertMongoAttemptProjection({
        schoolKey,
        attempt,
        snapshot,
        answerRows,
      }));
    testsByPaperId.set(
      attempt.mongoPaperId,
      buildPaperListItem(
        snapshot.paperJson,
        attempt,
        serializeRuntimeAttempt(attempt, snapshot.paperJson, answerRows, {
          responseId: mongoResponseId,
        }),
        now,
      ),
    );
  }

  return Array.from(testsByPaperId.values()).sort((left, right) => {
    const leftRank = ATTEMPT_STATUS_ORDER[left.status] ?? 99;
    const rightRank = ATTEMPT_STATUS_ORDER[right.status] ?? 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const leftTime = left.onlineStartsAt
      ? new Date(left.onlineStartsAt).getTime()
      : new Date(left.examDate || 0).getTime();
    const rightTime = right.onlineStartsAt
      ? new Date(right.onlineStartsAt).getTime()
      : new Date(right.examDate || 0).getTime();
    return leftTime - rightTime;
  });
}

export async function getStudentExamRuntimeDetail(
  schoolKey: string,
  studentId: string,
  paperId: string,
) {
  const now = new Date();
  const models = await getStudentTestModels(schoolKey);
  const { User: UserModel } = models;

  let attempt = await getExamAttemptByPaperId(schoolKey, studentId, paperId);
  if (attempt) {
    const snapshot = await getExamSnapshotById(attempt.snapshotId);
    if (!snapshot) {
      throwExamRuntimeError({
        message: "Online test snapshot not found.",
        code: "ONLINE_TEST_SNAPSHOT_NOT_FOUND",
        httpStatus: 404,
        retryable: false,
      });
    }

    const current = await autoSubmitExpiredAttemptIfNeeded({
      schoolKey,
      attempt,
      snapshot,
      now,
    });
    attempt = current.attempt;

    return {
      success: true,
      paper: snapshot.paperJson,
      attempt: serializeRuntimeAttempt(attempt, snapshot.paperJson, current.answerRows),
      status: deriveStudentTestStatus(
        snapshot.paperJson,
        buildAttemptStateForStatus(attempt),
        now,
      ),
      remainingTimeMs: getAttemptRemainingTimeMs(attempt, now),
      deadlineAt: attempt.deadlineAt,
    };
  }

  const [student, snapshot] = await Promise.all([
    loadStudentUser(UserModel, studentId, {
      schoolKey,
      useCache: true,
    }),
    ensureActiveExamSnapshotForPaperId(schoolKey, paperId),
  ]);
  if (!student) {
    throwExamRuntimeError({
      message: "Student profile not found.",
      code: "STUDENT_NOT_FOUND",
      httpStatus: 404,
      retryable: false,
    });
  }

  if (snapshot) {
    if (!isStudentEligibleForSnapshot(snapshot, student)) {
      throwExamRuntimeError({
        message: "You are not assigned to this online test.",
        code: "ONLINE_TEST_NOT_ASSIGNED",
        httpStatus: 403,
        retryable: false,
      });
    }

    return {
      success: true,
      paper: snapshot.paperJson,
      attempt: null,
      status: deriveStudentTestStatus(snapshot.paperJson, null, now),
      remainingTimeMs: null,
      deadlineAt: null,
    };
  }

  const paper = await loadOnlinePaperById(models, schoolKey, paperId);
  if (!paper) {
    throwExamRuntimeError({
      message: "Online test not found.",
      code: "ONLINE_TEST_NOT_FOUND",
      httpStatus: 404,
      retryable: false,
    });
  }

  if (!paperSupportsOnlineDelivery(paper)) {
    throwExamRuntimeError({
      message:
        "This paper cannot be delivered online because it contains unsupported question types.",
      code: "ONLINE_TEST_UNSUPPORTED",
      httpStatus: 400,
      retryable: false,
    });
  }

  if (!isStudentEligibleForPaper(paper, student)) {
    throwExamRuntimeError({
      message: "You are not assigned to this online test.",
      code: "ONLINE_TEST_NOT_ASSIGNED",
      httpStatus: 403,
      retryable: false,
    });
  }

  return {
    success: true,
    paper: sanitizePaperForStudent(paper),
    attempt: null,
    status: deriveStudentTestStatus(paper, null, now),
    remainingTimeMs: null,
    deadlineAt: null,
  };
}

export async function startStudentExamRuntimeAttempt(
  schoolKey: string,
  studentId: string,
  paperId: string,
) {
  return withAttemptLock(schoolKey, paperId, studentId, async () => {
    const now = new Date();
    let attempt = await getExamAttemptByPaperId(schoolKey, studentId, paperId);

    if (attempt) {
      const snapshot = await getExamSnapshotById(attempt.snapshotId);
      if (!snapshot) {
        throwExamRuntimeError({
          message: "Online test snapshot not found.",
          code: "ONLINE_TEST_SNAPSHOT_NOT_FOUND",
          httpStatus: 404,
          retryable: false,
        });
      }

      const current = await autoSubmitExpiredAttemptIfNeeded({
        schoolKey,
        attempt,
        snapshot,
        now,
      });
      attempt = current.attempt;

      return {
        success: true,
        attempt: serializeRuntimeAttempt(attempt, snapshot.paperJson, current.answerRows),
        status: deriveStudentTestStatus(
          snapshot.paperJson,
          buildAttemptStateForStatus(attempt),
          now,
        ),
        remainingTimeMs: getAttemptRemainingTimeMs(attempt, now),
        deadlineAt: attempt.deadlineAt,
      };
    }

    const models = await getStudentTestModels(schoolKey);
    const { User: UserModel } = models;
    const [student, existingSnapshot] = await Promise.all([
      loadStudentUser(UserModel, studentId, {
        schoolKey,
        useCache: true,
      }),
      ensureActiveExamSnapshotForPaperId(schoolKey, paperId),
    ]);
    if (!student) {
      throwExamRuntimeError({
        message: "Student profile not found.",
        code: "STUDENT_NOT_FOUND",
        httpStatus: 404,
        retryable: false,
      });
    }

    if (existingSnapshot) {
      if (!isStudentEligibleForSnapshot(existingSnapshot, student)) {
        throwExamRuntimeError({
          message: "You are not assigned to this online test.",
          code: "ONLINE_TEST_NOT_ASSIGNED",
          httpStatus: 403,
          retryable: false,
        });
      }

      const windowStart = getPaperWindowStart(existingSnapshot);
      const windowEnd = getPaperWindowEnd(existingSnapshot);

      if (windowStart && now.getTime() < windowStart.getTime()) {
        throwExamRuntimeError({
          message: "This online test is not open yet.",
          code: "ONLINE_TEST_NOT_OPEN_YET",
          httpStatus: 403,
          retryable: false,
        });
      }

      if (windowEnd && now.getTime() > windowEnd.getTime()) {
        throwExamRuntimeError({
          message: "This online test is closed.",
          code: "ONLINE_TEST_CLOSED",
          httpStatus: 403,
          retryable: false,
        });
      }

      attempt = await withExamRuntimeTransaction(async (client) => {
        const deadlineMs = getPaperWindowEnd(existingSnapshot.paperJson)
          ? Math.min(
              new Date(existingSnapshot.paperJson.onlineEndsAt).getTime(),
              now.getTime() +
                Number(existingSnapshot.paperJson.duration || 0) * 60_000,
            )
          : now.getTime() +
            Number(existingSnapshot.paperJson.duration || 0) * 60_000;

        const result = await client.query(
          `
            INSERT INTO exam_attempts (
              id,
              school_key,
              snapshot_id,
              mongo_paper_id,
              student_id,
              status,
              started_at,
              deadline_at,
              last_saved_at,
              total_marks_awarded,
              manual_review_required,
              created_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              'in_progress',
              $6,
              $7,
              $6,
              0,
              $8,
              NOW(),
              NOW()
            )
            ON CONFLICT (school_key, mongo_paper_id, student_id)
            DO NOTHING
            RETURNING ${ATTEMPT_COLUMNS}
          `,
          [
            crypto.randomUUID(),
            schoolKey,
            existingSnapshot.id,
            paperId,
            studentId,
            now.toISOString(),
            Number.isFinite(deadlineMs)
              ? new Date(deadlineMs).toISOString()
              : null,
            existingSnapshot.requiresManualReview,
          ],
        );

        const insertedRow = result.rows[0];
        if (insertedRow) {
          return mapAttemptRow(insertedRow);
        }

        const existingResult = await client.query(
          `
            SELECT ${ATTEMPT_COLUMNS}
            FROM exam_attempts
            WHERE school_key = $1
              AND mongo_paper_id = $2
              AND student_id = $3
            LIMIT 1
          `,
          [schoolKey, paperId, studentId],
        );

        return mapAttemptRow(existingResult.rows[0]);
      });

      return {
        success: true,
        attempt: serializeRuntimeAttempt(attempt, existingSnapshot.paperJson, [], {
          sectionAnswers: [],
        }),
        status: deriveStudentTestStatus(
          existingSnapshot.paperJson,
          buildAttemptStateForStatus(attempt),
          now,
        ),
        remainingTimeMs: getAttemptRemainingTimeMs(attempt, now),
        deadlineAt: attempt.deadlineAt,
      };
    }

    const paper = await loadOnlinePaperById(models, schoolKey, paperId);
    if (!paper) {
      throwExamRuntimeError({
        message: "Online test not found.",
        code: "ONLINE_TEST_NOT_FOUND",
        httpStatus: 404,
        retryable: false,
      });
    }

    if (!paperSupportsOnlineDelivery(paper)) {
      throwExamRuntimeError({
        message:
          "This paper cannot be delivered online because it contains unsupported question types.",
        code: "ONLINE_TEST_UNSUPPORTED",
        httpStatus: 400,
        retryable: false,
      });
    }

    if (!isStudentEligibleForPaper(paper, student)) {
      throwExamRuntimeError({
        message: "You are not assigned to this online test.",
        code: "ONLINE_TEST_NOT_ASSIGNED",
        httpStatus: 403,
        retryable: false,
      });
    }

    const windowStart = getPaperWindowStart(paper);
    const windowEnd = getPaperWindowEnd(paper);

    if (windowStart && now.getTime() < windowStart.getTime()) {
      throwExamRuntimeError({
        message: "This online test is not open yet.",
        code: "ONLINE_TEST_NOT_OPEN_YET",
        httpStatus: 403,
        retryable: false,
      });
    }

    if (windowEnd && now.getTime() > windowEnd.getTime()) {
      throwExamRuntimeError({
        message: "This online test is closed.",
        code: "ONLINE_TEST_CLOSED",
        httpStatus: 403,
        retryable: false,
      });
    }

    const snapshot = await ensureActiveExamSnapshotForPaperId(schoolKey, paperId);
    if (!snapshot) {
      throwExamRuntimeError({
        message: "Online test snapshot is not ready yet.",
        code: "ONLINE_TEST_SNAPSHOT_NOT_READY",
        httpStatus: 409,
        retryable: true,
      });
    }

    const deadlineMs = getPaperWindowEnd(snapshot.paperJson)
      ? Math.min(
          new Date(snapshot.paperJson.onlineEndsAt).getTime(),
          now.getTime() + Number(snapshot.paperJson.duration || 0) * 60_000,
        )
      : now.getTime() + Number(snapshot.paperJson.duration || 0) * 60_000;

    attempt = await withExamRuntimeTransaction(async (client) => {
      const result = await client.query(
        `
          INSERT INTO exam_attempts (
            id,
            school_key,
            snapshot_id,
            mongo_paper_id,
            student_id,
            status,
            started_at,
            deadline_at,
            last_saved_at,
            total_marks_awarded,
            manual_review_required,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'in_progress',
            $6,
            $7,
            $6,
            0,
            $8,
            NOW(),
            NOW()
          )
          ON CONFLICT (school_key, mongo_paper_id, student_id)
          DO NOTHING
          RETURNING ${ATTEMPT_COLUMNS}
        `,
        [
          crypto.randomUUID(),
          schoolKey,
          snapshot.id,
          paperId,
          studentId,
          now.toISOString(),
          Number.isFinite(deadlineMs) ? new Date(deadlineMs).toISOString() : null,
          snapshot.requiresManualReview,
        ],
      );

      const insertedRow = result.rows[0];
      if (insertedRow) {
        return mapAttemptRow(insertedRow);
      }

      const existingResult = await client.query(
        `
          SELECT ${ATTEMPT_COLUMNS}
          FROM exam_attempts
          WHERE school_key = $1
            AND mongo_paper_id = $2
            AND student_id = $3
          LIMIT 1
        `,
        [schoolKey, paperId, studentId],
      );

      return mapAttemptRow(existingResult.rows[0]);
    });

    return {
      success: true,
      attempt: serializeRuntimeAttempt(attempt, snapshot.paperJson, [], {
        sectionAnswers: [],
      }),
      status: deriveStudentTestStatus(
        snapshot.paperJson,
        buildAttemptStateForStatus(attempt),
        now,
      ),
      remainingTimeMs: getAttemptRemainingTimeMs(attempt, now),
      deadlineAt: attempt.deadlineAt,
    };
  });
}

export async function saveStudentExamRuntimeAttempt(params: {
  schoolKey: string;
  studentId: string;
  paperId: string;
  sectionAnswers: unknown;
  baseLastSavedAt?: string | null;
}) {
  return withAttemptLock(
    params.schoolKey,
    params.paperId,
    params.studentId,
    async () => {
      const now = new Date();
      const rateLimit = await consumeAutosaveRateLimit(
        params.schoolKey,
        params.studentId,
        params.paperId,
      );
      if (rateLimit?.limited) {
        throwExamRuntimeError({
          message:
            "Too many save requests were sent at once. Please wait a few seconds and try again.",
          code: "ATTEMPT_SAVE_RATE_LIMITED",
          httpStatus: 429,
          retryable: true,
        });
      }

      let attempt = await getExamAttemptByPaperId(
        params.schoolKey,
        params.studentId,
        params.paperId,
      );

      if (!attempt) {
        throwExamRuntimeError({
          message: "Start the test before saving answers.",
          code: "ATTEMPT_NOT_STARTED",
          httpStatus: 409,
          retryable: false,
        });
      }

      const snapshot = await getExamSnapshotById(attempt.snapshotId);
      if (!snapshot) {
        throwExamRuntimeError({
          message: "Online test snapshot not found.",
          code: "ONLINE_TEST_SNAPSHOT_NOT_FOUND",
          httpStatus: 404,
          retryable: false,
        });
      }

      const current = await autoSubmitExpiredAttemptIfNeeded({
        schoolKey: params.schoolKey,
        attempt,
        snapshot,
        now,
      });
      attempt = current.attempt;

      if (attempt.status === "submitted" || attempt.status === "auto_submitted") {
        throwExamRuntimeError({
          message: "This attempt has already been submitted.",
          code: "ATTEMPT_ALREADY_SUBMITTED",
          httpStatus: 409,
          retryable: false,
          details: {
            attempt: serializeRuntimeAttempt(
              attempt,
              snapshot.paperJson,
              current.answerRows,
            ),
            serverLastSavedAt: attempt.lastSavedAt,
          },
        });
      }

      const normalized = validateStudentSectionAnswers(
        params.sectionAnswers ?? [],
        snapshot.gradingJson,
        { allowEmpty: true },
      );

      if (!normalized.ok) {
        throwExamRuntimeError({
          message: normalized.issues[0] || "Invalid answers payload.",
          code: "INVALID_ANSWERS_PAYLOAD",
          httpStatus: 400,
          retryable: false,
          details: { issues: normalized.issues },
        });
      }

      const baseLastSavedAtMs = parseTimestampMs(params.baseLastSavedAt);
      const serverLastSavedAtMs = parseTimestampMs(attempt.lastSavedAt);
      if (
        baseLastSavedAtMs !== null &&
        serverLastSavedAtMs !== null &&
        baseLastSavedAtMs + 1000 < serverLastSavedAtMs
      ) {
        const storedAnswerRows =
          current.answerRows.length > 0
            ? current.answerRows
            : await listExamAnswerRowsByAttemptIds([attempt.id]);
        const serverSectionAnswers = buildStoredSectionAnswers(
          snapshot.paperJson,
          storedAnswerRows,
        );
        const incomingSignature = buildRuntimeSectionAnswersSignature(
          normalized.sectionAnswers,
          snapshot.gradingJson,
        );
        const serverSignature = buildRuntimeSectionAnswersSignature(
          serverSectionAnswers,
          snapshot.gradingJson,
        );

        if (incomingSignature !== serverSignature) {
          throwExamRuntimeError({
            message:
              "This test was updated from another session. Reload to continue with the latest saved answers.",
            code: "ATTEMPT_STATE_CONFLICT",
            httpStatus: 409,
            retryable: false,
            details: {
              attempt: serializeRuntimeAttempt(
                attempt,
                snapshot.paperJson,
                storedAnswerRows,
                { sectionAnswers: serverSectionAnswers as any },
              ),
              serverLastSavedAt: attempt.lastSavedAt,
            },
          });
        }
      }

      const storedRows = flattenSectionAnswersForStorage(
        normalized.sectionAnswers,
        snapshot.gradingJson,
      );

      const nextAttempt = await withExamRuntimeTransaction(async (client) => {
        await replaceAttemptAnswerRows(client, attempt.id, storedRows);

        const result = await client.query(
          `
            UPDATE exam_attempts
            SET last_saved_at = $2,
                updated_at = NOW()
            WHERE id = $1
              AND status = 'in_progress'
            RETURNING ${ATTEMPT_COLUMNS}
          `,
          [attempt.id, now.toISOString()],
        );

        const row = result.rows[0];
        return row ? mapAttemptRow(row) : null;
      });

      if (!nextAttempt) {
        const resolvedAttempt = await getExamAttemptByPaperId(
          params.schoolKey,
          params.studentId,
          params.paperId,
        );
        const details =
          resolvedAttempt &&
          (resolvedAttempt.status === "submitted" ||
            resolvedAttempt.status === "auto_submitted")
            ? {
                attempt: serializeRuntimeAttempt(
                  resolvedAttempt,
                  snapshot.paperJson,
                  await listExamAnswerRowsByAttemptIds([resolvedAttempt.id]),
                ),
                serverLastSavedAt: resolvedAttempt.lastSavedAt,
              }
            : undefined;
        throwExamRuntimeError({
          message: "This attempt has already been submitted.",
          code: "ATTEMPT_ALREADY_SUBMITTED",
          httpStatus: 409,
          retryable: false,
          details,
        });
      }

      return {
        success: true,
        attempt: serializeRuntimeAttempt(nextAttempt, snapshot.paperJson, [], {
          sectionAnswers: normalized.sectionAnswers,
        }),
        status: deriveStudentTestStatus(
          snapshot.paperJson,
          buildAttemptStateForStatus(nextAttempt),
          now,
        ),
        remainingTimeMs: getAttemptRemainingTimeMs(nextAttempt, now),
        deadlineAt: nextAttempt.deadlineAt,
      };
    },
  );
}

export async function submitStudentExamRuntimeAttempt(params: {
  schoolKey: string;
  studentId: string;
  paperId: string;
  sectionAnswers?: unknown;
  baseLastSavedAt?: string | null;
}) {
  return withAttemptLock(
    params.schoolKey,
    params.paperId,
    params.studentId,
    async () => {
      const now = new Date();
      let attempt = await getExamAttemptByPaperId(
        params.schoolKey,
        params.studentId,
        params.paperId,
      );

      if (!attempt) {
        throwExamRuntimeError({
          message: "Start the test before submitting it.",
          code: "ATTEMPT_NOT_STARTED",
          httpStatus: 409,
          retryable: false,
        });
      }

      const snapshot = await getExamSnapshotById(attempt.snapshotId);
      if (!snapshot) {
        throwExamRuntimeError({
          message: "Online test snapshot not found.",
          code: "ONLINE_TEST_SNAPSHOT_NOT_FOUND",
          httpStatus: 404,
          retryable: false,
        });
      }

      let existingAnswerRows: ExamAnswerRow[] | null = null;
      const loadExistingAnswerRows = async () => {
        if (existingAnswerRows !== null) {
          return existingAnswerRows;
        }

        existingAnswerRows = await listExamAnswerRowsByAttemptIds([attempt.id]);
        return existingAnswerRows;
      };

      if (attempt.status === "submitted" || attempt.status === "auto_submitted") {
        const storedAnswerRows = await loadExistingAnswerRows();
        await upsertMongoAttemptProjection({
          schoolKey: params.schoolKey,
          attempt,
          snapshot,
          answerRows: storedAnswerRows,
        });

        return {
          success: true,
          attempt: serializeRuntimeAttempt(attempt, snapshot.paperJson, storedAnswerRows),
          status: attempt.status,
        };
      }

      const normalized = validateStudentSectionAnswers(
        params.sectionAnswers ??
          buildStoredSectionAnswers(
            snapshot.paperJson,
            await loadExistingAnswerRows(),
          ),
        snapshot.gradingJson,
        { allowEmpty: true },
      );

      if (!normalized.ok) {
        throwExamRuntimeError({
          message: normalized.issues[0] || "Invalid answers payload.",
          code: "INVALID_ANSWERS_PAYLOAD",
          httpStatus: 400,
          retryable: false,
          details: { issues: normalized.issues },
        });
      }

      const baseLastSavedAtMs = parseTimestampMs(params.baseLastSavedAt);
      const serverLastSavedAtMs = parseTimestampMs(attempt.lastSavedAt);
      if (
        baseLastSavedAtMs !== null &&
        serverLastSavedAtMs !== null &&
        baseLastSavedAtMs + 1000 < serverLastSavedAtMs
      ) {
        const storedAnswerRows = await loadExistingAnswerRows();
        const serverSectionAnswers = buildStoredSectionAnswers(
          snapshot.paperJson,
          storedAnswerRows,
        );
        const incomingSignature = buildRuntimeSectionAnswersSignature(
          normalized.sectionAnswers,
          snapshot.gradingJson,
        );
        const serverSignature = buildRuntimeSectionAnswersSignature(
          serverSectionAnswers,
          snapshot.gradingJson,
        );

        if (incomingSignature !== serverSignature) {
          throwExamRuntimeError({
            message:
              "This test was updated from another session. Reload to continue with the latest saved answers.",
            code: "ATTEMPT_STATE_CONFLICT",
            httpStatus: 409,
            retryable: false,
            details: {
              attempt: serializeRuntimeAttempt(
                attempt,
                snapshot.paperJson,
                storedAnswerRows,
                { sectionAnswers: serverSectionAnswers as any },
              ),
              serverLastSavedAt: attempt.lastSavedAt,
            },
          });
        }
      }

      const autoSubmitted =
        attempt.deadlineAt !== null &&
        new Date(attempt.deadlineAt).getTime() < now.getTime();
      const submittedAt =
        autoSubmitted && attempt.deadlineAt
          ? new Date(attempt.deadlineAt)
          : now;

      const graded = gradeObjectiveSectionAnswers(
        normalized.sectionAnswers,
        snapshot.gradingJson,
      );
      const storedRows = flattenSectionAnswersForStorage(
        graded.sectionAnswers,
        snapshot.gradingJson,
      );

      const nextAttempt = await withExamRuntimeTransaction(async (client) => {
        await replaceAttemptAnswerRows(client, attempt!.id, storedRows);

        const result = await client.query(
          `
            UPDATE exam_attempts
            SET status = $2,
                submitted_at = $3,
                last_saved_at = $3,
                total_marks_awarded = $4,
                updated_at = NOW()
            WHERE id = $1
              AND status = 'in_progress'
            RETURNING ${ATTEMPT_COLUMNS}
          `,
          [
            attempt!.id,
            autoSubmitted ? "auto_submitted" : "submitted",
            submittedAt.toISOString(),
            graded.totalMarksAwarded,
          ],
        );

        const row = result.rows[0];
        return row ? mapAttemptRow(row) : null;
      });

      const resolvedAttempt =
        nextAttempt ||
        (await getExamAttemptByPaperId(
          params.schoolKey,
          params.studentId,
          params.paperId,
        ));

      if (!resolvedAttempt) {
        throwExamRuntimeError({
          message: "This attempt could not be submitted.",
          code: "ATTEMPT_SUBMIT_FAILED",
          httpStatus: 409,
          retryable: false,
        });
      }

      const resolvedAnswerRows = await listExamAnswerRowsByAttemptIds([
        resolvedAttempt.id,
      ]);
      await upsertMongoAttemptProjection({
        schoolKey: params.schoolKey,
        attempt: resolvedAttempt,
        snapshot,
        answerRows: resolvedAnswerRows,
        sectionAnswers: graded.sectionAnswers,
      });

      return {
        success: true,
        attempt: serializeRuntimeAttempt(
          resolvedAttempt,
          snapshot.paperJson,
          resolvedAnswerRows,
          {
            sectionAnswers: graded.sectionAnswers,
          },
        ),
        status: resolvedAttempt.status,
      };
    },
  );
}

export function resolveExamRuntimeErrorStatus(error: unknown) {
  return toExamRuntimeError(error).httpStatus;
}

export function resolveExamRuntimeError(
  error: unknown,
  fallbackMessage = "Exam runtime request failed.",
) {
  return toExamRuntimeError(error, fallbackMessage);
}
