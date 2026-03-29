import dynamicComponent from "next/dynamic";

import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  requireWorkspaceStaffSession,
  resolveWorkspaceListPage,
} from "@/lib/server/workspace-user-directory";
import {
  getStudentsByClassPageData,
  type StudentsByClassPageData,
} from "@/app/api/users/students-by-class/data";

const StudentsPageClient = dynamicComponent(
  () => import("@/components/workspace/StudentsPageClient"),
);

export const dynamic = "force-dynamic";

type StudentsPageProps = {
  searchParams: Promise<{
    classId?: string | string[];
    sectionId?: string | string[];
    q?: string | string[];
    includeEmpty?: string | string[];
    page?: string | string[];
  }>;
};

function readSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const { schoolKey } = await requireWorkspaceStaffSession();
  const resolvedSearchParams = await searchParams;

  const selectedClassId = String(readSearchValue(resolvedSearchParams.classId) || "").trim();
  const selectedSectionId = String(readSearchValue(resolvedSearchParams.sectionId) || "").trim();
  const searchQuery = String(readSearchValue(resolvedSearchParams.q) || "").trim();
  const includeEmpty =
    String(readSearchValue(resolvedSearchParams.includeEmpty) || "").trim() === "true";
  const requestedPage = resolveWorkspaceListPage(readSearchValue(resolvedSearchParams.page));

  await connectDB();
  const { Class: ClassModel, AcademicSection: AcademicSectionModel } =
    await getTenantModels(schoolKey, ["Class", "AcademicSection"]);

  const [classes, sections] = await Promise.all([
    ClassModel.find({ ...buildArchiveFilter(false) })
      .select("name")
      .sort({ name: 1 })
      .lean(),
    AcademicSectionModel.find({ ...buildArchiveFilter(false) })
      .select("name class")
      .sort({ name: 1 })
      .lean(),
  ]);

  let result: StudentsByClassPageData = {
    data: [],
    totalGroups: 0,
    totalStudents: 0,
    page: requestedPage,
    pages: 1,
    limit: 8,
  };
  let loadError: string | null = null;

  try {
    result = await getStudentsByClassPageData({
      schoolKey,
      query: {
        classId: selectedClassId,
        sectionId: selectedSectionId,
        q: searchQuery,
        includeEmpty,
        limit: 8,
        page: requestedPage,
      },
    });
  } catch (error: any) {
    loadError = error?.message || "Failed to load students.";
  }

  return (
    <StudentsPageClient
      classes={(classes || []).map((classDoc: any) => ({
        _id: String(classDoc._id),
        name: String(classDoc.name || ""),
      }))}
      sections={(sections || []).map((sectionDoc: any) => ({
        _id: String(sectionDoc._id),
        name: String(sectionDoc.name || ""),
        class: sectionDoc.class
          ? {
              _id: String((sectionDoc.class as any)?._id || sectionDoc.class),
              name: String((sectionDoc.class as any)?.name || ""),
            }
          : undefined,
      }))}
      groups={result.data || []}
      totalStudents={result.totalStudents || 0}
      totalGroups={result.totalGroups || 0}
      groupPage={result.page || 1}
      groupPages={result.pages || 1}
      initialClassFilter={selectedClassId || "all"}
      initialSectionFilter={selectedSectionId || "all"}
      initialQuery={searchQuery}
      includeEmpty={includeEmpty}
      loadError={loadError}
    />
  );
}
