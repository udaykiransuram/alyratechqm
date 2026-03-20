import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) return auth.response;

  const schoolKey = auth.schoolKey as string;

  try {
    await connectDB();
    const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
    const student = await UserModel.findById(auth.session.user.id)
      .select("name email rollNumber mobileNumber")
      .lean();

    if (!student) {
      return NextResponse.json(
        { success: false, message: "Student profile not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      student: {
        _id: String(student._id),
        name: String(student.name || ""),
        email: student.email ? String(student.email) : "",
        rollNumber: student.rollNumber ? String(student.rollNumber) : "",
        mobileNumber: student.mobileNumber ? String(student.mobileNumber) : "",
      },
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
