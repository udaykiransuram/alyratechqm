import mongoose from "mongoose";

import ReportDispatchJob from "@/models/ReportDispatchJob";
import { getTenantModels } from "@/lib/db-tenant";
import {
  hydrateAcademicSectionsWithClasses,
  hydrateUsersWithAcademicContext,
} from "@/lib/analytics/hydrateResponses";
import { getDispatchAttemptAckWaitUntil } from "@/lib/reports/dispatchAttempts";

export const DEFAULT_REPORT_JOB_PAGE_SIZE = 40;
export const MAX_REPORT_JOB_PAGE_SIZE = 100;

const DEFAULT_PROVIDER_ACK_WAIT_MINUTES = 45;
const ACADEMIC_SECTION_OPTIONS_TTL_MS = 5 * 60 * 1000;
const REPORT_JOB_TYPES = ["student", "teacher", "admin", "exam"] as const;
const REPORT_JOB_LIST_SELECT = [
  "_id",
  "type",
  "student",
  "studentName",
  "paperTitle",
  "classId",
  "className",
  "academicSection",
  "academicSectionName",
  "status",
  "mobileNumber",
  "error",
  "attempts",
  "maxAttempts",
  "nextRetryAt",
  "lastAttemptAt",
  "processingStartedAt",
  "activeAttemptKey",
  "activeAttemptCreatedAt",
  "providerAcceptedAt",
  "providerMessageId",
  "deliveryStatus",
  "deliveryError",
  "deliveredAt",
  "readAt",
  "lastWebhookAt",
  "reportUrl",
  "deliveryAttempts.key",
  "deliveryAttempts.attemptNumber",
  "deliveryAttempts.state",
  "deliveryAttempts.createdAt",
  "deliveryAttempts.acknowledgedAt",
  "deliveryAttempts.lastWebhookAt",
  "deliveryAttempts.providerMessageId",
  "deliveryAttempts.deliveryStatus",
  "deliveryAttempts.note",
  "updatedAt",
].join(" ");

export type ReportFilterOption = {
  value: string;
  label: string;
};

type CachedAcademicSectionOptions = {
  expiresAt: number;
  options: ReportFilterOption[];
};

export type ReportJobsQuery = {
  status?: string;
  type?: string;
  scope?: string;
  academicSectionId?: string;
  page?: number;
  limit?: number;
  includeAttemptHistory?: boolean;
  compactView?: boolean;
};

const academicSectionOptionsCache = new Map<
  string,
  CachedAcademicSectionOptions
>();

function createHttpError(message: string, status: number) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
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
  };
}

function jobNeedsAcademicHydration(job: any) {
  const studentId = String(job?.student || "").trim();
  if (!studentId) return false;

  if (!String(job?.studentName || "").trim()) {
    return true;
  }

  if (!String(job?.className || "").trim()) {
    return true;
  }

  if (job?.academicSection && !String(job?.academicSectionName || "").trim()) {
    return true;
  }

  return false;
}

function resolveRequestedJobTypes(requestedType: string, requestedScope: string) {
  let allowedTypes = [...REPORT_JOB_TYPES];

  if (REPORT_JOB_TYPES.includes(requestedType as (typeof REPORT_JOB_TYPES)[number])) {
    allowedTypes = [requestedType as (typeof REPORT_JOB_TYPES)[number]];
  }

  if (requestedScope === "benchmark") {
    allowedTypes = allowedTypes.filter((type) => type !== "student");
  } else if (requestedScope === "student") {
    allowedTypes = allowedTypes.filter((type) => type === "student");
  }

  return allowedTypes;
}

