import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { requireCompanyAdminSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantDb, getTenantModels } from "@/lib/db-tenant";
import School from "@/models/School";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

function sanitizeSchoolKey(value: unknown) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toLowerCase()
    .trim();
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCompanyAdminSession(req);
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
    const auth = await requireCompanyAdminSession(req);
    if (!auth.ok) return auth.response;
    await connectDB();
    const body = await req.json();
    const key = sanitizeSchoolKey(body?.key);
    const displayName = String(body?.displayName || "").trim();
    const adminName = String(body?.adminName || "").trim();
    const adminEmail = normalizeEmail(body?.adminEmail);
    const adminPassword = String(body?.adminPassword || "");
    const adminMobileNumber = String(body?.adminMobileNumber || "").trim();

    if (
      !key ||
      !displayName ||
      !adminName ||
      !adminEmail ||
      !adminPassword ||
      !adminMobileNumber
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "key, displayName, adminName, adminEmail, adminPassword, and adminMobileNumber are required",
        },
        { status: 400 },
      );
    }
    if (adminPassword.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: "Bootstrap admin password must be at least 6 characters long.",
        },
        { status: 400 },
      );
    }
    const exists = await School.findOne({ key });
    if (exists)
      return NextResponse.json(
        { success: false, message: "School key already exists" },
        { status: 409 },
      );

    let school: any = null;
    try {
      const { provisionTenant } = await import("@/lib/tenant-provision");
      school = await School.create({ key, displayName });
      await provisionTenant(key);
      const { User } = await getTenantModels(key, ["User"]);
      const passwordHash = await bcrypt.hash(adminPassword, 10);

      const adminUser = await User.create({
        name: adminName,
        email: adminEmail,
        passwordHash,
        mobileNumber: adminMobileNumber,
        role: "admin",
        hasAllClasses: true,
        hasAllSections: true,
        hasAllSubjects: true,
        classIds: [],
        academicSectionIds: [],
        subjectIds: [],
      });

      school.bootstrapAdminUserId = String(adminUser._id);
      await school.save();

      try {
        ensureTenantIndexesForKey(key).catch(() => {});
      } catch {}

      return NextResponse.json(
        {
          success: true,
          school,
          bootstrapAdmin: {
            id: String(adminUser._id),
            name: adminUser.name,
            email: adminUser.email,
          },
        },
        { status: 201 },
      );
    } catch (error: any) {
      if (school?._id) {
        await School.deleteOne({ _id: school._id }).catch(() => undefined);
      }

      try {
        const tenantDb = await getTenantDb(key);
        await tenantDb.dropDatabase().catch(() => undefined);
      } catch {}

      return NextResponse.json(
        {
          success: false,
          message:
            error?.message || "Failed to create school and bootstrap admin",
        },
        { status: 500 },
      );
    }
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
