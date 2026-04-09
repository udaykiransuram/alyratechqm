import mongoose from "mongoose";

import { buildArchivedUpdate, buildArchiveFilter } from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";
import { resolveDiaryAuthorScope, isStudentInDiaryScope } from "@/lib/diary/access";
import {
  buildDiaryContentSummary,
  mapDiaryAuthorSummary,
  mapDiaryClassSummary,
  mapDiarySectionSummary,
  mapDiaryStateSnapshot,
  mapDiarySubjectSummary,
  normalizeDiaryResources,
  toDiaryId,
  toDiaryIsoOrNull,
  uniqueSortedDiaryIds,
} from "@/lib/diary/shared";
import type {
  DiaryProgressSummary,
  DiaryRosterStudentState,
  DiaryStudentStateSnapshot,
  StudentDiaryDetail,
  StudentDiarySummary,
  WorkspaceDiaryDetail,
  WorkspaceDiarySummary,
} from "@/lib/diary/types";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  getWorkspaceClasses,
  getWorkspaceSections,
  getWorkspaceSubjects,
} from "@/lib/server/workspace-support-data";
import { invalidateStudentDashboardCacheForStudent } from "@/lib/server/student-dashboard-cache";
import {
  getMockStudentDiaryDetail,
  getMockStudentDiarySummaries,
  getMockWorkspaceClasses,
  getMockWorkspaceDiaryDetail,
  getMockWorkspaceDiarySummaries,
  getMockWorkspaceSections,
  getMockWorkspaceSubjects,
  updateMockStudentDiaryState,
} from "@/lib/test-fixtures/learning-content";
import { isMockedE2ETestMode } from "@/lib/test-mode";

type WorkspaceDiaryFilters = {
  entryDate?: string;
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  status?: string;
};

type StudentDiaryFilters = {
  entryDate?: string;
  subjectId?: string;
};

type StudentDiaryListResult = {
  entries: StudentDiarySummary[];
  total: number;
  page: number;
  pages: number;
  limit: number;
  subjectOptions: Array<{
    _id: string;
    name: string;
  }>;
};

