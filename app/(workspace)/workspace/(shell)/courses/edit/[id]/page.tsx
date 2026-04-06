import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import ReturnBackButton from "@/components/navigation/ReturnBackButton";
import CourseEditorClient from "@/components/workspace/courses/CourseEditorClient";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
import {
  getWorkspaceCourseById,
  getWorkspaceCourseSupportData,
} from "@/lib/server/workspace-courses";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


type EditCoursePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function EditCoursePage({
  params,
  searchParams,
}: EditCoursePageProps) {
  const { schoolKey, viewerRole, viewerId } = await requireWorkspaceStaffSession();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const rawReturnTo = Array.isArray(resolvedSearchParams?.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams?.returnTo;
  const returnToPath =
    getSafeReturnToPath(rawReturnTo) || `/workspace/courses/${id}`;

  const [supportData, course] = await Promise.all([
    getWorkspaceCourseSupportData({
      schoolKey,
      viewerId,
      viewerRole,
    }),
    getWorkspaceCourseById({
      schoolKey,
      courseId: id,
      viewerId,
      viewerRole,
    }),
  ]);

  if (!course) {
    return (
      <PageShell width="wide" padding="standard">
        <PageHero
          variant="editor"
          density="compact"
          eyebrow="Learning"
          title="Course"
          description="The requested course could not be loaded."
          actions={<ReturnBackButton fallbackPath="/workspace/courses" label="Back to Courses" />}
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide" padding="standard">
      <div className="app-course-page">
        <PageHero
          className="app-learning-hero"
          variant="editor"
          density="compact"
          eyebrow="Learning"
          title={`Edit ${course.title}`}
          description="Update the course structure, scope, and linked assessments."
          actions={<ReturnBackButton fallbackPath={returnToPath} label="Back" />}
          meta={
            <>
              <span className="app-meta-chip capitalize">{course.status}</span>
              {course.class?.name ? (
                <span className="app-meta-chip">{course.class.name}</span>
              ) : null}
              <span className="app-meta-chip">
                {course.blockCount} block{course.blockCount === 1 ? "" : "s"}
              </span>
            </>
          }
        />

        <CourseEditorClient
          mode="edit"
          courseId={id}
          returnToPath={returnToPath}
          classes={supportData.classes}
          sections={supportData.sections}
          subjects={supportData.subjects}
          papers={supportData.papers}
          initialCourse={course}
        />
      </div>
    </PageShell>
  );
}
