import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession(request, {
    allowRoles: ["admin"],
    requireSchoolKey: false,
  });
  if (!auth.ok) return auth.response;
  const { schoolKey: sessionSchoolKey } = auth;
  const {
    schoolKey: requestedSchoolKey,
    email,
    password,
    name = "Admin User",
  } = await request.json();
  const schoolKey = String(requestedSchoolKey || sessionSchoolKey || "").trim();
  if (!schoolKey || !email || !password) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }
  await connectDB();
  const { User } = await getTenantModels(schoolKey, ["User"]);
  const passwordHash = await bcrypt.hash(password, 10);
  let adminUser = await User.findOne({ email });
  if (adminUser) {
    adminUser.name = name;
    adminUser.passwordHash = passwordHash;
    adminUser.role = "admin";
    await adminUser.save();
  } else {
    adminUser = new User({ name, email, passwordHash, role: "admin" });
    await adminUser.save();
  }
  return NextResponse.json({
    message: "Admin user created/updated successfully",
  });
}
