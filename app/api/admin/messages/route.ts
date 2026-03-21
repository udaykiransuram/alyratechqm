import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdminSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import ContactMessage from "@/models/ContactMessage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const page = Math.max(parseInt(req.nextUrl.searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("pageSize") || "20", 10), 1), 100);
    const readParam = req.nextUrl.searchParams.get("read");
    const filter: Record<string, unknown> = {};
    if (readParam === "true") filter.read = true;
    if (readParam === "false") filter.read = false;

    const [items, total] = await Promise.all([
      ContactMessage.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      ContactMessage.countDocuments(filter),
    ]);

    return NextResponse.json({ success: true, data: items, page, pageSize, total });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load messages." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const body = await req.json();
    const id = String(body.id || "").trim();
    const read = Boolean(body.read);
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }
    const updated = await ContactMessage.findByIdAndUpdate(id, { read }, { new: true });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update message." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const id = req.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }
    await ContactMessage.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete message." },
      { status: 500 },
    );
  }
}
