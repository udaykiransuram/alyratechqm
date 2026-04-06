import CreateAdminPageClient from "./CreateAdminPageClient";
import {
  getWorkspaceClasses,
  getWorkspaceSections,
  getWorkspaceSubjects,
} from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


export default async function CreateAdminPage() {
  const { schoolKey } = await requireWorkspaceStaffSession();

  try {
    const [classes, sections, subjects] = await Promise.all([
      getWorkspaceClasses(schoolKey),
      getWorkspaceSections(schoolKey),
      getWorkspaceSubjects(schoolKey),
    ]);

    return (
      <CreateAdminPageClient
        initialClasses={classes}
        initialSections={sections}
        initialSubjects={subjects}
      />
    );
  } catch (error) {
    return (
      <CreateAdminPageClient
        initialClasses={[]}
        initialSections={[]}
        initialSubjects={[]}
        initialMessage={
          error instanceof Error
            ? error.message
            : "Failed to load admin setup data."
        }
      />
    );
  }
}
