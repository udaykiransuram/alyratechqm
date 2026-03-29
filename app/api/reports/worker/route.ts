import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireTenantSession } from "@/lib/api-auth";
import { runReportDispatchWorker } from "@/lib/reports/dispatchWorker";
import { getTrustedInternalOrigin } from "@/lib/security/internal-origin";
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

async function runScheduledDispatchWorker({
  origin,
  schoolKey,
  limitPerSchool,
  maxSchools,
}: {
  origin: string;
  schoolKey?: string;
  limitPerSchool: number;
  maxSchools: number;
}) {
  const queuedSchoolKeys = schoolKey
    ? [schoolKey]
    : (
        await ReportDispatchJob.distinct("schoolKey", {
          status: "queued",
        })
      )
        .map((value) => String(value || "").trim())
        .filter(Boolean);

  const scheduledSchoolKeys = schoolKey
    ? queuedSchoolKeys
    : (() => {
        const prioritizedSchoolKeys = queuedSchoolKeys.slice(0, maxSchools);
        if (prioritizedSchoolKeys.length >= maxSchools) {
          return prioritizedSchoolKeys;
        }

        const queuedSet = new Set(prioritizedSchoolKeys);

        return ReportDispatchJob.distinct("schoolKey", {
          status: "processing",
        }).then((processingSchoolKeys) =>
          prioritizedSchoolKeys.concat(
            processingSchoolKeys
              .map((value) => String(value || "").trim())
              .filter(
                (value) =>
                  value && !queuedSet.has(value),
              )
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
  await connectDB();
  const trustedOrigin = getTrustedInternalOrigin();

  if (isCronWorkerRequest(req)) {
    const body = await req.json().catch(() => ({}));
    const schoolKey = String(body?.schoolKey || "").trim() || undefined;
    const limitPerSchool = normalizePositiveInteger(
      body?.limitPerSchool,
      10,
      100,
    );
    const maxSchools = normalizePositiveInteger(body?.maxSchools, 25, 100);
    const result = await runScheduledDispatchWorker({
      origin: trustedOrigin,
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
  const { schoolKey } = auth;
  const result = await runReportDispatchWorker({
    origin: trustedOrigin,
    schoolKey,
  });

  return NextResponse.json({ success: true, mode: "tenant", ...result });
}
