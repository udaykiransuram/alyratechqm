export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { bumpStudentNotificationSignalVersion } from "@/lib/redis";
import { invalidateStudentDashboardCacheForStudent } from "@/lib/server/student-dashboard-cache";
import { broadcastStudentNotification } from "@/lib/server/student-notifications-stream";

export async function POST(req: NextRequest) {
  await connectDB();
  const auth = await requireTenantSession(req, { allowRoles: ["student"] });
  if (!auth.ok) return auth.response;

  try {
    const { StudentNotification: StudentNotificationModel } = await getTenantModels(
      auth.schoolKey,
      ["StudentNotification"],
    );

    const result = await StudentNotificationModel.updateMany(
      { studentId: auth.session.user.id, readAt: null },
      { $set: { readAt: new Date() } },
    );

    if (Number(result.modifiedCount || 0) > 0) {
      await invalidateStudentDashboardCacheForStudent(
        auth.schoolKey,
        auth.session.user.id,
      );

      const signalVersion = await bumpStudentNotificationSignalVersion(
        auth.schoolKey,
        auth.session.user.id,
      ).catch(() => null);

      broadcastStudentNotification(auth.schoolKey, auth.session.user.id, {
        id: "read-all",
        type: "sync",
        signalVersion,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to update notifications." },
      { status: 500 },
    );
  }
}
