export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

export async function POST(req: NextRequest) {
  await connectDB();
  const auth = await requireTenantSession(req, { allowRoles: ["student"] });
  if (!auth.ok) return auth.response;

  try {
    const { StudentNotification: StudentNotificationModel } = await getTenantModels(
      auth.schoolKey,
      ["StudentNotification"],
    );

    await StudentNotificationModel.updateMany(
      { studentId: auth.session.user.id, readAt: null },
      { $set: { readAt: new Date() } },
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to update notifications." },
      { status: 500 },
    );
  }
}
