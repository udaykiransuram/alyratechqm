import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { buildArchiveFilter } from "@/lib/archive";
import { requireCompanyAdminSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantDb, getTenantModels } from "@/lib/db-tenant";
import School from "@/models/School";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isValidObjectId(value: string) {
  return mongoose.Types.ObjectId.isValid(value);
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function serializeBootstrapAdmin(user: any) {
  if (!user) return null;

  return {
    id: String(user._id),
    name: String(user.name || ""),
    email: String(user.email || ""),
    mobileNumber: String(user.mobileNumber || ""),
  };
}

async function resolveBootstrapAdmin(school: any) {
  const { User: UserModel } = await getTenantModels(school.key, ["User"]);

  const storedBootstrapAdminId = String(school.bootstrapAdminUserId || "").trim();
  let bootstrapAdmin = null;

  if (storedBootstrapAdminId && isValidObjectId(storedBootstrapAdminId)) {
    bootstrapAdmin = await UserModel.findOne({
      _id: storedBootstrapAdminId,
      role: "admin",
      ...buildArchiveFilter(false),
    });
  }

  if (!bootstrapAdmin) {
    bootstrapAdmin = await UserModel.findOne({
      role: "admin",
      ...buildArchiveFilter(false),
    }).sort({ createdAt: 1 });
  }

  return {
    UserModel,
    bootstrapAdmin,
    resolvedBootstrapAdminId: bootstrapAdmin ? String(bootstrapAdmin._id) : null,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { schoolId: string } },
) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;
  await connectDB();

  if (!isValidObjectId(params.schoolId)) {
    return NextResponse.json(
      { success: false, message: "Invalid school id." },
      { status: 400 },
    );
  }

  try {
    const school = await School.findById(params.schoolId);
    if (!school) {
      return NextResponse.json(
        { success: false, message: "School not found." },
        { status: 404 },
      );
    }

    const { bootstrapAdmin } = await resolveBootstrapAdmin(school);

    return NextResponse.json({
      success: true,
      school,
      bootstrapAdmin: serializeBootstrapAdmin(bootstrapAdmin),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load school details.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { schoolId: string } },
) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;
  await connectDB();

  if (!isValidObjectId(params.schoolId)) {
    return NextResponse.json(
      { success: false, message: "Invalid school id." },
      { status: 400 },
    );
  }

  try {
    const school = await School.findById(params.schoolId);
    if (!school) {
      return NextResponse.json(
        { success: false, message: "School not found." },
        { status: 404 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const displayName = String(body?.displayName || "").trim();
    const nextKey = String(body?.key || school.key).trim().toLowerCase();
    const adminName = String(body?.adminName || "").trim();
    const adminEmail = normalizeEmail(body?.adminEmail);
    const adminMobileNumber = String(body?.adminMobileNumber || "").trim();
    const adminPassword = String(body?.adminPassword || "");

    if (!displayName) {
      return NextResponse.json(
        { success: false, message: "Display name is required." },
        { status: 400 },
      );
    }

    if (nextKey !== school.key) {
      return NextResponse.json(
        {
          success: false,
          message:
            "School key cannot be changed after creation. Create a new school if you need a different key.",
        },
        { status: 400 },
      );
    }

    const {
      UserModel,
      bootstrapAdmin,
      resolvedBootstrapAdminId,
    } = await resolveBootstrapAdmin(school);
    const wantsBootstrapAdminUpdate = Boolean(
      adminName || adminEmail || adminMobileNumber || adminPassword,
    );

    if (bootstrapAdmin && wantsBootstrapAdminUpdate) {
      if (!adminName || !adminEmail || !adminMobileNumber) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Bootstrap admin name, email, and phone are required when updating the school admin.",
          },
          { status: 400 },
        );
      }

      const existingEmailUser = await UserModel.findOne({
        email: adminEmail,
        _id: { $ne: bootstrapAdmin._id },
      })
        .select("_id")
        .lean();
      if (existingEmailUser) {
        return NextResponse.json(
          {
            success: false,
            message: "A user with this bootstrap admin email already exists in the school.",
          },
          { status: 409 },
        );
      }

      if (adminPassword && adminPassword.length < 6) {
        return NextResponse.json(
          {
            success: false,
            message: "Bootstrap admin password must be at least 6 characters long.",
          },
          { status: 400 },
        );
      }
    } else if (wantsBootstrapAdminUpdate) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bootstrap school admin could not be found for this school. Create a new school admin from the school workspace first, then retry.",
        },
        { status: 404 },
      );
    }

    school.displayName = displayName;
    if (resolvedBootstrapAdminId) {
      school.bootstrapAdminUserId = resolvedBootstrapAdminId;
    }

    if (bootstrapAdmin && wantsBootstrapAdminUpdate) {
      bootstrapAdmin.name = adminName;
      bootstrapAdmin.email = adminEmail;
      bootstrapAdmin.mobileNumber = adminMobileNumber;

      if (adminPassword) {
        bootstrapAdmin.passwordHash = await bcrypt.hash(adminPassword, 10);
      }
    }

    await Promise.all([
      school.save(),
      bootstrapAdmin ? bootstrapAdmin.save() : Promise.resolve(),
    ]);

    return NextResponse.json({
      success: true,
      school,
      bootstrapAdmin: serializeBootstrapAdmin(bootstrapAdmin),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to update school.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { schoolId: string } },
) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;
  await connectDB();

  if (!isValidObjectId(params.schoolId)) {
    return NextResponse.json(
      { success: false, message: "Invalid school id." },
      { status: 400 },
    );
  }

  try {
    const school = await School.findById(params.schoolId);
    if (!school) {
      return NextResponse.json(
        { success: false, message: "School not found." },
        { status: 404 },
      );
    }

    try {
      const tenantDb = await getTenantDb(school.key);
      await tenantDb.dropDatabase().catch(() => undefined);
    } catch {
    }

    await school.deleteOne();

    return NextResponse.json({
      success: true,
      deletedSchoolKey: school.key,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to delete school.",
      },
      { status: 500 },
    );
  }
}
