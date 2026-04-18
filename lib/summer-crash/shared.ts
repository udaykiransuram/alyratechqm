import {
  SUMMER_CRASH_DIAGNOSTIC_SUBMITTED_PATH,
  SUMMER_CRASH_HOME_PATH,
  SUMMER_CRASH_SCHOOL_KEY,
  SUMMER_CRASH_WELCOME_PATH,
} from "@/lib/summer-crash/constants";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";

export type SummerCrashLookupMatch = {
  studentName?: string | null;
  guardianName?: string | null;
  classBand?: string | null;
  summerId?: string | null;
  maskedSummerId?: string | null;
};

export type NormalizedSummerCrashLookupMatch = {
  studentName: string;
  guardianName: string;
  classBand: string;
  summerId: string;
  maskedSummerId: string;
};

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
  const normalized = normalizeSummerCrashLookupText(value);
  const digits = normalized.match(/\d+/g);
  if (digits && digits.length > 0) {
    const n = Number.parseInt(digits[0], 10);
    if (Number.isFinite(n)) {
      return `class ${n}`;
    }
  }
  return normalized;
}

export function formatSummerCrashPrice(price: unknown, currency: unknown): string {
  const numericPrice = Number(price);
  const normalizedCurrency = String(currency || "INR")
    .trim()
    .toUpperCase();

  if (!Number.isFinite(numericPrice)) {
    return normalizedCurrency ? `${normalizedCurrency} 0` : "0";
  }

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: normalizedCurrency || "INR",
      maximumFractionDigits: Number.isInteger(numericPrice) ? 0 : 2,
    }).format(numericPrice);
  } catch {
    return normalizedCurrency
      ? `${normalizedCurrency} ${numericPrice}`
      : String(numericPrice);
  }
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

export function buildSummerCrashDiagnosticReturnToPath() {
  return SUMMER_CRASH_DIAGNOSTIC_SUBMITTED_PATH;
}

export function buildSummerCrashDiagnosticHref(paperId: unknown) {
  const normalizedPaperId = String(paperId || "").trim();
  if (!normalizedPaperId) {
    return SUMMER_CRASH_HOME_PATH;
  }

  const searchParams = new URLSearchParams({
    returnTo: buildSummerCrashDiagnosticReturnToPath(),
    autoStart: "1",
  });

  return `/student/tests/${encodeURIComponent(normalizedPaperId)}?${searchParams.toString()}`;
}

export function buildSummerCrashWelcomeHref(nextHref?: string | null) {
  const safeNextHref = getSafeReturnToPath(nextHref);
  if (!safeNextHref) {
    return SUMMER_CRASH_WELCOME_PATH;
  }

  const searchParams = new URLSearchParams({
    next: safeNextHref,
  });

  return `${SUMMER_CRASH_WELCOME_PATH}?${searchParams.toString()}`;
}

export function resolveSummerCrashPostRegistrationHref(params: {
  destinationHref?: string | null;
  entrySource?: "diagnostic" | "direct_registration" | null;
  requiresPasswordSetup?: boolean;
}) {
  const safeDestinationHref =
    getSafeReturnToPath(params.destinationHref) || SUMMER_CRASH_HOME_PATH;

  if (!params.requiresPasswordSetup) {
    return safeDestinationHref;
  }

  if (params.entrySource === "diagnostic") {
    return safeDestinationHref;
  }

  return buildSummerCrashWelcomeHref(safeDestinationHref);
}

export function buildSummerCrashStudentReportHref(responseId: unknown) {
  const normalizedResponseId = String(responseId || "").trim();
  if (!normalizedResponseId) {
    return "";
  }

  const searchParams = new URLSearchParams({
    returnTo: SUMMER_CRASH_HOME_PATH,
  });

  return `/student/reports/${encodeURIComponent(normalizedResponseId)}?${searchParams.toString()}`;
}

export function normalizeSummerCrashLookupMatches(
  matches: readonly SummerCrashLookupMatch[] | undefined | null,
): NormalizedSummerCrashLookupMatch[] {
  return (Array.isArray(matches) ? matches : [])
    .map((match) => {
      const studentName = normalizeSummerCrashText(match?.studentName);
      const guardianName = normalizeSummerCrashText(match?.guardianName);
      const classBand = normalizeSummerCrashText(match?.classBand);
      const summerId = String(match?.summerId || "").trim().toUpperCase();
      const maskedSummerId =
        normalizeSummerCrashText(match?.maskedSummerId) ||
        maskSummerCrashId(summerId);

      return {
        studentName,
        guardianName,
        classBand,
        summerId,
        maskedSummerId,
      };
    })
    .filter((match) => match.studentName && match.summerId);
}

export function resolveSummerCrashSelectedSummerId(
  matches: readonly SummerCrashLookupMatch[] | undefined | null,
  preferredSummerId?: unknown,
): string {
  const normalizedMatches = normalizeSummerCrashLookupMatches(matches);
  const normalizedPreferredSummerId = String(preferredSummerId || "")
    .trim()
    .toUpperCase();

  if (
    normalizedPreferredSummerId &&
    normalizedMatches.some(
      (match) => match.summerId === normalizedPreferredSummerId,
    )
  ) {
    return normalizedPreferredSummerId;
  }

  if (normalizedMatches.length === 1) {
    return normalizedMatches[0].summerId;
  }

  return "";
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
