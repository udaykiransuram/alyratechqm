import { getTenantModels } from "@/lib/db-tenant";
import ReportDispatchJob from "@/models/ReportDispatchJob";
import { generateStudentReportPdfAndGetPublicUrl } from "@/lib/reports/studentReport";
import {
  sendWhatsAppDocument,
  sendWhatsAppTemplate,
} from "@/lib/whatsapp/meta";

const DEFAULT_MAX_PER_RUN = 10;

export type ReportDispatchDeliveryMode =
  | "document"
  | "template_first"
  | "template_only";

type RunReportDispatchWorkerParams = {
  origin: string;
  schoolKey: string;
  limit?: number;
  jobIds?: string[];
};

export type RunReportDispatchWorkerResult = {
  processed: number;
  sent: number;
  failed: number;
  remainingQueued: number;
  deliveryMode: ReportDispatchDeliveryMode;
};

function isLikelyConversationWindowOrTemplatePolicyError(message: string) {
  const normalizedMessage = String(message || "").toLowerCase();
  return (
    normalizedMessage.includes("outside the allowed window") ||
    (normalizedMessage.includes("24") && normalizedMessage.includes("hour")) ||
    normalizedMessage.includes("re-engagement") ||
    normalizedMessage.includes("template") ||
    normalizedMessage.includes("not in allowed list") ||
    normalizedMessage.includes("recipient phone number")
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

function resolveDeliveryMode(): ReportDispatchDeliveryMode {
  const configuredMode = String(
    process.env.REPORT_DISPATCH_DELIVERY_MODE || "document",
  )
    .trim()
    .toLowerCase();

  if (
    configuredMode === "template_only" ||
    configuredMode === "template_first" ||
    configuredMode === "document"
  ) {
    return configuredMode;
  }

  return "document";
}

function resolveProcessingLimit(limit?: number) {
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    return Math.max(1, Math.floor(limit));
  }
  return DEFAULT_MAX_PER_RUN;
}

export async function runReportDispatchWorker({
  origin,
  schoolKey,
  limit,
  jobIds = [],
}: RunReportDispatchWorkerParams): Promise<RunReportDispatchWorkerResult> {
  const deliveryMode = resolveDeliveryMode();
  const targetedJobIds = Array.from(
    new Set(jobIds.map((jobId) => String(jobId || "").trim()).filter(Boolean)),
  );
  const query: Record<string, any> = {
    schoolKey,
    status: "queued",
  };

  if (targetedJobIds.length > 0) {
    query._id = { $in: targetedJobIds };
  } else {
    const now = new Date();
    query.$or = [
      { nextRetryAt: { $exists: false } },
      { nextRetryAt: { $lte: now } },
    ];
  }

  const jobs = await ReportDispatchJob.find(query)
    .sort({ createdAt: 1 })
    .limit(resolveProcessingLimit(limit ?? targetedJobIds.length));

  let processed = 0;
  let sent = 0;
  let failed = 0;

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
      let templateResponse: any;

      if (
        deliveryMode === "template_only" ||
        deliveryMode === "template_first"
      ) {
        templateResponse = await sendWhatsAppTemplate({ to: job.mobileNumber });
        waRes = templateResponse;
        sentVia = "template";
      }

      if (deliveryMode !== "template_only") {
        try {
          waRes = await sendWhatsAppDocument({
            to: job.mobileNumber,
            link: reportUrl,
            filename,
            caption,
          });
          sentVia = "document";
        } catch (documentError: any) {
          const message =
            documentError?.message || "Failed to send WhatsApp document";
          if (!isLikelyConversationWindowOrTemplatePolicyError(message)) {
            throw documentError;
          }

          if (!templateResponse) {
            templateResponse = await sendWhatsAppTemplate({
              to: job.mobileNumber,
            });
          }

          waRes = templateResponse;
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
        job.error =
          deliveryMode === "template_only"
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

  return {
    processed,
    sent,
    failed,
    remainingQueued: await ReportDispatchJob.countDocuments({
      schoolKey,
      status: "queued",
    }),
    deliveryMode,
  };
}
