export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

export async function GET(req: NextRequest) {
  await connectDB();
  const auth = await requireTenantSession(req, { allowRoles: ["student"] });
  if (!auth.ok) return auth.response;

  try {
    const { StudentNotification: StudentNotificationModel } = await getTenantModels(
      auth.schoolKey,
      ["StudentNotification"],
    );

    const studentId = auth.session.user.id;
    const notifications = await StudentNotificationModel.find({ studentId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const unreadCount = await StudentNotificationModel.countDocuments({
      studentId,
      readAt: null,
    });

    return NextResponse.json({
      success: true,
      unreadCount,
      notifications: notifications.map((item: any) => ({
        id: String(item?._id || ""),
        type: String(item?.type || ""),
        title: String(item?.title || ""),
        message: String(item?.message || ""),
        linkUrl: String(item?.linkUrl || ""),
        createdAt: item?.createdAt ? new Date(item.createdAt).toISOString() : null,
        readAt: item?.readAt ? new Date(item.readAt).toISOString() : null,
      })),
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
