import SubjectsPageClient from "@/components/workspace/SubjectsPageClient";
import { getWorkspaceSubjects } from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


export default async function ViewSubjectsPage() {
  const { schoolKey } = await requireWorkspaceStaffSession();

  try {
    const subjects = await getWorkspaceSubjects(schoolKey);
    return <SubjectsPageClient initialSubjects={subjects} />;
  } catch (error) {
    return (
      <SubjectsPageClient
        initialSubjects={[]}
        initialError={
          error instanceof Error ? error.message : "Failed to load subjects."
        }
      />
    );
  }
}
