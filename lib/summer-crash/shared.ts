import {
  SUMMER_CRASH_HOME_PATH,
  SUMMER_CRASH_SCHOOL_KEY,
} from "@/lib/summer-crash/constants";

export function normalizeSummerCrashText(value: unknown): string {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function normalizeSummerCrashLookupText(value: unknown): string {
  return normalizeSummerCrashText(value).toLowerCase();
}

export function normalizeSummerCrashPhone(value: unknown): string {
  return String(value || "")
    .replace(/\D+/g, "")
    .trim();
}

export function normalizeSummerCrashNameKey(value: unknown): string {
  return normalizeSummerCrashLookupText(value);
}

export function normalizeSummerCrashClassBandKey(value: unknown): string {
  return normalizeSummerCrashLookupText(value);
}

export function maskSummerCrashId(value: unknown): string {
  const summerId = String(value || "").trim().toUpperCase();
  if (summerId.length <= 4) {
    return summerId;
  }

  return `${summerId.slice(0, 2)}••${summerId.slice(-2)}`;
}

export function resolveSummerCrashDestinationHref(
  courseIds: readonly string[],
  homeHref = SUMMER_CRASH_HOME_PATH,
): string {
  if (courseIds.length === 1) {
    return `/student/courses/${courseIds[0]}`;
  }

  return homeHref;
}

export function isSummerCrashSession(params: {
  accountType?: string | null;
  role?: string | null;
  schoolKey?: string | null;
}): boolean {
  return (
    params.accountType === "school_user" &&
    params.role === "student" &&
    String(params.schoolKey || "").trim().toLowerCase() ===
      SUMMER_CRASH_SCHOOL_KEY
  );
}
