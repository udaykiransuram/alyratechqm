import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

export const dynamic = "force-dynamic";

function resolveSchoolKey(req: NextRequest) {
  const url = new URL(req.url);
  const schoolFromHeader =
    req.headers.get("x-school-key") || req.headers.get("X-School-Key");
  const schoolFromQuery = url.searchParams.get("school");
  const schoolFromCookie = req.cookies?.get?.("schoolKey")?.value;
  return (schoolFromHeader || schoolFromQuery || schoolFromCookie || "")
    .toString()
    .trim();
}

export async function GET(req: NextRequest) {
  await connectDB();

  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  }

  try {
    const { AuditLog: AuditLogModel } = await getTenantModels(schoolKey, [
      "AuditLog",
    ]);

    const url = new URL(req.url);
    const entityType = String(url.searchParams.get("entityType") || "all").trim();
    const action = String(url.searchParams.get("action") || "all").trim();
    const limitParam = Number(url.searchParams.get("limit") || "50");
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 50, 1), 200);

    const query: Record<string, any> = {};
    if (entityType && entityType !== "all") {
      query.entityType = entityType;
    }
    if (action && action !== "all") {
      query.action = action;
    }

    const [logs, entityTypes, actions] = await Promise.all([
      AuditLogModel.find(query).sort({ createdAt: -1 }).limit(limit).lean(),
      AuditLogModel.distinct("entityType"),
      AuditLogModel.distinct("action"),
    ]);

    return NextResponse.json({
      success: true,
      logs,
      filters: {
        entityTypes: (Array.isArray(entityTypes) ? entityTypes : []).filter(Boolean).sort(),
        actions: (Array.isArray(actions) ? actions : []).filter(Boolean).sort(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to load audit logs." },
      { status: 500 },
    );
  }
}
