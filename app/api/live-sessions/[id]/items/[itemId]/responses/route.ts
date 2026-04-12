export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  getLiveSessionErrorStatus,
  getWorkspaceLiveSessionItemResponses,
} from "@/lib/server/live-sessions";

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id, itemId } = await params;
    const page = Math.trunc(Number(req.nextUrl.searchParams.get("page") || "1"));
    const limit = Math.trunc(Number(req.nextUrl.searchParams.get("limit") || "10"));
    const responsePage = await getWorkspaceLiveSessionItemResponses({
      schoolKey: auth.schoolKey,
      viewerRole: auth.session.user.role as "admin" | "teacher",
      viewerId: String(auth.session.user.id || "").trim(),
      liveSessionId: id,
      itemId,
      page,
      limit,
    });

    if (!responsePage) {
      return NextResponse.json(
        { success: false, message: "Live item not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      responsePage,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to load live-item responses.",
      },
      { status: getLiveSessionErrorStatus(error) },
    );
  }
}
