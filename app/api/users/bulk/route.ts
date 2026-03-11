import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

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
  await connectDB();
  try {
    const url = new URL(request.url);
    const schoolFromHeader =
      request.headers.get("x-school-key") ||
      request.headers.get("X-School-Key");
    const schoolFromQuery = url.searchParams.get("school");
    const schoolFromCookie = request.cookies?.get?.("schoolKey")?.value;
    const schoolKey = (
      schoolFromHeader ||
      schoolFromQuery ||
      schoolFromCookie ||
      ""
    )
      .toString()
      .trim();
    if (!schoolKey) {
      return NextResponse.json(
        { success: false, message: "schoolKey required" },
        { status: 400 },
      );
    }

    const {
      User,
      AcademicSection: AcademicSectionModel,
    } = await getTenantModels(schoolKey, ["User", "AcademicSection"]);

    const { students } = await request.json();
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
      const email = normalizedStudent.email
        ? String(normalizedStudent.email).trim()
        : undefined;
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
      const finalRollNumber =
        normalizedStudent.rollnumber || normalizedStudent.rollNumber;
      const finalMobileNumber =
        normalizedStudent.mobilenumber || normalizedStudent.mobileNumber;
      const normalizedClassIds = normalizeIds(normalizedStudent.classids);
      const normalizedAcademicSectionIds = normalizeIds(
        normalizedStudent.academicsectionids ?? normalizedStudent.sectionids,
      );
      const normalizedSubjectIds = normalizeIds(normalizedStudent.subjectids);
      const allowAllClasses = Boolean(normalizedStudent.hasallclasses);
      const allowAllSections =
        typeof normalizedStudent.hasallsections === "boolean"
          ? normalizedStudent.hasallsections
          : role !== "student";
      const allowAllSubjects = Boolean(normalizedStudent.hasallsubjects);

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
      if (
        role === "admin" &&
        ((!allowAllClasses && normalizedClassIds.length === 0) ||
          (!allowAllSubjects && normalizedSubjectIds.length === 0))
      ) {
        results.push({
          success: false,
          message:
            "Admins must have all classes/subjects enabled or choose at least one class and one subject.",
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

      if (role === "student" && finalRollNumber && classId) {
        const studentQuery: any = {
          role: "student",
          rollNumber: finalRollNumber,
          class: classId,
        };
        if (academicSectionId) {
          studentQuery.academicSection = academicSectionId;
        }
        const existingStudent = await User.findOne(studentQuery);
        if (existingStudent) {
          results.push({ success: true, user: existingStudent, existed: true });
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

      let passwordHash: string | undefined;
      if (password) {
        if (String(password).length < 6) {
          results.push({
            success: false,
            message: "Password must be at least 6 characters long.",
            student,
          });
          continue;
        }
        passwordHash = await bcrypt.hash(String(password), 10);
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
            ? normalizedClassIds
            : undefined,
        academicSectionIds:
          role === "teacher" || role === "admin"
            ? allowAllSections
              ? []
              : normalizedAcademicSectionIds
            : undefined,
        subjectIds:
          role === "teacher" || role === "admin"
            ? normalizedSubjectIds
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
