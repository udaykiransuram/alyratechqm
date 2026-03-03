import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ReportDispatchJob from "../../../../../../models/ReportDispatchJob";
import mongoose from "mongoose";

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
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  }
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

  return NextResponse.json({ success: true, jobId: job._id });
}
