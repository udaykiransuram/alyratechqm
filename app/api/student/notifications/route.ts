export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  assertSummerCrashStudentApiAccess,
} from "@/lib/server/summer-crash";
import {
  getStudentNotificationSnapshot,
  getStudentNotificationUnreadCount,
} from "@/lib/server/student-notifications";

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
    const studentId = auth.session.user.id;
    const mode = String(req.nextUrl.searchParams.get("mode") || "").trim();
    if (mode === "unread") {
      const unreadCount = await getStudentNotificationUnreadCount({
        schoolKey: auth.schoolKey,
        studentId,
      });

      return NextResponse.json({
        success: true,
        unreadCount,
      });
    }

    const rawLimit = req.nextUrl.searchParams.get("limit");
    const limit = rawLimit ? Number(rawLimit) : undefined;
    const snapshot = await getStudentNotificationSnapshot({
      schoolKey: auth.schoolKey,
      studentId,
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    return NextResponse.json({
      success: true,
      unreadCount: snapshot.unreadCount,
      notifications: snapshot.notifications,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load notifications.",
      },
      { status: 500 },
    );
  }
}
