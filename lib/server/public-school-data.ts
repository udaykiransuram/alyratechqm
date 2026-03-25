import { connectDB } from "@/lib/db";
import { isMockedE2ETestMode } from "@/lib/test-mode";
import School from "@/models/School";

export type PublicSchoolOption = {
  key: string;
  displayName: string;
};

type SchoolDoc = {
  key?: string;
  displayName?: string;
};

function toPublicSchoolOption(school: SchoolDoc): PublicSchoolOption | null {
  const key = String(school?.key || "").trim().toLowerCase();
  const displayName = String(school?.displayName || "").trim();

  if (!key || !displayName) {
    return null;
  }

  return {
    key,
    displayName,
  };
}

export async function getPublicSchoolOptions(): Promise<PublicSchoolOption[]> {
  if (isMockedE2ETestMode()) {
    return [];
  }

  await connectDB();

  const schools = (await School.find({})
    .sort({ displayName: 1, _id: 1 })
    .select("key displayName")
    .lean()) as SchoolDoc[];

  return Array.isArray(schools)
    ? schools
        .map(toPublicSchoolOption)
        .filter((school): school is PublicSchoolOption => Boolean(school))
    : [];
}