async function getAcademicSectionFilterOptions({
  schoolKey,
  ensureTenantModels,
}: {
  schoolKey: string;
  ensureTenantModels: () => Promise<any>;
}) {
  const now = Date.now();
  const cachedEntry = academicSectionOptionsCache.get(schoolKey);
  if (cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.options;
  }

  const {
    AcademicSection: AcademicSectionModel,
    Class: ClassModel,
  } = await ensureTenantModels();

  const rawSections = await AcademicSectionModel.find({})
    .select("name class")
    .sort({ name: 1 })
    .lean();

  const sections = await hydrateAcademicSectionsWithClasses({
    sections: rawSections,
    ClassModel,
  });

  const options = sections
    .map((section: any) => ({
      value: String(section._id),
      label: section?.class?.name
        ? `${section.class.name} • ${section.name}`
        : section.name || "Unknown Section",
    }))
    .sort((left: ReportFilterOption, right: ReportFilterOption) =>
      left.label.localeCompare(right.label),
    );

  academicSectionOptionsCache.set(schoolKey, {
    expiresAt: now + ACADEMIC_SECTION_OPTIONS_TTL_MS,
    options,
  });

  return options;
}

export async function getReportJobsPageData({
  schoolKey,
  query,
}: {
  schoolKey: string;
  query: ReportJobsQuery;
}) {
  const status = String(query.status || "").trim();
  const requestedType = String(query.type || "").trim();
  const requestedScope = String(query.scope || "").trim();
  const academicSectionId = String(query.academicSectionId || "").trim();
  const includeAttemptHistory = query.includeAttemptHistory === true;
  const compactView = query.compactView === true;
  const limitParam = Number(query.limit || DEFAULT_REPORT_JOB_PAGE_SIZE);
  const limit = Math.min(
    MAX_REPORT_JOB_PAGE_SIZE,
    Math.max(
      Number.isFinite(limitParam) ? Math.floor(limitParam) : DEFAULT_REPORT_JOB_PAGE_SIZE,
      1,
    ),
  );
  const pageParam = Number(query.page || 1);

  if (academicSectionId && !mongoose.Types.ObjectId.isValid(academicSectionId)) {
    throw createHttpError("Invalid academicSectionId", 400);
  }

  const dbQuery: any = { schoolKey };
  if (status && ["queued", "processing", "sent", "failed"].includes(status)) {
    dbQuery.status = status;
  }

  const requestedTypes = resolveRequestedJobTypes(requestedType, requestedScope);
  let tenantModelsPromise: Promise<any> | null = null;
  const ensureTenantModels = () => {
    if (!tenantModelsPromise) {
      tenantModelsPromise = getTenantModels(schoolKey, [
        "User",
        "AcademicSection",
        "Class",
      ]);
    }
    return tenantModelsPromise;
  };

  if (requestedTypes.length === 0) {
    const academicSections = await getAcademicSectionFilterOptions({
      schoolKey,
      ensureTenantModels,
    });

    return {
      jobs: [],
      total: 0,
      page: 1,
      pages: 1,
      limit,
      filters: {
        academicSections,
      },
    };
  }

  if (requestedTypes.length === 1) {
    dbQuery.type = requestedTypes[0];
  } else if (requestedTypes.length > 1 && requestedTypes.length < REPORT_JOB_TYPES.length) {
    dbQuery.type = { $in: requestedTypes };
  }

  if (academicSectionId) {
    const { User: UserModel } = await ensureTenantModels();
    const studentsInSection = await UserModel.find({
      role: "student",
      academicSection: new mongoose.Types.ObjectId(academicSectionId),
    })
      .select("_id")
      .lean();
    const studentIdsInSection = studentsInSection.map((student: any) => student._id);
    const academicSectionClauses: any[] = [
      { academicSection: new mongoose.Types.ObjectId(academicSectionId) },
    ];

    if (studentIdsInSection.length > 0) {
      academicSectionClauses.push(
        {
          academicSection: { $exists: false },
          student: { $in: studentIdsInSection },
        },
        {
          academicSection: null,
          student: { $in: studentIdsInSection },
        },
      );
    }

    dbQuery.$or = academicSectionClauses;
  }

  const [totalCount, academicSections] = await Promise.all([
    ReportDispatchJob.countDocuments(dbQuery),
    getAcademicSectionFilterOptions({ schoolKey, ensureTenantModels }),
  ]);

  const pages = Math.max(1, Math.ceil(totalCount / limit));
  const page = Math.min(
    Math.max(Number.isFinite(pageParam) ? Math.floor(pageParam) : 1, 1),
    pages,
  );
  const skip = (page - 1) * limit;

  const jobs = await ReportDispatchJob.find(dbQuery)
    .select(REPORT_JOB_LIST_SELECT)
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const studentIdsNeedingHydration = Array.from(
    new Set(
      jobs
        .filter(jobNeedsAcademicHydration)
        .map((job: any) => String(job.student || "").trim())
        .filter(Boolean),
    ),
  );

  let userMap = new Map<string, any>();
  if (studentIdsNeedingHydration.length > 0) {
    const {
      User: UserModel,
      AcademicSection: AcademicSectionModel,
      Class: ClassModel,
    } = await ensureTenantModels();

    const rawUsers = await UserModel.find({
      _id: { $in: studentIdsNeedingHydration },
    })
      .select("name class academicSection")
      .lean();

    const users = await hydrateUsersWithAcademicContext({
      users: rawUsers,
      AcademicSectionModel,
      ClassModel,
    });

    userMap = new Map(users.map((user: any) => [String(user._id), user]));
  }

  const enrichedJobs = jobs.map((job: any) => {
    const { deliveryAttempts, ...jobWithoutAttemptHistory } = job;
    const user: any = userMap.get(String(job.student || ""));
    const compactPayload = {
      _id: String(job._id || ""),
      type: job.type,
      status: job.status,
      studentName: job.studentName || user?.name || "",
      paperTitle: job.paperTitle || "",
      className: job.className || user?.class?.name || "",
      academicSectionName:
        job.academicSectionName || user?.academicSection?.name || "",
      mobileNumber: job.mobileNumber || "",
      error: job.error || "",
      attempts: Number(job.attempts || 0),
      maxAttempts: Number(job.maxAttempts || 0),
      providerAcceptedAt: toIsoString(job.providerAcceptedAt),
      providerMessageId: String(job.providerMessageId || "").trim() || undefined,
      deliveryStatus: String(job.deliveryStatus || "").trim() || undefined,
      deliveryError: String(job.deliveryError || "").trim() || undefined,
      lastWebhookAt: toIsoString(job.lastWebhookAt),
      nextRetryAt: toIsoString(job.nextRetryAt),
      processingStartedAt: toIsoString(job.processingStartedAt),
      updatedAt: toIsoString(job.updatedAt),
      reportUrl: String(job.reportUrl || "").trim() || undefined,
      deliveryAttemptSummary: buildDeliveryAttemptSummary(job),
      ...(includeAttemptHistory
        ? {
            deliveryAttempts: Array.isArray(deliveryAttempts) ? deliveryAttempts : [],
          }
        : {}),
    };

    if (compactView) {
      return compactPayload;
    }

    const resolvedClassId = String(job.classId || user?.class?._id || user?.class || "");
    const resolvedAcademicSectionId = String(
      job.academicSection || user?.academicSection?._id || user?.academicSection || "",
    );

    return {
      ...jobWithoutAttemptHistory,
      ...compactPayload,
      classId: resolvedClassId || undefined,
      academicSectionId: resolvedAcademicSectionId || undefined,
      deliveredAt: toIsoString(job.deliveredAt),
      readAt: toIsoString(job.readAt),
      activeAttemptCreatedAt: toIsoString(job.activeAttemptCreatedAt),
    };
  });

  return {
    jobs: enrichedJobs,
    total: totalCount,
    page,
    pages,
    limit,
    filters: {
      academicSections,
    },
  };
}
