export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { getLiveSessionErrorStatus, listStudentLiveSessions } from "@/lib/server/live-sessions";

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const liveSessions = await listStudentLiveSessions({
      schoolKey: auth.schoolKey,
      studentId: String(auth.session.user.id || "").trim(),
      studentPlacement: {
        classId: auth.session.user.studentClassId,
        academicSectionId: auth.session.user.studentAcademicSectionId,
      },
    });

    return NextResponse.json({
      success: true,
      liveSessions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to load student live classes.",
      },
      { status: getLiveSessionErrorStatus(error) },
    );
  }
}
