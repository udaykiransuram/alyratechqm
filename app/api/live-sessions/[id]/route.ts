export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  deleteWorkspaceLiveSession,
  getLiveSessionErrorStatus,
  getWorkspaceLiveSessionById,
  normalizeLiveSessionWriteInput,
  updateWorkspaceLiveSession,
} from "@/lib/server/live-sessions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;
    const liveSession = await getWorkspaceLiveSessionById({
      schoolKey: auth.schoolKey,
      viewerRole: auth.session.user.role as "admin" | "teacher",
      viewerId: String(auth.session.user.id || "").trim(),
      liveSessionId: id,
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
          error instanceof Error ? error.message : "Failed to load live class.",
      },
      { status: getLiveSessionErrorStatus(error) },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { id } = await params;
    const liveSession = await updateWorkspaceLiveSession({
      schoolKey: auth.schoolKey,
      viewerRole: auth.session.user.role as "admin" | "teacher",
      viewerId: String(auth.session.user.id || "").trim(),
      liveSessionId: id,
      input: normalizeLiveSessionWriteInput(body),
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
          error instanceof Error ? error.message : "Failed to update live class.",
      },
      { status: getLiveSessionErrorStatus(error) },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;
    const deleted = await deleteWorkspaceLiveSession({
      schoolKey: auth.schoolKey,
      viewerRole: auth.session.user.role as "admin" | "teacher",
      viewerId: String(auth.session.user.id || "").trim(),
      liveSessionId: id,
    });

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Live class not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to delete live class.",
      },
      { status: getLiveSessionErrorStatus(error) },
    );
  }
}
