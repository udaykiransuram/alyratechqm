import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { isMockedE2ETestMode } from "@/lib/test-mode";
import ContactInfo from "@/models/ContactInfo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    if (isMockedE2ETestMode()) {
      return NextResponse.json(
        { success: true, data: null },
        {
          headers: {
            "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
          },
        },
      );
    }

    await connectDB();
    const doc = await ContactInfo.findOne();
    return NextResponse.json(
      { success: true, data: doc || null },
      {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        },
      },
    );
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
