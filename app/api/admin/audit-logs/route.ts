import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdminSession } from "@/lib/api-auth";
import { getCompanyActivityData } from "@/lib/company/activity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    const data = await getCompanyActivityData({
      schoolKey: req.nextUrl.searchParams.get("schoolKey"),
      action: req.nextUrl.searchParams.get("action"),
      source: req.nextUrl.searchParams.get("source"),
      limit: Number(req.nextUrl.searchParams.get("limit") || "100"),
    });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load company audit logs.",
      },
      { status: 500 },
    );
  }
}
