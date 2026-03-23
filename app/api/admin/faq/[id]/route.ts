import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdminSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import FAQ from "@/models/FAQ";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  context: RouteContext<"/api/admin/faq/[id]">,
) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  try {
    await connectDB();
    const body = await req.json();
    const doc = await FAQ.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!doc) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: doc });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update FAQ." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: RouteContext<"/api/admin/faq/[id]">,
) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  try {
    await connectDB();
    const doc = await FAQ.findByIdAndDelete(id);
    if (!doc) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete FAQ." },
      { status: 500 },
    );
  }
}
