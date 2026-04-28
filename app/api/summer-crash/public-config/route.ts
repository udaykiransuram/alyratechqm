import { NextResponse } from "next/server";

import {
  getSummerCrashPublicConfig,
  isSummerCrashPublicConfigFallback,
} from "@/lib/server/summer-crash";

export const runtime = "nodejs";

const SUMMER_CRASH_PUBLIC_CONFIG_MAX_AGE_SECONDS = 60;

function resolvePublicConfigCacheControl(
  config: Awaited<ReturnType<typeof getSummerCrashPublicConfig>>,
) {
  if (isSummerCrashPublicConfigFallback(config)) {
    return "no-store";
  }

  const earlyBirdEndsAtMs = config.earlyBirdOffer?.endsAt
    ? Date.parse(config.earlyBirdOffer.endsAt)
    : NaN;
  if (Number.isFinite(earlyBirdEndsAtMs)) {
    const secondsUntilDeadline = Math.max(
      1,
      Math.floor((earlyBirdEndsAtMs - Date.now()) / 1000),
    );
    const maxAge = Math.min(
      SUMMER_CRASH_PUBLIC_CONFIG_MAX_AGE_SECONDS,
      secondsUntilDeadline,
    );
    return `public, s-maxage=${maxAge}, must-revalidate`;
  }

  return `public, s-maxage=${SUMMER_CRASH_PUBLIC_CONFIG_MAX_AGE_SECONDS}, stale-while-revalidate=${SUMMER_CRASH_PUBLIC_CONFIG_MAX_AGE_SECONDS}`;
}

export async function GET() {
  const config = await getSummerCrashPublicConfig();

  return NextResponse.json(
    { success: true, config },
    {
      headers: {
        "Cache-Control": resolvePublicConfigCacheControl(config),
      },
    },
  );
}
