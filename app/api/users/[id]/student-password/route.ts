import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { buildArchiveFilter } from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";
import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { recordOpsFailure } from "@/lib/ops-runtime";
import { clearStudentLoginRateLimit, clearStudentSession } from "@/lib/redis";
import { invalidateStudentSessionValidationCache } from "@/lib/student-session-cache";
import { invalidateStudentTestResourceCache } from "@/lib/student-test-server";
import {
  getDefaultStudentPassword,
  normalizeRollNumber,
  resolveStudentPasswordAdminInfo,
} from "@/lib/user-credentials";

export const dynamic = "force-dynamic";

const RESET_TO_DEFAULT_ACTION = "reset_to_default";
const LEGACY_TEMPORARY_ACTION = "generate_temporary";

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
    const action = String((body as { action?: string })?.action || "").trim();

    if (
      action &&
      action !== RESET_TO_DEFAULT_ACTION &&
      action !== LEGACY_TEMPORARY_ACTION
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid password reset action." },
        { status: 400 },
      );
    }

    if (action === LEGACY_TEMPORARY_ACTION) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Temporary passwords are no longer supported. Reset this student to the saved phone-number digits instead.",
        },
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

    const defaultPassword = getDefaultStudentPassword(student.mobileNumber);
    if (!defaultPassword) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This student cannot be reset yet because the saved phone number does not contain digits. Update the saved phone number first, then reset the password.",
        },
        { status: 400 },
      );
    }

    const nextPassword = defaultPassword;
    student.passwordHash = await bcrypt.hash(nextPassword, 10);
    await student.save();

    const studentId = String(student._id);
    const normalizedRollNumber = normalizeRollNumber(student.rollNumber);

    await clearStudentSession(schoolKey, studentId).catch(() => undefined);
    await UserModel.updateOne(
      { _id: studentId },
      {
        $unset: {
          activeStudentSessionId: 1,
          activeStudentSessionLastSeenAt: 1,
        },
      },
    ).catch(() => undefined);
    await clearStudentLoginRateLimit(
      schoolKey,
      normalizedRollNumber,
    ).catch(() => undefined);

    invalidateStudentSessionValidationCache({
      schoolKey,
      studentId,
    });
    invalidateStudentTestResourceCache({
      schoolKey,
      studentId,
    });

    const credentials = await resolveStudentPasswordAdminInfo({
      mobileNumber: student.mobileNumber,
      passwordHash: student.passwordHash,
    });

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: "user",
      entityId: studentId,
      entityLabel: String(student.name || ""),
      action: "student_password_reset_default",
      summary: `Reset ${student.name}'s password to the saved phone-number digits and cleared active student sign-in state.`,
      details: {
        role: "student",
        resetMode: RESET_TO_DEFAULT_ACTION,
        clearedStudentSessionState: true,
        clearedStudentLoginRateLimit: Boolean(normalizedRollNumber),
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Student password reset to the saved phone-number digits. Any active student session was signed out so the student can log in again.",
      password: nextPassword,
      credentials,
    });
  } catch (error: any) {
    await recordOpsFailure({
      schoolKey,
      req,
      action: "student_password_reset",
      message: "Failed to reset student password to saved phone-number digits.",
      error,
      alertLevel: "trust_critical",
      metadata: {
        route: "/api/users/[id]/student-password",
        method: "POST",
        userId,
      },
      entity: { type: "user", id: String(userId), label: "student_password_reset" },
    });
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to reset the student password.",
      },
      { status: 500 },
    );
  }
}
