import crypto from "crypto";

const MAX_DELIVERY_ATTEMPT_HISTORY = 12;

type MutableReportDispatchJob = {
  _id?: unknown;
  attempts?: number;
  status?: string;
  nextRetryAt?: Date;
  processingStartedAt?: Date;
  activeAttemptKey?: string;
  activeAttemptCreatedAt?: Date;
  providerAcceptedAt?: Date;
  providerMessageId?: string;
  deliveryStatus?: string;
  deliveryError?: string;
  deliveredAt?: Date;
  readAt?: Date;
  lastWebhookAt?: Date;
  deliveryAttempts?: Array<Record<string, any>>;
};

function normalizeAttempts(job: MutableReportDispatchJob) {
  if (!Array.isArray(job.deliveryAttempts)) {
    job.deliveryAttempts = [];
  }

  return job.deliveryAttempts;
}

function trimAttempts(job: MutableReportDispatchJob) {
  const attempts = normalizeAttempts(job);

  while (attempts.length > MAX_DELIVERY_ATTEMPT_HISTORY) {
    const removableIndex = attempts.findIndex(
      (attempt) => attempt?.key !== job.activeAttemptKey,
    );

    if (removableIndex < 0) {
      break;
    }

    attempts.splice(removableIndex, 1);
  }
}

