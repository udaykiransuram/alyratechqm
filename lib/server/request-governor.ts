import "server-only";

import { createHash } from "crypto";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { recordOpsFailure } from "@/lib/ops-runtime";
import {
  isRedisConfigured,
  isRedisInBackoffWindow,
  runRedisCommand,
  runRedisEval,
} from "@/lib/redis";

export type RequestGovernorScope = "ip" | "user" | "tenant" | "worker";
export type RequestGovernorFailMode = "closed" | "soft";
export type RequestGovernorCostClass =
  | "public_write"
  | "payment"
  | "parse"
  | "convert"
  | "import"
  | "analytics"
  | "report"
  | "worker"
  | "stream";

export type RequestGovernorMetric =
  | "allowed"
  | "soft_allowed"
  | "completed"
  | "failed"
  | "rate_limited"
  | "concurrency_limited"
  | "unavailable";

export type RequestGovernorPolicy = {
  id: string;
  label: string;
  scope: RequestGovernorScope;
  windowMs: number;
  maxRequests: number;
  maxConcurrent: number;
  failMode: RequestGovernorFailMode;
  costClass: RequestGovernorCostClass;
  messages: {
    rateLimited: string;
    concurrencyLimited: string;
    unavailable: string;
  };
  retryAfterSeconds?: number;
  alertThresholds?: Partial<Record<RequestGovernorMetric, number>>;
};

const REQUEST_GOVERNOR_METRIC_FIELDS: RequestGovernorMetric[] = [
  "allowed",
  "soft_allowed",
  "completed",
  "failed",
  "rate_limited",
  "concurrency_limited",
  "unavailable",
];

const REQUEST_GOVERNOR_METRICS_TTL_SECONDS = 7 * 24 * 60 * 60;
const REQUEST_GOVERNOR_ALERT_COOLDOWN_MS = 10 * 60 * 1000;

