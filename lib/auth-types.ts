export type SchoolUserRole = "admin" | "teacher" | "student";

export type AccountType = "company_admin" | "school_user";

export type AppRole = "company_admin" | SchoolUserRole;

export function getDefaultRouteForRole(role: AppRole) {
  if (role === "company_admin") return "/manage/schools";
  if (role === "student") return "/student/tests";
  return "/";
}
