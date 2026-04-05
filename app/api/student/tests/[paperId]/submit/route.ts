import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  buildExamRuntimeErrorPayload,
  submitStudentExamAttempt,
} from "@/lib/exam-runtime";
import { recordOpsFailure } from "@/lib/ops-runtime";
import { invalidateStudentDashboardCacheForStudent } from "@/lib/server/student-dashboard-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paperId: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) return auth.response;

  const { paperId } = await params;
  const body = await req.json().catch(() => ({}));

  try {
    const result = await submitStudentExamAttempt({
      schoolKey: auth.schoolKey as string,
      studentId: auth.session.user.id,
      paperId,
      attemptId: typeof body?.attemptId === "string" ? body.attemptId : null,
      sectionAnswers: body?.sectionAnswers,
      baseLastSavedAt:
        typeof body?.baseLastSavedAt === "string" ? body.baseLastSavedAt : null,
    });

    await invalidateStudentDashboardCacheForStudent(
      auth.schoolKey,
      auth.session.user.id,
    );

    return NextResponse.json(result);
  } catch (error) {
    const payload = buildExamRuntimeErrorPayload(
      error,
      "Failed to submit test.",
    );
    await recordOpsFailure({
      schoolKey: auth.schoolKey,
      req,
      action: "exam_attempt_submit",
      message: payload.message,
      error,
      alertLevel: "trust_critical",
      metadata: {
        route: "/api/student/tests/[paperId]/submit",
        method: "POST",
        operation: "submit",
        paperId,
        studentId: auth.session.user.id,
        baseLastSavedAt:
          typeof body?.baseLastSavedAt === "string" ? body.baseLastSavedAt : null,
        sectionAnswerGroups: Array.isArray(body?.sectionAnswers)
          ? body.sectionAnswers.length
          : 0,
        httpStatus: payload.httpStatus,
      },
      entity: { type: "exam", id: paperId, label: "student_attempt" },
    });
    return NextResponse.json(payload, { status: payload.httpStatus });
  }
}
