import CreateUserPageClient from "./CreateUserPageClient";
import {
  getWorkspaceClasses,
  getWorkspaceSections,
  getWorkspaceSubjects,
} from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


export default async function ManageUsersCreatePage() {
  const { schoolKey } = await requireWorkspaceStaffSession();

  try {
    const [classes, sections, subjects] = await Promise.all([
      getWorkspaceClasses(schoolKey),
      getWorkspaceSections(schoolKey),
      getWorkspaceSubjects(schoolKey),
    ]);

    return (
      <CreateUserPageClient
        initialClasses={classes}
        initialSections={sections}
        initialSubjects={subjects}
        initialSchoolKey={schoolKey}
      />
    );
  } catch (error) {
    return (
      <CreateUserPageClient
        initialClasses={[]}
        initialSections={[]}
        initialSubjects={[]}
        initialSchoolKey={schoolKey}
        initialMessage={
          error instanceof Error
            ? error.message
            : "We couldn't load the user setup data."
        }
      />
    );
  }
}
