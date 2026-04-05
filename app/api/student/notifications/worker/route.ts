import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import {
  listRedisPartitionQueuePartitions,
  STUDENT_NOTIFICATION_REDIS_QUEUE,
} from "@/lib/redis";
import { runStudentNotificationWorker } from "@/lib/server/student-notification-worker";
import StudentNotificationJob from "@/models/StudentNotificationJob";

export const runtime = "nodejs";

function getWorkerSecret() {
  return String(process.env.STUDENT_NOTIFICATION_WORKER_SECRET || "").trim();
}

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (
    leftBuffer.length === 0 ||
    rightBuffer.length === 0 ||
    leftBuffer.length !== rightBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isCronWorkerRequest(req: NextRequest) {
  const configuredSecret = getWorkerSecret();
  if (!configuredSecret) return false;

  const authHeader = String(req.headers.get("authorization") || "").trim();
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  const headerSecret = String(
    req.headers.get("x-student-notification-worker-secret") || "",
  ).trim();
  const providedSecret = headerSecret || bearerToken;

  return secureEqual(configuredSecret, providedSecret);
}

function normalizePositiveInteger(
  value: unknown,
  fallback: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

async function runScheduledNotificationWorker({
  schoolKey,
  limitPerSchool,
  maxSchools,
  jobIds,
}: {
  schoolKey?: string;
  limitPerSchool: number;
  maxSchools: number;
  jobIds?: string[];
}) {
  const redisQueuedSchoolKeys =
    schoolKey
      ? null
      : await listRedisPartitionQueuePartitions(STUDENT_NOTIFICATION_REDIS_QUEUE);
  const queuedSchoolKeys = schoolKey
    ? [schoolKey]
    : (redisQueuedSchoolKeys || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean);

  const scheduledSchoolKeys = schoolKey
    ? queuedSchoolKeys
    : (() => {
        const prioritizedSchoolKeys = queuedSchoolKeys.slice(0, maxSchools);
        if (
          prioritizedSchoolKeys.length >= maxSchools &&
          redisQueuedSchoolKeys !== null
        ) {
          return prioritizedSchoolKeys;
        }

        const queuedSet = new Set(prioritizedSchoolKeys);

        return Promise.all([
          prioritizedSchoolKeys.length < maxSchools
            ? StudentNotificationJob.distinct("schoolKey", {
                status: "queued",
              })
            : Promise.resolve([]),
          StudentNotificationJob.distinct("schoolKey", {
            status: "processing",
          }),
        ]).then(([mongoQueuedSchoolKeys, processingSchoolKeys]) =>
          prioritizedSchoolKeys.concat(
            [...mongoQueuedSchoolKeys, ...processingSchoolKeys]
              .map((value) => String(value || "").trim())
              .filter((value) => value && !queuedSet.has(value))
              .slice(
                0,
                Math.max(0, maxSchools - prioritizedSchoolKeys.length),
              ),
          ),
        );
      })();

  const resolvedSchoolKeys = await scheduledSchoolKeys;
  const schools = [];

  for (const queuedSchoolKey of resolvedSchoolKeys) {
    const result = await runStudentNotificationWorker({
      schoolKey: queuedSchoolKey,
      limit: limitPerSchool,
      jobIds:
        schoolKey && Array.isArray(jobIds) && queuedSchoolKey === schoolKey
          ? jobIds
          : [],
    });

    schools.push({
      schoolKey: queuedSchoolKey,
      ...result,
    });
  }

  return {
    mode: "scheduled" as const,
    schools,
    processed: schools.reduce((sum, item) => sum + item.processed, 0),
    completed: schools.reduce((sum, item) => sum + item.completed, 0),
    failed: schools.reduce((sum, item) => sum + item.failed, 0),
    remainingQueued: schools.reduce(
      (sum, item) => sum + item.remainingQueued,
      0,
    ),
    recoveredStale: schools.reduce(
      (sum, item) => sum + item.recoveredStale,
      0,
    ),
    deliveredStudents: schools.reduce(
      (sum, item) => sum + item.deliveredStudents,
      0,
    ),
    upsertedNotifications: schools.reduce(
      (sum, item) => sum + item.upsertedNotifications,
      0,
    ),
  };
}

export async function POST(req: NextRequest) {
  await connectDB();

  if (isCronWorkerRequest(req)) {
    const body = await req.json().catch(() => ({}));
    const schoolKey = String(body?.schoolKey || "").trim() || undefined;
    const limitPerSchool = normalizePositiveInteger(
      body?.limitPerSchool,
      25,
      100,
    );
    const maxSchools = normalizePositiveInteger(body?.maxSchools, 25, 100);
    const jobIds: string[] = Array.from(
      new Set(
        (Array.isArray(body?.jobIds) ? body.jobIds : [])
          .map((jobId: any) => String(jobId || "").trim())
          .filter(Boolean),
      ),
    );
    const result = await runScheduledNotificationWorker({
      schoolKey,
      limitPerSchool,
      maxSchools,
      jobIds,
    });

    return NextResponse.json({ success: true, ...result });
  }

  const auth = await requireTenantSession(req, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const jobIds: string[] = Array.from(
    new Set(
      (Array.isArray(body?.jobIds) ? body.jobIds : [])
        .map((jobId: any) => String(jobId || "").trim())
        .filter(Boolean),
    ),
  );
  const result = await runStudentNotificationWorker({
    schoolKey: auth.schoolKey,
    limit: normalizePositiveInteger(body?.limit, 25, 100),
    jobIds,
  });

  return NextResponse.json({ success: true, mode: "tenant", ...result });
}
