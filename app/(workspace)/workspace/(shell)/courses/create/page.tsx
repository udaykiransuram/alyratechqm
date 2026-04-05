import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import ReturnBackButton from "@/components/navigation/ReturnBackButton";
import CourseEditorClient from "@/components/workspace/courses/CourseEditorClient";
import {
  getWorkspaceCourseById,
  getWorkspaceCourseSupportData,
} from "@/lib/server/workspace-courses";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

type CreateCoursePageProps = {
  searchParams?: Promise<{ duplicateFrom?: string | string[] }>;
};

export default async function CreateCoursePage({
  searchParams,
}: CreateCoursePageProps) {
  const { schoolKey, viewerRole, viewerId } = await requireWorkspaceStaffSession();
  const resolvedSearchParams = await searchParams;
  const duplicateFrom = Array.isArray(resolvedSearchParams?.duplicateFrom)
    ? resolvedSearchParams.duplicateFrom[0]
    : resolvedSearchParams?.duplicateFrom;

  const [supportData, initialCourse] = await Promise.all([
    getWorkspaceCourseSupportData({
      schoolKey,
      viewerId,
      viewerRole,
    }),
    duplicateFrom
      ? getWorkspaceCourseById({
          schoolKey,
          courseId: duplicateFrom,
          viewerId,
          viewerRole,
        })
      : Promise.resolve(null),
  ]);
  const isDuplicatePrefill = Boolean(initialCourse);

  return (
    <PageShell width="wide" padding="standard">
      <div className="app-course-page">
        <PageHero
          className="app-learning-hero"
          variant="editor"
          density="compact"
          eyebrow="Learning"
          title={isDuplicatePrefill ? "Duplicate Course" : "Create Course"}
          description={
            isDuplicatePrefill
              ? "Start from an existing course and adapt the structure, scope, and content."
              : "Build a guided course with explanations, media, and linked assessments."
          }
          actions={
            <ReturnBackButton
              fallbackPath="/workspace/courses"
              label="Cancel"
            />
          }
          meta={
            <>
              <span className="app-meta-chip">Course builder</span>
              <span className="app-meta-chip">Student delivery ready</span>
            </>
          }
        />

        <CourseEditorClient
          mode="create"
          returnToPath="/workspace/courses"
          classes={supportData.classes}
          sections={supportData.sections}
          subjects={supportData.subjects}
          papers={supportData.papers}
          initialCourse={initialCourse}
        />
      </div>
    </PageShell>
  );
}
