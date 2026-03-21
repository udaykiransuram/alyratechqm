import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdminSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import FAQ from "@/models/FAQ";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const page = req.nextUrl.searchParams.get("page")?.trim();
    const filter: Record<string, unknown> = {};
    if (page) filter.page = page;
    const docs = await FAQ.find(filter).sort({ displayOrder: 1, createdAt: -1 });
    return NextResponse.json({ success: true, data: docs });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load FAQs." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const body = await req.json();
    const doc = await FAQ.create(body);
    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create FAQ." },
      { status: 500 },
    );
  }
}
