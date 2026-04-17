export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  assertSummerCrashStudentApiAccess,
} from "@/lib/server/summer-crash";
import {
  getLiveSessionErrorStatus,
  recordStudentLiveSessionJoinAndResolveTarget,
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

  const accessCheck = await assertSummerCrashStudentApiAccess({
    schoolKey: auth.schoolKey,
    studentId: String(auth.session.user.id || "").trim(),
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
    const { id } = await params;
    const result = await recordStudentLiveSessionJoinAndResolveTarget({
      schoolKey: auth.schoolKey,
      studentId: String(auth.session.user.id || "").trim(),
      studentPlacement: {
        classId: auth.session.user.studentClassId,
        academicSectionId: auth.session.user.studentAcademicSectionId,
      },
      liveSessionId: id,
    });

    if (!result?.redirectUrl) {
      return NextResponse.json(
        { success: false, message: "Live class not found." },
        { status: 404 },
      );
    }

    return NextResponse.redirect(new URL(result.redirectUrl));
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to launch the live class.",
      },
      { status: getLiveSessionErrorStatus(error) },
    );
  }
}
