import { getTenantModels } from "@/lib/db-tenant";
import { getPublicSchoolOptionByKey } from "@/lib/server/public-school-data";
import { isMockedE2ETestMode } from "@/lib/test-mode";

export type PublicRegistrationClassOption = {
  id: string;
  name: string;
};

export type PublicRegistrationSectionOption = {
  id: string;
  name: string;
  classId: string;
};

type ClassDoc = {
  _id: unknown;
  name?: string;
};

type SectionDoc = {
  _id: unknown;
  name?: string;
  class?: unknown;
};

export async function getPublicClassOptions(
  schoolKey: string,
): Promise<PublicRegistrationClassOption[]> {
  if (isMockedE2ETestMode()) {
    return [];
  }

  const allowedSchool = await getPublicSchoolOptionByKey(schoolKey);
  if (!allowedSchool) {
    return [];
  }

  const { Class: ClassModel } = await getTenantModels(schoolKey, ["Class"]);
  const classes = (await ClassModel.find({ isArchived: { $ne: true } })
    .sort({ name: 1 })
    .select("name")
    .lean()) as ClassDoc[];

  return Array.isArray(classes)
    ? classes
        .map((classItem) => ({
          id: String(classItem._id || "").trim(),
          name: String(classItem.name || "").trim(),
        }))
        .filter((classItem) => classItem.id && classItem.name)
    : [];
}

export async function getPublicSectionOptions(
  schoolKey: string,
  classId: string,
): Promise<PublicRegistrationSectionOption[]> {
  if (isMockedE2ETestMode()) {
    return [];
  }

  const allowedSchool = await getPublicSchoolOptionByKey(schoolKey);
  if (!allowedSchool) {
    return [];
  }

  const { AcademicSection: AcademicSectionModel } = await getTenantModels(
    schoolKey,
    ["AcademicSection"],
  );
  const sections = (await AcademicSectionModel.find({
    class: classId,
    isActive: true,
    isArchived: { $ne: true },
  })
    .sort({ name: 1 })
    .select("name class")
    .lean()) as SectionDoc[];

  return Array.isArray(sections)
    ? sections
        .map((section) => ({
          id: String(section._id || "").trim(),
          name: String(section.name || "").trim(),
          classId: String(section.class || "").trim(),
        }))
        .filter((section) => section.id && section.name)
    : [];
}
