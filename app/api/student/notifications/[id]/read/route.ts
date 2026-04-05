export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const auth = await requireTenantSession(req, { allowRoles: ["student"] });
  if (!auth.ok) return auth.response;

  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { success: false, message: "Notification not found." },
      { status: 404 },
    );
  }

  try {
    const { StudentNotification: StudentNotificationModel } = await getTenantModels(
      auth.schoolKey,
      ["StudentNotification"],
    );

    await StudentNotificationModel.updateOne(
      { _id: id, studentId: auth.session.user.id, readAt: null },
      { $set: { readAt: new Date() } },
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to update notification." },
      { status: 500 },
    );
  }
}
