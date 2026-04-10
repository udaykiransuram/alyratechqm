export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  getLiveSessionErrorStatus,
  getStudentLiveSessionById,
} from "@/lib/server/live-sessions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;
    const liveSession = await getStudentLiveSessionById({
      schoolKey: auth.schoolKey,
      studentId: String(auth.session.user.id || "").trim(),
      studentPlacement: {
        classId: auth.session.user.studentClassId,
        academicSectionId: auth.session.user.studentAcademicSectionId,
      },
      liveSessionId: id,
    });

    if (!liveSession) {
      return NextResponse.json(
        { success: false, message: "Live class not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      liveSession,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to load live class details.",
      },
      { status: getLiveSessionErrorStatus(error) },
    );
  }
}
