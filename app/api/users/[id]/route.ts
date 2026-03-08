import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const dynamic = 'force-dynamic';

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await connectDB();
  const url = new URL(req.url);
  const schoolFromHeader =
    req.headers.get("x-school-key") || req.headers.get("X-School-Key");
  const schoolFromQuery = url.searchParams.get("school");
  const schoolFromCookie = req.cookies?.get?.("schoolKey")?.value;
  const schoolKey = (
    schoolFromHeader ||
    schoolFromQuery ||
    schoolFromCookie ||
    ""
  )
    .toString()
    .trim();
  if (!schoolKey)
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  try {
    const userId = params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID" },
        { status: 400 },
      );
    }
    const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
    const user = await UserModel.findById(userId).select("-passwordHash");
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
  const url = new URL(req.url);
  const schoolFromHeader =
    req.headers.get("x-school-key") || req.headers.get("X-School-Key");
  const schoolFromQuery = url.searchParams.get("school");
  const schoolFromCookie = req.cookies?.get?.("schoolKey")?.value;
  const schoolKey = (
    schoolFromHeader ||
    schoolFromQuery ||
    schoolFromCookie ||
    ""
  )
    .toString()
    .trim();
  if (!schoolKey)
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
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
      class: classId,
      rollNumber,
      enrolledAt,
      email,
      password,
      mobileNumber,
      classIds,
      subjectIds,
      hasAllClasses,
      hasAllSubjects,
    } = await req.json();
    const normalizedMobileNumber = String(mobileNumber || "").trim();
    const normalizedClassIds = normalizeIds(classIds);
    const normalizedSubjectIds = normalizeIds(subjectIds);
    const allowAllClasses = Boolean(hasAllClasses);
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

    const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);

    // Prevent changing the role of the last admin
    const userToUpdate = await UserModel.findById(userId);
    if (userToUpdate && userToUpdate.role === "admin" && role !== "admin") {
      const adminCount = await UserModel.countDocuments({ role: "admin" });
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
      updateData.classIds = undefined;
      updateData.subjectIds = undefined;
      updateData.hasAllClasses = false;
      updateData.hasAllSubjects = false;
      updateData.rollNumber = rollNumber;
      if (enrolledAt) updateData.enrolledAt = enrolledAt;
    } else {
      updateData.class = undefined;
      updateData.rollNumber = undefined;
      updateData.enrolledAt = undefined;
      updateData.classIds = normalizedClassIds;
      updateData.subjectIds = normalizedSubjectIds;
      updateData.hasAllClasses = role === "admin" ? allowAllClasses : false;
      updateData.hasAllSubjects = role === "admin" ? allowAllSubjects : false;
    }

    const updatedUser = await UserModel.findByIdAndUpdate(userId, updateData, {
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
  const url = new URL(req.url);
  const schoolFromHeader =
    req.headers.get("x-school-key") || req.headers.get("X-School-Key");
  const schoolFromQuery = url.searchParams.get("school");
  const schoolFromCookie = req.cookies?.get?.("schoolKey")?.value;
  const schoolKey = (
    schoolFromHeader ||
    schoolFromQuery ||
    schoolFromCookie ||
    ""
  )
    .toString()
    .trim();
  if (!schoolKey)
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  try {
    const userId = params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID" },
        { status: 400 },
      );
    }

    const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);

    // Prevent deletion of the last admin user
    const userToDelete = await UserModel.findById(userId);
    if (userToDelete && userToDelete.role === "admin") {
      const adminCount = await UserModel.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return NextResponse.json(
          { success: false, message: "Cannot delete the last administrator." },
          { status: 409 },
        );
      }
    }

    const deletedUser = await UserModel.findByIdAndDelete(userId);
    if (!deletedUser) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}
