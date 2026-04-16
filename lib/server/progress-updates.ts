import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { buildArchiveFilter } from "@/lib/archive";
import {
  getWorkspaceClasses,
  getWorkspaceSections,
} from "@/lib/server/workspace-support-data";
import { resolveWorkspaceListPage } from "@/lib/server/workspace-user-directory";

type ProgressUpdatesSupportData = {
  classes: Array<{ _id: string; name: string }>;
  sections: Array<{
    _id: string;
    name: string;
    class?: { _id: string; name: string } | string;
  }>;
};

export type ProgressUpdateStudentRow = {
  student: {
    _id: string;
    name: string;
    rollNumber?: string | null;
    mobileNumber?: string | null;
    class?: { _id: string; name: string } | null;
    section?: { _id: string; name: string } | null;
  };
  contact: {
    parentName?: string;
    whatsappOptIn?: boolean;
    relationship?: string;
    preferredLanguage?: string;
    updatedAt?: string | null;
  } | null;
  progress: {
    date: string;
    topicsCovered: string[];
    assessmentAccuracyPct: number | null;
    assessmentQuestionCount: number;
    homeworkAssigned: number;
    homeworkCompleted: number;
    liveSessionsAssigned: number;
    liveSessionsAttended: number;
    liveSessionsMissed: number;
    livePollsTotal: number;
    livePollsAnswered: number;
    livePollsCorrect: number;
    liveAttentionPct: number | null;
    nextFocusText?: string;
    digestStatus?: string | null;
    digestSentAt?: string | null;
    digestMessage?: string | null;
  } | null;
};

export type ProgressUpdatesDirectory = {
  rows: ProgressUpdateStudentRow[];
  totalStudents: number;
  page: number;
  pages: number;
  pageSize: number;
};

function toId(value: unknown) {
  return String(value || "").trim();
}

async function getTeacherScopedUser(schoolKey: string, userId: string) {
  const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
  return UserModel.findById(userId)
    .select(
      "hasAllClasses classIds hasAllSections academicSectionIds",
    )
    .lean();
}

function filterClassesByTeacherScope(classes: any[], scopedUser: any) {
  if (scopedUser?.hasAllClasses) {
    return classes;
  }

  const allowedClassIds = new Set(
    Array.isArray(scopedUser?.classIds)
      ? scopedUser.classIds.map((classId: any) => toId(classId))
      : [],
  );

  return classes.filter((item) => allowedClassIds.has(String(item?._id || "")));
}

function filterSectionsByTeacherScope(sections: any[], scopedUser: any) {
  const allowedClassIds = new Set(
    Array.isArray(scopedUser?.classIds)
      ? scopedUser.classIds.map((classId: any) => toId(classId))
      : [],
  );
  const allowedSectionIds = new Set(
    Array.isArray(scopedUser?.academicSectionIds)
      ? scopedUser.academicSectionIds.map((sectionId: any) => toId(sectionId))
      : [],
  );

  return sections.filter((section) => {
    const sectionClassId = String(section?.class?._id || section?.class || "").trim();
    if (!scopedUser?.hasAllClasses && !allowedClassIds.has(sectionClassId)) {
      return false;
    }

    if (scopedUser?.hasAllSections) {
      return true;
    }

    return allowedSectionIds.has(String(section?._id || "").trim());
  });
}

