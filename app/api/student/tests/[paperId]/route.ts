import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  buildExamRuntimeErrorPayload,
  isExamRuntimeEnabled,
} from "@/lib/exam-runtime";
import { getStudentTestDetailData } from "@/app/api/student/tests/[paperId]/data";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ paperId: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) return auth.response;
  const { paperId } = await params;

  const schoolKey = auth.schoolKey as string;
  const studentId = auth.session.user.id;

  try {
    const result = await getStudentTestDetailData({
      schoolKey,
      studentId,
      paperId,
      studentPlacement: {
        classId: auth.session.user.studentClassId,
        academicSectionId: auth.session.user.studentAcademicSectionId,
      },
      now: new Date(),
    });
    return NextResponse.json(result);
  } catch (error: any) {
    if (await isExamRuntimeEnabled()) {
      const payload = buildExamRuntimeErrorPayload(
        error,
        "Failed to load online test.",
      );
      return NextResponse.json(payload, { status: payload.httpStatus });
    }

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load online test.",
        code: String(error?.code || "ONLINE_TEST_LOAD_FAILED"),
        retryable:
          typeof error?.retryable === "boolean" ? error.retryable : true,
        httpStatus:
          typeof error?.httpStatus === "number" ? error.httpStatus : 500,
      },
      {
        status:
          typeof error?.httpStatus === "number" ? error.httpStatus : 500,
      },
    );
  }
}
