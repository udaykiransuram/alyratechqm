import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { buildArchiveFilter, buildArchivedUpdate, resolveIncludeArchived } from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";

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

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function normalizeId(value: unknown) {
  return value ? String(value).trim() : "";
}

async function validateStudentAcademicSection(
  AcademicSectionModel: any,
  classId: string,
  academicSectionId: string,
) {
  if (!academicSectionId) {
    return { ok: true } as const;
  }

  if (!mongoose.Types.ObjectId.isValid(academicSectionId)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Invalid academicSectionId." },
        { status: 400 },
      ),
    } as const;
  }

  const academicSection = await AcademicSectionModel.findById(academicSectionId)
    .select("class")
    .lean();
  if (!academicSection) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Academic section not found." },
        { status: 404 },
      ),
    } as const;
  }

  if (classId && String((academicSection as any).class) !== String(classId)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Selected section does not belong to the selected class.",
        },
        { status: 400 },
      ),
    } as const;
  }

  return { ok: true } as const;
}

export async function GET(
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

  try {
    const userId = params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID" },
        { status: 400 },
      );
    }
    const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
    const user = await UserModel.findOne({ _id: userId, ...buildArchiveFilter(resolveIncludeArchived(req.nextUrl)) }).select("-passwordHash");
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}

export async function PUT(
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

  try {
    const userId = params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID" },
        { status: 400 },
      );
    }

    const {
      name,
      role,
      class: rawClass,
      classId: rawClassId,
      academicSection: rawAcademicSection,
      academicSectionId: rawAcademicSectionId,
      rollNumber,
      enrolledAt,
      email,
      password,
      mobileNumber,
      classIds,
      academicSectionIds,
      subjectIds,
      hasAllClasses,
      hasAllSections,
      hasAllSubjects,
    } = await req.json();

    const classId = normalizeId(rawClassId ?? rawClass);
    const academicSectionId = normalizeId(
      rawAcademicSectionId ?? rawAcademicSection,
    );
    const normalizedMobileNumber = String(mobileNumber || "").trim();
    const normalizedClassIds = normalizeIds(classIds);
    const normalizedAcademicSectionIds = normalizeIds(academicSectionIds);
    const normalizedSubjectIds = normalizeIds(subjectIds);
    const allowAllClasses = Boolean(hasAllClasses);
    const allowAllSections =
      typeof hasAllSections === "boolean"
        ? hasAllSections
        : role !== "student";
    const allowAllSubjects = Boolean(hasAllSubjects);

    if (!name || !role) {
      return NextResponse.json(
        { success: false, message: "Name and role are required." },
        { status: 400 },
      );
    }
    if (!normalizedMobileNumber) {
      return NextResponse.json(
        { success: false, message: "Phone number is required." },
        { status: 400 },
      );
    }
    if (role === "student" && (!classId || !rollNumber)) {
      return NextResponse.json(
        {
          success: false,
          message: "class and rollNumber are required for students.",
        },
        { status: 400 },
      );
    }
    if (
      role === "teacher" &&
      (normalizedClassIds.length === 0 || normalizedSubjectIds.length === 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Teachers must have at least one class and one subject.",
        },
        { status: 400 },
      );
    }
    if (
      role === "admin" &&
      ((!allowAllClasses && normalizedClassIds.length === 0) ||
        (!allowAllSubjects && normalizedSubjectIds.length === 0))
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Admins must have all classes/subjects enabled or choose at least one class and one subject.",
        },
        { status: 400 },
      );
    }

    const {
      User: UserModel,
      AcademicSection: AcademicSectionModel,
    } = await getTenantModels(schoolKey, ["User", "AcademicSection"]);

    if (role === "student" && classId && academicSectionId) {
      const sectionValidation = await validateStudentAcademicSection(
        AcademicSectionModel,
        classId,
        academicSectionId,
      );
      if (!sectionValidation.ok) return sectionValidation.response;
    }

    const userToUpdate = await UserModel.findOne({ _id: userId, ...buildArchiveFilter(false) });
    if (userToUpdate && userToUpdate.role === "admin" && role !== "admin") {
      const adminCount = await UserModel.countDocuments({ role: "admin", ...buildArchiveFilter(false) });
      if (adminCount <= 1) {
        return NextResponse.json(
          {
            success: false,
            message: "Cannot change the role of the last administrator.",
          },
          { status: 409 },
        );
      }
    }

    const updateData: any = {
      name,
      role,
      mobileNumber: normalizedMobileNumber,
    };

    if (typeof email !== "undefined") {
      if (email) {
        const existingEmailUser = await UserModel.findOne({
          email,
          _id: { $ne: userId },
        });
        if (existingEmailUser) {
          return NextResponse.json(
            {
              success: false,
              message: "A user with this email already exists.",
            },
            { status: 409 },
          );
        }
        updateData.email = email;
      } else {
        updateData.email = undefined;
      }
    }

    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          {
            success: false,
            message: "Password must be at least 6 characters long.",
          },
          { status: 400 },
        );
      }
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    if (role === "student") {
      updateData.class = classId;
      updateData.academicSection = academicSectionId || undefined;
      updateData.classIds = undefined;
      updateData.academicSectionIds = undefined;
      updateData.subjectIds = undefined;
      updateData.hasAllClasses = false;
      updateData.hasAllSections = false;
      updateData.hasAllSubjects = false;
      updateData.rollNumber = rollNumber;
      updateData.enrolledAt = enrolledAt || undefined;
    } else {
      updateData.class = undefined;
      updateData.academicSection = undefined;
      updateData.rollNumber = undefined;
      updateData.enrolledAt = undefined;
      updateData.classIds = normalizedClassIds;
      updateData.academicSectionIds = allowAllSections
        ? []
        : normalizedAcademicSectionIds;
      updateData.subjectIds = normalizedSubjectIds;
      updateData.hasAllClasses = role === "admin" ? allowAllClasses : false;
      updateData.hasAllSections =
        role === "teacher" || role === "admin" ? allowAllSections : false;
      updateData.hasAllSubjects = role === "admin" ? allowAllSubjects : false;
    }

    const updatedUser = await UserModel.findOneAndUpdate({ _id: userId, ...buildArchiveFilter(false) }, updateData, {
      new: true,
      runValidators: true,
    }).select("-passwordHash");

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

  try {
    const userId = params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID" },
        { status: 400 },
      );
    }

    const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);

    const userToDelete = await UserModel.findById(userId);
    if (userToDelete && userToDelete.role === "admin") {
      const adminCount = await UserModel.countDocuments({ role: "admin", ...buildArchiveFilter(false) });
      if (adminCount <= 1) {
        return NextResponse.json(
          { success: false, message: "Cannot delete the last administrator." },
          { status: 409 },
        );
      }
    }

    const archivedUser = await UserModel.findOneAndUpdate(
      { _id: userId, ...buildArchiveFilter(false) },
      buildArchivedUpdate(),
      { new: true, runValidators: true },
    );
    if (!archivedUser) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: "user",
      entityId: String(archivedUser._id),
      entityLabel: String(archivedUser.name || ""),
      action: "archived",
      summary: `Archived user ${archivedUser.name}.`,
      details: { role: archivedUser.role },
    });

    return NextResponse.json({
      success: true,
      message: "User archived successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}
