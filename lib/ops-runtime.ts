import { NextRequest, NextResponse } from "next/server";

import { type AuditActorSnapshot, recordTenantAudit } from "@/lib/audit";

function isTruthyEnv(value: string | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

export function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

export function isProductionDebugRouteEnabled() {
  return (
    !isProductionEnvironment() ||
    isTruthyEnv(process.env.ENABLE_PRODUCTION_DEBUG_ROUTES)
  );
}

export function isProductionAdminMaintenanceEnabled() {
  return (
    !isProductionEnvironment() ||
    isTruthyEnv(process.env.ENABLE_PRODUCTION_ADMIN_MAINTENANCE)
  );
}

export function requireProductionDebugRouteAccess() {
  if (isProductionDebugRouteEnabled()) {
    return null;
  }

  return NextResponse.json(
    { success: false, message: "Not found." },
    { status: 404 },
  );
}

export function requireProductionAdminMaintenanceAccess() {
  if (isProductionAdminMaintenanceEnabled()) {
    return null;
  }

  return NextResponse.json(
    {
      success: false,
      message:
        "Company maintenance routes are disabled in production for safety. Temporarily enable ENABLE_PRODUCTION_ADMIN_MAINTENANCE to use this route.",
    },
    { status: 403 },
  );
}

function readFailureDetails(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const errorCode = (error as Error & { code?: unknown }).code;
    return {
      message: error.message || fallback,
      code:
        typeof errorCode === "string" || typeof errorCode === "number"
          ? String(errorCode)
          : undefined,
      stack: error.stack,
    };
  }

  if (typeof error === "string" && error.trim()) {
    return { message: error, code: undefined, stack: undefined };
  }

  return { message: fallback, code: undefined, stack: undefined };
}

export async function recordTenantAuditSafe(
  params: Parameters<typeof recordTenantAudit>[0],
) {
  try {
    await recordTenantAudit(params);
  } catch (error) {
    console.error("[ops-failure:audit] Tenant audit write failed:", error);
  }
}

export type OpsFailureEntity = {
  type?: string;
  id?: string;
  label?: string;
};

export type OpsFailureSeverity = "error" | "warn";
export type OpsFailureAlertLevel = "none" | "trust_critical";

export type RecordOpsFailureParams = {
  schoolKey?: string;
  req?: NextRequest;
  action: string;
  message?: string;
  error?: unknown;
  metadata?: Record<string, unknown>;
  entity?: OpsFailureEntity;
  severity?: OpsFailureSeverity;
  actor?: AuditActorSnapshot | null;
  alertLevel?: OpsFailureAlertLevel;
};

type OpsAlertPayload = {
  action: string;
  message: string;
  severity: OpsFailureSeverity;
  schoolKey?: string;
  entity?: OpsFailureEntity;
  metadata?: Record<string, unknown>;
  environment: string;
  timestamp: string;
};

function getOpsAlertWebhookUrl() {
  return String(process.env.OPS_ALERT_WEBHOOK_URL || "").trim();
}

function isOpsAlertingEnabled() {
  return Boolean(getOpsAlertWebhookUrl());
}

function shouldSendOpsAlert(
  alertLevel: OpsFailureAlertLevel,
  severity: OpsFailureSeverity,
) {
  if (!isOpsAlertingEnabled() || alertLevel === "none") {
    return false;
  }

  const minSeverity = String(process.env.OPS_ALERT_MIN_SEVERITY || "error")
    .trim()
    .toLowerCase();
  const requiresError = minSeverity !== "warn";
  if (requiresError && severity !== "error") {
    return false;
  }

  return true;
}

async function sendOpsAlert(payload: OpsAlertPayload) {
  const webhookUrl = getOpsAlertWebhookUrl();
  if (!webhookUrl) {
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      console.error("[ops-alert] Webhook returned non-success response:", {
        status: response.status,
        body: responseText,
      });
    }
  } catch (error) {
    console.error("[ops-alert] Failed to deliver webhook alert:", error);
  }
}

export async function recordOpsFailure({
  schoolKey,
  req,
  action,
  message,
  error,
  metadata,
  entity,
  severity = "error",
  actor,
  alertLevel = "none",
}: RecordOpsFailureParams) {
  const fallbackMessage = "Operational failure";
  const details = await readFailureDetails(error, fallbackMessage);
  const normalizedMessage = (message || details.message || fallbackMessage).trim();
  const detailPayload = {
    severity,
    errorMessage: details.message,
    errorCode: details.code,
    errorStack: details.stack,
    ...metadata,
  };

  console.error(`[ops-failure:${action}] ${normalizedMessage}`, detailPayload);

  if (shouldSendOpsAlert(alertLevel, severity)) {
    await sendOpsAlert({
      action,
      message: normalizedMessage,
      severity,
      schoolKey,
      entity,
      metadata: detailPayload,
      environment: String(process.env.NODE_ENV || "unknown"),
      timestamp: new Date().toISOString(),
    });
  }

  if (!schoolKey) {
    return;
  }

  await recordTenantAuditSafe({
    schoolKey,
    req,
    actor,
    entityType: entity?.type || "ops_failure",
    entityId: entity?.id,
    entityLabel: entity?.label,
    action: `ops_failure:${action}`,
    summary: normalizedMessage,
    details: detailPayload,
  });
}
