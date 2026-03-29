import {
  buildPaperQuestionLookup,
  gradeObjectiveSectionAnswers,
  hasAnyMatrixSelection,
  isOnlineQuestionType,
  validateStudentSectionAnswers,
} from "@/lib/question-paper/grading";
import { serializePaperSubjects } from "@/lib/question-paper/subjects";
import {
  deriveSectionDefaultMarks,
  deriveSectionDefaultNegativeMarks,
} from "@/lib/question-paper/sections";

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

type PaperDeliveryCapabilities = {
  supportsOnlineDelivery: boolean;
  requiresManualReview: boolean;
};

const paperQuestionLookupCache = new WeakMap<
  object,
  ReturnType<typeof buildPaperQuestionLookup>
>();
const paperDeliveryCapabilitiesCache = new WeakMap<
  object,
  PaperDeliveryCapabilities
>();

function getCachedPaperQuestionLookup(paper: any) {
  if (!paper || typeof paper !== "object") {
    return buildPaperQuestionLookup(paper);
  }

  const cachedLookup = paperQuestionLookupCache.get(paper);
  if (cachedLookup) {
    return cachedLookup;
  }

  const lookup = buildPaperQuestionLookup(paper);
  paperQuestionLookupCache.set(paper, lookup);
  return lookup;
}

function getPaperDeliveryCapabilities(paper: any): PaperDeliveryCapabilities {
  if (!paper || typeof paper !== "object") {
    const lookup = buildPaperQuestionLookup(paper);
    if (lookup.size === 0) {
      return {
        supportsOnlineDelivery: false,
        requiresManualReview: false,
      };
    }

    let supportsOnlineDelivery = true;
    let requiresManualReview = false;
    for (const spec of lookup.values()) {
      if (!isOnlineQuestionType(spec.type)) {
        supportsOnlineDelivery = false;
      } else if (
        spec.type === "matrix-match" &&
        (spec.matrixRowCount <= 0 || spec.matrixColumnIndexes.size <= 0)
      ) {
        supportsOnlineDelivery = false;
      }

      if (spec.type === "descriptive") {
        requiresManualReview = true;
      }
    }

    return {
      supportsOnlineDelivery,
      requiresManualReview,
    };
  }

  const cachedCapabilities = paperDeliveryCapabilitiesCache.get(paper);
  if (cachedCapabilities) {
    return cachedCapabilities;
  }

  const lookup = getCachedPaperQuestionLookup(paper);
  if (lookup.size === 0) {
    const emptyCapabilities = {
      supportsOnlineDelivery: false,
      requiresManualReview: false,
    };
    paperDeliveryCapabilitiesCache.set(paper, emptyCapabilities);
    return emptyCapabilities;
  }

  let supportsOnlineDelivery = true;
  let requiresManualReview = false;
  for (const spec of lookup.values()) {
    if (!isOnlineQuestionType(spec.type)) {
      supportsOnlineDelivery = false;
    } else if (
      spec.type === "matrix-match" &&
      (spec.matrixRowCount <= 0 || spec.matrixColumnIndexes.size <= 0)
    ) {
      supportsOnlineDelivery = false;
    }

    if (spec.type === "descriptive") {
      requiresManualReview = true;
    }
  }

  const capabilities = {
    supportsOnlineDelivery,
    requiresManualReview,
  };
  paperDeliveryCapabilitiesCache.set(paper, capabilities);
  return capabilities;
}

export function buildStudentPlacementSnapshot(studentLike: any) {
  const classId = normalizeId(
    studentLike?.studentClassId ||
      studentLike?.classId ||
      studentLike?.class?._id ||
      studentLike?.class,
  );
  const academicSectionId = normalizeId(
    studentLike?.studentAcademicSectionId ||
      studentLike?.academicSectionId ||
      studentLike?.academicSection?._id ||
      studentLike?.academicSection,
  );

  return {
    classId,
    academicSectionId,
  };
}

function parseDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getPaperWindowStart(paper: any) {
  return parseDate(paper?.onlineStartsAt) || parseDate(paper?.examDate);
}

export function getPaperWindowEnd(paper: any) {
  return parseDate(paper?.onlineEndsAt);
}

