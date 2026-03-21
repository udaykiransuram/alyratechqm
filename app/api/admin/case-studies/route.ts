import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdminSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import CaseStudy from "@/models/CaseStudy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const caseStudies = await CaseStudy.find().sort({ displayOrder: 1, createdAt: -1 });
    return NextResponse.json({ success: true, data: caseStudies });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load case studies." },
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
    const caseStudy = await CaseStudy.create(body);
    return NextResponse.json({ success: true, data: caseStudy }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create case study." },
      { status: 500 },
    );
  }
}