export const REQUEST_GOVERNOR_POLICIES = {
  contactSend: {
    id: "contact-send",
    label: "Public contact submit",
    scope: "ip",
    windowMs: 15 * 60 * 1000,
    maxRequests: 8,
    maxConcurrent: 2,
    failMode: "closed",
    costClass: "public_write",
    retryAfterSeconds: 15 * 60,
    alertThresholds: {
      rate_limited: 5,
      unavailable: 1,
    },
    messages: {
      rateLimited:
        "Too many contact messages were sent from this network. Please wait a little and try again.",
      concurrencyLimited:
        "The contact form is temporarily busy. Please try again in a moment.",
      unavailable:
        "The contact form is temporarily unavailable. Please retry shortly.",
    },
  },
  summerCrashRegister: {
    id: "summer-crash-register",
    label: "Summer crash course registration",
    scope: "ip",
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    maxConcurrent: 2,
    failMode: "closed",
    costClass: "public_write",
    retryAfterSeconds: 5 * 60,
    alertThresholds: {
      rate_limited: 4,
      unavailable: 1,
    },
    messages: {
      rateLimited:
        "Too many Summer Crash Course registrations were submitted from this network. Please wait a few minutes and try again.",
      concurrencyLimited:
        "Summer Crash Course registration is temporarily busy. Please retry in a moment.",
      unavailable:
        "Summer Crash Course registration is temporarily unavailable. Please retry shortly.",
    },
  },
  summerCrashLookup: {
    id: "summer-crash-lookup",
    label: "Summer crash course ID lookup",
    scope: "ip",
    windowMs: 15 * 60 * 1000,
    maxRequests: 18,
    maxConcurrent: 3,
    failMode: "closed",
    costClass: "public_write",
    retryAfterSeconds: 2 * 60,
    alertThresholds: {
      rate_limited: 6,
      unavailable: 1,
    },
    messages: {
      rateLimited:
        "Too many Summer ID lookups were made from this network. Please wait a little and retry.",
      concurrencyLimited:
        "Summer ID lookup is temporarily busy. Please retry in a moment.",
      unavailable:
        "Summer ID lookup is temporarily unavailable. Please retry shortly.",
    },
  },
  cashfreeRegisterPay: {
    id: "cashfree-register-pay",
    label: "Talent test payment session",
    scope: "ip",
    windowMs: 15 * 60 * 1000,
    maxRequests: 6,
    maxConcurrent: 2,
    failMode: "closed",
    costClass: "payment",
    retryAfterSeconds: 5 * 60,
    alertThresholds: {
      rate_limited: 3,
      unavailable: 1,
    },
    messages: {
      rateLimited:
        "Too many payment session requests were made from this network. Please wait a few minutes and retry.",
      concurrencyLimited:
        "Payment setup is temporarily busy. Please retry in a moment.",
      unavailable:
        "Payment setup is temporarily unavailable. Please retry shortly.",
    },
  },
  parseExtract: {
    id: "parse-extract",
    label: "PDF parse extract",
    scope: "tenant",
    windowMs: 10 * 60 * 1000,
    maxRequests: 18,
    maxConcurrent: 2,
    failMode: "closed",
    costClass: "parse",
    retryAfterSeconds: 60,
    alertThresholds: {
      rate_limited: 3,
      concurrency_limited: 3,
      unavailable: 1,
    },
    messages: {
      rateLimited:
        "This school has hit the temporary PDF parsing limit. Please wait a minute and retry.",
      concurrencyLimited:
        "PDF parsing is already running for this school. Please retry after the current job finishes.",
      unavailable:
        "PDF parsing is temporarily unavailable. Please retry shortly.",
    },
  },
  convertImport: {
    id: "convert-import",
    label: "Spreadsheet convert import",
    scope: "tenant",
    windowMs: 10 * 60 * 1000,
    maxRequests: 18,
    maxConcurrent: 2,
    failMode: "closed",
    costClass: "convert",
    retryAfterSeconds: 60,
    alertThresholds: {
      rate_limited: 3,
      concurrency_limited: 3,
      unavailable: 1,
    },
    messages: {
      rateLimited:
        "This school has hit the temporary conversion limit. Please wait a minute and retry.",
      concurrencyLimited:
        "A conversion is already running for this school. Please retry after the current job finishes.",
      unavailable:
        "Spreadsheet conversion is temporarily unavailable. Please retry shortly.",
    },
  },
  questionImportCreate: {
    id: "question-import-create",
    label: "Question import draft upload",
    scope: "tenant",
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    maxConcurrent: 2,
    failMode: "closed",
    costClass: "import",
    retryAfterSeconds: 60,
    alertThresholds: {
      rate_limited: 3,
      concurrency_limited: 3,
      unavailable: 1,
    },
    messages: {
      rateLimited:
        "This school has hit the temporary import upload limit. Please wait and retry.",
      concurrencyLimited:
        "An import upload is already running for this school. Please retry after the current job finishes.",
      unavailable:
        "Question import uploads are temporarily unavailable. Please retry shortly.",
    },
  },
  questionImportPublish: {
    id: "question-import-publish",
    label: "Question import publish",
    scope: "tenant",
    windowMs: 10 * 60 * 1000,
    maxRequests: 6,
    maxConcurrent: 1,
    failMode: "closed",
    costClass: "import",
    retryAfterSeconds: 60,
    alertThresholds: {
      rate_limited: 2,
      concurrency_limited: 2,
      unavailable: 1,
    },
    messages: {
      rateLimited:
        "This school has hit the temporary import publish limit. Please wait and retry.",
      concurrencyLimited:
        "An import publish is already running for this school. Please retry after it finishes.",
      unavailable:
        "Question import publishing is temporarily unavailable. Please retry shortly.",
    },
  },
  analyticsClassTagReport: {
    id: "analytics-class-tag-report",
    label: "Class tag report analytics",
    scope: "tenant",
    windowMs: 5 * 60 * 1000,
    maxRequests: 18,
    maxConcurrent: 2,
    failMode: "closed",
    costClass: "analytics",
    retryAfterSeconds: 60,
    alertThresholds: {
      rate_limited: 3,
      concurrency_limited: 3,
      unavailable: 1,
    },
    messages: {
      rateLimited:
        "This school has hit the temporary analytics limit. Please wait and retry.",
      concurrencyLimited:
        "Analytics generation is already running for this school. Please retry shortly.",
      unavailable:
        "Analytics generation is temporarily unavailable. Please retry shortly.",
    },
  },
  analyticsStudentTagReport: {
    id: "analytics-student-tag-report",
    label: "Student tag report analytics",
    scope: "tenant",
    windowMs: 5 * 60 * 1000,
    maxRequests: 18,
    maxConcurrent: 2,
    failMode: "closed",
    costClass: "analytics",
    retryAfterSeconds: 60,
    alertThresholds: {
      rate_limited: 3,
      concurrency_limited: 3,
      unavailable: 1,
    },
    messages: {
      rateLimited:
        "This school has hit the temporary analytics limit. Please wait and retry.",
      concurrencyLimited:
        "Analytics generation is already running for this school. Please retry shortly.",
      unavailable:
        "Analytics generation is temporarily unavailable. Please retry shortly.",
    },
  },
  analyticsBenchmarkReport: {
    id: "analytics-benchmark-report",
    label: "Benchmark report analytics",
    scope: "tenant",
    windowMs: 5 * 60 * 1000,
    maxRequests: 18,
    maxConcurrent: 2,
    failMode: "closed",
    costClass: "analytics",
    retryAfterSeconds: 60,
    alertThresholds: {
      rate_limited: 3,
      concurrency_limited: 3,
      unavailable: 1,
    },
    messages: {
      rateLimited:
        "This school has hit the temporary analytics limit. Please wait and retry.",
      concurrencyLimited:
        "Analytics generation is already running for this school. Please retry shortly.",
      unavailable:
        "Analytics generation is temporarily unavailable. Please retry shortly.",
    },
  },
  reportDispatchSend: {
    id: "report-dispatch-send",
    label: "Report dispatch enqueue",
    scope: "tenant",
    windowMs: 15 * 60 * 1000,
    maxRequests: 6,
    maxConcurrent: 1,
    failMode: "closed",
    costClass: "report",
    retryAfterSeconds: 60,
    alertThresholds: {
      rate_limited: 2,
      concurrency_limited: 2,
      unavailable: 1,
    },
    messages: {
      rateLimited:
        "This school has hit the temporary report dispatch limit. Please wait and retry.",
      concurrencyLimited:
        "A report dispatch run is already in progress for this school. Please retry after it finishes.",
      unavailable:
        "Report dispatch is temporarily unavailable. Please retry shortly.",
    },
  },
  reportDispatchWorker: {
    id: "report-dispatch-worker",
    label: "Report dispatch worker trigger",
    scope: "worker",
    windowMs: 5 * 60 * 1000,
    maxRequests: 20,
    maxConcurrent: 2,
    failMode: "closed",
    costClass: "worker",
    retryAfterSeconds: 30,
    alertThresholds: {
      rate_limited: 2,
      concurrency_limited: 2,
      unavailable: 1,
    },
    messages: {
      rateLimited:
        "Report worker triggers are temporarily rate limited. Please retry shortly.",
      concurrencyLimited:
        "Report workers are already running at the safe limit. Please retry shortly.",
      unavailable:
        "Report worker coordination is temporarily unavailable. Please retry shortly.",
    },
  },
  studentNotificationWorker: {
    id: "student-notification-worker",
    label: "Student notification worker trigger",
    scope: "worker",
    windowMs: 5 * 60 * 1000,
    maxRequests: 30,
    maxConcurrent: 2,
    failMode: "closed",
    costClass: "worker",
    retryAfterSeconds: 30,
    alertThresholds: {
      rate_limited: 2,
      concurrency_limited: 2,
      unavailable: 1,
    },
    messages: {
      rateLimited:
        "Notification worker triggers are temporarily rate limited. Please retry shortly.",
      concurrencyLimited:
        "Notification workers are already running at the safe limit. Please retry shortly.",
      unavailable:
        "Notification worker coordination is temporarily unavailable. Please retry shortly.",
    },
  },
  studentNotificationStream: {
    id: "student-notification-stream",
    label: "Student notification stream",
    scope: "user",
    windowMs: 60 * 60 * 1000,
    maxRequests: 24,
    maxConcurrent: 2,
    failMode: "closed",
    costClass: "stream",
    retryAfterSeconds: 15,
    alertThresholds: {
      rate_limited: 3,
      concurrency_limited: 3,
      unavailable: 1,
    },
    messages: {
      rateLimited:
        "Too many notification stream connections were opened. Please retry in a moment.",
      concurrencyLimited:
        "This account already has the maximum number of open notification streams.",
      unavailable:
        "Live notification updates are temporarily unavailable. Please retry shortly.",
    },
  },
} as const satisfies Record<string, RequestGovernorPolicy>;