export function isStudentResultReleasedForPaper(paper: any, now = new Date()) {
  const windowEnd = getPaperWindowEnd(paper);
  if (!windowEnd) {
    return true;
  }
  return now.getTime() >= windowEnd.getTime();
}

export function getAttemptDeadlineMs(paper: any, attempt: any) {
  const startedAt = parseDate(attempt?.startedAt);
  if (!startedAt) return null;

  const durationMinutes = Number(paper?.duration || 0);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;

  let deadlineMs = startedAt.getTime() + durationMinutes * 60 * 1000;
  const windowEnd = getPaperWindowEnd(paper);
  if (windowEnd) {
    deadlineMs = Math.min(deadlineMs, windowEnd.getTime());
  }

  return deadlineMs;
}

export function paperSupportsOnlineDelivery(paper: any) {
  return getPaperDeliveryCapabilities(paper).supportsOnlineDelivery;
}

export function paperRequiresManualReview(paper: any) {
  return getPaperDeliveryCapabilities(paper).requiresManualReview;
}

export function isStudentEligibleForPaper(paper: any, student: any) {
  const studentClassId = normalizeId(
    student?.classId || student?.class?._id || student?.class,
  );
  const paperClassId = normalizeId(paper?.class?._id || paper?.class);
  if (!studentClassId || !paperClassId || studentClassId !== paperClassId) {
    return false;
  }

  const assignedAcademicSectionIds = new Set(
    (Array.isArray(paper?.assignedAcademicSections)
      ? paper.assignedAcademicSections
      : []
    )
      .map((section: any) => normalizeId(section?._id || section))
      .filter(Boolean),
  );

  if (assignedAcademicSectionIds.size === 0) {
    return true;
  }

  const studentAcademicSectionId = normalizeId(
    student?.academicSectionId ||
      student?.academicSection?._id ||
      student?.academicSection,
  );
  return Boolean(
    studentAcademicSectionId &&
      assignedAcademicSectionIds.has(studentAcademicSectionId),
  );
}

export function sanitizePaperForStudent(paper: any) {
  const paperSubjects = serializePaperSubjects(paper);

  return {
    _id: String(paper?._id || ""),
    title: String(paper?.title || ""),
    instructions: String(paper?.instructions || ""),
    duration: Number(paper?.duration || 0),
    passingMarks: Number(paper?.passingMarks || 0),
    totalMarks: Number(paper?.totalMarks || 0),
    examDate: paper?.examDate || null,
    onlineEnabled: Boolean(paper?.onlineEnabled),
    onlineStartsAt: paper?.onlineStartsAt || null,
    onlineEndsAt: paper?.onlineEndsAt || null,
    class: paper?.class
      ? {
          _id: normalizeId(paper.class?._id || paper.class),
          name: String(paper.class?.name || ""),
        }
      : null,
    ...paperSubjects,
    assignedAcademicSections: Array.isArray(paper?.assignedAcademicSections)
      ? paper.assignedAcademicSections.map((section: any) => ({
          _id: normalizeId(section?._id || section),
          name: String(section?.name || ""),
          class:
            section?.class
              ? {
                  _id: normalizeId(section.class?._id || section.class),
                  name: String(section.class?.name || ""),
                }
              : null,
        }))
      : [],
    sections: (Array.isArray(paper?.sections) ? paper.sections : []).map(
      (section: any) => ({
        name: String(section?.name || ""),
        description: String(section?.description || ""),
        instructions: String(section?.instructions || ""),
        defaultMarks: deriveSectionDefaultMarks(section, 1),
        defaultNegativeMarks: deriveSectionDefaultNegativeMarks(section, 0),
        marks: Number(section?.marks || 0),
        questions: (Array.isArray(section?.questions) ? section.questions : []).map(
          (entry: any) => {
            const question = entry?.question || {};
            const matrixOptions = Array.isArray(question?.matrixOptions)
              ? question.matrixOptions
              : [];
            return {
              question: {
                _id: normalizeId(question?._id || question),
                content: String(question?.content || ""),
                type: String(question?.type || ""),
                subject: question?.subject
                  ? {
                      _id: normalizeId(question.subject?._id || question.subject),
                      name: String(question.subject?.name || ""),
                    }
                  : null,
                options: Array.isArray(question?.options)
                  ? question.options.map((option: any) => ({
                      content: String(option?.content || ""),
                    }))
                  : [],
                matrixOptions: matrixOptions.map((option: any) => ({
                  left: String(option?.left || ""),
                  right: String(option?.right || ""),
                })),
                matrixRows: matrixOptions
                  .map((option: any) => String(option?.left || "").trim())
                  .filter(Boolean),
                matrixColumns: matrixOptions
                  .map((option: any) => String(option?.right || "").trim())
                  .filter(Boolean),
              },
              marks: Number(entry?.marks || 0),
              negativeMarks: Number(entry?.negativeMarks || 0),
            };
          },
        ),
      }),
    ),
  };
}

