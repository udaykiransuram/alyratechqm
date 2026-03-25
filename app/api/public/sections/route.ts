import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { getPublicSectionOptions } from "@/lib/server/public-registration-data";
import { isMockedE2ETestMode } from "@/lib/test-mode";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const schoolKey = req.nextUrl.searchParams.get("school")?.trim() || "";
  const classId = req.nextUrl.searchParams.get("classId")?.trim() || "";

  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "school required" },
      { status: 400 },
    );
  }

  if (isMockedE2ETestMode()) {
    return NextResponse.json({
      success: true,
      sections: [],
    });
  }

  if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
    return NextResponse.json(
      { success: false, message: "valid classId required" },
      { status: 400 },
    );
  }

  try {
    const sections = await getPublicSectionOptions(schoolKey, classId);

    return NextResponse.json({
      success: true,
      sections,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to load sections.",
      },
      { status: 500 },
    );
  }
}
