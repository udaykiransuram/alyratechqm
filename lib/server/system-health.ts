import "server-only";

import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { probeExamRuntimeHealth } from "@/lib/exam-runtime";
import { probeRedisHealth } from "@/lib/redis";

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
};

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

  const dependencyStatuses: DependencyStatus[] = [
    examRuntime.status,
    redis.status,
    redis.lock.status,
  ];
  const dependenciesOk = dependencyStatuses.every((status) => status !== "down");
  const ok = mongo.status === "up" && dependenciesOk;

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
  };
}
