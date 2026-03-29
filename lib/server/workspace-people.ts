import mongoose from "mongoose";

import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  getWorkspaceClasses,
  getWorkspaceSections,
  getWorkspaceSubjects,
} from "@/lib/server/workspace-support-data";
import {
  resolveStudentPasswordAdminInfo,
  type StudentPasswordAdminInfo,
} from "@/lib/user-credentials";
import type {
  WorkspaceAcademicSectionItem,
  WorkspaceClassItem,
  WorkspaceSubjectItem,
} from "@/lib/workspace/support-types";

function toId(value: unknown) {
  return String(value || "").trim();
}

function toOptionalString(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

function toOptionalDateString(value: unknown) {
  if (!value) return undefined;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function normalizeIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => toId((item as { _id?: unknown })?._id || item))
    .filter(Boolean);
}

function normalizeUserRecord(rawUser: any) {
  if (!rawUser) {
    return null;
  }

  return {
    _id: toId(rawUser?._id),
    name: toOptionalString(rawUser?.name) || "",
    email: toOptionalString(rawUser?.email),
    mobileNumber: toOptionalString(rawUser?.mobileNumber),
    role: toOptionalString(rawUser?.role) || "",
    class: toOptionalString(rawUser?.class?._id || rawUser?.class),
    academicSection: toOptionalString(
      rawUser?.academicSection?._id || rawUser?.academicSection,
    ),
    rollNumber: toOptionalString(rawUser?.rollNumber),
    enrolledAt: toOptionalDateString(rawUser?.enrolledAt),
    createdAt: toOptionalDateString(rawUser?.createdAt),
    updatedAt: toOptionalDateString(rawUser?.updatedAt),
    classIds: normalizeIdList(rawUser?.classIds),
    academicSectionIds: normalizeIdList(rawUser?.academicSectionIds),
    subjectIds: normalizeIdList(rawUser?.subjectIds),
    hasAllClasses:
      typeof rawUser?.hasAllClasses === "boolean"
        ? rawUser.hasAllClasses
        : undefined,
    hasAllSections:
      typeof rawUser?.hasAllSections === "boolean"
        ? rawUser.hasAllSections
        : undefined,
    hasAllSubjects:
      typeof rawUser?.hasAllSubjects === "boolean"
        ? rawUser.hasAllSubjects
        : undefined,
  };
}

async function normalizeWorkspacePeopleUserRecord(rawUser: any) {
  const normalizedUser = normalizeUserRecord(rawUser);

  if (!normalizedUser) {
    return null;
  }

  if (normalizedUser.role !== "student") {
    return normalizedUser;
  }

  return {
    ...normalizedUser,
    studentPasswordInfo: await resolveStudentPasswordAdminInfo({
      mobileNumber: rawUser?.mobileNumber,
      passwordHash: rawUser?.passwordHash,
    }),
  };
}

function normalizePaperReference(value: any) {
  if (!value) {
    return undefined;
  }

  return {
    _id: toId(value?._id),
    title: toOptionalString(value?.title),
    subject:
      value?.subject && typeof value.subject === "object"
        ? { name: toOptionalString(value.subject?.name) }
        : toOptionalString(value?.subject),
    class:
      value?.class && typeof value.class === "object"
        ? { name: toOptionalString(value.class?.name) }
        : toOptionalString(value?.class),
  };
}

function isWorkspacePeopleUserRecord(
  value: ReturnType<typeof normalizeUserRecord>,
): value is WorkspacePeopleUserRecord {
  return value !== null;
}

