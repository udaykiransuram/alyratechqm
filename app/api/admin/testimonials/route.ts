import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdminSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import Testimonial from "@/models/Testimonial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const section = req.nextUrl.searchParams.get("section")?.trim();
    const filter: Record<string, string> = {};
    if (section) filter.section = section;

    const testimonials = await Testimonial.find(filter).sort({ displayOrder: 1, createdAt: -1 });
    return NextResponse.json({ success: true, data: testimonials });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load testimonials." },
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
    const testimonial = await Testimonial.create(body);
    return NextResponse.json({ success: true, data: testimonial }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create testimonial." },
      { status: 500 },
    );
  }
}
