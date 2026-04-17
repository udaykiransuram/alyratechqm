export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  assertSummerCrashStudentApiAccess,
} from "@/lib/server/summer-crash";
import { listStudentCoursesPage } from "@/lib/server/student-courses";

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const classId = String(req.nextUrl.searchParams.get("classId") || "").trim();
    const sectionId = String(req.nextUrl.searchParams.get("sectionId") || "").trim();
    const subjectId = String(req.nextUrl.searchParams.get("subjectId") || "").trim();
    const query = String(req.nextUrl.searchParams.get("q") || "").trim();
    const page = req.nextUrl.searchParams.get("page") || undefined;
    const limit = req.nextUrl.searchParams.get("limit") || undefined;

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

    const list = await listStudentCoursesPage({
      schoolKey: auth.schoolKey,
      studentId: auth.session.user.id,
      studentPlacement: {
        classId: auth.session.user.studentClassId,
        academicSectionId: auth.session.user.studentAcademicSectionId,
      },
      filters: {
        classId: classId || undefined,
        sectionId: sectionId || undefined,
        subjectId: subjectId || undefined,
        query: query || undefined,
      },
      page,
      limit,
      includeOptions: req.nextUrl.searchParams.get("includeOptions") === "1",
    });

    return NextResponse.json({
      success: true,
      courses: list.items,
      list,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load courses.",
      },
      { status: 500 },
    );
  }
}