export function summarizeSanitizedPaperForStudent(paper: any) {
  const explicitSubjects = Array.isArray(paper?.subjects) ? paper.subjects : [];

  return {
    _id: String(paper?._id || ""),
    title: String(paper?.title || ""),
    duration: Number(paper?.duration || 0),
    passingMarks: Number(paper?.passingMarks || 0),
    totalMarks: Number(paper?.totalMarks || 0),
    examDate: paper?.examDate || null,
    onlineEnabled: Boolean(paper?.onlineEnabled),
    onlineStartsAt: paper?.onlineStartsAt || null,
    onlineEndsAt: paper?.onlineEndsAt || null,
    class: paper?.class
      ? {
          _id: normalizeId(paper.class?._id || paper.class),
          name: String(paper.class?.name || ""),
        }
      : null,
    subject: paper?.subject
      ? {
          _id: normalizeId(paper.subject?._id || paper.subject),
          name: String(paper.subject?.name || ""),
        }
      : null,
    subjects: explicitSubjects.map((subject: any) => ({
      _id: normalizeId(subject?._id || subject),
      name: String(subject?.name || ""),
    })),
    assignedAcademicSections: Array.isArray(paper?.assignedAcademicSections)
      ? paper.assignedAcademicSections.map((section: any) => ({
          _id: normalizeId(section?._id || section),
          name: String(section?.name || ""),
          class:
            section?.class
              ? {
                  _id: normalizeId(section.class?._id || section.class),
                  name: String(section.class?.name || ""),
                }
              : null,
        }))
      : [],
  };
}

export function deriveStudentTestStatus(paper: any, attempt: any, now = new Date()) {
  const nowMs = now.getTime();
  const windowStart = getPaperWindowStart(paper);
  const windowEnd = getPaperWindowEnd(paper);

  if (attempt?.status === "submitted" || attempt?.status === "auto_submitted") {
    return attempt.status;
  }

  if (attempt?.submittedAt) {
    return "submitted";
  }

  if (attempt) {
    const deadlineMs = getAttemptDeadlineMs(paper, attempt);
    if (deadlineMs !== null && nowMs > deadlineMs) {
      return "expired";
    }
    return "in_progress";
  }

  if (windowStart && nowMs < windowStart.getTime()) {
    return "upcoming";
  }

  if (windowEnd && nowMs > windowEnd.getTime()) {
    return "expired";
  }

  return "available";
}

export function getRemainingTimeMs(paper: any, attempt: any, now = new Date()) {
  const deadlineMs = getAttemptDeadlineMs(paper, attempt);
  if (deadlineMs === null) return null;
  return Math.max(0, deadlineMs - now.getTime());
}

export function shouldAutoSubmitAttempt(
  attempt: any,
  paper: any,
  now = new Date(),
) {
  if (!attempt) {
    return false;
  }

  if (
    attempt?.status === "submitted" ||
    attempt?.status === "auto_submitted" ||
    attempt?.submittedAt
  ) {
    return false;
  }

  const deadlineMs = getAttemptDeadlineMs(paper, attempt);
  return deadlineMs !== null && now.getTime() > deadlineMs;
}

