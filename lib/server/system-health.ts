import "server-only";

import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { getTenantDbCacheStats } from "@/lib/db-tenant";
import { probeExamRuntimeHealth } from "@/lib/exam-runtime";
import {
  getRedisPartitionQueueStats,
  REPORT_DISPATCH_REDIS_QUEUE,
  probeRedisHealth,
  STUDENT_NOTIFICATION_REDIS_QUEUE,
} from "@/lib/redis";
import { getAppServiceConfig, type AppServiceMode } from "@/lib/service-mode";
import { getPublicSchoolCacheStats } from "@/lib/server/public-school-data";
import { getStudentDashboardCacheStats } from "@/lib/server/student-dashboard-cache";
import { getWorkspaceSupportDataCacheStats } from "@/lib/server/workspace-support-data";
import { getStudentTestResourceCacheStats } from "@/lib/student-test-server";
import ReportDispatchJob from "@/models/ReportDispatchJob";
import StudentNotificationJob from "@/models/StudentNotificationJob";

export type DependencyStatus = "up" | "down" | "not_configured";

export type MongoHealthProbe = {
  status: "up" | "down";
  latencyMs: number | null;
  readyState: number | null;
  error: string | null;
};

export type SystemHealthSnapshot = {
  ok: boolean;
  dependenciesOk: boolean;
  db: MongoHealthProbe["status"];
  latencyMs: number | null;
  readyState: number | null;
  totalMs: number;
  error: string | null;
  generatedAt: string;
  examRuntime: {
    status: DependencyStatus;
    configured: boolean;
    schemaReady: boolean;
    latencyMs: number | null;
    error: string | null;
  };
  redis: {
    status: DependencyStatus;
    configured: boolean;
    temporarilyUnavailable: boolean;
    latencyMs: number | null;
    error: string | null;
    lock: {
      status: DependencyStatus;
      latencyMs: number | null;
      error: string | null;
    };
  };
  service: {
    mode: AppServiceMode;
    studentOrigin: string | null;
    staffOrigin: string | null;
    splitConfigured: boolean;
  };
  scale: {
    process: {
      pid: number;
      nodeVersion: string;
      uptimeSeconds: number;
      memoryMb: {
        rss: number;
        heapTotal: number;
        heapUsed: number;
        external: number;
        arrayBuffers: number;
      };
    };
    tenancy: {
      activeConnections: number;
      compiledModelCount: number;
      sampleTenantDbNames: string[];
      truncated: boolean;
    };
    caches: {
      studentTests: {
        entries: number;
        maxEntries: number;
        redisConfigured: boolean;
        localHits: number;
        localMisses: number;
        redisHits: number;
        redisMisses: number;
        redisWrites: number;
        loaderRuns: number;
      };
      workspaceSupportData: {
        entries: number;
        maxEntries: number;
        redisConfigured: boolean;
        localHits: number;
        localMisses: number;
        redisHits: number;
        redisMisses: number;
        redisWrites: number;
        loaderRuns: number;
      };
      studentDashboard: {
        entries: number;
        maxEntries: number;
        redisConfigured: boolean;
        ttlMs: number;
        localHits: number;
        localMisses: number;
        redisHits: number;
        redisMisses: number;
        redisWrites: number;
        loaderRuns: number;
      };
      publicSchoolData: {
        allLoaded: boolean;
        allCount: number;
        keyedEntries: number;
        redisConfigured: boolean;
        localHits: number;
        localMisses: number;
        redisHits: number;
        redisMisses: number;
        redisWrites: number;
        loaderRuns: number;
      };
      studentNotifications: {
        queued: number;
        processing: number;
        failed: number;
        redisPartitions: number;
        redisReady: number;
        redisDelayed: number;
      };
      reportDispatch: {
        queued: number;
        processing: number;
        failed: number;
        redisPartitions: number;
        redisReady: number;
        redisDelayed: number;
      };
    };
  };
};

function toRoundedMegabytes(value: number) {
  return Math.round((value / (1024 * 1024)) * 10) / 10;
}

export async function probeMongoHealth(): Promise<MongoHealthProbe> {
  let status: "up" | "down" = "down";
  let latencyMs: number | null = null;
  let readyState: number | null = null;
  let error: string | null = null;

  try {
    await connectDB();
    readyState = mongoose.connection.readyState;

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("DB not connected");
    }

    const admin = db.admin();
    const pingStart = Date.now();
    await admin.ping();
    latencyMs = Date.now() - pingStart;
    status = "up";
  } catch (probeError: any) {
    error = probeError?.message || String(probeError);
  }

  return {
    status,
    latencyMs,
    readyState,
    error,
  };
}

