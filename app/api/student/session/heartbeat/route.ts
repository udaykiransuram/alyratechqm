import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { isMockedE2ETestMode } from "@/lib/test-mode";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (isMockedE2ETestMode()) {
    return new NextResponse(null, { status: 204 });
  }

  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) return auth.response;

  return new NextResponse(null, { status: 204 });
}
