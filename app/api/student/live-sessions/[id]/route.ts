export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  assertSummerCrashStudentApiAccess,
} from "@/lib/server/summer-crash";
import {
  getLiveSessionErrorStatus,
  getStudentLiveSessionById,
} from "@/lib/server/live-sessions";
import { withRequestBudget } from "@/lib/server/request-governor";

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

  const studentId = String(auth.session.user.id || "").trim();
  const accessCheck = await assertSummerCrashStudentApiAccess({
    schoolKey: auth.schoolKey,
    studentId,
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
    return withRequestBudget(
      {
        request: req,
        policy: "liveSessionDetail",
        schoolKey: auth.schoolKey,
        userId: studentId,
        metadata: {
          liveSessionId: id,
        },
      },
      async () => {
        const liveSession = await getStudentLiveSessionById({
          schoolKey: auth.schoolKey,
          studentId,
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

        return NextResponse.json(
          {
            success: true,
            liveSession,
          },
          {
            headers: {
              "Cache-Control": "private, no-store",
            },
          },
        );
      },
    );
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
