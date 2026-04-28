export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  assertSummerCrashStudentApiAccess,
} from "@/lib/server/summer-crash";
import { getLiveSessionErrorStatus, listStudentLiveSessions } from "@/lib/server/live-sessions";
import { withRequestBudget } from "@/lib/server/request-governor";

export async function GET(req: NextRequest) {
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

  const studentId = String(auth.session.user.id || "").trim();

  try {
    return withRequestBudget(
      {
        request: req,
        policy: "liveSessionList",
        schoolKey: auth.schoolKey,
        userId: studentId,
      },
      async () => {
        const liveSessions = await listStudentLiveSessions({
          schoolKey: auth.schoolKey,
          studentId,
          studentPlacement: {
            classId: auth.session.user.studentClassId,
            academicSectionId: auth.session.user.studentAcademicSectionId,
          },
        });

        return NextResponse.json(
          {
            success: true,
            liveSessions,
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
            : "Failed to load student live classes.",
      },
      { status: getLiveSessionErrorStatus(error) },
    );
  }
}
