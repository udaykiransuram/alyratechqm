import EditAdminPageClient from "@/components/workspace/people-edit/EditAdminPageClient";
import { getWorkspacePeopleUserData } from "@/lib/server/workspace-people";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


type EditAdminPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditAdminPage({ params }: EditAdminPageProps) {
  const { id } = await params;
  const { schoolKey, viewerRole } = await requireWorkspaceStaffSession();

  if (viewerRole !== "admin") {
    return (
      <EditAdminPageClient
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
      <EditAdminPageClient
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
      <EditAdminPageClient
        userId={id}
        schoolKey={schoolKey}
        initialUser={null}
        initialClasses={[]}
        initialSections={[]}
        initialSubjects={[]}
        initialLoadError={error?.message || "Failed to load admin details."}
      />
    );
  }
}
