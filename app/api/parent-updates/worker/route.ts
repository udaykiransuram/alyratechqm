import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { runParentUpdatesWorker } from "@/lib/server/parent-updates";

export const runtime = "nodejs";

function getWorkerSecret() {
  return String(process.env.PARENT_UPDATES_WORKER_SECRET || "").trim();
}

function getCronSecret() {
  return String(process.env.CRON_SECRET || "").trim();
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

function getProvidedSecret(req: NextRequest) {
  const authHeader = String(req.headers.get("authorization") || "").trim();
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  const headerSecret = String(
    req.headers.get("x-parent-updates-worker-secret") || "",
  ).trim();
  return headerSecret || bearerToken;
}

function isWorkerAuthorized(req: NextRequest) {
  const configuredSecrets = [getWorkerSecret(), getCronSecret()].filter(Boolean);
  if (configuredSecrets.length === 0) {
    return false;
  }

  const provided = getProvidedSecret(req);
  return configuredSecrets.some((secret) => secureEqual(secret, provided));
}

export async function GET(req: NextRequest) {
  if (!isWorkerAuthorized(req)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 },
    );
  }

  const schoolKey = String(req.nextUrl.searchParams.get("schoolKey") || "").trim();
  const date = String(req.nextUrl.searchParams.get("date") || "").trim() || undefined;
  const dryRun =
    String(req.nextUrl.searchParams.get("dryRun") || "").trim().toLowerCase() ===
    "true";

  const results = await runParentUpdatesWorker({
    schoolKey: schoolKey || undefined,
    date,
    dryRun,
  });

  return NextResponse.json({ success: true, results });
}

export async function POST(req: NextRequest) {
  if (!isWorkerAuthorized(req)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized." },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    schoolKey?: string;
    date?: string;
    dryRun?: boolean;
  };

  const results = await runParentUpdatesWorker({
    schoolKey: body?.schoolKey ? String(body.schoolKey).trim() : undefined,
    date: body?.date ? String(body.date).trim() : undefined,
    dryRun: Boolean(body?.dryRun),
  });

  return NextResponse.json({ success: true, results });
}
