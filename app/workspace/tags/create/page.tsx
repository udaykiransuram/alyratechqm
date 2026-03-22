import CreateTagPageClient from "./CreateTagPageClient";
import {
  getWorkspaceSubjects,
  getWorkspaceTagTypes,
} from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

export default async function CreateTagPage() {
  const { schoolKey } = await requireWorkspaceStaffSession();

  try {
    const [tagTypes, subjects] = await Promise.all([
      getWorkspaceTagTypes(schoolKey),
      getWorkspaceSubjects(schoolKey),
    ]);

    return (
      <CreateTagPageClient
        initialTagTypes={tagTypes}
        initialSubjects={subjects}
      />
    );
  } catch (error) {
    return (
      <CreateTagPageClient
        initialTagTypes={[]}
        initialSubjects={[]}
        initialMessage={
          error instanceof Error ? error.message : "Failed to load tag setup data."
        }
      />
    );
  }
}
