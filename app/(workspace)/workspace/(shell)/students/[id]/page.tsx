import StudentDetailPageClient from "@/components/workspace/people-detail/StudentDetailPageClient";
import { getWorkspacePeopleUserData } from "@/lib/server/workspace-people";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


type StudentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudentDetailPage({ params }: StudentDetailPageProps) {
  const { id } = await params;
  const { schoolKey, viewerRole } = await requireWorkspaceStaffSession();

  if (viewerRole !== "admin") {
    return (
      <StudentDetailPageClient
        studentId={id}
        initialUser={null}
        initialClasses={[]}
        initialSections={[]}
        initialAttempts={[]}
        initialLoadError="Forbidden"
      />
    );
  }

  try {
    const detailData = await getWorkspacePeopleUserData({
      schoolKey,
      userId: id,
      includeStudentAttempts: true,
      includeSubjects: false,
    });

    return (
      <StudentDetailPageClient
        studentId={id}
        initialUser={detailData.user}
        initialClasses={detailData.classes}
        initialSections={detailData.sections}
        initialAttempts={detailData.attempts}
      />
    );
  } catch (error) {
    return (
      <StudentDetailPageClient
        studentId={id}
        initialUser={null}
        initialClasses={[]}
        initialSections={[]}
        initialAttempts={[]}
        initialLoadError={
          error instanceof Error ? error.message : "Failed to load student details."
        }
      />
    );
  }
}
