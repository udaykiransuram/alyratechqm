export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { requireTenantSession } from "@/lib/api-auth";
import {
  assertSummerCrashStudentApiAccess,
} from "@/lib/server/summer-crash";
import { getStudentDiaryDetail } from "@/lib/server/diary";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  const accessCheck = await assertSummerCrashStudentApiAccess({
    schoolKey: auth.schoolKey,
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

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Diary entry not found.",
      },
      { status: 404 },
    );
  }

  try {
    const entry = await getStudentDiaryDetail({
      schoolKey: auth.schoolKey,
      entryId: id,
      studentId: auth.session.user.id,
      studentPlacement: {
        classId: auth.session.user.studentClassId,
        academicSectionId: auth.session.user.studentAcademicSectionId,
      },
    });

    if (!entry) {
      return NextResponse.json(
        {
          success: false,
          message: "Diary entry not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      entry,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load diary entry.",
      },
      { status: 500 },
    );
  }
}
