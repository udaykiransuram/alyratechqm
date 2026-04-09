import {
  ArrowLeft,
  Bell,
  BookOpen,
  Copy,
  Edit,
  ExternalLink,
  FileQuestion,
  FileText,
} from "lucide-react";

import StaticContentRenderer from "@/components/StaticContentRenderer";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import CourseResourcePreview from "@/components/courses/CourseResourcePreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCourseImageDisplayClasses } from "@/lib/courses/image-display";
import { buildYouTubeEmbedUrl } from "@/lib/courses/youtube";
import {
  buildHrefWithReturnTo,
  getSafeReturnToPath,
} from "@/lib/navigation/returnTo";
import { getWorkspaceCourseById } from "@/lib/server/workspace-courses";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


type WorkspaceCoursePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

function formatCourseDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function renderBlockBadge(type: string) {
  switch (type) {
    case "module":
      return "Module";
    case "lesson":
      return "Lesson";
    case "text":
      return "Text";
    case "image":
      return "Image";
    case "youtube":
      return "Video";
    case "resource":
      return "Resource";
    case "announcement":
      return "Announcement";
    default:
      return "Assessment";
  }
}

function getBlockIcon(type: string) {
  switch (type) {
    case "module":
      return BookOpen;
    case "lesson":
      return FileText;
    case "text":
      return FileText;
    case "image":
      return FileText;
    case "youtube":
      return FileText;
    case "resource":
      return FileText;
    case "announcement":
      return Bell;
    default:
      return FileQuestion;
  }
}

