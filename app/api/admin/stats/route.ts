import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdminSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import SiteStats from "@/models/SiteStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const section = req.nextUrl.searchParams.get("section")?.trim();

    if (section) {
      const stats = await SiteStats.findOne({ section });
      return NextResponse.json({ success: true, data: stats });
    }

    const allStats = await SiteStats.find();
    return NextResponse.json({ success: true, data: allStats });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load stats." },
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
    const section = String(body.section || "").trim();
    const stats = body.stats;

    if (!section || !Array.isArray(stats)) {
      return NextResponse.json({ success: false, error: "Section and stats are required" }, { status: 400 });
    }

    const updatedStats = await SiteStats.findOneAndUpdate(
      { section },
      { section, stats, updatedAt: new Date() },
      { upsert: true, new: true },
    );

    return NextResponse.json({ success: true, data: updatedStats });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update stats." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const section = req.nextUrl.searchParams.get("section")?.trim();
    if (!section) {
      return NextResponse.json({ success: false, error: "Section is required" }, { status: 400 });
    }

    await SiteStats.findOneAndDelete({ section });
    return NextResponse.json({ success: true, message: "Stats deleted" });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete stats." },
      { status: 500 },
    );
  }
}
