import dynamicComponent from "next/dynamic";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import {
  getWorkspaceClasses,
  getWorkspaceSections,
} from "@/lib/server/workspace-support-data";
import {
  requireWorkspaceStaffSession,
  resolveWorkspaceListPage,
} from "@/lib/server/workspace-user-directory";
import {
  getStudentsByClassPageData,
  type StudentsByClassPageData,
} from "@/lib/server/workspace-students";

const StudentsPageClient = dynamicComponent(
  () => import("@/components/workspace/StudentsPageClient"),
);


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
  const { schoolKey, viewerRole } = await requireWorkspaceStaffSession();
  const resolvedSearchParams = await searchParams;

  const selectedClassId = String(readSearchValue(resolvedSearchParams.classId) || "").trim();
  const selectedSectionId = String(readSearchValue(resolvedSearchParams.sectionId) || "").trim();
  const searchQuery = String(readSearchValue(resolvedSearchParams.q) || "").trim();
  const includeEmpty =
    String(readSearchValue(resolvedSearchParams.includeEmpty) || "").trim() === "true";
  const requestedPage = resolveWorkspaceListPage(readSearchValue(resolvedSearchParams.page));

  const [classes, sections] = await Promise.all([
    getWorkspaceClasses(schoolKey),
    getWorkspaceSections(schoolKey),
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

  const clientClasses = (classes || []).map((classDoc) => ({
    _id: String(classDoc._id),
    name: String(classDoc.name || ""),
  }));
  const clientSections = (sections || []).map((sectionDoc) => ({
    _id: String(sectionDoc._id),
    name: String(sectionDoc.name || ""),
    class:
      sectionDoc.class && typeof sectionDoc.class === "object"
        ? {
            _id: String(sectionDoc.class._id || ""),
            name: String(sectionDoc.class.name || ""),
          }
        : sectionDoc.class
          ? String(sectionDoc.class)
          : undefined,
  }));
  const selectedClassLabel =
    selectedClassId && selectedClassId !== "all"
      ? clientClasses.find((classDoc) => classDoc._id === selectedClassId)?.name ||
        "Selected class"
      : "All Classes";
  const selectedSectionLabel =
    selectedSectionId && selectedSectionId !== "all"
      ? clientSections.find((sectionDoc) => sectionDoc._id === selectedSectionId)?.name ||
        "Selected section"
      : "All Sections";

  return (
    <PageShell width="wide" padding="standard" className="app-directory-stack">
      <PageHero
        variant="directory"
        eyebrow="People"
        title="Students"
        description="Browse students by class and section, then update assignments and enrollment details."
        actions={
          <Button asChild className="app-button-page">
            <AppPrefetchLink
              href="/workspace/students/create"
              prefetchOnMount
              relatedApiPrefetches={["/api/classes", "/api/sections"]}
            >
              Create Student
            </AppPrefetchLink>
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">{selectedClassLabel}</span>
            <span className="app-meta-chip">{selectedSectionLabel}</span>
            {includeEmpty ? (
              <span className="app-meta-chip">Showing empty groups</span>
            ) : null}
          </>
        }
        stats={[
          {
            label: "Total students",
            value: String(result.totalStudents || 0),
            meta: "Students currently returned by the active filters.",
          },
          {
            label: "Visible groups",
            value: String(result.totalGroups || 0),
            meta: "Class and section groupings on the active page window.",
          },
          {
            label: "Search query",
            value: searchQuery || "None",
            meta: "Name, father name, email, and roll-number search across student groups.",
          },
          {
            label: "Edit mode",
            value: "Inline ready",
            meta: "View, edit, export, and archive directly from the grouped list.",
          },
        ]}
      />

      <StudentsPageClient
        classes={clientClasses}
        sections={clientSections}
        groups={result.data || []}
        totalStudents={result.totalStudents || 0}
        totalGroups={result.totalGroups || 0}
        groupPage={result.page || 1}
        groupPages={result.pages || 1}
        viewerRole={viewerRole}
        initialClassFilter={selectedClassId || "all"}
        initialSectionFilter={selectedSectionId || "all"}
        initialQuery={searchQuery}
        includeEmpty={includeEmpty}
        loadError={loadError}
      />
    </PageShell>
  );
}
