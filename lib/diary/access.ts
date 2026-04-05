import { toDiaryId, uniqueSortedDiaryIds } from "@/lib/diary/shared";

export function resolveDiaryAuthorScope(
  user: any,
  entryClassId: string,
  entrySubjectId: string,
  assignedAcademicSectionIds: string[] = [],
) {
  const normalizedClassId = String(entryClassId || "").trim();
  const normalizedSubjectId = String(entrySubjectId || "").trim();
  const normalizedSectionIds = uniqueSortedDiaryIds(assignedAcademicSectionIds);

  const scopedClassIds = uniqueSortedDiaryIds(user?.classIds);
  const scopedSubjectIds = uniqueSortedDiaryIds(user?.subjectIds);
  const scopedSectionIds = uniqueSortedDiaryIds(user?.academicSectionIds);
  const hasAllClasses = Boolean(user?.hasAllClasses);
  const hasAllSubjects = Boolean(user?.hasAllSubjects);
  const hasAllSections = Boolean(user?.hasAllSections);

  const hasClassAccess =
    !normalizedClassId ||
    hasAllClasses ||
    scopedClassIds.includes(normalizedClassId);

  const hasSubjectAccess =
    !normalizedSubjectId ||
    hasAllSubjects ||
    scopedSubjectIds.includes(normalizedSubjectId);

  let allowedSectionIds: string[] | null = null;
  if (hasAllSections) {
    allowedSectionIds =
      normalizedSectionIds.length > 0 ? normalizedSectionIds : null;
  } else if (normalizedSectionIds.length > 0) {
    allowedSectionIds = normalizedSectionIds.filter((sectionId) =>
      scopedSectionIds.includes(sectionId),
    );
  } else {
    allowedSectionIds = scopedSectionIds;
  }

  return {
    hasAllClasses,
    hasAllSubjects,
    hasAllSections,
    hasClassAccess,
    hasSubjectAccess,
    hasFullSubjectAccess: hasSubjectAccess,
    allowedSectionIds,
    hasSectionAccess:
      allowedSectionIds === null ? true : allowedSectionIds.length > 0,
  };
}

export function isStudentInDiaryScope(entry: any, student: any) {
  const studentClassId = toDiaryId(
    student?.classId || student?.class?._id || student?.class,
  );
  const entryClassId = toDiaryId(entry?.class?._id || entry?.class);

  if (!studentClassId || !entryClassId || studentClassId !== entryClassId) {
    return false;
  }

  const assignedSectionIds = uniqueSortedDiaryIds(
    entry?.assignedAcademicSections,
  );
  if (assignedSectionIds.length === 0) {
    return true;
  }

  const studentSectionId = toDiaryId(
    student?.academicSectionId ||
      student?.academicSection?._id ||
      student?.academicSection,
  );

  return Boolean(
    studentSectionId && assignedSectionIds.includes(studentSectionId),
  );
}

