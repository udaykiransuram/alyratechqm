import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ReportDispatchJob from "../../../../../../models/ReportDispatchJob";
import mongoose from "mongoose";
import { requireTenantSession } from "@/lib/api-auth";
import { expireActiveDeliveryAttempt } from "@/lib/reports/dispatchAttempts";
import {
  enqueueReportDispatchJobs,
  scheduleReportDispatchWorker,
} from "@/lib/reports/dispatchQueue";

function normalizeMobileNumber(input: string): string {
  const digits = String(input || "").replace(/\D/g, "");
  if (/^[1-9]\d{9,14}$/.test(digits)) {
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }
  return digits;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { schoolKey } = auth;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid job id" },
      { status: 400 },
    );
  }

  const job = await ReportDispatchJob.findOne({ _id: id, schoolKey });
  if (!job) {
    return NextResponse.json(
      { success: false, message: "Job not found" },
      { status: 404 },
    );
  }

  if (job.status !== "failed") {
    return NextResponse.json(
      {
        success: false,
        message:
          job.status === "processing"
            ? "This job is already being processed. Wait for the active worker run to finish before retrying."
            : "Only failed jobs can be retried manually.",
      },
      { status: 409 },
    );
  }

  job.status = "queued";
  job.error = undefined;
  job.nextRetryAt = new Date();
  job.processingStartedAt = undefined;
  expireActiveDeliveryAttempt(
    job,
    "Manual retry requested after the previous delivery attempt failed.",
    new Date(),
  );
  if (job.mobileNumber) {
    job.mobileNumber = normalizeMobileNumber(job.mobileNumber);
  }
  await job.save();

  await enqueueReportDispatchJobs({
    schoolKey,
    jobIds: [String(job._id)],
    availableAt: job.nextRetryAt || new Date(),
  }).catch(() => null);

  let workerResult = null;
  scheduleReportDispatchWorker({
    schoolKey,
    jobIds: [String(job._id)],
  });
  workerResult = {
    queued: true,
    jobCount: 1,
  };

  return NextResponse.json({ success: true, jobId: job._id, worker: workerResult });
}
