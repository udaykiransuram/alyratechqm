import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ReportDispatchJob from "@/models/ReportDispatchJob";
import { getTenantModels } from "@/lib/db-tenant";
import { generateStudentReportPdfAndGetPublicUrl } from "@/lib/reports/studentReport";
import {
  sendWhatsAppDocument,
  sendWhatsAppTemplate,
} from "@/lib/whatsapp/meta";

const MAX_PER_RUN = 10;
const TEMPLATE_ONLY_MODE = process.env.WHATSAPP_TEMPLATE_ONLY === "true";
const TEMPLATE_FIRST_MODE = process.env.WHATSAPP_SEND_TEMPLATE_FIRST === "true";

function isLikelyConversationWindowOrTemplatePolicyError(message: string) {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("outside the allowed window") ||
    (m.includes("24") && m.includes("hour")) ||
    m.includes("re-engagement") ||
    m.includes("template") ||
    m.includes("not in allowed list") ||
    m.includes("recipient phone number")
  );
}

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
      let waRes: any;
      let sentVia: "document" | "template" = "document";

      // Optional modes for easier rollout/debugging in production.
      if (TEMPLATE_ONLY_MODE) {
        waRes = await sendWhatsAppTemplate({ to: job.mobileNumber });
        sentVia = "template";
      } else if (TEMPLATE_FIRST_MODE) {
        waRes = await sendWhatsAppTemplate({ to: job.mobileNumber });
        sentVia = "template";
      }

      if (sentVia !== "template" || !TEMPLATE_ONLY_MODE) {
        try {
          waRes = await sendWhatsAppDocument({
            to: job.mobileNumber,
            link: reportUrl,
            filename: `${(response as any).paper?.title || "student_report"}.pdf`,
            caption: `Report for ${(response as any).student?.name || "student"}`,
          });
        } catch (docErr: any) {
          const msg = docErr?.message || "Failed to send WhatsApp document";
          if (!isLikelyConversationWindowOrTemplatePolicyError(msg)) {
            throw docErr;
          }

          // Fallback: send approved template (default hello_world), useful when document send is blocked by policy/window.
          waRes = await sendWhatsAppTemplate({ to: job.mobileNumber });
          sentVia = "template";
        }
      }

      job.status = "sent";
      job.error = undefined;
      job.nextRetryAt = undefined;
      job.reportUrl = reportUrl;
      job.providerMessageId = waRes?.messages?.[0]?.id;
      if (sentVia === "template") {
        job.error = TEMPLATE_ONLY_MODE
          ? "Template-only mode enabled; sent approved template message"
          : "Document delivery blocked or skipped; template sent successfully";
      }
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