export type RequestGovernorPolicyKey = keyof typeof REQUEST_GOVERNOR_POLICIES;

export type RequestGovernorRouteContext = {
  request: Request;
  policy:
    | RequestGovernorPolicyKey
    | RequestGovernorPolicy;
  schoolKey?: string | null;
  userId?: string | null;
  scopeId?: string | null;
  metadata?: Record<string, unknown>;
};

type RequestGovernorMetricContext = Omit<RequestGovernorRouteContext, "policy">;

export type RequestGovernorLease = {
  policy: RequestGovernorPolicy;
  scopeKey: string;
  release: (
    outcome?: "completed" | "failed",
    metadata?: Record<string, unknown>,
  ) => Promise<void>;
};

export type RequestGovernorSuccess = {
  ok: true;
  policy: RequestGovernorPolicy;
  scopeKey: string;
  lease: RequestGovernorLease;
};

export type RequestGovernorFailure = {
  ok: false;
  policy: RequestGovernorPolicy;
  scopeKey: string;
  reason: "rate_limited" | "concurrency_limited" | "unavailable";
  response: NextResponse;
};

export type RequestGovernorResult =
  | RequestGovernorSuccess
  | RequestGovernorFailure;

export type RequestGovernorPolicyHealth = {
  id: string;
  label: string;
  scope: RequestGovernorScope;
  costClass: RequestGovernorCostClass;
  failMode: RequestGovernorFailMode;
  windowMs: number;
  maxRequests: number;
  maxConcurrent: number;
  active: number;
  allowed: number;
  softAllowed: number;
  completed: number;
  failed: number;
  rateLimited: number;
  concurrencyLimited: number;
  unavailable: number;
  updatedAt: string | null;
};

