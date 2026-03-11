import mongoose from "mongoose";

function toUniqueIds(values: any[]) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => toIdString(value))
        .filter(Boolean),
    ),
  );
}

function toObjectIds(ids: string[]) {
  return toUniqueIds(ids)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

export function toIdString(value: any) {
  return String(value?._id || value || "").trim();
}

export function getStudentAcademicSectionId(student: any) {
  return toIdString(student?.academicSection);
}

export async function hydrateAcademicSectionsWithClasses({
  sections,
  ClassModel,
}: {
  sections: any[];
  ClassModel?: any;
}) {
  const normalizedSections = Array.isArray(sections)
    ? sections.filter(Boolean)
    : [];

  if (normalizedSections.length === 0) {
    return [];
  }

  if (!ClassModel) {
    return normalizedSections.map((section: any) => ({ ...section }));
  }

  const classIds = toUniqueIds(normalizedSections.map((section: any) => section?.class));
  const classDocs = classIds.length
    ? await ClassModel.find({ _id: { $in: toObjectIds(classIds) } })
        .select("name")
        .lean()
    : [];

  const classMap = new Map(
    classDocs.map((classDoc: any) => [toIdString(classDoc), classDoc]),
  );

  return normalizedSections.map((section: any) => ({
    ...section,
    class: classMap.get(toIdString(section?.class)) || section?.class || null,
  }));
}

export async function hydrateUsersWithAcademicContext({
  users,
  AcademicSectionModel,
  ClassModel,
}: {
  users: any[];
  AcademicSectionModel?: any;
  ClassModel?: any;
}) {
  const normalizedUsers = Array.isArray(users) ? users.filter(Boolean) : [];

  if (normalizedUsers.length === 0) {
    return [];
  }

  const sectionIds = toUniqueIds(
    normalizedUsers.map((user: any) => user?.academicSection),
  );

  const rawSections = AcademicSectionModel && sectionIds.length
    ? await AcademicSectionModel.find({ _id: { $in: toObjectIds(sectionIds) } })
        .select("name class isActive")
        .lean()
    : [];

  const classIds = toUniqueIds([
    ...normalizedUsers.map((user: any) => user?.class),
    ...rawSections.map((section: any) => section?.class),
  ]);

  const classDocs = ClassModel && classIds.length
    ? await ClassModel.find({ _id: { $in: toObjectIds(classIds) } })
        .select("name")
        .lean()
    : [];

  const classMap = new Map(
    classDocs.map((classDoc: any) => [toIdString(classDoc), classDoc]),
  );

  const sectionMap = new Map(
    rawSections.map((section: any) => {
      const sectionClassId = toIdString(section?.class);
      return [
        toIdString(section),
        {
          ...section,
          class: classMap.get(sectionClassId) || section?.class || null,
        },
      ];
    }),
  );

  return normalizedUsers.map((user: any) => {
    const userClassId = toIdString(user?.class);
    const userAcademicSectionId = toIdString(user?.academicSection);

    return {
      ...user,
      class: userClassId ? classMap.get(userClassId) || user?.class || null : null,
      academicSection: userAcademicSectionId
        ? sectionMap.get(userAcademicSectionId) || user?.academicSection || null
        : null,
    };
  });
}

export async function hydrateResponsesWithStudents({
  responses,
  UserModel,
  AcademicSectionModel,
  ClassModel,
  studentSelect = "name rollNumber class academicSection",
  dropMissingStudents = true,
}: {
  responses: any[];
  UserModel: any;
  AcademicSectionModel?: any;
  ClassModel?: any;
  studentSelect?: string;
  dropMissingStudents?: boolean;
}) {
  const normalizedResponses = Array.isArray(responses)
    ? responses.filter(Boolean)
    : [];

  if (normalizedResponses.length === 0) {
    return [];
  }

  const studentIds = toUniqueIds(
    normalizedResponses.map((response: any) => response?.student),
  );

  const rawStudents = studentIds.length
    ? await UserModel.find({ _id: { $in: toObjectIds(studentIds) } })
        .select(studentSelect)
        .lean()
    : [];

  const students = await hydrateUsersWithAcademicContext({
    users: rawStudents,
    AcademicSectionModel,
    ClassModel,
  });

  const studentMap = new Map(
    students.map((student: any) => [toIdString(student), student]),
  );

  const hydratedResponses = normalizedResponses.map((response: any) => ({
    ...response,
    student: studentMap.get(toIdString(response?.student)) || null,
  }));

  return dropMissingStudents
    ? hydratedResponses.filter((response: any) => !!response.student)
    : hydratedResponses;
}

export function filterResponsesByAcademicSection(
  responses: any[],
  academicSectionId?: string,
) {
  if (!academicSectionId) {
    return Array.isArray(responses) ? responses : [];
  }

  return (Array.isArray(responses) ? responses : []).filter(
    (response: any) =>
      getStudentAcademicSectionId(response?.student) === academicSectionId,
  );
}
