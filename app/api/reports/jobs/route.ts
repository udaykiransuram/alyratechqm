import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  DEFAULT_REPORT_JOB_PAGE_SIZE,
  getReportJobsPageData,
} from "@/lib/server/report-jobs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  try {
    const result = await getReportJobsPageData({
      schoolKey: auth.schoolKey,
      query: {
        status: req.nextUrl.searchParams.get("status") || "",
        type: req.nextUrl.searchParams.get("type") || "",
        scope: req.nextUrl.searchParams.get("scope") || "",
        academicSectionId: req.nextUrl.searchParams.get("academicSectionId") || "",
        limit: Number(
          req.nextUrl.searchParams.get("limit") || DEFAULT_REPORT_JOB_PAGE_SIZE,
        ),
        page: Number(req.nextUrl.searchParams.get("page") || "1"),
        includeAttemptHistory:
          req.nextUrl.searchParams.get("includeAttemptHistory") === "1",
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    if (typeof error?.status === "number" && error.status >= 400) {
      return NextResponse.json(
        { success: false, message: error.message || "Request failed" },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, message: error?.message || "Server error" },
      { status: 500 },
    );
  }
}