type WorkspaceDiaryListResult = {
  entries: WorkspaceDiarySummary[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

function isValidDiaryObjectId(value: unknown) {
  const normalized = String(value || "").trim();
  return Boolean(normalized) && mongoose.Types.ObjectId.isValid(normalized);
}

function toOptionalString(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

function resolveListPage(value: unknown) {
  const normalized = Number(value || "");
  if (!Number.isFinite(normalized) || normalized < 1) {
    return 1;
  }

  return Math.floor(normalized);
}

function resolveListLimit(value: unknown, defaultLimit: number) {
  const normalized = Number(value || "");
  if (!Number.isFinite(normalized) || normalized < 1) {
    return defaultLimit;
  }

  return Math.min(Math.floor(normalized), 100);
}

function mergeMongoQueries(baseQuery: Record<string, any>, extraQuery: Record<string, any>) {
  if (!extraQuery || Object.keys(extraQuery).length === 0) {
    return baseQuery;
  }

  if (!baseQuery || Object.keys(baseQuery).length === 0) {
    return extraQuery;
  }

  return {
    $and: [baseQuery, extraQuery],
  };
}

function buildArrayIntersectionOrEmptyQuery(field: string, allowedIds: string[]) {
  return {
    $or: [
      { [field]: { $exists: false } },
      { [field]: { $size: 0 } },
      { [field]: { $in: allowedIds } },
    ],
  };
}

function buildDiarySectionIntersectionQuery(sectionIds: string[]) {
  return {
    assignedAcademicSections: { $in: sectionIds },
  };
}

function buildStudentDiarySectionScopeQuery(academicSectionId: string) {
  if (academicSectionId && mongoose.Types.ObjectId.isValid(academicSectionId)) {
    return buildArrayIntersectionOrEmptyQuery("assignedAcademicSections", [academicSectionId]);
  }

  return {
    $or: [
      { assignedAcademicSections: { $exists: false } },
      { assignedAcademicSections: { $size: 0 } },
    ],
  };
}

function buildStudentDiaryListQuery(params: {
  classId: string;
  academicSectionId: string;
  filters: StudentDiaryFilters;
  includeSubjectFilter: boolean;
}) {
  let query: Record<string, any> = {
    class: params.classId,
    status: "published",
    ...buildArchiveFilter(false),
  };

  if (params.filters.entryDate) {
    query.entryDate = String(params.filters.entryDate).trim();
  }

  if (
    params.includeSubjectFilter &&
    params.filters.subjectId &&
    mongoose.Types.ObjectId.isValid(params.filters.subjectId)
  ) {
    query.subject = params.filters.subjectId;
  }

  return mergeMongoQueries(
    query,
    buildStudentDiarySectionScopeQuery(params.academicSectionId),
  );
}

function buildDiaryStudentQuery(entries: any[]) {
  const classAssignments = new Map<
    string,
    {
      includeAllSections: boolean;
      sectionIds: Set<string>;
    }
  >();

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const classId = toDiaryId(entry?.class?._id || entry?.class);
    if (!classId) {
      return;
    }

    if (!classAssignments.has(classId)) {
      classAssignments.set(classId, {
        includeAllSections: false,
        sectionIds: new Set<string>(),
      });
    }

    const assignment = classAssignments.get(classId)!;
    const assignedSectionIds = uniqueSortedDiaryIds(entry?.assignedAcademicSections);

    if (assignedSectionIds.length === 0) {
      assignment.includeAllSections = true;
      return;
    }

    assignedSectionIds.forEach((sectionId) => assignment.sectionIds.add(sectionId));
  });

  const clauses = Array.from(classAssignments.entries()).map(([classId, assignment]) => {
    if (assignment.includeAllSections || assignment.sectionIds.size === 0) {
      return {
        class: classId,
      };
    }

    return {
      class: classId,
      academicSection: { $in: Array.from(assignment.sectionIds) },
    };
  });

  if (clauses.length === 0) {
    return null;
  }

  return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

export async function getScopedAuthorUser(schoolKey: string, userId: string) {
  const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
  return UserModel.findById(userId)
    .select(
      "name role hasAllClasses classIds hasAllSubjects subjectIds hasAllSections academicSectionIds",
    )
    .lean();
}

function filterClassesByUserScope(classes: any[], scopedUser: any) {
  if (scopedUser?.hasAllClasses) {
    return classes;
  }

  const allowedClassIds = new Set(uniqueSortedDiaryIds(scopedUser?.classIds));
  return classes.filter((item) => allowedClassIds.has(String(item?._id || "")));
}

function filterSectionsByUserScope(sections: any[], scopedUser: any) {
  const allowedClassIds = new Set(uniqueSortedDiaryIds(scopedUser?.classIds));
  const allowedSectionIds = new Set(
    uniqueSortedDiaryIds(scopedUser?.academicSectionIds),
  );

  return sections.filter((section) => {
    const sectionClassId =
      typeof section?.class === "string"
        ? section.class
        : String(section?.class?._id || "");

    if (!scopedUser?.hasAllClasses && !allowedClassIds.has(sectionClassId)) {
      return false;
    }

    if (scopedUser?.hasAllSections) {
      return true;
    }

    return allowedSectionIds.has(String(section?._id || ""));
  });
}

function filterSubjectsByUserScope(subjects: any[], scopedUser: any) {
  if (scopedUser?.hasAllSubjects) {
    return subjects;
  }

  const allowedSubjectIds = new Set(uniqueSortedDiaryIds(scopedUser?.subjectIds));
  return subjects.filter((subject) =>
    allowedSubjectIds.has(String(subject?._id || "")),
  );
}

function canAuthorAccessDiaryEntry(entry: any, scopedUser: any) {
  const assignedSectionIds = uniqueSortedDiaryIds(entry?.assignedAcademicSections);
  if (!scopedUser?.hasAllSections && assignedSectionIds.length === 0) {
    return false;
  }

  const scope = resolveDiaryAuthorScope(
    scopedUser,
    toDiaryId(entry?.class),
    toDiaryId(entry?.subject),
    assignedSectionIds,
  );

  return (
    scope.hasClassAccess &&
    scope.hasSubjectAccess &&
    scope.hasSectionAccess &&
    scope.hasFullSubjectAccess
  );
}

function isStudentAssignedToDiary(entry: any, student: any) {
  const entryClassId = toDiaryId(entry?.class?._id || entry?.class);
  const studentClassId = toDiaryId(student?.class?._id || student?.class);
  if (!entryClassId || !studentClassId || entryClassId !== studentClassId) {
    return false;
  }

  const assignedSectionIds = uniqueSortedDiaryIds(entry?.assignedAcademicSections);
  if (assignedSectionIds.length === 0) {
    return true;
  }

  const studentSectionId = toDiaryId(
    student?.academicSection?._id || student?.academicSection,
  );
  return Boolean(studentSectionId && assignedSectionIds.includes(studentSectionId));
}

function getStudentStateKey(entryId: string, studentId: string) {
  return `${entryId}::${studentId}`;
}

function compareRosterStudents(
  left: DiaryRosterStudentState,
  right: DiaryRosterStudentState,
) {
  const leftSection = String(left.student.academicSection?.name || "");
  const rightSection = String(right.student.academicSection?.name || "");
  if (leftSection !== rightSection) {
    return leftSection.localeCompare(rightSection);
  }

  const leftRoll = String(left.student.rollNumber || "");
  const rightRoll = String(right.student.rollNumber || "");
  if (leftRoll !== rightRoll) {
    return leftRoll.localeCompare(rightRoll);
  }

  return left.student.name.localeCompare(right.student.name);
}

function buildDiaryProgressBundle(params: {
  entries: any[];
  students: any[];
  stateDocs: any[];
}) {
  const stateByKey = new Map(
    params.stateDocs.map((stateDoc: any) => [
      getStudentStateKey(toDiaryId(stateDoc?.entry), toDiaryId(stateDoc?.student)),
      stateDoc,
    ]),
  );
  const progressByEntryId = new Map<string, DiaryProgressSummary>();
  const rosterByEntryId = new Map<string, DiaryRosterStudentState[]>();

  for (const entry of params.entries) {
    const entryId = toDiaryId(entry?._id);
    const assignedStudents = params.students
      .filter((student) => isStudentAssignedToDiary(entry, student))
      .map((student) => {
        const studentId = toDiaryId(student?._id);
        const state = mapDiaryStateSnapshot(
          stateByKey.get(getStudentStateKey(entryId, studentId)),
        );

        return {
          student: {
            _id: studentId,
            name: String(student?.name || "").trim() || studentId,
            rollNumber: toOptionalString(student?.rollNumber),
            academicSection:
              student?.academicSection && typeof student.academicSection === "object"
                ? mapDiarySectionSummary(student.academicSection)
                : null,
          },
          state,
        } satisfies DiaryRosterStudentState;
      })
      .sort(compareRosterStudents);

    const progressSummary = assignedStudents.reduce<DiaryProgressSummary>(
      (summary, item) => {
        summary.assignedStudents += 1;
        if (item.state.status === "completed") {
          summary.completedStudents += 1;
        } else if (item.state.status === "seen") {
          summary.seenStudents += 1;
        } else {
          summary.notSeenStudents += 1;
        }
        return summary;
      },
      {
        assignedStudents: 0,
        notSeenStudents: 0,
        seenStudents: 0,
        completedStudents: 0,
      },
    );

    progressByEntryId.set(entryId, progressSummary);
    rosterByEntryId.set(entryId, assignedStudents);
  }

  return {
    progressByEntryId,
    rosterByEntryId,
  };
}

function serializeWorkspaceDiarySummary(
  entry: any,
  progressSummary?: DiaryProgressSummary,
): WorkspaceDiarySummary {
  return {
    _id: toDiaryId(entry?._id),
    title: String(entry?.title || "").trim(),
    entryDate: String(entry?.entryDate || "").trim(),
    class: mapDiaryClassSummary(entry?.class),
    subject: mapDiarySubjectSummary(entry?.subject),
    assignedAcademicSections: (Array.isArray(entry?.assignedAcademicSections)
      ? entry.assignedAcademicSections
      : []
    )
      .map(mapDiarySectionSummary)
      .filter(Boolean) as WorkspaceDiarySummary["assignedAcademicSections"],
    status:
      String(entry?.status || "").trim() === "published"
        ? "published"
        : String(entry?.status || "").trim() === "archived"
          ? "archived"
          : "draft",
    publishedAt: toDiaryIsoOrNull(entry?.publishedAt),
    createdAt: toDiaryIsoOrNull(entry?.createdAt),
    updatedAt: toDiaryIsoOrNull(entry?.updatedAt),
    author: mapDiaryAuthorSummary(entry?.createdBy),
    updatedBy: mapDiaryAuthorSummary(entry?.updatedBy),
    content: buildDiaryContentSummary({
      lessonSummaryHtml: entry?.lessonSummaryHtml,
      homeworkHtml: entry?.homeworkHtml,
      teacherNoteHtml: entry?.teacherNoteHtml,
      resources: entry?.resources,
    }),
    progressSummary: progressSummary || {
      assignedStudents: 0,
      notSeenStudents: 0,
      seenStudents: 0,
      completedStudents: 0,
    },
  };
}

function serializeStudentDiarySummary(
  entry: any,
  state: DiaryStudentStateSnapshot,
): StudentDiarySummary {
  return {
    _id: toDiaryId(entry?._id),
    title: String(entry?.title || "").trim(),
    entryDate: String(entry?.entryDate || "").trim(),
    class: mapDiaryClassSummary(entry?.class),
    subject: mapDiarySubjectSummary(entry?.subject),
    assignedAcademicSections: (Array.isArray(entry?.assignedAcademicSections)
      ? entry.assignedAcademicSections
      : []
    )
      .map(mapDiarySectionSummary)
      .filter(Boolean) as StudentDiarySummary["assignedAcademicSections"],
    publishedAt: toDiaryIsoOrNull(entry?.publishedAt),
    updatedAt: toDiaryIsoOrNull(entry?.updatedAt),
    author: mapDiaryAuthorSummary(entry?.createdBy),
    content: buildDiaryContentSummary({
      lessonSummaryHtml: entry?.lessonSummaryHtml,
      homeworkHtml: entry?.homeworkHtml,
      teacherNoteHtml: entry?.teacherNoteHtml,
      resources: entry?.resources,
    }),
    state,
  };
}

async function getDiaryStudentRosterData(
  schoolKey: string,
  entries: any[],
) {
  const studentQuery = buildDiaryStudentQuery(entries);

  if (!studentQuery) {
    return {
      progressByEntryId: new Map<string, DiaryProgressSummary>(),
      rosterByEntryId: new Map<string, DiaryRosterStudentState[]>(),
    };
  }

  const {
    User: UserModel,
    DiaryStudentState: DiaryStudentStateModel,
    AcademicSection: AcademicSectionModel,
    Class: ClassModel,
  } = await getTenantModels(schoolKey, [
    "User",
    "DiaryStudentState",
    "AcademicSection",
    "Class",
  ]);

  const students = await UserModel.find({
    role: "student",
    ...buildArchiveFilter(false),
    ...studentQuery,
  })
    .select("_id name rollNumber class academicSection")
    .populate({
      path: "academicSection",
      model: AcademicSectionModel,
      select: "name class",
      populate: {
        path: "class",
        model: ClassModel,
        select: "name",
      },
    })
    .lean();

  const entryIds = entries.map((entry) => toDiaryId(entry?._id)).filter(Boolean);
  const studentIds = students.map((student: any) => toDiaryId(student?._id)).filter(Boolean);
  const stateDocs =
    entryIds.length > 0 && studentIds.length > 0
      ? await DiaryStudentStateModel.find({
          entry: { $in: entryIds },
          student: { $in: studentIds },
        })
          .select("entry student status firstSeenAt lastViewedAt completedAt")
          .lean()
      : [];

  return buildDiaryProgressBundle({
    entries,
    students: Array.isArray(students) ? students : [],
    stateDocs: Array.isArray(stateDocs) ? stateDocs : [],
  });
}

export async function getWorkspaceDiarySupportData(params: {
  schoolKey: string;
  viewerId: string;
}) {
  if (isMockedE2ETestMode()) {
    return {
      classes: getMockWorkspaceClasses(),
      sections: getMockWorkspaceSections(),
      subjects: getMockWorkspaceSubjects(),
    };
  }

  const [classes, sections, subjects, scopedUser] = await Promise.all([
    getWorkspaceClasses(params.schoolKey),
    getWorkspaceSections(params.schoolKey),
    getWorkspaceSubjects(params.schoolKey),
    getScopedAuthorUser(params.schoolKey, params.viewerId),
  ]);

  if (!scopedUser) {
    return {
      classes: [],
      sections: [],
      subjects: [],
    };
  }

  return {
    classes: filterClassesByUserScope(classes, scopedUser),
    sections: filterSectionsByUserScope(sections, scopedUser),
    subjects: filterSubjectsByUserScope(subjects, scopedUser),
  };
}

export async function listWorkspaceDiaryEntries(params: {
  schoolKey: string;
  viewerId: string;
  filters?: WorkspaceDiaryFilters;
  page?: number;
  limit?: number;
}) {
  const requestedPage = resolveListPage(params.page);
  const requestedLimit =
    typeof params.limit === "number" || typeof params.limit === "string"
      ? resolveListLimit(params.limit, 10)
      : null;

  if (isMockedE2ETestMode()) {
    const allEntries = getMockWorkspaceDiarySummaries(params.filters);
    const total = allEntries.length;

    if (!requestedLimit) {
      return {
        entries: allEntries,
        total,
        page: 1,
        pages: 1,
        limit: Math.max(total, 1),
      } satisfies WorkspaceDiaryListResult;
    }

    const pages = Math.max(1, Math.ceil(total / requestedLimit));
    const page = Math.min(requestedPage, pages);

    return {
      entries: allEntries.slice((page - 1) * requestedLimit, page * requestedLimit),
      total,
      page,
      pages,
      limit: requestedLimit,
    } satisfies WorkspaceDiaryListResult;
  }

  await connectDB();
  const {
    DiaryEntry: DiaryEntryModel,
    Class: ClassModel,
    Subject: SubjectModel,
    AcademicSection: AcademicSectionModel,
    User: UserModel,
  } = await getTenantModels(params.schoolKey, [
    "DiaryEntry",
    "Class",
    "Subject",
    "AcademicSection",
    "User",
  ]);

  const filters = params.filters || {};
  const scopedUser = await getScopedAuthorUser(params.schoolKey, params.viewerId);

  if (!scopedUser) {
    return {
      entries: [],
      total: 0,
      page: 1,
      pages: 1,
      limit: requestedLimit || 1,
    } satisfies WorkspaceDiaryListResult;
  }

  let query: Record<string, any> = {
    ...buildArchiveFilter(false),
  };
  const allowedClassIds = uniqueSortedDiaryIds(scopedUser?.classIds);
  const allowedSubjectIds = uniqueSortedDiaryIds(scopedUser?.subjectIds);
  const allowedSectionIds = uniqueSortedDiaryIds(scopedUser?.academicSectionIds);

  if (filters.entryDate) {
    query.entryDate = String(filters.entryDate).trim();
  }

  if (filters.classId && mongoose.Types.ObjectId.isValid(filters.classId)) {
    if (!scopedUser?.hasAllClasses && !allowedClassIds.includes(filters.classId)) {
      return {
        entries: [],
        total: 0,
        page: 1,
        pages: 1,
        limit: requestedLimit || 1,
      } satisfies WorkspaceDiaryListResult;
    }
    query.class = filters.classId;
  } else if (!scopedUser?.hasAllClasses) {
    if (allowedClassIds.length === 0) {
      return {
        entries: [],
        total: 0,
        page: 1,
        pages: 1,
        limit: requestedLimit || 1,
      } satisfies WorkspaceDiaryListResult;
    }
    query.class = { $in: allowedClassIds };
  }

  if (filters.subjectId && mongoose.Types.ObjectId.isValid(filters.subjectId)) {
    if (!scopedUser?.hasAllSubjects && !allowedSubjectIds.includes(filters.subjectId)) {
      return {
        entries: [],
        total: 0,
        page: 1,
        pages: 1,
        limit: requestedLimit || 1,
      } satisfies WorkspaceDiaryListResult;
    }
    query.subject = filters.subjectId;
  } else if (!scopedUser?.hasAllSubjects) {
    if (allowedSubjectIds.length === 0) {
      return {
        entries: [],
        total: 0,
        page: 1,
        pages: 1,
        limit: requestedLimit || 1,
      } satisfies WorkspaceDiaryListResult;
    }
    query.subject = { $in: allowedSubjectIds };
  }

  if (filters.status === "draft" || filters.status === "published") {
    query.status = filters.status;
  }

  if (filters.sectionId && mongoose.Types.ObjectId.isValid(filters.sectionId)) {
    if (!scopedUser?.hasAllSections && !allowedSectionIds.includes(filters.sectionId)) {
      return {
        entries: [],
        total: 0,
        page: 1,
        pages: 1,
        limit: requestedLimit || 1,
      } satisfies WorkspaceDiaryListResult;
    }

    const sectionQuery = scopedUser?.hasAllSections
      ? buildArrayIntersectionOrEmptyQuery("assignedAcademicSections", [filters.sectionId])
      : buildDiarySectionIntersectionQuery([filters.sectionId]);
    query = mergeMongoQueries(query, sectionQuery);
  } else if (!scopedUser?.hasAllSections) {
    if (allowedSectionIds.length === 0) {
      return {
        entries: [],
        total: 0,
        page: 1,
        pages: 1,
        limit: requestedLimit || 1,
      } satisfies WorkspaceDiaryListResult;
    }

    query = mergeMongoQueries(
      query,
      buildDiarySectionIntersectionQuery(allowedSectionIds),
    );
  }

  const total = await DiaryEntryModel.countDocuments(query);
  const limit = requestedLimit || Math.max(total, 1);
  const pages = requestedLimit ? Math.max(1, Math.ceil(total / limit)) : 1;
  const page = requestedLimit ? Math.min(requestedPage, pages) : 1;

  let entryQuery = DiaryEntryModel.find(query)
    .select(
      "_id title entryDate class assignedAcademicSections subject status lessonSummaryHtml homeworkHtml teacherNoteHtml resources publishedAt createdBy updatedBy createdAt updatedAt",
    )
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({ path: "subject", model: SubjectModel, select: "name" })
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      select: "name class",
      populate: {
        path: "class",
        model: ClassModel,
        select: "name",
      },
    })
    .populate({ path: "createdBy", model: UserModel, select: "name role" })
    .populate({ path: "updatedBy", model: UserModel, select: "name role" })
    .sort({ entryDate: -1, updatedAt: -1, title: 1 })
    .lean();

  if (requestedLimit) {
    entryQuery = entryQuery.skip((page - 1) * limit).limit(limit);
  }

  const entries = await entryQuery;

  const { progressByEntryId } = await getDiaryStudentRosterData(
    params.schoolKey,
    entries,
  );

  return {
    entries: (Array.isArray(entries) ? entries : []).map((entry) =>
      serializeWorkspaceDiarySummary(
        entry,
        progressByEntryId.get(toDiaryId(entry?._id)),
      ),
    ),
    total,
    page,
    pages,
    limit,
  } satisfies WorkspaceDiaryListResult;
}

