import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
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
      message: "Invalid academicSectionId.",
    } as const;
  }

  const academicSection = await AcademicSectionModel.findById(academicSectionId)
    .select("class")
    .lean();
  if (!academicSection) {
    return {
      ok: false,
      message: "Academic section not found.",
    } as const;
  }

  if (classId && String((academicSection as any).class) !== String(classId)) {
    return {
      ok: false,
      message: "Selected section does not belong to the selected class.",
    } as const;
  }

  return { ok: true } as const;
}

export async function POST(request: NextRequest) {
  const auth = await requireTenantSession(request, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  await connectDB();
  try {
    const schoolKey = auth.schoolKey as string;

    const {
      User,
      AcademicSection: AcademicSectionModel,
    } = await getTenantModels(schoolKey, ["User", "AcademicSection"]);

    const payload = await request.json();
    const students = Array.isArray(payload?.users)
      ? payload.users
      : payload?.students;
    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { success: false, message: "No students provided." },
        { status: 400 },
      );
    }

    const results: any[] = [];
    for (const student of students) {
      const normalizedStudent: any = {};
      Object.keys(student || {}).forEach((key) => {
        normalizedStudent[key.toLowerCase()] = (student as any)[key];
      });

      const name = String(normalizedStudent.name || "").trim();
      const email = normalizeEmail(normalizedStudent.email);
      const password = normalizedStudent.password
        ? String(normalizedStudent.password)
        : undefined;
      const role = String(normalizedStudent.role || "").trim();
      const classId = normalizeId(normalizedStudent.classid ?? normalizedStudent.class);
      const academicSectionId = normalizeId(
        normalizedStudent.academicsectionid ??
          normalizedStudent.academicsection ??
          normalizedStudent.sectionid ??
          normalizedStudent.section,
      );
      const finalRollNumber = normalizeRollNumber(
        normalizedStudent.rollnumber || normalizedStudent.rollNumber,
      );
      const finalMobileNumber =
        normalizedStudent.mobilenumber || normalizedStudent.mobileNumber;
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
        classIds: normalizedStudent.classids,
        academicSectionIds:
          normalizedStudent.academicsectionids ?? normalizedStudent.sectionids,
        subjectIds: normalizedStudent.subjectids,
        hasAllClasses: normalizedStudent.hasallclasses,
        hasAllSections: normalizedStudent.hasallsections,
        hasAllSubjects: normalizedStudent.hasallsubjects,
      });

      if (!name || !role) {
        results.push({
          success: false,
          message: "Name and role are required.",
          student,
        });
        continue;
      }
      if (role === "student" && !finalRollNumber) {
        results.push({
          success: false,
          message: "rollNumber is required for students.",
          student,
        });
        continue;
      }
      if (!finalMobileNumber || !String(finalMobileNumber).trim()) {
        results.push({
          success: false,
          message: "Phone number is required.",
          student,
        });
        continue;
      }
      if (role === "student") {
        const studentPasswordSourceValidation =
          validateStudentDefaultPasswordSource(finalMobileNumber);
        if (!studentPasswordSourceValidation.ok) {
          results.push({
            success: false,
            message: studentPasswordSourceValidation.message,
            student,
          });
          continue;
        }
      }
      if (
        role === "teacher" &&
        (normalizedClassIds.length === 0 || normalizedSubjectIds.length === 0)
      ) {
        results.push({
          success: false,
          message: "Teachers must have at least one class and one subject.",
          student,
        });
        continue;
      }
      if (role === "student" && classId && academicSectionId) {
        const sectionValidation = await validateStudentAcademicSection(
          AcademicSectionModel,
          classId,
          academicSectionId,
        );
        if (!sectionValidation.ok) {
          results.push({
            success: false,
            message: sectionValidation.message,
            student,
          });
          continue;
        }
      }

      if (role === "student" && finalRollNumber) {
        const existingStudents = await findStudentsByRollNumber(
          User,
          finalRollNumber,
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
            results.push({
              success: true,
              user: existingStudents[0],
              existed: true,
            });
            continue;
          }

          results.push({
            success: false,
            message:
              "Roll number must be unique within the school because students use it to sign in.",
            student,
          });
          continue;
        }
      }

      if (email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          results.push({
            success: false,
            message: "A user with this email already exists.",
            student,
          });
          continue;
        }
      }

      const effectivePassword = resolveUserPasswordInput({
        role,
        rollNumber: finalRollNumber,
        mobileNumber: String(finalMobileNumber).trim(),
        password,
      });
      const passwordValidation = validatePasswordInput({
        role,
        rollNumber: finalRollNumber,
        mobileNumber: String(finalMobileNumber).trim(),
        password: effectivePassword,
      });
      if (!passwordValidation.ok) {
        results.push({
          success: false,
          message: passwordValidation.message,
          student,
        });
        continue;
      }

      let passwordHash: string | undefined;
      if (effectivePassword) {
        passwordHash = await bcrypt.hash(String(effectivePassword), 10);
      }

      const newUser = new User({
        name,
        email,
        passwordHash,
        role,
        mobileNumber: String(finalMobileNumber).trim(),
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
        rollNumber: role === "student" ? finalRollNumber : undefined,
        enrolledAt:
          role === "student"
            ? normalizedStudent.enrolledat || Date.now()
            : undefined,
      });
      await newUser.save();
      results.push({ success: true, user: newUser });
    }

    const successCount = results.filter((result) => result.success).length;
    return NextResponse.json({ success: true, count: successCount, results });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}
