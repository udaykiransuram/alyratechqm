import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  buildArchiveFilter,
  buildArchivedUpdate,
  resolveIncludeArchived,
} from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";
import { requireTenantSession } from "@/lib/api-auth";
import { clearStudentSession } from "@/lib/redis";
import { invalidateStudentSessionValidationCache } from "@/lib/student-session-cache";
import { invalidateStudentTestResourceCache } from "@/lib/student-test-server";
import {
  findStudentsByRollNumber,
  getDefaultStudentPassword,
  normalizeEmail,
  normalizeRollNumber,
  resolveStudentPasswordAdminInfo,
  resolveUserPasswordInput,
  validatePasswordInput,
  validateStudentDefaultPasswordSource,
} from "@/lib/user-credentials";
import { normalizeUserGender } from "@/lib/user-gender";

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

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

function resolveDuplicateUserMessage(error: unknown) {
  const keyPattern =
    typeof error === "object" && error !== null
      ? (error as { keyPattern?: Record<string, unknown> }).keyPattern
      : undefined;
  const keyValue =
    typeof error === "object" && error !== null
      ? (error as { keyValue?: Record<string, unknown> }).keyValue
      : undefined;
  const rawMessage =
    typeof error === "object" && error !== null
      ? String((error as { message?: unknown }).message || "")
      : "";

  if (keyPattern?.email || keyValue?.email) {
    return "A user with this email already exists.";
  }

  if (
    keyPattern?.rollNumber ||
    keyValue?.rollNumber ||
    rawMessage.includes("student_roll_unique_active_1")
  ) {
    return "Roll number must be unique within the school because students use it to sign in.";
  }

  return "A user with the same identity already exists.";
}

async function resetPersistedStudentSessionState(params: {
  UserModel: any;
  schoolKey: string;
  studentId: string;
}) {
  const { UserModel, schoolKey, studentId } = params;
  if (!schoolKey || !studentId) {
    return;
  }

  await clearStudentSession(schoolKey, studentId).catch(() => undefined);
  await UserModel.updateOne(
    { _id: studentId },
    {
      $unset: {
        activeStudentSessionId: 1,
        activeStudentSessionLastSeenAt: 1,
      },
    },
  ).catch(() => undefined);
}

function invalidateStudentAccessCaches(params: {
  schoolKey: string;
  studentId: string;
  previousClassId?: string;
  nextClassId?: string;
}) {
  const {
    schoolKey,
    studentId,
    previousClassId = "",
    nextClassId = "",
  } = params;

  invalidateStudentSessionValidationCache({
    schoolKey,
    studentId,
  });
  invalidateStudentTestResourceCache({
    schoolKey,
    studentId,
  });

  if (previousClassId) {
    invalidateStudentTestResourceCache({
      schoolKey,
      classId: previousClassId,
    });
  }

  if (nextClassId && nextClassId !== previousClassId) {
    invalidateStudentTestResourceCache({
      schoolKey,
      classId: nextClassId,
    });
  }
}

