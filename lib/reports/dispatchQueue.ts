import {
  enqueueRedisPartitionQueueItems,
  REPORT_DISPATCH_REDIS_QUEUE,
} from "@/lib/redis";
import { runReportDispatchWorker } from "@/lib/reports/dispatchWorker";
import { getTrustedInternalOrigin } from "@/lib/security/internal-origin";

function getReportDispatchWorkerSecret() {
  return String(process.env.REPORT_DISPATCH_WORKER_SECRET || "").trim();
}

export async function enqueueReportDispatchJobs(params: {
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

export async function triggerReportDispatchWorker(params: {
  schoolKey: string;
  jobIds?: string[];
}) {
  const jobIds = Array.from(
    new Set(
      (Array.isArray(params.jobIds) ? params.jobIds : [])
        .map((jobId) => String(jobId || "").trim())
        .filter(Boolean),
    ),
  );

  if (!params.schoolKey) {
    return null;
  }

  const workerSecret = getReportDispatchWorkerSecret();
  if (workerSecret) {
    const response = await fetch(
      `${getTrustedInternalOrigin()}/api/reports/worker`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-report-worker-secret": workerSecret,
        },
        cache: "no-store",
        body: JSON.stringify({
          schoolKey: params.schoolKey,
          jobIds,
          limitPerSchool: Math.max(10, jobIds.length || 0),
          maxSchools: 1,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Report dispatch worker trigger failed with status ${response.status}.`,
      );
    }

    return response.json().catch(() => null);
  }

  return runReportDispatchWorker({
    origin: getTrustedInternalOrigin(),
    schoolKey: params.schoolKey,
    jobIds,
    limit: Math.max(10, jobIds.length || 0),
  });
}

export function scheduleReportDispatchWorker(params: {
  schoolKey: string;
  jobIds: string[];
}) {
  const jobIds = Array.from(
    new Set(
      (Array.isArray(params.jobIds) ? params.jobIds : [])
        .map((jobId) => String(jobId || "").trim())
        .filter(Boolean),
    ),
  );

  if (!params.schoolKey || jobIds.length === 0) {
    return;
  }

  queueMicrotask(() => {
    void triggerReportDispatchWorker({
      schoolKey: params.schoolKey,
      jobIds,
    }).catch((error) => {
      console.error("Failed to auto-trigger report dispatch worker", error);
    });
  });
}

