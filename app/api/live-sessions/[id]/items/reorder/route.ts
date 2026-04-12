export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  getLiveSessionErrorStatus,
  reorderWorkspaceLiveSessionItems,
} from "@/lib/server/live-sessions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      orderedItemIds?: unknown[];
    };
    const { id } = await params;
    const liveSession = await reorderWorkspaceLiveSessionItems({
      schoolKey: auth.schoolKey,
      viewerRole: auth.session.user.role as "admin" | "teacher",
      viewerId: String(auth.session.user.id || "").trim(),
      liveSessionId: id,
      orderedItemIds: (Array.isArray(body?.orderedItemIds)
        ? body.orderedItemIds
        : []
      )
        .map((itemId) => String(itemId || "").trim())
        .filter(Boolean),
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
          error instanceof Error
            ? error.message
            : "Failed to reorder live items.",
      },
      { status: getLiveSessionErrorStatus(error) },
    );
  }
}