export function buildReportDispatchAttemptKey(jobId: string) {
  return `rdj_${jobId}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function findDeliveryAttemptByKey(
  job: MutableReportDispatchJob,
  key: string,
) {
  if (!key) return null;
  return (
    normalizeAttempts(job).find(
      (attempt) => String(attempt?.key || "").trim() === key,
    ) || null
  );
}

export function findDeliveryAttemptByProviderMessageId(
  job: MutableReportDispatchJob,
  providerMessageId: string,
) {
  if (!providerMessageId) return null;
  return (
    normalizeAttempts(job).find(
      (attempt) =>
        String(attempt?.providerMessageId || "").trim() === providerMessageId,
    ) || null
  );
}

export function getDispatchAttemptAckWaitUntil(
  createdAt: Date | undefined,
  ackWaitMinutes: number,
) {
  const baseTime = createdAt ? new Date(createdAt) : null;
  if (!baseTime || Number.isNaN(baseTime.getTime())) {
    return null;
  }

  return new Date(baseTime.getTime() + ackWaitMinutes * 60 * 1000);
}

export function createPendingDeliveryAttempt(
  job: MutableReportDispatchJob,
  createdAt: Date,
) {
  const attemptKey = buildReportDispatchAttemptKey(String(job._id || "job"));
  const attempts = normalizeAttempts(job);

  attempts.push({
    key: attemptKey,
    attemptNumber: Math.max(1, Number(job.attempts || 0)),
    state: "pending_ack",
    createdAt,
  });

  job.activeAttemptKey = attemptKey;
  job.activeAttemptCreatedAt = createdAt;
  trimAttempts(job);

  return attemptKey;
}

export function expireActiveDeliveryAttempt(
  job: MutableReportDispatchJob,
  note: string,
  at = new Date(),
) {
  const activeAttemptKey = String(job.activeAttemptKey || "").trim();
  if (!activeAttemptKey) {
    return false;
  }

  let attempt = findDeliveryAttemptByKey(job, activeAttemptKey);

  if (!attempt) {
    attempt = {
      key: activeAttemptKey,
      attemptNumber: Math.max(1, Number(job.attempts || 0)),
      state: "pending_ack",
      createdAt: job.activeAttemptCreatedAt || at,
    };
    normalizeAttempts(job).push(attempt);
  }

  attempt.state = "expired";
  attempt.note = note;

  job.activeAttemptKey = undefined;
  job.activeAttemptCreatedAt = undefined;
  trimAttempts(job);
  return true;
}

export function markDeliveryAttemptAccepted(
  job: MutableReportDispatchJob,
  {
    attemptKey,
    providerMessageId,
    acceptedAt,
    deliveryStatus = "accepted",
  }: {
    attemptKey: string;
    providerMessageId?: string;
    acceptedAt: Date;
    deliveryStatus?: "accepted" | "sent" | "delivered" | "read" | "failed";
  },
) {
  let attempt = findDeliveryAttemptByKey(job, attemptKey);

  if (!attempt) {
    const attempts = normalizeAttempts(job);
    attempt = {
      key: attemptKey,
      attemptNumber: Math.max(1, Number(job.attempts || 0)),
      state: "accepted",
      createdAt: job.activeAttemptCreatedAt || acceptedAt,
    };
    attempts.push(attempt);
  }

  attempt.state = "accepted";
  attempt.acknowledgedAt = acceptedAt;
  attempt.deliveryStatus = deliveryStatus;
  if (providerMessageId) {
    attempt.providerMessageId = providerMessageId;
  }

  job.activeAttemptKey = undefined;
  job.activeAttemptCreatedAt = undefined;
  job.providerAcceptedAt = acceptedAt;
  if (providerMessageId) {
    job.providerMessageId = providerMessageId;
  }
  job.deliveryStatus = deliveryStatus;
  if (deliveryStatus !== "failed") {
    job.deliveryError = undefined;
  }
  trimAttempts(job);
}

export function applyDeliveryWebhookUpdate(
  job: MutableReportDispatchJob,
  {
    attemptKey,
    providerMessageId,
    deliveryStatus,
    errorMessage,
    webhookAt,
  }: {
    attemptKey?: string;
    providerMessageId?: string;
    deliveryStatus: "sent" | "delivered" | "read" | "failed";
    errorMessage?: string;
    webhookAt: Date;
  },
) {
  let attempt =
    (attemptKey ? findDeliveryAttemptByKey(job, attemptKey) : null) ||
    (providerMessageId
      ? findDeliveryAttemptByProviderMessageId(job, providerMessageId)
      : null);

  if (!attempt && attemptKey) {
    const attempts = normalizeAttempts(job);
    attempt = {
      key: attemptKey,
      attemptNumber: Math.max(1, Number(job.attempts || 0)),
      state: "accepted",
      createdAt: job.activeAttemptCreatedAt || webhookAt,
    };
    attempts.push(attempt);
  }

  if (attempt) {
    attempt.state = "accepted";
    attempt.lastWebhookAt = webhookAt;
    attempt.deliveryStatus = deliveryStatus;
    attempt.acknowledgedAt = attempt.acknowledgedAt || webhookAt;
    if (providerMessageId && !attempt.providerMessageId) {
      attempt.providerMessageId = providerMessageId;
    }
    if (errorMessage) {
      attempt.note = errorMessage;
    }
  } else if (!providerMessageId && !attemptKey) {
    return false;
  }

  if (attemptKey && String(job.activeAttemptKey || "").trim() === attemptKey) {
    job.activeAttemptKey = undefined;
    job.activeAttemptCreatedAt = undefined;
  }

  job.processingStartedAt = undefined;
  job.nextRetryAt = undefined;
  if (
    job.status === "queued" ||
    job.status === "processing" ||
    job.status === "failed"
  ) {
    job.status = "sent";
  }
  if (providerMessageId && !job.providerMessageId) {
    job.providerMessageId = providerMessageId;
  }
  job.providerAcceptedAt = job.providerAcceptedAt || webhookAt;
  job.deliveryStatus = deliveryStatus;
  job.lastWebhookAt = webhookAt;

  if (deliveryStatus === "delivered") {
    job.deliveredAt = webhookAt;
    job.deliveryError = undefined;
  } else if (deliveryStatus === "read") {
    job.readAt = webhookAt;
    job.deliveryError = undefined;
  } else if (deliveryStatus === "sent") {
    job.deliveryError = undefined;
  } else if (deliveryStatus === "failed") {
    job.deliveryError = errorMessage || "WhatsApp delivery failed";
  }

  trimAttempts(job);
  return true;
}
