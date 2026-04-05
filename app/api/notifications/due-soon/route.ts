export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { createCourseDueSoonNotificationsForSchool } from "@/lib/server/student-notifications";

export async function POST(req: NextRequest) {
  await connectDB();
  const auth = await requireTenantSession(req, { allowRoles: ["admin"] });
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const courseIds = Array.isArray(body?.courseIds)
      ? body.courseIds.map((id: any) => String(id || "").trim()).filter(Boolean)
      : undefined;

    await createCourseDueSoonNotificationsForSchool({
      schoolKey: auth.schoolKey,
      courseIds,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to generate due soon notifications." },
      { status: 500 },
    );
  }
}
