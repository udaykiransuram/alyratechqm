import "server-only";

import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { getTodayDiaryEntryDate, hasDiaryHtmlContent } from "@/lib/diary/shared";
import { sendWhatsAppText } from "@/lib/whatsapp/meta";
import { getSiteUrlOrFallback } from "@/lib/site-url";
import School from "@/models/School";

type RunParentUpdatesParams = {
  schoolKey?: string;
  date?: string;
  dryRun?: boolean;
};

type StudentAssessmentStats = {
  questionCount: number;
  correctCount: number;
  tagStats: Map<
    string,
    { attempts: number; correct: number; lastAttemptAt: Date | null; subjectId: string }
  >;
};

type StudentHomeworkStats = {
  assigned: number;
  completed: number;
};

type StudentLiveClassStats = {
  sessionsAssigned: number;
  sessionsAttended: number;
  sessionsMissed: number;
  pollsTotal: number;
  pollsAnswered: number;
  pollsCorrect: number;
};

type LiveClassPracticeCandidate = {
  studentId: string;
  tagId: string;
  classId: string;
  sectionId: string | null;
  subjectId: string | null;
};

const TAG_WEAKNESS_ACCURACY_THRESHOLD = 60;
const TAG_WEAKNESS_MIN_ATTEMPTS = 3;
const TAG_RECOVERY_ACCURACY_THRESHOLD = 80;
const PRACTICE_SET_QUESTION_COUNT = 8;
const PRACTICE_RESEND_DAYS = 7;
const TAG_PERFORMANCE_LOOKBACK_DAYS = 30;
const TAG_TREND_WINDOW_DAYS = 7;

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

