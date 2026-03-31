import { NextResponse } from "next/server";

import { getSystemHealthSnapshot } from "@/lib/server/system-health";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

export async function GET() {
  const snapshot = await getSystemHealthSnapshot();
  return NextResponse.json(snapshot);
}
