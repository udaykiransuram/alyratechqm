export type ReportDispatchAttempt = {
  key: string;
  attemptNumber: number;
  state: "pending_ack" | "accepted" | "expired";
  createdAt?: string | null;
  acknowledgedAt?: string | null;
  deliveryStatus?: "accepted" | "sent" | "delivered" | "read" | "failed" | null;
  note?: string | null;
};

export type ReportDispatchAttemptSummary = {
  totalTracked: number;
  acceptedCount: number;
  expiredCount: number;
  pendingAckCount: number;
  awaitingProviderAck: boolean;
  ackWaitUntil?: string | null;
  recoveredStaleLock: boolean;
  latestAttempt?: ReportDispatchAttempt | null;
};

export type ReportJob = {
  _id: string;
  type: "student" | "exam" | "teacher" | "admin";
  status: "queued" | "processing" | "sent" | "failed";
  studentName?: string;
  paperTitle?: string;
  classId?: string;
  className?: string;
  academicSectionId?: string;
  academicSectionName?: string;
  mobileNumber?: string;
  error?: string;
  attempts?: number;
  maxAttempts?: number;
  updatedAt?: string;
  nextRetryAt?: string;
  processingStartedAt?: string;
  providerAcceptedAt?: string;
  providerMessageId?: string;
  deliveryStatus?: "accepted" | "sent" | "delivered" | "read" | "failed";
  deliveryError?: string;
  lastWebhookAt?: string;
  reportUrl?: string;
  deliveryAttemptSummary?: ReportDispatchAttemptSummary;
};

export type ReportFilterOption = {
  value: string;
  label: string;
};

export type TypeFilter = "all" | "student" | "teacher" | "admin" | "exam";
export type ReportScopeFilter = "all" | "benchmark" | "student";
