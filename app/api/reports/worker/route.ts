import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ReportDispatchJob from "@/models/ReportDispatchJob";
import { getTenantModels } from "@/lib/db-tenant";
import { generateStudentReportPdfAndGetPublicUrl } from "@/lib/reports/studentReport";
import { sendWhatsAppDocument } from "@/lib/whatsapp/meta";

const MAX_PER_RUN = 10;

function backoffMinutes(attempts: number) {
  return Math.min(60, Math.pow(2, Math.max(0, attempts - 1)) * 2);
}

export async function POST(req: NextRequest) {
  await connectDB();
  const now = new Date();
  const jobs = await ReportDispatchJob.find({
    status: "queued",
    $or: [{ nextRetryAt: { $exists: false } }, { nextRetryAt: { $lte: now } }],
  })
    .sort({ createdAt: 1 })
    .limit(MAX_PER_RUN);

  let processed = 0;
  let sent = 0;
  let failed = 0;
  const origin = new URL(req.url).origin;

  for (const job of jobs) {
    processed += 1;
    try {
      job.status = "processing";
      job.lastAttemptAt = new Date();
      job.attempts = (job.attempts || 0) + 1;
      await job.save();

      if (!job.responseId || !job.mobileNumber) {
        throw new Error("Invalid job payload: responseId/mobileNumber missing");
      }

      const { QuestionPaperResponse: QPRModel } = await getTenantModels(
        job.schoolKey,
        ["QuestionPaperResponse", "QuestionPaper", "User"],
      );
      const response = await QPRModel.findById(job.responseId)
        .populate("student", "name")
        .populate("paper", "title")
        .lean();

      if (!response || Array.isArray(response)) {
        throw new Error("Response not found for queued job");
      }

      const publicPath = await generateStudentReportPdfAndGetPublicUrl({
        origin,
        schoolKey: job.schoolKey,
        responseId: String(job.responseId),
        fileLabel: (response as any).paper?.title || "student_report",
      });

      const reportUrl = `${origin}${publicPath}`;
      const waRes = await sendWhatsAppDocument({
        to: job.mobileNumber,
        link: reportUrl,
        filename: `${(response as any).paper?.title || "student_report"}.pdf`,
        caption: `Report for ${(response as any).student?.name || "student"}`,
      });

      job.status = "sent";
      job.error = undefined;
      job.nextRetryAt = undefined;
      job.reportUrl = reportUrl;
      job.providerMessageId = waRes?.messages?.[0]?.id;
      await job.save();
      sent += 1;
    } catch (error: any) {
      const reachedMax = (job.attempts || 0) >= (job.maxAttempts || 3);
      job.error = error?.message || "Worker send failed";
      if (reachedMax) {
        job.status = "failed";
      } else {
        job.status = "queued";
        const mins = backoffMinutes(job.attempts || 1);
        job.nextRetryAt = new Date(Date.now() + mins * 60 * 1000);
      }
      await job.save();
      failed += 1;
    }
  }

  return NextResponse.json({
    success: true,
    processed,
    sent,
    failed,
    remainingQueued: await ReportDispatchJob.countDocuments({
      status: "queued",
    }),
  });
}