export async function getWorkspaceDiaryById(params: {
  schoolKey: string;
  entryId: string;
  viewerId: string;
}) {
  if (isMockedE2ETestMode()) {
    return getMockWorkspaceDiaryDetail(params.entryId);
  }

  await connectDB();
  if (!isValidDiaryObjectId(params.entryId)) {
    return null;
  }
  const {
    DiaryEntry: DiaryEntryModel,
    Class: ClassModel,
    Subject: SubjectModel,
    AcademicSection: AcademicSectionModel,
    User: UserModel,
  } = await getTenantModels(params.schoolKey, [
    "DiaryEntry",
    "Class",
    "Subject",
    "AcademicSection",
    "User",
  ]);

  const [entry, scopedUser] = await Promise.all([
    DiaryEntryModel.findOne({
      _id: params.entryId,
      ...buildArchiveFilter(false),
    })
      .select(
        "_id title entryDate class assignedAcademicSections subject status lessonSummaryHtml homeworkHtml teacherNoteHtml resources publishedAt createdBy updatedBy createdAt updatedAt",
      )
      .populate({ path: "class", model: ClassModel, select: "name" })
      .populate({ path: "subject", model: SubjectModel, select: "name" })
      .populate({
        path: "assignedAcademicSections",
        model: AcademicSectionModel,
        select: "name class",
        populate: {
          path: "class",
          model: ClassModel,
          select: "name",
        },
      })
      .populate({ path: "createdBy", model: UserModel, select: "name role" })
      .populate({ path: "updatedBy", model: UserModel, select: "name role" })
      .lean(),
    getScopedAuthorUser(params.schoolKey, params.viewerId),
  ]);

  if (!entry || !scopedUser || !canAuthorAccessDiaryEntry(entry, scopedUser)) {
    return null;
  }

  const { progressByEntryId, rosterByEntryId } = await getDiaryStudentRosterData(
    params.schoolKey,
    [entry],
  );

  return {
    ...serializeWorkspaceDiarySummary(
      entry,
      progressByEntryId.get(toDiaryId(entry?._id)),
    ),
    lessonSummaryHtml: String(entry.lessonSummaryHtml || ""),
    homeworkHtml: String(entry.homeworkHtml || ""),
    teacherNoteHtml: String(entry.teacherNoteHtml || ""),
    resources: normalizeDiaryResources(entry.resources),
    roster: rosterByEntryId.get(toDiaryId(entry?._id)) || [],
  } satisfies WorkspaceDiaryDetail;
}

