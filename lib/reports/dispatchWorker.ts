import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { resolveExamRuntimeMongoResponseIdWithCooldown } from "@/lib/exam-runtime-sync-cache";
import {
  claimRedisPartitionQueueItems,
  enqueueRedisPartitionQueueItems,
  REPORT_DISPATCH_REDIS_QUEUE,
  setRedisPartitionQueuePartitionActive,
} from "@/lib/redis";
import ReportDispatchJob from "@/models/ReportDispatchJob";
import {
  createPendingDeliveryAttempt,
  expireActiveDeliveryAttempt,
  findDeliveryAttemptByKey,
  getDispatchAttemptAckWaitUntil,
  markDeliveryAttemptAccepted,
} from "@/lib/reports/dispatchAttempts";
import { generateStudentReportPdfAndGetPublicUrl } from "@/lib/reports/studentReport";
import {
  sendWhatsAppDocument,
  sendWhatsAppTemplate,
} from "@/lib/whatsapp/meta";

const DEFAULT_MAX_PER_RUN = 10;
const DEFAULT_STALE_PROCESSING_MINUTES = 15;
const DEFAULT_PROVIDER_ACK_WAIT_MINUTES = 45;

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
  recoveredStale: number;
  awaitingProviderAck: number;
  deliveryMode: ReportDispatchDeliveryMode;
};

function buildQueuedJobQuery({
  schoolKey,
  now,
}: {
  schoolKey: string;
  now: Date;
}) {
  return {
    schoolKey,
    status: "queued",
    $or: [
      { nextRetryAt: { $exists: false } },
      { nextRetryAt: { $lte: now } },
    ],
  };
}

function resolveStaleProcessingMinutes() {
  const parsed = Number(
    process.env.REPORT_DISPATCH_STALE_MINUTES ||
      DEFAULT_STALE_PROCESSING_MINUTES,
  );

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_STALE_PROCESSING_MINUTES;
  }

  return Math.min(1440, Math.max(1, Math.floor(parsed)));
}

function resolveProviderAckWaitMinutes() {
  const parsed = Number(
    process.env.REPORT_DISPATCH_PROVIDER_ACK_WAIT_MINUTES ||
      DEFAULT_PROVIDER_ACK_WAIT_MINUTES,
  );

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PROVIDER_ACK_WAIT_MINUTES;
  }

  return Math.min(1440, Math.max(1, Math.floor(parsed)));
}

function buildStaleProcessingJobQuery({
  schoolKey,
  cutoff,
}: {
  schoolKey: string;
  cutoff: Date;
}) {
  return {
    schoolKey,
    status: "processing",
    $or: [
      { processingStartedAt: { $lte: cutoff } },
      {
        processingStartedAt: { $exists: false },
        lastAttemptAt: { $lte: cutoff },
      },
      {
        processingStartedAt: { $exists: false },
        lastAttemptAt: { $exists: false },
        updatedAt: { $lte: cutoff },
      },
    ],
  };
}

