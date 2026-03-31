import { connectDB } from "@/lib/db";
import { buildArchiveFilter } from "@/lib/archive";
import { getTenantDb, getTenantModels } from "@/lib/db-tenant";
import {
  getStudentTestModels,
  loadOnlinePaperAssignmentsForClass,
  loadOnlinePaperById,
  loadOnlinePaperRuntimeById,
  loadStudentUser,
} from "@/lib/student-test-server";
import {
  gradeObjectiveSectionAnswers,
  validateStudentSectionAnswers,
} from "@/lib/question-paper/grading";
import {
  autoSubmitExpiredAttemptIfNeeded as autoSubmitExpiredLegacyAttemptIfNeeded,
  buildStudentPlacementSnapshot,
  buildSectionAnswersSignature as buildLegacySectionAnswersSignature,
  deriveStudentTestStatus,
  finalizeAttemptAsSubmitted,
  findOrCreateStudentAttempt,
  getAttemptDeadlineMs,
  getPaperWindowEnd,
  getPaperWindowStart,
  getRemainingTimeMs,
  isStudentResultReleasedForPaper,
  isStudentEligibleForPaper,
  paperRequiresManualReview,
  paperSupportsOnlineDelivery,
  sanitizeAttemptForStudentDelivery,
  sanitizePaperForStudent,
  sanitizeSerializedAttemptForStudentDelivery,
  summarizeSanitizedPaperForStudent,
  serializeStudentAttempt,
} from "@/lib/student-tests";
import { ATTEMPT_LOCK_TTL_SECONDS } from "@/lib/student-session";
import { resolvePaperSubjectIds } from "@/lib/question-paper/subjects";
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
  | "ATTEMPT_LOCK_UNAVAILABLE"
  | "ATTEMPT_SUBMIT_FAILED"
  | "ATTEMPT_STATE_CONFLICT"
  | "ATTEMPT_SAVE_RATE_LIMITED"
  | "INVALID_ANSWERS_PAYLOAD";

export type ExamRuntimeDependencyStatus = "up" | "down" | "not_configured";

export type ExamRuntimeHealthProbeResult = {
  status: ExamRuntimeDependencyStatus;
  configured: boolean;
  schemaReady: boolean;
  latencyMs: number | null;
  error?: string;
};

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

type ExamPaperSnapshotSummary = {
  id: string;
  schoolKey: string;
  mongoPaperId: string;
  snapshotVersion: number;
  status: ExamSnapshotStatus;
  classId: string;
  subjectId: string;
  subjectIds: string[];
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
  paperSummaryJson: any;
  createdAt: string | null;
  updatedAt: string | null;
};

type ExamPaperSnapshotForGrading = ExamPaperSnapshotSummary & {
  gradingJson: any;
};