export async function listStudentDiaryEntries(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  } | null;
  filters?: StudentDiaryFilters;
}) {
  const result = await listStudentDiaryEntriesPage({
    ...params,
    page: 1,
  });

  return result.entries;
}

export async function listStudentDiaryEntriesPage(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  } | null;
  filters?: StudentDiaryFilters;
  page?: number | string;
  limit?: number | string;
}) {
  const requestedPage = resolveListPage(params.page);
  const requestedLimit =
    typeof params.limit === "number" || typeof params.limit === "string"
      ? resolveListLimit(params.limit, 12)
      : null;

  if (isMockedE2ETestMode()) {
    const allEntries = getMockStudentDiarySummaries(
      params.studentId,
      params.studentPlacement ?? undefined,
      params.filters,
    );

    const subjectOptions = Array.from(
      new Map(
        allEntries
          .filter((entry) => entry.subject?._id)
          .map((entry) => [
            String(entry.subject!._id),
            {
              _id: String(entry.subject!._id),
              name: String(entry.subject?.name || "").trim() || String(entry.subject!._id),
            },
          ]),
      ).values(),
    ).sort((left, right) => left.name.localeCompare(right.name));
    const total = allEntries.length;

    if (!requestedLimit) {
      return {
        entries: allEntries,
        total,
        page: 1,
        pages: 1,
        limit: Math.max(total, 1),
        subjectOptions,
      } satisfies StudentDiaryListResult;
    }

    const pages = Math.max(1, Math.ceil(total / requestedLimit));
    const page = Math.min(requestedPage, pages);

    return {
      entries: allEntries.slice((page - 1) * requestedLimit, page * requestedLimit),
      total,
      page,
      pages,
      limit: requestedLimit,
      subjectOptions,
    } satisfies StudentDiaryListResult;
  }

  await connectDB();

  const classId = String(params.studentPlacement?.classId || "").trim();
  const academicSectionId = String(
    params.studentPlacement?.academicSectionId || "",
  ).trim();

  if (!classId) {
    return {
      entries: [],
      total: 0,
      page: 1,
      pages: 1,
      limit: requestedLimit || 1,
      subjectOptions: [],
    } satisfies StudentDiaryListResult;
  }

  const {
    DiaryEntry: DiaryEntryModel,
    DiaryStudentState: DiaryStudentStateModel,
    Class: ClassModel,
    Subject: SubjectModel,
    AcademicSection: AcademicSectionModel,
    User: UserModel,
  } = await getTenantModels(params.schoolKey, [
    "DiaryEntry",
    "DiaryStudentState",
    "Class",
    "Subject",
    "AcademicSection",
    "User",
  ]);

  const filters = params.filters || {};
  const subjectOptionsQuery = buildStudentDiaryListQuery({
    classId,
    academicSectionId,
    filters,
    includeSubjectFilter: false,
  });
  const listQuery = buildStudentDiaryListQuery({
    classId,
    academicSectionId,
    filters,
    includeSubjectFilter: true,
  });

  const [total, matchingSubjectIds] = await Promise.all([
    DiaryEntryModel.countDocuments(listQuery),
    DiaryEntryModel.distinct("subject", subjectOptionsQuery),
  ]);

  const limit = requestedLimit || Math.max(total, 1);
  const pages = requestedLimit ? Math.max(1, Math.ceil(total / limit)) : 1;
  const page = requestedLimit ? Math.min(requestedPage, pages) : 1;

  let entriesQuery = DiaryEntryModel.find(listQuery)
    .select(
      "_id title entryDate class assignedAcademicSections subject lessonSummaryHtml homeworkHtml teacherNoteHtml resources publishedAt createdBy updatedAt",
    )
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({ path: "subject", model: SubjectModel, select: "name" })
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      select: "name class",
      populate: {
        path: "class",
        model: ClassModel,
        select: "name",
      },
    })
    .populate({ path: "createdBy", model: UserModel, select: "name role" })
    .sort({ entryDate: -1, updatedAt: -1, title: 1 })
    .lean();

  if (requestedLimit) {
    entriesQuery = entriesQuery.skip((page - 1) * limit).limit(limit);
  }

  const [entries, subjects] = await Promise.all([
    entriesQuery,
    Array.isArray(matchingSubjectIds) && matchingSubjectIds.length > 0
      ? SubjectModel.find({
          _id: { $in: matchingSubjectIds },
          ...buildArchiveFilter(false),
        })
          .select("_id name")
          .sort({ name: 1, _id: 1 })
          .lean()
      : [],
  ]);

  const stateDocs =
    entries.length > 0
      ? await DiaryStudentStateModel.find({
          entry: {
            $in: entries.map((entry) => toDiaryId(entry?._id)),
          },
          student: params.studentId,
        })
          .select("entry status firstSeenAt lastViewedAt completedAt")
          .lean()
      : [];

  const stateByEntryId = new Map(
    stateDocs.map((stateDoc: any) => [toDiaryId(stateDoc?.entry), stateDoc]),
  );

  const serializedEntries = entries.map((entry) =>
    serializeStudentDiarySummary(
      entry,
      mapDiaryStateSnapshot(stateByEntryId.get(toDiaryId(entry?._id))),
    ),
  );

  const subjectOptions = (Array.isArray(subjects) ? subjects : [])
    .map((subject: any) => ({
      _id: toDiaryId(subject?._id),
      name: String(subject?.name || "").trim(),
    }))
    .filter((subject) => Boolean(subject._id) && Boolean(subject.name));

  return {
    entries: serializedEntries,
    total,
    page,
    pages,
    limit,
    subjectOptions,
  } satisfies StudentDiaryListResult;
}

