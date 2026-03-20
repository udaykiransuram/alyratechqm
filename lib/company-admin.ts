import bcrypt from "bcryptjs";

import { connectDB } from "@/lib/db";
import CompanyAdmin from "@/models/CompanyAdmin";

type BootstrapConfig = {
  name: string;
  email: string;
  password: string;
};

function getBootstrapConfig(): BootstrapConfig | null {
  const name = String(process.env.COMPANY_ADMIN_BOOTSTRAP_NAME || "").trim();
  const email = String(process.env.COMPANY_ADMIN_BOOTSTRAP_EMAIL || "")
    .trim()
    .toLowerCase();
  const password = String(
    process.env.COMPANY_ADMIN_BOOTSTRAP_PASSWORD || "",
  ).trim();

  if (!name || !email || !password) {
    return null;
  }

  return {
    name,
    email,
    password,
  };
}

export async function ensureBootstrapCompanyAdmin() {
  await connectDB();

  const existingCount = await CompanyAdmin.countDocuments({});
  if (existingCount > 0) {
    return { created: false, reason: "existing_admins" as const };
  }

  const config = getBootstrapConfig();
  if (!config) {
    return { created: false, reason: "missing_env" as const };
  }

  const existingByEmail = await CompanyAdmin.findOne({ email: config.email })
    .select("_id")
    .lean();
  if (existingByEmail) {
    return { created: false, reason: "existing_admins" as const };
  }

  const passwordHash = await bcrypt.hash(config.password, 10);
  await CompanyAdmin.create({
    name: config.name,
    email: config.email,
    passwordHash,
    isActive: true,
  });

  return { created: true, reason: "bootstrapped" as const };
}
