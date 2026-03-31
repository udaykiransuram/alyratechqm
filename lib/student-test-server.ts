import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

const STUDENT_SNAPSHOT_TTL_MS = 30_000;
const PAPER_RUNTIME_TTL_MS = 120_000;
const PAPER_DELIVERY_TTL_MS = 60_000;
const CLASS_PAPER_LIST_TTL_MS = 60_000;
const CLASS_PAPER_ASSIGNMENT_TTL_MS = 60_000;
const STUDENT_TEST_CACHE_MAX_ENTRIES = Math.max(
  500,
  Number.parseInt(
    String(process.env.STUDENT_TEST_CACHE_MAX_ENTRIES || "6000"),
    10,
  ) || 6000,
);
const STUDENT_TEST_CACHE_PRUNE_INTERVAL_MS = Math.max(
  250,
  Number.parseInt(
    String(process.env.STUDENT_TEST_CACHE_PRUNE_INTERVAL_MS || "2000"),
    10,
  ) || 2000,
);

const STUDENT_USER_CACHE_NAMESPACE = "student-user";
const STUDENT_PAPER_RUNTIME_CACHE_NAMESPACE = "student-paper-runtime";
const STUDENT_PAPER_DELIVERY_CACHE_NAMESPACE = "student-paper-delivery";
const STUDENT_CLASS_PAPER_LIST_CACHE_NAMESPACE = "student-class-paper-list";
const STUDENT_CLASS_PAPER_ASSIGNMENTS_CACHE_NAMESPACE =
  "student-class-paper-assignments";

type CacheEntry<T> = {
  expiresAt: number;
  hasValue: boolean;
  createdAt: number;
  lastAccessedAt: number;
  value?: T;
  promise?: Promise<T>;
};

type StudentTestResourceCacheState = {
  cache: Map<string, CacheEntry<unknown>>;
  lastPrunedAt: number;
};

function getStudentTestResourceCacheState() {
  const globalState = global as typeof globalThis & {
    __studentTestResourceCacheState?: StudentTestResourceCacheState;
  };

  if (!globalState.__studentTestResourceCacheState) {
    globalState.__studentTestResourceCacheState = {
      cache: new Map(),
      lastPrunedAt: 0,
    };
  }

  return globalState.__studentTestResourceCacheState;
}

function createCacheKey(namespace: string, ...parts: unknown[]) {
  return [namespace, ...parts.map((part) => String(part || "").trim())].join("::");
}

function maybePruneStudentTestResourceCache(now: number) {
  const state = getStudentTestResourceCacheState();
  if (now - state.lastPrunedAt < STUDENT_TEST_CACHE_PRUNE_INTERVAL_MS) {
    return;
  }

  state.lastPrunedAt = now;
  const cache = state.cache;

  for (const [cacheKey, entry] of cache.entries()) {
    if (entry.expiresAt <= now && !entry.promise) {
      cache.delete(cacheKey);
    }
  }

  if (cache.size <= STUDENT_TEST_CACHE_MAX_ENTRIES) {
    return;
  }

  const entriesByLastAccess = Array.from(cache.entries()).sort(
    (left, right) => left[1].lastAccessedAt - right[1].lastAccessedAt,
  );
  const removeCount = Math.max(0, cache.size - STUDENT_TEST_CACHE_MAX_ENTRIES);
  for (let index = 0; index < removeCount; index += 1) {
    cache.delete(entriesByLastAccess[index][0]);
  }
}

function invalidateStudentTestResourceCacheByPrefix(prefix: string) {
  if (!prefix) {
    return;
  }

  const { cache } = getStudentTestResourceCacheState();
  for (const cacheKey of cache.keys()) {
    if (cacheKey.startsWith(prefix)) {
      cache.delete(cacheKey);
    }
  }
}

function invalidateStudentTestResourceCacheBySchoolKey(schoolKey: string) {
  if (!schoolKey) {
    return;
  }

  const { cache } = getStudentTestResourceCacheState();
  for (const cacheKey of cache.keys()) {
    const [, cacheSchoolKey] = cacheKey.split("::", 3);
    if (cacheSchoolKey === schoolKey) {
      cache.delete(cacheKey);
    }
  }
}

