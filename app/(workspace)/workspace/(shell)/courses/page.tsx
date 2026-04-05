import { ArrowRight, Copy, Plus } from "lucide-react";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ListPaginationLinks from "@/components/ui/list-pagination-links";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import {
  buildWorkspaceListPageHref,
  requireWorkspaceStaffSession,
  resolveWorkspaceListPage,
} from "@/lib/server/workspace-user-directory";
import { listWorkspaceCourses } from "@/lib/server/workspace-courses";

export const dynamic = "force-dynamic";

const COURSES_BASE_PATH = "/workspace/courses";
const COURSES_PAGE_SIZE = 12;

type CoursesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const { schoolKey, viewerRole, viewerId } = await requireWorkspaceStaffSession();
  const resolvedSearchParams = await searchParams;
  const requestedPage = resolveWorkspaceListPage(resolvedSearchParams?.page);

  let courses: Awaited<ReturnType<typeof listWorkspaceCourses>>["courses"] = [];
  let totalCourses = 0;
  let page = requestedPage;
  let pages = 1;
  let error: string | null = null;

  try {
    const courseDirectory = await listWorkspaceCourses({
      schoolKey,
      viewerId,
      viewerRole,
      page: requestedPage,
      limit: COURSES_PAGE_SIZE,
    });
    courses = courseDirectory.courses;
    totalCourses = courseDirectory.total;
    page = courseDirectory.page;
    pages = courseDirectory.pages;
  } catch (loadError) {
    error =
      loadError instanceof Error
        ? loadError.message
        : "Failed to load courses.";
  }

  const currentPath = buildWorkspaceListPageHref(COURSES_BASE_PATH, page);
  const previousHref =
    page > 1 ? buildWorkspaceListPageHref(COURSES_BASE_PATH, page - 1) : null;
  const nextHref =
    page < pages
      ? buildWorkspaceListPageHref(COURSES_BASE_PATH, page + 1)
      : null;

  return (
    <PageShell width="wide" padding="standard">
      <div className="app-course-page">
        <PageHero
          className="app-learning-hero"
          variant="directory"
          density="compact"
          eyebrow="Learning"
          title="Courses"
          description="Create guided learning paths with text, video, images, and linked assessments for students."
          actions={
            <Button asChild className="app-button-page">
              <AppPrefetchLink href="/workspace/courses/create">
                <Plus className="h-4 w-4" />
                Create Course
              </AppPrefetchLink>
            </Button>
          }
          meta={
            <>
              <span className="app-meta-chip">Teacher + admin authoring</span>
              <span className="app-meta-chip">Student course delivery</span>
            </>
          }
          stats={[
            {
              label: "Courses",
              value: String(totalCourses),
              meta: "Visible in this school workspace.",
            },
            {
              label: "This page",
              value: String(courses.length),
              meta: `${courses.length} courses loaded in the current slice.`,
            },
            {
              label: "Published",
              value: String(courses.filter((course) => course.status === "published").length),
              meta: "Published courses in the current page.",
            },
            {
              label: "Assessment-linked",
              value: String(
                courses.filter((course) => Number(course.assessmentCount) > 0).length,
              ),
              meta: "Courses reusing online tests.",
            },
          ]}
        />

        {error ? (
          <div className="app-feedback app-feedback-error">{error}</div>
        ) : null}

        {!error && totalCourses === 0 ? (
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>No courses yet</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <p className="text-sm leading-6 text-muted-foreground">
                Start with a draft course and add text, videos, images, and a linked
                assessment flow for students.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {!error && courses.length > 0 ? (
          <div className="space-y-3">
            <ListPaginationLinks
              page={page}
              totalPages={pages}
              totalItems={totalCourses}
              pageSize={COURSES_PAGE_SIZE}
              itemLabel="courses"
              previousHref={previousHref}
              nextHref={nextHref}
            />
            <div className="app-course-list-grid">
            {courses.map((course) => {
              const viewHref = buildHrefWithReturnTo(
                `${COURSES_BASE_PATH}/${course._id}`,
                currentPath,
              );
              const editHref = buildHrefWithReturnTo(
                `${COURSES_BASE_PATH}/edit/${course._id}`,
                `${COURSES_BASE_PATH}/${course._id}`,
              );
              const duplicateHref = `${COURSES_BASE_PATH}/create?duplicateFrom=${encodeURIComponent(
                course._id,
              )}`;
              const startsAtLabel = formatCourseDate(course.metadata.startsAt);
              const dueAtLabel = formatCourseDate(course.metadata.dueAt);

              return (
                <Card key={course._id} className="app-course-list-card flex flex-col">
                  {course.metadata.coverImageUrl ? (
                    <div className="app-course-list-cover-shell">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={course.metadata.coverImageUrl}
                        alt={course.metadata.coverImageAltText || course.title}
                        className="app-course-list-cover"
                      />
                    </div>
                  ) : null}
                  <CardHeader className="app-section-header space-y-2.5">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {course.status}
                        </Badge>
                        {course.class?.name ? (
                          <Badge variant="outline">{course.class.name}</Badge>
                        ) : null}
                        {course.subjects.map((subject) => (
                          <Badge key={subject._id} variant="outline">
                            {subject.name}
                          </Badge>
                        ))}
                        {course.metadata.isTemplate ? (
                          <Badge variant="outline">Template</Badge>
                        ) : null}
                      </div>
                      <CardTitle className="app-course-title">{course.title}</CardTitle>
                      <p className="app-course-summary">
                        {course.summary || "No summary added yet."}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="app-section-body flex flex-1 flex-col gap-4">
                    <div className="app-course-metric-grid">
                      <div className="app-course-metric-card">
                        <p className="app-course-metric-label">Blocks</p>
                        <p className="app-course-metric-value">{course.blockCount}</p>
                      </div>
                      <div className="app-course-metric-card">
                        <p className="app-course-metric-label">Assessments</p>
                        <p className="app-course-metric-value">
                          {course.assessmentCount} total • {course.requiredAssessmentCount} required
                        </p>
                      </div>
                      <div className="app-course-metric-card">
                        <p className="app-course-metric-label">Availability</p>
                        <p className="app-course-metric-value">
                          {startsAtLabel ? `Starts ${startsAtLabel}` : "Starts immediately"}
                          {dueAtLabel ? ` • Due ${dueAtLabel}` : ""}
                        </p>
                      </div>
                      <div className="app-course-metric-card">
                        <p className="app-course-metric-label">Learning tools</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {course.metadata.enforceSequentialProgress ? (
                            <Badge variant="outline">Sequential</Badge>
                          ) : null}
                          {course.metadata.allowNotes ? (
                            <Badge variant="outline">Notes</Badge>
                          ) : null}
                          {course.metadata.allowBookmarks ? (
                            <Badge variant="outline">Bookmarks</Badge>
                          ) : null}
                          {course.metadata.completionBadgeLabel ? (
                            <Badge variant="outline">
                              {course.metadata.completionBadgeLabel}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {course.assignedAcademicSections.length > 0 ? (
                      <div className="app-course-chip-cloud">
                        {course.assignedAcademicSections.map((section) => (
                          <span key={section._id} className="app-meta-chip">
                            {section.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Assigned to all sections in the selected class.
                      </p>
                    )}

                    <div className="app-course-action-row">
                      <Button
                        asChild
                        variant="outline"
                        className="app-button-compact-secondary app-course-action-button"
                      >
                        <AppPrefetchLink href={editHref}>Edit</AppPrefetchLink>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        className="app-button-compact-secondary app-course-action-button"
                      >
                        <AppPrefetchLink href={duplicateHref}>
                          <Copy className="h-4 w-4" />
                          Duplicate
                        </AppPrefetchLink>
                      </Button>
                      <Button asChild className="app-button-compact-primary app-course-action-button">
                        <AppPrefetchLink href={viewHref}>
                          View Course
                          <ArrowRight className="h-4 w-4" />
                        </AppPrefetchLink>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