type ExamPaperSnapshot = ExamPaperSnapshotForGrading & {
  paperJson: any;
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

type StudentEligibilityContext = {
  classId?: string | null;
  academicSectionId?: string | null;
};

type RuntimeSnapshotPayload = {
  paperJson: any;
  gradingJson: any;
};

type PreparedExamPaperSnapshotPayload = {
  classId: string;
  subjectId: string;
  subjectIds: string[];
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
  paperSummaryJson: any;
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
  subject_ids,
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

const SNAPSHOT_SUMMARY_COLUMNS = `
  ${SNAPSHOT_METADATA_COLUMNS},
  paper_summary_json
`;

const SNAPSHOT_GRADING_COLUMNS = `
  ${SNAPSHOT_SUMMARY_COLUMNS},
  grading_json
`;

const SNAPSHOT_FULL_COLUMNS = `
  ${SNAPSHOT_SUMMARY_COLUMNS},
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
  "The test is temporarily unable to coordinate updates safely. Please retry.": {
    code: "ATTEMPT_LOCK_UNAVAILABLE",
    httpStatus: 503,
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
      subject_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
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
      paper_summary_json JSONB NULL,
      paper_json JSONB NOT NULL,
      grading_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (school_key, mongo_paper_id, snapshot_version)
    )
  `,
  `
    ALTER TABLE exam_paper_snapshots
    ADD COLUMN IF NOT EXISTS subject_ids JSONB NOT NULL DEFAULT '[]'::jsonb
  `,
  `
    ALTER TABLE exam_paper_snapshots
    ADD COLUMN IF NOT EXISTS paper_summary_json JSONB NULL
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
    CREATE INDEX IF NOT EXISTS exam_paper_snapshots_class_lookup
    ON exam_paper_snapshots (school_key, class_id, status)
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
const EXAM_ATTEMPT_LOCK_COLLECTION_NAME = "examattemptlocks";
const EXAM_ATTEMPT_LOCK_UNIQUE_INDEX_NAME =
  "attempt_lock_paper_student_unique_1";
const EXAM_ATTEMPT_LOCK_TTL_INDEX_NAME = "attempt_lock_expiresAt_ttl_1";
const LEGACY_ATTEMPT_RUNTIME_PROJECTION =
  "paper student startedAt submittedAt status lastSavedAt totalMarksAwarded sectionAnswers";

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

function getStudentClassId(value: any) {
  return String(value?.classId || value?.class?._id || value?.class || "").trim();
}

function getStudentAcademicSectionId(value: any) {
  return String(
    value?.academicSectionId ||
      value?.academicSection?._id ||
      value?.academicSection ||
      "",
  ).trim();
}

function hasStudentEligibilityContext(
  value: StudentEligibilityContext | null | undefined,
): value is StudentEligibilityContext & { classId: string } {
  return Boolean(getStudentClassId(value));
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

function getExamSnapshotSummaryByIdCacheKey(snapshotId: string) {
  return createExamRuntimeCacheKey("snapshot-summary-by-id", snapshotId);
}

function getExamSnapshotForGradingByIdCacheKey(snapshotId: string) {
  return createExamRuntimeCacheKey("snapshot-grading-by-id", snapshotId);
}

function getActiveExamSnapshotCacheKey(schoolKey: string, paperId: string) {
  return createExamRuntimeCacheKey("active-snapshot", schoolKey, paperId);
}

function getActiveExamSnapshotSummaryCacheKey(schoolKey: string, paperId: string) {
  return createExamRuntimeCacheKey("active-snapshot-summary", schoolKey, paperId);
}

function getClassExamSnapshotsCacheKey(schoolKey: string, classId: string) {
  return createExamRuntimeCacheKey("class-snapshots", schoolKey, classId);
}

function getEnsureActiveExamSnapshotCacheKey(schoolKey: string, paperId: string) {
  return createExamRuntimeCacheKey("ensure-active-snapshot", schoolKey, paperId);
}

function cacheExamSnapshotSummaryInMemory(snapshot: ExamPaperSnapshotSummary) {
  setCachedExamRuntimeResource(
    getExamSnapshotSummaryByIdCacheKey(snapshot.id),
    EXAM_RUNTIME_SNAPSHOT_CACHE_TTL_MS,
    snapshot,
  );
  if (snapshot.status === "active") {
    setCachedExamRuntimeResource(
      getActiveExamSnapshotSummaryCacheKey(
        snapshot.schoolKey,
        snapshot.mongoPaperId,
      ),
      EXAM_RUNTIME_SNAPSHOT_CACHE_TTL_MS,
      snapshot,
    );
  }
}

function cacheExamSnapshotForGradingInMemory(
  snapshot: ExamPaperSnapshotForGrading,
) {
  setCachedExamRuntimeResource(
    getExamSnapshotForGradingByIdCacheKey(snapshot.id),
    EXAM_RUNTIME_SNAPSHOT_CACHE_TTL_MS,
    snapshot,
  );
  cacheExamSnapshotSummaryInMemory(snapshot);
}

function cacheExamSnapshotInMemory(snapshot: ExamPaperSnapshot) {
  setCachedExamRuntimeResource(
    getExamSnapshotByIdCacheKey(snapshot.id),
    EXAM_RUNTIME_SNAPSHOT_CACHE_TTL_MS,
    snapshot,
  );
  if (snapshot.status === "active") {
    setCachedExamRuntimeResource(
      getActiveExamSnapshotCacheKey(snapshot.schoolKey, snapshot.mongoPaperId),
      EXAM_RUNTIME_SNAPSHOT_CACHE_TTL_MS,
      snapshot,
    );
  }
  cacheExamSnapshotForGradingInMemory(snapshot);
}

function clearCachedActiveExamSnapshot(schoolKey: string, paperId: string) {
  deleteCachedExamRuntimeResource(
    getActiveExamSnapshotCacheKey(schoolKey, paperId),
  );
  deleteCachedExamRuntimeResource(
    getActiveExamSnapshotSummaryCacheKey(schoolKey, paperId),
  );
  deleteCachedExamRuntimeResource(
    getEnsureActiveExamSnapshotCacheKey(schoolKey, paperId),
  );
}

function clearCachedClassExamSnapshots(schoolKey: string, classId: string) {
  const normalizedClassId = String(classId || "").trim();
  if (!normalizedClassId) {
    return;
  }

  deleteCachedExamRuntimeResource(
    getClassExamSnapshotsCacheKey(schoolKey, normalizedClassId),
  );
}

function clearCachedExamRuntimeResourcesForSchool(schoolKey: string) {
  const normalizedSchoolKey = String(schoolKey || "").trim();
  if (!normalizedSchoolKey) {
    return;
  }

  const cache = getExamRuntimeResourceCache();
  for (const cacheKey of Array.from(cache.keys())) {
    if (cacheKey.includes(`::${normalizedSchoolKey}::`)) {
      cache.delete(cacheKey);
    }
  }
}

type ExamAttemptLockIndexState = {
  ensurePromisesBySchool: Map<string, Promise<void>>;
};

function getExamAttemptLockIndexState() {
  const globalState = globalThis as typeof globalThis & {
    __examAttemptLockIndexState?: ExamAttemptLockIndexState;
  };

  if (!globalState.__examAttemptLockIndexState) {
    globalState.__examAttemptLockIndexState = {
      ensurePromisesBySchool: new Map(),
    };
  }

  return globalState.__examAttemptLockIndexState;
}

function isMongoDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

async function ensureExamAttemptFallbackLockIndexes(schoolKey: string) {
  const normalizedSchoolKey = String(schoolKey || "").trim();
  if (!normalizedSchoolKey) {
    throw new Error("schoolKey is required to ensure exam attempt lock indexes.");
  }

  const state = getExamAttemptLockIndexState();
  const existingPromise = state.ensurePromisesBySchool.get(normalizedSchoolKey);
  if (existingPromise) {
    return existingPromise;
  }

  const ensurePromise = (async () => {
    const tenantDb = await getTenantDb(normalizedSchoolKey);
    const db = tenantDb.db;
    if (!db) {
      throw new Error("Tenant database not available for exam attempt locks.");
    }

    const collection = db.collection(EXAM_ATTEMPT_LOCK_COLLECTION_NAME);
    await Promise.all([
      collection.createIndex(
        { paper: 1, student: 1 },
        {
          name: EXAM_ATTEMPT_LOCK_UNIQUE_INDEX_NAME,
          unique: true,
        },
      ),
      collection.createIndex(
        { expiresAt: 1 },
        {
          name: EXAM_ATTEMPT_LOCK_TTL_INDEX_NAME,
          expireAfterSeconds: 0,
        },
      ),
    ]);
  })().catch((error) => {
    state.ensurePromisesBySchool.delete(normalizedSchoolKey);
    throw error;
  });

  state.ensurePromisesBySchool.set(normalizedSchoolKey, ensurePromise);
  return ensurePromise;
}

async function claimExamAttemptFallbackLock(
  schoolKey: string,
  paperId: string,
  studentId: string,
  lockToken: string,
) {
  await connectDB();
  await ensureExamAttemptFallbackLockIndexes(schoolKey);

  const tenantDb = await getTenantDb(schoolKey);
  const db = tenantDb.db;
  if (!db) {
    throw new Error("Tenant database not available for exam attempt locks.");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ATTEMPT_LOCK_TTL_SECONDS * 1000);

  try {
    const result = await db.collection(EXAM_ATTEMPT_LOCK_COLLECTION_NAME).updateOne(
      {
        paper: paperId,
        student: studentId,
        $or: [{ expiresAt: { $lte: now } }, { ownerToken: lockToken }],
      },
      {
        $set: {
          ownerToken: lockToken,
          expiresAt,
          updatedAt: now,
        },
        $setOnInsert: {
          paper: paperId,
          student: studentId,
          createdAt: now,
        },
      },
      { upsert: true },
    );

    return (
      result.upsertedCount > 0 ||
      result.matchedCount > 0 ||
      result.modifiedCount > 0
    );
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      return false;
    }

    throw error;
  }
}

async function releaseExamAttemptFallbackLock(
  schoolKey: string,
  paperId: string,
  studentId: string,
  lockToken: string,
) {
  await connectDB();
  const tenantDb = await getTenantDb(schoolKey);
  const db = tenantDb.db;
  if (!db) {
    return null;
  }

  const result = await db.collection(EXAM_ATTEMPT_LOCK_COLLECTION_NAME).deleteOne({
    paper: paperId,
    student: studentId,
    ownerToken: lockToken,
  });

  return result.deletedCount > 0;
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

export async function probeExamRuntimeHealth(): Promise<ExamRuntimeHealthProbeResult> {
  if (!EXAM_RUNTIME_DATABASE_URL) {
    return {
      status: "not_configured",
      configured: false,
      schemaReady: false,
      latencyMs: null,
    };
  }

  const startedAt = Date.now();
  try {
    const schemaReady = await ensureExamRuntimeSchema();
    const pool = await loadExamRuntimePool();
    if (!schemaReady || !pool) {
      return {
        status: "down",
        configured: true,
        schemaReady: Boolean(schemaReady),
        latencyMs: Date.now() - startedAt,
        error: "Exam runtime schema is not ready.",
      };
    }

    await pool.query("SELECT 1 AS ok");

    return {
      status: "up",
      configured: true,
      schemaReady: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error: any) {
    return {
      status: "down",
      configured: true,
      schemaReady: false,
      latencyMs: Date.now() - startedAt,
      error: error?.message || "Exam runtime probe failed.",
    };
  }
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
    subjectIds: parseJsonValue<string[]>(
      row?.subject_ids,
      row?.subject_id ? [String(row.subject_id)] : [],
    ),
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
    paperSummaryJson: parseJsonValue<any>(row?.paper_summary_json, null),
    createdAt: normalizeDateValue(row?.created_at),
    updatedAt: normalizeDateValue(row?.updated_at),
  } satisfies ExamPaperSnapshotSummary;
}

function mapSnapshotGradingRow(row: any): ExamPaperSnapshotForGrading {
  return {
    ...mapSnapshotMetadataRow(row),
    gradingJson: parseJsonValue<any>(row?.grading_json, null),
  };
}

function mapSnapshotFullRow(row: any): ExamPaperSnapshot {
  return {
    ...mapSnapshotGradingRow(row),
    paperJson: parseJsonValue<any>(row?.paper_json, null),
  };
}

function buildSnapshotPaperSummary(
  snapshot: ExamPaperSnapshotSummary | ExamPaperSnapshotForGrading | ExamPaperSnapshot,
) {
  if (snapshot.paperSummaryJson) {
    return snapshot.paperSummaryJson;
  }

  if ("paperJson" in snapshot && snapshot.paperJson) {
    return summarizeSanitizedPaperForStudent(snapshot.paperJson);
  }

  return {
    _id: snapshot.mongoPaperId,
    title: snapshot.title,
    duration: snapshot.durationMinutes,
    passingMarks: snapshot.passingMarks,
    totalMarks: snapshot.totalMarks,
    examDate: snapshot.examDate,
    onlineEnabled: true,
    onlineStartsAt: snapshot.onlineStartsAt,
    onlineEndsAt: snapshot.onlineEndsAt,
    class: snapshot.classId
      ? {
          _id: snapshot.classId,
          name: "",
        }
      : null,
    subject: snapshot.subjectId
      ? {
          _id: snapshot.subjectId,
          name: "",
        }
      : null,
    subjects: Array.isArray(snapshot.subjectIds)
      ? snapshot.subjectIds.map((subjectId) => ({
          _id: String(subjectId || "").trim(),
          name: "",
        }))
      : [],
    assignedAcademicSections: Array.isArray(snapshot.assignedSectionIds)
      ? snapshot.assignedSectionIds.map((sectionId) => ({
          _id: String(sectionId || "").trim(),
          name: "",
          class: null,
        }))
      : [],
  };
}

function shouldAutoSubmitAttempt(attempt: ExamAttempt | null, now = new Date()) {
  if (!attempt || attempt.status !== "in_progress" || !attempt.deadlineAt) {
    return false;
  }

  const deadlineMs = new Date(attempt.deadlineAt).getTime();
  return Number.isFinite(deadlineMs) && now.getTime() > deadlineMs;
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
          SELECT ${SNAPSHOT_SUMMARY_COLUMNS}
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

async function getExamSnapshotSummaryById(snapshotId: string) {
  const normalizedSnapshotId = String(snapshotId || "").trim();
  if (!UUID_PATTERN.test(normalizedSnapshotId)) {
    return null;
  }

  return getCachedExamRuntimeResource(
    getExamSnapshotSummaryByIdCacheKey(normalizedSnapshotId),
    EXAM_RUNTIME_SNAPSHOT_CACHE_TTL_MS,
    async () => {
      const result = await queryExamRuntime(
        `
          SELECT ${SNAPSHOT_SUMMARY_COLUMNS}
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

      const snapshot = mapSnapshotMetadataRow(row);
      cacheExamSnapshotSummaryInMemory(snapshot);
      return snapshot;
    },
  );
}

