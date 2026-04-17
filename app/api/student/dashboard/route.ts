export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  assertSummerCrashStudentApiAccess,
} from "@/lib/server/summer-crash";
import { getStudentDashboardData } from "@/lib/server/student-dashboard";

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, { allowRoles: ["student"] });
  if (!auth.ok) return auth.response;
  const accessCheck = await assertSummerCrashStudentApiAccess({
    schoolKey: auth.schoolKey,
    studentId: auth.session.user.id,
    target: {
      kind: "locked-student-content",
    },
  });
  if (!accessCheck.allowed) {
    return NextResponse.json(
      { success: false, message: accessCheck.message },
      { status: 403 },
    );
  }

  try {
    const dashboard = await getStudentDashboardData({
      schoolKey: auth.schoolKey,
      studentId: auth.session.user.id,
      studentPlacement: {
        classId: auth.session.user.studentClassId,
        academicSectionId: auth.session.user.studentAcademicSectionId,
      },
      skipCache: req.nextUrl.searchParams.get("fresh") === "1",
    });

    return NextResponse.json({
      success: true,
      dashboard,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load student dashboard.",
      },
      { status: 500 },
    );
  }
}
