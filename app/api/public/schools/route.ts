import { NextResponse } from "next/server";

import { getPublicSchoolOptions } from "@/lib/server/public-school-data";

const PUBLIC_SCHOOLS_CACHE_CONTROL =
  "public, s-maxage=60, stale-while-revalidate=300";
const NO_STORE_CACHE_CONTROL = "no-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const schools = await getPublicSchoolOptions({
      includeHidden: false,
    });

    return NextResponse.json(
      {
        success: true,
        schools,
      },
      {
        headers: {
          "Cache-Control": PUBLIC_SCHOOLS_CACHE_CONTROL,
        },
      },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load schools.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": NO_STORE_CACHE_CONTROL,
        },
      },
    );
  }
}
