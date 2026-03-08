import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ReportDispatchJob from "@/models/ReportDispatchJob";

export const dynamic = 'force-dynamic';

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

export async function GET(req: NextRequest) {
  await connectDB();
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  }

  const status = req.nextUrl.searchParams.get("status");
  const query: any = { schoolKey };
  if (status && ["queued", "processing", "sent", "failed"].includes(status)) {
    query.status = status;
  }

  const jobs = await ReportDispatchJob.find(query)
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();

  return NextResponse.json({ success: true, jobs });
}
