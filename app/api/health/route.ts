import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const started = Date.now();
  let status: 'up' | 'down' = 'down';
  let latencyMs: number | null = null;
  let readyState: number | null = null;
  let error: string | null = null;
  try {
    await connectDB();
    readyState = mongoose.connection.readyState;
    // If connection exists, ping the DB
    const db = mongoose.connection.db;
    if (!db) { throw new Error('DB not connected'); }
    const admin = db.admin();
    const pingStart = Date.now();
    await admin.ping();
    latencyMs = Date.now() - pingStart;
    status = 'up';
  } catch (e: any) {
    error = e?.message || String(e);
  }
  const totalMs = Date.now() - started;
  return NextResponse.json({ ok: status === 'up', db: status, latencyMs, readyState, totalMs, error });
}