export type RequestGovernorHealthSnapshot = {
  configured: boolean;
  temporarilyUnavailable: boolean;
  totals: {
    active: number;
    allowed: number;
    softAllowed: number;
    completed: number;
    failed: number;
    rateLimited: number;
    concurrencyLimited: number;
    unavailable: number;
  };
  policies: RequestGovernorPolicyHealth[];
};

type RequestGovernorAcquireState =
  | "allowed"
  | "rate_limited"
  | "concurrency_limited"
  | "unavailable";

function buildCounterKey(policyId: string, scopeKey: string) {
  return `request-governor:count:${policyId}:${scopeKey}`;
}

function buildScopeActiveKey(policyId: string, scopeKey: string) {
  return `request-governor:active:${policyId}:${scopeKey}`;
}

function buildGlobalActiveKey(policyId: string) {
  return `request-governor:active:${policyId}:all`;
}

function buildMetricsKey(policyId: string) {
  return `request-governor:metrics:${policyId}`;
}

function resolvePolicy(
  policyInput: RequestGovernorPolicyKey | RequestGovernorPolicy,
) {
  if (typeof policyInput === "string") {
    return REQUEST_GOVERNOR_POLICIES[policyInput];
  }

  return policyInput;
}

function hashScopeValue(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function normalizeScopeSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function readClientIp(request: Request) {
  const forwardedFor = String(
    request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      "",
  ).trim();

  if (!forwardedFor) {
    return "unknown";
  }

  return forwardedFor.split(",")[0]?.trim() || "unknown";
}

function buildScopeKey(
  policy: RequestGovernorPolicy,
  context: RequestGovernorMetricContext | RequestGovernorRouteContext,
) {
  const override = String(context.scopeId || "").trim();
  if (override) {
    return `${policy.scope}:${hashScopeValue(override)}`;
  }

  if (policy.scope === "tenant") {
    const schoolKey = normalizeScopeSegment(String(context.schoolKey || ""));
    return `${policy.scope}:${schoolKey || "unknown"}`;
  }

  if (policy.scope === "user") {
    const userId = normalizeScopeSegment(String(context.userId || ""));
    const schoolKey = normalizeScopeSegment(String(context.schoolKey || ""));
    return `${policy.scope}:${schoolKey || "unknown"}:${userId || "unknown"}`;
  }

  if (policy.scope === "worker") {
    const schoolKey = normalizeScopeSegment(String(context.schoolKey || ""));
    return `${policy.scope}:${schoolKey || "global"}`;
  }

  return `${policy.scope}:${hashScopeValue(readClientIp(context.request))}`;
}

function getAlertState() {
  const globalState = globalThis as typeof globalThis & {
    __requestGovernorAlertState?: Map<string, number>;
  };

  if (!globalState.__requestGovernorAlertState) {
    globalState.__requestGovernorAlertState = new Map();
  }

  return globalState.__requestGovernorAlertState;
}

async function incrementPolicyMetric(
  policy: RequestGovernorPolicy,
  metric: RequestGovernorMetric,
  value = 1,
  metadata?: Record<string, unknown>,
) {
  if (!isRedisConfigured()) {
    return null;
  }

  const metricsKey = buildMetricsKey(policy.id);
  const nextCount = await runRedisCommand<number>([
    "HINCRBY",
    metricsKey,
    metric,
    value,
  ]);
  const updatedAt = new Date().toISOString();

  await runRedisCommand([
    "HSET",
    metricsKey,
    "updated_at",
    updatedAt,
    "last_metric",
    metric,
    "policy_label",
    policy.label,
    "policy_scope",
    policy.scope,
    "policy_cost_class",
    policy.costClass,
    ...(metadata?.statusCode != null
      ? ["last_status_code", String(metadata.statusCode)]
      : []),
    ...(metadata?.durationMs != null
      ? ["last_duration_ms", String(metadata.durationMs)]
      : []),
  ]);
  await runRedisCommand([
    "EXPIRE",
    metricsKey,
    REQUEST_GOVERNOR_METRICS_TTL_SECONDS,
  ]);

  return typeof nextCount === "number" ? nextCount : null;
}

async function maybeSendGovernorAlert(
  policy: RequestGovernorPolicy,
  metric: RequestGovernorMetric,
  count: number | null,
  context: RequestGovernorRouteContext,
) {
  const threshold = Number(policy.alertThresholds?.[metric] || 0);
  if (!threshold) {
    return;
  }

  if (count !== null && count < threshold) {
    return;
  }

  const schoolKey = String(context.schoolKey || "").trim() || undefined;
  const alertKey = `${policy.id}:${metric}:${schoolKey || "global"}`;
  const alertState = getAlertState();
  const now = Date.now();
  const lastAlertAt = alertState.get(alertKey) || 0;
  if (now - lastAlertAt < REQUEST_GOVERNOR_ALERT_COOLDOWN_MS) {
    return;
  }

  alertState.set(alertKey, now);
  await recordOpsFailure({
    schoolKey,
    action: `request_governor:${policy.id}:${metric}`,
    message: `Request governor triggered ${metric.replace(/_/g, " ")} for ${policy.label}.`,
    metadata: {
      count,
      policyId: policy.id,
      policyScope: policy.scope,
      costClass: policy.costClass,
      failMode: policy.failMode,
      route: new URL(context.request.url).pathname,
      scopeKey: buildScopeKey(policy, context),
      ...context.metadata,
    },
    severity: metric === "unavailable" ? "error" : "warn",
    alertLevel: "trust_critical",
  });
}

export async function recordExpensiveRouteUsage(
  policyInput: RequestGovernorPolicyKey | RequestGovernorPolicy,
  metric: RequestGovernorMetric,
  context: RequestGovernorMetricContext,
) {
  const policy = resolvePolicy(policyInput);
  const count = await incrementPolicyMetric(policy, metric, 1, context.metadata);
  await maybeSendGovernorAlert(policy, metric, count, {
    ...context,
    policy,
  });
  return count;
}

async function acquirePolicyLease(
  policy: RequestGovernorPolicy,
  scopeKey: string,
) {
  const windowSeconds = Math.max(1, Math.ceil(policy.windowMs / 1000));
  const activeTtlSeconds = Math.max(windowSeconds, 5 * 60);
  const result = await runRedisEval<Array<number | string>>(
    [
      "local nextCount = 0",
      "if tonumber(ARGV[2]) > 0 then",
      "  nextCount = redis.call('INCR', KEYS[1])",
      "  if nextCount == 1 then",
      "    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))",
      "  end",
      "  if nextCount > tonumber(ARGV[2]) then",
      "    return {-1, nextCount, tonumber(redis.call('GET', KEYS[3]) or '0')}",
      "  end",
      "end",
      "local globalActive = tonumber(redis.call('GET', KEYS[3]) or '0')",
      "if tonumber(ARGV[4]) > 0 then",
      "  local scopeActive = redis.call('INCR', KEYS[2])",
      "  if scopeActive == 1 then",
      "    redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))",
      "  end",
      "  globalActive = redis.call('INCR', KEYS[3])",
      "  if globalActive == 1 then",
      "    redis.call('EXPIRE', KEYS[3], tonumber(ARGV[3]))",
      "  end",
      "  if scopeActive > tonumber(ARGV[4]) then",
      "    redis.call('DECR', KEYS[2])",
      "    redis.call('DECR', KEYS[3])",
      "    return {-2, nextCount, tonumber(redis.call('GET', KEYS[3]) or '0')}",
      "  end",
      "end",
      "return {1, nextCount, globalActive}",
    ].join("\n"),
    [
      buildCounterKey(policy.id, scopeKey),
      buildScopeActiveKey(policy.id, scopeKey),
      buildGlobalActiveKey(policy.id),
    ],
    [
      windowSeconds,
      policy.maxRequests,
      activeTtlSeconds,
      policy.maxConcurrent,
    ],
  );

  if (!Array.isArray(result) || result.length < 3) {
    return null;
  }

  return {
    state:
      Number(result[0]) === -1
        ? ("rate_limited" as const)
        : Number(result[0]) === -2
          ? ("concurrency_limited" as const)
          : ("allowed" as const),
    count: Number(result[1] || 0),
    active: Number(result[2] || 0),
    activeTtlSeconds,
  };
}

async function releasePolicyLease(
  policy: RequestGovernorPolicy,
  scopeKey: string,
) {
  if (!isRedisConfigured()) {
    return;
  }

  await runRedisEval(
    [
      "local scopeCurrent = tonumber(redis.call('GET', KEYS[1]) or '0')",
      "if scopeCurrent > 0 then",
      "  scopeCurrent = redis.call('DECR', KEYS[1])",
      "else",
      "  scopeCurrent = 0",
      "end",
      "local globalCurrent = tonumber(redis.call('GET', KEYS[2]) or '0')",
      "if globalCurrent > 0 then",
      "  globalCurrent = redis.call('DECR', KEYS[2])",
      "else",
      "  globalCurrent = 0",
      "end",
      "if tonumber(scopeCurrent) <= 0 then",
      "  redis.call('DEL', KEYS[1])",
      "end",
      "if tonumber(globalCurrent) <= 0 then",
      "  redis.call('DEL', KEYS[2])",
      "end",
      "return {math.max(scopeCurrent, 0), math.max(globalCurrent, 0)}",
    ].join("\n"),
    [buildScopeActiveKey(policy.id, scopeKey), buildGlobalActiveKey(policy.id)],
    [],
  );
}

function buildGovernorResponse(
  policy: RequestGovernorPolicy,
  scopeKey: string,
  reason: Exclude<RequestGovernorAcquireState, "allowed">,
) {
  const status =
    reason === "unavailable"
      ? policy.failMode === "soft"
        ? 200
        : 503
      : 429;
  const message =
    reason === "rate_limited"
      ? policy.messages.rateLimited
      : reason === "concurrency_limited"
        ? policy.messages.concurrencyLimited
        : policy.messages.unavailable;
  const retryAfterSeconds =
    reason === "concurrency_limited"
      ? Math.max(5, policy.retryAfterSeconds || 15)
      : Math.max(5, policy.retryAfterSeconds || Math.ceil(policy.windowMs / 1000));

  return NextResponse.json(
    {
      success: false,
      message,
      retryable: true,
      code: `REQUEST_GOVERNOR_${reason.toUpperCase()}`,
      policy: {
        id: policy.id,
        label: policy.label,
        scope: policy.scope,
        costClass: policy.costClass,
      },
      budget: {
        windowMs: policy.windowMs,
        maxRequests: policy.maxRequests,
        maxConcurrent: policy.maxConcurrent,
      },
    },
    {
      status,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-Request-Governor-Policy": policy.id,
        "X-Request-Governor-Scope": scopeKey,
      },
    },
  );
}