export async function getStudentDiaryDetail(params: {
  schoolKey: string;
  entryId: string;
  studentId: string;
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  } | null;
}) {
  if (isMockedE2ETestMode()) {
    return getMockStudentDiaryDetail(
      params.studentId,
      params.entryId,
      params.studentPlacement ?? undefined,
    );
  }

  await connectDB();
  if (!isValidDiaryObjectId(params.entryId)) {
    return null;
  }

  const classId = String(params.studentPlacement?.classId || "").trim();
  const academicSectionId = String(
    params.studentPlacement?.academicSectionId || "",
  ).trim();

  if (!classId) {
    return null;
  }

  const {
    DiaryEntry: DiaryEntryModel,
    DiaryStudentState: DiaryStudentStateModel,
    Class: ClassModel,
    Subject: SubjectModel,
    AcademicSection: AcademicSectionModel,
    User: UserModel,
  } = await getTenantModels(params.schoolKey, [
    "DiaryEntry",
    "DiaryStudentState",
    "Class",
    "Subject",
    "AcademicSection",
    "User",
  ]);

  const entry = await DiaryEntryModel.findOne({
    _id: params.entryId,
    class: classId,
    status: "published",
    ...buildArchiveFilter(false),
  })
    .select(
      "_id title entryDate class assignedAcademicSections subject lessonSummaryHtml homeworkHtml teacherNoteHtml resources publishedAt createdBy updatedAt",
    )
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({ path: "subject", model: SubjectModel, select: "name" })
    .populate({
      path: "assignedAcademicSections",
      model: AcademicSectionModel,
      select: "name class",
      populate: {
        path: "class",
        model: ClassModel,
        select: "name",
      },
    })
    .populate({ path: "createdBy", model: UserModel, select: "name role" })
    .lean();

  if (
    !entry ||
    !isStudentInDiaryScope(entry, {
      classId,
      academicSectionId,
    })
  ) {
    return null;
  }

  const stateDoc = await DiaryStudentStateModel.findOne({
    entry: params.entryId,
    student: params.studentId,
  })
    .select("status firstSeenAt lastViewedAt completedAt")
    .lean();

  return {
    ...serializeStudentDiarySummary(entry, mapDiaryStateSnapshot(stateDoc)),
    lessonSummaryHtml: String(entry.lessonSummaryHtml || ""),
    homeworkHtml: String(entry.homeworkHtml || ""),
    teacherNoteHtml: String(entry.teacherNoteHtml || ""),
    resources: normalizeDiaryResources(entry.resources),
  } satisfies StudentDiaryDetail;
}

