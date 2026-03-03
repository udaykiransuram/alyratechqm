import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import ReportDispatchJob from "../../../../../../models/ReportDispatchJob";

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

function resolveSchoolKey(req: NextRequest) {
  const url = new URL(req.url);
  const schoolFromHeader =
    req.headers.get("x-school-key") || req.headers.get("X-School-Key");
  const schoolFromQuery = url.searchParams.get("school");
  const schoolFromCookie = req.cookies?.get?.("schoolKey")?.value;
  return (schoolFromHeader || schoolFromQuery || schoolFromCookie || "")
    .toString()
    .trim();
}

export async function POST(
  req: NextRequest,
  { params }: { params: { responseId: string } },
) {
  await connectDB();
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  }

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

  const { QuestionPaperResponse: QPRModel } = await getTenantModels(schoolKey, [
    "QuestionPaperResponse",
    "User",
  ]);
  const response = await QPRModel.findById(params.responseId)
    .populate("student", "name mobileNumber")
    .populate("paper", "title")
    .lean();

  if (!response || Array.isArray(response)) {
    return NextResponse.json(
      { success: false, message: "Response not found" },
      { status: 404 },
    );
  }

  const student: any = response.student;
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
    responseId: response._id,
    paperId: (response as any).paper?._id,
    status: "queued",
    mobileNumber: normalizedMobile,
    attempts: 0,
    maxAttempts: 3,
    nextRetryAt: new Date(),
  });

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
