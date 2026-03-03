import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

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
  { params }: { params: { paperId: string } },
) {
  await connectDB();
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  }

  const { QuestionPaperResponse: QPRModel } = await getTenantModels(schoolKey, [
    "QuestionPaperResponse",
    "User",
  ]);

  const responses = await QPRModel.find({ paper: params.paperId })
    .select("_id")
    .lean();

  let queued = 0;
  let alreadyQueued = 0;
  const failures: string[] = [];
  const baseUrl = new URL(req.url).origin;

  for (const response of responses as any[]) {
    try {
      const res = await fetch(
        `${baseUrl}/api/reports/send/student/${response._id}?school=${encodeURIComponent(schoolKey)}`,
        {
          method: "POST",
          headers: { "x-school-key": schoolKey },
        },
      );
      const data = await res.json();
      if (res.ok && data?.success) {
        if (data?.message === "Report already queued") alreadyQueued += 1;
        else queued += 1;
      } else {
        failures.push(String(response._id));
      }
    } catch {
      failures.push(String(response._id));
    }
  }

  return NextResponse.json({
    success: failures.length === 0,
    queued,
    alreadyQueued,
    failedCount: failures.length,
    failedResponseIds: failures,
  });
}