export async function updateStudentDiaryState(params: {
  schoolKey: string;
  entryId: string;
  studentId: string;
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  } | null;
  operations: {
    markSeen?: boolean;
    markCompleted?: boolean;
  };
}) {
  if (isMockedE2ETestMode()) {
    return updateMockStudentDiaryState({
      studentId: params.studentId,
      entryId: params.entryId,
      operations: params.operations,
    });
  }

  await connectDB();
  if (
    !isValidDiaryObjectId(params.entryId) ||
    !mongoose.Types.ObjectId.isValid(params.studentId)
  ) {
    return null;
  }

  const classId = String(params.studentPlacement?.classId || "").trim();
  const academicSectionId = String(
    params.studentPlacement?.academicSectionId || "",
  ).trim();

  if (!classId) {
    return null;
  }

  const {
    DiaryEntry: DiaryEntryModel,
    DiaryStudentState: DiaryStudentStateModel,
  } = await getTenantModels(params.schoolKey, ["DiaryEntry", "DiaryStudentState"]);

  const entry = await DiaryEntryModel.findOne({
    _id: params.entryId,
    class: classId,
    status: "published",
    ...buildArchiveFilter(false),
  })
    .select("_id class assignedAcademicSections")
    .lean();

  if (
    !entry ||
    !isStudentInDiaryScope(entry, {
      classId,
      academicSectionId,
    })
  ) {
    return null;
  }

  const now = new Date();
  const applyStateTransition = (stateDoc: any) => {
    if (params.operations.markCompleted) {
      stateDoc.status = "completed";
      stateDoc.firstSeenAt = stateDoc.firstSeenAt || now;
      stateDoc.lastViewedAt = now;
      stateDoc.completedAt = stateDoc.completedAt || now;
      return;
    }

    if (params.operations.markSeen) {
      if (String(stateDoc.status || "").trim() !== "completed") {
        stateDoc.status = "seen";
      }
      stateDoc.firstSeenAt = stateDoc.firstSeenAt || now;
      stateDoc.lastViewedAt = now;
    }
  };

  const buildFreshState = () =>
    new DiaryStudentStateModel({
      entry: params.entryId,
      student: params.studentId,
      status: "not_seen",
      firstSeenAt: null,
      lastViewedAt: null,
      completedAt: null,
    });

  let nextState = await DiaryStudentStateModel.findOne({
    entry: params.entryId,
    student: params.studentId,
  });

  if (!nextState) {
    nextState = buildFreshState();
  }

  applyStateTransition(nextState);

  try {
    await nextState.save();
  } catch (error: any) {
    if (error?.code !== 11000) {
      throw error;
    }

    const concurrentState = await DiaryStudentStateModel.findOne({
      entry: params.entryId,
      student: params.studentId,
    });

    if (!concurrentState) {
      throw error;
    }

    applyStateTransition(concurrentState);
    await concurrentState.save();
    nextState = concurrentState;
  }

  await invalidateStudentDashboardCacheForStudent(
    params.schoolKey,
    params.studentId,
  );

  return mapDiaryStateSnapshot(nextState.toObject());
}

