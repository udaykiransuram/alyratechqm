import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireTenantSession } from "@/lib/api-auth";
import { runReportDispatchWorker } from "@/lib/reports/dispatchWorker";

export async function POST(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) return auth.response;
  const { schoolKey } = auth;
  await connectDB();
  const result = await runReportDispatchWorker({
    origin: req.nextUrl.origin,
    schoolKey,
  });

  return NextResponse.json({ success: true, ...result });
}
