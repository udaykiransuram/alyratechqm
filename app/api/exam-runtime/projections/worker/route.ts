import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  EXAM_RUNTIME_PROJECTION_REDIS_QUEUE,
  listRedisPartitionQueuePartitions,
} from "@/lib/redis";
import { runExamRuntimeProjectionWorker } from "@/lib/server/exam-runtime-projection-worker";

export const runtime = "nodejs";

function getWorkerSecret() {
  return String(process.env.EXAM_RUNTIME_PROJECTION_WORKER_SECRET || "").trim();
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
    req.headers.get("x-exam-runtime-projection-worker-secret") || "",
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

async function runScheduledProjectionWorker({
  schoolKey,
  limitPerSchool,
  maxSchools,
}: {
  schoolKey?: string;
  limitPerSchool: number;
  maxSchools: number;
}) {
  const queuedSchoolKeys =
    schoolKey
      ? [schoolKey]
      : ((await listRedisPartitionQueuePartitions(
          EXAM_RUNTIME_PROJECTION_REDIS_QUEUE,
        )) || [])
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .slice(0, maxSchools);

  const schools = [];

  for (const queuedSchoolKey of queuedSchoolKeys) {
    const result = await runExamRuntimeProjectionWorker({
      schoolKey: queuedSchoolKey,
      limit: limitPerSchool,
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
    projected: schools.reduce((sum, item) => sum + item.projected, 0),
    skipped: schools.reduce((sum, item) => sum + item.skipped, 0),
    failed: schools.reduce((sum, item) => sum + item.failed, 0),
    requeued: schools.reduce((sum, item) => sum + item.requeued, 0),
    remainingQueued: schools.reduce(
      (sum, item) => sum + item.remainingQueued,
      0,
    ),
  };
}

export async function POST(req: NextRequest) {
  if (isCronWorkerRequest(req)) {
    const body = await req.json().catch(() => ({}));
    const schoolKey = String(body?.schoolKey || "").trim() || undefined;
    const limitPerSchool = normalizePositiveInteger(
      body?.limitPerSchool,
      25,
      250,
    );
    const maxSchools = normalizePositiveInteger(body?.maxSchools, 25, 250);
    const result = await runScheduledProjectionWorker({
      schoolKey,
      limitPerSchool,
      maxSchools,
    });

    return NextResponse.json({ success: true, ...result });
  }

  const auth = await requireTenantSession(req, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const result = await runExamRuntimeProjectionWorker({
    schoolKey: auth.schoolKey,
    limit: normalizePositiveInteger(body?.limit, 25, 250),
  });

  return NextResponse.json({ success: true, mode: "tenant", ...result });
}
