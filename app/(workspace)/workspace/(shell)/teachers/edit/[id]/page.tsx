import EditTeacherPageClient from "@/components/workspace/people-edit/EditTeacherPageClient";
import { getWorkspacePeopleUserData } from "@/lib/server/workspace-people";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

type EditTeacherPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTeacherPage({ params }: EditTeacherPageProps) {
  const { id } = await params;
  const { schoolKey, viewerRole } = await requireWorkspaceStaffSession();

  if (viewerRole !== "admin") {
    return (
      <EditTeacherPageClient
        userId={id}
        schoolKey={schoolKey}
        initialUser={null}
        initialClasses={[]}
        initialSections={[]}
        initialSubjects={[]}
        initialLoadError="Forbidden"
      />
    );
  }

  try {
    const data = await getWorkspacePeopleUserData({
      schoolKey,
      userId: id,
      includeSubjects: true,
      includeStudentAttempts: false,
    });

    return (
      <EditTeacherPageClient
        userId={id}
        schoolKey={schoolKey}
        initialUser={data.user}
        initialClasses={data.classes}
        initialSections={data.sections}
        initialSubjects={data.subjects}
        initialLoadError={null}
      />
    );
  } catch (error: any) {
    return (
      <EditTeacherPageClient
        userId={id}
        schoolKey={schoolKey}
        initialUser={null}
        initialClasses={[]}
        initialSections={[]}
        initialSubjects={[]}
        initialLoadError={error?.message || "Failed to load teacher details."}
      />
    );
  }
}
