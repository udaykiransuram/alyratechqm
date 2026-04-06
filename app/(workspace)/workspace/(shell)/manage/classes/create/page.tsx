import CreateClassPageClient from "./CreateClassPageClient";
import { getWorkspaceClasses } from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


export default async function ManageClassesCreatePage() {
  const { schoolKey } = await requireWorkspaceStaffSession();

  try {
    const classes = await getWorkspaceClasses(schoolKey);
    return (
      <CreateClassPageClient
        initialClasses={classes}
        initialSchoolKey={schoolKey}
      />
    );
  } catch (error) {
    return (
      <CreateClassPageClient
        initialClasses={[]}
        initialSchoolKey={schoolKey}
        initialMessage={
          error instanceof Error
            ? error.message
            : "We couldn't load the class setup data."
        }
      />
    );
  }
}
