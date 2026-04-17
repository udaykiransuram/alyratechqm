import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { completeSummerCrashSetup } from "@/lib/server/summer-crash";
import { isSummerCrashSchoolKey } from "@/lib/summer-crash/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  if (!isSummerCrashSchoolKey(auth.schoolKey)) {
    return NextResponse.json(
      {
        success: false,
        message: "This setup flow is only available for Summer Crash Course accounts.",
      },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));

  try {
    const state = await completeSummerCrashSetup({
      schoolKey: auth.schoolKey,
      studentId: auth.session.user.id,
      studentPlacement: {
        classId: auth.session.user.studentClassId,
        academicSectionId: auth.session.user.studentAcademicSectionId,
      },
      newPassword: String(body?.newPassword || ""),
      nextDestinationHref:
        typeof body?.nextDestinationHref === "string"
          ? body.nextDestinationHref
          : null,
    });

    return NextResponse.json({
      success: true,
      state,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "We couldn't finish the Summer Crash Course setup.",
      },
      { status: 400 },
    );
  }
}
