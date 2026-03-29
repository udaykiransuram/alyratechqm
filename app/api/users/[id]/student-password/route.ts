import { randomBytes } from "crypto";

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { buildArchiveFilter } from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";
import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  getDefaultStudentPassword,
  resolveStudentPasswordAdminInfo,
} from "@/lib/user-credentials";

export const dynamic = "force-dynamic";

type ResetAction = "reset_to_default" | "generate_temporary";

function generateTemporaryPassword(length = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let password = "ST-";

  for (let index = 0; index < length; index += 1) {
    password += alphabet[bytes[index] % alphabet.length];
  }

  return password;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const schoolKey = auth.schoolKey as string;
  const { id: userId } = await params;

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID." },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = String((body as { action?: string })?.action || "").trim() as
      | ResetAction
      | "";

    if (action !== "reset_to_default" && action !== "generate_temporary") {
      return NextResponse.json(
        { success: false, message: "Invalid password reset action." },
        { status: 400 },
      );
    }

    const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
    const student = await UserModel.findOne({
      _id: userId,
      ...buildArchiveFilter(false),
    });

    if (!student) {
      return NextResponse.json(
        { success: false, message: "Student not found." },
        { status: 404 },
      );
    }

    if (String(student.role || "") !== "student") {
      return NextResponse.json(
        {
          success: false,
          message: "This password action is available only for student accounts.",
        },
        { status: 400 },
      );
    }

    let nextPassword = "";

    if (action === "reset_to_default") {
      const defaultPassword = getDefaultStudentPassword(student.mobileNumber);
      if (!defaultPassword) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This student does not have a saved phone number with digits, so the default password cannot be restored.",
          },
          { status: 400 },
        );
      }
      nextPassword = defaultPassword;
    } else {
      nextPassword = generateTemporaryPassword();
    }

    student.passwordHash = await bcrypt.hash(nextPassword, 10);
    await student.save();

    const credentials = await resolveStudentPasswordAdminInfo({
      mobileNumber: student.mobileNumber,
      passwordHash: student.passwordHash,
    });

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: "user",
      entityId: String(student._id),
      entityLabel: String(student.name || ""),
      action:
        action === "reset_to_default"
          ? "student_password_reset_default"
          : "student_password_reset_temporary",
      summary:
        action === "reset_to_default"
          ? `Reset ${student.name}'s password to the saved phone-number digits.`
          : `Generated a temporary student password for ${student.name}.`,
      details: {
        role: "student",
        resetMode: action,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        action === "reset_to_default"
          ? "Student password reset to the saved phone-number digits."
          : "Temporary student password generated successfully.",
      password: nextPassword,
      credentials,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to reset the student password.",
      },
      { status: 500 },
    );
  }
}
