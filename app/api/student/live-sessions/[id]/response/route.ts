export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  getLiveSessionErrorStatus,
  normalizeStudentLiveSessionResponseInput,
  submitStudentLiveSessionResponse,
} from "@/lib/server/live-sessions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown> & {
      itemId?: string;
    };
    const { id } = await params;
    const liveSession = await submitStudentLiveSessionResponse({
      schoolKey: auth.schoolKey,
      studentId: String(auth.session.user.id || "").trim(),
      studentPlacement: {
        classId: auth.session.user.studentClassId,
        academicSectionId: auth.session.user.studentAcademicSectionId,
      },
      liveSessionId: id,
      itemId: String(body?.itemId || "").trim(),
      input: normalizeStudentLiveSessionResponseInput(body),
    });

    if (!liveSession) {
      return NextResponse.json(
        { success: false, message: "Live class or live item not found." },
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
            : "Failed to submit the live response.",
      },
      { status: getLiveSessionErrorStatus(error) },
    );
  }
}
