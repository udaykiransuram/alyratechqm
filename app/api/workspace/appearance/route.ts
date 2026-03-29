import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import {
  getSchoolWorkspaceAppearance,
  normalizeWorkspaceAppearance,
  saveSchoolWorkspaceAppearance,
} from "@/lib/server/workspace-appearance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    await connectDB();
    const appearance = await getSchoolWorkspaceAppearance(auth.schoolKey);

    return NextResponse.json({
      success: true,
      schoolKey: auth.schoolKey,
      appearance,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message:
          error?.message || "Failed to load workspace appearance settings.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const currentAppearance = await getSchoolWorkspaceAppearance(auth.schoolKey);
    const nextAppearance = normalizeWorkspaceAppearance({
      ...currentAppearance,
      ...((body?.appearance && typeof body.appearance === "object")
        ? body.appearance
        : body),
    });
    const savedAppearance = await saveSchoolWorkspaceAppearance(
      auth.schoolKey,
      nextAppearance,
    );

    if (!savedAppearance) {
      return NextResponse.json(
        { success: false, message: "School not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      schoolKey: auth.schoolKey,
      appearance: savedAppearance,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message:
          error?.message || "Failed to save workspace appearance settings.",
      },
      { status: 500 },
    );
  }
}
