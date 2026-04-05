export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { listStudentDiaryEntries } from "@/lib/server/diary";

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const entries = await listStudentDiaryEntries({
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
    });

    return NextResponse.json({
      success: true,
      entries,
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

