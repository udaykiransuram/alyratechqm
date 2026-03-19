import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ReportDispatchJob from "../../../../../../models/ReportDispatchJob";
import mongoose from "mongoose";
import { requireTenantSession } from "@/lib/api-auth";
import { runReportDispatchWorker } from "@/lib/reports/dispatchWorker";

function normalizeMobileNumber(input: string): string {
  const digits = String(input || "").replace(/\D/g, "");
  if (/^[1-9]\d{9,14}$/.test(digits)) {
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }
  return digits;
}

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

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await connectDB();
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) return auth.response;
  const { schoolKey } = auth;
  if (!mongoose.Types.ObjectId.isValid(params.id)) {
    return NextResponse.json(
      { success: false, message: "Invalid job id" },
      { status: 400 },
    );
  }

  const job = await ReportDispatchJob.findOne({ _id: params.id, schoolKey });
  if (!job) {
    return NextResponse.json(
      { success: false, message: "Job not found" },
      { status: 404 },
    );
  }

  job.status = "queued";
  job.error = undefined;
  job.nextRetryAt = new Date();
  if (job.mobileNumber) {
    job.mobileNumber = normalizeMobileNumber(job.mobileNumber);
  }
  await job.save();

  let workerResult = null;
  try {
    workerResult = await runReportDispatchWorker({
      origin: req.nextUrl.origin,
      schoolKey,
      jobIds: [String(job._id)],
    });
  } catch (error) {
    console.error("Failed to auto-trigger report worker", error);
  }

  return NextResponse.json({ success: true, jobId: job._id, worker: workerResult });
}
