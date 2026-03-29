import EditStudentPageClient from "@/components/workspace/people-edit/EditStudentPageClient";
import { getWorkspacePeopleUserData } from "@/lib/server/workspace-people";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

type EditStudentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditStudentPage({ params }: EditStudentPageProps) {
  const { id } = await params;
  const { schoolKey, viewerRole } = await requireWorkspaceStaffSession();

  if (viewerRole !== "admin") {
    return (
      <EditStudentPageClient
        userId={id}
        schoolKey={schoolKey}
        initialUser={null}
        initialClasses={[]}
        initialSections={[]}
        initialLoadError="Forbidden"
      />
    );
  }

  try {
    const data = await getWorkspacePeopleUserData({
      schoolKey,
      userId: id,
      includeSubjects: false,
      includeStudentAttempts: false,
    });

    return (
      <EditStudentPageClient
        userId={id}
        schoolKey={schoolKey}
        initialUser={data.user}
        initialClasses={data.classes}
        initialSections={data.sections}
        initialLoadError={null}
      />
    );
  } catch (error: any) {
    return (
      <EditStudentPageClient
        userId={id}
        schoolKey={schoolKey}
        initialUser={null}
        initialClasses={[]}
        initialSections={[]}
        initialLoadError={error?.message || "Failed to load student details."}
      />
    );
  }
}
