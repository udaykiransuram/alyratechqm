import { NextRequest, NextResponse } from "next/server";

import {
  hashSensitiveScopeValue,
  withRequestBudget,
} from "@/lib/server/request-governor";
import { lookupSummerCrashIdsByPhone } from "@/lib/server/summer-crash";
import { normalizeSummerCrashPhone } from "@/lib/summer-crash/shared";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phoneDigits = normalizeSummerCrashPhone(body?.phone);

  return withRequestBudget(
    {
      request: req,
      policy: "summerCrashLookup",
      scopeId: phoneDigits
        ? `summer-crash-lookup:${hashSensitiveScopeValue(phoneDigits)}`
        : "summer-crash-lookup:anonymous",
    },
    async () => {
      try {
        const result = await lookupSummerCrashIdsByPhone(String(body?.phone || ""));
        return NextResponse.json({
          success: true,
          ...result,
        });
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : "We couldn't find any Summer Crash Course students for that phone number.",
          },
          { status: 400 },
        );
      }
    },
  );
}
