import QuestionEditorClient from "@/components/workspace/QuestionEditorClient";
import {
  getWorkspaceClasses,
  getWorkspaceSubjects,
  getWorkspaceTagsWithSubjects,
} from "@/lib/server/workspace-support-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

export default async function CreateQuestionPage() {
  const { schoolKey } = await requireWorkspaceStaffSession();

  try {
    const [classes, subjects, tagResult] = await Promise.all([
      getWorkspaceClasses(schoolKey),
      getWorkspaceSubjects(schoolKey),
      getWorkspaceTagsWithSubjects(schoolKey),
    ]);

    return (
      <QuestionEditorClient
        mode="create"
        initialClasses={classes}
        initialSubjects={subjects}
        initialTags={tagResult.tags}
      />
    );
  } catch (error) {
    return (
      <QuestionEditorClient
        mode="create"
        initialClasses={[]}
        initialSubjects={[]}
        initialTags={[]}
        initialMessage={
          error instanceof Error
            ? error.message
            : "Failed to load question setup data."
        }
      />
    );
  }
}
