export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  getLiveSessionErrorStatus,
  startWorkspaceLiveSession,
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
    const { id } = await params;
    const result = await startWorkspaceLiveSession({
      schoolKey: auth.schoolKey,
      viewerRole: auth.session.user.role as "admin" | "teacher",
      viewerId: String(auth.session.user.id || "").trim(),
      liveSessionId: id,
    });

    if (!result?.liveSession) {
      return NextResponse.json(
        { success: false, message: "Live class not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      liveSession: result.liveSession,
      joinUrl: result.joinUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to start live class.",
      },
      { status: getLiveSessionErrorStatus(error) },
    );
  }
}
