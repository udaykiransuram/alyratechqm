import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) return auth.response;

  return new NextResponse(null, { status: 204 });
}
