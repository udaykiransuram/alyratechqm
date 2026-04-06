import ClassTagReportPageClient from "@/components/analytics/class-report/ClassTagReportPageClient";
import { getClassTagReportPageBootstrap } from "@/lib/analytics/class-tag-report-page";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


type ClassTagReportPageProps = {
  params: Promise<{ paperId: string }>;
  searchParams: Promise<{
    classId?: string | string[];
    academicSectionId?: string | string[];
    subjectId?: string | string[];
  }>;
};

function resolveSearchValue(value: string | string[] | undefined) {
  return String(Array.isArray(value) ? value[0] : value || "").trim();
}

export default async function ClassTagReportPage({
  params,
  searchParams,
}: ClassTagReportPageProps) {
  await requireWorkspaceStaffSession();

  const [{ paperId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const bootstrap = await getClassTagReportPageBootstrap({
    paperId,
    requestedClassId: resolveSearchValue(resolvedSearchParams.classId) || "all",
    requestedAcademicSectionId:
      resolveSearchValue(resolvedSearchParams.academicSectionId) || "all",
    requestedSubjectId:
      resolveSearchValue(resolvedSearchParams.subjectId) || "all",
  });

  return (
    <ClassTagReportPageClient
      paperId={paperId}
      initialGroupFields={bootstrap.groupFields}
      initialClassOptions={bootstrap.classOptions}
      initialAcademicSectionOptions={bootstrap.academicSectionOptions}
      initialSubjectOptions={bootstrap.subjectOptions}
      initialGroupBy={bootstrap.groupBy}
      initialSelectedClassId={bootstrap.selectedClassId}
      initialSelectedAcademicSectionId={bootstrap.selectedAcademicSectionId}
      initialSelectedSubjectId={bootstrap.selectedSubjectId}
      initialStats={bootstrap.stats}
      initialPaperTitle={bootstrap.paperTitle}
      initialLoadError={bootstrap.error}
    />
  );
}
