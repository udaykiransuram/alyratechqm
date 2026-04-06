import CreateSectionPageClient from "./CreateSectionPageClient";
import {
  getWorkspaceClasses,
  getWorkspaceSections,
} from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


export default async function ManageSectionsCreatePage() {
  const { schoolKey } = await requireWorkspaceStaffSession();

  try {
    const [classes, sections] = await Promise.all([
      getWorkspaceClasses(schoolKey),
      getWorkspaceSections(schoolKey, { includeInactive: true }),
    ]);

    return (
      <CreateSectionPageClient
        initialClasses={classes}
        initialSections={sections}
        initialSchoolKey={schoolKey}
      />
    );
  } catch (error) {
    return (
      <CreateSectionPageClient
        initialClasses={[]}
        initialSections={[]}
        initialSchoolKey={schoolKey}
        initialMessage={
          error instanceof Error
            ? error.message
            : "We couldn't load the section setup data."
        }
      />
    );
  }
}
