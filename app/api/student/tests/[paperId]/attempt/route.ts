import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  buildExamRuntimeErrorPayload,
  saveStudentExamAttempt,
  startStudentExamAttempt,
} from "@/lib/exam-runtime";
import { recordOpsFailure } from "@/lib/ops-runtime";
import {
  assertSummerCrashStudentApiAccess,
  recordSummerCrashDiagnosticStarted,
} from "@/lib/server/summer-crash";
import { scheduleStudentDashboardCacheInvalidation } from "@/lib/server/student-dashboard-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paperId: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
    studentSessionValidationMode: "redis_strict",
  });
  if (!auth.ok) return auth.response;

  const { paperId } = await params;
  const accessCheck = await assertSummerCrashStudentApiAccess({
    schoolKey: auth.schoolKey,
    studentId: auth.session.user.id,
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

  try {
    const result = await startStudentExamAttempt(
      auth.schoolKey as string,
      auth.session.user.id,
      paperId,
      {
        classId: auth.session.user.studentClassId,
        academicSectionId: auth.session.user.studentAcademicSectionId,
      },
    );

    await recordSummerCrashDiagnosticStarted({
      schoolKey: auth.schoolKey,
      studentId: auth.session.user.id,
      paperId,
    }).catch(() => undefined);

    scheduleStudentDashboardCacheInvalidation({
      schoolKey: auth.schoolKey,
      studentIds: [auth.session.user.id],
    });

    return NextResponse.json(result);
  } catch (error) {
    const payload = buildExamRuntimeErrorPayload(error, "Failed to start test.");
    await recordOpsFailure({
      schoolKey: auth.schoolKey,
      req,
      action: "exam_attempt_start",
      message: payload.message,
      error,
      alertLevel: "trust_critical",
      metadata: {
        route: "/api/student/tests/[paperId]/attempt",
        method: "POST",
        operation: "start",
        paperId,
        studentId: auth.session.user.id,
        classId: auth.session.user.studentClassId || null,
        academicSectionId: auth.session.user.studentAcademicSectionId || null,
        httpStatus: payload.httpStatus,
      },
      entity: { type: "exam", id: paperId, label: "student_attempt" },
    });
    return NextResponse.json(payload, { status: payload.httpStatus });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ paperId: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
    studentSessionValidationMode: "redis_strict",
  });
  if (!auth.ok) return auth.response;

  const { paperId } = await params;
  const accessCheck = await assertSummerCrashStudentApiAccess({
    schoolKey: auth.schoolKey,
    studentId: auth.session.user.id,
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
  const body = await req.json().catch(() => ({}));

  try {
    const result = await saveStudentExamAttempt({
      schoolKey: auth.schoolKey as string,
      studentId: auth.session.user.id,
      paperId,
      attemptId: typeof body?.attemptId === "string" ? body.attemptId : null,
      sectionAnswers: body?.sectionAnswers ?? [],
      baseLastSavedAt:
        typeof body?.baseLastSavedAt === "string" ? body.baseLastSavedAt : null,
    });

    scheduleStudentDashboardCacheInvalidation({
      schoolKey: auth.schoolKey,
      studentIds: [auth.session.user.id],
    });

    return NextResponse.json(result);
  } catch (error) {
    const payload = buildExamRuntimeErrorPayload(
      error,
      "Failed to save attempt.",
    );
    await recordOpsFailure({
      schoolKey: auth.schoolKey,
      req,
      action: "exam_attempt_save",
      message: payload.message,
      error,
      alertLevel: "trust_critical",
      metadata: {
        route: "/api/student/tests/[paperId]/attempt",
        method: "PATCH",
        operation: "save",
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
