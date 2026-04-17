import { SUMMER_CRASH_CURRENCY } from "@/lib/summer-crash/constants";

export type SummerCrashPaymentStatus = "none" | "pending" | "paid" | "failed";

export type SummerCrashCourseAccessState = {
  requiresPayment: boolean;
  isUnlocked: boolean;
  latestPaymentStatus: SummerCrashPaymentStatus;
  price: number;
  currency: string;
};

function normalizeSummerCrashPaymentLookupStatus(
  value: unknown,
): Exclude<SummerCrashPaymentStatus, "none"> | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "pending" ||
    normalized === "paid" ||
    normalized === "failed"
  ) {
    return normalized;
  }
  return null;
}

export function deriveSummerCrashCourseAccessState(params: {
  price: unknown;
  currency: unknown;
  paymentStatuses?: readonly unknown[] | null;
}): SummerCrashCourseAccessState {
  const parsedPrice = Number(params.price);
  const price = Number.isFinite(parsedPrice) ? Math.max(0, parsedPrice) : 0;
  const currency = String(params.currency || SUMMER_CRASH_CURRENCY || "INR")
    .trim()
    .toUpperCase();
  const requiresPayment = price > 0;
  const normalizedStatuses = (Array.isArray(params.paymentStatuses)
    ? params.paymentStatuses
    : []
  )
    .map((status) => normalizeSummerCrashPaymentLookupStatus(status))
    .filter(Boolean) as Array<Exclude<SummerCrashPaymentStatus, "none">>;
  const hasPaid = normalizedStatuses.includes("paid");

  return {
    requiresPayment,
    isUnlocked: !requiresPayment || hasPaid,
    latestPaymentStatus: hasPaid
      ? "paid"
      : requiresPayment
        ? normalizedStatuses[0] || "none"
        : "none",
    price,
    currency: currency || "INR",
  };
}
