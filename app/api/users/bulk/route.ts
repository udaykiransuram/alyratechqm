import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { buildArchiveFilter, buildRestoreUpdate } from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { requireTenantSession } from "@/lib/api-auth";
import { clearStudentSession } from "@/lib/redis";
import { invalidateStudentSessionValidationCache } from "@/lib/student-session-cache";
import { invalidateStudentTestResourceCache } from "@/lib/student-test-server";
import {
  isSameStudentPlacement,
  normalizeEmail,
  normalizeRollNumber,
  resolveUserPasswordInput,
  validatePasswordInput,
  validateStudentDefaultPasswordSource,
} from "@/lib/user-credentials";
import { normalizeUserGender } from "@/lib/user-gender";
import { recordOpsFailure } from "@/lib/ops-runtime";

const MAX_BULK_UPLOAD_ROWS = Math.max(
  1,
  Number.parseInt(String(process.env.BULK_USER_UPLOAD_MAX_ROWS || "1000"), 10) ||
    1000,
);

const ROLL_LOOKUP_CHUNK_SIZE = 80;

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function normalizeId(value: unknown) {
  return value ? String(value).trim() : "";
}

function toUploadLookupKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function splitUploadTokens(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(/[|\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseClassSectionToken(value: string) {
  const match = String(value || "").match(/^(.+?)(?::|>|\/)(.+)$/);
  if (!match) {
    return null;
  }

  return {
    classToken: String(match[1] || "").trim(),
    sectionToken: String(match[2] || "").trim(),
  };
}

function buildSectionLookupKey(classId: string, sectionName: string) {
  return `${classId}::${toUploadLookupKey(sectionName)}`;
}

function toRollLookupKey(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function chunkArray<T>(items: T[], chunkSize: number) {
  if (items.length <= chunkSize) {
    return [items];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    Number((error as { code?: unknown }).code) === 11000
  );
}

function stringifyUnknownError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

function invalidateStudentAccessCaches(params: {
  schoolKey: string;
  studentId: string;
  previousClassId?: string;
  nextClassId?: string;
}) {
  const {
    schoolKey,
    studentId,
    previousClassId = "",
    nextClassId = "",
  } = params;

  invalidateStudentSessionValidationCache({ schoolKey, studentId });
  invalidateStudentTestResourceCache({ schoolKey, studentId });

  if (previousClassId) {
    invalidateStudentTestResourceCache({ schoolKey, classId: previousClassId });
  }
  if (nextClassId && nextClassId !== previousClassId) {
    invalidateStudentTestResourceCache({ schoolKey, classId: nextClassId });
  }
}

async function recordTenantAuditSafe(
  params: Parameters<typeof recordTenantAudit>[0],
) {
  try {
    await recordTenantAudit(params);
  } catch (error) {
    console.error("Bulk upload audit write failed:", error);
  }
}

type PreparedUploadRow = {
  rowNumber: number;
  source: any;
  normalizedStudent: any;
  name: string;
  email: string | undefined;
  password: string | undefined;
  role: string;
  gender: ReturnType<typeof normalizeUserGender>;
  fatherName: string;
  classId: string;
  academicSectionId: string;
  finalRollNumber: string;
  finalMobileNumber: string;
  normalizedClassIds: string[];
  normalizedAcademicSectionIds: string[];
  normalizedSubjectIds: string[];
  allowAllClasses: boolean;
  allowAllSections: boolean;
  allowAllSubjects: boolean;
  scopedClassIds: string[];
  scopedAcademicSectionIds: string[];
  scopedSubjectIds: string[];
};

function prepareUploadRow(student: any, index: number): PreparedUploadRow {
  const normalizedStudent: any = {};
  Object.keys(student || {}).forEach((key) => {
    normalizedStudent[key.toLowerCase()] = (student as any)[key];
  });

  const role = String(normalizedStudent.role || "").trim();
  const finalMobileNumber = String(
    normalizedStudent.mobilenumber || normalizedStudent.mobileNumber || "",
  ).trim();
  const finalRollNumber = normalizeRollNumber(
    normalizedStudent.rollnumber || normalizedStudent.rollNumber,
  );
  const scope = resolveUserScope({
    role,
    classIds: normalizedStudent.classids,
    academicSectionIds:
      normalizedStudent.academicsectionids ?? normalizedStudent.sectionids,
    subjectIds: normalizedStudent.subjectids,
    hasAllClasses: normalizedStudent.hasallclasses,
    hasAllSections: normalizedStudent.hasallsections,
    hasAllSubjects: normalizedStudent.hasallsubjects,
  });

  return {
    rowNumber: index + 1,
    source: student,
    normalizedStudent,
    name: String(normalizedStudent.name || "").trim(),
    email: normalizeEmail(normalizedStudent.email),
    password: normalizedStudent.password
      ? String(normalizedStudent.password)
      : undefined,
    role,
    gender: normalizeUserGender(normalizedStudent.gender),
    fatherName: String(normalizedStudent.fathername || "").trim(),
    classId: normalizeId(normalizedStudent.classid ?? normalizedStudent.class),
    academicSectionId: normalizeId(
      normalizedStudent.academicsectionid ??
        normalizedStudent.academicsection ??
        normalizedStudent.sectionid ??
        normalizedStudent.section,
    ),
    finalRollNumber,
    finalMobileNumber,
    normalizedClassIds: scope.normalizedClassIds,
    normalizedAcademicSectionIds: scope.normalizedAcademicSectionIds,
    normalizedSubjectIds: scope.normalizedSubjectIds,
    allowAllClasses: scope.allowAllClasses,
    allowAllSections: scope.allowAllSections,
    allowAllSubjects: scope.allowAllSubjects,
    scopedClassIds: scope.scopedClassIds,
    scopedAcademicSectionIds: scope.scopedAcademicSectionIds,
    scopedSubjectIds: scope.scopedSubjectIds,
  };
}

function buildUploadConflictMap(rows: PreparedUploadRow[]) {
  const conflictsByRow = new Map<number, string[]>();
  const seenByEmail = new Map<string, number>();
  const seenByRollNumber = new Map<string, number>();

  const addConflict = (rowNumber: number, message: string) => {
    const existing = conflictsByRow.get(rowNumber) || [];
    conflictsByRow.set(rowNumber, [...existing, message]);
  };

  rows.forEach((row) => {
    if (row.email) {
      const existingRowNumber = seenByEmail.get(row.email);
      if (existingRowNumber) {
        addConflict(
          row.rowNumber,
          `Duplicate email in upload (matches row ${existingRowNumber}).`,
        );
      } else {
        seenByEmail.set(row.email, row.rowNumber);
      }
    }

    if (row.role === "student" && row.finalRollNumber) {
      const rollKey = toRollLookupKey(row.finalRollNumber);
      const existingRowNumber = seenByRollNumber.get(rollKey);
      if (existingRowNumber) {
        addConflict(
          row.rowNumber,
          `Duplicate student rollNumber in upload (matches row ${existingRowNumber}).`,
        );
      } else {
        seenByRollNumber.set(rollKey, row.rowNumber);
      }
    }
  });

  return conflictsByRow;
}

async function preloadExistingUsersByEmail(
  UserModel: any,
  emails: string[],
) {
  const map = new Map<string, any>();
  const uniqueEmails = Array.from(new Set(emails.map((item) => String(item).trim())))
    .map((item) => normalizeEmail(item))
    .filter((item): item is string => Boolean(item));

  if (!uniqueEmails.length) {
    return map;
  }

  const existingUsers = await UserModel.find({
    email: { $in: uniqueEmails },
  })
    .select("_id email role class academicSection rollNumber")
    .lean();

  existingUsers.forEach((existingUser: any) => {
    const normalizedEmail = normalizeEmail(existingUser?.email);
    if (!normalizedEmail) {
      return;
    }
    map.set(normalizedEmail, existingUser);
  });

  return map;
}

async function preloadExistingStudentsByRollNumber(
  UserModel: any,
  rollNumbers: string[],
) {
  const map = new Map<string, any[]>();
  const uniqueRollNumbers = Array.from(
    new Set(rollNumbers.map((item) => normalizeRollNumber(item)).filter(Boolean)),
  );

  if (!uniqueRollNumbers.length) {
    return map;
  }

  const chunks = chunkArray(uniqueRollNumbers, ROLL_LOOKUP_CHUNK_SIZE);
  for (const chunk of chunks) {
    const rollNumberMatchers = chunk.map((rollNumber) => ({
      rollNumber: new RegExp(`^${escapeRegExp(rollNumber)}$`, "i"),
    }));

    const existingStudents = await UserModel.find({
      role: "student",
      ...buildArchiveFilter(false),
      $or: rollNumberMatchers,
    })
      .select("_id name email class academicSection rollNumber")
      .lean();

    existingStudents.forEach((existingStudent: any) => {
      const key = toRollLookupKey(existingStudent?.rollNumber);
      if (!key) {
        return;
      }
      const existingEntries = map.get(key) || [];
      map.set(key, [...existingEntries, existingStudent]);
    });
  }

  return map;
}

type CachedClassRecord = {
  _id: string;
  name: string;
  description?: string;
  isArchived?: boolean;
};

type CachedSectionRecord = {
  _id: string;
  name: string;
  classId: string;
  description?: string;
  isActive?: boolean;
  isArchived?: boolean;
};

type CachedSubjectRecord = {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  isArchived?: boolean;
};

type StructureChangeItem = {
  _id: string;
  name: string;
  classId?: string;
  className?: string;
};

type StructureState = {
  classById: Map<string, CachedClassRecord>;
  classByLookupKey: Map<string, CachedClassRecord>;
  sectionById: Map<string, CachedSectionRecord>;
  sectionByClassLookupKey: Map<string, CachedSectionRecord>;
  sectionsByLookupKey: Map<string, CachedSectionRecord[]>;
  subjectById: Map<string, CachedSubjectRecord>;
  subjectByLookupKey: Map<string, CachedSubjectRecord>;
  createdClasses: StructureChangeItem[];
  restoredClasses: StructureChangeItem[];
  createdSections: StructureChangeItem[];
  restoredSections: StructureChangeItem[];
  createdSubjects: StructureChangeItem[];
  restoredSubjects: StructureChangeItem[];
  createdClassIds: Set<string>;
  restoredClassIds: Set<string>;
  createdSectionIds: Set<string>;
  restoredSectionIds: Set<string>;
  createdSubjectIds: Set<string>;
  restoredSubjectIds: Set<string>;
};

function createStructureState(): StructureState {
  return {
    classById: new Map(),
    classByLookupKey: new Map(),
    sectionById: new Map(),
    sectionByClassLookupKey: new Map(),
    sectionsByLookupKey: new Map(),
    subjectById: new Map(),
    subjectByLookupKey: new Map(),
    createdClasses: [],
    restoredClasses: [],
    createdSections: [],
    restoredSections: [],
    createdSubjects: [],
    restoredSubjects: [],
    createdClassIds: new Set(),
    restoredClassIds: new Set(),
    createdSectionIds: new Set(),
    restoredSectionIds: new Set(),
    createdSubjectIds: new Set(),
    restoredSubjectIds: new Set(),
  };
}

function rememberClass(state: StructureState, rawClass: any) {
  const classRecord: CachedClassRecord = {
    _id: String(rawClass?._id || ""),
    name: String(rawClass?.name || "").trim(),
    description: rawClass?.description
      ? String(rawClass.description).trim()
      : undefined,
    isArchived: Boolean(rawClass?.isArchived),
  };

  if (!classRecord._id || !classRecord.name) {
    return null;
  }

  state.classById.set(classRecord._id, classRecord);
  state.classByLookupKey.set(toUploadLookupKey(classRecord.name), classRecord);
  return classRecord;
}

function rememberSection(state: StructureState, rawSection: any) {
  const classId = String(
    rawSection?.class?._id || rawSection?.class || rawSection?.classId || "",
  );
  const sectionRecord: CachedSectionRecord = {
    _id: String(rawSection?._id || ""),
    name: String(rawSection?.name || "").trim(),
    classId,
    description: rawSection?.description
      ? String(rawSection.description).trim()
      : undefined,
    isActive:
      typeof rawSection?.isActive === "boolean"
        ? rawSection.isActive
        : undefined,
    isArchived: Boolean(rawSection?.isArchived),
  };

  if (!sectionRecord._id || !sectionRecord.name || !sectionRecord.classId) {
    return null;
  }

  state.sectionById.set(sectionRecord._id, sectionRecord);
  state.sectionByClassLookupKey.set(
    buildSectionLookupKey(sectionRecord.classId, sectionRecord.name),
    sectionRecord,
  );

  const lookupKey = toUploadLookupKey(sectionRecord.name);
  const existing = state.sectionsByLookupKey.get(lookupKey) || [];
  state.sectionsByLookupKey.set(
    lookupKey,
    [...existing.filter((item) => item._id !== sectionRecord._id), sectionRecord],
  );

  return sectionRecord;
}

function rememberSubject(state: StructureState, rawSubject: any) {
  const subjectRecord: CachedSubjectRecord = {
    _id: String(rawSubject?._id || ""),
    name: String(rawSubject?.name || "").trim(),
    code: rawSubject?.code ? String(rawSubject.code).trim() : undefined,
    description: rawSubject?.description
      ? String(rawSubject.description).trim()
      : undefined,
    isArchived: Boolean(rawSubject?.isArchived),
  };

  if (!subjectRecord._id || !subjectRecord.name) {
    return null;
  }

  state.subjectById.set(subjectRecord._id, subjectRecord);
  state.subjectByLookupKey.set(
    toUploadLookupKey(subjectRecord.name),
    subjectRecord,
  );

  if (subjectRecord.code) {
    state.subjectByLookupKey.set(
      toUploadLookupKey(subjectRecord.code),
      subjectRecord,
    );
  }

  return subjectRecord;
}

function pushStructureChange(
  target: StructureChangeItem[],
  seen: Set<string>,
  item: StructureChangeItem,
) {
  if (!item._id || seen.has(item._id)) {
    return;
  }

  seen.add(item._id);
  target.push(item);
}

async function restoreClassRecord({
  record,
  ClassModel,
  schoolKey,
  request,
  state,
}: {
  record: CachedClassRecord;
  ClassModel: any;
  schoolKey: string;
  request: NextRequest;
  state: StructureState;
}) {
  if (!record.isArchived) {
    return record;
  }

  const restored = await ClassModel.findByIdAndUpdate(
    record._id,
    {
      ...buildRestoreUpdate(),
    },
    { new: true, runValidators: true },
  )
    .select("name description isArchived")
    .lean();

  const nextRecord = rememberClass(state, restored || record) || record;

  pushStructureChange(
    state.restoredClasses,
    state.restoredClassIds,
    {
      _id: nextRecord._id,
      name: nextRecord.name,
    },
  );

  await recordTenantAuditSafe({
    schoolKey,
    req: request,
    entityType: "class",
    entityId: nextRecord._id,
    entityLabel: nextRecord.name,
    action: "restored",
    summary: `Restored class ${nextRecord.name}.`,
    details: { via: "user_bulk_upload" },
  });

  return nextRecord;
}

async function createClassRecord({
  name,
  ClassModel,
  schoolKey,
  request,
  state,
}: {
  name: string;
  ClassModel: any;
  schoolKey: string;
  request: NextRequest;
  state: StructureState;
}) {
  let nextRecord: CachedClassRecord | null = null;
  let didCreate = false;
  try {
    const created = await ClassModel.create({
      name,
    });
    didCreate = true;
    nextRecord = rememberClass(state, created.toObject()) || {
      _id: String(created._id),
      name: String(created.name || "").trim(),
    };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const existing = await ClassModel.findOne({ name })
      .select("name description isArchived")
      .lean();
    nextRecord = existing ? rememberClass(state, existing) : null;
  }

  if (!nextRecord) {
    throw new Error(`Class "${name}" could not be created or resolved.`);
  }

  if (!didCreate) {
    return nextRecord;
  }

  pushStructureChange(
    state.createdClasses,
    state.createdClassIds,
    {
      _id: nextRecord._id,
      name: nextRecord.name,
    },
  );

  await recordTenantAuditSafe({
    schoolKey,
    req: request,
    entityType: "class",
    entityId: nextRecord._id,
    entityLabel: nextRecord.name,
    action: "created",
    summary: `Created class ${nextRecord.name}.`,
    details: { via: "user_bulk_upload" },
  });

  return nextRecord;
}

async function ensureClassRecord(
  value: unknown,
  context: {
    ClassModel: any;
    schoolKey: string;
    request: NextRequest;
    state: StructureState;
  },
) {
  const token = String(value || "").trim();
  if (!token) {
    return {
      ok: false,
      message: "Class name is required.",
    } as const;
  }

  const directMatch = context.state.classById.get(token);
  if (directMatch) {
    return {
      ok: true,
      record: await restoreClassRecord({
        record: directMatch,
        ...context,
      }),
    } as const;
  }

  const lookupMatch = context.state.classByLookupKey.get(
    toUploadLookupKey(token),
  );
  if (lookupMatch) {
    return {
      ok: true,
      record: await restoreClassRecord({
        record: lookupMatch,
        ...context,
      }),
    } as const;
  }

  return {
    ok: true,
    record: await createClassRecord({
      name: token,
      ...context,
    }),
  } as const;
}

async function restoreSectionRecord({
  record,
  AcademicSectionModel,
  schoolKey,
  request,
  state,
}: {
  record: CachedSectionRecord;
  AcademicSectionModel: any;
  schoolKey: string;
  request: NextRequest;
  state: StructureState;
}) {
  if (!record.isArchived) {
    return record;
  }

  const restored = await AcademicSectionModel.findByIdAndUpdate(
    record._id,
    {
      ...buildRestoreUpdate(),
      isActive: typeof record.isActive === "boolean" ? record.isActive : true,
    },
    { new: true, runValidators: true },
  )
    .select("name class description isActive isArchived")
    .lean();

  const nextRecord = rememberSection(state, restored || record) || record;
  const className = state.classById.get(nextRecord.classId)?.name || "";

  pushStructureChange(
    state.restoredSections,
    state.restoredSectionIds,
    {
      _id: nextRecord._id,
      name: nextRecord.name,
      classId: nextRecord.classId,
      className,
    },
  );

  await recordTenantAuditSafe({
    schoolKey,
    req: request,
    entityType: "academic_section",
    entityId: nextRecord._id,
    entityLabel: nextRecord.name,
    action: "restored",
    summary: `Restored section ${nextRecord.name}.`,
    details: {
      classId: nextRecord.classId,
      className,
      via: "user_bulk_upload",
    },
  });

  return nextRecord;
}

async function createSectionRecord({
  classRecord,
  name,
  AcademicSectionModel,
  schoolKey,
  request,
  state,
}: {
  classRecord: CachedClassRecord;
  name: string;
  AcademicSectionModel: any;
  schoolKey: string;
  request: NextRequest;
  state: StructureState;
}) {
  let nextRecord: CachedSectionRecord | null = null;
  let didCreate = false;
  try {
    const created = await AcademicSectionModel.create({
      name,
      class: classRecord._id,
      isActive: true,
    });
    didCreate = true;
    nextRecord = rememberSection(state, created.toObject()) || {
      _id: String(created._id),
      name: String(created.name || "").trim(),
      classId: classRecord._id,
    };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const existing = await AcademicSectionModel.findOne({
      class: classRecord._id,
      name,
    })
      .select("name class description isActive isArchived")
      .lean();
    nextRecord = existing ? rememberSection(state, existing) : null;
  }

  if (!nextRecord) {
    throw new Error(
      `Section "${name}" could not be created or resolved for class "${classRecord.name}".`,
    );
  }

  if (!didCreate) {
    return nextRecord;
  }

  pushStructureChange(
    state.createdSections,
    state.createdSectionIds,
    {
      _id: nextRecord._id,
      name: nextRecord.name,
      classId: nextRecord.classId,
      className: classRecord.name,
    },
  );

  await recordTenantAuditSafe({
    schoolKey,
    req: request,
    entityType: "academic_section",
    entityId: nextRecord._id,
    entityLabel: nextRecord.name,
    action: "created",
    summary: `Created section ${nextRecord.name}.`,
    details: {
      classId: classRecord._id,
      className: classRecord.name,
      via: "user_bulk_upload",
    },
  });

  return nextRecord;
}

async function restoreSubjectRecord({
  record,
  SubjectModel,
  schoolKey,
  request,
  state,
}: {
  record: CachedSubjectRecord;
  SubjectModel: any;
  schoolKey: string;
  request: NextRequest;
  state: StructureState;
}) {
  if (!record.isArchived) {
    return record;
  }

  const restored = await SubjectModel.findByIdAndUpdate(
    record._id,
    {
      ...buildRestoreUpdate(),
      name: record.name,
      code: record.code || undefined,
      description: record.description,
    },
    { new: true, runValidators: true },
  )
    .select("name code description isArchived")
    .lean();

  const nextRecord = rememberSubject(state, restored || record) || record;

  pushStructureChange(
    state.restoredSubjects,
    state.restoredSubjectIds,
    {
      _id: nextRecord._id,
      name: nextRecord.name,
    },
  );

  await recordTenantAuditSafe({
    schoolKey,
    req: request,
    entityType: "subject",
    entityId: nextRecord._id,
    entityLabel: nextRecord.name,
    action: "restored",
    summary: `Restored subject ${nextRecord.name}.`,
    details: { via: "user_bulk_upload" },
  });

  return nextRecord;
}

async function createSubjectRecord({
  name,
  SubjectModel,
  schoolKey,
  request,
  state,
}: {
  name: string;
  SubjectModel: any;
  schoolKey: string;
  request: NextRequest;
  state: StructureState;
}) {
  let nextRecord: CachedSubjectRecord | null = null;
  let didCreate = false;
  try {
    const created = await SubjectModel.create({
      name,
    });
    didCreate = true;
    nextRecord = rememberSubject(state, created.toObject()) || {
      _id: String(created._id),
      name: String(created.name || "").trim(),
    };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const existing = await SubjectModel.findOne({ name })
      .select("name code description isArchived")
      .lean();
    nextRecord = existing ? rememberSubject(state, existing) : null;
  }

  if (!nextRecord) {
    throw new Error(`Subject "${name}" could not be created or resolved.`);
  }

  if (!didCreate) {
    return nextRecord;
  }

  pushStructureChange(
    state.createdSubjects,
    state.createdSubjectIds,
    {
      _id: nextRecord._id,
      name: nextRecord.name,
    },
  );

  await recordTenantAuditSafe({
    schoolKey,
    req: request,
    entityType: "subject",
    entityId: nextRecord._id,
    entityLabel: nextRecord.name,
    action: "created",
    summary: `Created subject ${nextRecord.name}.`,
    details: { via: "user_bulk_upload" },
  });

  return nextRecord;
}

async function ensureSectionForClass({
  classRecord,
  name,
  AcademicSectionModel,
  schoolKey,
  request,
  state,
}: {
  classRecord: CachedClassRecord;
  name: string;
  AcademicSectionModel: any;
  schoolKey: string;
  request: NextRequest;
  state: StructureState;
}) {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) {
    return {
      ok: false,
      message: "Section name is required.",
    } as const;
  }

  const lookupMatch = state.sectionByClassLookupKey.get(
    buildSectionLookupKey(classRecord._id, normalizedName),
  );
  if (lookupMatch) {
    return {
      ok: true,
      record: await restoreSectionRecord({
        record: lookupMatch,
        AcademicSectionModel,
        schoolKey,
        request,
        state,
      }),
    } as const;
  }

  return {
    ok: true,
    record: await createSectionRecord({
      classRecord,
      name: normalizedName,
      AcademicSectionModel,
      schoolKey,
      request,
      state,
    }),
  } as const;
}

async function ensureSubjectRecord(
  value: unknown,
  context: {
    SubjectModel: any;
    schoolKey: string;
    request: NextRequest;
    state: StructureState;
  },
) {
  const token = String(value || "").trim();
  if (!token) {
    return {
      ok: false,
      message: "Subject name is required.",
    } as const;
  }

  const directMatch = context.state.subjectById.get(token);
  if (directMatch) {
    return {
      ok: true,
      record: await restoreSubjectRecord({
        record: directMatch,
        ...context,
      }),
    } as const;
  }

  const lookupMatch = context.state.subjectByLookupKey.get(
    toUploadLookupKey(token),
  );
  if (lookupMatch) {
    return {
      ok: true,
      record: await restoreSubjectRecord({
        record: lookupMatch,
        ...context,
      }),
    } as const;
  }

  return {
    ok: true,
    record: await createSubjectRecord({
      name: token,
      ...context,
    }),
  } as const;
}

async function ensureSectionRecord({
  value,
  classScopeIds,
  classContextMessage,
  ClassModel,
  AcademicSectionModel,
  schoolKey,
  request,
  state,
}: {
  value: unknown;
  classScopeIds: string[];
  classContextMessage: string;
  ClassModel: any;
  AcademicSectionModel: any;
  schoolKey: string;
  request: NextRequest;
  state: StructureState;
}) {
  const token = String(value || "").trim();
  if (!token) {
    return {
      ok: true,
      record: null,
    } as const;
  }

  const directMatch = state.sectionById.get(token);
  if (directMatch) {
    const nextRecord = await restoreSectionRecord({
      record: directMatch,
      AcademicSectionModel,
      schoolKey,
      request,
      state,
    });

    if (
      classScopeIds.length > 0 &&
      !classScopeIds.includes(nextRecord.classId)
    ) {
      return {
        ok: false,
        message: `Section "${nextRecord.name}" ${classContextMessage}`,
      } as const;
    }

    return {
      ok: true,
      record: nextRecord,
    } as const;
  }

  const parsed = parseClassSectionToken(token);
  if (parsed?.classToken) {
    const classResult = await ensureClassRecord(parsed.classToken, {
      ClassModel,
      schoolKey,
      request,
      state,
    });
    if (!classResult.ok) {
      return classResult;
    }

    if (
      classScopeIds.length > 0 &&
      !classScopeIds.includes(classResult.record._id)
    ) {
      return {
        ok: false,
        message: `Section "${token}" ${classContextMessage}`,
      } as const;
    }

    return ensureSectionForClass({
      classRecord: classResult.record,
      name: parsed.sectionToken,
      AcademicSectionModel,
      schoolKey,
      request,
      state,
    });
  }

  const candidateSections = (state.sectionsByLookupKey.get(
    toUploadLookupKey(token),
  ) || []).filter((sectionRecord) =>
    classScopeIds.length > 0
      ? classScopeIds.includes(sectionRecord.classId)
      : true,
  );

  if (candidateSections.length === 1) {
    return {
      ok: true,
      record: await restoreSectionRecord({
        record: candidateSections[0],
        AcademicSectionModel,
        schoolKey,
        request,
        state,
      }),
    } as const;
  }

  if (classScopeIds.length === 1) {
    const classRecord = state.classById.get(classScopeIds[0]);
    if (!classRecord) {
      return {
        ok: false,
        message: "Selected class was not found while resolving sections.",
      } as const;
    }

    return ensureSectionForClass({
      classRecord,
      name: token,
      AcademicSectionModel,
      schoolKey,
      request,
      state,
    });
  }

  if (candidateSections.length > 1) {
    return {
      ok: false,
      message: `Section "${token}" matches multiple classes. Use "Class Name:Section Name".`,
    } as const;
  }

  return {
    ok: false,
    message: `Section "${token}" needs a class prefix like "Class Name:Section Name" so it can be created in the right class.`,
  } as const;
}

async function resolveClassTokens(
  values: unknown,
  context: {
    ClassModel: any;
    schoolKey: string;
    request: NextRequest;
    state: StructureState;
  },
) {
  const ids = new Set<string>();

  for (const token of splitUploadTokens(values)) {
    const classResult = await ensureClassRecord(token, context);
    if (!classResult.ok) {
      return classResult;
    }
    ids.add(classResult.record._id);
  }

  return {
    ok: true,
    ids: Array.from(ids),
  } as const;
}

async function resolveSectionTokens({
  values,
  classScopeIds,
  classContextMessage,
  ClassModel,
  AcademicSectionModel,
  schoolKey,
  request,
  state,
}: {
  values: unknown;
  classScopeIds: string[];
  classContextMessage: string;
  ClassModel: any;
  AcademicSectionModel: any;
  schoolKey: string;
  request: NextRequest;
  state: StructureState;
}) {
  const ids = new Set<string>();

  for (const token of splitUploadTokens(values)) {
    const normalizedToken = String(token || "").trim();
    const hasDirectSectionMatch = state.sectionById.has(normalizedToken);
    const isClassScopedToken = Boolean(parseClassSectionToken(normalizedToken));

    if (
      normalizedToken &&
      !hasDirectSectionMatch &&
      !isClassScopedToken &&
      classScopeIds.length > 1
    ) {
      for (const classId of classScopeIds) {
        const classRecord = state.classById.get(classId);
        if (!classRecord) {
          return {
            ok: false,
            message: "Selected class was not found while resolving sections.",
          } as const;
        }

        const sectionResult = await ensureSectionForClass({
          classRecord,
          name: normalizedToken,
          AcademicSectionModel,
          schoolKey,
          request,
          state,
        });
        if (!sectionResult.ok) {
          return sectionResult;
        }
        if (sectionResult.record?._id) {
          ids.add(sectionResult.record._id);
        }
      }
      continue;
    }

    const sectionResult = await ensureSectionRecord({
      value: normalizedToken,
      classScopeIds,
      classContextMessage,
      ClassModel,
      AcademicSectionModel,
      schoolKey,
      request,
      state,
    });
    if (!sectionResult.ok) {
      return sectionResult;
    }
    if (sectionResult.record?._id) {
      ids.add(sectionResult.record._id);
    }
  }

  return {
    ok: true,
    ids: Array.from(ids),
  } as const;
}

async function resolveSubjectTokens(
  values: unknown,
  context: {
    SubjectModel: any;
    schoolKey: string;
    request: NextRequest;
    state: StructureState;
  },
) {
  const ids = new Set<string>();

  for (const token of splitUploadTokens(values)) {
    const subjectResult = await ensureSubjectRecord(token, context);
    if (!subjectResult.ok) {
      return subjectResult;
    }
    ids.add(subjectResult.record._id);
  }

  return {
    ok: true,
    ids: Array.from(ids),
  } as const;
}

function resolveUserScope({
  role,
  classIds,
  academicSectionIds,
  subjectIds,
  hasAllClasses,
  hasAllSections,
  hasAllSubjects,
}: {
  role: string;
  classIds?: unknown;
  academicSectionIds?: unknown;
  subjectIds?: unknown;
  hasAllClasses?: unknown;
  hasAllSections?: unknown;
  hasAllSubjects?: unknown;
}) {
  const normalizedClassIds = normalizeIds(classIds);
  const normalizedAcademicSectionIds = normalizeIds(academicSectionIds);
  const normalizedSubjectIds = normalizeIds(subjectIds);
  let allowAllClasses = Boolean(hasAllClasses);
  let allowAllSections =
    typeof hasAllSections === "boolean" ? hasAllSections : role !== "student";
  let allowAllSubjects = Boolean(hasAllSubjects);

  if (
    role === "admin" &&
    !allowAllClasses &&
    !allowAllSubjects &&
    normalizedClassIds.length === 0 &&
    normalizedSubjectIds.length === 0
  ) {
    allowAllClasses = true;
    allowAllSections = true;
    allowAllSubjects = true;
  }

  return {
    normalizedClassIds,
    normalizedAcademicSectionIds,
    normalizedSubjectIds,
    allowAllClasses,
    allowAllSections,
    allowAllSubjects,
    scopedClassIds: role === "admin" && allowAllClasses ? [] : normalizedClassIds,
    scopedAcademicSectionIds:
      role !== "student" && allowAllSections ? [] : normalizedAcademicSectionIds,
    scopedSubjectIds:
      role === "admin" && allowAllSubjects ? [] : normalizedSubjectIds,
  };
}

async function validateStudentAcademicSection(
  AcademicSectionModel: any,
  state: StructureState,
  classId: string,
  academicSectionId: string,
) {
  if (!academicSectionId) {
    return { ok: true } as const;
  }

  if (!mongoose.Types.ObjectId.isValid(academicSectionId)) {
    return {
      ok: false,
      message: "Invalid academicSectionId.",
    } as const;
  }

  const knownSection = state.sectionById.get(academicSectionId);
  if (knownSection) {
    if (classId && String(knownSection.classId) !== String(classId)) {
      return {
        ok: false,
        message: "Selected section does not belong to the selected class.",
      } as const;
    }
    return { ok: true } as const;
  }

  const academicSection = await AcademicSectionModel.findById(academicSectionId)
    .select("name class description isActive isArchived")
    .lean();
  if (!academicSection) {
    return {
      ok: false,
      message: "Academic section not found.",
    } as const;
  }

  rememberSection(state, academicSection);

  if (classId && String((academicSection as any).class) !== String(classId)) {
    return {
      ok: false,
      message: "Selected section does not belong to the selected class.",
    } as const;
  }

  return { ok: true } as const;
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession(request, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) return auth.response;
  let studentRowCount: number | null = null;

  try {
    const schoolKey = auth.schoolKey as string;

    await connectDB();

    const {
      User: UserModel,
      AcademicSection: AcademicSectionModel,
      Class: ClassModel,
      Subject: SubjectModel,
    } = await getTenantModels(schoolKey, [
      "User",
      "AcademicSection",
      "Class",
      "Subject",
    ]);

    const payload = await request.json();
    const students = Array.isArray(payload?.users)
      ? payload.users
      : payload?.students;
    studentRowCount = Array.isArray(students) ? students.length : null;
    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { success: false, message: "No students provided." },
        { status: 400 },
      );
    }
    if (students.length > MAX_BULK_UPLOAD_ROWS) {
      return NextResponse.json(
        {
          success: false,
          message: `Upload is too large. Maximum ${MAX_BULK_UPLOAD_ROWS} rows are supported per request.`,
        },
        { status: 400 },
      );
    }

    const structureState = createStructureState();
    const preparedRows = students.map((student, index) =>
      prepareUploadRow(student, index),
    );
    const conflictsByRow = buildUploadConflictMap(preparedRows);
    const [existingClasses, existingSections, existingSubjects] = await Promise.all([
      ClassModel.find({})
        .select("name description isArchived")
        .lean(),
      AcademicSectionModel.find({})
        .select("name class description isActive isArchived")
        .lean(),
      SubjectModel.find({})
        .select("name code description isArchived")
        .lean(),
    ]);

    existingClasses.forEach((classRecord: any) => {
      rememberClass(structureState, classRecord);
    });
    existingSections.forEach((sectionRecord: any) => {
      rememberSection(structureState, sectionRecord);
    });
    existingSubjects.forEach((subjectRecord: any) => {
      rememberSubject(structureState, subjectRecord);
    });

    const [existingUsersByEmail, existingStudentsByRollNumber] = await Promise.all([
      preloadExistingUsersByEmail(
        UserModel,
        preparedRows
          .map((row) => row.email)
          .filter((value): value is string => Boolean(value)),
      ),
      preloadExistingStudentsByRollNumber(
        UserModel,
        preparedRows
          .filter((row) => row.role === "student")
          .map((row) => row.finalRollNumber)
          .filter(Boolean),
      ),
    ]);

    const results: any[] = [];
    for (const row of preparedRows) {
      const student = row.source;
      const rowNumber = row.rowNumber;
      const pushResult = (result: Record<string, unknown>) => {
        results.push({ rowNumber, ...result });
      };
      const rowConflictMessages = conflictsByRow.get(row.rowNumber);
      if (rowConflictMessages?.length) {
        pushResult({
          success: false,
          message: rowConflictMessages.join(" "),
          student,
        });
        continue;
      }

      try {
        const {
          normalizedStudent,
          name,
          email,
          password,
          role,
          gender,
          fatherName,
          classId,
          academicSectionId,
          finalRollNumber,
          finalMobileNumber,
          normalizedClassIds,
          normalizedAcademicSectionIds,
          normalizedSubjectIds,
          allowAllClasses,
          allowAllSections,
          allowAllSubjects,
          scopedClassIds,
          scopedAcademicSectionIds,
          scopedSubjectIds,
        } = row;

        if (!name || !role) {
        pushResult({
          success: false,
          message: "Name and role are required.",
          student,
        });
          continue;
        }
        if (role === "student" && !finalRollNumber) {
          pushResult({
            success: false,
            message: "rollNumber is required for students.",
            student,
          });
          continue;
        }
        if (!finalMobileNumber || !String(finalMobileNumber).trim()) {
          pushResult({
            success: false,
            message: "Phone number is required.",
            student,
          });
          continue;
        }
        if (role === "student") {
          const studentPasswordSourceValidation =
            validateStudentDefaultPasswordSource(finalMobileNumber);
          if (!studentPasswordSourceValidation.ok) {
            pushResult({
              success: false,
              message: studentPasswordSourceValidation.message,
              student,
            });
            continue;
          }
        }
        if (
          role === "teacher" &&
          (normalizedClassIds.length === 0 || normalizedSubjectIds.length === 0)
        ) {
          pushResult({
            success: false,
            message: "Teachers must have at least one class and one subject.",
            student,
          });
          continue;
        }

        const structureContext = {
          ClassModel,
          AcademicSectionModel,
          schoolKey,
          request,
          state: structureState,
        };
        let resolvedClassId = classId;
        let resolvedAcademicSectionId = academicSectionId;
        let resolvedScopedClassIds = scopedClassIds;
        let resolvedScopedAcademicSectionIds = scopedAcademicSectionIds;
        let resolvedScopedSubjectIds = scopedSubjectIds;

        if (role === "student") {
          const classResolution = await ensureClassRecord(classId, {
            ClassModel,
            schoolKey,
            request,
            state: structureState,
          });
          if (!classResolution.ok) {
            pushResult({
              success: false,
              message: classResolution.message,
              student,
            });
            continue;
          }

          resolvedClassId = classResolution.record._id;

          if (academicSectionId) {
            const sectionResolution = await ensureSectionRecord({
              value: academicSectionId,
              classScopeIds: [resolvedClassId],
              classContextMessage: "does not belong to the selected class.",
              ...structureContext,
            });
            if (!sectionResolution.ok) {
              pushResult({
                success: false,
                message: sectionResolution.message,
                student,
              });
              continue;
            }

            resolvedAcademicSectionId = sectionResolution.record?._id || "";
          } else {
            resolvedAcademicSectionId = "";
          }
        } else {
          if (!(role === "admin" && allowAllClasses)) {
            const classResolution = await resolveClassTokens(normalizedClassIds, {
              ClassModel,
              schoolKey,
              request,
              state: structureState,
            });
            if (!classResolution.ok) {
              pushResult({
                success: false,
                message: classResolution.message,
                student,
              });
              continue;
            }
            resolvedScopedClassIds = classResolution.ids;
          } else {
            resolvedScopedClassIds = [];
          }

          if (!allowAllSections) {
            const sectionResolution = await resolveSectionTokens({
              values: normalizedAcademicSectionIds,
              classScopeIds: resolvedScopedClassIds,
              classContextMessage:
                "does not belong to the classes listed in this row.",
              ...structureContext,
            });
            if (!sectionResolution.ok) {
              pushResult({
                success: false,
                message: sectionResolution.message,
                student,
              });
              continue;
            }
            resolvedScopedAcademicSectionIds = sectionResolution.ids;
          } else {
            resolvedScopedAcademicSectionIds = [];
          }

          if (!(role === "admin" && allowAllSubjects)) {
            const subjectResolution = await resolveSubjectTokens(
              normalizedSubjectIds,
              {
                SubjectModel,
                schoolKey,
                request,
                state: structureState,
              },
            );
            if (!subjectResolution.ok) {
              pushResult({
                success: false,
                message: subjectResolution.message,
                student,
              });
              continue;
            }
            resolvedScopedSubjectIds = subjectResolution.ids;
          } else {
            resolvedScopedSubjectIds = [];
          }
        }

        if (role === "student" && resolvedClassId && resolvedAcademicSectionId) {
          const sectionValidation = await validateStudentAcademicSection(
            AcademicSectionModel,
            structureState,
            resolvedClassId,
            resolvedAcademicSectionId,
          );
          if (!sectionValidation.ok) {
            pushResult({
              success: false,
              message: sectionValidation.message,
              student,
            });
            continue;
          }
        }

        let existingStudentMatch: any | null = null;
        if (role === "student" && finalRollNumber) {
          const rollLookupKey = toRollLookupKey(finalRollNumber);
          const existingStudents =
            existingStudentsByRollNumber.get(rollLookupKey) || [];

          if (existingStudents.length > 1) {
            pushResult({
              success: false,
              message:
                "Multiple students share this roll number. Resolve duplicates before updating.",
              student,
            });
            continue;
          }

          if (existingStudents.length === 1) {
            existingStudentMatch = existingStudents[0];
          }
        }

        if (email) {
          const existingUser = existingUsersByEmail.get(email);
          if (existingUser && (!existingStudentMatch || String(existingUser._id) !== String(existingStudentMatch._id))) {
            pushResult({
              success: false,
              message: "A user with this email already exists.",
              student,
            });
            continue;
          }
        }

        const effectivePassword = resolveUserPasswordInput({
          role,
          rollNumber: finalRollNumber,
          mobileNumber: String(finalMobileNumber).trim(),
          password,
        });
        const passwordValidation = validatePasswordInput({
          role,
          rollNumber: finalRollNumber,
          mobileNumber: String(finalMobileNumber).trim(),
          password: effectivePassword,
        });
        if (!passwordValidation.ok) {
          pushResult({
            success: false,
            message: passwordValidation.message,
            student,
          });
          continue;
        }

        if (existingStudentMatch && role === "student") {
          const updateSet: Record<string, any> = {
            name,
            email,
            mobileNumber: String(finalMobileNumber).trim(),
            gender,
            fatherName: fatherName || undefined,
            class: resolvedClassId || undefined,
            academicSection: resolvedAcademicSectionId || undefined,
            rollNumber: finalRollNumber,
            classIds: undefined,
            academicSectionIds: undefined,
            subjectIds: undefined,
            hasAllClasses: false,
            hasAllSections: false,
            hasAllSubjects: false,
          };

          if (normalizedStudent.enrolledat) {
            updateSet.enrolledAt = normalizedStudent.enrolledat;
          }

          if (effectivePassword) {
            updateSet.passwordHash = await bcrypt.hash(String(effectivePassword), 10);
          }

          const updatedUser = await UserModel.findOneAndUpdate(
            { _id: existingStudentMatch._id, ...buildArchiveFilter(false) },
            {
              $set: updateSet,
              $unset: {
                activeStudentSessionId: 1,
                activeStudentSessionLastSeenAt: 1,
              },
            },
            { new: true, runValidators: true },
          ).select("_id name email class academicSection rollNumber");

          if (!updatedUser) {
          pushResult({
            success: false,
            message: "Student not found for update.",
            student,
          });
            continue;
          }

          if (email) {
            existingUsersByEmail.set(email, updatedUser);
          }

          await clearStudentSession(schoolKey, String(updatedUser._id)).catch(() => undefined);
          invalidateStudentAccessCaches({
            schoolKey,
            studentId: String(updatedUser._id),
            previousClassId: normalizeId(existingStudentMatch.class),
            nextClassId: normalizeId(updatedUser.class),
          });

          pushResult({
            success: true,
            user: updatedUser,
            existed: true,
            updated: true,
          });
          continue;
        }

        let passwordHash: string | undefined;
        if (effectivePassword) {
          passwordHash = await bcrypt.hash(String(effectivePassword), 10);
        }

        const newUser = new UserModel({
          name,
          email,
          passwordHash,
          role,
          mobileNumber: String(finalMobileNumber).trim(),
          gender,
          fatherName: role === "student" ? fatherName || undefined : undefined,
          class: role === "student" ? resolvedClassId || undefined : undefined,
          academicSection:
            role === "student" ? resolvedAcademicSectionId || undefined : undefined,
          classIds:
            role === "teacher" || role === "admin"
              ? resolvedScopedClassIds
              : undefined,
          academicSectionIds:
            role === "teacher" || role === "admin"
              ? resolvedScopedAcademicSectionIds
              : undefined,
          subjectIds:
            role === "teacher" || role === "admin"
              ? resolvedScopedSubjectIds
              : undefined,
          hasAllClasses: role === "admin" ? allowAllClasses : false,
          hasAllSections:
            role === "teacher" || role === "admin" ? allowAllSections : false,
          hasAllSubjects: role === "admin" ? allowAllSubjects : false,
          rollNumber: role === "student" ? finalRollNumber : undefined,
          enrolledAt:
            role === "student"
              ? normalizedStudent.enrolledat || Date.now()
              : undefined,
        });

        try {
          await newUser.save();
        } catch (error) {
          if (!isDuplicateKeyError(error)) {
            throw error;
          }

          const duplicateKeyPattern = (
            error as { keyPattern?: Record<string, unknown> }
          )?.keyPattern;
          let message = "Duplicate user identity detected.";
          if (duplicateKeyPattern?.email) {
            message = "A user with this email already exists.";
          } else if (duplicateKeyPattern?.rollNumber) {
            message =
              "Roll number must be unique within the school because students use it to sign in.";
          }

          pushResult({
            success: false,
            message,
            student,
          });
          continue;
        }

        if (email) {
          existingUsersByEmail.set(email, newUser);
        }
        if (role === "student" && finalRollNumber) {
          const rollLookupKey = toRollLookupKey(finalRollNumber);
          const existingStudents =
            existingStudentsByRollNumber.get(rollLookupKey) || [];
          existingStudentsByRollNumber.set(rollLookupKey, [
            ...existingStudents,
            newUser,
          ]);
        }

        pushResult({ success: true, user: newUser });
      } catch (rowError) {
        pushResult({
          success: false,
          message: stringifyUnknownError(
            rowError,
            `Failed to process upload row ${row.rowNumber}.`,
          ),
          student,
        });
      }
    }

    const successCount = results.filter((result) => result.success).length;
    return NextResponse.json({
      success: true,
      count: successCount,
      results,
      createdClasses: structureState.createdClasses,
      restoredClasses: structureState.restoredClasses,
      createdSections: structureState.createdSections,
      restoredSections: structureState.restoredSections,
      createdSubjects: structureState.createdSubjects,
      restoredSubjects: structureState.restoredSubjects,
    });
  } catch (error: any) {
    await recordOpsFailure({
      schoolKey: auth.schoolKey,
      req: request,
      action: "bulk_user_import",
      message: error?.message || "Failed to import users.",
      error,
      metadata: {
        route: "/api/users/bulk",
        method: "POST",
        uploadType: "users",
        rows: studentRowCount,
      },
      entity: {
        type: "bulk_upload",
        label: "users",
      },
      severity: "error",
    });
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}
