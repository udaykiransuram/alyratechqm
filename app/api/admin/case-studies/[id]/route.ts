import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdminSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import CaseStudy from "@/models/CaseStudy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const caseStudy = await CaseStudy.findById(params.id);
    if (!caseStudy) {
      return NextResponse.json({ success: false, error: "Case study not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: caseStudy });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load case study." },
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
    const caseStudy = await CaseStudy.findByIdAndUpdate(params.id, body, { new: true, runValidators: true });
    if (!caseStudy) {
      return NextResponse.json({ success: false, error: "Case study not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: caseStudy });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update case study." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const caseStudy = await CaseStudy.findByIdAndDelete(params.id);
    if (!caseStudy) {
      return NextResponse.json({ success: false, error: "Case study not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Case study deleted" });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete case study." },
      { status: 500 },
    );
  }
}
