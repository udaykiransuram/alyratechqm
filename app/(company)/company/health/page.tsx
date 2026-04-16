import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Database,
  LockKeyhole,
  ServerCog,
  ShieldAlert,
} from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import type { DependencyStatus, SystemHealthSnapshot } from "@/lib/server/system-health";
import { getSystemHealthSnapshot } from "@/lib/server/system-health";

import RefreshHealthButton from "./RefreshHealthButton";


function getStatusVariant(status: DependencyStatus | "healthy" | "degraded") {
  if (status === "up" || status === "healthy") return "success" as const;
  if (status === "not_configured") return "warning" as const;
  return "destructive" as const;
}

function getStatusLabel(status: DependencyStatus | "healthy" | "degraded") {
  if (status === "up") return "Up";
  if (status === "down") return "Down";
  if (status === "not_configured") return "Not configured";
  if (status === "healthy") return "Healthy";
  return "Degraded";
}

function formatLatency(value: number | null | undefined) {
  if (!Number.isFinite(value as number) || value == null) {
    return "—";
  }

  return `${value} ms`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatCount(value: number | null | undefined) {
  if (!Number.isFinite(value as number) || value == null) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN").format(value);
}

function formatMemory(value: number | null | undefined) {
  if (!Number.isFinite(value as number) || value == null) {
    return "—";
  }

  return `${value} MB`;
}

function formatHitRate(hits: number, misses: number) {
  const total = Number(hits || 0) + Number(misses || 0);
  if (total <= 0) {
    return "—";
  }

  return `${Math.round((Number(hits || 0) / total) * 100)}%`;
}

function formatWindow(value: number | null | undefined) {
  if (!Number.isFinite(value as number) || value == null || value <= 0) {
    return "—";
  }

  if (value >= 60 * 60 * 1000) {
    return `${Math.round(value / (60 * 60 * 1000))}h`;
  }

  return `${Math.round(value / (60 * 1000))}m`;
}

function getMongoReadyStateLabel(readyState: number | null) {
  if (readyState === 1) return "Connected";
  if (readyState === 2) return "Connecting";
  if (readyState === 3) return "Disconnecting";
  if (readyState === 0) return "Disconnected";
  return "Unknown";
}

function getOverviewTone(health: SystemHealthSnapshot) {
  const hasPartialConfiguration =
    health.examRuntime.status === "not_configured" ||
    health.redis.status === "not_configured" ||
    health.redis.lock.status === "not_configured";

  if (health.ok && !hasPartialConfiguration) {
    return {
      status: "healthy" as const,
      title: "All critical services are responding normally.",
      description:
        "MongoDB, the exam runtime path, and Redis are all reachable from the production app path right now.",
    };
  }

  if (health.ok) {
    return {
      status: "degraded" as const,
      title: "Core app health is stable, but some optional runtime pieces are not configured.",
      description:
        "The main app can still run, but online-exam runtime services are only partially available until the missing dependencies are configured.",
    };
  }

  return {
    status: "degraded" as const,
    title: "One or more dependencies are down.",
    description:
      "Use the dependency cards below to see which service is failing and whether the issue is in MongoDB, Redis, or the online-exam runtime path.",
  };
}

function DependencyCard({
  title,
  description,
  status,
  latencyMs,
  detailRows,
  error,
  icon,
}: {
  title: string;
  description: string;
  status: DependencyStatus;
  latencyMs: number | null;
  detailRows: Array<{ label: string; value: string }>;
  error?: string | null;
  icon: ReactNode;
}) {
  return (
    <Card className="app-surface overflow-hidden shadow-none">
      <CardHeader className="app-section-header gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {icon}
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <Badge variant={getStatusVariant(status)}>
            {getStatusLabel(status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="app-section-body space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Probe latency
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {formatLatency(latencyMs)}
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Current state
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {getStatusLabel(status)}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {detailRows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/75 px-3.5 py-2.5"
            >
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <span className="text-sm font-medium text-foreground">{row.value}</span>
            </div>
          ))}
        </div>

        {error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function CompanyHealthPage() {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    session.user.accountType !== "company_admin" ||
    session.user.role !== "company_admin"
  ) {
    redirect("/company/schools");
  }

  const health = await getSystemHealthSnapshot();
  const overview = getOverviewTone(health);

  return (
    <PageShell width="wide" padding="relaxed" className="app-directory-stack">
      <PageHero
        eyebrow="Company Admin"
        title="System Health"
        description="Track dependency status alongside tenant-cache pressure, process memory, and local cache behavior from one company-level health dashboard."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/company/activity">
              <Button type="button" variant="outline" size="sm" className="app-button-compact">
                Operations Activity
              </Button>
            </Link>
            <Link href="/company/indexing">
              <Button type="button" variant="outline" size="sm" className="app-button-compact">
                Maintenance Console
              </Button>
            </Link>
            <RefreshHealthButton />
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">Live probe</span>
            <span className="app-meta-chip">Company-admin only</span>
            <span className="app-meta-chip">Generated {formatDateTime(health.generatedAt)}</span>
          </>
        }
        stats={[
          {
            label: "Overall",
            value: getStatusLabel(overview.status),
            meta: overview.title,
          },
          {
            label: "MongoDB",
            value: getStatusLabel(health.db),
            meta: `Connection state: ${getMongoReadyStateLabel(health.readyState)}`,
          },
          {
            label: "Exam runtime",
            value: getStatusLabel(health.examRuntime.status),
            meta: health.examRuntime.configured
              ? health.examRuntime.schemaReady
                ? "Schema is ready."
                : "Schema needs attention."
              : "Not configured.",
          },
          {
            label: "Redis",
            value: getStatusLabel(health.redis.status),
            meta: health.redis.configured
              ? health.redis.temporarilyUnavailable
                ? "Temporarily unavailable."
                : "Primary cache path available."
              : "Not configured.",
          },
          {
            label: "Heap used",
            value: formatMemory(health.scale.process.memoryMb.heapUsed),
            meta: `Tenant DBs cached: ${formatCount(health.scale.tenancy.activeConnections)}`,
          },
          {
            label: "Guardrails",
            value: health.scale.caches.requestGovernor.configured ? "Active" : "Off",
            meta: `${formatCount(health.scale.caches.requestGovernor.totals.rateLimited)} limited / ${formatCount(health.scale.caches.requestGovernor.totals.unavailable)} unavailable`,
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.75fr)]">
        <div className="space-y-4">
          <Card className="app-surface overflow-hidden shadow-none">
            <CardHeader className="app-section-header gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    {health.ok ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <CardTitle>{overview.title}</CardTitle>
                    <CardDescription>{overview.description}</CardDescription>
                  </div>
                </div>
                <Badge variant={getStatusVariant(overview.status)}>
                  {getStatusLabel(overview.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="app-section-body space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Total probe time
                  </div>
                  <div className="mt-1 text-lg font-semibold text-foreground">
                    {formatLatency(health.totalMs)}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Redis lock path
                  </div>
                  <div className="mt-1 text-lg font-semibold text-foreground">
                    {getStatusLabel(health.redis.lock.status)}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Generated at
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {formatDateTime(health.generatedAt)}
                  </div>
                </div>
              </div>

              {!health.ok ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  One or more dependencies are down. New logins, report actions, or online-exam traffic may fail until the affected service recovers.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <DependencyCard
              title="MongoDB"
              description="Primary system-of-record for schools, users, papers, and workspace content."
              status={health.db}
              latencyMs={health.latencyMs}
              detailRows={[
                {
                  label: "Connection state",
                  value: getMongoReadyStateLabel(health.readyState),
                },
                {
                  label: "Database probe",
                  value: health.db === "up" ? "Ping succeeded" : "Ping failed",
                },
              ]}
              error={health.error}
              icon={<Database className="h-5 w-5" />}
            />

            <DependencyCard
              title="Exam Runtime"
              description="Neon/Postgres-backed online-exam runtime used for attempts, autosave, and submission flow."
              status={health.examRuntime.status}
              latencyMs={health.examRuntime.latencyMs}
              detailRows={[
                {
                  label: "Configured",
                  value: health.examRuntime.configured ? "Yes" : "No",
                },
                {
                  label: "Schema ready",
                  value: health.examRuntime.schemaReady ? "Yes" : "No",
                },
              ]}
              error={health.examRuntime.error}
              icon={<ServerCog className="h-5 w-5" />}
            />

            <DependencyCard
              title="Redis"
              description="Ephemeral cache and session/attempt support path for fast exam operations."
              status={health.redis.status}
              latencyMs={health.redis.latencyMs}
              detailRows={[
                {
                  label: "Configured",
                  value: health.redis.configured ? "Yes" : "No",
                },
                {
                  label: "Temporary outage flag",
                  value: health.redis.temporarilyUnavailable ? "Yes" : "No",
                },
              ]}
              error={health.redis.error}
              icon={<Activity className="h-5 w-5" />}
            />

            <DependencyCard
              title="Redis Lock Path"
              description="Short-lived write lock used around exam start, save, and submit operations."
              status={health.redis.lock.status}
              latencyMs={health.redis.lock.latencyMs}
              detailRows={[
                {
                  label: "Lock probe",
                  value: health.redis.lock.status === "up" ? "SET NX succeeded" : getStatusLabel(health.redis.lock.status),
                },
                {
                  label: "Depends on Redis",
                  value: getStatusLabel(health.redis.status),
                },
              ]}
              error={health.redis.lock.error}
              icon={<LockKeyhole className="h-5 w-5" />}
            />
          </div>
        </div>

        <div className="space-y-4">
          <Card className="app-surface overflow-hidden shadow-none">
            <CardHeader className="app-section-header gap-2">
              <CardTitle>Scale Signals</CardTitle>
              <CardDescription>
                Watch the process, queue, cache, and service-split signals that usually move first when load ramps up.
              </CardDescription>
            </CardHeader>
            <CardContent className="app-section-body space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Heap used
                  </div>
                  <div className="mt-1 text-lg font-semibold text-foreground">
                    {formatMemory(health.scale.process.memoryMb.heapUsed)}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 px-3.5 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Resident memory
                  </div>
                  <div className="mt-1 text-lg font-semibold text-foreground">
                    {formatMemory(health.scale.process.memoryMb.rss)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  {
                    label: "Process uptime",
                    value: `${formatCount(health.scale.process.uptimeSeconds)} s`,
                  },
                  {
                    label: "App service mode",
                    value: health.service.mode,
                  },
                  {
                    label: "Student app origin",
                    value: health.service.studentOrigin || "—",
                  },
                  {
                    label: "Staff app origin",
                    value: health.service.staffOrigin || "—",
                  },
                  {
                    label: "Tenant DB cache",
                    value: `${formatCount(health.scale.tenancy.activeConnections)} active`,
                  },
                  {
                    label: "Compiled tenant models",
                    value: formatCount(health.scale.tenancy.compiledModelCount),
                  },
                  {
                    label: "Student test cache",
                    value: `${formatCount(health.scale.caches.studentTests.entries)} entries`,
                  },
                  {
                    label: "Student test hit rate",
                    value: formatHitRate(
                      health.scale.caches.studentTests.localHits +
                        health.scale.caches.studentTests.redisHits,
                      health.scale.caches.studentTests.localMisses +
                        health.scale.caches.studentTests.redisMisses,
                    ),
                  },
                  {
                    label: "Workspace support cache",
                    value: `${formatCount(health.scale.caches.workspaceSupportData.entries)} entries`,
                  },
                  {
                    label: "Workspace support hit rate",
                    value: formatHitRate(
                      health.scale.caches.workspaceSupportData.localHits +
                        health.scale.caches.workspaceSupportData.redisHits,
                      health.scale.caches.workspaceSupportData.localMisses +
                        health.scale.caches.workspaceSupportData.redisMisses,
                    ),
                  },
                  {
                    label: "Student dashboard cache",
                    value: `${formatCount(health.scale.caches.studentDashboard.entries)} entries`,
                  },
                  {
                    label: "Student dashboard hit rate",
                    value: formatHitRate(
                      health.scale.caches.studentDashboard.localHits +
                        health.scale.caches.studentDashboard.redisHits,
                      health.scale.caches.studentDashboard.localMisses +
                        health.scale.caches.studentDashboard.redisMisses,
                    ),
                  },
                  {
                    label: "Notification jobs queued",
                    value: formatCount(
                      health.scale.caches.studentNotifications.queued,
                    ),
                  },
                  {
                    label: "Notification jobs processing",
                    value: formatCount(
                      health.scale.caches.studentNotifications.processing,
                    ),
                  },
                  {
                    label: "Notification jobs failed",
                    value: formatCount(
                      health.scale.caches.studentNotifications.failed,
                    ),
                  },
                  {
                    label: "Notification queue ready",
                    value: formatCount(
                      health.scale.caches.studentNotifications.redisReady,
                    ),
                  },
                  {
                    label: "Notification queue delayed",
                    value: formatCount(
                      health.scale.caches.studentNotifications.redisDelayed,
                    ),
                  },
                  {
                    label: "Notification queue partitions",
                    value: formatCount(
                      health.scale.caches.studentNotifications.redisPartitions,
                    ),
                  },
                  {
                    label: "Report jobs queued",
                    value: formatCount(health.scale.caches.reportDispatch.queued),
                  },
                  {
                    label: "Report jobs processing",
                    value: formatCount(
                      health.scale.caches.reportDispatch.processing,
                    ),
                  },
                  {
                    label: "Report jobs failed",
                    value: formatCount(health.scale.caches.reportDispatch.failed),
                  },
                  {
                    label: "Report queue ready",
                    value: formatCount(
                      health.scale.caches.reportDispatch.redisReady,
                    ),
                  },
                  {
                    label: "Report queue delayed",
                    value: formatCount(
                      health.scale.caches.reportDispatch.redisDelayed,
                    ),
                  },
                  {
                    label: "Report queue partitions",
                    value: formatCount(
                      health.scale.caches.reportDispatch.redisPartitions,
                    ),
                  },
                  {
                    label: "Public school cache",
                    value: `${formatCount(health.scale.caches.publicSchoolData.allCount)} schools`,
                  },
                  {
                    label: "Guardrails configured",
                    value: health.scale.caches.requestGovernor.configured
                      ? "Yes"
                      : "No",
                  },
                  {
                    label: "Guardrail backoff",
                    value: health.scale.caches.requestGovernor.temporarilyUnavailable
                      ? "Redis unavailable"
                      : "Ready",
                  },
                  {
                    label: "Guardrail active leases",
                    value: formatCount(
                      health.scale.caches.requestGovernor.totals.active,
                    ),
                  },
                  {
                    label: "Guardrail rate limits",
                    value: formatCount(
                      health.scale.caches.requestGovernor.totals.rateLimited,
                    ),
                  },
                  {
                    label: "Guardrail concurrency limits",
                    value: formatCount(
                      health.scale.caches.requestGovernor.totals.concurrencyLimited,
                    ),
                  },
                  {
                    label: "Guardrail unavailable responses",
                    value: formatCount(
                      health.scale.caches.requestGovernor.totals.unavailable,
                    ),
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/75 px-3.5 py-2.5"
                  >
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className="text-sm font-medium text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>

              {health.scale.tenancy.sampleTenantDbNames.length > 0 ? (
                <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Sample cached tenant DBs
                  </div>
                  <div className="mt-2 text-sm text-foreground/88">
                    {health.scale.tenancy.sampleTenantDbNames.join(", ")}
                    {health.scale.tenancy.truncated ? " ..." : ""}
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Request governor policies
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Route budgets, concurrency caps, and live stream pressure across the expensive paths.
                    </div>
                  </div>
                  <Badge
                    variant={
                      health.scale.caches.requestGovernor.temporarilyUnavailable
                        ? "warning"
                        : health.scale.caches.requestGovernor.configured
                          ? "success"
                          : "warning"
                    }
                  >
                    {health.scale.caches.requestGovernor.temporarilyUnavailable
                      ? "Backoff"
                      : health.scale.caches.requestGovernor.configured
                        ? "Active"
                        : "Not configured"}
                  </Badge>
                </div>

                <div className="mt-3 space-y-2">
                  {health.scale.caches.requestGovernor.policies.map((policy) => (
                    <div
                      key={policy.id}
                      className="rounded-xl border border-border/60 bg-muted/20 px-3.5 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground">
                            {policy.label}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                            <span>{policy.costClass.replace(/_/g, " ")}</span>
                            <span>{policy.scope}</span>
                            <span>{policy.failMode}</span>
                            <span>{formatWindow(policy.windowMs)}</span>
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>{formatCount(policy.maxRequests)} req/window</div>
                          <div>{formatCount(policy.maxConcurrent)} concurrent</div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        {[
                          {
                            label: "Active",
                            value: formatCount(policy.active),
                          },
                          {
                            label: "Limited",
                            value: formatCount(
                              policy.rateLimited + policy.concurrencyLimited,
                            ),
                          },
                          {
                            label: "Unavailable",
                            value: formatCount(policy.unavailable),
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="rounded-xl border border-border/60 bg-background/75 px-3 py-2"
                          >
                            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              {item.label}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-foreground">
                              {item.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden shadow-none">
            <CardHeader className="app-section-header gap-2">
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Jump from health status into the operational surfaces you would usually use to investigate or recover.
              </CardDescription>
            </CardHeader>
            <CardContent className="app-section-body space-y-3">
              <Link href="/company/activity" className="block">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/80 px-4 py-3 transition-colors hover:border-primary/22 hover:bg-muted/20">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-foreground">Open operations activity</div>
                    <div className="text-sm text-muted-foreground">
                      Review recent maintenance runs and audit events.
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>

              <Link href="/company/indexing" className="block">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/80 px-4 py-3 transition-colors hover:border-primary/22 hover:bg-muted/20">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-foreground">Open maintenance console</div>
                    <div className="text-sm text-muted-foreground">
                      Run reindexing or duplicate-student cleanup operations.
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden shadow-none">
            <CardHeader className="app-section-header gap-2">
              <CardTitle>Interpretation</CardTitle>
              <CardDescription>
                A quick read on what each state means in practice.
              </CardDescription>
            </CardHeader>
            <CardContent className="app-section-body space-y-3">
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Badge variant="success">Up</Badge>
                  <span className="text-sm font-medium text-foreground">Healthy and responding</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  The probe completed successfully and the dependency is available for live traffic.
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Badge variant="warning">Not configured</Badge>
                  <span className="text-sm font-medium text-foreground">Optional path missing</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  The app can still run, but the related feature path is not currently wired for this deployment.
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">Down</Badge>
                  <span className="text-sm font-medium text-foreground">Attention needed</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  The dependency probe failed. Check credentials, network reachability, or provider status before high-traffic operations.
                </p>
              </div>

              <div className="rounded-2xl border border-primary/12 bg-primary/5 px-4 py-3 text-sm text-foreground/88">
                This page uses the same backend probe as <code>/api/health</code>, so UI status and API status stay aligned.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
