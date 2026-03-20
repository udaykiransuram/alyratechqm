import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  normalizeRollNumber,
  validatePasswordInput,
} from "@/lib/user-credentials";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) return auth.response;

  const schoolKey = auth.schoolKey as string;

  try {
    await connectDB();
    const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
    const student = await UserModel.findById(auth.session.user.id).select(
      "passwordHash rollNumber",
    );

    if (!student?.passwordHash) {
      return NextResponse.json(
        { success: false, message: "Student account is missing a password." },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const currentPassword = String(body?.currentPassword || "");
    const newPassword = String(body?.newPassword || "");
    const rollNumber = normalizeRollNumber(student.rollNumber);

    if (!currentPassword.trim() || !newPassword.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Current password and new password are required.",
        },
        { status: 400 },
      );
    }

    const currentPasswordValid = await bcrypt.compare(
      currentPassword,
      student.passwordHash,
    );
    if (!currentPasswordValid) {
      return NextResponse.json(
        { success: false, message: "Current password is incorrect." },
        { status: 400 },
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "New password must be different from the current password.",
        },
        { status: 400 },
      );
    }

    const passwordValidation = validatePasswordInput({
      role: "student",
      rollNumber,
      password: newPassword,
    });
    if (!passwordValidation.ok) {
      return NextResponse.json(
        {
          success: false,
          message: passwordValidation.message,
        },
        { status: 400 },
      );
    }

    student.passwordHash = await bcrypt.hash(newPassword, 10);
    await student.save();

    return NextResponse.json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to update student password.",
      },
      { status: 500 },
    );
  }
}
