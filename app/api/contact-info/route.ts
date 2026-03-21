import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import ContactInfo from "@/models/ContactInfo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await connectDB();
    const doc = await ContactInfo.findOne();
    return NextResponse.json({ success: true, data: doc || null });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load contact info.",
      },
      { status: 500 },
    );
  }
}
