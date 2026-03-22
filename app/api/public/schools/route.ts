import { NextResponse } from "next/server";

import { getPublicSchoolOptions } from "@/lib/server/public-school-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const schools = await getPublicSchoolOptions();

    return NextResponse.json({
      success: true,
      schools,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load schools.",
      },
      { status: 500 },
    );
  }
}
