import { ArrowRight, Copy, Edit, Eye, Plus } from "lucide-react";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import CourseFiltersClient from "@/components/courses/CourseFiltersClient";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ListPaginationLinks from "@/components/ui/list-pagination-links";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import {
  buildWorkspaceListPageHref,
  requireWorkspaceStaffSession,
  resolveWorkspaceListPage,
} from "@/lib/server/workspace-user-directory";
import {
  getWorkspaceCourseSupportData,
  listWorkspaceCourses,
} from "@/lib/server/workspace-courses";


const COURSES_BASE_PATH = "/workspace/courses";
const COURSES_PAGE_SIZE = 12;

type CourseLibraryView = "all" | "templates" | "courses";

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

function getSearchParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function resolveCourseLibraryView(value?: string | null): CourseLibraryView {
  switch (String(value || "").trim().toLowerCase()) {
    case "templates":
      return "templates";
    case "courses":
      return "courses";
    default:
      return "all";
  }
}

function buildCourseDirectoryHref(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  updates: Record<string, string | number | undefined>,
) {
  const nextSearchParams = new URLSearchParams();

  Object.entries(searchParams || {}).forEach(([key, rawValue]) => {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (typeof value === "string" && value.trim()) {
      nextSearchParams.set(key, value);
    }
  });

  Object.entries(updates).forEach(([key, rawValue]) => {
    const value =
      typeof rawValue === "number" ? String(rawValue) : String(rawValue || "").trim();

    if (!value || value === "all" || (key === "page" && value === "1")) {
      nextSearchParams.delete(key);
      return;
    }

    nextSearchParams.set(key, value);
  });

  const query = nextSearchParams.toString();
  return query ? `${COURSES_BASE_PATH}?${query}` : COURSES_BASE_PATH;
}

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const { schoolKey, viewerRole, viewerId } = await requireWorkspaceStaffSession();
  const resolvedSearchParams = await searchParams;
  const requestedPage = resolveWorkspaceListPage(resolvedSearchParams?.page);
  const selectedClassId = getSearchParam(resolvedSearchParams, "classId") || "all";
  const selectedSectionId =
    getSearchParam(resolvedSearchParams, "sectionId") || "all";
  const selectedSubjectId =
    getSearchParam(resolvedSearchParams, "subjectId") || "all";
  const searchQuery = getSearchParam(resolvedSearchParams, "q") || "";
  const selectedView = resolveCourseLibraryView(
    getSearchParam(resolvedSearchParams, "view"),
  );

  let courses: Awaited<ReturnType<typeof listWorkspaceCourses>>["courses"] = [];
  let totalCourses = 0;
  let page = requestedPage;
  let pages = 1;
  let error: string | null = null;
  let classOptions: Array<{ value: string; label: string }> = [];
  let sectionOptions: Array<{ value: string; label: string }> = [];
  let subjectOptions: Array<{ value: string; label: string }> = [];

  try {
    const [supportData, courseDirectory] = await Promise.all([
      getWorkspaceCourseSupportData({
        schoolKey,
        viewerId,
        viewerRole,
      }),
      listWorkspaceCourses({
        schoolKey,
        viewerId,
        viewerRole,
        page: requestedPage,
        limit: COURSES_PAGE_SIZE,
        filters: {
          classId: selectedClassId !== "all" ? selectedClassId : undefined,
          sectionId: selectedSectionId !== "all" ? selectedSectionId : undefined,
          subjectId: selectedSubjectId !== "all" ? selectedSubjectId : undefined,
          query: searchQuery,
          view: selectedView,
        },
      }),
    ]);
    courses = courseDirectory.courses;
    totalCourses = courseDirectory.total;
    page = courseDirectory.page;
    pages = courseDirectory.pages;

    classOptions = supportData.classes.map((item) => ({
      value: item._id,
      label: item.name,
    }));
    subjectOptions = supportData.subjects.map((item) => ({
      value: item._id,
      label: item.name,
    }));
    const scopedSections =
      selectedClassId !== "all"
        ? supportData.sections.filter((section) => {
            const sectionClassId =
              typeof section.class === "string"
                ? section.class
                : section.class?._id || "";
            return !sectionClassId || sectionClassId === selectedClassId;
          })
        : supportData.sections;
    sectionOptions = scopedSections.map((section) => ({
      value: section._id,
      label: section.name,
    }));
  } catch (loadError) {
    error =
      loadError instanceof Error
        ? loadError.message
        : "Failed to load courses.";
  }

  const currentPath = buildCourseDirectoryHref(resolvedSearchParams, {
    page,
    view: selectedView,
  });
  const baseDirectoryHref = buildCourseDirectoryHref(resolvedSearchParams, {
    page: 1,
    view: selectedView,
  });
  const previousHref =
    page > 1 ? buildWorkspaceListPageHref(baseDirectoryHref, page - 1) : null;
  const nextHref =
    page < pages
      ? buildWorkspaceListPageHref(baseDirectoryHref, page + 1)
      : null;
  const viewTabs = [
    {
      value: "all" as const,
      label: "All",
      href: buildCourseDirectoryHref(resolvedSearchParams, {
        view: "all",
        page: 1,
      }),
    },
    {
      value: "courses" as const,
      label: "Courses",
      href: buildCourseDirectoryHref(resolvedSearchParams, {
        view: "courses",
        page: 1,
      }),
    },
    {
      value: "templates" as const,
      label: "Templates",
      href: buildCourseDirectoryHref(resolvedSearchParams, {
        view: "templates",
        page: 1,
      }),
    },
  ];

  return (
    <PageShell width="wide" padding="standard">
      <div className="app-course-page">
        <PageHero
          className="app-learning-hero"
          variant="directory"
          density="compact"
          eyebrow="Learning"
          title={selectedView === "templates" ? "Course Templates" : "Courses"}
          description={
            selectedView === "templates"
              ? "Browse reusable course blueprints, create new versions, and start new student-ready courses from them."
              : "Create guided learning paths with text, video, images, and linked assessments for students."
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="app-button-page">
                <AppPrefetchLink href="/workspace/courses/create?asTemplate=1">
                  <Copy className="h-4 w-4" />
                  Create Template
                </AppPrefetchLink>
              </Button>
              <Button asChild className="app-button-page">
                <AppPrefetchLink href="/workspace/courses/create">
                  <Plus className="h-4 w-4" />
                  Create Course
                </AppPrefetchLink>
              </Button>
            </div>
          }
          meta={
            <>
              <span className="app-meta-chip">Teacher + admin authoring</span>
              <span className="app-meta-chip">
                {selectedView === "templates"
                  ? "Template library"
                  : "Student course delivery"}
              </span>
            </>
          }
          stats={[
            {
              label: selectedView === "templates" ? "Templates" : "Courses",
              value: String(totalCourses),
              meta:
                selectedView === "templates"
                  ? "Visible reusable blueprints in this workspace."
                  : "Visible in this school workspace.",
            },
            {
              label: "This page",
              value: String(courses.length),
              meta: `${courses.length} courses loaded in the current slice.`,
            },
            {
              label: selectedView === "templates" ? "Latest versions" : "Published",
              value: String(
                selectedView === "templates"
                  ? courses.filter((course) => course.metadata.isTemplate).length
                  : courses.filter((course) => course.status === "published").length,
              ),
              meta:
                selectedView === "templates"
                  ? "Template versions visible in the current page."
                  : "Published courses in the current page.",
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
              <CardTitle>
                {selectedView === "templates" ? "No templates yet" : "No courses yet"}
              </CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <p className="text-sm leading-6 text-muted-foreground">
                {selectedView === "templates"
                  ? "Create a reusable template so teachers can spin up new courses without rebuilding the full structure each time."
                  : "Start with a draft course and add text, videos, images, and a linked assessment flow for students."}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {!error && courses.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {viewTabs.map((tab) => (
                <Button
                  key={tab.value}
                  asChild
                  variant={selectedView === tab.value ? "default" : "outline"}
                  className="app-button-filter"
                >
                  <AppPrefetchLink href={tab.href}>{tab.label}</AppPrefetchLink>
                </Button>
              ))}
            </div>
            <CourseFiltersClient
              classId={selectedClassId}
              classOptions={classOptions}
              sectionId={selectedSectionId}
              sectionOptions={sectionOptions}
              subjectId={selectedSubjectId}
              subjectOptions={subjectOptions}
              query={searchQuery}
            />
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
                const templateFromHref = `${COURSES_BASE_PATH}/create?templateFrom=${encodeURIComponent(
                  course._id,
                )}`;
                const newVersionHref = `${COURSES_BASE_PATH}/create?versionFrom=${encodeURIComponent(
                  course._id,
                )}`;
                const startsAtLabel = formatCourseDate(course.metadata.startsAt);
                const dueAtLabel = formatCourseDate(course.metadata.dueAt);
                const sectionSummary =
                  course.assignedAcademicSections.length > 0
                    ? `${course.assignedAcademicSections.length} section${
                        course.assignedAcademicSections.length === 1 ? "" : "s"
                      }`
                    : "All sections";
                const availabilitySummary = dueAtLabel
                  ? `Due ${dueAtLabel}`
                  : startsAtLabel
                    ? `Starts ${startsAtLabel}`
                    : "Open now";
                const learningTools = [
                  course.metadata.enforceSequentialProgress ? "Sequential" : null,
                  course.metadata.allowNotes ? "Notes" : null,
                  course.metadata.allowBookmarks ? "Bookmarks" : null,
                  course.metadata.completionBadgeLabel || null,
                ].filter(Boolean) as string[];
                return (
                  <div key={course._id} className="app-course-card-wrap">
                    <Card className="app-course-list-card app-course-list-card-compact flex flex-col">
                      <div className="app-course-list-cover-shell">
                        {course.metadata.coverImageUrl ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={course.metadata.coverImageUrl}
                              alt={course.metadata.coverImageAltText || course.title}
                              className="app-course-list-cover"
                            />
                          </>
                        ) : (
                          <div
                            aria-hidden="true"
                            className="app-course-list-cover app-course-list-cover-placeholder"
                          />
                        )}
                      </div>
                      <CardHeader className="app-course-list-header-compact">
                        <div className="app-course-meta-row">
                          <span className="app-course-meta-text capitalize">
                            {course.status}
                          </span>
                          {course.class?.name ? (
                            <span className="app-course-meta-text">{course.class.name}</span>
                          ) : null}
                          {course.subjects.length > 0 ? (
                            <span className="app-course-meta-text">
                              {course.subjects.length} subject{course.subjects.length === 1 ? "" : "s"}
                            </span>
                          ) : null}
                          {course.metadata.isTemplate ? (
                            <span className="app-course-meta-text">
                              Template v{course.template.versionNumber || 1}
                            </span>
                          ) : course.template.derivedFromTemplateCourseId ? (
                            <span className="app-course-meta-text">
                              From template
                              {course.template.derivedFromTemplateVersionNumber
                                ? ` v${course.template.derivedFromTemplateVersionNumber}`
                                : ""}
                            </span>
                          ) : null}
                        </div>
                        <div className="space-y-1.5">
                          <CardTitle className="app-course-title">{course.title}</CardTitle>
                          <p className="app-course-summary app-course-summary-compact">
                            {course.summary || "No summary added yet."}
                          </p>
                        </div>
                      </CardHeader>
                      <CardContent className="app-course-list-body-compact">
                        <div className="app-course-inline-meta">
                          <span>Blocks {course.blockCount}</span>
                          <span>
                            Assessments {course.assessmentCount} total • {course.requiredAssessmentCount} required
                          </span>
                          <span>Subjects {course.subjects.length}</span>
                        </div>
                        <div className="app-course-inline-meta">
                          <span>{availabilitySummary}</span>
                          <span>{sectionSummary}</span>
                        </div>

                        <div className="app-course-action-row">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="app-row-action-button"
                            aria-label={course.metadata.isTemplate ? `View ${course.title} template` : `View ${course.title}`}
                            title={course.metadata.isTemplate ? "View template" : "View course"}
                          >
                            <AppPrefetchLink href={viewHref}>
                              <Eye className="h-4 w-4" />
                              View
                            </AppPrefetchLink>
                          </Button>
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="app-row-action-button app-row-action-button-accent"
                            aria-label={`Edit ${course.title}`}
                            title={`Edit ${course.title}`}
                          >
                            <AppPrefetchLink href={editHref}>
                              <Edit className="h-4 w-4" />
                              Edit
                            </AppPrefetchLink>
                          </Button>
                          {course.metadata.isTemplate ? (
                            <>
                              <Button
                                asChild
                                variant="outline"
                                className="app-button-compact-secondary app-course-action-button"
                              >
                                <AppPrefetchLink href={newVersionHref}>
                                  <Copy className="h-4 w-4" />
                                  New Version
                                </AppPrefetchLink>
                              </Button>
                              <Button
                                asChild
                                variant="outline"
                                className="app-button-compact-secondary app-course-action-button"
                              >
                                <AppPrefetchLink href={templateFromHref}>
                                  Use Template
                                </AppPrefetchLink>
                              </Button>
                            </>
                          ) : (
                            <>
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
                            </>
                          )}
                        </div>

                        {learningTools.length > 0 ? (
                          <div className="app-course-inline-meta">
                            <span>Tools</span>
                            <span>{learningTools.join(" • ")}</span>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