async function getExamSnapshotForGradingById(snapshotId: string) {
  const normalizedSnapshotId = String(snapshotId || "").trim();
  if (!UUID_PATTERN.test(normalizedSnapshotId)) {
    return null;
  }

  return getCachedExamRuntimeResource(
    getExamSnapshotForGradingByIdCacheKey(normalizedSnapshotId),
    EXAM_RUNTIME_SNAPSHOT_CACHE_TTL_MS,
    async () => {
      const result = await queryExamRuntime(
        `
          SELECT ${SNAPSHOT_GRADING_COLUMNS}
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

      const snapshot = mapSnapshotGradingRow(row);
      cacheExamSnapshotForGradingInMemory(snapshot);
      return snapshot;
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
      SELECT ${SNAPSHOT_SUMMARY_COLUMNS}
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

async function getExamSnapshotSummariesByIds(snapshotIds: string[]) {
  const normalizedIds = Array.from(
    new Set(snapshotIds.map((value) => String(value || "").trim()).filter(Boolean)),
  );
  if (normalizedIds.length === 0) {
    return [];
  }

  const result = await queryExamRuntime(
    `
      SELECT ${SNAPSHOT_SUMMARY_COLUMNS}
      FROM exam_paper_snapshots
      WHERE id = ANY($1::uuid[])
    `,
    [normalizedIds],
  );

  const snapshots = result.rows.map((row) => mapSnapshotMetadataRow(row));
  snapshots.forEach((snapshot) => {
    cacheExamSnapshotSummaryInMemory(snapshot);
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
          SELECT ${SNAPSHOT_SUMMARY_COLUMNS}
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

async function getActiveExamSnapshotSummaryByPaperId(
  schoolKey: string,
  paperId: string,
) {
  const normalizedPaperId = String(paperId || "").trim();
  if (!normalizedPaperId) {
    return null;
  }

  return getCachedExamRuntimeResource(
    getActiveExamSnapshotSummaryCacheKey(schoolKey, normalizedPaperId),
    EXAM_RUNTIME_SNAPSHOT_CACHE_TTL_MS,
    async () => {
      const result = await queryExamRuntime(
        `
          SELECT ${SNAPSHOT_SUMMARY_COLUMNS}
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

      const snapshot = mapSnapshotMetadataRow(row);
      cacheExamSnapshotSummaryInMemory(snapshot);
      return snapshot;
    },
  );
}

async function listActiveExamSnapshotsForClassId(
  schoolKey: string,
  classId: string,
) {
  const normalizedClassId = String(classId || "").trim();
  if (!normalizedClassId) {
    return [];
  }

  return getCachedExamRuntimeResource(
    getClassExamSnapshotsCacheKey(schoolKey, normalizedClassId),
    EXAM_RUNTIME_SNAPSHOT_CACHE_TTL_MS,
    async () => {
      const result = await queryExamRuntime(
        `
          SELECT ${SNAPSHOT_SUMMARY_COLUMNS}
          FROM exam_paper_snapshots
          WHERE school_key = $1
            AND class_id = $2
            AND status = 'active'
        `,
        [schoolKey, normalizedClassId],
      );

      const snapshots = result.rows.map((row) => mapSnapshotMetadataRow(row));
      snapshots.forEach((snapshot) => {
        cacheExamSnapshotSummaryInMemory(snapshot);
      });
      return snapshots;
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

async function insertOrReuseExamAttempt(
  client: ExamRuntimeClient,
  params: {
    schoolKey: string;
    snapshotId: string;
    paperId: string;
    studentId: string;
    startedAt: string;
    deadlineAt: string | null;
    manualReviewRequired: boolean;
  },
) {
  const result = await client.query(
    `
      WITH inserted AS (
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
      )
      SELECT *
      FROM inserted
      UNION ALL
      SELECT ${ATTEMPT_COLUMNS}
      FROM exam_attempts
      WHERE school_key = $2
        AND mongo_paper_id = $4
        AND student_id = $5
        AND NOT EXISTS (SELECT 1 FROM inserted)
      LIMIT 1
    `,
    [
      crypto.randomUUID(),
      params.schoolKey,
      params.snapshotId,
      params.paperId,
      params.studentId,
      params.startedAt,
      params.deadlineAt,
      params.manualReviewRequired,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to create or load the exam attempt.");
  }

  return mapAttemptRow(row);
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

const questionPositionLookupCache = new WeakMap<
  object,
  Map<
    string,
    {
      sectionName: string;
      sectionIndex: number;
      questionIndex: number;
      questionId: string;
    }
  >
>();

function buildQuestionPositionLookup(paper: any) {
  if (paper && typeof paper === "object") {
    const cachedLookup = questionPositionLookupCache.get(paper);
    if (cachedLookup) {
      return cachedLookup;
    }
  }

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

  if (paper && typeof paper === "object") {
    questionPositionLookupCache.set(paper, lookup);
  }

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

function hydratePersistedAnswerRows(
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
  updatedAt?: string | null,
) {
  return rows.map((row) => ({
    attemptId,
    questionId: row.questionId,
    sectionIndex: row.sectionIndex,
    questionIndex: row.questionIndex,
    selectedOptions: Array.isArray(row.selectedOptions)
      ? [...row.selectedOptions]
      : null,
    matrixSelections: Array.isArray(row.matrixSelections)
      ? row.matrixSelections.map((selection) =>
          Array.isArray(selection) ? [...selection] : [],
        )
      : null,
    answerText: row.answerText,
    marksAwarded: row.marksAwarded,
    updatedAt: updatedAt || null,
  })) satisfies ExamAnswerRow[];
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

function serializeRuntimeAttemptSummary(
  attempt: ExamAttempt,
  options?: {
    responseId?: string;
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
      sectionAnswers: [],
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
  if (rows.length === 0) {
    await client.query("DELETE FROM exam_answers WHERE attempt_id = $1", [
      attemptId,
    ]);
    return;
  }

  const values: Array<string | number | number[] | null> = [attemptId];
  const tuples = rows.map((row, index) => {
    const offset = 2 + index * 7;
    values.push(
      row.questionId,
      row.sectionIndex,
      row.questionIndex,
      row.selectedOptions,
      row.matrixSelections === null ? null : JSON.stringify(row.matrixSelections),
      row.answerText,
      row.marksAwarded,
    );

    return `(
      $1::uuid,
      $${offset}::text,
      $${offset + 1}::integer,
      $${offset + 2}::integer,
      $${offset + 3}::integer[],
      $${offset + 4}::jsonb,
      $${offset + 5}::text,
      $${offset + 6}::numeric
    )`;
  });

  await client.query(
    `
      WITH input_rows (
        attempt_id,
        question_id,
        section_index,
        question_index,
        selected_options,
        matrix_selections,
        answer_text,
        marks_awarded
      ) AS (
        VALUES ${tuples.join(",\n")}
      ),
      deleted AS (
        DELETE FROM exam_answers existing
        WHERE existing.attempt_id = $1::uuid
          AND NOT EXISTS (
            SELECT 1
            FROM input_rows incoming
            WHERE incoming.question_id = existing.question_id
          )
      )
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
      SELECT
        attempt_id,
        question_id,
        section_index,
        question_index,
        selected_options,
        matrix_selections,
        answer_text,
        marks_awarded,
        NOW()
      FROM input_rows
      ON CONFLICT (attempt_id, question_id)
      DO UPDATE SET
        section_index = EXCLUDED.section_index,
        question_index = EXCLUDED.question_index,
        selected_options = EXCLUDED.selected_options,
        matrix_selections = EXCLUDED.matrix_selections,
        answer_text = EXCLUDED.answer_text,
        marks_awarded = EXCLUDED.marks_awarded,
        updated_at = NOW()
      WHERE exam_answers.section_index IS DISTINCT FROM EXCLUDED.section_index
         OR exam_answers.question_index IS DISTINCT FROM EXCLUDED.question_index
         OR exam_answers.selected_options IS DISTINCT FROM EXCLUDED.selected_options
         OR exam_answers.matrix_selections IS DISTINCT FROM EXCLUDED.matrix_selections
         OR exam_answers.answer_text IS DISTINCT FROM EXCLUDED.answer_text
         OR exam_answers.marks_awarded IS DISTINCT FROM EXCLUDED.marks_awarded
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
      "title instructions class subject subjectIds duration passingMarks examDate onlineEnabled onlineStartsAt onlineEndsAt totalMarks assignedAcademicSections sections",
    )
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({ path: "subject", model: SubjectModel, select: "name" })
    .populate({ path: "subjectIds", model: SubjectModel, select: "name" })
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      select: "name class",
      populate: { path: "class", model: ClassModel, select: "name" },
    })
    .populate({
      path: "sections.questions.question",
      model: QuestionModel,
      select: "content options type answerIndexes matrixOptions matrixAnswers subject",
      populate: { path: "subject", model: SubjectModel, select: "name" },
    })
    .lean();
}

function buildPreparedExamPaperSnapshotPayload(
  sourcePaper: any,
): PreparedExamPaperSnapshotPayload {
  const resolvedSubjectIds = resolvePaperSubjectIds(sourcePaper);
  const sanitizedPaper = toSerializableValue(sanitizePaperForStudent(sourcePaper));

  return {
    classId: String(sourcePaper?.class?._id || sourcePaper?.class || "").trim(),
    subjectId: String(resolvedSubjectIds[0] || "").trim(),
    subjectIds: resolvedSubjectIds,
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
    paperSummaryJson: toSerializableValue(
      summarizeSanitizedPaperForStudent(sanitizedPaper),
    ),
    paperJson: sanitizedPaper,
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
        subject_ids,
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
        paper_summary_json,
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
        $8::jsonb,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18::jsonb,
        $19::jsonb,
        $20::jsonb,
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
      JSON.stringify(payload.subjectIds),
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
      JSON.stringify(payload.paperSummaryJson),
      JSON.stringify(payload.paperJson),
      JSON.stringify(payload.gradingJson),
    ],
  );

  return mapSnapshotFullRow(result.rows[0]);
}

async function cacheExamSnapshot(snapshot: ExamPaperSnapshot) {
  clearCachedClassExamSnapshots(snapshot.schoolKey, snapshot.classId);
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

  const result = await queryExamRuntime<{ class_id: string }>(
    `
      UPDATE exam_paper_snapshots
      SET status = 'disabled',
          updated_at = NOW()
      WHERE school_key = $1
        AND mongo_paper_id = $2
        AND status = 'active'
      RETURNING class_id
    `,
    [schoolKey, paperId],
  );

  clearCachedActiveExamSnapshot(schoolKey, paperId);
  result.rows.forEach((row) => {
    clearCachedClassExamSnapshots(schoolKey, row?.class_id);
  });
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

  const previousSnapshot = await getActiveExamSnapshotByPaperId(schoolKey, paperId);
  clearCachedActiveExamSnapshot(schoolKey, paperId);
  if (previousSnapshot?.classId) {
    clearCachedClassExamSnapshots(schoolKey, previousSnapshot.classId);
  }
  const snapshotPayload = buildPreparedExamPaperSnapshotPayload(sourcePaper);

  const insertedSnapshot = await withExamRuntimeTransaction(async (client) => {
    await acquireExamPaperSnapshotLock(client, schoolKey, paperId);
    return insertExamPaperSnapshot(client, schoolKey, paperId, snapshotPayload);
  });

  await cacheExamSnapshot(insertedSnapshot);

  return insertedSnapshot;
}

export async function deleteExamRuntimeDataForSchool(schoolKey: string) {
  const normalizedSchoolKey = String(schoolKey || "")
    .trim()
    .toLowerCase();
  if (!normalizedSchoolKey) {
    return {
      schoolKey: normalizedSchoolKey,
      runtimeEnabled: false,
      deletedAttempts: 0,
      deletedSnapshots: 0,
    };
  }

  if (!(await isExamRuntimeEnabled())) {
    clearCachedExamRuntimeResourcesForSchool(normalizedSchoolKey);
    return {
      schoolKey: normalizedSchoolKey,
      runtimeEnabled: false,
      deletedAttempts: 0,
      deletedSnapshots: 0,
    };
  }

  const snapshots = await queryExamRuntime<{
    id: string;
    class_id: string;
    mongo_paper_id: string;
  }>(
    `
      SELECT id, class_id, mongo_paper_id
      FROM exam_paper_snapshots
      WHERE school_key = $1
    `,
    [normalizedSchoolKey],
  );

  const deleted = await withExamRuntimeTransaction(async (client) => {
    const attemptsResult = await client.query(
      `
        DELETE FROM exam_attempts
        WHERE school_key = $1
      `,
      [normalizedSchoolKey],
    );

    const snapshotsResult = await client.query(
      `
        DELETE FROM exam_paper_snapshots
        WHERE school_key = $1
      `,
      [normalizedSchoolKey],
    );

    return {
      deletedAttempts: attemptsResult.rowCount ?? 0,
      deletedSnapshots: snapshotsResult.rowCount ?? 0,
    };
  });

  snapshots.rows.forEach((snapshot) => {
    const snapshotId = String(snapshot?.id || "").trim();
    const classId = String(snapshot?.class_id || "").trim();
    const paperId = String(snapshot?.mongo_paper_id || "").trim();

    if (snapshotId) {
      deleteCachedExamRuntimeResource(getExamSnapshotByIdCacheKey(snapshotId));
      deleteCachedExamRuntimeResource(
        getExamSnapshotSummaryByIdCacheKey(snapshotId),
      );
      deleteCachedExamRuntimeResource(
        getExamSnapshotForGradingByIdCacheKey(snapshotId),
      );
    }
    if (paperId) {
      clearCachedActiveExamSnapshot(normalizedSchoolKey, paperId);
    }
    if (classId) {
      clearCachedClassExamSnapshots(normalizedSchoolKey, classId);
    }
  });
  clearCachedExamRuntimeResourcesForSchool(normalizedSchoolKey);

  return {
    schoolKey: normalizedSchoolKey,
    runtimeEnabled: true,
    ...deleted,
  };
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
  snapshot: ExamPaperSnapshotForGrading;
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
    : buildStoredSectionAnswers(params.snapshot.gradingJson, params.answerRows);

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
  snapshot: ExamPaperSnapshotForGrading;
  answerRows: ExamAnswerRow[];
  submittedAt: Date;
  autoSubmitted?: boolean;
}): Promise<ResolvedAttemptBundle> {
  const normalized = validateStudentSectionAnswers(
    buildStoredSectionAnswers(params.snapshot.gradingJson, params.answerRows),
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
  const persistedRows = hydratePersistedAnswerRows(
    params.attempt.id,
    storedRows,
    params.submittedAt.toISOString(),
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

  const resolvedRows = nextAttempt
    ? persistedRows
    : await listExamAnswerRowsByAttemptIds([resolvedAttempt.id]);
  let projectionId: string | undefined;

  try {
    projectionId = await upsertMongoAttemptProjection({
      schoolKey: params.schoolKey,
      attempt: resolvedAttempt,
      snapshot: params.snapshot,
      answerRows: resolvedRows,
      sectionAnswers: graded.sectionAnswers,
    });
  } catch (error) {
    console.error(
      "Failed to project auto-submitted runtime attempt into Mongo:",
      error,
    );
  }

  return {
    attempt: resolvedAttempt,
    answerRows: resolvedRows,
    mongoResponseId: projectionId,
  };
}

async function autoSubmitExpiredAttemptIfNeeded(params: {
  schoolKey: string;
  attempt: ExamAttempt;
  snapshot: ExamPaperSnapshotForGrading;
  answerRows?: ExamAnswerRow[];
  now?: Date;
  includeAnswerRows?: boolean;
}): Promise<ResolvedAttemptBundle> {
  const now = params.now || new Date();
  const includeAnswerRows = params.includeAnswerRows !== false;
  const deadlineMs = params.attempt.deadlineAt
    ? new Date(params.attempt.deadlineAt).getTime()
    : NaN;

  if (
    params.attempt.status !== "in_progress" ||
    !Number.isFinite(deadlineMs) ||
    now.getTime() <= deadlineMs
  ) {
    const answerRows = includeAnswerRows
      ? params.answerRows ||
        (await listExamAnswerRowsByAttemptIds([params.attempt.id]))
      : [];

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
  let releaseLock:
    | (() => Promise<unknown>)
    | null = null;

  let claimed: boolean | null = null;
  try {
    claimed = await claimExamAttemptLock(
      schoolKey,
      paperId,
      studentId,
      lockToken,
    );
  } catch {
    claimed = null;
  }

  if (claimed === true) {
    releaseLock = () =>
      releaseExamAttemptLock(
        schoolKey,
        paperId,
        studentId,
        lockToken,
      );
  } else if (claimed === false) {
    throwExamRuntimeError({
      message: "Another test update is already in progress. Please retry.",
      code: "ATTEMPT_LOCKED",
      httpStatus: 409,
      retryable: true,
    });
  } else {
    try {
      const fallbackClaimed = await claimExamAttemptFallbackLock(
        schoolKey,
        paperId,
        studentId,
        lockToken,
      );

      if (!fallbackClaimed) {
        throwExamRuntimeError({
          message: "Another test update is already in progress. Please retry.",
          code: "ATTEMPT_LOCKED",
          httpStatus: 409,
          retryable: true,
        });
      }

      releaseLock = () =>
        releaseExamAttemptFallbackLock(
          schoolKey,
          paperId,
          studentId,
          lockToken,
        );
    } catch (error) {
      if (error instanceof ExamRuntimeError) {
        throw error;
      }

      throwExamRuntimeError({
        message:
          "The test is temporarily unable to coordinate updates safely. Please retry.",
        code: "ATTEMPT_LOCK_UNAVAILABLE",
        httpStatus: 503,
        retryable: true,
        details:
          process.env.NODE_ENV !== "production"
            ? {
                cause:
                  error instanceof Error ? error.message : String(error || ""),
              }
            : undefined,
      });
    }
  }

  try {
    return await handler();
  } finally {
    await releaseLock?.().catch(() => undefined);
  }
}

function buildPaperListItem(
  paper: any,
  attempt: ExamAttempt | null,
  serializedAttempt: any,
  now: Date,
  options?: {
    requiresManualReview?: boolean;
  },
) {
  const paperForStatus = paper || {};
  const resultReleased = isStudentResultReleasedForPaper(paperForStatus, now);
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
    subjects: Array.isArray(paperForStatus?.subjects)
      ? paperForStatus.subjects
      : [],
    assignedAcademicSections: Array.isArray(paperForStatus?.assignedAcademicSections)
      ? paperForStatus.assignedAcademicSections
      : [],
    requiresManualReview:
      typeof options?.requiresManualReview === "boolean"
        ? options.requiresManualReview
        : paperRequiresManualReview(paperForStatus),
    resultReleased,
    status,
    remainingTimeMs: getAttemptRemainingTimeMs(attempt, now),
    attempt: sanitizeSerializedAttemptForStudentDelivery(
      serializedAttempt,
      paperForStatus,
      now,
    ),
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

function isStudentEligibleForSnapshot(
  snapshot: ExamPaperSnapshotSummary,
  student: any,
) {
  const studentClassId = getStudentClassId(student);
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

  const studentSectionId = getStudentAcademicSectionId(student);
  return Boolean(studentSectionId && assignedSectionIds.has(studentSectionId));
}

export async function listStudentExamRuntimeTests(
  schoolKey: string,
  studentId: string,
  studentContext?: StudentEligibilityContext,
) {
  const now = new Date();
  let modelsPromise: Promise<Awaited<ReturnType<typeof getStudentTestModels>>> | null =
    null;
  const getModels = () => {
    if (!modelsPromise) {
      modelsPromise = getStudentTestModels(schoolKey);
    }
    return modelsPromise;
  };

  const student = hasStudentEligibilityContext(studentContext)
    ? studentContext
    : await (async () => {
        const models = await getModels();
        const { User: UserModel } = models;
        return loadStudentUser(UserModel, studentId, {
          schoolKey,
          useCache: true,
        });
      })();
  if (!student) {
    throwExamRuntimeError({
      message: "Student profile not found.",
      code: "STUDENT_NOT_FOUND",
      httpStatus: 404,
      retryable: false,
    });
  }

  const studentClassId = getStudentClassId(student);
  const [activeSnapshotsForClass, attempts] = await Promise.all([
    studentClassId
      ? listActiveExamSnapshotsForClassId(schoolKey, studentClassId)
      : Promise.resolve([]),
    listExamAttemptsForStudent(schoolKey, studentId),
  ]);

  const eligibleCurrentSnapshotsByPaperId = new Map<
    string,
    ExamPaperSnapshotSummary | ExamPaperSnapshot
  >();
  activeSnapshotsForClass.forEach((snapshot) => {
    const paperId = String(snapshot.mongoPaperId || "").trim();
    if (!paperId || !isStudentEligibleForSnapshot(snapshot, student)) {
      return;
    }

    eligibleCurrentSnapshotsByPaperId.set(paperId, snapshot);
  });

  let missingEligiblePaperIds: string[] = [];

  if (studentClassId && activeSnapshotsForClass.length === 0) {
    const models = await getModels();
    const eligiblePaperCandidates = await loadOnlinePaperAssignmentsForClass(
      models,
      schoolKey,
      studentClassId,
    );

    missingEligiblePaperIds = Array.from(
      new Set<string>(
        eligiblePaperCandidates
          .filter((paper: any) => isStudentEligibleForPaper(paper, student))
          .map((paper: any) => String(paper?._id || "").trim())
          .filter(
            (paperId: string) =>
              Boolean(paperId) && !eligibleCurrentSnapshotsByPaperId.has(paperId),
          ),
      ),
    );
  }

  if (missingEligiblePaperIds.length > 0) {
    const ensuredSnapshots = await Promise.all(
      missingEligiblePaperIds.map((paperId) =>
        ensureActiveExamSnapshotForPaperId(schoolKey, paperId),
      ),
    );

    ensuredSnapshots.forEach((snapshot) => {
      const paperId = String(snapshot?.mongoPaperId || "").trim();
      if (!paperId || !snapshot || !isStudentEligibleForSnapshot(snapshot, student)) {
        return;
      }

      eligibleCurrentSnapshotsByPaperId.set(paperId, snapshot);
    });
  }

  const eligibleCurrentSnapshots = Array.from(
    eligibleCurrentSnapshotsByPaperId.values(),
  );

  const snapshotsById = new Map<
    string,
    ExamPaperSnapshotSummary | ExamPaperSnapshotForGrading | ExamPaperSnapshot
  >(
    eligibleCurrentSnapshots.map((snapshot) => [snapshot.id, snapshot]),
  );
  const missingAttemptSnapshotIds = attempts
    .map((attempt) => attempt.snapshotId)
    .filter((snapshotId) => !snapshotsById.has(snapshotId));
  if (missingAttemptSnapshotIds.length > 0) {
    const attemptSnapshots = await getExamSnapshotSummariesByIds(
      missingAttemptSnapshotIds,
    );
    attemptSnapshots.forEach((snapshot) => {
      snapshotsById.set(snapshot.id, snapshot);
    });
  }

  let attemptsChanged = false;
  const nextAttempts: ExamAttempt[] = [];

  for (const attempt of attempts) {
    const snapshot = snapshotsById.get(attempt.snapshotId) || null;
    if (!snapshot) {
      nextAttempts.push(attempt);
      continue;
    }

    if (!shouldAutoSubmitAttempt(attempt, now)) {
      nextAttempts.push(attempt);
      continue;
    }

    const gradingSnapshot = await getExamSnapshotForGradingById(snapshot.id);
    if (!gradingSnapshot) {
      nextAttempts.push(attempt);
      continue;
    }

    const nextAttemptBundle = await autoSubmitExpiredAttemptIfNeeded({
      schoolKey,
      attempt,
      snapshot: gradingSnapshot,
      now,
      includeAnswerRows: false,
    });
    nextAttempts.push(nextAttemptBundle.attempt);
    snapshotsById.set(gradingSnapshot.id, gradingSnapshot);
    if (didAttemptStateChange(attempt, nextAttemptBundle.attempt)) {
      attemptsChanged = true;
    }
  }

  const refreshedAttempts = attemptsChanged
    ? await listExamAttemptsForStudent(schoolKey, studentId)
    : nextAttempts;
  const refreshedAttemptsByPaperId = new Map(
    refreshedAttempts.map((attempt) => [attempt.mongoPaperId, attempt]),
  );

  const testsByPaperId = new Map<string, any>();

  for (const snapshot of eligibleCurrentSnapshots) {
    const paperId = String(snapshot.mongoPaperId || "").trim();
    if (!paperId) {
      continue;
    }

    const attempt = refreshedAttemptsByPaperId.get(paperId) || null;
    const attemptSnapshot = attempt
      ? snapshotsById.get(attempt.snapshotId) || null
      : null;
    const paperForList = buildSnapshotPaperSummary(attemptSnapshot || snapshot);
    const serializedAttempt = attempt
      ? serializeRuntimeAttemptSummary(attempt)
      : null;

    testsByPaperId.set(
      paperId,
      buildPaperListItem(paperForList, attempt, serializedAttempt, now, {
        requiresManualReview:
          attemptSnapshot?.requiresManualReview ?? snapshot.requiresManualReview,
      }),
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

    testsByPaperId.set(
      attempt.mongoPaperId,
      buildPaperListItem(
        buildSnapshotPaperSummary(snapshot),
        attempt,
        serializeRuntimeAttemptSummary(attempt),
        now,
        {
          requiresManualReview: snapshot.requiresManualReview,
        },
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
  studentContext?: StudentEligibilityContext,
) {
  const now = new Date();
  let modelsPromise: Promise<Awaited<ReturnType<typeof getStudentTestModels>>> | null =
    null;
  const getModels = () => {
    if (!modelsPromise) {
      modelsPromise = getStudentTestModels(schoolKey);
    }
    return modelsPromise;
  };

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

    const serializedAttempt = sanitizeSerializedAttemptForStudentDelivery(
      serializeRuntimeAttempt(attempt, snapshot.paperJson, current.answerRows),
      snapshot.paperJson,
      now,
    );

    return {
      success: true,
      paper: snapshot.paperJson,
      attempt: serializedAttempt,
      resultReleased: isStudentResultReleasedForPaper(snapshot.paperJson, now),
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
    hasStudentEligibilityContext(studentContext)
      ? Promise.resolve(studentContext)
      : (async () => {
          const models = await getModels();
          const { User: UserModel } = models;
          return loadStudentUser(UserModel, studentId, {
            schoolKey,
            useCache: true,
          });
        })(),
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

    const windowStart = getPaperWindowStart(snapshot.paperJson);
    if (windowStart && now.getTime() < windowStart.getTime()) {
      throwExamRuntimeError({
        message: "This online test is not open yet.",
        code: "ONLINE_TEST_NOT_OPEN_YET",
        httpStatus: 403,
        retryable: false,
      });
    }

    return {
      success: true,
      paper: snapshot.paperJson,
      attempt: null,
      resultReleased: isStudentResultReleasedForPaper(snapshot.paperJson, now),
      status: deriveStudentTestStatus(snapshot.paperJson, null, now),
      remainingTimeMs: null,
      deadlineAt: null,
    };
  }

  const models = await getModels();
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
  if (windowStart && now.getTime() < windowStart.getTime()) {
    throwExamRuntimeError({
      message: "This online test is not open yet.",
      code: "ONLINE_TEST_NOT_OPEN_YET",
      httpStatus: 403,
      retryable: false,
    });
  }

  return {
    success: true,
    paper: sanitizePaperForStudent(paper),
    attempt: null,
    resultReleased: isStudentResultReleasedForPaper(paper, now),
    status: deriveStudentTestStatus(paper, null, now),
    remainingTimeMs: null,
    deadlineAt: null,
  };
}

function buildLegacyAttemptProgressResponse(
  paper: any,
  attempt: any,
  now: Date,
) {
  const deadlineMs = getAttemptDeadlineMs(paper, attempt);
  return {
    success: true,
    attempt: sanitizeAttemptForStudentDelivery(attempt, paper, now),
    resultReleased: isStudentResultReleasedForPaper(paper, now),
    status: deriveStudentTestStatus(paper, attempt, now),
    remainingTimeMs: getRemainingTimeMs(paper, attempt, now),
    deadlineAt: deadlineMs ? new Date(deadlineMs).toISOString() : null,
  };
}

function buildLegacyAttemptSubmittedResponse(
  paper: any,
  attempt: any,
  now: Date,
) {
  return {
    success: true,
    attempt: sanitizeAttemptForStudentDelivery(attempt, paper, now),
    resultReleased: isStudentResultReleasedForPaper(paper, now),
    status: String(attempt?.status || "submitted"),
    remainingTimeMs: 0,
    deadlineAt: normalizeDateValue(attempt?.submittedAt),
  };
}

async function loadLegacyStudentExamMutationContext(
  schoolKey: string,
  paperId: string,
) {
  const models = await getStudentTestModels(schoolKey);
  const paper = await loadOnlinePaperRuntimeById(models, schoolKey, paperId);

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

  return {
    models,
    paper,
  };
}

async function loadLegacyStudentAttemptProjection(
  QuestionPaperResponseModel: any,
  paperId: string,
  studentId: string,
) {
  return QuestionPaperResponseModel.findOne({
    paper: paperId,
    student: studentId,
  })
    .select(LEGACY_ATTEMPT_RUNTIME_PROJECTION)
    .lean();
}

async function startStudentLegacyAttempt(
  schoolKey: string,
  studentId: string,
  paperId: string,
  studentContext?: StudentEligibilityContext,
) {
  return withAttemptLock(schoolKey, paperId, studentId, async () => {
    const now = new Date();
    const { models, paper } = await loadLegacyStudentExamMutationContext(
      schoolKey,
      paperId,
    );
    const {
      QuestionPaperResponse: QuestionPaperResponseModel,
      User: UserModel,
    } = models;

    let attempt = await loadLegacyStudentAttemptProjection(
      QuestionPaperResponseModel,
      paperId,
      studentId,
    );

    if (attempt) {
      attempt = await autoSubmitExpiredLegacyAttemptIfNeeded({
        QuestionPaperResponseModel,
        attempt,
        paper,
        now,
      });
    }

    if (!attempt || (attempt.status !== "submitted" && attempt.status !== "auto_submitted")) {
      if (!attempt) {
        const sessionPlacement = buildStudentPlacementSnapshot(studentContext);
        const student = hasStudentEligibilityContext(sessionPlacement)
          ? sessionPlacement
          : await loadStudentUser(UserModel, studentId, {
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

        attempt = await findOrCreateStudentAttempt({
          QuestionPaperResponseModel,
          paperId,
          studentId,
          now,
          lean: true,
        });
      }

      return buildLegacyAttemptProgressResponse(paper, attempt, now);
    }

    return buildLegacyAttemptSubmittedResponse(paper, attempt, now);
  });
}

async function saveStudentLegacyAttempt(params: {
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

      const { models, paper } = await loadLegacyStudentExamMutationContext(
        params.schoolKey,
        params.paperId,
      );
      const { QuestionPaperResponse: QuestionPaperResponseModel } = models;

      let attempt = await loadLegacyStudentAttemptProjection(
        QuestionPaperResponseModel,
        params.paperId,
        params.studentId,
      );

      if (attempt) {
        attempt = await autoSubmitExpiredLegacyAttemptIfNeeded({
          QuestionPaperResponseModel,
          attempt,
          paper,
          now,
        });
      }

      if (!attempt) {
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

        throwExamRuntimeError({
          message: "Start the test before saving answers.",
          code: "ATTEMPT_NOT_STARTED",
          httpStatus: 409,
          retryable: false,
        });
      }

      if (attempt.status === "submitted" || attempt.status === "auto_submitted") {
        throwExamRuntimeError({
          message: "This attempt has already been submitted.",
          code: "ATTEMPT_ALREADY_SUBMITTED",
          httpStatus: 409,
          retryable: false,
          details: {
            attempt: sanitizeAttemptForStudentDelivery(attempt, paper, now),
            serverLastSavedAt: attempt?.lastSavedAt || null,
          },
        });
      }

      const normalized = validateStudentSectionAnswers(
        params.sectionAnswers ?? [],
        paper,
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

      const nextSignature = buildLegacySectionAnswersSignature(
        normalized.sectionAnswers,
        paper,
      );
      const existingSignature = buildLegacySectionAnswersSignature(
        attempt?.sectionAnswers || [],
        paper,
      );
      const baseLastSavedAtMs = parseTimestampMs(params.baseLastSavedAt);
      const serverLastSavedAtMs = parseTimestampMs(attempt?.lastSavedAt);

      if (
        baseLastSavedAtMs !== null &&
        serverLastSavedAtMs !== null &&
        baseLastSavedAtMs + 1000 < serverLastSavedAtMs &&
        nextSignature !== existingSignature
      ) {
        throwExamRuntimeError({
          message:
            "This test was updated from another session. Reload to continue with the latest saved answers.",
          code: "ATTEMPT_STATE_CONFLICT",
          httpStatus: 409,
          retryable: false,
          details: {
            attempt: sanitizeAttemptForStudentDelivery(attempt, paper, now),
            serverLastSavedAt: attempt?.lastSavedAt || null,
          },
        });
      }

      if (nextSignature === existingSignature) {
        return buildLegacyAttemptProgressResponse(paper, attempt, now);
      }

      attempt = await QuestionPaperResponseModel.findOneAndUpdate(
        {
          _id: attempt._id,
          status: { $nin: ["submitted", "auto_submitted"] },
        },
        {
          $set: {
            sectionAnswers: normalized.sectionAnswers,
            lastSavedAt: now,
          },
        },
        { new: true },
      )
        .select(LEGACY_ATTEMPT_RUNTIME_PROJECTION)
        .lean();

      if (!attempt) {
        const submittedAttempt = await loadLegacyStudentAttemptProjection(
          QuestionPaperResponseModel,
          params.paperId,
          params.studentId,
        );
        throwExamRuntimeError({
          message: "This attempt has already been submitted.",
          code: "ATTEMPT_ALREADY_SUBMITTED",
          httpStatus: 409,
          retryable: false,
          details: {
            attempt: sanitizeAttemptForStudentDelivery(
              submittedAttempt,
              paper,
              now,
            ),
            serverLastSavedAt: submittedAttempt?.lastSavedAt || null,
          },
        });
      }

      return buildLegacyAttemptProgressResponse(paper, attempt, now);
    },
  );
}

async function submitStudentLegacyAttempt(params: {
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
      const { models, paper } = await loadLegacyStudentExamMutationContext(
        params.schoolKey,
        params.paperId,
      );
      const { QuestionPaperResponse: QuestionPaperResponseModel } = models;

      let attempt = await loadLegacyStudentAttemptProjection(
        QuestionPaperResponseModel,
        params.paperId,
        params.studentId,
      );

      if (!attempt) {
        throwExamRuntimeError({
          message: "Start the test before submitting it.",
          code: "ATTEMPT_NOT_STARTED",
          httpStatus: 409,
          retryable: false,
        });
      }

      attempt = await autoSubmitExpiredLegacyAttemptIfNeeded({
        QuestionPaperResponseModel,
        attempt,
        paper,
        now,
      });

      if (attempt.status === "submitted" || attempt.status === "auto_submitted") {
        return buildLegacyAttemptSubmittedResponse(paper, attempt, now);
      }

      const normalized = validateStudentSectionAnswers(
        params.sectionAnswers ?? attempt.sectionAnswers ?? [],
        paper,
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

      const incomingSignature = buildLegacySectionAnswersSignature(
        normalized.sectionAnswers,
        paper,
      );
      const existingSignature = buildLegacySectionAnswersSignature(
        attempt.sectionAnswers || [],
        paper,
      );
      const baseLastSavedAtMs = parseTimestampMs(params.baseLastSavedAt);
      const serverLastSavedAtMs = parseTimestampMs(attempt?.lastSavedAt);

      if (
        baseLastSavedAtMs !== null &&
        serverLastSavedAtMs !== null &&
        baseLastSavedAtMs + 1000 < serverLastSavedAtMs &&
        incomingSignature !== existingSignature
      ) {
        throwExamRuntimeError({
          message:
            "This test was updated from another session. Reload to continue with the latest saved answers.",
          code: "ATTEMPT_STATE_CONFLICT",
          httpStatus: 409,
          retryable: false,
          details: {
            attempt: sanitizeAttemptForStudentDelivery(attempt, paper, now),
            serverLastSavedAt: attempt?.lastSavedAt || null,
          },
        });
      }

      attempt = await finalizeAttemptAsSubmitted({
        QuestionPaperResponseModel,
        attempt,
        paper,
        sectionAnswers: normalized.sectionAnswers,
        autoSubmitted: false,
        submittedAt: now,
      });

      if (!attempt) {
        throwExamRuntimeError({
          message: "This attempt could not be submitted.",
          code: "ATTEMPT_SUBMIT_FAILED",
          httpStatus: 409,
          retryable: false,
        });
      }

      return buildLegacyAttemptSubmittedResponse(paper, attempt, now);
    },
  );
}

export async function startStudentExamAttempt(
  schoolKey: string,
  studentId: string,
  paperId: string,
  studentContext?: StudentEligibilityContext,
) {
  if (await isExamRuntimeEnabled()) {
    return startStudentExamRuntimeAttempt(
      schoolKey,
      studentId,
      paperId,
      studentContext,
    );
  }

  return startStudentLegacyAttempt(schoolKey, studentId, paperId, studentContext);
}

export async function saveStudentExamAttempt(params: {
  schoolKey: string;
  studentId: string;
  paperId: string;
  sectionAnswers: unknown;
  baseLastSavedAt?: string | null;
}) {
  if (await isExamRuntimeEnabled()) {
    return saveStudentExamRuntimeAttempt(params);
  }

  return saveStudentLegacyAttempt(params);
}

export async function submitStudentExamAttempt(params: {
  schoolKey: string;
  studentId: string;
  paperId: string;
  sectionAnswers?: unknown;
  baseLastSavedAt?: string | null;
}) {
  if (await isExamRuntimeEnabled()) {
    return submitStudentExamRuntimeAttempt(params);
  }

  return submitStudentLegacyAttempt(params);
}

export async function startStudentExamRuntimeAttempt(
  schoolKey: string,
  studentId: string,
  paperId: string,
  studentContext?: StudentEligibilityContext,
) {
  return withAttemptLock(schoolKey, paperId, studentId, async () => {
    const now = new Date();
    let attempt = await getExamAttemptByPaperId(schoolKey, studentId, paperId);

    if (attempt) {
      const snapshot = await getExamSnapshotForGradingById(attempt.snapshotId);
      if (!snapshot) {
        throwExamRuntimeError({
          message: "Online test snapshot not found.",
          code: "ONLINE_TEST_SNAPSHOT_NOT_FOUND",
          httpStatus: 404,
          retryable: false,
        });
      }

      const current = shouldAutoSubmitAttempt(attempt, now)
        ? await autoSubmitExpiredAttemptIfNeeded({
            schoolKey,
            attempt,
            snapshot,
            now,
          })
        : {
            attempt,
            answerRows: await listExamAnswerRowsByAttemptIds([attempt.id]),
            mongoResponseId: undefined,
          };
      attempt = current.attempt;
      const paperSummary = buildSnapshotPaperSummary(snapshot);
      const serializedAttempt = sanitizeSerializedAttemptForStudentDelivery(
        serializeRuntimeAttempt(
          attempt,
          snapshot.gradingJson,
          current.answerRows,
        ),
        paperSummary,
        now,
      );

      return {
        success: true,
        attempt: serializedAttempt,
        resultReleased: isStudentResultReleasedForPaper(paperSummary, now),
        status: deriveStudentTestStatus(
          paperSummary,
          buildAttemptStateForStatus(attempt),
          now,
        ),
        remainingTimeMs: getAttemptRemainingTimeMs(attempt, now),
        deadlineAt: attempt.deadlineAt,
      };
    }

    let modelsPromise: Promise<Awaited<ReturnType<typeof getStudentTestModels>>> | null =
      null;
    const getModels = () => {
      if (!modelsPromise) {
        modelsPromise = getStudentTestModels(schoolKey);
      }
      return modelsPromise;
    };

    const [student, existingSnapshot] = await Promise.all([
      hasStudentEligibilityContext(studentContext)
        ? Promise.resolve(studentContext)
        : (async () => {
            const models = await getModels();
            const { User: UserModel } = models;
            return loadStudentUser(UserModel, studentId, {
              schoolKey,
              useCache: true,
            });
          })(),
      getActiveExamSnapshotSummaryByPaperId(schoolKey, paperId),
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

      const existingSnapshotPaperSummary =
        buildSnapshotPaperSummary(existingSnapshot);
      const windowStart = getPaperWindowStart(existingSnapshotPaperSummary);
      const windowEnd = getPaperWindowEnd(existingSnapshotPaperSummary);

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
        const deadlineMs = getPaperWindowEnd(existingSnapshotPaperSummary)
          ? Math.min(
              new Date(existingSnapshotPaperSummary.onlineEndsAt).getTime(),
              now.getTime() +
                Number(existingSnapshotPaperSummary.duration || 0) * 60_000,
            )
          : now.getTime() +
            Number(existingSnapshotPaperSummary.duration || 0) * 60_000;

        return insertOrReuseExamAttempt(client, {
          schoolKey,
          snapshotId: existingSnapshot.id,
          paperId,
          studentId,
          startedAt: now.toISOString(),
          deadlineAt: Number.isFinite(deadlineMs)
            ? new Date(deadlineMs).toISOString()
            : null,
          manualReviewRequired: existingSnapshot.requiresManualReview,
        });
      });

      return {
        success: true,
        attempt: sanitizeSerializedAttemptForStudentDelivery(
          serializeRuntimeAttempt(
            attempt,
            existingSnapshotPaperSummary,
            [],
            {
              sectionAnswers: [],
            },
          ),
          existingSnapshotPaperSummary,
          now,
        ),
        resultReleased: isStudentResultReleasedForPaper(
          existingSnapshotPaperSummary,
          now,
        ),
        status: deriveStudentTestStatus(
          existingSnapshotPaperSummary,
          buildAttemptStateForStatus(attempt),
          now,
        ),
        remainingTimeMs: getAttemptRemainingTimeMs(attempt, now),
        deadlineAt: attempt.deadlineAt,
      };
    }

    const models = await getModels();
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

    const snapshotPaperSummary = buildSnapshotPaperSummary(snapshot);
    const deadlineMs = getPaperWindowEnd(snapshotPaperSummary)
      ? Math.min(
          new Date(snapshotPaperSummary.onlineEndsAt).getTime(),
          now.getTime() + Number(snapshotPaperSummary.duration || 0) * 60_000,
        )
      : now.getTime() + Number(snapshotPaperSummary.duration || 0) * 60_000;

    attempt = await withExamRuntimeTransaction(async (client) =>
      insertOrReuseExamAttempt(client, {
        schoolKey,
        snapshotId: snapshot.id,
        paperId,
        studentId,
        startedAt: now.toISOString(),
        deadlineAt: Number.isFinite(deadlineMs)
          ? new Date(deadlineMs).toISOString()
          : null,
        manualReviewRequired: snapshot.requiresManualReview,
      }),
    );

    return {
      success: true,
      attempt: sanitizeSerializedAttemptForStudentDelivery(
        serializeRuntimeAttempt(attempt, snapshotPaperSummary, [], {
          sectionAnswers: [],
        }),
        snapshotPaperSummary,
        now,
      ),
      resultReleased: isStudentResultReleasedForPaper(snapshotPaperSummary, now),
      status: deriveStudentTestStatus(
        snapshotPaperSummary,
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

      const snapshot = await getExamSnapshotForGradingById(attempt.snapshotId);
      if (!snapshot) {
        throwExamRuntimeError({
          message: "Online test snapshot not found.",
          code: "ONLINE_TEST_SNAPSHOT_NOT_FOUND",
          httpStatus: 404,
          retryable: false,
        });
      }
      const paperSummary = buildSnapshotPaperSummary(snapshot);
      const serializeStoredAttempt = (
        resolvedAttempt: ExamAttempt,
        answerRows: ExamAnswerRow[],
      ) =>
        serializeRuntimeAttempt(
          resolvedAttempt,
          paperSummary,
          answerRows,
          {
            sectionAnswers: buildStoredSectionAnswers(
              snapshot.gradingJson,
              answerRows,
            ) as any,
          },
        );

      const current = await autoSubmitExpiredAttemptIfNeeded({
        schoolKey: params.schoolKey,
        attempt,
        snapshot,
        now,
        includeAnswerRows: false,
      });
      attempt = current.attempt;

      if (attempt.status === "submitted" || attempt.status === "auto_submitted") {
        const submittedAnswerRows =
          current.answerRows.length > 0
            ? current.answerRows
            : await listExamAnswerRowsByAttemptIds([attempt.id]);
        throwExamRuntimeError({
          message: "This attempt has already been submitted.",
          code: "ATTEMPT_ALREADY_SUBMITTED",
          httpStatus: 409,
          retryable: false,
          details: {
            attempt: sanitizeSerializedAttemptForStudentDelivery(
              serializeStoredAttempt(attempt, submittedAnswerRows),
              paperSummary,
              now,
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
          snapshot.gradingJson,
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
              attempt: sanitizeSerializedAttemptForStudentDelivery(
                serializeRuntimeAttempt(
                  attempt,
                  paperSummary,
                  storedAnswerRows,
                  { sectionAnswers: serverSectionAnswers as any },
                ),
                paperSummary,
                now,
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
                attempt: sanitizeSerializedAttemptForStudentDelivery(
                  serializeStoredAttempt(
                    resolvedAttempt,
                    await listExamAnswerRowsByAttemptIds([resolvedAttempt.id]),
                  ),
                  paperSummary,
                  now,
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
        attempt: sanitizeSerializedAttemptForStudentDelivery(
          serializeRuntimeAttempt(nextAttempt, paperSummary, [], {
            sectionAnswers: normalized.sectionAnswers,
          }),
          paperSummary,
          now,
        ),
        resultReleased: isStudentResultReleasedForPaper(paperSummary, now),
        status: deriveStudentTestStatus(
          paperSummary,
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

      const snapshot = await getExamSnapshotForGradingById(attempt.snapshotId);
      if (!snapshot) {
        throwExamRuntimeError({
          message: "Online test snapshot not found.",
          code: "ONLINE_TEST_SNAPSHOT_NOT_FOUND",
          httpStatus: 404,
          retryable: false,
        });
      }
      const paperSummary = buildSnapshotPaperSummary(snapshot);
      const serializeStoredAttempt = (
        resolvedAttempt: ExamAttempt,
        answerRows: ExamAnswerRow[],
      ) =>
        serializeRuntimeAttempt(
          resolvedAttempt,
          paperSummary,
          answerRows,
          {
            sectionAnswers: buildStoredSectionAnswers(
              snapshot.gradingJson,
              answerRows,
            ) as any,
          },
        );

      const attemptId = attempt.id;
      let existingAnswerRows: ExamAnswerRow[] | null = null;
      const loadExistingAnswerRows = async () => {
        if (existingAnswerRows !== null) {
          return existingAnswerRows;
        }

        existingAnswerRows = await listExamAnswerRowsByAttemptIds([attemptId]);
        return existingAnswerRows;
      };

      if (attempt.status === "submitted" || attempt.status === "auto_submitted") {
        const storedAnswerRows = await loadExistingAnswerRows();
        return {
          success: true,
          attempt: sanitizeSerializedAttemptForStudentDelivery(
            serializeStoredAttempt(attempt, storedAnswerRows),
            paperSummary,
            now,
          ),
          resultReleased: isStudentResultReleasedForPaper(paperSummary, now),
          status: attempt.status,
        };
      }

      if (shouldAutoSubmitAttempt(attempt, now)) {
        const current = await autoSubmitExpiredAttemptIfNeeded({
          schoolKey: params.schoolKey,
          attempt,
          snapshot,
          now,
        });
        attempt = current.attempt;
        existingAnswerRows = current.answerRows;

        if (attempt.status === "submitted" || attempt.status === "auto_submitted") {
          return {
            success: true,
            attempt: sanitizeSerializedAttemptForStudentDelivery(
              serializeStoredAttempt(attempt, current.answerRows),
              paperSummary,
              now,
            ),
            resultReleased: isStudentResultReleasedForPaper(paperSummary, now),
            status: attempt.status,
          };
        }
      }

      const normalized = validateStudentSectionAnswers(
        params.sectionAnswers ??
          buildStoredSectionAnswers(
            snapshot.gradingJson,
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
          snapshot.gradingJson,
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
              attempt: sanitizeSerializedAttemptForStudentDelivery(
                serializeRuntimeAttempt(
                  attempt,
                  paperSummary,
                  storedAnswerRows,
                  { sectionAnswers: serverSectionAnswers as any },
                ),
                paperSummary,
                now,
              ),
              serverLastSavedAt: attempt.lastSavedAt,
            },
          });
        }
      }

      const graded = gradeObjectiveSectionAnswers(
        normalized.sectionAnswers,
        snapshot.gradingJson,
      );
      const storedRows = flattenSectionAnswersForStorage(
        graded.sectionAnswers,
        snapshot.gradingJson,
      );
      const persistedRows = hydratePersistedAnswerRows(
        attempt.id,
        storedRows,
        now.toISOString(),
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
            "submitted",
            now.toISOString(),
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

      const resolvedAnswerRows = nextAttempt
        ? persistedRows
        : await listExamAnswerRowsByAttemptIds([resolvedAttempt.id]);
      let projectionId: string | undefined;

      try {
        projectionId = await upsertMongoAttemptProjection({
          schoolKey: params.schoolKey,
          attempt: resolvedAttempt,
          snapshot,
          answerRows: resolvedAnswerRows,
          sectionAnswers: graded.sectionAnswers,
        });
      } catch (error) {
        console.error(
          "Failed to project submitted runtime attempt into Mongo:",
          error,
        );
      }

      return {
        success: true,
        attempt: sanitizeSerializedAttemptForStudentDelivery(
          serializeRuntimeAttempt(
            resolvedAttempt,
            paperSummary,
            resolvedAnswerRows,
            {
              sectionAnswers: graded.sectionAnswers,
            },
          ),
          paperSummary,
          now,
        ),
        resultReleased: isStudentResultReleasedForPaper(paperSummary, now),
        status: resolvedAttempt.status,
        mongoResponseId: projectionId,
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