async function recoverStaleProcessingJobs({
  schoolKey,
}: {
  schoolKey: string;
}) {
  const staleMinutes = resolveStaleProcessingMinutes();
  const ackWaitMinutes = resolveProviderAckWaitMinutes();
  const recoveryTime = new Date();
  const cutoff = new Date(recoveryTime.getTime() - staleMinutes * 60 * 1000);
  const staleJobs = await ReportDispatchJob.find(
    buildStaleProcessingJobQuery({
      schoolKey,
      cutoff,
    }),
  ).sort({
    processingStartedAt: 1,
    lastAttemptAt: 1,
    createdAt: 1,
  });

  let recoveredStale = 0;
  let awaitingProviderAck = 0;
  const jobsByRetryAt = new Map<number, string[]>();

  for (const job of staleJobs) {
    const pendingAckUntil = job.activeAttemptKey
      ? getDispatchAttemptAckWaitUntil(
          job.activeAttemptCreatedAt ||
            job.lastAttemptAt ||
            job.updatedAt ||
            recoveryTime,
          ackWaitMinutes,
        )
      : null;

    job.status = "queued";
    job.processingStartedAt = undefined;

    if (pendingAckUntil && pendingAckUntil.getTime() > recoveryTime.getTime()) {
      job.nextRetryAt = pendingAckUntil;
      job.error = `Recovered stale processing lock; waiting for provider acknowledgement before retrying at ${pendingAckUntil.toISOString()}.`;
      awaitingProviderAck += 1;
    } else {
      job.nextRetryAt = recoveryTime;
      job.error = job.activeAttemptKey
        ? "Recovered stale processing lock after provider acknowledgement wait expired; retrying with a new delivery attempt."
        : `Recovered stale processing lock after ${staleMinutes} minute(s) without completion.`;
    }

    await job.save();
    recoveredStale += 1;

    const retryAtMs = (job.nextRetryAt || recoveryTime).getTime();
    if (!jobsByRetryAt.has(retryAtMs)) {
      jobsByRetryAt.set(retryAtMs, []);
    }
    jobsByRetryAt.get(retryAtMs)?.push(String(job._id));
  }

  for (const [retryAtMs, jobIds] of jobsByRetryAt.entries()) {
    await enqueueReportDispatchJobIds({
      schoolKey,
      jobIds,
      availableAt: new Date(retryAtMs),
    }).catch(() => null);
  }

  return {
    recoveredStale,
    awaitingProviderAck,
  };
}

async function claimQueuedReportJobs({
  schoolKey,
  limit,
  jobIds,
}: {
  schoolKey: string;
  limit: number;
  jobIds: string[];
}) {
  const claimedJobs = [];

  if (jobIds.length > 0) {
    for (const jobId of jobIds.slice(0, limit)) {
      const claimTime = new Date();
      const claimedJob = await ReportDispatchJob.findOneAndUpdate(
        {
          _id: jobId,
          ...buildQueuedJobQuery({
            schoolKey,
            now: claimTime,
          }),
        },
        {
          $set: {
            status: "processing",
            lastAttemptAt: claimTime,
            processingStartedAt: claimTime,
          },
          $inc: {
            attempts: 1,
          },
        },
        {
          new: true,
        },
      );

      if (claimedJob) {
        claimedJobs.push(claimedJob);
      }
    }

    return claimedJobs;
  }

  const redisClaimedJobIds = await claimRedisPartitionQueueItems({
    queueName: REPORT_DISPATCH_REDIS_QUEUE,
    partitionKey: schoolKey,
    limit: Math.min(100, Math.max(limit * 3, limit)),
  });

  if (redisClaimedJobIds !== null) {
    for (const redisJobId of redisClaimedJobIds) {
      if (claimedJobs.length >= limit) {
        break;
      }

      const claimTime = new Date();
      const claimedJob = await ReportDispatchJob.findOneAndUpdate(
        {
          _id: redisJobId,
          ...buildQueuedJobQuery({
            schoolKey,
            now: claimTime,
          }),
        },
        {
          $set: {
            status: "processing",
            lastAttemptAt: claimTime,
            processingStartedAt: claimTime,
          },
          $inc: {
            attempts: 1,
          },
        },
        {
          new: true,
        },
      );

      if (claimedJob) {
        claimedJobs.push(claimedJob);
      }
    }
  }

  while (claimedJobs.length < limit) {
    const claimTime = new Date();
    const claimedJob = await ReportDispatchJob.findOneAndUpdate(
      buildQueuedJobQuery({
        schoolKey,
        now: claimTime,
      }),
      {
        $set: {
          status: "processing",
          lastAttemptAt: claimTime,
          processingStartedAt: claimTime,
        },
        $inc: {
          attempts: 1,
        },
      },
      {
        new: true,
        sort: {
          createdAt: 1,
        },
      },
    );

    if (!claimedJob) {
      break;
    }

    claimedJobs.push(claimedJob);
  }

  return claimedJobs;
}

