import CreateSubjectPageClient from "./CreateSubjectPageClient";
import {
  getWorkspaceTags,
  getWorkspaceTagTypes,
} from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

export default async function CreateSubjectPage() {
  const { schoolKey } = await requireWorkspaceStaffSession();

  try {
    const [tags, tagTypes] = await Promise.all([
      getWorkspaceTags(schoolKey),
      getWorkspaceTagTypes(schoolKey),
    ]);

    return (
      <CreateSubjectPageClient
        initialAvailableTags={tags}
        initialTagTypes={tagTypes}
      />
    );
  } catch (error) {
    return (
      <CreateSubjectPageClient
        initialAvailableTags={[]}
        initialTagTypes={[]}
        initialMessage={
          error instanceof Error
            ? error.message
            : "Failed to load subject setup data."
        }
        initialMessageVariant="error"
      />
    );
  }
}
