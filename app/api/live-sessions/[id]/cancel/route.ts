export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  cancelWorkspaceLiveSession,
  getLiveSessionErrorStatus,
} from "@/lib/server/live-sessions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      cancelReason?: string;
    };
    const { id } = await params;
    const liveSession = await cancelWorkspaceLiveSession({
      schoolKey: auth.schoolKey,
      viewerRole: auth.session.user.role as "admin" | "teacher",
      viewerId: String(auth.session.user.id || "").trim(),
      liveSessionId: id,
      cancelReason: String(body?.cancelReason || "").trim() || undefined,
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
          error instanceof Error ? error.message : "Failed to cancel live class.",
      },
      { status: getLiveSessionErrorStatus(error) },
    );
  }
}
