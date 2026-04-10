export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  createWorkspaceLiveSession,
  getLiveSessionErrorStatus,
  listWorkspaceLiveSessions,
  normalizeLiveSessionWriteInput,
} from "@/lib/server/live-sessions";

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const status = String(req.nextUrl.searchParams.get("status") || "").trim();
    const classId = String(req.nextUrl.searchParams.get("classId") || "").trim();
    const subjectId = String(
      req.nextUrl.searchParams.get("subjectId") || "",
    ).trim();
    const hostTeacherId = String(
      req.nextUrl.searchParams.get("hostTeacherId") || "",
    ).trim();

    const liveSessions = await listWorkspaceLiveSessions({
      schoolKey: auth.schoolKey,
      viewerRole: auth.session.user.role as "admin" | "teacher",
      viewerId: String(auth.session.user.id || "").trim(),
      filters: {
        status: status || undefined,
        classId: classId || undefined,
        subjectId: subjectId || undefined,
        hostTeacherId: hostTeacherId || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      liveSessions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to load live classes.",
      },
      { status: getLiveSessionErrorStatus(error) },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const liveSession = await createWorkspaceLiveSession({
      schoolKey: auth.schoolKey,
      viewerRole: auth.session.user.role as "admin" | "teacher",
      viewerId: String(auth.session.user.id || "").trim(),
      input: normalizeLiveSessionWriteInput(body),
    });

    return NextResponse.json({
      success: true,
      liveSession,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to create live class.",
      },
      { status: getLiveSessionErrorStatus(error) },
    );
  }
}
