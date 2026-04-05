export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { getStudentDashboardData } from "@/lib/server/student-dashboard";

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, { allowRoles: ["student"] });
  if (!auth.ok) return auth.response;

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
