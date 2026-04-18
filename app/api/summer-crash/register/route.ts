import { NextRequest, NextResponse } from "next/server";

import {
  hashSensitiveScopeValue,
  withRequestBudget,
} from "@/lib/server/request-governor";
import { registerSummerCrashStudent } from "@/lib/server/summer-crash";
import { normalizeSummerCrashPhone } from "@/lib/summer-crash/shared";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phoneDigits = normalizeSummerCrashPhone(body?.phone);

  return withRequestBudget(
    {
      request: req,
      policy: "summerCrashRegister",
      scopeId: phoneDigits
        ? `summer-crash:${hashSensitiveScopeValue(phoneDigits)}`
        : "summer-crash:anonymous",
    },
    async () => {
      try {
        const result = await registerSummerCrashStudent({
          studentName: String(body?.studentName || ""),
          guardianName: String(body?.guardianName || ""),
          phone: String(body?.phone || ""),
          classBand: String(body?.classBand || ""),
          sourceSchoolName: String(body?.sourceSchoolName || ""),
          password: String(body?.password || ""),
          entrySource:
            String(body?.entrySource || "").trim() === "diagnostic"
              ? "diagnostic"
              : "direct_registration",
        });

        return NextResponse.json({
          success: true,
          registration: {
            title: result.campaignTitle,
            supportContact: result.supportContact,
            studentName: result.studentName,
            guardianName: result.guardianName,
            classBand: result.classBand,
            summerId: result.summerId,
            autoSignInAllowed: result.autoSignInAllowed,
            signInPassword: result.autoSignInAllowed
              ? result.signInPassword
              : "",
            signInPath: result.signInPath,
            destinationHref: result.destinationHref,
            entrySource: result.entrySource,
          },
        });
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : "We couldn't complete Summer Crash Course registration.",
          },
          { status: 400 },
        );
      }
    },
  );
}
