import CreateStudentPageClient from "./CreateStudentPageClient";
import {
  getWorkspaceClasses,
  getWorkspaceSections,
} from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


export default async function CreateStudentPage() {
  const { schoolKey } = await requireWorkspaceStaffSession();

  try {
    const [classes, sections] = await Promise.all([
      getWorkspaceClasses(schoolKey),
      getWorkspaceSections(schoolKey),
    ]);

    return (
      <CreateStudentPageClient
        initialClasses={classes}
        initialSections={sections}
      />
    );
  } catch (error) {
    return (
      <CreateStudentPageClient
        initialClasses={[]}
        initialSections={[]}
        initialMessage={
          error instanceof Error
            ? error.message
            : "Failed to load student setup data."
        }
      />
    );
  }
}
