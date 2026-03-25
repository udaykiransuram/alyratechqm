import { NextRequest, NextResponse } from "next/server";

import { getPublicClassOptions } from "@/lib/server/public-registration-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const schoolKey = req.nextUrl.searchParams.get("school")?.trim() || "";

  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "school required" },
      { status: 400 },
    );
  }

  try {
    const classes = await getPublicClassOptions(schoolKey);

    return NextResponse.json({
      success: true,
      classes,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to load classes.",
      },
      { status: 500 },
    );
  }
}