export function invalidateStudentTestResourceCache(params: {
  schoolKey: string;
  studentId?: string | null;
  paperId?: string | null;
  classId?: string | null;
  clearSchool?: boolean;
}) {
  const schoolKey = String(params.schoolKey || "").trim();
  if (!schoolKey) {
    return;
  }

  if (params.clearSchool) {
    invalidateStudentTestResourceCacheBySchoolKey(schoolKey);
  }

  const studentId = String(params.studentId || "").trim();
  if (studentId) {
    invalidateStudentTestResourceCacheByPrefix(
      `${STUDENT_USER_CACHE_NAMESPACE}::${schoolKey}::${studentId}`,
    );
  }

  const paperId = String(params.paperId || "").trim();
  if (paperId) {
    invalidateStudentTestResourceCacheByPrefix(
      `${STUDENT_PAPER_RUNTIME_CACHE_NAMESPACE}::${schoolKey}::${paperId}`,
    );
    invalidateStudentTestResourceCacheByPrefix(
      `${STUDENT_PAPER_DELIVERY_CACHE_NAMESPACE}::${schoolKey}::${paperId}`,
    );
  }

  const classId = String(params.classId || "").trim();
  if (classId) {
    invalidateStudentTestResourceCacheByPrefix(
      `${STUDENT_CLASS_PAPER_LIST_CACHE_NAMESPACE}::${schoolKey}::${classId}`,
    );
    invalidateStudentTestResourceCacheByPrefix(
      `${STUDENT_CLASS_PAPER_ASSIGNMENTS_CACHE_NAMESPACE}::${schoolKey}::${classId}`,
    );
  }
}

