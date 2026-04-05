import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { resolveExamRuntimeMongoResponseIdWithCooldown } from "@/lib/exam-runtime-sync-cache";
import ReportDispatchJob from "../../../../../../models/ReportDispatchJob";
import { hydrateResponsesWithStudents } from "@/lib/analytics/hydrateResponses";
import { requireTenantSession } from "@/lib/api-auth";
import {
  enqueueReportDispatchJobs,
  scheduleReportDispatchWorker,
} from "@/lib/reports/dispatchQueue";
import { resolvePaperSubjectIds } from "@/lib/question-paper/subjects";
import {
  isSectionInScope,
  normalizeScopeId,
  resolveTeacherPaperScope,
} from "@/lib/question-paper/access";

function normalizeMobileNumber(input: string): string {
  const digits = String(input || "").replace(/\D/g, "");
  // Already E.164-like without '+' (10-15 digits)
  if (/^[1-9]\d{9,14}$/.test(digits)) {
    // If local Indian 10-digit, prefix country code 91
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }
  return digits;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ responseId: string }> },
) {
  await connectDB();
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
    allowSchoolQueryFallback: true,
  });
  if (!auth.ok) return auth.response;
  const { schoolKey } = auth;
  const { responseId } = await params;
  const shouldTriggerWorker =
    req.nextUrl.searchParams.get("triggerWorker") !== "0";
  const resolvedResponseId =
    (await resolveExamRuntimeMongoResponseIdWithCooldown(
      schoolKey,
      String(responseId || ""),
    )) || String(responseId || "");

  // Fast-fail config issues so UI does not show misleading "sent"/"queued" state
  if (!process.env.WHATSAPP_ACCESS_TOKEN) {
    return NextResponse.json(
      {
        success: false,
        message:
          "WhatsApp is not configured: WHATSAPP_ACCESS_TOKEN missing in environment",
      },
      { status: 500 },
    );
  }
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return NextResponse.json(
      {
        success: false,
        message:
          "WhatsApp is not configured: WHATSAPP_PHONE_NUMBER_ID missing in environment",
      },
      { status: 500 },
    );
  }

  const {
    QuestionPaperResponse: QPRModel,
    User: UserModel,
    Class: ClassModel,
    AcademicSection: AcademicSectionModel,
  } = await getTenantModels(schoolKey, [
    "QuestionPaperResponse",
    "User",
    "Class",
    "AcademicSection",
  ]);
  const rawResponse = await QPRModel.findById(resolvedResponseId)
    .populate("paper", "title class subject subjectIds assignedAcademicSections")
    .lean();

  if (!rawResponse || Array.isArray(rawResponse)) {
    return NextResponse.json(
      { success: false, message: "Response not found" },
      { status: 404 },
    );
  }

  const [response] = await hydrateResponsesWithStudents({
    responses: [rawResponse],
    UserModel,
    AcademicSectionModel,
    ClassModel,
    studentSelect: "name mobileNumber class academicSection",
  });

  if (!response?.student) {
    return NextResponse.json(
      { success: false, message: "Student not found for response" },
      { status: 404 },
    );
  }

  const student: any = response.student;
  if (auth.session.user.role === "teacher") {
    const scopedUser = await UserModel.findById(auth.session.user.id)
      .select(
        "hasAllClasses classIds hasAllSubjects subjectIds hasAllSections academicSectionIds",
      )
      .lean();
    const paperObj: any = (rawResponse as any)?.paper || {};
    const assignedSectionIds = Array.isArray(paperObj?.assignedAcademicSections)
      ? paperObj.assignedAcademicSections
          .map((section: any) => normalizeScopeId(section))
          .filter(Boolean)
      : [];
    const teacherScope = resolveTeacherPaperScope(
      scopedUser,
      normalizeScopeId(paperObj?.class),
      resolvePaperSubjectIds(paperObj),
      assignedSectionIds,
    );

    if (
      !teacherScope.hasClassAccess ||
      !teacherScope.hasSubjectAccess ||
      !teacherScope.hasSectionAccess
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "You do not have access to dispatch reports for this paper.",
        },
        { status: 403 },
      );
    }

    const studentSectionId = normalizeScopeId(
      student?.academicSection?._id || student?.academicSection,
    );
    if (!studentSectionId && !teacherScope.hasAllSections) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Teacher-scoped dispatch requires the student to belong to an assigned section.",
        },
        { status: 403 },
      );
    }
    if (
      studentSectionId &&
      !isSectionInScope(studentSectionId, teacherScope.allowedSectionIds)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have access to dispatch reports for this student's section.",
        },
        { status: 403 },
      );
    }
  }

  const normalizedMobile = normalizeMobileNumber(student?.mobileNumber || "");
  if (!normalizedMobile) {
    return NextResponse.json(
      { success: false, message: "Parent mobile number missing for student" },
      { status: 400 },
    );
  }

  const existingQueued = await ReportDispatchJob.findOne({
    schoolKey,
    responseId: response._id,
    status: { $in: ["queued", "processing"] },
  }).lean();

  const latestFailed = await ReportDispatchJob.findOne({
    schoolKey,
    responseId: response._id,
    status: "failed",
  })
    .sort({ updatedAt: -1 })
    .lean();

  if (existingQueued) {
    if (shouldTriggerWorker && existingQueued.status === "queued") {
      await enqueueReportDispatchJobs({
        schoolKey,
        jobIds: [String(existingQueued._id)],
      }).catch(() => null);
      scheduleReportDispatchWorker({
        schoolKey,
        jobIds: [String(existingQueued._id)],
      });
    }

    return NextResponse.json({
      success: true,
      queued: true,
      deliveryStatus: existingQueued.status,
      message: "Report already queued",
      jobId: existingQueued._id,
      ...(latestFailed?.error
        ? {
            lastFailure: {
              error: latestFailed.error,
              updatedAt: latestFailed.updatedAt,
            },
          }
        : {}),
    });
  }

  const job = await ReportDispatchJob.create({
    schoolKey,
    type: "student",
    student: student._id,
    studentName: student?.name || undefined,
    responseId: response._id,
    paperId: (response as any).paper?._id,
    paperTitle: (response as any).paper?.title || undefined,
    classId: student?.class?._id || student?.class || undefined,
    className: student?.class?.name || undefined,
    academicSection:
      student?.academicSection?._id || student?.academicSection || undefined,
    academicSectionName: student?.academicSection?.name || undefined,
    status: "queued",
    mobileNumber: normalizedMobile,
    attempts: 0,
    maxAttempts: 3,
    nextRetryAt: new Date(),
  });

  await enqueueReportDispatchJobs({
    schoolKey,
    jobIds: [String(job._id)],
  }).catch(() => null);

  if (shouldTriggerWorker) {
    scheduleReportDispatchWorker({
      schoolKey,
      jobIds: [String(job._id)],
    });
  }

  return NextResponse.json({
    success: true,
    queued: true,
    deliveryStatus: "queued",
    message: "Report queued for background processing",
    jobId: job._id,
    ...(latestFailed?.error
      ? {
          lastFailure: {
            error: latestFailed.error,
            updatedAt: latestFailed.updatedAt,
          },
        }
      : {}),
  });
}
