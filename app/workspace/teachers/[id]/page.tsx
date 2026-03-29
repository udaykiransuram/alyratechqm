import TeacherDetailPageClient from "@/components/workspace/people-detail/TeacherDetailPageClient";
import { getWorkspacePeopleUserData } from "@/lib/server/workspace-people";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

type TeacherDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TeacherDetailPage({ params }: TeacherDetailPageProps) {
  const { id } = await params;
  const { schoolKey, viewerRole } = await requireWorkspaceStaffSession();

  if (viewerRole !== "admin") {
    return (
      <TeacherDetailPageClient
        teacherId={id}
        initialUser={null}
        initialClasses={[]}
        initialSections={[]}
        initialSubjects={[]}
        initialLoadError="Forbidden"
      />
    );
  }

  try {
    const detailData = await getWorkspacePeopleUserData({
      schoolKey,
      userId: id,
      includeSubjects: true,
      includeStudentAttempts: false,
    });

    return (
      <TeacherDetailPageClient
        teacherId={id}
        initialUser={detailData.user}
        initialClasses={detailData.classes}
        initialSections={detailData.sections}
        initialSubjects={detailData.subjects}
      />
    );
  } catch (error) {
    return (
      <TeacherDetailPageClient
        teacherId={id}
        initialUser={null}
        initialClasses={[]}
        initialSections={[]}
        initialSubjects={[]}
        initialLoadError={
          error instanceof Error ? error.message : "Failed to load teacher details."
        }
      />
    );
  }
}