function applyTeacherScopeToStudentQuery(params: {
  query: Record<string, unknown>;
  scopedUser: any;
  classId?: string;
  sectionId?: string;
}) {
  const { scopedUser, classId, sectionId } = params;
  const query = params.query;

  if (!scopedUser) {
    return { query, outOfScope: false };
  }

  const allowedClassIds = new Set(
    Array.isArray(scopedUser?.classIds)
      ? scopedUser.classIds.map((classId: any) => toId(classId))
      : [],
  );
  const allowedSectionIds = new Set(
    Array.isArray(scopedUser?.academicSectionIds)
      ? scopedUser.academicSectionIds.map((sectionId: any) => toId(sectionId))
      : [],
  );

  if (!scopedUser?.hasAllClasses) {
    if (allowedClassIds.size === 0) {
      return { query, outOfScope: true };
    }
    if (classId && !allowedClassIds.has(classId)) {
      return { query, outOfScope: true };
    }
    query.class = classId ? classId : { $in: Array.from(allowedClassIds) };
  } else if (classId) {
    query.class = classId;
  }

  if (!scopedUser?.hasAllSections) {
    if (!sectionId && allowedSectionIds.size === 0) {
      return { query, outOfScope: true };
    }
    if (sectionId && !allowedSectionIds.has(sectionId)) {
      return { query, outOfScope: true };
    }
    if (sectionId) {
      query.academicSection = sectionId;
    } else if (allowedSectionIds.size > 0) {
      query.academicSection = { $in: Array.from(allowedSectionIds) };
    }
  } else if (sectionId) {
    query.academicSection = sectionId;
  }

  return { query, outOfScope: false };
}

export async function getProgressUpdatesSupportData(params: {
  schoolKey: string;
  viewerId: string;
  viewerRole: "admin" | "teacher";
}): Promise<ProgressUpdatesSupportData> {
  const [classes, sections] = await Promise.all([
    getWorkspaceClasses(params.schoolKey),
    getWorkspaceSections(params.schoolKey),
  ]);

  if (params.viewerRole !== "teacher") {
    return { classes, sections };
  }

  const scopedUser = await getTeacherScopedUser(params.schoolKey, params.viewerId);

  return {
    classes: filterClassesByTeacherScope(classes, scopedUser),
    sections: filterSectionsByTeacherScope(sections, scopedUser),
  };
}

