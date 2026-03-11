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
// Force template-only mode for reliability during rollout/debugging.
const TEMPLATE_ONLY_MODE = true;
const TEMPLATE_FIRST_MODE = false;

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

function sanitizeFilePart(value: string) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9_\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function buildClassReportPublicPath({
  schoolKey,
  paperId,
  academicSectionId,
}: {
  schoolKey: string;
  paperId: string;
  academicSectionId?: string;
}) {
  const params = new URLSearchParams();
  params.set("school", schoolKey);
  if (academicSectionId) {
    params.set("academicSectionId", academicSectionId);
  }
  return `/api/reports/class-analytics/${encodeURIComponent(paperId)}?${params.toString()}`;
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

      if (!job.mobileNumber) {
        throw new Error("Invalid job payload: mobileNumber missing");
      }

      let reportUrl = "";
      let filename = "report.pdf";
      let caption = "Report";

      if (job.type === "student") {
        if (!job.responseId) {
          throw new Error("Invalid student job payload: responseId missing");
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

        reportUrl = `${origin}${publicPath}`;
        filename = `${sanitizeFilePart((response as any).paper?.title || "student_report") || "student_report"}.pdf`;
        caption = `Report for ${(response as any).student?.name || "student"}`;
      } else if (["teacher", "admin", "exam"].includes(job.type)) {
        if (!job.paperId) {
          throw new Error("Invalid class report job payload: paperId missing");
        }

        const publicPath = buildClassReportPublicPath({
          schoolKey: job.schoolKey,
          paperId: String(job.paperId),
          academicSectionId: job.academicSection
            ? String(job.academicSection)
            : undefined,
        });

        reportUrl = `${origin}${publicPath}`;
        const fileBase = [
          sanitizeFilePart(job.paperTitle || "class_analytics"),
          sanitizeFilePart(job.className || ""),
          sanitizeFilePart(job.academicSectionName || ""),
          "class_analytics",
        ]
          .filter(Boolean)
          .join("_");
        filename = `${fileBase || "class_analytics"}.xlsx`;
        caption = `Class analytics report${job.className ? ` for ${job.className}` : ""}${job.academicSectionName ? ` • ${job.academicSectionName}` : ""}`;
      } else {
        throw new Error(`Unsupported job type: ${job.type}`);
      }

      let waRes: any;
      let sentVia: "document" | "template" = "document";

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
            filename,
            caption,
          });
        } catch (docErr: any) {
          const msg = docErr?.message || "Failed to send WhatsApp document";
          if (!isLikelyConversationWindowOrTemplatePolicyError(msg)) {
            throw docErr;
          }

          waRes = await sendWhatsAppTemplate({ to: job.mobileNumber });
          sentVia = "template";
        }
      }

      job.status = "sent";
      job.error = undefined;
      job.nextRetryAt = undefined;
      job.reportUrl = reportUrl;
      job.providerMessageId = waRes?.messages?.[0]?.id;
      job.deliveryStatus = "accepted";
      job.deliveryError = undefined;
      job.lastWebhookAt = new Date();
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
