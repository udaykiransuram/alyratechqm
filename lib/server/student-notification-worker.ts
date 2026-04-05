import { connectDB } from "@/lib/db";
import {
  claimRedisPartitionQueueItems,
  enqueueRedisPartitionQueueItems,
  setRedisPartitionQueuePartitionActive,
  STUDENT_NOTIFICATION_REDIS_QUEUE,
} from "@/lib/redis";
import {
  deliverStudentNotifications,
  normalizeId,
  normalizeIds,
} from "@/lib/server/student-notification-delivery";
import StudentNotificationJob from "@/models/StudentNotificationJob";

const DEFAULT_MAX_PER_RUN = 25;
const DEFAULT_STALE_PROCESSING_MINUTES = 10;

type RunStudentNotificationWorkerParams = {
  schoolKey: string;
  limit?: number;
  jobIds?: string[];
};

export type RunStudentNotificationWorkerResult = {
  processed: number;
  completed: number;
  failed: number;
  remainingQueued: number;
  recoveredStale: number;
  deliveredStudents: number;
  upsertedNotifications: number;
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

function resolveStaleProcessingMinutes() {
  const parsed = Number(
    process.env.STUDENT_NOTIFICATION_WORKER_STALE_MINUTES ||
      DEFAULT_STALE_PROCESSING_MINUTES,
  );

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_STALE_PROCESSING_MINUTES;
  }

  return Math.min(1440, Math.max(1, Math.floor(parsed)));
}

function resolveRetryDelayMinutes(attemptNumber: number) {
  if (attemptNumber <= 1) return 1;
  if (attemptNumber === 2) return 2;
  if (attemptNumber === 3) return 5;
  if (attemptNumber === 4) return 10;
  return 30;
}

async function enqueueStudentNotificationJobs(params: {
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
    queueName: STUDENT_NOTIFICATION_REDIS_QUEUE,
    partitionKey: params.schoolKey,
    itemIds: jobIds,
    availableAt: params.availableAt || new Date(),
  });
}

async function syncStudentNotificationQueuePartition(schoolKey: string) {
  const [remainingQueued, processingCount] = await Promise.all([
    StudentNotificationJob.countDocuments({
      schoolKey,
      status: "queued",
    }),
    StudentNotificationJob.countDocuments({
      schoolKey,
      status: "processing",
    }),
  ]);

  await setRedisPartitionQueuePartitionActive({
    queueName: STUDENT_NOTIFICATION_REDIS_QUEUE,
    partitionKey: schoolKey,
    active: remainingQueued + processingCount > 0,
  }).catch(() => null);

  return {
    remainingQueued,
    processingCount,
  };
}

async function recoverStaleProcessingJobs({
  schoolKey,
}: {
  schoolKey: string;
}) {
  const staleMinutes = resolveStaleProcessingMinutes();
  const recoveryTime = new Date();
  const cutoff = new Date(recoveryTime.getTime() - staleMinutes * 60 * 1000);
  const staleJobs = await StudentNotificationJob.find(
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
  const jobsByRetryAt = new Map<number, string[]>();

  for (const job of staleJobs) {
    job.status = "queued";
    job.processingStartedAt = undefined;
    job.nextRetryAt = recoveryTime;
    job.error = `Recovered stale processing lock after ${staleMinutes} minute(s) without completion.`;
    await job.save();
    recoveredStale += 1;

    const retryAtMs = (job.nextRetryAt || recoveryTime).getTime();
    if (!jobsByRetryAt.has(retryAtMs)) {
      jobsByRetryAt.set(retryAtMs, []);
    }
    jobsByRetryAt.get(retryAtMs)?.push(String(job._id));
  }

  for (const [retryAtMs, jobIds] of jobsByRetryAt.entries()) {
    await enqueueStudentNotificationJobs({
      schoolKey,
      jobIds,
      availableAt: new Date(retryAtMs),
    }).catch(() => null);
  }

  return { recoveredStale };
}

async function claimQueuedStudentNotificationJobs({
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
      const claimedJob = await StudentNotificationJob.findOneAndUpdate(
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
    queueName: STUDENT_NOTIFICATION_REDIS_QUEUE,
    partitionKey: schoolKey,
    limit: Math.min(100, Math.max(limit * 3, limit)),
  });

  if (redisClaimedJobIds !== null) {
    for (const redisJobId of redisClaimedJobIds) {
      if (claimedJobs.length >= limit) {
        break;
      }

      const claimTime = new Date();
      const claimedJob = await StudentNotificationJob.findOneAndUpdate(
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
    const claimedJob = await StudentNotificationJob.findOneAndUpdate(
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

export async function runStudentNotificationWorker({
  schoolKey,
  limit = DEFAULT_MAX_PER_RUN,
  jobIds = [],
}: RunStudentNotificationWorkerParams): Promise<RunStudentNotificationWorkerResult> {
  await connectDB();

  const normalizedLimit = Math.max(1, Math.min(100, Math.floor(limit || 0) || DEFAULT_MAX_PER_RUN));
  const normalizedJobIds = Array.from(
    new Set(
      (Array.isArray(jobIds) ? jobIds : [])
        .map((jobId) => String(jobId || "").trim())
        .filter(Boolean),
    ),
  );

  const { recoveredStale } = await recoverStaleProcessingJobs({ schoolKey });
  const claimedJobs = await claimQueuedStudentNotificationJobs({
    schoolKey,
    limit: normalizedLimit,
    jobIds: normalizedJobIds,
  });

  let completed = 0;
  let failed = 0;
  let deliveredStudents = 0;
  let upsertedNotifications = 0;

  for (const job of claimedJobs) {
    try {
      const result = await deliverStudentNotifications({
        schoolKey: job.schoolKey,
        studentIds: normalizeIds(job.targetStudentIds),
        classId: normalizeId(job.targetClassId),
        assignedSectionIds: normalizeIds(job.targetAcademicSectionIds),
        type: job.type,
        title: job.title,
        message: job.message,
        linkUrl: String(job.linkUrl || ""),
        entityId: job.entityId,
        entityType: job.entityType,
      });

      job.status = "completed";
      job.processingStartedAt = undefined;
      job.nextRetryAt = undefined;
      job.completedAt = new Date();
      job.error = undefined;
      job.resolvedStudentCount = result.studentIds.length;
      job.upsertedCount = result.upsertedCount;
      await job.save();

      completed += 1;
      deliveredStudents += result.studentIds.length;
      upsertedNotifications += result.upsertedCount;
    } catch (error: any) {
      job.processingStartedAt = undefined;
      job.completedAt = undefined;
      job.error =
        error instanceof Error
          ? error.message
          : "Failed to process student notification job.";

      if (job.attempts >= job.maxAttempts) {
        job.status = "failed";
        job.nextRetryAt = undefined;
        failed += 1;
      } else {
        job.status = "queued";
        job.nextRetryAt = new Date(
          Date.now() + resolveRetryDelayMinutes(job.attempts) * 60 * 1000,
        );
      }

      await job.save();

      if (job.status === "queued") {
        await enqueueStudentNotificationJobs({
          schoolKey: job.schoolKey,
          jobIds: [String(job._id)],
          availableAt: job.nextRetryAt || new Date(),
        }).catch(() => null);
      }
    }
  }

  const { remainingQueued } = await syncStudentNotificationQueuePartition(
    schoolKey,
  );

  return {
    processed: claimedJobs.length,
    completed,
    failed,
    remainingQueued,
    recoveredStale,
    deliveredStudents,
    upsertedNotifications,
  };
}