export async function listProgressUpdatesDirectory(params: {
  schoolKey: string;
  viewerId: string;
  viewerRole: "admin" | "teacher";
  date: string;
  classId?: string;
  sectionId?: string;
  query?: string;
  page?: number;
  limit?: number;
}): Promise<ProgressUpdatesDirectory> {
  const requestedPage = resolveWorkspaceListPage(params.page);
  const pageSize = Math.min(Math.max(params.limit || 20, 5), 100);

  await connectDB();
  const {
    User: UserModel,
    ParentContact: ParentContactModel,
    StudentDailyProgress: StudentDailyProgressModel,
    Class: ClassModel,
    AcademicSection: AcademicSectionModel,
  } = await getTenantModels(params.schoolKey, [
    "User",
    "ParentContact",
    "StudentDailyProgress",
    "Class",
    "AcademicSection",
  ]);

  const studentQuery: Record<string, unknown> = {
    role: "student",
    ...buildArchiveFilter(false),
  };

  const scopedUser =
    params.viewerRole === "teacher"
      ? await getTeacherScopedUser(params.schoolKey, params.viewerId)
      : null;
  const scopeResult = applyTeacherScopeToStudentQuery({
    query: studentQuery,
    scopedUser,
    classId: params.classId,
    sectionId: params.sectionId,
  });

  if (scopeResult.outOfScope) {
    return {
      rows: [],
      totalStudents: 0,
      page: requestedPage,
      pages: 1,
      pageSize,
    };
  }

  if (params.query) {
    const regex = new RegExp(String(params.query).trim(), "i");
    studentQuery.$or = [
      { name: { $regex: regex } },
      { fatherName: { $regex: regex } },
      { email: { $regex: regex } },
      { rollNumber: { $regex: regex } },
    ];
  }

  const totalStudents = await UserModel.countDocuments(studentQuery);
  const pages = Math.max(1, Math.ceil(totalStudents / pageSize));
  const page = Math.min(requestedPage, pages);

  const students = await UserModel.find(studentQuery)
    .select("name rollNumber class academicSection mobileNumber")
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({
      path: "academicSection",
      model: AcademicSectionModel,
      select: "name class",
    })
    .sort({ name: 1, _id: 1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();

  const studentIds = students.map((student: any) => toId(student?._id)).filter(Boolean);

  const contacts = studentIds.length
    ? await ParentContactModel.find({ student: { $in: studentIds } })
        .select(
          "student parentName whatsappOptIn relationship preferredLanguage updatedAt",
        )
        .lean()
    : [];
  const contactByStudentId = new Map(
    contacts.map((contact: any) => [toId(contact?.student), contact]),
  );

  const progressDocs = studentIds.length
    ? await StudentDailyProgressModel.find({
        student: { $in: studentIds },
        date: params.date,
      })
        .select(
          "student date topicsCovered assessmentAccuracyPct assessmentQuestionCount homeworkAssigned homeworkCompleted liveSessionsAssigned liveSessionsAttended liveSessionsMissed livePollsTotal livePollsAnswered livePollsCorrect liveAttentionPct nextFocusText digestStatus digestSentAt digestMessage",
        )
        .lean()
    : [];
  const progressByStudentId = new Map(
    progressDocs.map((doc: any) => [toId(doc?.student), doc]),
  );

  const rows = students.map((student: any) => {
    const studentId = toId(student?._id);
    const contact = contactByStudentId.get(studentId);
    const progress = progressByStudentId.get(studentId);

    return {
      student: {
        _id: studentId,
        name: String(student?.name || "").trim(),
        rollNumber: student?.rollNumber ? String(student.rollNumber).trim() : null,
        mobileNumber: student?.mobileNumber
          ? String(student.mobileNumber).trim()
          : null,
        class: student?.class
          ? { _id: toId(student.class?._id || student.class), name: String(student.class?.name || "").trim() }
          : null,
        section: student?.academicSection
          ? {
              _id: toId(student.academicSection?._id || student.academicSection),
              name: String(student.academicSection?.name || "").trim(),
            }
          : null,
      },
      contact: contact
        ? {
            parentName: String(contact?.parentName || "").trim(),
            whatsappOptIn: Boolean(contact?.whatsappOptIn),
            relationship: String(contact?.relationship || "").trim(),
            preferredLanguage: String(contact?.preferredLanguage || "").trim(),
            updatedAt: contact?.updatedAt
              ? new Date(contact.updatedAt).toISOString()
              : null,
          }
        : null,
      progress: progress
        ? {
            date: String(progress?.date || "").trim(),
            topicsCovered: Array.isArray(progress?.topicsCovered)
              ? progress.topicsCovered.map((topic: any) => String(topic || "").trim()).filter(Boolean)
              : [],
            assessmentAccuracyPct:
              typeof progress?.assessmentAccuracyPct === "number"
                ? progress.assessmentAccuracyPct
                : null,
            assessmentQuestionCount: Number(progress?.assessmentQuestionCount || 0),
            homeworkAssigned: Number(progress?.homeworkAssigned || 0),
            homeworkCompleted: Number(progress?.homeworkCompleted || 0),
            liveSessionsAssigned: Number(progress?.liveSessionsAssigned || 0),
            liveSessionsAttended: Number(progress?.liveSessionsAttended || 0),
            liveSessionsMissed: Number(progress?.liveSessionsMissed || 0),
            livePollsTotal: Number(progress?.livePollsTotal || 0),
            livePollsAnswered: Number(progress?.livePollsAnswered || 0),
            livePollsCorrect: Number(progress?.livePollsCorrect || 0),
            liveAttentionPct:
              typeof progress?.liveAttentionPct === "number"
                ? progress.liveAttentionPct
                : null,
            nextFocusText: String(progress?.nextFocusText || "").trim(),
            digestStatus: progress?.digestStatus ? String(progress.digestStatus) : null,
            digestSentAt: progress?.digestSentAt
              ? new Date(progress.digestSentAt).toISOString()
              : null,
            digestMessage: String(progress?.digestMessage || "").trim(),
          }
        : null,
    } satisfies ProgressUpdateStudentRow;
  });

  return {
    rows,
    totalStudents,
    page,
    pages,
    pageSize,
  };
}

export async function getStudentProgressUpdatesDetail(params: {
  schoolKey: string;
  viewerId: string;
  viewerRole: "admin" | "teacher";
  studentId: string;
}) {
  await connectDB();
  const {
    User: UserModel,
    ParentContact: ParentContactModel,
    StudentDailyProgress: StudentDailyProgressModel,
    Class: ClassModel,
    AcademicSection: AcademicSectionModel,
  } = await getTenantModels(params.schoolKey, [
    "User",
    "ParentContact",
    "StudentDailyProgress",
    "Class",
    "AcademicSection",
  ]);

  const scopedUser =
    params.viewerRole === "teacher"
      ? await getTeacherScopedUser(params.schoolKey, params.viewerId)
      : null;

  const studentQuery: Record<string, unknown> = {
    _id: params.studentId,
    role: "student",
    ...buildArchiveFilter(false),
  };

  const scopeResult = applyTeacherScopeToStudentQuery({
    query: studentQuery,
    scopedUser,
  });

  if (scopeResult.outOfScope) {
    return null;
  }

  const student = await UserModel.findOne(studentQuery)
    .select("name rollNumber class academicSection mobileNumber")
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({
      path: "academicSection",
      model: AcademicSectionModel,
      select: "name class",
    })
    .lean();

  if (!student) {
    return null;
  }

  const contact = await ParentContactModel.findOne({ student: params.studentId })
    .select(
      "student parentName whatsappOptIn relationship preferredLanguage updatedAt",
    )
    .lean();

  const progressEntries = await StudentDailyProgressModel.find({
    student: params.studentId,
  })
    .select(
      "date topicsCovered assessmentAccuracyPct assessmentQuestionCount homeworkAssigned homeworkCompleted liveSessionsAssigned liveSessionsAttended liveSessionsMissed livePollsTotal livePollsAnswered livePollsCorrect liveAttentionPct nextFocusText digestStatus digestSentAt digestMessage",
    )
    .sort({ date: -1 })
    .limit(30)
    .lean();

  return {
    student: {
      _id: toId(student?._id),
      name: String(student?.name || "").trim(),
      rollNumber: student?.rollNumber ? String(student.rollNumber).trim() : null,
      mobileNumber: student?.mobileNumber
        ? String(student.mobileNumber).trim()
        : null,
      class: student?.class
        ? { _id: toId(student.class?._id || student.class), name: String(student.class?.name || "").trim() }
        : null,
      section: student?.academicSection
        ? {
            _id: toId(student.academicSection?._id || student.academicSection),
            name: String(student.academicSection?.name || "").trim(),
          }
        : null,
    },
    contact: contact
      ? {
          parentName: String(contact?.parentName || "").trim(),
          whatsappOptIn: Boolean(contact?.whatsappOptIn),
          relationship: String(contact?.relationship || "").trim(),
          preferredLanguage: String(contact?.preferredLanguage || "").trim(),
          updatedAt: contact?.updatedAt ? new Date(contact.updatedAt).toISOString() : null,
        }
      : null,
    progress: progressEntries.map((entry: any) => ({
      date: String(entry?.date || "").trim(),
      topicsCovered: Array.isArray(entry?.topicsCovered)
        ? entry.topicsCovered.map((topic: any) => String(topic || "").trim()).filter(Boolean)
        : [],
      assessmentAccuracyPct:
        typeof entry?.assessmentAccuracyPct === "number" ? entry.assessmentAccuracyPct : null,
      assessmentQuestionCount: Number(entry?.assessmentQuestionCount || 0),
      homeworkAssigned: Number(entry?.homeworkAssigned || 0),
      homeworkCompleted: Number(entry?.homeworkCompleted || 0),
      liveSessionsAssigned: Number(entry?.liveSessionsAssigned || 0),
      liveSessionsAttended: Number(entry?.liveSessionsAttended || 0),
      liveSessionsMissed: Number(entry?.liveSessionsMissed || 0),
      livePollsTotal: Number(entry?.livePollsTotal || 0),
      livePollsAnswered: Number(entry?.livePollsAnswered || 0),
      livePollsCorrect: Number(entry?.livePollsCorrect || 0),
      liveAttentionPct:
        typeof entry?.liveAttentionPct === "number" ? entry.liveAttentionPct : null,
      nextFocusText: String(entry?.nextFocusText || "").trim(),
      digestStatus: entry?.digestStatus ? String(entry.digestStatus) : null,
      digestSentAt: entry?.digestSentAt ? new Date(entry.digestSentAt).toISOString() : null,
      digestMessage: String(entry?.digestMessage || "").trim(),
    })),
  };
}
