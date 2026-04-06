import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  buildExamRuntimeErrorPayload,
  isExamRuntimeEnabled,
} from "@/lib/exam-runtime";
import { listStudentTestsData } from "@/lib/server/student-tests";
import {
  isStudentResultReleasedForPaper,
  sanitizeSerializedAttemptForStudentDelivery,
} from "@/lib/student-tests";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) return auth.response;

  const schoolKey = auth.schoolKey as string;
  const studentId = auth.session.user.id;
  const now = new Date();
  const studentPlacement = {
    classId: auth.session.user.studentClassId,
    academicSectionId: auth.session.user.studentAcademicSectionId,
  };

  try {
    const tests = await listStudentTestsData({
      schoolKey,
      studentId,
      studentPlacement,
      now,
    });
    const sanitizedTests = Array.isArray(tests)
      ? tests.map((test: any) => {
          const resultReleased = isStudentResultReleasedForPaper(test, now);
          return {
            ...test,
            resultReleased,
            attempt: sanitizeSerializedAttemptForStudentDelivery(
              test?.attempt || null,
              test,
              now,
            ),
          };
        })
      : [];
    return NextResponse.json({ success: true, tests: sanitizedTests });
  } catch (error: any) {
    if (await isExamRuntimeEnabled()) {
      const payload = buildExamRuntimeErrorPayload(
        error,
        "Failed to load student tests.",
      );
      return NextResponse.json(payload, { status: payload.httpStatus });
    }

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load student tests.",
        code: "STUDENT_TESTS_LOAD_FAILED",
        retryable: true,
        httpStatus: 500,
      },
      { status: 500 },
    );
  }
}