async function getCachedResource<T>(
  cacheKey: string,
  ttlMs: number,
  loader: () => Promise<T>,
) {
  const state = getStudentTestResourceCacheState();
  const cache = state.cache;
  const now = Date.now();
  maybePruneStudentTestResourceCache(now);
  const existingEntry = cache.get(cacheKey) as CacheEntry<T> | undefined;

  if (existingEntry?.hasValue && existingEntry.expiresAt > now) {
    existingEntry.lastAccessedAt = now;
    return existingEntry.value as T;
  }

  if (existingEntry?.promise) {
    existingEntry.lastAccessedAt = now;
    return existingEntry.promise;
  }

  const promise = loader()
    .then((value) => {
      const resolvedAt = Date.now();
      maybePruneStudentTestResourceCache(resolvedAt);
      cache.set(cacheKey, {
        expiresAt: resolvedAt + ttlMs,
        hasValue: true,
        createdAt: resolvedAt,
        lastAccessedAt: resolvedAt,
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
    createdAt: now,
    lastAccessedAt: now,
    promise,
  });

  return promise;
}

export async function getStudentTestModels(schoolKey: string) {
  await connectDB();

  return getTenantModels(schoolKey, [
    "QuestionPaper",
    "QuestionPaperResponse",
    "User",
    "Question",
    "Class",
    "Subject",
    "AcademicSection",
  ]);
}

type LoadStudentUserOptions = {
  schoolKey?: string;
  useCache?: boolean;
};

export async function loadStudentUser(
  UserModel: any,
  studentId: string,
  options?: LoadStudentUserOptions,
) {
  const load = async () =>
    UserModel.findOne({
      _id: studentId,
      role: "student",
      ...buildArchiveFilter(false),
    })
      .select("name email class academicSection rollNumber")
      .lean();

  if (!options?.useCache || !options.schoolKey) {
    return load();
  }

  return getCachedResource(
    createCacheKey(STUDENT_USER_CACHE_NAMESPACE, options.schoolKey, studentId),
    STUDENT_SNAPSHOT_TTL_MS,
    load,
  );
}

async function loadOnlinePaperRuntimeByIdUncached(
  {
    QuestionPaper: QuestionPaperModel,
    Question: QuestionModel,
  }: {
    QuestionPaper: any;
    Question: any;
  },
  paperId: string,
) {
  return QuestionPaperModel.findOne({
    _id: paperId,
    onlineEnabled: true,
    ...buildArchiveFilter(false),
  })
    .select(
      "class duration passingMarks examDate onlineEnabled onlineStartsAt onlineEndsAt totalMarks assignedAcademicSections sections.name sections.questions.marks sections.questions.negativeMarks sections.questions.question",
    )
    .populate({
      path: "sections.questions.question",
      model: QuestionModel,
      select: "type options answerIndexes matrixOptions matrixAnswers",
    })
    .lean();
}

export async function loadOnlinePaperRuntimeById(
  models: {
    QuestionPaper: any;
    Question: any;
  },
  schoolKey: string,
  paperId: string,
) {
  return getCachedResource(
    createCacheKey(STUDENT_PAPER_RUNTIME_CACHE_NAMESPACE, schoolKey, paperId),
    PAPER_RUNTIME_TTL_MS,
    () => loadOnlinePaperRuntimeByIdUncached(models, paperId),
  );
}

async function loadOnlinePaperDeliveryByIdUncached(
  {
    QuestionPaper: QuestionPaperModel,
    Question: QuestionModel,
    Class: ClassModel,
    Subject: SubjectModel,
    AcademicSection: AcademicSectionModel,
  }: {
    QuestionPaper: any;
    Question: any;
    Class: any;
    Subject: any;
    AcademicSection: any;
  },
  paperId: string,
) {
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

export async function loadOnlinePaperById(
  models: {
    QuestionPaper: any;
    Question: any;
    Class: any;
    Subject: any;
    AcademicSection: any;
  },
  schoolKey: string,
  paperId: string,
) {
  return getCachedResource(
    createCacheKey(STUDENT_PAPER_DELIVERY_CACHE_NAMESPACE, schoolKey, paperId),
    PAPER_DELIVERY_TTL_MS,
    () => loadOnlinePaperDeliveryByIdUncached(models, paperId),
  );
}

async function loadOnlinePapersForClassUncached(
  {
    QuestionPaper: QuestionPaperModel,
    Question: QuestionModel,
    Class: ClassModel,
    Subject: SubjectModel,
  }: {
    QuestionPaper: any;
    Question: any;
    Class: any;
    Subject: any;
  },
  classId: string,
) {
  return QuestionPaperModel.find({
    class: classId,
    onlineEnabled: true,
    ...buildArchiveFilter(false),
  })
    .select(
      "title class subject subjectIds duration passingMarks examDate onlineEnabled onlineStartsAt onlineEndsAt totalMarks assignedAcademicSections sections.name sections.questions.question",
    )
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({ path: "subject", model: SubjectModel, select: "name" })
    .populate({ path: "subjectIds", model: SubjectModel, select: "name" })
    .populate({
      path: "sections.questions.question",
      model: QuestionModel,
      select: "type matrixOptions subject",
      populate: { path: "subject", model: SubjectModel, select: "name" },
    })
    .lean();
}

async function loadOnlinePaperAssignmentsForClassUncached(
  {
    QuestionPaper: QuestionPaperModel,
  }: {
    QuestionPaper: any;
  },
  classId: string,
) {
  return QuestionPaperModel.find({
    class: classId,
    onlineEnabled: true,
    ...buildArchiveFilter(false),
  })
    .select("_id class assignedAcademicSections")
    .lean();
}

export async function loadOnlinePapersForClass(
  models: {
    QuestionPaper: any;
    Question: any;
    Class: any;
    Subject: any;
  },
  schoolKey: string,
  classId: string,
) {
  return getCachedResource(
    createCacheKey(STUDENT_CLASS_PAPER_LIST_CACHE_NAMESPACE, schoolKey, classId),
    CLASS_PAPER_LIST_TTL_MS,
    () => loadOnlinePapersForClassUncached(models, classId),
  );
}

export async function loadOnlinePaperAssignmentsForClass(
  models: {
    QuestionPaper: any;
  },
  schoolKey: string,
  classId: string,
) {
  return getCachedResource(
    createCacheKey(
      STUDENT_CLASS_PAPER_ASSIGNMENTS_CACHE_NAMESPACE,
      schoolKey,
      classId,
    ),
    CLASS_PAPER_ASSIGNMENT_TTL_MS,
    () => loadOnlinePaperAssignmentsForClassUncached(models, classId),
  );
}
