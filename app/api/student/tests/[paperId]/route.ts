import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  assertSummerCrashStudentApiAccess,
} from "@/lib/server/summer-crash";
import {
  buildExamRuntimeErrorPayload,
  isExamRuntimeEnabled,
} from "@/lib/exam-runtime";
import { getStudentTestDetailData } from "@/lib/server/student-tests";
import { isSummerCrashConfiguredDiagnosticPaper } from "@/lib/summer-crash/portal-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ paperId: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
    studentSessionValidationMode: "redis_hot_path",
  });
  if (!auth.ok) return auth.response;
  const { paperId } = await params;
  const delivery = req.nextUrl.searchParams.get("delivery");

  const schoolKey = auth.schoolKey as string;
  const studentId = auth.session.user.id;
  const accessCheck = await assertSummerCrashStudentApiAccess({
    schoolKey,
    studentId,
    target: {
      kind: "diagnostic-test",
      paperId,
    },
  });
  if (!accessCheck.allowed) {
    return NextResponse.json(
      { success: false, message: accessCheck.message },
      { status: 403 },
    );
  }
  const skipOnlineDeliveryValidation = isSummerCrashConfiguredDiagnosticPaper(
    accessCheck.policy,
    paperId,
  );

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
      deliveryMode: delivery === "bootstrap" ? "bootstrap" : "full",
      skipOnlineDeliveryValidation,
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