async function ensureReadyForAuthoritativeSend(job: any) {
  const ackWaitMinutes = resolveProviderAckWaitMinutes();
  const now = new Date();
  const activeAttemptKey = String(job.activeAttemptKey || "").trim();

  if (activeAttemptKey) {
    const activeAttempt = findDeliveryAttemptByKey(job, activeAttemptKey);
    const ackWaitUntil = getDispatchAttemptAckWaitUntil(
      job.activeAttemptCreatedAt || activeAttempt?.createdAt || job.lastAttemptAt || now,
      ackWaitMinutes,
    );

    if (ackWaitUntil && ackWaitUntil.getTime() > now.getTime()) {
      job.status = "queued";
      job.processingStartedAt = undefined;
      job.nextRetryAt = ackWaitUntil;
      job.error = `Waiting for provider acknowledgement before retrying at ${ackWaitUntil.toISOString()}.`;
      await job.save();
      await enqueueReportDispatchJobIds({
        schoolKey: job.schoolKey,
        jobIds: [String(job._id)],
        availableAt: ackWaitUntil,
      }).catch(() => null);
      return {
        deferredUntil: ackWaitUntil,
        attemptKey: null,
      };
    }

    expireActiveDeliveryAttempt(
      job,
      "Provider acknowledgement window expired before the job could be confirmed; rotating to a new delivery attempt.",
      now,
    );
  }

  const attemptKey = createPendingDeliveryAttempt(job, now);
  job.error = undefined;
  job.nextRetryAt = undefined;
  await job.save();

  return {
    deferredUntil: null,
    attemptKey,
  };
}

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

async function enqueueReportDispatchJobIds(params: {
  schoolKey: string;
  jobIds: string[];
  availableAt?: Date | null;
}) {
  const jobIds = Array.from(
    new Set(
      (Array.isArray(params.jobIds) ? params.jobIds : [])
        .map((jobId) => String(jobId || "").trim())
        .filter(Boolean),
    ),
  );

  if (!params.schoolKey || jobIds.length === 0) {
    return null;
  }

  return enqueueRedisPartitionQueueItems({
    queueName: REPORT_DISPATCH_REDIS_QUEUE,
    partitionKey: params.schoolKey,
    itemIds: jobIds,
    availableAt: params.availableAt || new Date(),
  });
}

async function syncReportDispatchQueuePartition(schoolKey: string) {
  const [remainingQueued, processingCount] = await Promise.all([
    ReportDispatchJob.countDocuments({
      schoolKey,
      status: "queued",
    }),
    ReportDispatchJob.countDocuments({
      schoolKey,
      status: "processing",
    }),
  ]);

  await setRedisPartitionQueuePartitionActive({
    queueName: REPORT_DISPATCH_REDIS_QUEUE,
    partitionKey: schoolKey,
    active: remainingQueued + processingCount > 0,
  }).catch(() => null);

  return {
    remainingQueued,
    processingCount,
  };
}

