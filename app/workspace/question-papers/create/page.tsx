import CreateQuestionPaperPageClient from "./CreateQuestionPaperPageClient";
import {
  getWorkspaceClasses,
  getWorkspaceSections,
  getWorkspaceSubjects,
  getWorkspaceTagsWithSubjects,
} from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

export default async function CreateQuestionPaperPage() {
  const { schoolKey } = await requireWorkspaceStaffSession();

  try {
    const [classes, sections, subjects, tagResult] = await Promise.all([
      getWorkspaceClasses(schoolKey),
      getWorkspaceSections(schoolKey),
      getWorkspaceSubjects(schoolKey),
      getWorkspaceTagsWithSubjects(schoolKey),
    ]);

    return (
      <CreateQuestionPaperPageClient
        initialClasses={classes}
        initialSections={sections}
        initialSubjects={subjects}
        initialTags={tagResult.tags}
      />
    );
  } catch (error) {
    return (
      <CreateQuestionPaperPageClient
        initialClasses={[]}
        initialSections={[]}
        initialSubjects={[]}
        initialTags={[]}
        initialMessage={
          error instanceof Error
            ? error.message
            : "Failed to load question paper setup data."
        }
      />
    );
  }
}
