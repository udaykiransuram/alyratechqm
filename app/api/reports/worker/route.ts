import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireTenantSession } from "@/lib/api-auth";
import {
  listRedisPartitionQueuePartitions,
  REPORT_DISPATCH_REDIS_QUEUE,
} from "@/lib/redis";
import { runReportDispatchWorker } from "@/lib/reports/dispatchWorker";
import { getTrustedInternalOrigin } from "@/lib/security/internal-origin";
import { recordOpsFailure } from "@/lib/ops-runtime";
import { withRequestBudget } from "@/lib/server/request-governor";
import ReportDispatchJob from "@/models/ReportDispatchJob";

export const runtime = "nodejs";

function getWorkerSecret() {
  return String(process.env.REPORT_DISPATCH_WORKER_SECRET || "").trim();
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
    req.headers.get("x-report-worker-secret") || "",
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

const REPORT_DISPATCH_BACKLOG_ALERT_THRESHOLD = 100;

async function maybeAlertReportDispatchBacklog(
  req: NextRequest,
  schoolKey: string | undefined,
  remainingQueued: number,
  processed: number,
) {
  if (remainingQueued < REPORT_DISPATCH_BACKLOG_ALERT_THRESHOLD) {
    return;
  }

  await recordOpsFailure({
    schoolKey,
    req,
    action: "report_dispatch_backlog",
    message:
      "Report dispatch backlog stayed above the configured threshold after a worker run.",
    severity: "warn",
    alertLevel: "trust_critical",
    metadata: {
      remainingQueued,
      processed,
      threshold: REPORT_DISPATCH_BACKLOG_ALERT_THRESHOLD,
    },
  });
}

async function runScheduledDispatchWorker({
  origin,
  schoolKey,
  limitPerSchool,
  maxSchools,
  jobIds,
}: {
  origin: string;
  schoolKey?: string;
  limitPerSchool: number;
  maxSchools: number;
  jobIds?: string[];
}) {
  const redisQueuedSchoolKeys =
    schoolKey
      ? null
      : await listRedisPartitionQueuePartitions(REPORT_DISPATCH_REDIS_QUEUE);
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
            ? ReportDispatchJob.distinct("schoolKey", {
                status: "queued",
              })
            : Promise.resolve([]),
          ReportDispatchJob.distinct("schoolKey", {
            status: "processing",
          }),
        ]).then(([mongoQueuedSchoolKeys, processingSchoolKeys]) =>
          prioritizedSchoolKeys.concat(
            [...mongoQueuedSchoolKeys, ...processingSchoolKeys]
              .map((value) => String(value || "").trim())
              .filter((value) => value && !queuedSet.has(value))
              .slice(0, Math.max(0, maxSchools - prioritizedSchoolKeys.length)),
          ),
        );
      })();

  const resolvedSchoolKeys = await scheduledSchoolKeys;

  const schools = [];

  for (const queuedSchoolKey of resolvedSchoolKeys) {
    const result = await runReportDispatchWorker({
      origin,
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
    sent: schools.reduce((sum, item) => sum + item.sent, 0),
    failed: schools.reduce((sum, item) => sum + item.failed, 0),
    remainingQueued: schools.reduce(
      (sum, item) => sum + item.remainingQueued,
      0,
    ),
    recoveredStale: schools.reduce(
      (sum, item) => sum + item.recoveredStale,
      0,
    ),
    awaitingProviderAck: schools.reduce(
      (sum, item) => sum + item.awaitingProviderAck,
      0,
    ),
  };
}

export async function POST(req: NextRequest) {
  const trustedOrigin = getTrustedInternalOrigin();

  if (isCronWorkerRequest(req)) {
    const body = await req.json().catch(() => ({}));
    const schoolKey = String(body?.schoolKey || "").trim() || undefined;
    return withRequestBudget(
      {
        request: req,
        policy: "reportDispatchWorker",
        schoolKey,
        scopeId: schoolKey || "scheduled",
      },
      async () => {
        await connectDB();
        const limitPerSchool = normalizePositiveInteger(
          body?.limitPerSchool,
          10,
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
        const result = await runScheduledDispatchWorker({
          origin: trustedOrigin,
          schoolKey,
          limitPerSchool,
          maxSchools,
          jobIds,
        });

        await Promise.all(
          result.schools.map((school) =>
            maybeAlertReportDispatchBacklog(
              req,
              school.schoolKey,
              school.remainingQueued,
              school.processed,
            ),
          ),
        );

        return NextResponse.json({ success: true, ...result });
      },
    );
  }

  const auth = await requireTenantSession(req, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) return auth.response;
  return withRequestBudget(
    {
      request: req,
      policy: "reportDispatchWorker",
      schoolKey: auth.schoolKey,
      userId: auth.session.user.id,
    },
    async () => {
      await connectDB();
      const { schoolKey } = auth;
      const result = await runReportDispatchWorker({
        origin: trustedOrigin,
        schoolKey,
      });

      await maybeAlertReportDispatchBacklog(
        req,
        schoolKey,
        result.remainingQueued,
        result.processed,
      );

      return NextResponse.json({ success: true, mode: "tenant", ...result });
    },
  );
}
