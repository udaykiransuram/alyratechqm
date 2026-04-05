function normalizeId(value: unknown) {
  if (!value) return "";

  if (typeof value === "object" && value !== null && "_id" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)._id || "").trim();
  }

  return String(value || "").trim();
}

function toUniqueIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return Array.from(new Set(value.map((item) => normalizeId(item)).filter(Boolean)));
}

export function resolveTeacherCourseScope(
  user: any,
  courseClassId: string,
  courseSubjectIds: string[] = [],
  courseAssignedSectionIds: string[] = [],
) {
  const normalizedCourseClassId = String(courseClassId || "").trim();
  const normalizedCourseSubjectIds = Array.from(
    new Set(
      (Array.isArray(courseSubjectIds) ? courseSubjectIds : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
  const normalizedCourseSectionIds = Array.from(
    new Set(
      (Array.isArray(courseAssignedSectionIds) ? courseAssignedSectionIds : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );

  const scopedClassIds = toUniqueIds(user?.classIds);
  const scopedSubjectIds = toUniqueIds(user?.subjectIds);
  const scopedSectionIds = toUniqueIds(user?.academicSectionIds);
  const hasAllClasses = Boolean(user?.hasAllClasses);
  const hasAllSubjects = Boolean(user?.hasAllSubjects);
  const hasAllSections = Boolean(user?.hasAllSections);

  const hasClassAccess =
    !normalizedCourseClassId ||
    hasAllClasses ||
    scopedClassIds.includes(normalizedCourseClassId);

  const allowedSubjectIds =
    hasAllSubjects || normalizedCourseSubjectIds.length === 0
      ? normalizedCourseSubjectIds
      : normalizedCourseSubjectIds.filter((subjectId) =>
          scopedSubjectIds.includes(subjectId),
        );

  let allowedSectionIds: string[] | null = null;
  if (hasAllSections) {
    allowedSectionIds =
      normalizedCourseSectionIds.length > 0 ? normalizedCourseSectionIds : null;
  } else if (normalizedCourseSectionIds.length > 0) {
    allowedSectionIds = normalizedCourseSectionIds.filter((sectionId) =>
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
    allowedSubjectIds,
    hasSubjectAccess:
      normalizedCourseSubjectIds.length === 0 ||
      hasAllSubjects ||
      allowedSubjectIds.length > 0,
    hasFullSubjectAccess:
      normalizedCourseSubjectIds.length === 0 ||
      hasAllSubjects ||
      allowedSubjectIds.length === normalizedCourseSubjectIds.length,
    allowedSectionIds,
    hasSectionAccess:
      allowedSectionIds === null ? true : allowedSectionIds.length > 0,
    requiresSectionIntersection: !hasAllSections,
  };
}

export function isStudentInCourseScope(course: any, student: any) {
  const studentClassId = normalizeId(
    student?.classId || student?.class?._id || student?.class,
  );
  const courseClassId = normalizeId(course?.class?._id || course?.class);

  if (!studentClassId || !courseClassId || studentClassId !== courseClassId) {
    return false;
  }

  const assignedSectionIds = toUniqueIds(course?.assignedAcademicSections);
  if (assignedSectionIds.length === 0) {
    return true;
  }

  const studentSectionId = normalizeId(
    student?.academicSectionId ||
      student?.academicSection?._id ||
      student?.academicSection,
  );

  return Boolean(studentSectionId && assignedSectionIds.includes(studentSectionId));
}
