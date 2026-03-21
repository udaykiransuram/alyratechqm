import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import ReportDispatchJob from "@/models/ReportDispatchJob";
import {
  hydrateAcademicSectionsWithClasses,
  hydrateUsersWithAcademicContext,
} from "@/lib/analytics/hydrateResponses";
import { requireTenantSession } from "@/lib/api-auth";
import { getDispatchAttemptAckWaitUntil } from "@/lib/reports/dispatchAttempts";

export const dynamic = "force-dynamic";

const DEFAULT_PROVIDER_ACK_WAIT_MINUTES = 45;

function resolveSchoolKey(req: NextRequest) {
  const url = new URL(req.url);
  const schoolFromHeader =
    req.headers.get("x-school-key") || req.headers.get("X-School-Key");
  const schoolFromQuery = url.searchParams.get("school");
  const schoolFromCookie = req.cookies?.get?.("schoolKey")?.value;
  return (schoolFromHeader || schoolFromQuery || schoolFromCookie || "")
    .toString()
    .trim();
}

function toIsoString(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
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

function normalizeDeliveryAttempt(attempt: any) {
  const key = String(attempt?.key || "").trim();
  if (!key) return null;

  return {
    key,
    attemptNumber: Math.max(1, Number(attempt?.attemptNumber || 1)),
    state: String(attempt?.state || "pending_ack"),
    createdAt: toIsoString(attempt?.createdAt),
    acknowledgedAt: toIsoString(attempt?.acknowledgedAt),
    lastWebhookAt: toIsoString(attempt?.lastWebhookAt),
    providerMessageId: String(attempt?.providerMessageId || "").trim() || null,
    deliveryStatus: String(attempt?.deliveryStatus || "").trim() || null,
    note: String(attempt?.note || "").trim() || null,
  };
}

function compareDeliveryAttempts(left: any, right: any) {
  const leftAttemptNumber = Number(left?.attemptNumber || 0);
  const rightAttemptNumber = Number(right?.attemptNumber || 0);
  if (leftAttemptNumber !== rightAttemptNumber) {
    return leftAttemptNumber - rightAttemptNumber;
  }

  const leftCreatedAt = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
  const rightCreatedAt = right?.createdAt
    ? new Date(right.createdAt).getTime()
    : 0;
  return leftCreatedAt - rightCreatedAt;
}

function buildDeliveryAttemptSummary(job: any) {
  const ackWaitMinutes = resolveProviderAckWaitMinutes();
  const normalizedAttempts = (Array.isArray(job?.deliveryAttempts)
    ? job.deliveryAttempts
    : []
  )
    .map(normalizeDeliveryAttempt)
    .filter(Boolean)
    .sort(compareDeliveryAttempts);

  const activeAttemptKey = String(job?.activeAttemptKey || "").trim();
  let activeAttempt = activeAttemptKey
    ? normalizedAttempts.find((attempt: any) => attempt.key === activeAttemptKey) ||
      null
    : null;

  if (!activeAttempt && activeAttemptKey) {
    activeAttempt = normalizeDeliveryAttempt({
      key: activeAttemptKey,
      attemptNumber: Math.max(1, Number(job?.attempts || 1)),
      state: "pending_ack",
      createdAt:
        job?.activeAttemptCreatedAt ||
        job?.lastAttemptAt ||
        job?.updatedAt ||
        new Date(),
    });
  }

  const trackedAttempts =
    activeAttempt && !normalizedAttempts.some((attempt: any) => attempt.key === activeAttempt.key)
      ? [...normalizedAttempts, activeAttempt].sort(compareDeliveryAttempts)
      : normalizedAttempts;

  const ackWaitUntil = activeAttempt
    ? getDispatchAttemptAckWaitUntil(
        activeAttempt.createdAt ? new Date(activeAttempt.createdAt) : undefined,
        ackWaitMinutes,
      )
    : null;

  const now = Date.now();
  const latestAttempt =
    trackedAttempts.length > 0 ? trackedAttempts[trackedAttempts.length - 1] : null;

  return {
    totalTracked: trackedAttempts.length,
    acceptedCount: trackedAttempts.filter(
      (attempt: any) => attempt.state === "accepted",
    ).length,
    expiredCount: trackedAttempts.filter(
      (attempt: any) => attempt.state === "expired",
    ).length,
    pendingAckCount: trackedAttempts.filter(
      (attempt: any) => attempt.state === "pending_ack",
    ).length,
    latestAttempt,
    activeAttempt,
    awaitingProviderAck: Boolean(
      activeAttempt && ackWaitUntil && ackWaitUntil.getTime() > now,
    ),
    ackWaitUntil: toIsoString(ackWaitUntil),
    recoveredStaleLock: String(job?.error || "")
      .toLowerCase()
      .includes("recovered stale processing lock"),
    history: trackedAttempts,
  };
}

export async function GET(req: NextRequest) {
  await connectDB();
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) return auth.response;
  const { schoolKey } = auth;

  const status = req.nextUrl.searchParams.get("status");
  const academicSectionId =
    req.nextUrl.searchParams.get("academicSectionId")?.trim() || "";
  if (
    academicSectionId &&
    !mongoose.Types.ObjectId.isValid(academicSectionId)
  ) {
    return NextResponse.json(
      { success: false, message: "Invalid academicSectionId" },
      { status: 400 },
    );
  }

  const query: any = { schoolKey };
  if (status && ["queued", "processing", "sent", "failed"].includes(status)) {
    query.status = status;
  }

  const [
    {
      User: UserModel,
      AcademicSection: AcademicSectionModel,
      Class: ClassModel,
    },
    jobs,
  ] = await Promise.all([
    getTenantModels(schoolKey, ["User", "AcademicSection", "Class"]),
    ReportDispatchJob.find(query).sort({ updatedAt: -1 }).limit(500).lean(),
  ]);

  const studentIds = Array.from(
    new Set(jobs.map((job: any) => String(job.student || "")).filter(Boolean)),
  );

  const rawUsers = studentIds.length
    ? await UserModel.find({ _id: { $in: studentIds } })
        .select("name class academicSection")
        .lean()
    : [];

  const users = await hydrateUsersWithAcademicContext({
    users: rawUsers,
    AcademicSectionModel,
    ClassModel,
  });

  const userMap = new Map(users.map((user: any) => [String(user._id), user]));

  const rawSections = await AcademicSectionModel.find({})
    .select("name class")
    .sort({ name: 1 })
    .lean();

  const sections = await hydrateAcademicSectionsWithClasses({
    sections: rawSections,
    ClassModel,
  });

  const enrichedJobs = jobs
    .map((job: any) => {
      const user: any = userMap.get(String(job.student || ""));
      const resolvedClassId = String(
        job.classId || user?.class?._id || user?.class || "",
      );
      const resolvedAcademicSectionId = String(
        job.academicSection ||
          user?.academicSection?._id ||
          user?.academicSection ||
          "",
      );
      return {
        ...job,
        studentName: job.studentName || user?.name || "",
        paperTitle: job.paperTitle || "",
        classId: resolvedClassId || undefined,
        className: job.className || user?.class?.name || "",
        academicSectionId: resolvedAcademicSectionId || undefined,
        academicSectionName:
          job.academicSectionName || user?.academicSection?.name || "",
        providerAcceptedAt: toIsoString(job.providerAcceptedAt),
        deliveredAt: toIsoString(job.deliveredAt),
        readAt: toIsoString(job.readAt),
        lastWebhookAt: toIsoString(job.lastWebhookAt),
        nextRetryAt: toIsoString(job.nextRetryAt),
        processingStartedAt: toIsoString(job.processingStartedAt),
        activeAttemptCreatedAt: toIsoString(job.activeAttemptCreatedAt),
        deliveryAttempts: (Array.isArray(job.deliveryAttempts)
          ? job.deliveryAttempts
          : []
        )
          .map(normalizeDeliveryAttempt)
          .filter(Boolean)
          .sort(compareDeliveryAttempts),
        deliveryAttemptSummary: buildDeliveryAttemptSummary(job),
      };
    })
    .filter((job: any) => {
      if (!academicSectionId) return true;
      return String(job.academicSectionId || "") === academicSectionId;
    })
    .slice(0, 200);

  const academicSections = sections.map((section: any) => ({
    value: String(section._id),
    label: section?.class?.name
      ? `${section.class.name} • ${section.name}`
      : section.name || "Unknown Section",
  }));

  return NextResponse.json({
    success: true,
    jobs: enrichedJobs,
    filters: {
      academicSections,
    },
  });
}
