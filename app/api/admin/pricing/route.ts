import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdminSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import PricingPlan from "@/models/PricingPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const plans = await PricingPlan.find().sort({ displayOrder: 1, createdAt: -1 });
    return NextResponse.json({ success: true, data: plans });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load pricing plans." },
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
    const plan = await PricingPlan.create(body);
    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create pricing plan." },
      { status: 500 },
    );
  }
}