function normalizeTagTypeName(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isSubskillTagTypeName(value: unknown) {
  const normalized = normalizeTagTypeName(value);
  return normalized === "subskill" || normalized === "subskills";
}

async function resolveSubskillTagIds(params: {
  schoolKey: string;
  tagIds: string[];
}) {
  if (!params.tagIds.length) {
    return new Set<string>();
  }

  const { Tag: TagModel } = await getTenantModels(params.schoolKey, [
    "Tag",
    "TagType",
  ]);

  const tags = await TagModel.find({ _id: { $in: params.tagIds } })
    .populate({ path: "type", select: "name" })
    .select("_id type")
    .lean();

  const subskillTagIds = new Set<string>();
  tags.forEach((tag: any) => {
    const typeName =
      typeof tag?.type === "object" ? tag?.type?.name : undefined;
    if (isSubskillTagTypeName(typeName)) {
      const tagId = normalizeId(tag?._id);
      if (tagId) {
        subskillTagIds.add(tagId);
      }
    }
  });

  return subskillTagIds;
}

function toPositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function getDayBounds(date: string) {
  const normalized = String(date || "").trim();
  const start = new Date(`${normalized}T00:00:00+05:30`);
  const end = new Date(`${normalized}T23:59:59.999+05:30`);
  return { start, end };
}

function formatAccuracy(correct: number, total: number) {
  if (!total) return null;
  return Math.max(0, Math.min(100, Math.round((correct / total) * 100)));
}

function formatNumber(value: number | null | undefined, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function normalizeIntegerIndexes(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry >= 0)
    .map((entry) => Math.trunc(entry));
}

function isObjectiveResponseCorrect(selected: number[], expected: number[]) {
  const left = [...selected].sort((a, b) => a - b);
  const right = [...expected].sort((a, b) => a - b);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function resolvePracticeExpiryDate() {
  const now = new Date();
  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
}

function buildDigestMessage(params: {
  studentName: string;
  topics: string[];
  assessmentCorrect: number;
  assessmentTotal: number;
  assessmentPct: number | null;
  homeworkAssigned: number;
  homeworkCompleted: number;
  liveSummaryLine?: string;
  nextFocus?: string;
  practiceTagName?: string;
  practiceLink?: string;
  includeWeeklySummary?: boolean;
  weeklyAccuracy?: number | null;
}) {
  const lines: string[] = [];
  if (params.topics.length > 0) {
    lines.push(`Today: ${params.topics.join(", ")}`);
  }

  if (params.assessmentTotal > 0) {
    const pct = params.assessmentPct ?? 0;
    lines.push(
      `Assessment: ${params.assessmentCorrect}/${params.assessmentTotal} correct (${pct}%).`,
    );
  }

  if (params.homeworkAssigned > 0) {
    lines.push(
      `Homework: ${params.homeworkCompleted}/${params.homeworkAssigned} completed.`,
    );
  }

  if (params.liveSummaryLine) {
    lines.push(params.liveSummaryLine);
  }

  if (params.nextFocus) {
    lines.push(`Next focus: ${params.nextFocus}.`);
  }

  if (params.includeWeeklySummary && params.weeklyAccuracy !== null) {
    lines.push(`Weekly recap: ${params.weeklyAccuracy}% average accuracy.`);
  }

  if (params.practiceTagName && params.practiceLink) {
    lines.push(`Practice: ${params.practiceTagName} → ${params.practiceLink}`);
  }

  return lines.join("\n").trim();
}

function resolveParentPhone(params: {
  phoneNumber?: string;
  phoneCountryCode?: string;
}) {
  const rawNumber = String(params.phoneNumber || "").replace(/\D+/g, "");
  if (!rawNumber) return "";

  const rawCountry = String(params.phoneCountryCode || "+91").trim();
  const countryDigits = rawCountry.replace(/\D+/g, "");
  if (rawNumber.startsWith(countryDigits)) {
    return rawNumber;
  }

  return `${countryDigits}${rawNumber}`;
}

async function fetchAssessmentStats(params: {
  schoolKey: string;
  studentIds: string[];
  start: Date;
  end: Date;
}) {
  const {
    QuestionPaperResponse: QuestionPaperResponseModel,
    Question: QuestionModel,
  } = await getTenantModels(params.schoolKey, [
    "QuestionPaperResponse",
    "Question",
  ]);

  const responses = await QuestionPaperResponseModel.find({
    student: { $in: params.studentIds },
    status: { $in: ["submitted", "auto_submitted"] },
    submittedAt: { $gte: params.start, $lte: params.end },
  })
    .select("student submittedAt sectionAnswers.answers.question sectionAnswers.answers.marksAwarded")
    .lean();

  const questionIds = new Set<string>();
  responses.forEach((response: any) => {
    (Array.isArray(response?.sectionAnswers) ? response.sectionAnswers : [])
      .flatMap((section: any) => section?.answers || [])
      .forEach((answer: any) => {
        const qid = normalizeId(answer?.question);
        if (qid) questionIds.add(qid);
      });
  });

  const questions = questionIds.size
    ? await QuestionModel.find({ _id: { $in: Array.from(questionIds) } })
        .select("marks tags subject class")
        .lean()
    : [];
  const questionById = new Map(
    questions.map((question: any) => [normalizeId(question?._id), question]),
  );

  const allTagIds = new Set<string>();
  questions.forEach((question: any) => {
    const tags = Array.isArray(question?.tags) ? question.tags : [];
    tags.forEach((tagId: any) => {
      const normalized = normalizeId(tagId);
      if (normalized) {
        allTagIds.add(normalized);
      }
    });
  });

  const subskillTagIds = await resolveSubskillTagIds({
    schoolKey: params.schoolKey,
    tagIds: Array.from(allTagIds),
  });

  const statsByStudent = new Map<string, StudentAssessmentStats>();

  responses.forEach((response: any) => {
    const studentId = normalizeId(response?.student);
    if (!studentId) return;
    if (!statsByStudent.has(studentId)) {
      statsByStudent.set(studentId, {
        questionCount: 0,
        correctCount: 0,
        tagStats: new Map(),
      });
    }

    const stats = statsByStudent.get(studentId)!;
    const submittedAt = response?.submittedAt
      ? new Date(response.submittedAt)
      : null;

    (Array.isArray(response?.sectionAnswers) ? response.sectionAnswers : [])
      .flatMap((section: any) => section?.answers || [])
      .forEach((answer: any) => {
        const questionId = normalizeId(answer?.question);
        const question = questionById.get(questionId);
        if (!question) return;

        const marks = formatNumber(question?.marks, 0);
        const awarded = formatNumber(answer?.marksAwarded, 0);
        stats.questionCount += 1;
        if (awarded >= marks && marks > 0) {
          stats.correctCount += 1;
        }

        const tagIds = Array.isArray(question?.tags)
          ? question.tags.map((tagId: any) => normalizeId(tagId)).filter(Boolean)
          : [];
        tagIds.forEach((tagId: string) => {
          if (!subskillTagIds.has(tagId)) {
            return;
          }
          if (!stats.tagStats.has(tagId)) {
            stats.tagStats.set(tagId, {
              attempts: 0,
              correct: 0,
              lastAttemptAt: null,
              subjectId: normalizeId(question?.subject),
            });
          }
          const tagStat = stats.tagStats.get(tagId)!;
          tagStat.attempts += 1;
          if (awarded >= marks && marks > 0) {
            tagStat.correct += 1;
          }
          if (submittedAt && (!tagStat.lastAttemptAt || submittedAt > tagStat.lastAttemptAt)) {
            tagStat.lastAttemptAt = submittedAt;
          }
        });
      });
  });

  return { statsByStudent, questionById };
}

async function fetchHomeworkStats(params: {
  schoolKey: string;
  date: string;
  students: Array<{ id: string; classId: string; sectionId: string | null }>;
}) {
  const { DiaryEntry: DiaryEntryModel, DiaryStudentState: DiaryStudentStateModel } =
    await getTenantModels(params.schoolKey, ["DiaryEntry", "DiaryStudentState"]);

  const entries = await DiaryEntryModel.find({
    entryDate: params.date,
  })
    .select("_id class assignedAcademicSections homeworkHtml")
    .lean();

  const entriesWithHomework = entries.filter((entry: any) =>
    hasDiaryHtmlContent(entry?.homeworkHtml),
  );
  const entryIds = entriesWithHomework.map((entry: any) => normalizeId(entry?._id));

  const states = entryIds.length
    ? await DiaryStudentStateModel.find({
        entry: { $in: entryIds },
        student: { $in: params.students.map((student) => student.id) },
      })
        .select("entry student status")
        .lean()
    : [];

  const statesByStudent = new Map<string, any[]>();
  states.forEach((state: any) => {
    const studentId = normalizeId(state?.student);
    if (!studentId) return;
    if (!statesByStudent.has(studentId)) {
      statesByStudent.set(studentId, []);
    }
    statesByStudent.get(studentId)!.push(state);
  });

  const entryIdsByScope = new Map<string, string[]>();
  entriesWithHomework.forEach((entry: any) => {
    const classId = normalizeId(entry?.class);
    const sections = Array.isArray(entry?.assignedAcademicSections)
      ? entry.assignedAcademicSections.map((section: any) => normalizeId(section)).filter(Boolean)
      : [];
    const key = `${classId}::${sections.sort().join(",")}`;
    if (!entryIdsByScope.has(key)) {
      entryIdsByScope.set(key, []);
    }
    entryIdsByScope.get(key)!.push(normalizeId(entry?._id));
  });

  const statsByStudent = new Map<string, StudentHomeworkStats>();

  params.students.forEach((student) => {
    const classId = normalizeId(student.classId);
    const sectionId = normalizeId(student.sectionId);
    const assignedEntryIds: string[] = [];
    entryIdsByScope.forEach((ids, key) => {
      const [entryClassId, sectionList] = key.split("::");
      if (entryClassId !== classId) return;
      if (!sectionList) {
        assignedEntryIds.push(...ids);
        return;
      }
      const sections = sectionList.split(",").filter(Boolean);
      if (sectionId && sections.includes(sectionId)) {
        assignedEntryIds.push(...ids);
      }
    });

    const uniqueEntryIds = Array.from(new Set(assignedEntryIds));
    const completedEntryIds = new Set(
      (statesByStudent.get(student.id) || [])
        .filter((state: any) => String(state?.status || "") === "completed")
        .map((state: any) => normalizeId(state?.entry)),
    );

    statsByStudent.set(student.id, {
      assigned: uniqueEntryIds.length,
      completed: uniqueEntryIds.filter((entryId) => completedEntryIds.has(entryId))
        .length,
    });
  });

  return statsByStudent;
}

async function computeLiveClassStatsForDate(params: {
  schoolKey: string;
  students: Array<{ id: string; classId: string; sectionId: string | null }>;
  start: Date;
  end: Date;
}) {
  const {
    LiveSession: LiveSessionModel,
    LiveSessionItem: LiveSessionItemModel,
    LiveSessionResponse: LiveSessionResponseModel,
    LiveSessionAttendance: LiveSessionAttendanceModel,
  } = await getTenantModels(params.schoolKey, [
    "LiveSession",
    "LiveSessionItem",
    "LiveSessionResponse",
    "LiveSessionAttendance",
  ]);

  const statsByStudent = new Map<string, StudentLiveClassStats>();
  const practiceCandidates = new Map<string, LiveClassPracticeCandidate>();

  const studentsByClassId = new Map<string, Array<{ id: string; sectionId: string | null }>>();
  params.students.forEach((student) => {
    if (!student.id || !student.classId) return;
    if (!studentsByClassId.has(student.classId)) {
      studentsByClassId.set(student.classId, []);
    }
    studentsByClassId.get(student.classId)?.push({
      id: student.id,
      sectionId: student.sectionId,
    });
    if (!statsByStudent.has(student.id)) {
      statsByStudent.set(student.id, {
        sessionsAssigned: 0,
        sessionsAttended: 0,
        sessionsMissed: 0,
        pollsTotal: 0,
        pollsAnswered: 0,
        pollsCorrect: 0,
      });
    }
  });

  const sessions = await LiveSessionModel.find({
    scheduledStartAt: { $gte: params.start, $lte: params.end },
    status: { $in: ["scheduled", "live", "completed"] },
  })
    .select("class assignedAcademicSections scheduledEndAt status subject")
    .lean();

  for (const session of sessions) {
    const classId = normalizeId(session?.class);
    if (!classId || !studentsByClassId.has(classId)) {
      continue;
    }

    const assignedSections = Array.isArray(session?.assignedAcademicSections)
      ? session.assignedAcademicSections.map((sectionId: any) => normalizeId(sectionId))
      : [];
    const sectionSet = new Set(assignedSections.filter(Boolean));
    const sessionStudents =
      sectionSet.size > 0
        ? (studentsByClassId.get(classId) || []).filter((student) =>
            student.sectionId ? sectionSet.has(student.sectionId) : false,
          )
        : studentsByClassId.get(classId) || [];

    if (sessionStudents.length === 0) {
      continue;
    }

    const sessionStudentIds = sessionStudents.map((student) => student.id);
    const subjectId = normalizeId(session?.subject) || null;
    const sessionEndedAt = session?.scheduledEndAt
      ? new Date(session.scheduledEndAt)
      : null;
    const isSessionCompleted =
      String(session?.status || "") === "completed" ||
      (sessionEndedAt instanceof Date && sessionEndedAt.getTime() <= params.end.getTime());

    const items = await LiveSessionItemModel.find({
      liveSession: session?._id,
      status: { $in: ["active", "closed"] },
    })
      .select("_id type answerIndexes tagIds")
      .lean();

    const itemIds = items.map((item: any) => normalizeId(item?._id)).filter(Boolean);
    const itemById = new Map(
      items.map((item: any) => [normalizeId(item?._id), item]),
    );

    const attendanceRows = await LiveSessionAttendanceModel.find({
      liveSession: session?._id,
      student: { $in: sessionStudentIds },
    })
      .select("student status")
      .lean();
    const attendanceByStudent = new Map(
      attendanceRows.map((row: any) => [
        normalizeId(row?.student),
        String(row?.status || "invited"),
      ]),
    );

    const responses = itemIds.length
      ? await LiveSessionResponseModel.find({
          liveSession: session?._id,
          item: { $in: itemIds },
          student: { $in: sessionStudentIds },
        })
          .select("student item itemType selectedOptionIndexes")
          .lean()
      : [];

    const responsesByStudent = new Map<string, any[]>();
    responses.forEach((response: any) => {
      const studentId = normalizeId(response?.student);
      if (!studentId) return;
      if (!responsesByStudent.has(studentId)) {
        responsesByStudent.set(studentId, []);
      }
      responsesByStudent.get(studentId)?.push(response);
    });

    const addCandidateTags = (
      student: { id: string; sectionId: string | null },
      tagIds: unknown[],
    ) => {
      tagIds.forEach((tagId) => {
        const normalized = normalizeId(tagId);
        if (!normalized) return;
        const key = `${student.id}::${normalized}`;
        if (practiceCandidates.has(key)) {
          return;
        }
        practiceCandidates.set(key, {
          studentId: student.id,
          tagId: normalized,
          classId,
          sectionId: student.sectionId,
          subjectId,
        });
      });
    };

    sessionStudents.forEach((student) => {
      const stats = statsByStudent.get(student.id);
      if (!stats) return;
      stats.sessionsAssigned += 1;

      const attendanceStatus = attendanceByStudent.get(student.id) || "invited";
      const attended =
        attendanceStatus === "present" || attendanceStatus === "joined";

      if (attended) {
        stats.sessionsAttended += 1;
      } else if (isSessionCompleted) {
        stats.sessionsMissed += 1;
      }

      if (items.length === 0) {
        return;
      }

      if (attended) {
        stats.pollsTotal += items.length;
      }

      const studentResponses = responsesByStudent.get(student.id) || [];
      const answeredItemIds = new Set(
        studentResponses.map((response) => normalizeId(response?.item)).filter(Boolean),
      );

      if (attended) {
        stats.pollsAnswered += studentResponses.length;
      }

      const incorrectItemIds = new Set<string>();
      studentResponses.forEach((response: any) => {
        const itemId = normalizeId(response?.item);
        const item = itemById.get(itemId);
        if (!item) return;
        if (String(item?.type || "") === "short-text") {
          return;
        }
        const selected = normalizeIntegerIndexes(response?.selectedOptionIndexes);
        const expected = normalizeIntegerIndexes(item?.answerIndexes);
        if (!isObjectiveResponseCorrect(selected, expected)) {
          incorrectItemIds.add(itemId);
        } else if (attended) {
          stats.pollsCorrect += 1;
        }
      });

      if (!attended && isSessionCompleted) {
        items.forEach((item: any) => {
          if (Array.isArray(item?.tagIds) && item.tagIds.length > 0) {
            addCandidateTags(student, item.tagIds);
          }
        });
        return;
      }

      if (!attended) {
        return;
      }

      items.forEach((item: any) => {
        const itemId = normalizeId(item?._id);
        if (!itemId) return;
        const tagIds = Array.isArray(item?.tagIds) ? item.tagIds : [];
        if (tagIds.length === 0) return;

        if (!answeredItemIds.has(itemId)) {
          addCandidateTags(student, tagIds);
          return;
        }

        if (incorrectItemIds.has(itemId)) {
          addCandidateTags(student, tagIds);
        }
      });
    });
  }

  return { statsByStudent, practiceCandidates };
}

async function rebuildTagPerformanceForSchool(params: {
  schoolKey: string;
  studentIds: string[];
}) {
  const {
    QuestionPaperResponse: QuestionPaperResponseModel,
    Question: QuestionModel,
    StudentTagPerformance: StudentTagPerformanceModel,
    TagPeerStats: TagPeerStatsModel,
    User: UserModel,
  } = await getTenantModels(params.schoolKey, [
    "QuestionPaperResponse",
    "Question",
    "StudentTagPerformance",
    "TagPeerStats",
    "User",
  ]);

  const now = new Date();
  const lookbackStart = new Date(
    now.getTime() - TAG_PERFORMANCE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );
  const trendCutoff = new Date(
    now.getTime() - TAG_TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  const trendPrevCutoff = new Date(
    now.getTime() - TAG_TREND_WINDOW_DAYS * 2 * 24 * 60 * 60 * 1000,
  );

  const responses = await QuestionPaperResponseModel.find({
    student: { $in: params.studentIds },
    status: { $in: ["submitted", "auto_submitted"] },
    submittedAt: { $gte: lookbackStart },
  })
    .select("student submittedAt sectionAnswers.answers.question sectionAnswers.answers.marksAwarded")
    .lean();

  const questionIds = new Set<string>();
  const studentIds = new Set<string>();
  responses.forEach((response: any) => {
    const studentId = normalizeId(response?.student);
    if (studentId) studentIds.add(studentId);
    (Array.isArray(response?.sectionAnswers) ? response.sectionAnswers : [])
      .flatMap((section: any) => section?.answers || [])
      .forEach((answer: any) => {
        const qid = normalizeId(answer?.question);
        if (qid) questionIds.add(qid);
      });
  });

  const [questions, students] = await Promise.all([
    questionIds.size
      ? QuestionModel.find({ _id: { $in: Array.from(questionIds) } })
          .select("marks tags subject class")
          .lean()
      : Promise.resolve([]),
    studentIds.size
      ? UserModel.find({ _id: { $in: Array.from(studentIds) } })
          .select("class academicSection")
          .lean()
      : Promise.resolve([]),
  ]);

  const questionById = new Map(
    questions.map((question: any) => [normalizeId(question?._id), question]),
  );
  const studentById = new Map(
    students.map((student: any) => [normalizeId(student?._id), student]),
  );

  const allTagIds = new Set<string>();
  questions.forEach((question: any) => {
    const tags = Array.isArray(question?.tags) ? question.tags : [];
    tags.forEach((tagId: any) => {
      const normalized = normalizeId(tagId);
      if (normalized) {
        allTagIds.add(normalized);
      }
    });
  });

  const subskillTagIds = await resolveSubskillTagIds({
    schoolKey: params.schoolKey,
    tagIds: Array.from(allTagIds),
  });

  const performanceByStudentTag = new Map<
    string,
    {
      studentId: string;
      classId: string;
      sectionId: string | null;
      subjectId: string | null;
      tagId: string;
      attempts: number;
      correct: number;
      lastAttemptAt: Date | null;
      trendAttempts: number;
      trendCorrect: number;
      prevAttempts: number;
      prevCorrect: number;
    }
  >();

  const updatePerformance = (
    studentId: string,
    tagId: string,
    question: any,
    awarded: number,
    marks: number,
    submittedAt: Date,
  ) => {
    const student = studentById.get(studentId);
    if (!student) return;
    const key = `${studentId}::${tagId}`;
    if (!performanceByStudentTag.has(key)) {
      performanceByStudentTag.set(key, {
        studentId,
        classId: normalizeId(student?.class),
        sectionId: normalizeId(student?.academicSection) || null,
        subjectId: normalizeId(question?.subject) || null,
        tagId,
        attempts: 0,
        correct: 0,
        lastAttemptAt: null,
        trendAttempts: 0,
        trendCorrect: 0,
        prevAttempts: 0,
        prevCorrect: 0,
      });
    }
    const entry = performanceByStudentTag.get(key)!;
    entry.attempts += 1;
    if (awarded >= marks && marks > 0) {
      entry.correct += 1;
    }
    if (!entry.lastAttemptAt || submittedAt > entry.lastAttemptAt) {
      entry.lastAttemptAt = submittedAt;
    }
    if (submittedAt >= trendCutoff) {
      entry.trendAttempts += 1;
      if (awarded >= marks && marks > 0) {
        entry.trendCorrect += 1;
      }
    } else if (submittedAt >= trendPrevCutoff) {
      entry.prevAttempts += 1;
      if (awarded >= marks && marks > 0) {
        entry.prevCorrect += 1;
      }
    }
  };

  responses.forEach((response: any) => {
    const studentId = normalizeId(response?.student);
    if (!studentId) return;
    const submittedAt = response?.submittedAt
      ? new Date(response.submittedAt)
      : null;
    if (!submittedAt) return;
    (Array.isArray(response?.sectionAnswers) ? response.sectionAnswers : [])
      .flatMap((section: any) => section?.answers || [])
      .forEach((answer: any) => {
        const questionId = normalizeId(answer?.question);
        const question = questionById.get(questionId);
        if (!question) return;
        const marks = formatNumber(question?.marks, 0);
        const awarded = formatNumber(answer?.marksAwarded, 0);
        const tagIds = Array.isArray(question?.tags)
          ? question.tags.map((tagId: any) => normalizeId(tagId)).filter(Boolean)
          : [];
        tagIds.forEach((tagId) => {
          if (!subskillTagIds.has(tagId)) {
            return;
          }
          updatePerformance(studentId, tagId, question, awarded, marks, submittedAt);
        });
      });
  });

  const performanceRows = Array.from(performanceByStudentTag.values());

  if (performanceRows.length === 0) {
    return;
  }

  await StudentTagPerformanceModel.bulkWrite(
    performanceRows.map((row) => {
      const accuracyPct = formatAccuracy(row.correct, row.attempts) ?? 0;
      const trendAccuracy = formatAccuracy(row.trendCorrect, row.trendAttempts) ?? 0;
      const prevAccuracy = formatAccuracy(row.prevCorrect, row.prevAttempts) ?? 0;
      const trendDelta = row.prevAttempts > 0 ? trendAccuracy - prevAccuracy : 0;
      return {
        updateOne: {
          filter: { student: row.studentId, tag: row.tagId },
          update: {
            $set: {
              student: row.studentId,
              class: row.classId,
              academicSection: row.sectionId || null,
              subject: row.subjectId || null,
              tag: row.tagId,
              attemptCount: row.attempts,
              questionCount: row.attempts,
              accuracyPct,
              trendDelta,
              lastAttemptAt: row.lastAttemptAt,
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      };
    }),
    { ordered: false },
  );

  const performanceDocs = await StudentTagPerformanceModel.find({
    student: { $in: params.studentIds },
  })
    .select("student class academicSection tag accuracyPct subject")
    .lean();

  const groupMap = new Map<
    string,
    { classId: string; sectionId: string | null; tagId: string; subjectId: string | null; rows: any[] }
  >();

  performanceDocs.forEach((row: any) => {
    const classId = normalizeId(row?.class);
    const sectionId = normalizeId(row?.academicSection) || null;
    const tagId = normalizeId(row?.tag);
    if (!classId || !tagId) return;
    const subjectId = normalizeId(row?.subject) || null;
    const key = `${classId}::${sectionId || "all"}::${tagId}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { classId, sectionId, tagId, subjectId, rows: [] });
    }
    groupMap.get(key)!.rows.push(row);
  });

  const peerStatsWrites = [];
  const performanceUpdates = [];

  const computePercentile = (values: number[], value: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = sorted.findIndex((item) => item >= value);
    const rank = index === -1 ? sorted.length : index + 1;
    return Math.round((rank / sorted.length) * 100);
  };

  groupMap.forEach((group) => {
    const accuracies = group.rows
      .map((row) => formatNumber(row?.accuracyPct, 0))
      .sort((a, b) => a - b);
    const count = accuracies.length;
    const median = count ? accuracies[Math.floor((count - 1) / 2)] : 0;
    const p25 = count ? accuracies[Math.floor((count - 1) * 0.25)] : 0;
    const p75 = count ? accuracies[Math.floor((count - 1) * 0.75)] : 0;
    const min = count ? accuracies[0] : 0;
    const max = count ? accuracies[count - 1] : 0;

    peerStatsWrites.push({
      updateOne: {
        filter: {
          class: group.classId,
          academicSection: group.sectionId || null,
          tag: group.tagId,
        },
        update: {
          $set: {
            class: group.classId,
            academicSection: group.sectionId || null,
            subject: group.subjectId || null,
            tag: group.tagId,
            studentCount: count,
            medianAccuracy: median,
            p25Accuracy: p25,
            p75Accuracy: p75,
            minAccuracy: min,
            maxAccuracy: max,
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    });

    group.rows.forEach((row: any) => {
      const accuracy = formatNumber(row?.accuracyPct, 0);
      performanceUpdates.push({
        updateOne: {
          filter: { _id: row._id },
          update: {
            $set: {
              percentile: computePercentile(accuracies, accuracy),
              peerMedianAccuracy: median,
            },
          },
        },
      });
    });
  });

  if (peerStatsWrites.length > 0) {
    await TagPeerStatsModel.bulkWrite(peerStatsWrites, { ordered: false });
  }
  if (performanceUpdates.length > 0) {
    await StudentTagPerformanceModel.bulkWrite(performanceUpdates, { ordered: false });
  }
}

async function updateWeaknessAndPracticeSets(params: {
  schoolKey: string;
  students: Array<{ id: string; classId: string; sectionId: string | null }>;
}) {
  const {
    StudentTagPerformance: StudentTagPerformanceModel,
    StudentTagWeakness: StudentTagWeaknessModel,
    TagPracticeSet: TagPracticeSetModel,
    Question: QuestionModel,
    QuestionPaper: QuestionPaperModel,
    User: UserModel,
    Tag: TagModel,
  } = await getTenantModels(params.schoolKey, [
    "StudentTagPerformance",
    "StudentTagWeakness",
    "TagPracticeSet",
    "Question",
    "QuestionPaper",
    "User",
    "Tag",
  ]);

  const performances = await StudentTagPerformanceModel.find({
    student: { $in: params.students.map((student) => student.id) },
  })
    .select("student class academicSection subject tag accuracyPct attemptCount")
    .lean();

  const performanceTagIds = Array.from(
    new Set(
      performances
        .map((row: any) => normalizeId(row?.tag))
        .filter(Boolean),
    ),
  );
  const subskillTagIds = await resolveSubskillTagIds({
    schoolKey: params.schoolKey,
    tagIds: performanceTagIds,
  });

  const filteredPerformances = performances.filter((row: any) =>
    subskillTagIds.has(normalizeId(row?.tag)),
  );

  const now = new Date();
  const practiceResendCutoff = new Date(
    now.getTime() - PRACTICE_RESEND_DAYS * 24 * 60 * 60 * 1000,
  );

  const weaknessWrites = [];
  const practiceSetsToCreate: Array<{
    studentId: string;
    tagId: string;
    classId: string;
    sectionId: string | null;
    subjectId: string | null;
  }> = [];

  filteredPerformances.forEach((row: any) => {
    const studentId = normalizeId(row?.student);
    const tagId = normalizeId(row?.tag);
    if (!studentId || !tagId) return;
    const accuracy = formatNumber(row?.accuracyPct, 0);
    const attempts = formatNumber(row?.attemptCount, 0);
    const incorrect = attempts - Math.round((accuracy / 100) * attempts);
    const isWeak =
      attempts >= TAG_WEAKNESS_MIN_ATTEMPTS &&
      (accuracy < TAG_WEAKNESS_ACCURACY_THRESHOLD || incorrect >= 3);
    const status = isWeak ? "active" : "resolved";
    weaknessWrites.push({
      updateOne: {
        filter: { student: studentId, tag: tagId },
        update: {
          $set: {
            student: studentId,
            class: normalizeId(row?.class),
            academicSection: normalizeId(row?.academicSection) || null,
            subject: normalizeId(row?.subject) || null,
            tag: tagId,
            weaknessScore: Math.max(0, 100 - accuracy),
            accuracyPct: accuracy,
            attemptCount: attempts,
            status,
            lastDetectedAt: isWeak ? now : undefined,
          },
          $setOnInsert: {
            lastSentAt: null,
          },
        },
        upsert: true,
      },
    });
  });

  if (weaknessWrites.length > 0) {
    await StudentTagWeaknessModel.bulkWrite(weaknessWrites, { ordered: false });
  }

  const activeWeaknesses = await StudentTagWeaknessModel.find({
    student: { $in: params.students.map((student) => student.id) },
    status: "active",
  })
    .select("student tag class academicSection subject lastSentAt")
    .lean();

  const filteredActiveWeaknesses = activeWeaknesses.filter((weakness: any) =>
    subskillTagIds.has(normalizeId(weakness?.tag)),
  );

  const practiceSets = await TagPracticeSetModel.find({
    student: { $in: params.students.map((student) => student.id) },
    status: { $in: ["assigned", "started"] },
  })
    .select("student tag questionPaper status")
    .lean();

  const activeSetKey = new Set(
    practiceSets.map((set: any) => `${normalizeId(set?.student)}::${normalizeId(set?.tag)}`),
  );

  filteredActiveWeaknesses.forEach((weakness: any) => {
    const studentId = normalizeId(weakness?.student);
    const tagId = normalizeId(weakness?.tag);
    if (!studentId || !tagId) return;
    if (activeSetKey.has(`${studentId}::${tagId}`)) return;
    const lastSentAt = weakness?.lastSentAt ? new Date(weakness.lastSentAt) : null;
    if (lastSentAt && lastSentAt > practiceResendCutoff) return;
    practiceSetsToCreate.push({
      studentId,
      tagId,
      classId: normalizeId(weakness?.class),
      sectionId: normalizeId(weakness?.academicSection) || null,
      subjectId: normalizeId(weakness?.subject) || null,
    });
  });

  if (practiceSetsToCreate.length === 0) {
    return { practiceLinkByStudentTag: new Map<string, string>(), tagNameById: new Map<string, string>() };
  }

  const tagIds = Array.from(new Set(practiceSetsToCreate.map((item) => item.tagId)));
  const tags = await TagModel.find({ _id: { $in: tagIds } })
    .select("name")
    .lean();
  const tagNameById = new Map(tags.map((tag: any) => [normalizeId(tag?._id), String(tag?.name || "").trim()]));

  const adminUser = await UserModel.findOne({ role: "admin" })
    .select("_id")
    .lean();
  const createdBy = normalizeId(adminUser?._id);

  const practiceLinkByStudentTag = new Map<string, string>();

  for (const item of practiceSetsToCreate) {
    const questionCandidates = await QuestionModel.find({
      tags: item.tagId,
      class: item.classId,
      ...(item.subjectId ? { subject: item.subjectId } : {}),
    })
      .select("_id marks subject class")
      .limit(PRACTICE_SET_QUESTION_COUNT * 3)
      .lean();

    if (questionCandidates.length === 0 || !createdBy) {
      continue;
    }

    const selectedQuestions = questionCandidates.slice(0, PRACTICE_SET_QUESTION_COUNT);
    const totalMarks = selectedQuestions.reduce(
      (sum: number, question: any) => sum + formatNumber(question?.marks, 0),
      0,
    );
    const nowDate = new Date();
    const paper = await QuestionPaperModel.create({
      title: `Practice: ${tagNameById.get(item.tagId) || "Skill"}`,
      class: item.classId,
      subject: item.subjectId || undefined,
      subjectIds: item.subjectId ? [item.subjectId] : [],
      duration: 30,
      passingMarks: 0,
      examDate: nowDate,
      onlineEnabled: true,
      onlineStartsAt: nowDate,
      onlineEndsAt: resolvePracticeExpiryDate(),
      totalMarks,
      sections: [
        {
          name: "Practice Set",
          description: "",
          instructions: "Solve these questions to strengthen this sub-skill.",
          marks: totalMarks,
          defaultMarks: 0,
          defaultNegativeMarks: 0,
          questions: selectedQuestions.map((question: any) => ({
            question: question._id,
            marks: formatNumber(question?.marks, 0),
            negativeMarks: 0,
          })),
        },
      ],
      assignedAcademicSections: item.sectionId ? [item.sectionId] : [],
      createdBy,
      isPracticeSet: true,
      practiceStudent: item.studentId,
      practiceTag: item.tagId,
    });

    await TagPracticeSetModel.create({
      student: item.studentId,
      tag: item.tagId,
      questionPaper: paper._id,
      status: "assigned",
      assignedAt: nowDate,
    });

    await StudentTagWeaknessModel.updateOne(
      { student: item.studentId, tag: item.tagId },
      { $set: { lastSentAt: nowDate } },
    );

    practiceLinkByStudentTag.set(
      `${item.studentId}::${item.tagId}`,
      `/student/tests/${normalizeId(paper._id)}`,
    );
  }

  return { practiceLinkByStudentTag, tagNameById };
}

async function createPracticeSetsForStudentTags(params: {
  schoolKey: string;
  candidates: LiveClassPracticeCandidate[];
}) {
  if (params.candidates.length === 0) {
    return {
      practiceLinkByStudentTag: new Map<string, string>(),
      tagNameById: new Map<string, string>(),
    };
  }

  const {
    TagPracticeSet: TagPracticeSetModel,
    Question: QuestionModel,
    QuestionPaper: QuestionPaperModel,
    User: UserModel,
    Tag: TagModel,
  } = await getTenantModels(params.schoolKey, [
    "TagPracticeSet",
    "Question",
    "QuestionPaper",
    "User",
    "Tag",
  ]);

  const uniqueCandidates = new Map<string, LiveClassPracticeCandidate>();
  params.candidates.forEach((candidate) => {
    const studentId = normalizeId(candidate.studentId);
    const tagId = normalizeId(candidate.tagId);
    if (!studentId || !tagId) return;
    const key = `${studentId}::${tagId}`;
    if (!uniqueCandidates.has(key)) {
      uniqueCandidates.set(key, {
        studentId,
        tagId,
        classId: normalizeId(candidate.classId),
        sectionId: normalizeId(candidate.sectionId) || null,
        subjectId: normalizeId(candidate.subjectId) || null,
      });
    }
  });

  const candidateList = Array.from(uniqueCandidates.values());
  const tagIds = Array.from(new Set(candidateList.map((item) => item.tagId)));
  const subskillTagIds = await resolveSubskillTagIds({
    schoolKey: params.schoolKey,
    tagIds,
  });

  const filteredCandidates = candidateList.filter((item) =>
    subskillTagIds.has(item.tagId),
  );

  if (filteredCandidates.length === 0) {
    return {
      practiceLinkByStudentTag: new Map<string, string>(),
      tagNameById: new Map<string, string>(),
    };
  }

  const practiceResendCutoff = new Date(
    new Date().getTime() - PRACTICE_RESEND_DAYS * 24 * 60 * 60 * 1000,
  );

  const studentIds = Array.from(new Set(filteredCandidates.map((item) => item.studentId)));

  const existingSets = await TagPracticeSetModel.find({
    student: { $in: studentIds },
    tag: { $in: tagIds },
  })
    .select("student tag status assignedAt")
    .lean();

  const blockedKeys = new Set<string>();
  existingSets.forEach((set: any) => {
    const key = `${normalizeId(set?.student)}::${normalizeId(set?.tag)}`;
    if (!key || blockedKeys.has(key)) return;
    const status = String(set?.status || "");
    const assignedAt = set?.assignedAt ? new Date(set.assignedAt) : null;
    if (status === "assigned" || status === "started") {
      blockedKeys.add(key);
      return;
    }
    if (assignedAt && assignedAt > practiceResendCutoff) {
      blockedKeys.add(key);
    }
  });

  const candidatesByStudent = new Map<string, LiveClassPracticeCandidate[]>();
  filteredCandidates.forEach((candidate) => {
    if (blockedKeys.has(`${candidate.studentId}::${candidate.tagId}`)) return;
    if (!candidatesByStudent.has(candidate.studentId)) {
      candidatesByStudent.set(candidate.studentId, []);
    }
    candidatesByStudent.get(candidate.studentId)?.push(candidate);
  });

  const limitedCandidates = Array.from(candidatesByStudent.entries()).flatMap(
    ([studentId, items]) => items.slice(0, 2),
  );

  if (limitedCandidates.length === 0) {
    return {
      practiceLinkByStudentTag: new Map<string, string>(),
      tagNameById: new Map<string, string>(),
    };
  }

  const tags = await TagModel.find({ _id: { $in: tagIds } })
    .select("name")
    .lean();
  const tagNameById = new Map(
    tags.map((tag: any) => [normalizeId(tag?._id), String(tag?.name || "").trim()]),
  );

  const adminUser = await UserModel.findOne({ role: "admin" })
    .select("_id")
    .lean();
  const createdBy = normalizeId(adminUser?._id);

  const practiceLinkByStudentTag = new Map<string, string>();

  for (const item of limitedCandidates) {
    if (!item.classId || !item.tagId || !createdBy) {
      continue;
    }

    const questionCandidates = await QuestionModel.find({
      tags: item.tagId,
      class: item.classId,
      ...(item.subjectId ? { subject: item.subjectId } : {}),
    })
      .select("_id marks subject class")
      .limit(PRACTICE_SET_QUESTION_COUNT * 3)
      .lean();

    if (questionCandidates.length === 0) {
      continue;
    }

    const selectedQuestions = questionCandidates.slice(0, PRACTICE_SET_QUESTION_COUNT);
    const totalMarks = selectedQuestions.reduce(
      (sum: number, question: any) => sum + formatNumber(question?.marks, 0),
      0,
    );
    const nowDate = new Date();
    const paper = await QuestionPaperModel.create({
      title: `Practice: ${tagNameById.get(item.tagId) || "Skill"}`,
      class: item.classId,
      subject: item.subjectId || undefined,
      subjectIds: item.subjectId ? [item.subjectId] : [],
      duration: 30,
      passingMarks: 0,
      examDate: nowDate,
      onlineEnabled: true,
      onlineStartsAt: nowDate,
      onlineEndsAt: resolvePracticeExpiryDate(),
      totalMarks,
      sections: [
        {
          name: "Practice Set",
          description: "",
          instructions: "Solve these questions to strengthen this sub-skill.",
          marks: totalMarks,
          defaultMarks: 0,
          defaultNegativeMarks: 0,
          questions: selectedQuestions.map((question: any) => ({
            question: question._id,
            marks: formatNumber(question?.marks, 0),
            negativeMarks: 0,
          })),
        },
      ],
      assignedAcademicSections: item.sectionId ? [item.sectionId] : [],
      createdBy,
      isPracticeSet: true,
      practiceStudent: item.studentId,
      practiceTag: item.tagId,
    });

    await TagPracticeSetModel.create({
      student: item.studentId,
      tag: item.tagId,
      questionPaper: paper._id,
      status: "assigned",
      assignedAt: nowDate,
    });

    practiceLinkByStudentTag.set(
      `${item.studentId}::${item.tagId}`,
      `/student/tests/${normalizeId(paper._id)}`,
    );
  }

  return { practiceLinkByStudentTag, tagNameById };
}

export async function runParentUpdatesForSchool(params: {
  schoolKey: string;
  date?: string;
  dryRun?: boolean;
}) {
  await connectDB();
  const date = params.date || getTodayDiaryEntryDate();
  const { start, end } = getDayBounds(date);

  const {
    ParentContact: ParentContactModel,
    StudentDailyProgress: StudentDailyProgressModel,
    StudentTagWeakness: StudentTagWeaknessModel,
    Tag: TagModel,
    User: UserModel,
  } = await getTenantModels(params.schoolKey, [
    "ParentContact",
    "StudentDailyProgress",
    "StudentTagWeakness",
    "Tag",
    "User",
  ]);

  const students = await UserModel.find({
    role: "student",
  })
    .select("name class academicSection")
    .lean();

  if (students.length === 0) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0 };
  }

  const studentIds = students.map((student: any) => normalizeId(student?._id));
  const studentById = new Map(
    students.map((student: any) => [normalizeId(student?._id), student]),
  );

  const contacts = await ParentContactModel.find({
    student: { $in: studentIds },
    whatsappOptIn: true,
  })
    .select("student whatsappOptIn preferredLanguage parentName relationship")
    .lean();

  const contactByStudentId = new Map(
    contacts.map((contact: any) => [normalizeId(contact?.student), contact]),
  );

  const { statsByStudent } = await fetchAssessmentStats({
    schoolKey: params.schoolKey,
    studentIds,
    start,
    end,
  });

  const homeworkStats = await fetchHomeworkStats({
    schoolKey: params.schoolKey,
    date,
    students: students.map((student: any) => ({
      id: normalizeId(student?._id),
      classId: normalizeId(student?.class),
      sectionId: normalizeId(student?.academicSection) || null,
    })),
  });

  const { statsByStudent: liveStatsByStudent, practiceCandidates } =
    await computeLiveClassStatsForDate({
      schoolKey: params.schoolKey,
      students: students.map((student: any) => ({
        id: normalizeId(student?._id),
        classId: normalizeId(student?.class),
        sectionId: normalizeId(student?.academicSection) || null,
      })),
      start,
      end,
    });

  const assessmentTagIds = Array.from(statsByStudent.values()).flatMap((stats) =>
    Array.from(stats.tagStats.keys()),
  );
  const uniqueAssessmentTagIds = Array.from(new Set(assessmentTagIds));

  const assessmentTags = uniqueAssessmentTagIds.length
    ? await TagModel.find({ _id: { $in: uniqueAssessmentTagIds } })
        .select("name")
        .lean()
    : [];
  const assessmentTagNameById = new Map(
    assessmentTags.map((tag: any) => [normalizeId(tag?._id), String(tag?.name || "").trim()]),
  );

  await rebuildTagPerformanceForSchool({
    schoolKey: params.schoolKey,
    studentIds,
  });

  const { practiceLinkByStudentTag, tagNameById } = await updateWeaknessAndPracticeSets({
    schoolKey: params.schoolKey,
    students: students.map((student: any) => ({
      id: normalizeId(student?._id),
      classId: normalizeId(student?.class),
      sectionId: normalizeId(student?.academicSection) || null,
    })),
  });

  const {
    practiceLinkByStudentTag: livePracticeLinkByStudentTag,
    tagNameById: livePracticeTagNameById,
  } = await createPracticeSetsForStudentTags({
    schoolKey: params.schoolKey,
    candidates: Array.from(practiceCandidates.values()),
  });

  const weaknessByStudent = await StudentTagWeaknessModel.find({
    student: { $in: studentIds },
    status: "active",
  })
    .select("student tag")
    .lean();

  const weaknessTagIds = Array.from(
    new Set(weaknessByStudent.map((row: any) => normalizeId(row?.tag)).filter(Boolean)),
  );
  const subskillWeakTagIds = await resolveSubskillTagIds({
    schoolKey: params.schoolKey,
    tagIds: weaknessTagIds,
  });

  const activeWeakTagByStudent = new Map<string, string>();
  weaknessByStudent.forEach((row: any) => {
    const studentId = normalizeId(row?.student);
    const tagId = normalizeId(row?.tag);
    if (
      !studentId ||
      !tagId ||
      !subskillWeakTagIds.has(tagId) ||
      activeWeakTagByStudent.has(studentId)
    ) {
      return;
    }
    activeWeakTagByStudent.set(studentId, tagId);
  });

  const tagIds = Array.from(new Set(activeWeakTagByStudent.values()));
  const tagRows = tagIds.length
    ? await TagModel.find({ _id: { $in: tagIds } }).select("name").lean()
    : [];
  tagRows.forEach((row: any) => {
    tagNameById.set(normalizeId(row?._id), String(row?.name || "").trim());
  });

  assessmentTagNameById.forEach((name, tagId) => {
    if (!tagNameById.has(tagId)) {
      tagNameById.set(tagId, name);
    }
  });

  livePracticeTagNameById.forEach((name, tagId) => {
    if (!tagNameById.has(tagId)) {
      tagNameById.set(tagId, name);
    }
  });

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const weeklySummaryDay =
    new Date(`${date}T12:00:00+05:30`).getDay() === 6;

  for (const studentId of studentIds) {
    const student = studentById.get(studentId);
    const contact = contactByStudentId.get(studentId);
    if (!student) continue;

    const assessmentStats = statsByStudent.get(studentId) || {
      questionCount: 0,
      correctCount: 0,
      tagStats: new Map(),
    };
    const assessmentPct =
      formatAccuracy(assessmentStats.correctCount, assessmentStats.questionCount);

    const homework = homeworkStats.get(studentId) || { assigned: 0, completed: 0 };

    const liveStats = liveStatsByStudent.get(studentId) || {
      sessionsAssigned: 0,
      sessionsAttended: 0,
      sessionsMissed: 0,
      pollsTotal: 0,
      pollsAnswered: 0,
      pollsCorrect: 0,
    };
    const liveAttentionPct =
      liveStats.pollsTotal > 0
        ? Math.round((liveStats.pollsAnswered / liveStats.pollsTotal) * 100)
        : null;
    const liveSummaryLine =
      liveStats.sessionsAssigned > 0
        ? liveStats.sessionsMissed > 0
          ? `Live class: missed ${liveStats.sessionsMissed}/${liveStats.sessionsAssigned}.`
          : liveStats.sessionsAttended > 0
            ? `Live class: attended ${liveStats.sessionsAttended}/${liveStats.sessionsAssigned} • ${
                liveAttentionPct !== null ? `${liveAttentionPct}% attention` : "Attention —"
              }.`
            : `Live class: ${liveStats.sessionsAssigned} scheduled.`
        : "";

    const topics = Array.from(assessmentStats.tagStats.entries())
      .sort((left, right) => right[1].attempts - left[1].attempts)
      .slice(0, 2)
      .map(([tagId]) => tagNameById.get(tagId) || "")
      .filter(Boolean);

    const weakTagId = activeWeakTagByStudent.get(studentId) || "";
    const weakTagName = weakTagId ? tagNameById.get(weakTagId) || "" : "";
    const baseUrl = getSiteUrlOrFallback();
    const practiceRelative = weakTagId
      ? practiceLinkByStudentTag.get(`${studentId}::${weakTagId}`) || ""
      : "";
    const practiceLink = practiceRelative
      ? `${baseUrl.replace(/\/$/, "")}${practiceRelative.startsWith("/") ? "" : "/"}${practiceRelative}`
      : "";

    const livePracticeEntries = Array.from(livePracticeLinkByStudentTag.entries()).filter(
      ([key]) => key.startsWith(`${studentId}::`),
    );
    const livePracticeEntry = livePracticeEntries.length > 0 ? livePracticeEntries[0] : null;
    const livePracticeTagId = livePracticeEntry
      ? livePracticeEntry[0].split("::")[1] || ""
      : "";
    const livePracticeRelative = livePracticeEntry ? livePracticeEntry[1] : "";
    const livePracticeLink = livePracticeRelative
      ? `${baseUrl.replace(/\/$/, "")}${livePracticeRelative.startsWith("/") ? "" : "/"}${livePracticeRelative}`
      : "";
    const livePracticeTagName = livePracticeTagId
      ? tagNameById.get(livePracticeTagId) || ""
      : "";

    const digestMessage = buildDigestMessage({
      studentName: String(student?.name || "Student").trim(),
      topics,
      assessmentCorrect: assessmentStats.correctCount,
      assessmentTotal: assessmentStats.questionCount,
      assessmentPct,
      homeworkAssigned: homework.assigned,
      homeworkCompleted: homework.completed,
      liveSummaryLine: liveSummaryLine || undefined,
      nextFocus: livePracticeTagName || weakTagName || undefined,
      practiceTagName: livePracticeTagName || weakTagName || undefined,
      practiceLink: livePracticeLink || practiceLink || undefined,
      includeWeeklySummary: weeklySummaryDay,
      weeklyAccuracy: weeklySummaryDay ? assessmentPct : null,
    });

    if (!digestMessage) {
      continue;
    }

    const existing = await StudentDailyProgressModel.findOne({
      student: studentId,
      date,
    })
      .select("digestSentAt digestStatus")
      .lean();

    if (existing?.digestSentAt) {
      processed += 1;
      skipped += 1;
      continue;
    }

    await StudentDailyProgressModel.updateOne(
      { student: studentId, date },
      {
        $set: {
          student: studentId,
          class: student?.class,
          academicSection: student?.academicSection || null,
          subject: null,
          date,
          topicsCovered: topics,
          assessmentsAttempted: assessmentStats.questionCount,
          assessmentQuestionCount: assessmentStats.questionCount,
          assessmentAccuracyPct: assessmentPct,
          homeworkAssigned: homework.assigned,
          homeworkCompleted: homework.completed,
          homeworkAccuracyPct:
            homework.assigned > 0
              ? Math.round((homework.completed / homework.assigned) * 100)
              : null,
          timeSpentMinutes: 0,
          liveSessionsAssigned: liveStats.sessionsAssigned,
          liveSessionsAttended: liveStats.sessionsAttended,
          liveSessionsMissed: liveStats.sessionsMissed,
          livePollsTotal: liveStats.pollsTotal,
          livePollsAnswered: liveStats.pollsAnswered,
          livePollsCorrect: liveStats.pollsCorrect,
          liveAttentionPct,
          liveRecoveryTag: livePracticeTagId || null,
          primaryWeakTag: weakTagId || null,
          nextFocusText: livePracticeTagName || weakTagName || "",
          digestMessage,
          digestStatus: contact ? "pending" : "skipped",
          digestError: contact ? null : "Parent contact not found.",
        },
      },
      { upsert: true },
    );

    processed += 1;

    if (!contact) {
      skipped += 1;
      continue;
    }

    const to = resolveParentPhone({
      phoneNumber: student?.mobileNumber,
      phoneCountryCode: "+91",
    });

    if (!to) {
      skipped += 1;
      await StudentDailyProgressModel.updateOne(
        { student: studentId, date },
        { $set: { digestStatus: "skipped", digestError: "Missing phone." } },
      );
      continue;
    }

    if (params.dryRun) {
      skipped += 1;
      await StudentDailyProgressModel.updateOne(
        { student: studentId, date },
        { $set: { digestStatus: "skipped", digestError: "Dry run." } },
      );
      continue;
    }

    try {
      await sendWhatsAppText({ to, body: digestMessage });
      sent += 1;
      await StudentDailyProgressModel.updateOne(
        { student: studentId, date },
        { $set: { digestStatus: "sent", digestSentAt: new Date(), digestError: null } },
      );
    } catch (error) {
      failed += 1;
      await StudentDailyProgressModel.updateOne(
        { student: studentId, date },
        {
          $set: {
            digestStatus: "failed",
            digestError:
              error instanceof Error ? error.message : "WhatsApp send failed.",
          },
        },
      );
    }
  }

  return { processed, sent, skipped, failed };
}

export async function runParentUpdatesWorker(params: RunParentUpdatesParams) {
  await connectDB();
  const schools = params.schoolKey
    ? [{ key: params.schoolKey }]
    : await School.find({}).select("key").lean();

  const results = [];

  for (const school of schools) {
    const schoolKey = normalizeId((school as any)?.key);
    if (!schoolKey) continue;
    const result = await runParentUpdatesForSchool({
      schoolKey,
      date: params.date,
      dryRun: params.dryRun,
    });
    results.push({ schoolKey, ...result });
  }

  return results;
}
