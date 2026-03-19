import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import School from "@/models/School";
import { requireTenantSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireTenantSession(req, {
      allowRoles: ["admin"],
      requireSchoolKey: false,
    });
    if (!auth.ok) return auth.response;
    await connectDB();
    const schools = await School.find({}).sort({ displayName: 1 }).lean();
    return NextResponse.json({ success: true, schools });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || "Failed to load schools" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantSession(req, {
      allowRoles: ["admin"],
      requireSchoolKey: false,
    });
    if (!auth.ok) return auth.response;
    await connectDB();
    const body = await req.json();
    let { key, displayName } = body || ({} as any);
    if (!key || !displayName) {
      return NextResponse.json(
        { success: false, message: "key and displayName are required" },
        { status: 400 },
      );
    }
    key = String(key)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .toLowerCase();
    const exists = await School.findOne({ key });
    if (exists)
      return NextResponse.json(
        { success: false, message: "School key already exists" },
        { status: 409 },
      );
    const school = await School.create({ key, displayName });
    try {
      const { provisionTenant } = await import("@/lib/tenant-provision");
      await provisionTenant(key);

      try {
        ensureTenantIndexesForKey(key).catch(() => {});
      } catch {}
    } catch {}
    return NextResponse.json({ success: true, school }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || "Failed to create school" },
      { status: 500 },
    );
  }
}

async function ensureTenantIndexesForKey(schoolKey: string) {
  const dbn = `school_db_${String(schoolKey)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toLowerCase()}`;
  // Reuse minimal set to keep it fast
  const db = (await import("mongoose")).default.connection.useDb(dbn, {
    useCache: false,
  }).db;
  if (!db) throw new Error("Tenant database not available");
  await db
    .collection("questions")
    .createIndex(
      { class: 1, subject: 1, createdAt: -1 },
      { name: "class_subject_createdAt" },
    );
  await db
    .collection("questionpapers")
    .createIndex({ createdAt: -1 }, { name: "qp_createdAt_desc" });
  await db
    .collection("academicsections")
    .createIndex(
      { class: 1, name: 1 },
      { name: "academic_section_class_name_1" },
    );
  await db
    .collection("users")
    .createIndex({ class: 1, rollNumber: 1 }, { name: "user_class_roll_1" });
  await db
    .collection("users")
    .createIndex(
      { class: 1, academicSection: 1, rollNumber: 1 },
      { name: "user_class_section_roll_1" },
    );
}
