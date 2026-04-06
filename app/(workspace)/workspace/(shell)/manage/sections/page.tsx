import ManageSectionsClient from "@/components/workspace/ManageSectionsClient";
import {
  getWorkspaceClasses,
  getWorkspaceSections,
} from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


export default async function ManageSectionsPage() {
  const { schoolKey } = await requireWorkspaceStaffSession();

  try {
    const [classes, sections] = await Promise.all([
      getWorkspaceClasses(schoolKey),
      getWorkspaceSections(schoolKey, { includeInactive: true }),
    ]);

    return (
      <ManageSectionsClient
        initialClasses={classes}
        initialSections={sections}
      />
    );
  } catch (error) {
    return (
      <ManageSectionsClient
        initialClasses={[]}
        initialSections={[]}
        initialError={
          error instanceof Error ? error.message : "Failed to load sections."
        }
      />
    );
  }
}
