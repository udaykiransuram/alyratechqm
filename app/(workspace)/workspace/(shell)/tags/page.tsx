import TagsPageClient from "@/components/workspace/TagsPageClient";
import { getWorkspaceTagsWithSubjects } from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

const INITIAL_TAG_BATCH_SIZE = 24;

export const dynamic = "force-dynamic";

export default async function TagsListPage() {
  const { schoolKey } = await requireWorkspaceStaffSession();

  try {
    const tagBrowser = await getWorkspaceTagsWithSubjects(schoolKey, {
      limit: INITIAL_TAG_BATCH_SIZE,
    });

    return (
      <TagsPageClient
        initialTags={tagBrowser.tags}
        initialTotal={tagBrowser.total}
        initialPartial={tagBrowser.partial}
      />
    );
  } catch (error) {
    return (
      <TagsPageClient
        initialTags={[]}
        initialTotal={0}
        initialPartial={false}
        initialError={error instanceof Error ? error.message : "Failed to load tags."}
      />
    );
  }
}