function normalizeStudentAttemptItem(rawAttempt: any) {
  return {
    _id: toId(rawAttempt?._id),
    paper: normalizePaperReference(rawAttempt?.paper),
    student: toOptionalString(rawAttempt?.student?._id || rawAttempt?.student),
    startedAt: toOptionalDateString(rawAttempt?.startedAt),
    submittedAt: toOptionalDateString(rawAttempt?.submittedAt),
    totalMarksAwarded:
      typeof rawAttempt?.totalMarksAwarded === "number" &&
      Number.isFinite(rawAttempt.totalMarksAwarded)
        ? Number(rawAttempt.totalMarksAwarded)
        : undefined,
    sectionAnswers: Array.isArray(rawAttempt?.sectionAnswers)
      ? rawAttempt.sectionAnswers.map((sectionAnswer: any) => ({
          sectionName: toOptionalString(sectionAnswer?.sectionName) || "",
          answers: Array.isArray(sectionAnswer?.answers)
            ? sectionAnswer.answers.map((answer: any) => ({
                marksAwarded:
                  typeof answer?.marksAwarded === "number" &&
                  Number.isFinite(answer.marksAwarded)
                    ? Number(answer.marksAwarded)
                    : undefined,
              }))
            : [],
        }))
      : [],
  };
}

export type WorkspacePeopleUserRecord = NonNullable<
  ReturnType<typeof normalizeUserRecord>
> & {
  studentPasswordInfo?: StudentPasswordAdminInfo;
};

export type WorkspaceStudentAttemptItem = ReturnType<
  typeof normalizeStudentAttemptItem
>;

export type WorkspacePeopleUserData = {
  user: WorkspacePeopleUserRecord | null;
  classes: WorkspaceClassItem[];
  sections: WorkspaceAcademicSectionItem[];
  subjects: WorkspaceSubjectItem[];
  attempts: WorkspaceStudentAttemptItem[];
};

export type WorkspaceUserDirectoryPageData = {
  users: WorkspacePeopleUserRecord[];
  classes: WorkspaceClassItem[];
  sections: WorkspaceAcademicSectionItem[];
  total: number;
  page: number;
  pages: number;
  limit: number;
  listError: string | null;
  supportDataNotice: string | null;
};

function resolveErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    const normalized = String(error.message || "").trim();
    if (normalized) {
      return normalized;
    }
  }

  return fallbackMessage;
}

function buildPartialLoadMessage(
  labels: string[],
  continuation = "You can continue with available data and refresh to retry.",
) {
  const cleanedLabels = labels
    .map((label) => String(label || "").trim())
    .filter(Boolean);

  if (cleanedLabels.length === 0) {
    return null;
  }

  if (cleanedLabels.length === 1) {
    return `${cleanedLabels[0]} could not be loaded. ${continuation}`;
  }

  const head = cleanedLabels.slice(0, -1).join(", ");
  const tail = cleanedLabels[cleanedLabels.length - 1];
  return `${head} and ${tail} could not be loaded. ${continuation}`;
}

export async function getWorkspacePeopleUserData({
  schoolKey,
  userId,
  includeSubjects = false,
  includeStudentAttempts = false,
}: {
  schoolKey: string;
  userId: string;
  includeSubjects?: boolean;
  includeStudentAttempts?: boolean;
}): Promise<WorkspacePeopleUserData> {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return {
      user: null,
      classes: [],
      sections: [],
      subjects: [],
      attempts: [],
    };
  }

  await connectDB();
  const modelNames = ["User"] as string[];
  if (includeStudentAttempts) {
    modelNames.push(
      "QuestionPaperResponse",
      "QuestionPaper",
      "Subject",
      "Class",
    );
  }
  const models = await getTenantModels(schoolKey, modelNames);
  const { User: UserModel } = models;

  const [user, classes, sections, subjects, attempts] = await Promise.all([
    UserModel.findOne({
      _id: userId,
      ...buildArchiveFilter(false),
    })
      .lean()
      .then(normalizeWorkspacePeopleUserRecord),
    getWorkspaceClasses(schoolKey),
    getWorkspaceSections(schoolKey),
    includeSubjects
      ? getWorkspaceSubjects(schoolKey)
      : Promise.resolve([] as WorkspaceSubjectItem[]),
    includeStudentAttempts
      ? loadStudentAttempts({
          schoolKey,
          studentId: userId,
          models,
        })
      : Promise.resolve([] as WorkspaceStudentAttemptItem[]),
  ]);

  return {
    user,
    classes,
    sections,
    subjects,
    attempts,
  };
}