export async function enforceRequestBudget(
  context: RequestGovernorRouteContext,
): Promise<RequestGovernorResult> {
  const policy = resolvePolicy(context.policy);
  const scopeKey = buildScopeKey(policy, context);

  if (!isRedisConfigured() || isRedisInBackoffWindow()) {
    await recordExpensiveRouteUsage(policy, "unavailable", {
      ...context,
      scopeId: scopeKey,
    });
    if (policy.failMode === "soft") {
      await recordExpensiveRouteUsage(policy, "soft_allowed", {
        ...context,
        scopeId: scopeKey,
      });
      return {
        ok: true,
        policy,
        scopeKey,
        lease: {
          policy,
          scopeKey,
          release: async (outcome = "completed", metadata) => {
            await recordExpensiveRouteUsage(policy, outcome, {
              ...context,
              scopeId: scopeKey,
              metadata,
            });
          },
        },
      };
    }

    return {
      ok: false,
      policy,
      scopeKey,
      reason: "unavailable",
      response: buildGovernorResponse(policy, scopeKey, "unavailable"),
    };
  }

  const acquired = await acquirePolicyLease(policy, scopeKey);
  if (!acquired) {
    await recordExpensiveRouteUsage(policy, "unavailable", {
      ...context,
      scopeId: scopeKey,
    });
    return {
      ok: false,
      policy,
      scopeKey,
      reason: "unavailable",
      response: buildGovernorResponse(policy, scopeKey, "unavailable"),
    };
  }

  if (acquired.state === "rate_limited") {
    await recordExpensiveRouteUsage(policy, "rate_limited", {
      ...context,
      scopeId: scopeKey,
    });
    return {
      ok: false,
      policy,
      scopeKey,
      reason: "rate_limited",
      response: buildGovernorResponse(policy, scopeKey, "rate_limited"),
    };
  }

  if (acquired.state === "concurrency_limited") {
    await recordExpensiveRouteUsage(policy, "concurrency_limited", {
      ...context,
      scopeId: scopeKey,
    });
    return {
      ok: false,
      policy,
      scopeKey,
      reason: "concurrency_limited",
      response: buildGovernorResponse(policy, scopeKey, "concurrency_limited"),
    };
  }

  await recordExpensiveRouteUsage(policy, "allowed", {
    ...context,
    scopeId: scopeKey,
  });

  let released = false;
  return {
    ok: true,
    policy,
    scopeKey,
    lease: {
      policy,
      scopeKey,
      release: async (outcome = "completed", metadata) => {
        if (released) {
          return;
        }
        released = true;
        await releasePolicyLease(policy, scopeKey);
        await recordExpensiveRouteUsage(policy, outcome, {
          ...context,
          scopeId: scopeKey,
          metadata,
        });
      },
    },
  };
}

