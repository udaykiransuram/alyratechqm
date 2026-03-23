import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdminSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import Testimonial from "@/models/Testimonial";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: RouteContext<"/api/admin/testimonials/[id]">,
) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  try {
    await connectDB();
    const testimonial = await Testimonial.findById(id);
    if (!testimonial) {
      return NextResponse.json({ success: false, error: "Testimonial not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: testimonial });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load testimonial." },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: RouteContext<"/api/admin/testimonials/[id]">,
) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  try {
    await connectDB();
    const body = await req.json();
    const testimonial = await Testimonial.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!testimonial) {
      return NextResponse.json({ success: false, error: "Testimonial not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: testimonial });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update testimonial." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: RouteContext<"/api/admin/testimonials/[id]">,
) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  try {
    await connectDB();
    const testimonial = await Testimonial.findByIdAndDelete(id);
    if (!testimonial) {
      return NextResponse.json({ success: false, error: "Testimonial not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Testimonial deleted" });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete testimonial." },
      { status: 500 },
    );
  }
}
