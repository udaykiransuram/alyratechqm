export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  assertSummerCrashStudentApiAccess,
} from "@/lib/server/summer-crash";
import { listStudentDiaryEntriesPage } from "@/lib/server/diary";

function resolveQueryNumber(value: string | null, fallback: number) {
  const normalized = Number(value || "");
  if (!Number.isFinite(normalized) || normalized < 1) {
    return fallback;
  }

  return Math.floor(normalized);
}

export async function GET(req: NextRequest) {
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

  try {
    const diaryList = await listStudentDiaryEntriesPage({
      schoolKey: auth.schoolKey,
      studentId: auth.session.user.id,
      studentPlacement: {
        classId: auth.session.user.studentClassId,
        academicSectionId: auth.session.user.studentAcademicSectionId,
      },
      filters: {
        entryDate: req.nextUrl.searchParams.get("entryDate") || undefined,
        subjectId: req.nextUrl.searchParams.get("subjectId") || undefined,
      },
      page: resolveQueryNumber(req.nextUrl.searchParams.get("page"), 1),
      limit: resolveQueryNumber(req.nextUrl.searchParams.get("limit"), 10),
    });

    return NextResponse.json({
      success: true,
      entries: diaryList.entries,
      total: diaryList.total,
      page: diaryList.page,
      pages: diaryList.pages,
      limit: diaryList.limit,
      subjectOptions: diaryList.subjectOptions,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load diary entries.",
      },
      { status: 500 },
    );
  }
}
