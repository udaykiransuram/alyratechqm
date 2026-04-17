export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  assertSummerCrashStudentApiAccess,
} from "@/lib/server/summer-crash";
import { getStudentCourseDetail } from "@/lib/server/student-courses";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  const { courseId } = await params;

  try {
    const accessCheck = await assertSummerCrashStudentApiAccess({
      schoolKey: auth.schoolKey,
      studentId: auth.session.user.id,
      target: {
        kind: "locked-student-content",
      },
    });
    if (!accessCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: accessCheck.message,
        },
        { status: 403 },
      );
    }

    const course = await getStudentCourseDetail({
      schoolKey: auth.schoolKey,
      studentId: auth.session.user.id,
      studentPlacement: {
        classId: auth.session.user.studentClassId,
        academicSectionId: auth.session.user.studentAcademicSectionId,
      },
      courseId,
    });

    if (!course) {
      return NextResponse.json(
        {
          success: false,
          message: "Course not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      course,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load course.",
      },
      { status: 500 },
    );
  }
}
