import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { requireCompanyAdminSession } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const auth = await requireCompanyAdminSession(request);
  if (!auth.ok) return auth.response;
  const {
    schoolKey,
    email,
    password,
    name = "Admin User",
    mobileNumber,
  } = await request.json();
  const normalizedSchoolKey = String(schoolKey || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedName = String(name || "Admin User").trim();
  const normalizedMobileNumber = String(mobileNumber || "").trim();
  if (
    !normalizedSchoolKey ||
    !normalizedEmail ||
    !password ||
    !normalizedMobileNumber
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }
  await connectDB();
  const { User } = await getTenantModels(normalizedSchoolKey, ["User"]);
  const passwordHash = await bcrypt.hash(password, 10);
  let adminUser = await User.findOne({ email: normalizedEmail });
  if (adminUser) {
    adminUser.name = normalizedName;
    adminUser.passwordHash = passwordHash;
    adminUser.role = "admin";
    adminUser.mobileNumber = normalizedMobileNumber;
    adminUser.hasAllClasses = true;
    adminUser.hasAllSections = true;
    adminUser.hasAllSubjects = true;
    adminUser.classIds = [];
    adminUser.academicSectionIds = [];
    adminUser.subjectIds = [];
    await adminUser.save();
  } else {
    adminUser = new User({
      name: normalizedName,
      email: normalizedEmail,
      passwordHash,
      mobileNumber: normalizedMobileNumber,
      role: "admin",
      hasAllClasses: true,
      hasAllSections: true,
      hasAllSubjects: true,
      classIds: [],
      academicSectionIds: [],
      subjectIds: [],
    });
    await adminUser.save();
  }
  return NextResponse.json({
    message: "Admin user created/updated successfully",
  });
}