export function validateDiaryAuthorScope(params: {
  scopedUser: any;
  classId: string;
  subjectId: string;
  assignedAcademicSectionIds: string[];
}) {
  const scope = resolveDiaryAuthorScope(
    params.scopedUser,
    params.classId,
    params.subjectId,
    params.assignedAcademicSectionIds,
  );

  if (!scope.hasClassAccess || !scope.hasSubjectAccess || !scope.hasSectionAccess) {
    return {
      ok: false as const,
      message:
        "You can only create diary entries inside your assigned class, subject, and section scope.",
      status: 403,
    };
  }

  if (scope.allowedSectionIds !== null && params.assignedAcademicSectionIds.length === 0) {
    return {
      ok: false as const,
      message:
        "Users with section-scoped access must assign at least one section to a diary entry.",
      status: 400,
    };
  }

  if (scope.allowedSectionIds !== null) {
    const outOfScopeSections = params.assignedAcademicSectionIds.filter(
      (sectionId) => !scope.allowedSectionIds!.includes(sectionId),
    );

    if (outOfScopeSections.length > 0) {
      return {
        ok: false as const,
        message: "One or more assigned sections are outside your access scope.",
        status: 403,
      };
    }
  }

  return {
    ok: true as const,
  };
}

export async function findDiaryScopeConflict(params: {
  schoolKey: string;
  scopeKey: string;
  excludeId?: string;
}) {
  const { DiaryEntry: DiaryEntryModel } = await getTenantModels(params.schoolKey, [
    "DiaryEntry",
  ]);

  const conflict = await DiaryEntryModel.findOne({
    scopeKey: params.scopeKey,
    ...buildArchiveFilter(false),
    ...(params.excludeId ? { _id: { $ne: params.excludeId } } : {}),
  })
    .select("_id title")
    .lean();

  return conflict
    ? {
        _id: toDiaryId(conflict?._id),
        title: String(conflict?.title || "").trim(),
      }
    : null;
}

export async function archiveDiaryEntry(params: {
  schoolKey: string;
  entryId: string;
  actorId: string;
}) {
  if (!isValidDiaryObjectId(params.entryId)) {
    return null;
  }

  const { DiaryEntry: DiaryEntryModel } = await getTenantModels(params.schoolKey, [
    "DiaryEntry",
  ]);

  const result = await DiaryEntryModel.findOneAndUpdate(
    {
      _id: params.entryId,
      ...buildArchiveFilter(false),
    },
    {
      $set: {
        status: "archived",
        ...buildArchivedUpdate(params.actorId),
      },
    },
    {
      new: true,
    },
  )
    .select("_id title")
    .lean();

  return result
    ? {
        _id: toDiaryId(result?._id),
        title: String(result?.title || "").trim(),
      }
    : null;
}

export async function recordDiaryAudit(params: {
  schoolKey: string;
  req?: any;
  entryId: string;
  title: string;
  action: string;
  summary: string;
  details?: Record<string, unknown>;
}) {
  await recordTenantAudit({
    schoolKey: params.schoolKey,
    req: params.req,
    entityType: "diary_entry",
    entityId: params.entryId,
    entityLabel: params.title,
    action: params.action,
    summary: params.summary,
    details: params.details || null,
  });
}
