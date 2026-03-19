import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import ReportDispatchJob from "@/models/ReportDispatchJob";
import {
  hydrateAcademicSectionsWithClasses,
  hydrateUsersWithAcademicContext,
} from "@/lib/analytics/hydrateResponses";
import { requireTenantSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

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
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) return auth.response;
  const { schoolKey } = auth;

  const status = req.nextUrl.searchParams.get("status");
  const academicSectionId =
    req.nextUrl.searchParams.get("academicSectionId")?.trim() || "";
  if (
    academicSectionId &&
    !mongoose.Types.ObjectId.isValid(academicSectionId)
  ) {
    return NextResponse.json(
      { success: false, message: "Invalid academicSectionId" },
      { status: 400 },
    );
  }

  const query: any = { schoolKey };
  if (status && ["queued", "processing", "sent", "failed"].includes(status)) {
    query.status = status;
  }

  const [
    {
      User: UserModel,
      AcademicSection: AcademicSectionModel,
      Class: ClassModel,
    },
    jobs,
  ] = await Promise.all([
    getTenantModels(schoolKey, ["User", "AcademicSection", "Class"]),
    ReportDispatchJob.find(query).sort({ updatedAt: -1 }).limit(500).lean(),
  ]);

  const studentIds = Array.from(
    new Set(jobs.map((job: any) => String(job.student || "")).filter(Boolean)),
  );

  const rawUsers = studentIds.length
    ? await UserModel.find({ _id: { $in: studentIds } })
        .select("name class academicSection")
        .lean()
    : [];

  const users = await hydrateUsersWithAcademicContext({
    users: rawUsers,
    AcademicSectionModel,
    ClassModel,
  });

  const userMap = new Map(users.map((user: any) => [String(user._id), user]));

  const rawSections = await AcademicSectionModel.find({})
    .select("name class")
    .sort({ name: 1 })
    .lean();

  const sections = await hydrateAcademicSectionsWithClasses({
    sections: rawSections,
    ClassModel,
  });

  const enrichedJobs = jobs
    .map((job: any) => {
      const user: any = userMap.get(String(job.student || ""));
      const resolvedClassId = String(
        job.classId || user?.class?._id || user?.class || "",
      );
      const resolvedAcademicSectionId = String(
        job.academicSection ||
          user?.academicSection?._id ||
          user?.academicSection ||
          "",
      );
      return {
        ...job,
        studentName: job.studentName || user?.name || "",
        paperTitle: job.paperTitle || "",
        classId: resolvedClassId || undefined,
        className: job.className || user?.class?.name || "",
        academicSectionId: resolvedAcademicSectionId || undefined,
        academicSectionName:
          job.academicSectionName || user?.academicSection?.name || "",
      };
    })
    .filter((job: any) => {
      if (!academicSectionId) return true;
      return String(job.academicSectionId || "") === academicSectionId;
    })
    .slice(0, 200);

  const academicSections = sections.map((section: any) => ({
    value: String(section._id),
    label: section?.class?.name
      ? `${section.class.name} • ${section.name}`
      : section.name || "Unknown Section",
  }));

  return NextResponse.json({
    success: true,
    jobs: enrichedJobs,
    filters: {
      academicSections,
    },
  });
}
