import {
  claimRedisPartitionQueueItems,
  enqueueRedisPartitionQueueItems,
  EXAM_RUNTIME_PROJECTION_REDIS_QUEUE,
  getRedisPartitionQueuePartitionCounts,
  setRedisPartitionQueuePartitionActive,
} from "@/lib/redis";
import { syncExamRuntimeMongoProjectionForAttemptId } from "@/lib/exam-runtime";

export type RunExamRuntimeProjectionWorkerResult = {
  processed: number;
  projected: number;
  skipped: number;
  failed: number;
  requeued: number;
  remainingQueued: number;
};

function normalizeAttemptIds(attemptIds: string[] | undefined) {
  return Array.from(
    new Set(
      (Array.isArray(attemptIds) ? attemptIds : [])
        .map((attemptId) => String(attemptId || "").trim())
        .filter(Boolean),
    ),
  );
}

function resolveRetryDelayMs() {
  const parsed = Number(process.env.EXAM_RUNTIME_PROJECTION_RETRY_DELAY_MS || 30_000);
  if (!Number.isFinite(parsed) || parsed < 1_000) {
    return 30_000;
  }

  return Math.floor(parsed);
}

async function syncExamRuntimeProjectionQueuePartition(schoolKey: string) {
  const counts = await getRedisPartitionQueuePartitionCounts({
    queueName: EXAM_RUNTIME_PROJECTION_REDIS_QUEUE,
    partitionKey: schoolKey,
  }).catch(() => null);

  const remainingQueued = counts ? counts.ready + counts.delayed : 0;
  await setRedisPartitionQueuePartitionActive({
    queueName: EXAM_RUNTIME_PROJECTION_REDIS_QUEUE,
    partitionKey: schoolKey,
    active: remainingQueued > 0,
  }).catch(() => null);

  return { remainingQueued };
}

export async function runExamRuntimeProjectionWorker(params: {
  schoolKey: string;
  attemptIds?: string[];
  limit?: number;
}): Promise<RunExamRuntimeProjectionWorkerResult> {
  const schoolKey = String(params.schoolKey || "").trim();
  if (!schoolKey) {
    return {
      processed: 0,
      projected: 0,
      skipped: 0,
      failed: 0,
      requeued: 0,
      remainingQueued: 0,
    };
  }

  const limit = Math.max(1, Math.min(250, Math.floor(params.limit || 25)));
  const directAttemptIds = normalizeAttemptIds(params.attemptIds);
  const queueAttemptIds =
    directAttemptIds.length > 0
      ? directAttemptIds
      : Array.from(
          new Set(
            ((await claimRedisPartitionQueueItems({
              queueName: EXAM_RUNTIME_PROJECTION_REDIS_QUEUE,
              partitionKey: schoolKey,
              limit,
            })) || [])
              .map((attemptId) => String(attemptId || "").trim())
              .filter(Boolean),
          ),
        );

  let processed = 0;
  let projected = 0;
  let skipped = 0;
  let failed = 0;
  let requeued = 0;

  for (const attemptId of queueAttemptIds) {
    processed += 1;

    try {
      const projectionId = await syncExamRuntimeMongoProjectionForAttemptId(
        schoolKey,
        attemptId,
      );

      if (projectionId) {
        projected += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      failed += 1;
      const requeueCount = await enqueueRedisPartitionQueueItems({
        queueName: EXAM_RUNTIME_PROJECTION_REDIS_QUEUE,
        partitionKey: schoolKey,
        itemIds: [attemptId],
        availableAt: new Date(Date.now() + resolveRetryDelayMs()),
      }).catch(() => null);

      if (typeof requeueCount === "number" && requeueCount > 0) {
        requeued += requeueCount;
      }

      console.error(
        "Failed to sync an exam runtime attempt into Mongo projection storage:",
        error,
      );
    }
  }

  const { remainingQueued } = await syncExamRuntimeProjectionQueuePartition(
    schoolKey,
  );

  return {
    processed,
    projected,
    skipped,
    failed,
    requeued,
    remainingQueued,
  };
}
