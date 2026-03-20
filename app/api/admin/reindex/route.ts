export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import School from "@/models/School";
import { getTenantDb } from "@/lib/db-tenant";
import {
  ensureIndexesForTenantDbName,
  dbNameForSchool,
} from "@/lib/admin/indexing";
import { requireCompanyAdminSession } from "@/lib/api-auth";
export async function POST(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;
  await connectDB();
  try {
    const body = await req.json().catch(() => ({}));
    const schoolKey = body?.schoolKey ? String(body.schoolKey) : "";
    const all = !!body?.all;
    const out: Record<string, any> = {};
    if (all) {
      const schools = await School.find({}).lean();
      for (const s of schools) {
        const key = (s as any).key || String((s as any)._id);
        const dbn = dbNameForSchool(key);
        out[key] = await ensureIndexesForTenantDbName(dbn);
      }
    } else if (schoolKey) {
      const dbn = dbNameForSchool(schoolKey);
      out[schoolKey] = await ensureIndexesForTenantDbName(dbn);
    } else {
      return NextResponse.json(
        { success: false, message: "Provide schoolKey or set all=true" },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, results: out });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || "failed" },
      { status: 500 },
    );
  }
}
