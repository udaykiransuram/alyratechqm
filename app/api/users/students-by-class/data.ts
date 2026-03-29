import mongoose from "mongoose";

import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

type StudentItem = {
  _id: string;
  name: string;
  gender?: string;
  fatherName?: string;
  email?: string;
  mobileNumber?: string;
  rollNumber?: string;
  enrolledAt?: string;
  academicSectionId?: string;
  academicSectionName?: string;
};

type StudentGroup = {
  groupId: string;
  classId: string;
  className: string;
  academicSectionId?: string;
  academicSectionName?: string;
  groupName: string;
  count: number;
  students: StudentItem[];
};

export type StudentsByClassQuery = {
  classId?: string;
  sectionId?: string;
  q?: string;
  includeEmpty?: boolean;
  limit?: number;
  page?: number;
};

export type StudentsByClassPageData = {
  data: StudentGroup[];
  totalGroups: number;
  totalStudents: number;
  page: number;
  pages: number;
  limit: number;
};

function compareStudentNames(a: any, b: any) {
  return String(a?.name || "").localeCompare(String(b?.name || ""));
}

function createHttpError(message: string, status: number) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export async function getStudentsByClassPageData({
  schoolKey,
  query,
}: {
  schoolKey: string;
  query: StudentsByClassQuery;
}): Promise<StudentsByClassPageData> {
  await connectDB();

  const {
    Class: ClassModel,
    AcademicSection: AcademicSectionModel,
    User: UserModel,
  } = await getTenantModels(schoolKey, ["Class", "AcademicSection", "User"]);

  const classId = String(query.classId || "").trim();
  const sectionId = String(query.sectionId || "").trim();
  const q = String(query.q || "").trim();
  const includeEmpty = query.includeEmpty === true;

  const limitInput = Number(query.limit || 8);
  const limit = Math.min(
    24,
    Math.max(Number.isFinite(limitInput) ? Math.floor(limitInput) : 8, 1),
  );
  const pageInput = Number(query.page || 1);

  if (classId && !mongoose.Types.ObjectId.isValid(classId)) {
    throw createHttpError("Invalid classId", 400);
  }

  if (sectionId && !mongoose.Types.ObjectId.isValid(sectionId)) {
    throw createHttpError("Invalid sectionId", 400);
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
      { fatherName: { $regex: regex } },
      { email: { $regex: regex } },
      { rollNumber: { $regex: regex } },
    ];
  }

  const students = await UserModel.find(studentQuery)
    .select("name gender fatherName email mobileNumber rollNumber enrolledAt class academicSection")
    .sort({ name: 1 })
    .lean();

  const missingClassIds = Array.from(
    new Set(
      [
        ...sectionDocs.map((section: any) => String(section.class || "")),
        ...students.map((student: any) => String(student.class || "")),
      ].filter((id) => id && !classMap.has(id)),
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
    nextClassId,
    academicSectionId,
    academicSectionName,
  }: {
    groupId: string;
    nextClassId: string;
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
      students: [] as StudentItem[],
    };
  };

  const groupsMap = new Map<string, StudentGroup>();

  if (includeEmpty) {
    sectionDocs.forEach((section: any) => {
      const groupId = `section:${String(section._id)}`;
      groupsMap.set(
        groupId,
        createGroup({
          groupId,
          nextClassId: String(section.class || ""),
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
    const resolvedClassId = String(sectionDoc?.class || "") || studentClassId;
    const groupId = studentSectionId
      ? `section:${studentSectionId}`
      : `unassigned:${resolvedClassId || "unknown"}`;

    if (!groupsMap.has(groupId)) {
      groupsMap.set(
        groupId,
        createGroup({
          groupId,
          nextClassId: resolvedClassId,
          academicSectionId: studentSectionId,
          academicSectionName: studentSectionId
            ? String(sectionDoc?.name || "Unknown section")
            : "Unassigned",
        }),
      );
    }

    const group = groupsMap.get(groupId);
    if (!group) {
      return;
    }

    group.students.push({
      _id: String(student._id),
      name: student.name,
      gender: student.gender ? String(student.gender) : undefined,
      fatherName: student.fatherName,
      email: student.email,
      mobileNumber: student.mobileNumber,
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
    .filter((group) => includeEmpty || group.count > 0)
    .map((group) => ({
      ...group,
      students: [...(group.students || [])].sort(compareStudentNames),
    }))
    .sort((a, b) => {
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
    Math.max(Number.isFinite(pageInput) ? Math.floor(pageInput) : 1, 1),
    pages,
  );
  const start = (page - 1) * limit;
  const pagedData = data.slice(start, start + limit);

  return {
    data: pagedData,
    totalGroups,
    totalStudents,
    page,
    pages,
    limit,
  };
}
