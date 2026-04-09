import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { buildArchiveFilter } from "@/lib/archive";
import { requireTenantSession } from "@/lib/api-auth";
import { clearStudentSession } from "@/lib/redis";
import { invalidateStudentSessionValidationCache } from "@/lib/student-session-cache";
import { invalidateStudentTestResourceCache } from "@/lib/student-test-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeId(value: unknown) {
  return value ? String(value).trim() : "";
}

function invalidateStudentAccessCaches(params: {
  schoolKey: string;
  studentId: string;
  previousClassId?: string;
  nextClassId?: string;
}) {
  const { schoolKey, studentId, previousClassId = "", nextClassId = "" } = params;
  invalidateStudentSessionValidationCache({ schoolKey, studentId });
  invalidateStudentTestResourceCache({ schoolKey, studentId });

  if (previousClassId) {
    invalidateStudentTestResourceCache({ schoolKey, classId: previousClassId });
  }
  if (nextClassId && nextClassId !== previousClassId) {
    invalidateStudentTestResourceCache({ schoolKey, classId: nextClassId });
  }
}

export async function POST(req: NextRequest) {
  await connectDB();
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) return auth.response;
  const schoolKey = auth.schoolKey as string;

  const payload = (await req.json().catch(() => null)) as {
    studentIds?: unknown;
    classId?: unknown;
    academicSectionId?: unknown;
  } | null;

  if (!payload) {
    return NextResponse.json(
      { success: false, message: "Invalid payload." },
      { status: 400 },
    );
  }

  const studentIds = normalizeIds(payload.studentIds);
  const classId = normalizeId(payload.classId);
  const academicSectionId = normalizeId(payload.academicSectionId);

  if (studentIds.length === 0) {
    return NextResponse.json(
      { success: false, message: "Select at least one student." },
      { status: 400 },
    );
  }

  if (!mongoose.Types.ObjectId.isValid(classId)) {
    return NextResponse.json(
      { success: false, message: "Invalid classId." },
      { status: 400 },
    );
  }

  if (academicSectionId && !mongoose.Types.ObjectId.isValid(academicSectionId)) {
    return NextResponse.json(
      { success: false, message: "Invalid academicSectionId." },
      { status: 400 },
    );
  }

  const { User: UserModel, Class: ClassModel, AcademicSection: AcademicSectionModel } =
    await getTenantModels(schoolKey, ["User", "Class", "AcademicSection"]);

  const classDoc = await ClassModel.findOne({
    _id: new mongoose.Types.ObjectId(classId),
    ...buildArchiveFilter(false),
  }).select("_id");
  if (!classDoc) {
    return NextResponse.json(
      { success: false, message: "Class not found." },
      { status: 404 },
    );
  }

  if (academicSectionId) {
    const sectionDoc = await AcademicSectionModel.findOne({
      _id: new mongoose.Types.ObjectId(academicSectionId),
      ...buildArchiveFilter(false),
    }).select("_id class");
    if (!sectionDoc) {
      return NextResponse.json(
        { success: false, message: "Section not found." },
        { status: 404 },
      );
    }
    if (String((sectionDoc as any).class) !== String(classId)) {
      return NextResponse.json(
        { success: false, message: "Section does not belong to the class." },
        { status: 400 },
      );
    }
  }

  const students = await UserModel.find({
    _id: { $in: studentIds },
    role: "student",
    ...buildArchiveFilter(false),
  })
    .select("_id class academicSection")
    .lean();

  if (students.length === 0) {
    return NextResponse.json(
      { success: false, message: "No matching students found." },
      { status: 404 },
    );
  }

  const updateSet: Record<string, unknown> = {
    class: new mongoose.Types.ObjectId(classId),
    classIds: undefined,
    academicSectionIds: undefined,
    subjectIds: undefined,
    hasAllClasses: false,
    hasAllSections: false,
    hasAllSubjects: false,
  };

  if (academicSectionId) {
    updateSet.academicSection = new mongoose.Types.ObjectId(academicSectionId);
  }

  const update: Record<string, any> = {
    $set: updateSet,
    $unset: {
      activeStudentSessionId: 1,
      activeStudentSessionLastSeenAt: 1,
    },
  };

  if (!academicSectionId) {
    update.$unset.academicSection = 1;
  }

  const result = await UserModel.updateMany(
    { _id: { $in: students.map((student) => student._id) } },
    update,
  );

  await Promise.all(
    students.map(async (student: any) => {
      const studentId = String(student._id);
      const previousClassId = normalizeId(student.class);
      await clearStudentSession(schoolKey, studentId).catch(() => undefined);
      invalidateStudentAccessCaches({
        schoolKey,
        studentId,
        previousClassId,
        nextClassId: classId,
      });
    }),
  );

  return NextResponse.json({
    success: true,
    updated: typeof result.modifiedCount === "number" ? result.modifiedCount : students.length,
  });
}