export async function getWorkspaceUserDirectoryPageData({
  schoolKey,
  page = 1,
  limit = 100,
}: {
  schoolKey: string;
  page?: number;
  limit?: number;
}): Promise<WorkspaceUserDirectoryPageData> {
  const resolvedLimit = Math.min(Math.max(Math.floor(limit || 100), 1), 500);
  const resolvedPage = Math.max(1, Math.floor(page || 1));
  const skip = (resolvedPage - 1) * resolvedLimit;

  const [usersResult, classesResult, sectionsResult] = await Promise.allSettled([
    (async () => {
      await connectDB();
      const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
      const [total, rawUsers] = await Promise.all([
        UserModel.countDocuments(buildArchiveFilter(false)),
        UserModel.find(buildArchiveFilter(false))
          .select("-passwordHash")
          .sort({ name: 1 })
          .skip(skip)
          .limit(resolvedLimit)
          .lean(),
      ]);

      return {
        total,
        rawUsers,
      };
    })(),
    getWorkspaceClasses(schoolKey),
    getWorkspaceSections(schoolKey),
  ]);

  const usersPayload =
    usersResult.status === "fulfilled"
      ? usersResult.value
      : {
          total: 0,
          rawUsers: [],
        };
  const total = Number.isFinite(usersPayload.total) ? Number(usersPayload.total) : 0;
  const users = Array.isArray(usersPayload.rawUsers)
    ? usersPayload.rawUsers
        .map(normalizeUserRecord)
        .filter(isWorkspacePeopleUserRecord)
    : [];

  const classes = classesResult.status === "fulfilled" ? classesResult.value : [];
  const sections =
    sectionsResult.status === "fulfilled" ? sectionsResult.value : [];

  const supportDataNotice = buildPartialLoadMessage([
    ...(classesResult.status === "rejected" ? ["Classes"] : []),
    ...(sectionsResult.status === "rejected" ? ["Sections"] : []),
  ]);

  const listError =
    usersResult.status === "rejected"
      ? resolveErrorMessage(usersResult.reason, "We couldn't load users.")
      : null;

  return {
    users,
    classes,
    sections,
    total,
    page: listError ? 1 : resolvedPage,
    pages: Math.max(1, Math.ceil(total / resolvedLimit)),
    limit: resolvedLimit,
    listError,
    supportDataNotice,
  };
}

async function loadStudentAttempts({
  studentId,
  models,
}: {
  schoolKey: string;
  studentId: string;
  models: Awaited<ReturnType<typeof getTenantModels>>;
}) {
  const {
    QuestionPaperResponse: QuestionPaperResponseModel,
    QuestionPaper: QuestionPaperModel,
    Subject: SubjectModel,
    Class: ClassModel,
  } = models as Awaited<
    ReturnType<typeof getTenantModels>
  > & {
    QuestionPaperResponse: any;
    QuestionPaper: any;
    Subject: any;
    Class: any;
  };

  const attempts = await QuestionPaperResponseModel.find({
    student: studentId,
  })
    .select(
      "paper student startedAt submittedAt totalMarksAwarded sectionAnswers createdAt",
    )
    .populate({
      path: "paper",
      model: QuestionPaperModel,
      select: "title subject class",
      populate: [
        { path: "subject", model: SubjectModel, select: "name" },
        { path: "class", model: ClassModel, select: "name" },
      ],
    })
    .lean();

  const normalizedAttempts = Array.isArray(attempts)
    ? attempts.map(normalizeStudentAttemptItem)
    : [];

  normalizedAttempts.sort((left, right) => {
    const leftDate = left.submittedAt || left.startedAt || "";
    const rightDate = right.submittedAt || right.startedAt || "";
    return rightDate.localeCompare(leftDate);
  });

  return normalizedAttempts;
}
