export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { requireTenantSession } from "@/lib/api-auth";
import { updateStudentDiaryState } from "@/lib/server/diary";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireTenantSession(req, {
      allowRoles: ["student"],
    });
    if (!auth.ok) {
      return auth.response;
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

    const body = await req.json().catch(() => ({}));

    const markSeen = body?.markSeen === true;
    const markCompleted = body?.markCompleted === true;

    if (!markSeen && !markCompleted) {
      return NextResponse.json(
        {
          success: false,
          message: "No valid diary state update was provided.",
        },
        { status: 400 },
      );
    }

    const state = await updateStudentDiaryState({
      schoolKey: auth.schoolKey,
      entryId: id,
      studentId: auth.session.user.id,
      studentPlacement: {
        classId: auth.session.user.studentClassId,
        academicSectionId: auth.session.user.studentAcademicSectionId,
      },
      operations: {
        markSeen,
        markCompleted,
      },
    });

    if (!state) {
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
      state,
    });
  } catch (error: any) {
    console.error("Failed to update student diary state route:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          typeof error?.message === "string" && error.message.trim()
            ? error.message
            : "Failed to update diary state.",
      },
      {
        status:
          typeof error?.status === "number" && Number.isFinite(error.status)
            ? error.status
            : 500,
      },
    );
  }
}