function resolveUserScope({
  role,
  classIds,
  academicSectionIds,
  subjectIds,
  hasAllClasses,
  hasAllSections,
  hasAllSubjects,
}: {
  role: string;
  classIds?: unknown;
  academicSectionIds?: unknown;
  subjectIds?: unknown;
  hasAllClasses?: unknown;
  hasAllSections?: unknown;
  hasAllSubjects?: unknown;
}) {
  const normalizedClassIds = normalizeIds(classIds);
  const normalizedAcademicSectionIds = normalizeIds(academicSectionIds);
  const normalizedSubjectIds = normalizeIds(subjectIds);
  let allowAllClasses = Boolean(hasAllClasses);
  let allowAllSections =
    typeof hasAllSections === "boolean" ? hasAllSections : role !== "student";
  let allowAllSubjects = Boolean(hasAllSubjects);

  if (
    role === "admin" &&
    !allowAllClasses &&
    !allowAllSubjects &&
    normalizedClassIds.length === 0 &&
    normalizedSubjectIds.length === 0
  ) {
    allowAllClasses = true;
    allowAllSections = true;
    allowAllSubjects = true;
  }

  return {
    normalizedClassIds,
    normalizedAcademicSectionIds,
    normalizedSubjectIds,
    allowAllClasses,
    allowAllSections,
    allowAllSubjects,
    scopedClassIds: role === "admin" && allowAllClasses ? [] : normalizedClassIds,
    scopedAcademicSectionIds:
      role !== "student" && allowAllSections ? [] : normalizedAcademicSectionIds,
    scopedSubjectIds:
      role === "admin" && allowAllSubjects ? [] : normalizedSubjectIds,
  };
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
  { params }: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) return auth.response;
  const schoolKey = auth.schoolKey as string;
  const { id: userId } = await params;

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID" },
        { status: 400 },
      );
    }
    const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
    const rawUser = await UserModel.findOne({
      _id: userId,
      ...buildArchiveFilter(resolveIncludeArchived(req.nextUrl)),
    }).lean();
    if (!rawUser) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    const user = {
      ...rawUser,
      passwordHash: undefined,
      ...(String(rawUser?.role || "") === "student"
        ? {
            studentPasswordInfo: await resolveStudentPasswordAdminInfo({
              mobileNumber: rawUser?.mobileNumber,
              passwordHash: rawUser?.passwordHash,
            }),
          }
        : {}),
    };
    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { success: false, message: resolveDuplicateUserMessage(error) },
        { status: 409 },
      );
    }

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
  await connectDB();
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) return auth.response;
  const schoolKey = auth.schoolKey as string;
  const { id: userId } = await params;

  try {
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
      gender,
      fatherName,
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
    const normalizedGender = normalizeUserGender(gender);
    const normalizedFatherName = String(fatherName || "").trim();
    const normalizedEmail = normalizeEmail(email);
    const normalizedRollNumber = normalizeRollNumber(rollNumber);
    const {
      normalizedClassIds,
      normalizedAcademicSectionIds,
      normalizedSubjectIds,
      allowAllClasses,
      allowAllSections,
      allowAllSubjects,
      scopedClassIds,
      scopedAcademicSectionIds,
      scopedSubjectIds,
    } = resolveUserScope({
      role,
      classIds,
      academicSectionIds,
      subjectIds,
      hasAllClasses,
      hasAllSections,
      hasAllSubjects,
    });

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
    if (role === "student") {
      const studentPasswordSourceValidation =
        validateStudentDefaultPasswordSource(normalizedMobileNumber);
      if (!studentPasswordSourceValidation.ok) {
        return NextResponse.json(
          {
            success: false,
            message: studentPasswordSourceValidation.message,
          },
          { status: 400 },
        );
      }
    }
    if (role === "student" && (!classId || !normalizedRollNumber)) {
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
    const { User: UserModel, AcademicSection: AcademicSectionModel } =
      await getTenantModels(schoolKey, ["User", "AcademicSection"]);

    if (role === "student" && classId && academicSectionId) {
      const sectionValidation = await validateStudentAcademicSection(
        AcademicSectionModel,
        classId,
        academicSectionId,
      );
      if (!sectionValidation.ok) return sectionValidation.response;
    }

    const userToUpdate = await UserModel.findOne({
      _id: userId,
      ...buildArchiveFilter(false),
    });
    if (!userToUpdate) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    const previousRole = String(userToUpdate.role || "");
    const previousClassId = normalizeId(userToUpdate.class);
    const previousAcademicSectionId = normalizeId(userToUpdate.academicSection);
    const previousRollNumber = normalizeRollNumber(userToUpdate.rollNumber);
    const previousMobileNumber = String(userToUpdate.mobileNumber || "").trim();

    if (userToUpdate && userToUpdate.role === "admin" && role !== "admin") {
      const adminCount = await UserModel.countDocuments({
        role: "admin",
        ...buildArchiveFilter(false),
      });
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
      gender: normalizedGender,
      fatherName:
        role === "student" ? normalizedFatherName || undefined : undefined,
    };

    if (typeof email !== "undefined") {
      if (normalizedEmail) {
        const existingEmailUser = await UserModel.findOne({
          email: normalizedEmail,
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
        updateData.email = normalizedEmail;
      } else {
        updateData.email = undefined;
      }
    }

    const explicitPasswordProvided =
      typeof password === "string" && password.trim().length > 0;
    if (role === "student" && explicitPasswordProvided) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Student passwords can only be changed by the student from the student account page.",
        },
        { status: 400 },
      );
    }

    const effectivePassword = resolveUserPasswordInput({
      role,
      rollNumber: normalizedRollNumber,
      mobileNumber: normalizedMobileNumber,
      password,
    });
    const passwordValidation = validatePasswordInput({
      role,
      rollNumber: normalizedRollNumber,
      mobileNumber: normalizedMobileNumber,
      password: effectivePassword,
    });
    if (!passwordValidation.ok) {
      return NextResponse.json(
        {
          success: false,
          message: passwordValidation.message,
        },
        { status: 400 },
      );
    }

    if (explicitPasswordProvided && effectivePassword) {
      updateData.passwordHash = await bcrypt.hash(effectivePassword, 10);
    } else if (role === "student") {
      const currentPasswordHash = String(userToUpdate?.passwordHash || "");
      const nextDefaultStudentPassword =
        getDefaultStudentPassword(normalizedMobileNumber);
      const previousDefaultStudentPassword = getDefaultStudentPassword(
        userToUpdate?.mobileNumber,
      );
      const shouldRestoreMissingPassword = !currentPasswordHash;
      let shouldSyncDefaultPassword = false;

      if (
        currentPasswordHash &&
        String(userToUpdate?.role || "") === "student" &&
        previousDefaultStudentPassword &&
        previousDefaultStudentPassword !== nextDefaultStudentPassword
      ) {
        try {
          shouldSyncDefaultPassword = await bcrypt.compare(
            previousDefaultStudentPassword,
            currentPasswordHash,
          );
        } catch {
          shouldSyncDefaultPassword = false;
        }
      }

      if (
        nextDefaultStudentPassword &&
        (shouldRestoreMissingPassword || shouldSyncDefaultPassword)
      ) {
        updateData.passwordHash = await bcrypt.hash(
          nextDefaultStudentPassword,
          10,
        );
      }
    }

    if (role === "student") {
      const rollNumberMatches = await findStudentsByRollNumber(
        UserModel,
        normalizedRollNumber,
        {
          excludeUserId: userId,
          limit: 1,
        },
      );
      if (rollNumberMatches.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Roll number must be unique within the school because students use it to sign in.",
          },
          { status: 409 },
        );
      }

      updateData.class = classId;
      updateData.academicSection = academicSectionId || undefined;
      updateData.classIds = undefined;
      updateData.academicSectionIds = undefined;
      updateData.subjectIds = undefined;
      updateData.hasAllClasses = false;
      updateData.hasAllSections = false;
      updateData.hasAllSubjects = false;
      updateData.rollNumber = normalizedRollNumber;
      updateData.enrolledAt = enrolledAt || undefined;
    } else {
      updateData.class = undefined;
      updateData.academicSection = undefined;
      updateData.rollNumber = undefined;
      updateData.enrolledAt = undefined;
      updateData.classIds = scopedClassIds;
      updateData.academicSectionIds = scopedAcademicSectionIds;
      updateData.subjectIds = scopedSubjectIds;
      updateData.hasAllClasses = role === "admin" ? allowAllClasses : false;
      updateData.hasAllSections =
        role === "teacher" || role === "admin" ? allowAllSections : false;
      updateData.hasAllSubjects = role === "admin" ? allowAllSubjects : false;
    }

    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: userId, ...buildArchiveFilter(false) },
      updateData,
      {
        new: true,
        runValidators: true,
      },
    ).select("-passwordHash");

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 },
      );
    }

    const nextRole = String((updatedUser as any)?.role || "");
    const nextClassId = normalizeId((updatedUser as any)?.class);
    const nextAcademicSectionId = normalizeId(
      (updatedUser as any)?.academicSection,
    );
    const nextRollNumber = normalizeRollNumber((updatedUser as any)?.rollNumber);
    const shouldResetStudentSession =
      previousRole !== nextRole ||
      (previousRole === "student" &&
        nextRole === "student" &&
        (previousClassId !== nextClassId ||
          previousAcademicSectionId !== nextAcademicSectionId ||
          previousRollNumber !== nextRollNumber ||
          previousMobileNumber !== normalizedMobileNumber));

    if (previousRole === "student" || nextRole === "student") {
      if (shouldResetStudentSession) {
        await resetPersistedStudentSessionState({
          UserModel,
          schoolKey,
          studentId: String(userId),
        });
      }

      invalidateStudentAccessCaches({
        schoolKey,
        studentId: String(userId),
        previousClassId,
        nextClassId,
      });
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { success: false, message: resolveDuplicateUserMessage(error) },
        { status: 409 },
      );
    }

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
  await connectDB();
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) return auth.response;
  const schoolKey = auth.schoolKey as string;
  const { id: userId } = await params;

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { success: false, message: "Invalid user ID" },
        { status: 400 },
      );
    }

    const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);

    const userToDelete = await UserModel.findById(userId);
    if (userToDelete && userToDelete.role === "admin") {
      const adminCount = await UserModel.countDocuments({
        role: "admin",
        ...buildArchiveFilter(false),
      });
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

    if (String(archivedUser.role || "") === "student") {
      await resetPersistedStudentSessionState({
        UserModel,
        schoolKey,
        studentId: String(archivedUser._id),
      });
      invalidateStudentAccessCaches({
        schoolKey,
        studentId: String(archivedUser._id),
        previousClassId: normalizeId(archivedUser.class),
      });
    }

    return NextResponse.json({
      success: true,
      message: "User archived successfully",
    });
  } catch (error: any) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { success: false, message: resolveDuplicateUserMessage(error) },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}
