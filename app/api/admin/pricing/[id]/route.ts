import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdminSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import PricingPlan from "@/models/PricingPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  try {
    await connectDB();
    const plan = await PricingPlan.findById(id);
    if (!plan) {
      return NextResponse.json({ success: false, error: "Pricing plan not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: plan });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load pricing plan." },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  try {
    await connectDB();
    const body = await req.json();
    const plan = await PricingPlan.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!plan) {
      return NextResponse.json({ success: false, error: "Pricing plan not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: plan });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update pricing plan." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  try {
    await connectDB();
    const plan = await PricingPlan.findByIdAndDelete(id);
    if (!plan) {
      return NextResponse.json({ success: false, error: "Pricing plan not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Pricing plan deleted" });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete pricing plan." },
      { status: 500 },
    );
  }
}
