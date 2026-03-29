import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  buildArchiveFilter,
  buildRestoreUpdate,
  resolveIncludeArchived,
} from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";
import { requireTenantSession } from "@/lib/api-auth";
import {
  findStudentsByRollNumber,
  isSameStudentPlacement,
  normalizeEmail,
  normalizeRollNumber,
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

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) return auth.response;
  const schoolKey = auth.schoolKey as string;

  try {
    await connectDB();
    const url = new URL(req.url);
    const { searchParams } = url;
    const limitParam = Number(searchParams.get("limit") || "100");
    const pageParam = Number(searchParams.get("page") || "");
    const limit = Math.min(
      Math.max(isNaN(limitParam) ? 100 : limitParam, 1),
      500,
    );
    const page = !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;
    const skip = (page - 1) * limit;
    const role = searchParams.get("role");
    const rollNumber = searchParams.get("rollNumber");
    const classId = searchParams.get("classId");
    const academicSectionId = searchParams.get("academicSectionId");

    const query: any = {
      ...buildArchiveFilter(resolveIncludeArchived(req.nextUrl)),
    };
    if (role) query.role = role;
    if (rollNumber) query.rollNumber = rollNumber;
    if (classId) query.class = classId;
    if (academicSectionId) query.academicSection = academicSectionId;

    const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
    const total = await UserModel.countDocuments(query);
    const users = await UserModel.find(query)
      .select("-passwordHash")
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
    const pages = Math.max(1, Math.ceil(total / limit));
    return NextResponse.json({
      success: true,
      users,
      total,
      page,
      pages,
      limit,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  await connectDB();
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) return auth.response;
  const schoolKey = auth.schoolKey as string;

  try {
    const { User: UserModel, AcademicSection: AcademicSectionModel } =
      await getTenantModels(schoolKey, ["User", "AcademicSection"]);

    const body = await req.json();
    const name = String(body?.name || "").trim();
    const email = normalizeEmail(body?.email);
    const password = body?.password ? String(body.password) : undefined;
    const role = String(body?.role || "").trim();
    const gender = normalizeUserGender(body?.gender);
    const fatherName = String(body?.fatherName || "").trim();
    const classId = normalizeId(body?.classId ?? body?.class);
    const academicSectionId = normalizeId(
      body?.academicSectionId ??
        body?.academicSection ??
        body?.sectionId ??
        body?.section,
    );
    const rollNumber = normalizeRollNumber(body?.rollNumber);
    const enrolledAt = body?.enrolledAt;
    const mobileNumber = String(body?.mobileNumber || "").trim();
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
      classIds: body?.classIds,
      academicSectionIds: body?.academicSectionIds ?? body?.sectionIds,
      subjectIds: body?.subjectIds,
      hasAllClasses: body?.hasAllClasses,
      hasAllSections: body?.hasAllSections,
      hasAllSubjects: body?.hasAllSubjects,
    });

    if (!name || !role) {
      return NextResponse.json(
        { success: false, message: "Name and role are required." },
        { status: 400 },
      );
    }
    if (!mobileNumber) {
      return NextResponse.json(
        { success: false, message: "Phone number is required." },
        { status: 400 },
      );
    }
    if (role === "student" && !rollNumber) {
      return NextResponse.json(
        { success: false, message: "rollNumber is required for students." },
        { status: 400 },
      );
    }
    if (role === "student") {
      const studentPasswordSourceValidation =
        validateStudentDefaultPasswordSource(mobileNumber);
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
    if (role === "teacher") {
      if (
        normalizedClassIds.length === 0 ||
        normalizedSubjectIds.length === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Teachers must have at least one class and one subject.",
          },
          { status: 400 },
        );
      }
    }
    if (role === "student" && classId && academicSectionId) {
      const sectionValidation = await validateStudentAcademicSection(
        AcademicSectionModel,
        classId,
        academicSectionId,
      );
      if (!sectionValidation.ok) return sectionValidation.response;
    }

    if (role === "student" && rollNumber) {
      const existingStudents = await findStudentsByRollNumber(
        UserModel,
        rollNumber,
        { limit: 2 },
      );
      if (existingStudents.length > 0) {
        if (
          existingStudents.length === 1 &&
          isSameStudentPlacement(
            existingStudents[0],
            classId,
            academicSectionId,
          )
        ) {
          const { passwordHash: _, ...userResponse } =
            existingStudents[0].toObject();
          return NextResponse.json(
            { success: true, user: userResponse, existed: true },
            { status: 200 },
          );
        }

        return NextResponse.json(
          {
            success: false,
            message:
              "Roll number must be unique within the school because students use it to sign in.",
          },
          { status: 409 },
        );
      }
    }

    if (email) {
      const existingUser = await UserModel.findOne({
        email,
        ...buildArchiveFilter(false),
      });
      if (existingUser) {
        return NextResponse.json(
          { success: false, message: "A user with this email already exists." },
          { status: 409 },
        );
      }
    }

    const effectivePassword = resolveUserPasswordInput({
      role,
      rollNumber,
      mobileNumber,
      password,
    });
    const passwordValidation = validatePasswordInput({
      role,
      rollNumber,
      mobileNumber,
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

    let passwordHash: string | undefined;
    if (effectivePassword) {
      passwordHash = await bcrypt.hash(effectivePassword, 10);
    }

    if (role === "student" && rollNumber) {
      const studentMatches = await findStudentsByRollNumber(UserModel, rollNumber, {
        includeArchived: true,
      });
      const archivedStudent = studentMatches.find(
        (candidate: any) =>
          candidate.isArchived === true &&
          isSameStudentPlacement(candidate, classId, academicSectionId),
      );
      if (archivedStudent) {
        const restoredStudent = await UserModel.findByIdAndUpdate(
          archivedStudent._id,
          {
            ...buildRestoreUpdate(),
            name,
            email,
            passwordHash,
            role,
            mobileNumber,
            gender,
            fatherName: role === "student" ? fatherName || undefined : undefined,
            class: classId || undefined,
            academicSection: academicSectionId || undefined,
            classIds: undefined,
            academicSectionIds: undefined,
            subjectIds: undefined,
            hasAllClasses: false,
            hasAllSections: false,
            hasAllSubjects: false,
            rollNumber,
            enrolledAt: enrolledAt || Date.now(),
          },
          { new: true, runValidators: true },
        ).select("-passwordHash");

        await recordTenantAudit({
          schoolKey,
          req,
          entityType: "user",
          entityId: String(archivedStudent._id),
          entityLabel: name,
          action: "restored",
          summary: `Restored user ${name}.`,
          details: { role },
        });

        return NextResponse.json(
          { success: true, user: restoredStudent, existed: true },
          { status: 200 },
        );
      }
    }

    if (email) {
      const archivedUser = await UserModel.findOne({ email, isArchived: true });
      if (archivedUser) {
        const restoredUser = await UserModel.findByIdAndUpdate(
          archivedUser._id,
          {
            ...buildRestoreUpdate(),
            name,
            email,
            passwordHash,
            role,
            mobileNumber,
            gender,
            fatherName: role === "student" ? fatherName || undefined : undefined,
            class: role === "student" ? classId || undefined : undefined,
            academicSection:
              role === "student" ? academicSectionId || undefined : undefined,
            classIds:
              role === "teacher" || role === "admin"
                ? scopedClassIds
                : undefined,
            academicSectionIds:
              role === "teacher" || role === "admin"
                ? scopedAcademicSectionIds
                : undefined,
            subjectIds:
              role === "teacher" || role === "admin"
                ? scopedSubjectIds
                : undefined,
            hasAllClasses: role === "admin" ? allowAllClasses : false,
            hasAllSections:
              role === "teacher" || role === "admin" ? allowAllSections : false,
            hasAllSubjects: role === "admin" ? allowAllSubjects : false,
            rollNumber: role === "student" ? rollNumber : undefined,
            enrolledAt:
              role === "student" ? enrolledAt || Date.now() : undefined,
          },
          { new: true, runValidators: true },
        ).select("-passwordHash");

        await recordTenantAudit({
          schoolKey,
          req,
          entityType: "user",
          entityId: String(archivedUser._id),
          entityLabel: name,
          action: "restored",
          summary: `Restored user ${name}.`,
          details: { role },
        });

        return NextResponse.json(
          { success: true, user: restoredUser, existed: true },
          { status: 200 },
        );
      }
    }

    const newUserDoc = new UserModel({
      name,
      email,
      passwordHash,
      role,
      mobileNumber,
      gender,
      fatherName: role === "student" ? fatherName || undefined : undefined,
      class: role === "student" ? classId || undefined : undefined,
      academicSection:
        role === "student" ? academicSectionId || undefined : undefined,
      classIds:
        role === "teacher" || role === "admin" ? scopedClassIds : undefined,
      academicSectionIds:
        role === "teacher" || role === "admin"
          ? scopedAcademicSectionIds
          : undefined,
      subjectIds:
        role === "teacher" || role === "admin"
          ? scopedSubjectIds
          : undefined,
      hasAllClasses: role === "admin" ? allowAllClasses : false,
      hasAllSections:
        role === "teacher" || role === "admin" ? allowAllSections : false,
      hasAllSubjects: role === "admin" ? allowAllSubjects : false,
      rollNumber: role === "student" ? rollNumber : undefined,
      enrolledAt: role === "student" ? enrolledAt || Date.now() : undefined,
    });
    await newUserDoc.save();

    const { passwordHash: _, ...userResponse } = newUserDoc.toObject();

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: "user",
      entityId: String(newUserDoc._id),
      entityLabel: name,
      action: "created",
      summary: `Created user ${name}.`,
      details: { role },
    });

    return NextResponse.json(
      { success: true, user: userResponse },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}