export async function runReportDispatchWorker({
  origin,
  schoolKey,
  limit,
  jobIds = [],
}: RunReportDispatchWorkerParams): Promise<RunReportDispatchWorkerResult> {
  await connectDB();
  const deliveryMode = resolveDeliveryMode();
  const staleRecovery = await recoverStaleProcessingJobs({
    schoolKey,
  });
  const targetedJobIds = Array.from(
    new Set(jobIds.map((jobId) => String(jobId || "").trim()).filter(Boolean)),
  );
  const jobs = await claimQueuedReportJobs({
    schoolKey,
    limit: resolveProcessingLimit(limit ?? targetedJobIds.length),
    jobIds: targetedJobIds,
  });

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    processed += 1;

    try {
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

        const resolvedResponseId =
          (await resolveExamRuntimeMongoResponseIdWithCooldown(
            job.schoolKey,
            String(job.responseId),
          )) || String(job.responseId);

        const { QuestionPaperResponse: QPRModel } = await getTenantModels(
          job.schoolKey,
          ["QuestionPaperResponse", "QuestionPaper", "User"],
        );
        const response = await QPRModel.findById(resolvedResponseId)
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

      let authoritativeAttemptKey: string | null = null;
      const ensureAuthoritativeAttemptKey = async () => {
        if (authoritativeAttemptKey) {
          return authoritativeAttemptKey;
        }

        const prepared = await ensureReadyForAuthoritativeSend(job);
        authoritativeAttemptKey = prepared.attemptKey;
        return authoritativeAttemptKey;
      };

      let waRes: any;
      let sentVia: "document" | "template" = "document";
      let templateResponse: any;

      if (deliveryMode === "template_only") {
        const attemptKey = await ensureAuthoritativeAttemptKey();
        if (!attemptKey) {
          continue;
        }

        templateResponse = await sendWhatsAppTemplate({
          to: job.mobileNumber,
          callbackData: attemptKey,
        });
        waRes = templateResponse;
        sentVia = "template";
      } else if (deliveryMode === "template_first") {
        templateResponse = await sendWhatsAppTemplate({ to: job.mobileNumber });
        waRes = templateResponse;
        sentVia = "template";
      }

      if (deliveryMode !== "template_only") {
        const attemptKey = await ensureAuthoritativeAttemptKey();
        if (!attemptKey) {
          continue;
        }

        try {
          waRes = await sendWhatsAppDocument({
            to: job.mobileNumber,
            link: reportUrl,
            filename,
            caption,
            callbackData: attemptKey,
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
              callbackData: attemptKey,
            });
          }

          waRes = templateResponse;
          sentVia = "template";
        }
      }

      const acceptedAt = new Date();
      if (authoritativeAttemptKey) {
        markDeliveryAttemptAccepted(job, {
          attemptKey: authoritativeAttemptKey,
          providerMessageId: waRes?.messages?.[0]?.id,
          acceptedAt,
          deliveryStatus: "accepted",
        });
      }

      job.status = "sent";
      job.error = undefined;
      job.nextRetryAt = undefined;
      job.processingStartedAt = undefined;
      job.reportUrl = reportUrl;
      job.providerMessageId = waRes?.messages?.[0]?.id;
      job.providerAcceptedAt = acceptedAt;
      job.deliveryStatus = "accepted";
      job.deliveryError = undefined;
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
      const errorMessage = error?.message || "Worker send failed";
      job.error = errorMessage;
      job.processingStartedAt = undefined;

      const activeAttemptKey = String(job.activeAttemptKey || "").trim();
      const isExplicitProviderRejection = !!error?.providerRejected;

      if (activeAttemptKey && !isExplicitProviderRejection) {
        const ackWaitMinutes = resolveProviderAckWaitMinutes();
        const pendingAckUntil =
          getDispatchAttemptAckWaitUntil(
            job.activeAttemptCreatedAt || job.lastAttemptAt || new Date(),
            ackWaitMinutes,
          ) || new Date(Date.now() + ackWaitMinutes * 60 * 1000);

        job.status = "queued";
        job.nextRetryAt = pendingAckUntil;
        job.error = `Delivery attempt outcome is uncertain (${errorMessage}). Waiting for provider acknowledgement until ${pendingAckUntil.toISOString()} before retrying.`;
      } else {
        if (activeAttemptKey) {
          expireActiveDeliveryAttempt(
            job,
            `Delivery attempt ended before provider acceptance: ${errorMessage}`,
            new Date(),
          );
        }

        if (reachedMax) {
          job.status = "failed";
        } else {
          job.status = "queued";
          const mins = backoffMinutes(job.attempts || 1);
          job.nextRetryAt = new Date(Date.now() + mins * 60 * 1000);
        }
      }

      if (reachedMax && activeAttemptKey && !isExplicitProviderRejection) {
        job.status = "queued";
      } else if (reachedMax && isExplicitProviderRejection) {
        job.status = "failed";
      }

      await job.save();

      if (job.status === "queued") {
        await enqueueReportDispatchJobIds({
          schoolKey: job.schoolKey,
          jobIds: [String(job._id)],
          availableAt: job.nextRetryAt || new Date(),
        }).catch(() => null);
      }
      failed += 1;
    }
  }

  const { remainingQueued } = await syncReportDispatchQueuePartition(schoolKey);

  return {
    processed,
    sent,
    failed,
    remainingQueued,
    recoveredStale: staleRecovery.recoveredStale,
    awaitingProviderAck: staleRecovery.awaitingProviderAck,
    deliveryMode,
  };
}
