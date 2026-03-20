import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { normalizeEmail } from "@/lib/user-credentials";

export const dynamic = "force-dynamic";

async function loadStudentProfile(
  schoolKey: string,
  studentId: string,
) {
  const {
    User: UserModel,
    Class: ClassModel,
    AcademicSection: AcademicSectionModel,
  } = await getTenantModels(schoolKey, ["User", "Class", "AcademicSection"]);

  const student = await UserModel.findById(studentId)
    .select("name email rollNumber mobileNumber class academicSection")
    .populate({ path: "class", model: ClassModel, select: "name" })
    .populate({
      path: "academicSection",
      model: AcademicSectionModel,
      select: "name",
    })
    .lean();

  return { student, UserModel };
}

function serializeStudentProfile(student: any) {
  return {
    _id: String(student._id),
    name: String(student.name || ""),
    email: student.email ? String(student.email) : "",
    rollNumber: student.rollNumber ? String(student.rollNumber) : "",
    mobileNumber: student.mobileNumber ? String(student.mobileNumber) : "",
    className:
      typeof student.class === "object" && student.class?.name
        ? String(student.class.name)
        : "",
    academicSectionName:
      typeof student.academicSection === "object" && student.academicSection?.name
        ? String(student.academicSection.name)
        : "",
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) return auth.response;

  const schoolKey = auth.schoolKey as string;

  try {
    await connectDB();
    const { student } = await loadStudentProfile(schoolKey, auth.session.user.id);

    if (!student) {
      return NextResponse.json(
        { success: false, message: "Student profile not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      student: serializeStudentProfile(student),
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

    const { UserModel } = await loadStudentProfile(schoolKey, auth.session.user.id);

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

    await UserModel.findByIdAndUpdate(
      auth.session.user.id,
      {
        name,
        mobileNumber,
        email: email || undefined,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    const { student } = await loadStudentProfile(schoolKey, auth.session.user.id);

    if (!student) {
      return NextResponse.json(
        { success: false, message: "Student profile not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      student: serializeStudentProfile(student),
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
