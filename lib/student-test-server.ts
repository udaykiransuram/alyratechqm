import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

const STUDENT_SNAPSHOT_TTL_MS = 30_000;
const PAPER_RUNTIME_TTL_MS = 120_000;
const PAPER_DELIVERY_TTL_MS = 60_000;
const CLASS_PAPER_LIST_TTL_MS = 60_000;

type CacheEntry<T> = {
  expiresAt: number;
  hasValue: boolean;
  value?: T;
  promise?: Promise<T>;
};

function getStudentTestResourceCache() {
  const globalState = global as typeof globalThis & {
    __studentTestResourceCache?: Map<string, CacheEntry<unknown>>;
  };

  if (!globalState.__studentTestResourceCache) {
    globalState.__studentTestResourceCache = new Map();
  }

  return globalState.__studentTestResourceCache;
}

function createCacheKey(namespace: string, ...parts: unknown[]) {
  return [namespace, ...parts.map((part) => String(part || "").trim())].join("::");
}

async function getCachedResource<T>(
  cacheKey: string,
  ttlMs: number,
  loader: () => Promise<T>,
) {
  const cache = getStudentTestResourceCache();
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
    createCacheKey("student-user", options.schoolKey, studentId),
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
    createCacheKey("student-paper-runtime", schoolKey, paperId),
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
    createCacheKey("student-paper-delivery", schoolKey, paperId),
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
      "title class subject duration passingMarks examDate onlineEnabled onlineStartsAt onlineEndsAt totalMarks assignedAcademicSections sections.name sections.questions.marks sections.questions.negativeMarks sections.questions.question",
    )
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({ path: "subject", model: SubjectModel, select: "name" })
    .populate({
      path: "sections.questions.question",
      model: QuestionModel,
      select: "type options answerIndexes matrixOptions matrixAnswers",
    })
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
    createCacheKey("student-class-paper-list", schoolKey, classId),
    CLASS_PAPER_LIST_TTL_MS,
    () => loadOnlinePapersForClassUncached(models, classId),
  );
}