export function serializeStudentAttempt(attempt: any) {
  if (!attempt) return null;

  return {
    _id: String(attempt?._id || ""),
    paper: normalizeId(attempt?.paper?._id || attempt?.paper),
    student: normalizeId(attempt?.student?._id || attempt?.student),
    startedAt: attempt?.startedAt || null,
    submittedAt: attempt?.submittedAt || null,
    status: String(attempt?.status || ""),
    lastSavedAt: attempt?.lastSavedAt || null,
    totalMarksAwarded:
      typeof attempt?.totalMarksAwarded === "number"
        ? attempt.totalMarksAwarded
        : 0,
    sectionAnswers: Array.isArray(attempt?.sectionAnswers)
      ? attempt.sectionAnswers
      : [],
  };
}

function redactScoringFromSectionAnswers(sectionAnswers: any) {
  if (!Array.isArray(sectionAnswers)) {
    return [];
  }

  return sectionAnswers.map((section: any) => ({
    ...section,
    answers: Array.isArray(section?.answers)
      ? section.answers.map((answer: any) => {
          const { marksAwarded: _marksAwarded, ...safeAnswer } = answer || {};
          return safeAnswer;
        })
      : [],
  }));
}

export function redactScoringFromSerializedAttempt(attempt: any) {
  if (!attempt) return null;

  return {
    ...attempt,
    totalMarksAwarded: null,
    sectionAnswers: redactScoringFromSectionAnswers(attempt.sectionAnswers),
  };
}

export function sanitizeSerializedAttemptForStudentDelivery(
  attempt: any,
  paper: any,
  now = new Date(),
) {
  if (!attempt) return null;
  if (isStudentResultReleasedForPaper(paper, now)) {
    return attempt;
  }
  return redactScoringFromSerializedAttempt(attempt);
}

export function sanitizeAttemptForStudentDelivery(
  attempt: any,
  paper: any,
  now = new Date(),
) {
  const serializedAttempt = serializeStudentAttempt(attempt);
  return sanitizeSerializedAttemptForStudentDelivery(
    serializedAttempt,
    paper,
    now,
  );
}

export function buildSectionAnswersSignature(sectionAnswers: any, paper?: any) {
  const normalizedInput = Array.isArray(sectionAnswers) ? sectionAnswers : [];

  if (!paper) {
    return JSON.stringify(normalizedInput);
  }

  const normalized = validateStudentSectionAnswers(normalizedInput, paper, {
    allowEmpty: true,
  });
  return JSON.stringify(normalized.ok ? normalized.sectionAnswers : []);
}

