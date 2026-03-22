import ManageClassesClient from "@/components/workspace/ManageClassesClient";
import { getWorkspaceClasses } from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

export default async function ManageClassesPage() {
  const { schoolKey } = await requireWorkspaceStaffSession();

  try {
    const classes = await getWorkspaceClasses(schoolKey);
    return <ManageClassesClient initialClasses={classes} />;
  } catch (error) {
    return (
      <ManageClassesClient
        initialClasses={[]}
        initialError={
          error instanceof Error ? error.message : "Failed to load classes."
        }
      />
    );
  }
}