export default async function WorkspaceCoursePage({
  params,
  searchParams,
}: WorkspaceCoursePageProps) {
  const { schoolKey, viewerRole, viewerId } = await requireWorkspaceStaffSession();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const rawReturnTo = Array.isArray(resolvedSearchParams?.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams?.returnTo;
  const backHref = getSafeReturnToPath(rawReturnTo) || "/workspace/courses";

  const course = await getWorkspaceCourseById({
    schoolKey,
    courseId: id,
    viewerId,
    viewerRole,
  });

  if (!course) {
    return (
      <PageShell width="wide" padding="standard">
        <PageHero
          className="app-learning-hero"
          variant="editor"
          density="compact"
          eyebrow="Learning"
          title="Course"
          description="The requested course could not be loaded."
          actions={
            <Button asChild variant="outline" className="app-button-back">
              <AppPrefetchLink href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </AppPrefetchLink>
            </Button>
          }
        />
      </PageShell>
    );
  }

  const currentPath = `/workspace/courses/${id}`;
  const editHref = buildHrefWithReturnTo(`/workspace/courses/edit/${id}`, currentPath);
  const duplicateHref = `/workspace/courses/create?duplicateFrom=${encodeURIComponent(id)}`;
  const templateFromHref = `/workspace/courses/create?templateFrom=${encodeURIComponent(id)}`;
  const newVersionHref = `/workspace/courses/create?versionFrom=${encodeURIComponent(id)}`;
  const previousVersionHref = course.template.parentCourseId
    ? `/workspace/courses/${encodeURIComponent(course.template.parentCourseId)}`
    : null;
  const sourceTemplateHref = course.template.derivedFromTemplateCourseId
    ? `/workspace/courses/${encodeURIComponent(course.template.derivedFromTemplateCourseId)}`
    : null;
  const startsAtLabel = formatCourseDate(course.metadata.startsAt);
  const dueAtLabel = formatCourseDate(course.metadata.dueAt);
  const learningStepCount = course.blocks.filter(
    (block) =>
      block.type === "lesson" ||
      block.type === "text" ||
      block.type === "image" ||
      block.type === "youtube" ||
      block.type === "resource",
  ).length;
  const assessmentCount = course.blocks.filter(
    (block) => block.type === "assessment",
  ).length;
  const requiredAssessmentCount = course.blocks.filter(
    (block) => block.type === "assessment" && block.required !== false,
  ).length;

  return (
    <PageShell width="wide" padding="standard">
      <div className="app-course-page">
        <PageHero
          className="app-learning-hero"
          variant="editor"
          density="compact"
          eyebrow="Learning"
          title={course.title}
          description={course.summary || "Course summary not added yet."}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="app-button-back">
                <AppPrefetchLink href={backHref}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </AppPrefetchLink>
              </Button>
              {course.metadata.isTemplate ? (
                <>
                  <Button
                    asChild
                    variant="outline"
                    className="app-button-page whitespace-nowrap"
                  >
                    <AppPrefetchLink href={newVersionHref}>
                      <Copy className="h-4 w-4" />
                      New Version
                    </AppPrefetchLink>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="app-button-page whitespace-nowrap"
                  >
                    <AppPrefetchLink href={templateFromHref}>Use Template</AppPrefetchLink>
                  </Button>
                </>
              ) : (
                <Button
                  asChild
                  variant="outline"
                  className="app-button-page whitespace-nowrap"
                >
                  <AppPrefetchLink href={duplicateHref}>
                    <Copy className="h-4 w-4" />
                    Duplicate
                  </AppPrefetchLink>
                </Button>
              )}
              <Button
                asChild
                variant="outline"
                size="sm"
                className="app-row-action-button app-row-action-button-accent"
                aria-label={course.metadata.isTemplate ? "Edit template" : "Edit course"}
                title={course.metadata.isTemplate ? "Edit template" : "Edit course"}
              >
                <AppPrefetchLink href={editHref}>
                  <Edit className="h-4 w-4" />
                  Edit
                </AppPrefetchLink>
              </Button>
            </div>
          }
          meta={
            <>
              <span className="app-meta-chip capitalize">{course.status}</span>
              {course.class?.name ? (
                <span className="app-meta-chip">{course.class.name}</span>
              ) : null}
              {course.subjects.map((subject) => (
                <span key={subject._id} className="app-meta-chip">
                  {subject.name}
                </span>
              ))}
              {course.metadata.isTemplate ? (
                <span className="app-meta-chip">
                  Template v{course.template.versionNumber || 1}
                </span>
              ) : course.template.derivedFromTemplateCourseId ? (
                <span className="app-meta-chip">
                  From template
                  {course.template.derivedFromTemplateVersionNumber
                    ? ` v${course.template.derivedFromTemplateVersionNumber}`
                    : ""}
                </span>
              ) : null}
              <span className="app-meta-chip">
                {course.blockCount} block{course.blockCount === 1 ? "" : "s"}
              </span>
            </>
          }
          stats={[
            {
              label: "Assigned students",
              value: String(course.progressSummary.assignedStudents),
              meta: "Learners in the course scope.",
            },
            {
              label: "Started",
              value: String(course.progressSummary.startedStudents),
              meta: "Students who opened the course or began linked work.",
            },
            {
              label: "Completed",
              value: String(course.progressSummary.completedStudents),
              meta: "Students who finished the guided flow.",
            },
            {
              label: "Average progress",
              value: `${course.progressSummary.averageCompletionPercent}%`,
              meta: "Across assigned students.",
            },
          ]}
        />

        <div className="app-course-detail-layout">
          <div className="space-y-4">
            {course.metadata.coverImageUrl ? (
              <Card className="app-course-cover-card">
                <div className="app-course-list-cover-shell border-b-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={course.metadata.coverImageUrl}
                    alt={course.metadata.coverImageAltText || course.title}
                    className="app-course-cover-image"
                  />
                </div>
              </Card>
            ) : null}

            {course.assignedAcademicSections.length > 0 ? (
              <Card className="app-surface overflow-hidden">
                <CardHeader className="app-section-header">
                  <CardTitle>Assigned Sections</CardTitle>
                </CardHeader>
                <CardContent className="app-section-body">
                  <div className="app-course-chip-cloud">
                    {course.assignedAcademicSections.map((section) => (
                      <span key={section._id} className="app-meta-chip">
                        {section.name}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {course.metadata.isTemplate || course.template.derivedFromTemplateCourseId ? (
              <Card className="app-surface overflow-hidden">
                <CardHeader className="app-section-header">
                  <CardTitle>
                    {course.metadata.isTemplate ? "Template Versioning" : "Template Source"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="app-section-body space-y-3">
                  {course.metadata.isTemplate ? (
                    <>
                      <p className="text-sm leading-6 text-muted-foreground">
                        This reusable template is stored as version{" "}
                        {course.template.versionNumber || 1}.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="app-meta-chip">
                          Family {course.template.familyId || "Not assigned"}
                        </span>
                        {previousVersionHref ? (
                          <Button asChild size="sm" variant="outline">
                            <AppPrefetchLink href={previousVersionHref}>
                              Previous version
                            </AppPrefetchLink>
                          </Button>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm leading-6 text-muted-foreground">
                        This course was created from a reusable template
                        {course.template.derivedFromTemplateVersionNumber
                          ? ` (version ${course.template.derivedFromTemplateVersionNumber})`
                          : ""}.
                      </p>
                      {sourceTemplateHref ? (
                        <Button asChild size="sm" variant="outline">
                          <AppPrefetchLink href={sourceTemplateHref}>
                            Open source template
                          </AppPrefetchLink>
                        </Button>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {course.blocks.map((block, index) => {
              const Icon = getBlockIcon(block.type);

              return (
                <Card key={block.id} className="app-course-block-card">
                  <CardHeader className="app-section-header">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{renderBlockBadge(block.type)}</Badge>
                            <span className="text-sm text-muted-foreground">
                              Block {index + 1}
                            </span>
                            {block.type === "assessment" && block.required !== false ? (
                              <Badge variant="outline">Required</Badge>
                            ) : null}
                          </div>
                          <CardTitle className="text-base">
                            {block.type === "module"
                              ? block.title
                              : block.type === "lesson"
                                ? block.title
                              : block.type === "resource"
                                ? block.title
                                : block.type === "announcement"
                                  ? block.title
                                  : block.type === "assessment"
                                    ? block.titleOverride || block.paper?.title || "Linked assessment"
                                    : block.type === "youtube"
                                      ? "Video lesson"
                                      : block.type === "image"
                                        ? "Image explanation"
                                        : "Learning content"}
                          </CardTitle>
                        </div>
                      </div>
                      {block.type === "assessment" && typeof block.minimumScorePct === "number" ? (
                        <Badge variant="outline">
                          Minimum {block.minimumScorePct}%
                        </Badge>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="app-section-body">
                    {block.type === "module" ? (
                      <div className="app-course-panel">
                        {block.summary ? (
                          <p className="text-sm leading-6 text-muted-foreground">
                            {block.summary}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            This module groups the next part of the learning flow.
                          </p>
                        )}
                      </div>
                    ) : null}

                    {block.type === "lesson" ? (
                      <div className="space-y-4">
                        {block.summary ? (
                          <div className="app-course-panel">
                            <p className="text-sm text-muted-foreground">{block.summary}</p>
                          </div>
                        ) : null}
                        {typeof block.estimatedMinutes === "number" ? (
                          <div className="app-course-panel">
                            <p className="text-sm text-muted-foreground">
                              Estimated time: {block.estimatedMinutes} min
                            </p>
                          </div>
                        ) : null}
                        {block.items.map((item, itemIndex) => (
                          <div key={`${block.id}-${itemIndex}`} className="space-y-3">
                            {item.type === "text" ? (
                              <StaticContentRenderer htmlContent={item.contentHtml} />
                            ) : null}

                            {item.type === "image" ? (
                              <div className="space-y-3">
                                <div
                                  className={
                                    getCourseImageDisplayClasses(item).wrapperClassName
                                  }
                                >
                                  <div
                                    className={
                                      getCourseImageDisplayClasses(item).frameClassName
                                    }
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={item.imageUrl}
                                      alt={item.altText || "Course image"}
                                      className={
                                        getCourseImageDisplayClasses(item).imageClassName
                                      }
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  </div>
                                </div>
                                {item.caption ? (
                                  <p className="text-sm text-muted-foreground">{item.caption}</p>
                                ) : null}
                              </div>
                            ) : null}

                            {item.type === "youtube" ? (
                              <div className="space-y-3">
                                <div className="app-course-media-frame">
                                  <div className="aspect-video w-full">
                                    <iframe
                                      title="Course video"
                                      src={buildYouTubeEmbedUrl(item.videoId)}
                                      className="h-full w-full"
                                      referrerPolicy="strict-origin-when-cross-origin"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                      loading="lazy"
                                    />
                                  </div>
                                </div>
                                {item.caption ? (
                                  <p className="text-sm text-muted-foreground">{item.caption}</p>
                                ) : null}
                              </div>
                            ) : null}

                            {item.type === "resource" ? (
                              <CourseResourcePreview
                                title={item.title}
                                fileUrl={item.fileUrl}
                                fileName={item.fileName}
                                caption={item.caption}
                              />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {block.type === "text" ? (
                      <StaticContentRenderer htmlContent={block.contentHtml} />
                    ) : null}

                    {block.type === "image" ? (
                      <div className="space-y-3">
                        <div className={getCourseImageDisplayClasses(block).wrapperClassName}>
                          <div className={getCourseImageDisplayClasses(block).frameClassName}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={block.imageUrl}
                              alt={block.altText || "Course image"}
                              className={getCourseImageDisplayClasses(block).imageClassName}
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                        </div>
                        {block.caption ? (
                          <p className="text-sm text-muted-foreground">{block.caption}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {block.type === "youtube" ? (
                      <div className="space-y-3">
                        <div className="app-course-media-frame">
                          <div className="aspect-video w-full">
                            <iframe
                              title="Course video"
                              src={buildYouTubeEmbedUrl(block.videoId)}
                              className="h-full w-full"
                              referrerPolicy="strict-origin-when-cross-origin"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              loading="lazy"
                            />
                          </div>
                        </div>
                        {block.caption ? (
                          <p className="text-sm text-muted-foreground">{block.caption}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {block.type === "resource" ? (
                      <CourseResourcePreview
                        title={block.title}
                        fileUrl={block.fileUrl}
                        fileName={block.fileName}
                        caption={block.caption}
                      />
                    ) : null}

                    {block.type === "announcement" ? (
                      <div className="app-course-panel">
                        <div className="mb-3 flex flex-wrap gap-2">
                          <Badge variant="outline" className="capitalize">
                            {block.tone}
                          </Badge>
                        </div>
                        <StaticContentRenderer htmlContent={block.contentHtml} />
                      </div>
                    ) : null}

                    {block.type === "assessment" ? (
                      <div className="space-y-3">
                        <div className="app-course-panel">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-2">
                              <p className="text-sm font-semibold text-foreground">
                                {block.titleOverride || block.paper?.title || "Linked assessment"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {block.paper?.duration || 0} min • {block.paper?.totalMarks || 0} marks
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {Array.isArray(block.paper?.subjects)
                                  ? block.paper.subjects.map((subject) => (
                                      <Badge key={subject._id} variant="outline">
                                        {subject.name}
                                      </Badge>
                                    ))
                                  : null}
                              </div>
                            </div>
                            {block.paper?._id ? (
                              <Button asChild variant="outline">
                                <AppPrefetchLink
                                  href={buildHrefWithReturnTo(
                                    `/workspace/question-papers/view/${block.paper._id}`,
                                    currentPath,
                                  )}
                                >
                                  Open Paper
                                  <ExternalLink className="h-4 w-4" />
                                </AppPrefetchLink>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="app-course-sidebar">
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Course Metadata</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body">
                <div className="app-course-metric-grid">
                  <div className="app-course-metric-card">
                    <p className="app-course-metric-label">
                      Starts
                    </p>
                    <p className="app-course-metric-value">
                      {startsAtLabel || "Immediately after publish"}
                    </p>
                  </div>
                  <div className="app-course-metric-card">
                    <p className="app-course-metric-label">
                      Due
                    </p>
                    <p className="app-course-metric-value">{dueAtLabel || "No due date"}</p>
                  </div>
                  <div className="app-course-metric-card sm:col-span-2">
                    <p className="app-course-metric-label">
                      Student tools
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {course.metadata.enforceSequentialProgress ? (
                        <Badge variant="outline">Sequential flow</Badge>
                      ) : null}
                      {course.metadata.allowNotes ? (
                        <Badge variant="outline">Notes enabled</Badge>
                      ) : null}
                      {course.metadata.allowBookmarks ? (
                        <Badge variant="outline">Bookmarks enabled</Badge>
                      ) : null}
                      {course.metadata.completionBadgeLabel ? (
                        <Badge variant="outline">
                          {course.metadata.completionBadgeLabel}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Delivery Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body">
                <div className="app-course-metric-grid">
                  <div className="app-course-metric-card">
                    <p className="app-course-metric-label">
                      Learning steps
                    </p>
                    <p className="app-course-metric-value">{learningStepCount}</p>
                  </div>
                  <div className="app-course-metric-card">
                    <p className="app-course-metric-label">
                      Assessments
                    </p>
                    <p className="app-course-metric-value">{assessmentCount}</p>
                  </div>
                  <div className="app-course-metric-card">
                    <p className="app-course-metric-label">
                      Required
                    </p>
                    <p className="app-course-metric-value">{requiredAssessmentCount}</p>
                  </div>
                  <div className="app-course-metric-card">
                    <p className="app-course-metric-label">
                      Overdue
                    </p>
                    <p className="app-course-metric-value">
                      {course.progressSummary.overdueStudents}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {course.progressSummary.assessmentSummaries.length > 0 ? (
              <Card className="app-surface overflow-hidden">
                <CardHeader className="app-section-header">
                  <CardTitle>Assessment Completion</CardTitle>
                </CardHeader>
                <CardContent className="app-section-body space-y-3">
                  {course.progressSummary.assessmentSummaries.map((assessment) => (
                    <div
                      key={assessment.blockId}
                      className="app-course-panel"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {assessment.required ? (
                          <Badge variant="outline">Required</Badge>
                        ) : (
                          <Badge variant="outline">Optional</Badge>
                        )}
                        {typeof assessment.minimumScorePct === "number" ? (
                          <Badge variant="outline">
                            Minimum {assessment.minimumScorePct}%
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {assessment.paperTitle}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {assessment.submittedStudents} submitted • {assessment.inProgressStudents} in progress
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
