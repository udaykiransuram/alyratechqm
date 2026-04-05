import type { Page } from "@playwright/test";
import { encode } from "next-auth/jwt";

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "http://127.0.0.1:3001";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

const testBaseURL = normalizeBaseUrl(process.env.BASE_URL);
const nextAuthSecret = process.env.NEXTAUTH_SECRET || "testsecret";

type SchoolSessionOverrides = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  schoolKey?: string;
  schoolDisplayName?: string;
};

type StudentSessionOverrides = {
  id?: string;
  name?: string;
  email?: string;
  schoolKey?: string;
  schoolDisplayName?: string;
  studentSessionId?: string;
  studentClassId?: string;
  studentAcademicSectionId?: string;
};

async function applySchoolSession(
  page: Page,
  token: Record<string, string | undefined>,
  schoolKey: string,
  schoolDisplayName: string,
) {
  const sessionToken = await encode({
    secret: nextAuthSecret,
    token: {
      sub: token.id,
      ...token,
    },
    maxAge: 60 * 60,
  });

  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: sessionToken,
      url: testBaseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "schoolKey",
      value: schoolKey,
      url: testBaseURL,
      sameSite: "Lax",
    },
    {
      name: "schoolDisplayName",
      value: schoolDisplayName,
      url: testBaseURL,
      sameSite: "Lax",
    },
  ]);

  await page.context().setExtraHTTPHeaders({
    authorization: `Bearer ${encodeURIComponent(sessionToken)}`,
  });
}

export async function setSchoolAdminSession(
  page: Page,
  overrides: SchoolSessionOverrides = {},
) {
  const schoolKey = String(overrides.schoolKey || "demo-school").trim() || "demo-school";
  const schoolDisplayName =
    String(overrides.schoolDisplayName || "Demo School").trim() || "Demo School";

  await applySchoolSession(
    page,
    {
      id: String(overrides.id || "school-admin-1").trim() || "school-admin-1",
      name: String(overrides.name || "School Admin").trim() || "School Admin",
      email:
        String(overrides.email || "admin@example.com").trim() || "admin@example.com",
      accountType: "school_user",
      role: String(overrides.role || "admin").trim() || "admin",
      schoolKey,
    },
    schoolKey,
    schoolDisplayName,
  );
}

export async function setStudentSession(
  page: Page,
  overrides: StudentSessionOverrides = {},
) {
  const schoolKey = String(overrides.schoolKey || "demo-school").trim() || "demo-school";
  const schoolDisplayName =
    String(overrides.schoolDisplayName || "Demo School").trim() || "Demo School";
  const studentSessionId =
    String(overrides.studentSessionId || "student-session-1").trim() ||
    "student-session-1";

  await applySchoolSession(
    page,
    {
      id: String(overrides.id || "student-1").trim() || "student-1",
      name: String(overrides.name || "Aarav").trim() || "Aarav",
      email:
        String(overrides.email || "aarav@example.com").trim() ||
        "aarav@example.com",
      accountType: "school_user",
      role: "student",
      schoolKey,
      studentSessionId,
      studentClassId:
        String(overrides.studentClassId || "111111111111111111111111").trim() ||
        "111111111111111111111111",
      studentAcademicSectionId:
        String(
          overrides.studentAcademicSectionId || "222222222222222222222222",
        ).trim() || "222222222222222222222222",
    },
    schoolKey,
    schoolDisplayName,
  );
}
