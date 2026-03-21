export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import School from "@/models/School";
import {
  ensureIndexesForTenantDbName,
  dbNameForSchool,
} from "@/lib/admin/indexing";
import { requireCompanyAdminSession } from "@/lib/api-auth";
import {
  buildCompanyAuditActorFromSession,
  recordCompanyAudit,
} from "@/lib/company-audit";
import { requireProductionAdminMaintenanceAccess } from "@/lib/ops-runtime";
export async function POST(req: NextRequest) {
  const maintenanceAccess = requireProductionAdminMaintenanceAccess();
  if (maintenanceAccess) return maintenanceAccess;

  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;
  await connectDB();
  const actor = buildCompanyAuditActorFromSession(auth.session);
  let requestedSchoolKey = "";
  let runAll = false;

  try {
    const body = await req.json().catch(() => ({}));
    requestedSchoolKey = body?.schoolKey ? String(body.schoolKey).trim() : "";
    runAll = !!body?.all;
    const out: Record<string, any> = {};

    if (runAll) {
      const schools = await School.find({}).lean();
      for (const s of schools) {
        const key = (s as any).key || String((s as any)._id);
        const dbn = dbNameForSchool(key);
        out[key] = await ensureIndexesForTenantDbName(dbn);
      }
    } else if (requestedSchoolKey) {
      const dbn = dbNameForSchool(requestedSchoolKey);
      out[requestedSchoolKey] = await ensureIndexesForTenantDbName(dbn);
    } else {
      await recordCompanyAudit({
        req,
        actor,
        entityType: "tenant_maintenance",
        entityLabel: "reindex request",
        action: "maintenance_reindex",
        summary: "Rejected tenant reindex request without a target school.",
        details: {
          outcome: "rejected",
          routeSurface: "api",
          requestedSchoolKey: undefined,
          all: false,
        },
      });
      return NextResponse.json(
        { success: false, message: "Provide schoolKey or set all=true" },
        { status: 400 },
      );
    }

    await recordCompanyAudit({
      schoolKey: runAll ? undefined : requestedSchoolKey,
      req,
      actor,
      entityType: "tenant_maintenance",
      entityLabel: runAll ? "all schools" : requestedSchoolKey,
      action: "maintenance_reindex",
      summary: runAll
        ? `Reindexed tenant databases for ${Object.keys(out).length} schools.`
        : `Reindexed tenant database for ${requestedSchoolKey}.`,
      details: {
        outcome: "success",
        routeSurface: "api",
        requestedSchoolKey: requestedSchoolKey || undefined,
        all: runAll,
        processedSchoolCount: Object.keys(out).length,
        results: out,
      },
    });

    return NextResponse.json({ success: true, results: out });
  } catch (e: any) {
    await recordCompanyAudit({
      schoolKey: runAll ? undefined : requestedSchoolKey || undefined,
      req,
      actor,
      entityType: "tenant_maintenance",
      entityLabel: runAll ? "all schools" : requestedSchoolKey || undefined,
      action: "maintenance_reindex",
      summary: runAll
        ? "Failed to reindex the requested tenant databases."
        : `Failed to reindex tenant database for ${requestedSchoolKey || "the requested school"}.`,
      details: {
        outcome: "failure",
        routeSurface: "api",
        requestedSchoolKey: requestedSchoolKey || undefined,
        all: runAll,
        error: e?.message || "failed",
      },
    });
    return NextResponse.json(
      { success: false, message: e?.message || "failed" },
      { status: 500 },
    );
  }
}