export async function findOrCreateStudentAttempt({
  QuestionPaperResponseModel,
  paperId,
  studentId,
  now = new Date(),
  lean = false,
}: {
  QuestionPaperResponseModel: any;
  paperId: string;
  studentId: string;
  now?: Date;
  lean?: boolean;
}) {
  const query = QuestionPaperResponseModel.findOneAndUpdate(
    {
      paper: paperId,
      student: studentId,
    },
    {
      $setOnInsert: {
        paper: paperId,
        student: studentId,
        startedAt: now,
        status: "in_progress",
        lastSavedAt: now,
        sectionAnswers: [],
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  return lean ? query.lean() : query;
}

function buildSubmittedAttemptUpdate({
  paper,
  sectionAnswers,
  autoSubmitted = false,
  submittedAt,
}: {
  paper: any;
  sectionAnswers: Array<{
    sectionName: string;
    answers: Array<{
      question: string;
      selectedOptions?: number[];
      matrixSelections?: number[][];
      answerText?: string;
    }>;
  }>;
  autoSubmitted?: boolean;
  submittedAt?: Date;
}) {
  const graded = gradeObjectiveSectionAnswers(sectionAnswers, paper);

  return {
    sectionAnswers: graded.sectionAnswers,
    totalMarksAwarded: graded.totalMarksAwarded,
    status: autoSubmitted ? "auto_submitted" : "submitted",
    submittedAt: submittedAt || new Date(),
    lastSavedAt: new Date(),
  };
}

export async function finalizeAttemptAsSubmitted({
  attempt,
  paper,
  sectionAnswers,
  autoSubmitted = false,
  submittedAt,
  QuestionPaperResponseModel,
}: {
  attempt: any;
  paper: any;
  sectionAnswers: Array<{
    sectionName: string;
    answers: Array<{
      question: string;
      selectedOptions?: number[];
      matrixSelections?: number[][];
      answerText?: string;
    }>;
  }>;
  autoSubmitted?: boolean;
  submittedAt?: Date;
  QuestionPaperResponseModel?: any;
}) {
  const update = buildSubmittedAttemptUpdate({
    paper,
    sectionAnswers,
    autoSubmitted,
    submittedAt,
  });

  if (QuestionPaperResponseModel && attempt?._id && typeof attempt?.save !== "function") {
    const updatedAttempt = await QuestionPaperResponseModel.findOneAndUpdate(
      {
        _id: attempt._id,
        status: { $nin: ["submitted", "auto_submitted"] },
      },
      { $set: update },
      { new: true },
    ).lean();

    if (updatedAttempt) {
      return updatedAttempt;
    }

    return QuestionPaperResponseModel.findById(attempt._id).lean();
  }

  if (attempt?.status === "submitted" || attempt?.status === "auto_submitted") {
    return attempt;
  }

  attempt.sectionAnswers = update.sectionAnswers;
  attempt.totalMarksAwarded = update.totalMarksAwarded;
  attempt.status = update.status;
  attempt.submittedAt = update.submittedAt;
  attempt.lastSavedAt = update.lastSavedAt;
  await attempt.save();

  return attempt;
}

export async function autoSubmitExpiredAttemptIfNeeded({
  attempt,
  paper,
  now = new Date(),
  QuestionPaperResponseModel,
}: {
  attempt: any;
  paper: any;
  now?: Date;
  QuestionPaperResponseModel?: any;
}) {
  if (!attempt) return null;
  if (!shouldAutoSubmitAttempt(attempt, paper, now)) {
    return attempt;
  }
  const deadlineMs = getAttemptDeadlineMs(paper, attempt);
  if (deadlineMs === null) return attempt;

  const normalized = validateStudentSectionAnswers(
    attempt?.sectionAnswers || [],
    paper,
    { allowEmpty: true },
  );
  const sectionAnswers = normalized.ok ? normalized.sectionAnswers : [];

  return finalizeAttemptAsSubmitted({
    attempt,
    paper,
    sectionAnswers,
    autoSubmitted: true,
    submittedAt: new Date(deadlineMs),
    QuestionPaperResponseModel,
  });
}

async function runTasksInBatches<T>(
  tasks: T[],
  maxConcurrency: number,
  handler: (task: T) => Promise<void>,
) {
  const safeBatchSize = Math.max(1, Math.floor(maxConcurrency));
  for (let index = 0; index < tasks.length; index += safeBatchSize) {
    const batch = tasks.slice(index, index + safeBatchSize);
    await Promise.all(batch.map((task) => handler(task)));
  }
}

export async function autoSubmitExpiredAttemptsForPapers({
  attemptsByPaperId,
  papers,
  now = new Date(),
  QuestionPaperResponseModel,
  maxConcurrency = 6,
}: {
  attemptsByPaperId: Map<string, any>;
  papers: any[];
  now?: Date;
  QuestionPaperResponseModel?: any;
  maxConcurrency?: number;
}) {
  if (!attemptsByPaperId.size || !Array.isArray(papers) || papers.length === 0) {
    return attemptsByPaperId;
  }

  const attemptsToAutoSubmit = papers
    .map((paper) => {
      const paperId = normalizeId(paper?._id || paper);
      if (!paperId) return null;

      const attempt = attemptsByPaperId.get(paperId);
      if (!attempt || !shouldAutoSubmitAttempt(attempt, paper, now)) {
        return null;
      }

      return { paperId, paper, attempt };
    })
    .filter(Boolean) as Array<{
    paperId: string;
    paper: any;
    attempt: any;
  }>;

  if (attemptsToAutoSubmit.length === 0) {
    return attemptsByPaperId;
  }

  await runTasksInBatches(
    attemptsToAutoSubmit,
    Math.min(maxConcurrency, attemptsToAutoSubmit.length),
    async ({ paperId, paper, attempt }) => {
      const nextAttempt = await autoSubmitExpiredAttemptIfNeeded({
        attempt,
        paper,
        now,
        QuestionPaperResponseModel,
      });
      attemptsByPaperId.set(paperId, nextAttempt || null);
    },
  );

  return attemptsByPaperId;
}
