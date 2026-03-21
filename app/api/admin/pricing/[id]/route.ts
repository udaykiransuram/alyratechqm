import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdminSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import PricingPlan from "@/models/PricingPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const plan = await PricingPlan.findById(params.id);
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

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const body = await req.json();
    const plan = await PricingPlan.findByIdAndUpdate(params.id, body, { new: true, runValidators: true });
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

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const plan = await PricingPlan.findByIdAndDelete(params.id);
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
