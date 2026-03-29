export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import {
  buildArchiveFilter,
  buildArchivedUpdate,
  resolveIncludeArchived,
} from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";
import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  await connectDB();
  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid section ID" },
      { status: 400 },
    );
  }

  try {
    const includeArchived = resolveIncludeArchived(req.nextUrl);
    const {
      AcademicSection: AcademicSectionModel,
      Class: ClassModel,
    } = await getTenantModels(schoolKey, ["AcademicSection", "Class"]);

    const section = await AcademicSectionModel.findOne({
      _id: id,
      ...buildArchiveFilter(includeArchived),
    })
      .populate({ path: "class", model: ClassModel, select: "name" })
      .lean();

    if (!section) {
      return NextResponse.json(
        { success: false, message: "Section not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, section });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  await connectDB();
  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid section ID" },
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
    const duplicate = await AcademicSectionModel.findOne({
      _id: { $ne: id },
      class: classId,
      name: normalizedName,
      ...buildArchiveFilter(false),
    }).lean();

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          message:
            "A section with this name already exists for the selected class.",
        },
        { status: 409 },
      );
    }

    const updated = await AcademicSectionModel.findOneAndUpdate(
      {
        _id: id,
        ...buildArchiveFilter(false),
      },
      {
        name: normalizedName,
        class: classId,
        description,
        ...(typeof isActive === "boolean" ? { isActive } : {}),
      },
      { new: true, runValidators: true },
    )
      .populate({ path: "class", model: ClassModel, select: "name" })
      .lean();

    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Section not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, section: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  await connectDB();
  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid section ID" },
      { status: 400 },
    );
  }

  try {
    const { AcademicSection: AcademicSectionModel, User: UserModel } =
      await getTenantModels(schoolKey, ["AcademicSection", "User"]);

    const inUseCount = await UserModel.countDocuments({
      ...buildArchiveFilter(false),
      $or: [{ academicSection: id }, { academicSectionIds: id }],
    });

    if (inUseCount > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Section is in use by existing users and cannot be archived.",
        },
        { status: 409 },
      );
    }

    const archived = await AcademicSectionModel.findOneAndUpdate(
      {
        _id: id,
        ...buildArchiveFilter(false),
      },
      buildArchivedUpdate(),
      { new: true, runValidators: true },
    );

    if (!archived) {
      return NextResponse.json(
        { success: false, message: "Section not found." },
        { status: 404 },
      );
    }

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: "academic_section",
      entityId: String(archived._id),
      entityLabel: String(archived.name || ""),
      action: "archived",
      summary: `Archived section ${archived.name}.`,
      details: {
        classId: String(archived.class || ""),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Section archived successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}
