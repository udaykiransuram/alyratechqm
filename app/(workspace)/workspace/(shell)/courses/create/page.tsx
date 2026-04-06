import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import ReturnBackButton from "@/components/navigation/ReturnBackButton";
import CourseEditorClient from "@/components/workspace/courses/CourseEditorClient";
import {
  getWorkspaceCourseById,
  getWorkspaceCourseSupportData,
} from "@/lib/server/workspace-courses";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


type CreateCoursePageProps = {
  searchParams?: Promise<{
    asTemplate?: string | string[];
    duplicateFrom?: string | string[];
    templateFrom?: string | string[];
    versionFrom?: string | string[];
  }>;
};

export default async function CreateCoursePage({
  searchParams,
}: CreateCoursePageProps) {
  const { schoolKey, viewerRole, viewerId } = await requireWorkspaceStaffSession();
  const resolvedSearchParams = await searchParams;
  const asTemplate = Array.isArray(resolvedSearchParams?.asTemplate)
    ? resolvedSearchParams.asTemplate[0]
    : resolvedSearchParams?.asTemplate;
  const duplicateFrom = Array.isArray(resolvedSearchParams?.duplicateFrom)
    ? resolvedSearchParams.duplicateFrom[0]
    : resolvedSearchParams?.duplicateFrom;
  const templateFrom = Array.isArray(resolvedSearchParams?.templateFrom)
    ? resolvedSearchParams.templateFrom[0]
    : resolvedSearchParams?.templateFrom;
  const versionFrom = Array.isArray(resolvedSearchParams?.versionFrom)
    ? resolvedSearchParams.versionFrom[0]
    : resolvedSearchParams?.versionFrom;
  const prefillSourceId = versionFrom || templateFrom || duplicateFrom;

  const [supportData, initialCourse] = await Promise.all([
    getWorkspaceCourseSupportData({
      schoolKey,
      viewerId,
      viewerRole,
    }),
    prefillSourceId
      ? getWorkspaceCourseById({
          schoolKey,
          courseId: prefillSourceId,
          viewerId,
          viewerRole,
        })
      : Promise.resolve(null),
  ]);
  const creationContext = versionFrom
    ? {
        mode: "template-version" as const,
        startAsTemplate: true,
        sourceCourseId: prefillSourceId,
        sourceCourseTitle: initialCourse?.title || null,
        sourceTemplateVersionNumber: initialCourse?.template.versionNumber || null,
      }
    : templateFrom
      ? {
          mode: "template" as const,
          startAsTemplate: false,
          sourceCourseId: prefillSourceId,
          sourceCourseTitle: initialCourse?.title || null,
          sourceTemplateVersionNumber: initialCourse?.template.versionNumber || null,
        }
      : duplicateFrom
        ? {
            mode: "duplicate" as const,
            startAsTemplate: false,
            sourceCourseId: prefillSourceId,
            sourceCourseTitle: initialCourse?.title || null,
            sourceTemplateVersionNumber: initialCourse?.template.versionNumber || null,
          }
        : {
            mode: "standard" as const,
            startAsTemplate:
              String(asTemplate || "").trim() === "1" ||
              String(asTemplate || "").trim().toLowerCase() === "true",
          };
  const pageTitle = versionFrom
    ? "Create Template Version"
    : templateFrom
      ? "Use Template"
      : duplicateFrom
        ? "Duplicate Course"
        : creationContext.startAsTemplate
          ? "Create Template"
          : "Create Course";
  const pageDescription = versionFrom
    ? "Create the next reusable version while keeping the template history connected."
    : templateFrom
      ? "Start from a reusable template and adapt the scope, dates, and content for students."
      : duplicateFrom
        ? "Start from an existing course and adapt the structure, scope, and content."
        : creationContext.startAsTemplate
          ? "Build a reusable starting point that teachers can use again across future courses."
          : "Build a guided course with explanations, media, and linked assessments.";

  return (
    <PageShell width="wide" padding="standard">
      <div className="app-course-page">
        <PageHero
          className="app-learning-hero"
          variant="editor"
          density="compact"
          eyebrow="Learning"
          title={pageTitle}
          description={pageDescription}
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
          creationContext={creationContext}
        />
      </div>
    </PageShell>
  );
}
