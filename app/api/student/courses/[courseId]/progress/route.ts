export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  assertSummerCrashStudentApiAccess,
} from "@/lib/server/summer-crash";
import { updateStudentCourseProgress } from "@/lib/server/student-courses";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseId: string }> },
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

  const { courseId } = await params;
  const body = await req.json().catch(() => ({}));

  const normalizeOptionalBlockId = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  const normalizeOptionalBoolean = (value: unknown) =>
    typeof value === "boolean" ? value : undefined;

  const noteBlockId =
    typeof body?.note?.blockId === "string" && body.note.blockId.trim()
      ? body.note.blockId.trim()
      : null;
  const noteText =
    body?.note && "text" in body.note && typeof body.note.text === "string"
      ? body.note.text
      : body?.note && "text" in body.note && body.note.text === null
        ? null
        : undefined;

  try {
    const progress = await updateStudentCourseProgress({
      schoolKey: auth.schoolKey,
      studentId: auth.session.user.id,
      studentPlacement: {
        classId: auth.session.user.studentClassId,
        academicSectionId: auth.session.user.studentAcademicSectionId,
      },
      courseId,
      operations: {
        ...(body && "lastViewedBlockId" in body
          ? { lastViewedBlockId: normalizeOptionalBlockId(body.lastViewedBlockId) }
          : {}),
        ...(body && "viewedBlockId" in body
          ? { viewedBlockId: normalizeOptionalBlockId(body.viewedBlockId) }
          : {}),
        ...(body && "completedBlockId" in body
          ? {
              completedBlockId: normalizeOptionalBlockId(body.completedBlockId),
              completed: normalizeOptionalBoolean(body.completed),
            }
          : {}),
        ...(body && "bookmarkedBlockId" in body
          ? {
              bookmarkedBlockId: normalizeOptionalBlockId(body.bookmarkedBlockId),
              bookmarked: normalizeOptionalBoolean(body.bookmarked),
            }
          : {}),
        ...(noteBlockId && noteText !== undefined
          ? {
              note: {
                blockId: noteBlockId,
                text: noteText,
              },
            }
          : {}),
      },
    });

    if (!progress) {
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
      progress,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to update course progress.",
      },
      { status: 400 },
    );
  }
}
