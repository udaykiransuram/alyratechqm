import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  assertSummerCrashStudentApiAccess,
} from "@/lib/server/summer-crash";
import { getStudentProfileForAccount } from "@/lib/student-account/data";
import {
  getDefaultStudentPassword,
  normalizeEmail,
  validateStudentDefaultPasswordSource,
} from "@/lib/user-credentials";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) return auth.response;

  const schoolKey = auth.schoolKey as string;
  const accessCheck = await assertSummerCrashStudentApiAccess({
    schoolKey,
    studentId: auth.session.user.id,
    target: {
      kind: "locked-student-content",
    },
  });
  if (!accessCheck.allowed) {
    return NextResponse.json(
      { success: false, message: accessCheck.message },
      { status: 403 },
    );
  }

  try {
    const student = await getStudentProfileForAccount(
      schoolKey,
      auth.session.user.id,
    );

    if (!student) {
      return NextResponse.json(
        { success: false, message: "Student profile not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      student,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load student account.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) return auth.response;

  const schoolKey = auth.schoolKey as string;
  const accessCheck = await assertSummerCrashStudentApiAccess({
    schoolKey,
    studentId: auth.session.user.id,
    target: {
      kind: "locked-student-content",
    },
  });
  if (!accessCheck.allowed) {
    return NextResponse.json(
      { success: false, message: accessCheck.message },
      { status: 403 },
    );
  }

  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const mobileNumber = String(body?.mobileNumber || "").trim();
    const email = normalizeEmail(body?.email);

    if (!name) {
      return NextResponse.json(
        { success: false, message: "Name is required." },
        { status: 400 },
      );
    }

    if (!mobileNumber) {
      return NextResponse.json(
        { success: false, message: "Phone number is required." },
        { status: 400 },
      );
    }
    const studentPasswordSourceValidation =
      validateStudentDefaultPasswordSource(mobileNumber);
    if (!studentPasswordSourceValidation.ok) {
      return NextResponse.json(
        {
          success: false,
          message: studentPasswordSourceValidation.message,
        },
        { status: 400 },
      );
    }

    const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
    const studentRecord = await UserModel.findById(auth.session.user.id).select(
      "mobileNumber passwordHash",
    );

    if (!studentRecord) {
      return NextResponse.json(
        { success: false, message: "Student profile not found." },
        { status: 404 },
      );
    }

    if (email) {
      const existingUser = await UserModel.findOne({
        email,
        _id: { $ne: auth.session.user.id },
      })
        .select("_id")
        .lean();

      if (existingUser) {
        return NextResponse.json(
          {
            success: false,
            message: "A user with this email already exists.",
          },
          { status: 409 },
        );
      }
    }

    const currentPasswordHash = String(studentRecord.passwordHash || "");
    const currentDefaultStudentPassword = getDefaultStudentPassword(
      studentRecord.mobileNumber,
    );
    const nextDefaultStudentPassword = getDefaultStudentPassword(mobileNumber);
    let nextPasswordHash: string | undefined;

    if (nextDefaultStudentPassword) {
      const shouldRestoreMissingPassword = !currentPasswordHash;
      let shouldSyncDefaultPassword = false;

      if (
        currentPasswordHash &&
        currentDefaultStudentPassword &&
        currentDefaultStudentPassword !== nextDefaultStudentPassword
      ) {
        try {
          shouldSyncDefaultPassword = await bcrypt.compare(
            currentDefaultStudentPassword,
            currentPasswordHash,
          );
        } catch {
          shouldSyncDefaultPassword = false;
        }
      }

      if (shouldRestoreMissingPassword || shouldSyncDefaultPassword) {
        nextPasswordHash = await bcrypt.hash(nextDefaultStudentPassword, 10);
      }
    }

    await UserModel.findByIdAndUpdate(
      auth.session.user.id,
      {
        name,
        mobileNumber,
        email: email || undefined,
        ...(nextPasswordHash ? { passwordHash: nextPasswordHash } : {}),
      },
      {
        new: true,
        runValidators: true,
      },
    );

    const student = await getStudentProfileForAccount(
      schoolKey,
      auth.session.user.id,
    );

    if (!student) {
      return NextResponse.json(
        { success: false, message: "Student profile not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      student,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to update student account.",
      },
      { status: 500 },
    );
  }
}
