export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import {
  buildArchiveFilter,
  buildRestoreUpdate,
  resolveIncludeArchived,
} from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";
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

export async function GET(req: NextRequest) {
  await connectDB();
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  }

  try {
    const url = new URL(req.url);
    const classId = url.searchParams.get("classId");
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    const includeArchived = resolveIncludeArchived(url);
    const query: any = {
      ...buildArchiveFilter(includeArchived),
      ...(includeInactive ? {} : { isActive: true }),
    };

    if (classId) {
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        return NextResponse.json(
          { success: false, message: "Invalid classId" },
          { status: 400 },
        );
      }
      query.class = classId;
    }

    const {
      AcademicSection: AcademicSectionModel,
      Class: ClassModel,
    } = await getTenantModels(schoolKey, ["AcademicSection", "Class"]);

    const sections = await AcademicSectionModel.find(query)
      .populate({ path: "class", model: ClassModel, select: "name" })
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ success: true, sections });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  await connectDB();
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  }

  try {
    const { name, classId, description, isActive } = await req.json();

    if (!name || !String(name).trim()) {
      return NextResponse.json(
        { success: false, message: "Section name is required." },
        { status: 400 },
      );
    }

    if (!classId || !mongoose.Types.ObjectId.isValid(String(classId))) {
      return NextResponse.json(
        { success: false, message: "Valid classId is required." },
        { status: 400 },
      );
    }

    const {
      AcademicSection: AcademicSectionModel,
      Class: ClassModel,
    } = await getTenantModels(schoolKey, ["AcademicSection", "Class"]);

    const classDoc = await ClassModel.findOne({
      _id: classId,
      ...buildArchiveFilter(false),
    }).lean();
    if (!classDoc) {
      return NextResponse.json(
        { success: false, message: "Class not found." },
        { status: 404 },
      );
    }

    const normalizedName = String(name).trim();
    let existing = await AcademicSectionModel.findOne({
      class: classId,
      name: normalizedName,
    })
      .populate({ path: "class", model: ClassModel, select: "name" })
      .lean();

    if (existing) {
      if ((existing as any).isArchived) {
        existing = await AcademicSectionModel.findByIdAndUpdate(
          existing._id,
          {
            ...buildRestoreUpdate(),
            description,
            isActive: typeof isActive === "boolean" ? isActive : true,
          },
          { new: true, runValidators: true },
        )
          .populate({ path: "class", model: ClassModel, select: "name" })
          .lean();

        await recordTenantAudit({
          schoolKey,
          req,
          entityType: "academic_section",
          entityId: String(existing?._id || ""),
          entityLabel: normalizedName,
          action: "restored",
          summary: `Restored section ${normalizedName}.`,
          details: { classId },
        });
      }

      return NextResponse.json(
        { success: true, section: existing, existed: true },
        { status: 200 },
      );
    }

    const section = await AcademicSectionModel.create({
      name: normalizedName,
      class: classId,
      description,
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    const populatedSection = await AcademicSectionModel.findById(section._id)
      .populate({ path: "class", model: ClassModel, select: "name" })
      .lean();

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: "academic_section",
      entityId: String(section._id),
      entityLabel: normalizedName,
      action: "created",
      summary: `Created section ${normalizedName}.`,
      details: { classId },
    });

    return NextResponse.json(
      { success: true, section: populatedSection },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}
