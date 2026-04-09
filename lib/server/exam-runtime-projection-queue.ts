import {
  enqueueRedisPartitionQueueItems,
  EXAM_RUNTIME_PROJECTION_REDIS_QUEUE,
} from "@/lib/redis";
import { getTrustedInternalOrigin } from "@/lib/security/internal-origin";
import { runExamRuntimeProjectionWorker } from "@/lib/server/exam-runtime-projection-worker";

function getExamRuntimeProjectionWorkerSecret() {
  return String(process.env.EXAM_RUNTIME_PROJECTION_WORKER_SECRET || "").trim();
}

function normalizeAttemptIds(attemptIds: string[] | undefined) {
  return Array.from(
    new Set(
      (Array.isArray(attemptIds) ? attemptIds : [])
        .map((attemptId) => String(attemptId || "").trim())
        .filter(Boolean),
    ),
  );
}

export async function enqueueExamRuntimeProjectionJobs(params: {
  schoolKey: string;
  attemptIds: string[];
  availableAt?: Date | null;
}) {
  const schoolKey = String(params.schoolKey || "").trim();
  const attemptIds = normalizeAttemptIds(params.attemptIds);

  if (!schoolKey || attemptIds.length === 0) {
    return null;
  }

  return enqueueRedisPartitionQueueItems({
    queueName: EXAM_RUNTIME_PROJECTION_REDIS_QUEUE,
    partitionKey: schoolKey,
    itemIds: attemptIds,
    availableAt: params.availableAt || new Date(),
  });
}

export async function triggerExamRuntimeProjectionWorker(params: {
  schoolKey: string;
  limit?: number;
}) {
  const schoolKey = String(params.schoolKey || "").trim();
  if (!schoolKey) {
    return null;
  }

  const limit = Math.max(1, Math.min(250, Math.floor(params.limit || 25)));
  const workerSecret = getExamRuntimeProjectionWorkerSecret();
  if (workerSecret) {
    const response = await fetch(
      `${getTrustedInternalOrigin()}/api/exam-runtime/projections/worker`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-exam-runtime-projection-worker-secret": workerSecret,
        },
        cache: "no-store",
        body: JSON.stringify({
          schoolKey,
          limitPerSchool: limit,
          maxSchools: 1,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Exam runtime projection worker trigger failed with status ${response.status}.`,
      );
    }

    return response.json().catch(() => null);
  }

  return runExamRuntimeProjectionWorker({
    schoolKey,
    limit,
  });
}

export function scheduleExamRuntimeProjectionWorker(params: {
  schoolKey: string;
  attemptIds: string[];
}) {
  const schoolKey = String(params.schoolKey || "").trim();
  const attemptIds = normalizeAttemptIds(params.attemptIds);

  if (!schoolKey || attemptIds.length === 0) {
    return;
  }

  queueMicrotask(() => {
    void (async () => {
      const limit = Math.max(10, attemptIds.length);
      const enqueued = await enqueueExamRuntimeProjectionJobs({
        schoolKey,
        attemptIds,
      }).catch(() => null);

      if (typeof enqueued === "number" && enqueued > 0) {
        await triggerExamRuntimeProjectionWorker({
          schoolKey,
          limit,
        });
        return;
      }

      await runExamRuntimeProjectionWorker({
        schoolKey,
        attemptIds,
        limit,
      });
    })().catch((error) => {
      console.error(
        "Failed to schedule exam runtime projection worker:",
        error,
      );
    });
  });
}
