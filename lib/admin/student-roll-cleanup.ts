import bcrypt from "bcryptjs";

import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import School from "@/models/School";
import ReportDispatchJob from "@/models/ReportDispatchJob";
import { normalizeRollNumber } from "@/lib/user-credentials";

type LeanStudent = {
  _id: any;
  name?: string;
  email?: string;
  rollNumber?: string;
  class?: any;
  academicSection?: any;
  passwordHash?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export type StudentRollDuplicateStudent = {
  userId: string;
  name: string;
  email: string;
  rollNumber: string;
  suggestedRollNumber: string | null;
  classId: string;
  className: string;
  academicSectionId: string;
  academicSectionName: string;
  responseCount: number;
  reportJobCount: number;
  hasLinkedData: boolean;
  canAutoFix: boolean;
  isRecommendedKeeper: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type StudentRollDuplicateGroup = {
  normalizedRollNumber: string;
  duplicateCount: number;
  risky: boolean;
  autoFixCandidateCount: number;
  recommendedKeeperUserId: string;
  students: StudentRollDuplicateStudent[];
};

export type StudentRollDuplicateSchoolReport = {
  schoolKey: string;
  schoolDisplayName: string;
  duplicateGroupCount: number;
  affectedStudentCount: number;
  autoFixCandidateCount: number;
  riskyGroupCount: number;
  duplicateGroups: StudentRollDuplicateGroup[];
};

export type StudentRollDuplicateAuditSummary = {
  schoolsScanned: number;
  schoolsWithDuplicates: number;
  duplicateGroupCount: number;
  affectedStudentCount: number;
  autoFixCandidateCount: number;
  riskyGroupCount: number;
};

export type StudentRollDuplicateAuditReport = {
  summary: StudentRollDuplicateAuditSummary;
  schools: StudentRollDuplicateSchoolReport[];
};

export type StudentRollUpdateResult = {
  userId: string;
  fromRollNumber: string;
  toRollNumber: string;
  passwordResetToRollNumber: boolean;
};

export type ApplyStudentRollUpdatesResult = {
  schoolKey: string;
  updatedCount: number;
  passwordResetCount: number;
  updatedUsers: StudentRollUpdateResult[];
};

function normalizeSchoolKey(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRollNumberKey(value: unknown) {
  return normalizeRollNumber(value).toLowerCase();
}

function toIsoString(value: unknown) {
  if (!value) return null;
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toIdString(value: unknown) {
  return String(value || "").trim();
}

function buildClassNameMap(classDocs: any[]) {
  return new Map(
    (Array.isArray(classDocs) ? classDocs : []).map((classDoc) => [
      toIdString(classDoc?._id),
      String(classDoc?.name || ""),
    ]),
  );
}

function buildSectionNameMap(sectionDocs: any[]) {
  return new Map(
    (Array.isArray(sectionDocs) ? sectionDocs : []).map((sectionDoc) => [
      toIdString(sectionDoc?._id),
      String(sectionDoc?.name || ""),
    ]),
  );
}

function buildSuggestedRollNumber(
  baseRollNumber: string,
  reservedKeys: Set<string>,
) {
  const trimmedBase = normalizeRollNumber(baseRollNumber) || "student";
  let counter = 2;
  let candidate = `${trimmedBase}-${counter}`;

  while (reservedKeys.has(normalizeRollNumberKey(candidate))) {
    counter += 1;
    candidate = `${trimmedBase}-${counter}`;
  }

  reservedKeys.add(normalizeRollNumberKey(candidate));
  return candidate;
}

function compareStudentsForKeeper(left: StudentRollDuplicateStudent, right: StudentRollDuplicateStudent) {
  const leftLinkedCount = left.responseCount + left.reportJobCount;
  const rightLinkedCount = right.responseCount + right.reportJobCount;

  if (leftLinkedCount !== rightLinkedCount) {
    return rightLinkedCount - leftLinkedCount;
  }

  if (left.responseCount !== right.responseCount) {
    return right.responseCount - left.responseCount;
  }

  if (left.reportJobCount !== right.reportJobCount) {
    return right.reportJobCount - left.reportJobCount;
  }

  const leftCreatedAt = left.createdAt ? new Date(left.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
  const rightCreatedAt = right.createdAt ? new Date(right.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt - rightCreatedAt;
  }

  return left.userId.localeCompare(right.userId);
}

async function buildSchoolDuplicateAudit(school: any): Promise<StudentRollDuplicateSchoolReport> {
  const schoolKey = normalizeSchoolKey(school?.key);
  const schoolDisplayName = String(school?.displayName || schoolKey || "").trim();
  const {
    User: UserModel,
    QuestionPaperResponse: QuestionPaperResponseModel,
    Class: ClassModel,
    AcademicSection: AcademicSectionModel,
  } = await getTenantModels(schoolKey, [
    "User",
    "QuestionPaperResponse",
    "Class",
    "AcademicSection",
  ]);

  const students = (await UserModel.find({
    role: "student",
    ...buildArchiveFilter(false),
  })
    .select(
      "name email rollNumber class academicSection passwordHash createdAt updatedAt",
    )
    .lean()) as LeanStudent[];

  const allRollNumberKeys = new Set<string>();
  const duplicateCandidatesByRollNumber = new Map<string, LeanStudent[]>();

  for (const student of students) {
    const normalizedRollKey = normalizeRollNumberKey(student.rollNumber);
    if (!normalizedRollKey) continue;

    allRollNumberKeys.add(normalizedRollKey);
    const existing = duplicateCandidatesByRollNumber.get(normalizedRollKey) || [];
    existing.push(student);
    duplicateCandidatesByRollNumber.set(normalizedRollKey, existing);
  }

  const duplicateEntries = Array.from(duplicateCandidatesByRollNumber.entries()).filter(
    ([, matchingStudents]) => matchingStudents.length > 1,
  );

  if (duplicateEntries.length === 0) {
    return {
      schoolKey,
      schoolDisplayName,
      duplicateGroupCount: 0,
      affectedStudentCount: 0,
      autoFixCandidateCount: 0,
      riskyGroupCount: 0,
      duplicateGroups: [],
    };
  }

  const duplicateStudentIds = duplicateEntries.flatMap(([, matchingStudents]) =>
    matchingStudents.map((student) => student._id),
  );

  const [responseCounts, reportJobCounts, classDocs, sectionDocs] =
    await Promise.all([
      QuestionPaperResponseModel.aggregate([
        {
          $match: {
            student: { $in: duplicateStudentIds },
          },
        },
        {
          $group: {
            _id: "$student",
            count: { $sum: 1 },
          },
        },
      ]),
      ReportDispatchJob.aggregate([
        {
          $match: {
            schoolKey,
            student: { $in: duplicateStudentIds },
          },
        },
        {
          $group: {
            _id: "$student",
            count: { $sum: 1 },
          },
        },
      ]),
      ClassModel.find({}).select("name").lean(),
      AcademicSectionModel.find({}).select("name").lean(),
    ]);

  const responseCountByStudentId = new Map(
    (Array.isArray(responseCounts) ? responseCounts : []).map((item: any) => [
      toIdString(item?._id),
      Number(item?.count || 0),
    ]),
  );
  const reportJobCountByStudentId = new Map(
    (Array.isArray(reportJobCounts) ? reportJobCounts : []).map((item: any) => [
      toIdString(item?._id),
      Number(item?.count || 0),
    ]),
  );
  const classNameById = buildClassNameMap(classDocs);
  const sectionNameById = buildSectionNameMap(sectionDocs);
  const reservedSuggestedKeys = new Set(allRollNumberKeys);

  const duplicateGroups = duplicateEntries
    .sort(([leftRoll], [rightRoll]) => leftRoll.localeCompare(rightRoll))
    .map(([normalizedRollNumber, matchingStudents]) => {
      const baseStudents = matchingStudents
        .map((student) => {
          const userId = toIdString(student._id);
          const responseCount = responseCountByStudentId.get(userId) || 0;
          const reportJobCount = reportJobCountByStudentId.get(userId) || 0;
          const classId = toIdString(student.class);
          const academicSectionId = toIdString(student.academicSection);

          return {
            userId,
            name: String(student.name || ""),
            email: String(student.email || ""),
            rollNumber: normalizeRollNumber(student.rollNumber),
            suggestedRollNumber: null,
            classId,
            className: classNameById.get(classId) || "Unassigned",
            academicSectionId,
            academicSectionName:
              sectionNameById.get(academicSectionId) || "Unassigned",
            responseCount,
            reportJobCount,
            hasLinkedData: responseCount > 0 || reportJobCount > 0,
            canAutoFix: false,
            isRecommendedKeeper: false,
            createdAt: toIsoString(student.createdAt),
            updatedAt: toIsoString(student.updatedAt),
          } satisfies StudentRollDuplicateStudent;
        })
        .sort(compareStudentsForKeeper);

      const studentsForGroup = baseStudents.map((student, index) => {
        if (index === 0) {
          return {
            ...student,
            isRecommendedKeeper: true,
          };
        }

        const suggestedRollNumber = buildSuggestedRollNumber(
          student.rollNumber || normalizedRollNumber,
          reservedSuggestedKeys,
        );

        return {
          ...student,
          suggestedRollNumber,
          canAutoFix: !student.hasLinkedData,
        };
      });

      const autoFixCandidateCount = studentsForGroup.filter(
        (student) => student.canAutoFix,
      ).length;
      const risky = studentsForGroup.some(
        (student) => !student.isRecommendedKeeper && !student.canAutoFix,
      );

      return {
        normalizedRollNumber,
        duplicateCount: studentsForGroup.length,
        risky,
        autoFixCandidateCount,
        recommendedKeeperUserId:
          studentsForGroup.find((student) => student.isRecommendedKeeper)?.userId || "",
        students: studentsForGroup,
      } satisfies StudentRollDuplicateGroup;
    });

  return {
    schoolKey,
    schoolDisplayName,
    duplicateGroupCount: duplicateGroups.length,
    affectedStudentCount: duplicateGroups.reduce(
      (total, group) => total + group.duplicateCount,
      0,
    ),
    autoFixCandidateCount: duplicateGroups.reduce(
      (total, group) => total + group.autoFixCandidateCount,
      0,
    ),
    riskyGroupCount: duplicateGroups.filter((group) => group.risky).length,
    duplicateGroups,
  };
}

async function resolveTargetSchools(schoolKey?: string | null) {
  await connectDB();

  if (schoolKey) {
    const school = await School.findOne({
      key: normalizeSchoolKey(schoolKey),
    }).lean();
    return school ? [school] : [];
  }

  return await School.find({}).sort({ displayName: 1 }).lean();
}

export async function buildStudentRollDuplicateAudit(
  schoolKey?: string | null,
): Promise<StudentRollDuplicateAuditReport> {
  const targetSchools = await resolveTargetSchools(schoolKey);

  const schoolReports: StudentRollDuplicateSchoolReport[] = [];

  for (const school of targetSchools) {
    const report = await buildSchoolDuplicateAudit(school);
    if (report.duplicateGroupCount > 0) {
      schoolReports.push(report);
    }
  }

  return {
    summary: {
      schoolsScanned: targetSchools.length,
      schoolsWithDuplicates: schoolReports.length,
      duplicateGroupCount: schoolReports.reduce(
        (total, schoolReport) => total + schoolReport.duplicateGroupCount,
        0,
      ),
      affectedStudentCount: schoolReports.reduce(
        (total, schoolReport) => total + schoolReport.affectedStudentCount,
        0,
      ),
      autoFixCandidateCount: schoolReports.reduce(
        (total, schoolReport) => total + schoolReport.autoFixCandidateCount,
        0,
      ),
      riskyGroupCount: schoolReports.reduce(
        (total, schoolReport) => total + schoolReport.riskyGroupCount,
        0,
      ),
    },
    schools: schoolReports,
  };
}

export async function applyStudentRollNumberUpdates({
  schoolKey,
  updates,
}: {
  schoolKey: string;
  updates: Array<{ userId: string; newRollNumber: string }>;
}): Promise<ApplyStudentRollUpdatesResult> {
  const normalizedSchoolKey = normalizeSchoolKey(schoolKey);
  if (!normalizedSchoolKey) {
    throw new Error("schoolKey is required.");
  }

  const normalizedUpdates = updates
    .map((update) => ({
      userId: toIdString(update?.userId),
      newRollNumber: normalizeRollNumber(update?.newRollNumber),
    }))
    .filter((update) => update.userId && update.newRollNumber);

  if (normalizedUpdates.length === 0) {
    throw new Error("At least one roll-number update is required.");
  }

  const updateRollKeys = new Map<string, string>();
  for (const update of normalizedUpdates) {
    const normalizedKey = normalizeRollNumberKey(update.newRollNumber);
    if (updateRollKeys.has(normalizedKey)) {
      throw new Error("Updated roll numbers must be unique.");
    }
    updateRollKeys.set(normalizedKey, update.userId);
  }

  const { User: UserModel } = await getTenantModels(normalizedSchoolKey, ["User"]);
  const userIds = normalizedUpdates.map((update) => update.userId);
  const activeStudents = (await UserModel.find({
    role: "student",
    ...buildArchiveFilter(false),
  })
    .select("rollNumber passwordHash")
    .lean()) as LeanStudent[];

  const activeStudentById = new Map(
    activeStudents.map((student) => [toIdString(student._id), student]),
  );

  const updateCandidates = normalizedUpdates
    .map((update) => {
      const currentStudent = activeStudentById.get(update.userId);
      if (!currentStudent) {
        throw new Error(`Student ${update.userId} was not found in the target school.`);
      }

      const currentRollNumber = normalizeRollNumber(currentStudent.rollNumber);
      if (currentRollNumber === update.newRollNumber) {
        return null;
      }

      return {
        ...update,
        currentRollNumber,
        currentPasswordHash: String(currentStudent.passwordHash || ""),
      };
    })
    .filter(Boolean) as Array<{
    userId: string;
    newRollNumber: string;
    currentRollNumber: string;
    currentPasswordHash: string;
  }>;

  if (updateCandidates.length === 0) {
    throw new Error("No roll-number changes were requested.");
  }

  const finalRollsByUserId = new Map<string, string>();
  for (const student of activeStudents) {
    finalRollsByUserId.set(
      toIdString(student._id),
      normalizeRollNumber(student.rollNumber),
    );
  }
  for (const update of updateCandidates) {
    finalRollsByUserId.set(update.userId, update.newRollNumber);
  }

  const finalRollOwnership = new Map<string, string[]>();
  for (const [userId, finalRollNumber] of finalRollsByUserId.entries()) {
    const normalizedKey = normalizeRollNumberKey(finalRollNumber);
    if (!normalizedKey) continue;
    const ownerList = finalRollOwnership.get(normalizedKey) || [];
    ownerList.push(userId);
    finalRollOwnership.set(normalizedKey, ownerList);
  }

  const remainingDuplicates = Array.from(finalRollOwnership.entries())
    .filter(([, ownerIds]) => ownerIds.length > 1)
    .map(([rollKey]) => rollKey);
  if (remainingDuplicates.length > 0) {
    throw new Error(
      `These roll numbers would still be duplicated after the update: ${remainingDuplicates.join(", ")}`,
    );
  }

  const updatedUsers: StudentRollUpdateResult[] = [];

  for (const update of updateCandidates) {
    let nextPasswordHash: string | undefined;
    let passwordResetToRollNumber = false;

    if (!update.currentPasswordHash) {
      nextPasswordHash = await bcrypt.hash(update.newRollNumber, 10);
      passwordResetToRollNumber = true;
    } else if (
      update.currentRollNumber &&
      await bcrypt.compare(update.currentRollNumber, update.currentPasswordHash)
    ) {
      nextPasswordHash = await bcrypt.hash(update.newRollNumber, 10);
      passwordResetToRollNumber = true;
    }

    const updatePayload: Record<string, unknown> = {
      rollNumber: update.newRollNumber,
    };
    if (nextPasswordHash) {
      updatePayload.passwordHash = nextPasswordHash;
    }

    await UserModel.updateOne(
      {
        _id: update.userId,
        role: "student",
        ...buildArchiveFilter(false),
      },
      { $set: updatePayload },
    );

    updatedUsers.push({
      userId: update.userId,
      fromRollNumber: update.currentRollNumber,
      toRollNumber: update.newRollNumber,
      passwordResetToRollNumber,
    });
  }

  return {
    schoolKey: normalizedSchoolKey,
    updatedCount: updatedUsers.length,
    passwordResetCount: updatedUsers.filter(
      (user) => user.passwordResetToRollNumber,
    ).length,
    updatedUsers,
  };
}

export async function applySafeStudentRollDuplicateFixes(
  schoolKey?: string | null,
) {
  const audit = await buildStudentRollDuplicateAudit(schoolKey);
  const schoolResults: Array<{
    schoolKey: string;
    updatedCount: number;
    passwordResetCount: number;
    updatedUsers: StudentRollUpdateResult[];
  }> = [];

  for (const schoolReport of audit.schools) {
    const updates = schoolReport.duplicateGroups.flatMap((group) =>
      group.students
        .filter((student) => student.canAutoFix && student.suggestedRollNumber)
        .map((student) => ({
          userId: student.userId,
          newRollNumber: String(student.suggestedRollNumber),
        })),
    );

    if (updates.length === 0) {
      continue;
    }

    const schoolResult = await applyStudentRollNumberUpdates({
      schoolKey: schoolReport.schoolKey,
      updates,
    });
    schoolResults.push(schoolResult);
  }

  return {
    summary: {
      schoolsProcessed: schoolResults.length,
      updatedCount: schoolResults.reduce(
        (total, schoolResult) => total + schoolResult.updatedCount,
        0,
      ),
      passwordResetCount: schoolResults.reduce(
        (total, schoolResult) => total + schoolResult.passwordResetCount,
        0,
      ),
    },
    schools: schoolResults,
  };
}

export async function resolveStudentRollDuplicateGroup({
  schoolKey,
  normalizedRollNumber,
  updates,
}: {
  schoolKey: string;
  normalizedRollNumber: string;
  updates: Array<{ userId: string; newRollNumber: string }>;
}) {
  const audit = await buildStudentRollDuplicateAudit(schoolKey);
  const schoolReport = audit.schools.find(
    (schoolItem) => schoolItem.schoolKey === normalizeSchoolKey(schoolKey),
  );
  const duplicateGroup = schoolReport?.duplicateGroups.find(
    (group) =>
      group.normalizedRollNumber === normalizeRollNumberKey(normalizedRollNumber),
  );

  if (!duplicateGroup) {
    throw new Error("No active duplicate group was found for that roll number.");
  }

  const allowedUserIds = new Set(
    duplicateGroup.students.map((student) => student.userId),
  );

  const scopedUpdates = updates.filter((update) =>
    allowedUserIds.has(toIdString(update?.userId)),
  );
  if (scopedUpdates.length === 0) {
    throw new Error("Provide at least one update for a student in the duplicate group.");
  }

  return applyStudentRollNumberUpdates({
    schoolKey,
    updates: scopedUpdates,
  });
}
