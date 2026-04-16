import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { getSummerCrashStudentState } from "@/lib/server/summer-crash";
import { isSummerCrashSchoolKey } from "@/lib/summer-crash/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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
        message: "This route is only available for Summer Crash Course students.",
      },
      { status: 403 },
    );
  }

  try {
    const state = await getSummerCrashStudentState({
      schoolKey: auth.schoolKey,
      studentId: auth.session.user.id,
      studentPlacement: {
        classId: auth.session.user.studentClassId,
        academicSectionId: auth.session.user.studentAcademicSectionId,
      },
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
            : "We couldn't load Summer Crash Course access.",
      },
      { status: 400 },
    );
  }
}
