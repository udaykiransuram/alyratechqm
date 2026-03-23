import {
  buildPaperQuestionLookup,
  gradeObjectiveSectionAnswers,
  hasAnyMatrixSelection,
  isOnlineQuestionType,
  validateStudentSectionAnswers,
} from "@/lib/question-paper/grading";

function normalizeId(value: unknown) {
  return String(value || "").trim();
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
  const lookup = buildPaperQuestionLookup(paper);
  if (lookup.size === 0) return false;

  return Array.from(lookup.values()).every((spec) => {
    if (!isOnlineQuestionType(spec.type)) return false;

    if (spec.type === "matrix-match") {
      return spec.matrixRowCount > 0 && spec.matrixColumnIndexes.size > 0;
    }

    return true;
  });
}

export function paperRequiresManualReview(paper: any) {
  const lookup = buildPaperQuestionLookup(paper);
  if (lookup.size === 0) return false;

  return Array.from(lookup.values()).some((spec) => spec.type === "descriptive");
}

export function isStudentEligibleForPaper(paper: any, student: any) {
  const studentClassId = normalizeId(student?.class?._id || student?.class);
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
    student?.academicSection?._id || student?.academicSection,
  );
  return Boolean(
    studentAcademicSectionId &&
      assignedAcademicSectionIds.has(studentAcademicSectionId),
  );
}

export function sanitizePaperForStudent(paper: any) {
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
    subject: paper?.subject
      ? {
          _id: normalizeId(paper.subject?._id || paper.subject),
          name: String(paper.subject?.name || ""),
        }
      : null,
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
    return QuestionPaperResponseModel.findOneAndUpdate(
      { _id: attempt._id },
      { $set: update },
      { new: true },
    ).lean();
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
  if (attempt?.status === "submitted" || attempt?.status === "auto_submitted") {
    return attempt;
  }

  const deadlineMs = getAttemptDeadlineMs(paper, attempt);
  if (deadlineMs === null || now.getTime() <= deadlineMs) {
    return attempt;
  }

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