export async function withRequestBudget(
  context: RequestGovernorRouteContext,
  handler: (result: RequestGovernorSuccess) => Promise<Response>,
) {
  const guarded = await enforceRequestBudget(context);
  if (!guarded.ok) {
    return guarded.response;
  }

  const startedAt = Date.now();

  try {
    const response = await handler(guarded);
    await guarded.lease.release(
      response.status >= 500 ? "failed" : "completed",
      {
        durationMs: Date.now() - startedAt,
        statusCode: response.status,
      },
    );
    return response;
  } catch (error) {
    await guarded.lease.release("failed", {
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

function parseMetricValue(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseUpdatedAt(value: string | number | null | undefined) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return null;
}

export async function getRequestGovernorHealthSnapshot(): Promise<RequestGovernorHealthSnapshot> {
  const configured = isRedisConfigured();
  const temporarilyUnavailable = isRedisInBackoffWindow();
  const policies = await Promise.all(
    Object.values(REQUEST_GOVERNOR_POLICIES).map(async (policy) => {
      const metricValues =
        configured && !temporarilyUnavailable
          ? await runRedisCommand<Array<string | number | null>>([
              "HMGET",
              buildMetricsKey(policy.id),
              ...REQUEST_GOVERNOR_METRIC_FIELDS,
              "updated_at",
            ])
          : null;
      const activeValue =
        configured && !temporarilyUnavailable
          ? await runRedisCommand<string | number>([
              "GET",
              buildGlobalActiveKey(policy.id),
            ])
          : null;

      const [
        allowed,
        softAllowed,
        completed,
        failed,
        rateLimited,
        concurrencyLimited,
        unavailable,
        updatedAt,
      ] = Array.isArray(metricValues)
        ? metricValues
        : [0, 0, 0, 0, 0, 0, 0, null];

      return {
        id: policy.id,
        label: policy.label,
        scope: policy.scope,
        costClass: policy.costClass,
        failMode: policy.failMode,
        windowMs: policy.windowMs,
        maxRequests: policy.maxRequests,
        maxConcurrent: policy.maxConcurrent,
        active: parseMetricValue(activeValue),
        allowed: parseMetricValue(allowed),
        softAllowed: parseMetricValue(softAllowed),
        completed: parseMetricValue(completed),
        failed: parseMetricValue(failed),
        rateLimited: parseMetricValue(rateLimited),
        concurrencyLimited: parseMetricValue(concurrencyLimited),
        unavailable: parseMetricValue(unavailable),
        updatedAt: parseUpdatedAt(updatedAt),
      } satisfies RequestGovernorPolicyHealth;
    }),
  );

  return {
    configured,
    temporarilyUnavailable,
    totals: policies.reduce(
      (totals, policy) => ({
        active: totals.active + policy.active,
        allowed: totals.allowed + policy.allowed,
        softAllowed: totals.softAllowed + policy.softAllowed,
        completed: totals.completed + policy.completed,
        failed: totals.failed + policy.failed,
        rateLimited: totals.rateLimited + policy.rateLimited,
        concurrencyLimited:
          totals.concurrencyLimited + policy.concurrencyLimited,
        unavailable: totals.unavailable + policy.unavailable,
      }),
      {
        active: 0,
        allowed: 0,
        softAllowed: 0,
        completed: 0,
        failed: 0,
        rateLimited: 0,
        concurrencyLimited: 0,
        unavailable: 0,
      },
    ),
    policies,
  };
}

export function hashSensitiveScopeValue(value: string) {
  return hashScopeValue(value);
}

export function isNextRequest(value: Request): value is NextRequest {
  return "nextUrl" in value;
}
