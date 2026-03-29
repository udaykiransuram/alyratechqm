import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { listReleasedStudentAccountReports } from "@/lib/student-account/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) return auth.response;

  const schoolKey = auth.schoolKey as string;
  const studentId = auth.session.user.id;

  try {
    const reports = await listReleasedStudentAccountReports({
      schoolKey,
      studentId,
      now: new Date(),
    });

    return NextResponse.json({
      success: true,
      reports,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load released report summaries.",
      },
      { status: 500 },
    );
  }
}

