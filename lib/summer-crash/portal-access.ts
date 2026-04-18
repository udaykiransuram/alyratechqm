import { SUMMER_CRASH_HOME_PATH } from "@/lib/summer-crash/constants";

export type SummerCrashPortalAccessPolicy = {
  applies: boolean;
  isUnlocked: boolean;
  requiresPayment: boolean;
  allowedDiagnosticPaperId: string | null;
  allowedDiagnosticResponseId: string | null;
  redirectHref: string;
};

export type SummerCrashPortalAccessTarget =
  | { kind: "session-heartbeat" }
  | { kind: "crash-course" }
  | { kind: "diagnostic-test"; paperId?: string | null }
  | { kind: "diagnostic-report"; responseId?: string | null }
  | { kind: "locked-student-content" };

export const SUMMER_CRASH_PORTAL_ACCESS_LOCK_MESSAGE =
  "Only the free diagnostic test and its report are available until payment is completed.";

export function getDefaultSummerCrashPortalAccessPolicy(): SummerCrashPortalAccessPolicy {
  return {
    applies: false,
    isUnlocked: true,
    requiresPayment: false,
    allowedDiagnosticPaperId: null,
    allowedDiagnosticResponseId: null,
    redirectHref: SUMMER_CRASH_HOME_PATH,
  };
}

export function isSummerCrashPortalRestricted(
  policy: SummerCrashPortalAccessPolicy,
) {
  return Boolean(policy.applies && !policy.isUnlocked);
}

export function canAccessSummerCrashPortalTarget(
  policy: SummerCrashPortalAccessPolicy,
  target: SummerCrashPortalAccessTarget,
) {
  if (!isSummerCrashPortalRestricted(policy)) {
    return true;
  }

  switch (target.kind) {
    case "session-heartbeat":
    case "crash-course":
      return true;
    case "diagnostic-test":
      return Boolean(
        policy.allowedDiagnosticPaperId &&
          target.paperId &&
          policy.allowedDiagnosticPaperId === target.paperId,
      );
    case "diagnostic-report":
      return Boolean(
        policy.allowedDiagnosticResponseId &&
          target.responseId &&
          policy.allowedDiagnosticResponseId === target.responseId,
      );
    case "locked-student-content":
    default:
      return false;
  }
}

export function isSummerCrashConfiguredDiagnosticPaper(
  policy: SummerCrashPortalAccessPolicy,
  paperId?: string | null,
) {
  const normalizedPaperId = String(paperId || "").trim();

  return Boolean(
    policy.applies &&
      policy.allowedDiagnosticPaperId &&
      normalizedPaperId &&
      policy.allowedDiagnosticPaperId === normalizedPaperId,
  );
}
