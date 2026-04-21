import { SUMMER_CRASH_CURRENCY } from "@/lib/summer-crash/constants";

export type SummerCrashEarlyBirdOffer = {
  label: string;
  price: number;
  originalPrice: number;
  currency: string;
  savingsAmount: number;
  endsAt: string;
};

export type SummerCrashResolvedPricing = {
  price: number;
  currency: string;
  earlyBirdOffer: SummerCrashEarlyBirdOffer | null;
};

export type SummerCrashCountdownParts = {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
};

function normalizeCurrency(value: unknown) {
  return String(value || SUMMER_CRASH_CURRENCY || "INR")
    .trim()
    .toUpperCase();
}

function normalizeText(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function parseMoney(value: unknown) {
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.max(0, numericValue);
}

function parseDateValue(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return null;
  }

  const parsedDate = new Date(normalizedValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function resolveSummerCrashEarlyBirdOffer(params: {
  basePrice: unknown;
  currency: unknown;
  earlyBirdPrice?: unknown;
  earlyBirdEndsAt?: unknown;
  earlyBirdLabel?: unknown;
  now?: Date | string | number;
}): SummerCrashEarlyBirdOffer | null {
  const originalPrice = parseMoney(params.basePrice) ?? 0;
  if (originalPrice <= 0) {
    return null;
  }

  const endsAtDate = parseDateValue(params.earlyBirdEndsAt);
  if (!endsAtDate) {
    return null;
  }

  const nowDate = parseDateValue(params.now) ?? new Date();
  if (nowDate.getTime() >= endsAtDate.getTime()) {
    return null;
  }

  const configuredOfferPrice = parseMoney(params.earlyBirdPrice);
  const fallbackDiscountAmount = Math.max(
    200,
    Math.round(originalPrice * 0.2),
  );
  const fallbackOfferPrice = Math.max(originalPrice - fallbackDiscountAmount, 0);
  const offerPrice =
    configuredOfferPrice !== null ? configuredOfferPrice : fallbackOfferPrice;

  if (offerPrice <= 0 || offerPrice >= originalPrice) {
    return null;
  }

  return {
    label: normalizeText(params.earlyBirdLabel) || "Early Bird Offer",
    price: offerPrice,
    originalPrice,
    currency: normalizeCurrency(params.currency),
    savingsAmount: Math.max(0, originalPrice - offerPrice),
    endsAt: endsAtDate.toISOString(),
  };
}

export function resolveSummerCrashPricing(params: {
  basePrice: unknown;
  currency: unknown;
  earlyBirdPrice?: unknown;
  earlyBirdEndsAt?: unknown;
  earlyBirdLabel?: unknown;
  now?: Date | string | number;
}): SummerCrashResolvedPricing {
  const price = parseMoney(params.basePrice) ?? 0;
  const currency = normalizeCurrency(params.currency);
  const earlyBirdOffer = resolveSummerCrashEarlyBirdOffer({
    basePrice: price,
    currency,
    earlyBirdPrice: params.earlyBirdPrice,
    earlyBirdEndsAt: params.earlyBirdEndsAt,
    earlyBirdLabel: params.earlyBirdLabel,
    now: params.now,
  });

  return {
    price: earlyBirdOffer?.price ?? price,
    currency,
    earlyBirdOffer,
  };
}

export function getSummerCrashCountdownParts(params: {
  endsAt: Date | string | number;
  now?: Date | string | number;
}): SummerCrashCountdownParts {
  const endsAtDate = parseDateValue(params.endsAt);
  const nowDate = parseDateValue(params.now) ?? new Date();

  if (!endsAtDate) {
    return {
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      expired: true,
    };
  }

  const totalMs = Math.max(0, endsAtDate.getTime() - nowDate.getTime());
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return {
    totalMs,
    days,
    hours,
    minutes,
    seconds,
    expired: totalMs <= 0,
  };
}

export function formatSummerCrashOfferDeadline(value: unknown) {
  const parsedDate = parseDateValue(value);
  if (!parsedDate) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(parsedDate);
  } catch {
    return parsedDate.toISOString();
  }
}
