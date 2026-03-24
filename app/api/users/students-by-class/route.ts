import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { buildArchiveFilter } from "@/lib/archive";
import { requireTenantSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function compareStudentNames(a: any, b: any) {
  return String(a?.name || "").localeCompare(String(b?.name || ""));
}

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  await connectDB();
  const url = new URL(req.url);

  try {
    const {
      Class: ClassModel,
      AcademicSection: AcademicSectionModel,
      User: UserModel,
    } = await getTenantModels(schoolKey, ["Class", "AcademicSection", "User"]);

    const classId = url.searchParams.get("classId")?.trim() || "";
    const sectionId = url.searchParams.get("sectionId")?.trim() || "";
    const q = url.searchParams.get("q")?.trim() || "";
    const includeEmpty =
      (url.searchParams.get("includeEmpty") || "false") === "true";
    const limitParam = Number(url.searchParams.get("limit") || "8");
    const limit = Math.min(
      24,
      Math.max(Number.isFinite(limitParam) ? Math.floor(limitParam) : 8, 1),
    );
    const pageParam = Number(url.searchParams.get("page") || "1");

    if (classId && !mongoose.Types.ObjectId.isValid(classId)) {
      return NextResponse.json(
        { success: false, message: "Invalid classId" },
        { status: 400 },
      );
    }

    if (sectionId && !mongoose.Types.ObjectId.isValid(sectionId)) {
      return NextResponse.json(
        { success: false, message: "Invalid sectionId" },
        { status: 400 },
      );
    }

    const classQuery: any = classId
      ? { _id: new mongoose.Types.ObjectId(classId), ...buildArchiveFilter(false) }
      : { ...buildArchiveFilter(false) };
    const classDocs = await ClassModel.find(classQuery)
      .select("name")
      .sort({ name: 1 })
      .lean();

    const classMap = new Map<string, any>(
      classDocs.map((classDoc: any) => [String(classDoc._id), classDoc]),
    );

    const sectionQuery: any = { ...buildArchiveFilter(false) };
    if (classId) {
      sectionQuery.class = new mongoose.Types.ObjectId(classId);
    }
    if (sectionId) {
      sectionQuery._id = new mongoose.Types.ObjectId(sectionId);
    }

    const sectionDocs = await AcademicSectionModel.find(sectionQuery)
      .select("name class")
      .sort({ name: 1 })
      .lean();

    const studentQuery: any = { role: "student", ...buildArchiveFilter(false) };
    if (classId) {
      studentQuery.class = new mongoose.Types.ObjectId(classId);
    }
    if (sectionId) {
      studentQuery.academicSection = new mongoose.Types.ObjectId(sectionId);
    }
    if (q) {
      const regex = new RegExp(q, "i");
      studentQuery.$or = [
        { name: { $regex: regex } },
        { email: { $regex: regex } },
        { rollNumber: { $regex: regex } },
      ];
    }

    const students = await UserModel.find(studentQuery)
      .select("name email rollNumber enrolledAt class academicSection")
      .sort({ name: 1 })
      .lean();

    const missingClassIds = Array.from(
      new Set(
        [
          ...sectionDocs.map((section: any) => String(section.class || "")),
          ...students.map((student: any) => String(student.class || "")),
        ].filter(
          (id) => id && !classMap.has(id),
        ),
      ),
    );

    if (missingClassIds.length > 0) {
      const extraClassDocs = await ClassModel.find({
        _id: { $in: missingClassIds },
        ...buildArchiveFilter(false),
      })
        .select("name")
        .lean();
      extraClassDocs.forEach((classDoc: any) => {
        classMap.set(String(classDoc._id), classDoc);
      });
    }

    const sectionMap = new Map<string, any>(
      sectionDocs.map((section: any) => [String(section._id), section]),
    );

    const missingSectionIds = Array.from(
      new Set(
        students
          .map((student: any) => String(student.academicSection || ""))
          .filter((id: string) => id && !sectionMap.has(id)),
      ),
    );

    if (missingSectionIds.length > 0) {
      const extraSections = await AcademicSectionModel.find({
        _id: { $in: missingSectionIds },
        ...buildArchiveFilter(false),
      })
        .select("name class")
        .lean();
      extraSections.forEach((section: any) => {
        sectionMap.set(String(section._id), section);
      });
    }

    const createGroup = ({
      groupId,
      classId: nextClassId,
      academicSectionId,
      academicSectionName,
    }: {
      groupId: string;
      classId: string;
      academicSectionId: string;
      academicSectionName: string;
    }) => {
      const className = classMap.get(nextClassId)?.name || "Unknown class";
      return {
        groupId,
        classId: nextClassId,
        className,
        academicSectionId,
        academicSectionName,
        groupName: `${className} • ${academicSectionName || "Unassigned"}`,
        count: 0,
        students: [] as any[],
      };
    };

    const groupsMap = new Map<string, any>();

    if (includeEmpty) {
      sectionDocs.forEach((section: any) => {
        const groupId = `section:${String(section._id)}`;
        groupsMap.set(
          groupId,
          createGroup({
            groupId,
            classId: String(section.class || ""),
            academicSectionId: String(section._id),
            academicSectionName: String(section.name || ""),
          }),
        );
      });
    }

    students.forEach((student: any) => {
      const studentClassId = String(student.class || "");
      const studentSectionId = String(student.academicSection || "");
      const sectionDoc = studentSectionId ? sectionMap.get(studentSectionId) : null;
      const resolvedClassId =
        String(sectionDoc?.class || "") || studentClassId;
      const groupId = studentSectionId
        ? `section:${studentSectionId}`
        : `unassigned:${resolvedClassId || "unknown"}`;

      if (!groupsMap.has(groupId)) {
        groupsMap.set(
          groupId,
          createGroup({
            groupId,
            classId: resolvedClassId,
            academicSectionId: studentSectionId,
            academicSectionName: studentSectionId
              ? String(sectionDoc?.name || "Unknown section")
              : "Unassigned",
          }),
        );
      }

      const group = groupsMap.get(groupId);
      group.students.push({
        _id: String(student._id),
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        enrolledAt: student.enrolledAt,
        academicSectionId: studentSectionId,
        academicSectionName: studentSectionId
          ? String(sectionDoc?.name || "Unknown section")
          : "Unassigned",
      });
      group.count = group.students.length;
    });

    const data = Array.from(groupsMap.values())
      .filter((group: any) => includeEmpty || group.count > 0)
      .map((group: any) => ({
        ...group,
        students: (group.students || []).sort(compareStudentNames),
      }))
      .sort((a: any, b: any) => {
        const classCompare = String(a.className || "").localeCompare(
          String(b.className || ""),
        );
        if (classCompare !== 0) return classCompare;
        const aUnassigned = a.academicSectionId ? 0 : 1;
        const bUnassigned = b.academicSectionId ? 0 : 1;
        if (aUnassigned !== bUnassigned) return aUnassigned - bUnassigned;
        return String(a.academicSectionName || "").localeCompare(
          String(b.academicSectionName || ""),
        );
      });

    const totalGroups = data.length;
    const totalStudents = students.length;
    const pages = Math.max(1, Math.ceil(totalGroups / limit));
    const page = Math.min(
      Math.max(Number.isFinite(pageParam) ? Math.floor(pageParam) : 1, 1),
      pages,
    );
    const start = (page - 1) * limit;
    const pagedData = data.slice(start, start + limit);

    return NextResponse.json({
      success: true,
      data: pagedData,
      totalGroups,
      totalStudents,
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
