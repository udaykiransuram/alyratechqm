import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdminSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import CompanyAuditLog from "@/models/CompanyAuditLog";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  await connectDB();

  try {
    const schoolKey = String(req.nextUrl.searchParams.get("schoolKey") || "all")
      .trim()
      .toLowerCase();
    const action = String(req.nextUrl.searchParams.get("action") || "all").trim();
    const source = String(req.nextUrl.searchParams.get("source") || "all").trim();
    const limitParam = Number(req.nextUrl.searchParams.get("limit") || "100");
    const limit = Math.min(
      Math.max(Number.isFinite(limitParam) ? limitParam : 100, 1),
      200,
    );

    const query: Record<string, any> = {};
    if (schoolKey && schoolKey !== "all") {
      query.schoolKey = schoolKey;
    }
    if (action && action !== "all") {
      query.action = action;
    }
    if (source && source !== "all") {
      query.source = source;
    }

    const [logs, schoolKeys, actions, sources] = await Promise.all([
      CompanyAuditLog.find(query).sort({ createdAt: -1 }).limit(limit).lean(),
      CompanyAuditLog.distinct("schoolKey"),
      CompanyAuditLog.distinct("action"),
      CompanyAuditLog.distinct("source"),
    ]);

    return NextResponse.json({
      success: true,
      logs,
      filters: {
        schoolKeys: (Array.isArray(schoolKeys) ? schoolKeys : [])
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .sort(),
        actions: (Array.isArray(actions) ? actions : [])
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .sort(),
        sources: (Array.isArray(sources) ? sources : [])
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .sort(),
      },
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