export async function getSystemHealthSnapshot(): Promise<SystemHealthSnapshot> {
  const startedAt = Date.now();

  const [mongo, examRuntime, redis] = await Promise.all([
    probeMongoHealth(),
    probeExamRuntimeHealth(),
    probeRedisHealth(),
  ]);
  const service = getAppServiceConfig();

  const dependencyStatuses: DependencyStatus[] = [
    examRuntime.status,
    redis.status,
    redis.lock.status,
  ];
  const dependenciesOk = dependencyStatuses.every((status) => status !== "down");
  const ok = mongo.status === "up" && dependenciesOk;
  const memoryUsage = process.memoryUsage();
  const tenantDbCache = getTenantDbCacheStats();
  const [studentNotificationQueueStats, reportDispatchQueueStats] =
    await Promise.all([
      getRedisPartitionQueueStats(STUDENT_NOTIFICATION_REDIS_QUEUE),
      getRedisPartitionQueueStats(REPORT_DISPATCH_REDIS_QUEUE),
    ]);
  const notificationQueueCounts =
    mongo.status === "up"
      ? await Promise.all([
          StudentNotificationJob.countDocuments({ status: "queued" }).catch(
            () => 0,
          ),
          StudentNotificationJob.countDocuments({ status: "processing" }).catch(
            () => 0,
          ),
          StudentNotificationJob.countDocuments({ status: "failed" }).catch(
            () => 0,
          ),
        ])
      : [0, 0, 0];
  const reportDispatchQueueCounts =
    mongo.status === "up"
      ? await Promise.all([
          ReportDispatchJob.countDocuments({ status: "queued" }).catch(() => 0),
          ReportDispatchJob.countDocuments({ status: "processing" }).catch(
            () => 0,
          ),
          ReportDispatchJob.countDocuments({ status: "failed" }).catch(() => 0),
        ])
      : [0, 0, 0];

  return {
    ok,
    dependenciesOk,
    db: mongo.status,
    latencyMs: mongo.latencyMs,
    readyState: mongo.readyState,
    totalMs: Date.now() - startedAt,
    error: mongo.error,
    generatedAt: new Date().toISOString(),
    examRuntime: {
      status: examRuntime.status,
      configured: examRuntime.configured,
      schemaReady: examRuntime.schemaReady,
      latencyMs: examRuntime.latencyMs,
      error: examRuntime.error || null,
    },
    redis: {
      status: redis.status,
      configured: redis.configured,
      temporarilyUnavailable: redis.temporarilyUnavailable,
      latencyMs: redis.latencyMs,
      error: redis.error || null,
      lock: {
        status: redis.lock.status,
        latencyMs: redis.lock.latencyMs,
        error: redis.lock.error || null,
      },
    },
    service: {
      mode: service.mode,
      studentOrigin: service.studentOrigin,
      staffOrigin: service.staffOrigin,
      splitConfigured: Boolean(service.studentOrigin || service.staffOrigin),
    },
    scale: {
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: {
          rss: toRoundedMegabytes(memoryUsage.rss),
          heapTotal: toRoundedMegabytes(memoryUsage.heapTotal),
          heapUsed: toRoundedMegabytes(memoryUsage.heapUsed),
          external: toRoundedMegabytes(memoryUsage.external),
          arrayBuffers: toRoundedMegabytes(memoryUsage.arrayBuffers),
        },
      },
      tenancy: {
        activeConnections: tenantDbCache.activeConnections,
        compiledModelCount: tenantDbCache.compiledModelCount,
        sampleTenantDbNames: tenantDbCache.sampleTenantDbNames,
        truncated: tenantDbCache.truncated,
      },
      caches: {
        studentTests: getStudentTestResourceCacheStats(),
        workspaceSupportData: getWorkspaceSupportDataCacheStats(),
        studentDashboard: getStudentDashboardCacheStats(),
        publicSchoolData: getPublicSchoolCacheStats(),
        studentNotifications: {
          queued: Number(notificationQueueCounts[0] || 0),
          processing: Number(notificationQueueCounts[1] || 0),
          failed: Number(notificationQueueCounts[2] || 0),
          redisPartitions: studentNotificationQueueStats.partitions,
          redisReady: studentNotificationQueueStats.ready,
          redisDelayed: studentNotificationQueueStats.delayed,
        },
        reportDispatch: {
          queued: Number(reportDispatchQueueCounts[0] || 0),
          processing: Number(reportDispatchQueueCounts[1] || 0),
          failed: Number(reportDispatchQueueCounts[2] || 0),
          redisPartitions: reportDispatchQueueStats.partitions,
          redisReady: reportDispatchQueueStats.ready,
          redisDelayed: reportDispatchQueueStats.delayed,
        },
      },
    },
  };
}
