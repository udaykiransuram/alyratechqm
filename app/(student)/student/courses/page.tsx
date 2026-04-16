import { ArrowRight } from "lucide-react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import CourseFiltersPanel from "@/components/courses/CourseFiltersPanel";
import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ListPaginationLinks from "@/components/ui/list-pagination-links";
import { authOptions } from "@/lib/auth";
import { listStudentCoursesPage } from "@/lib/server/student-courses";

export const runtime = "nodejs";
const COURSES_BASE_PATH = "/student/courses";
const COURSES_PAGE_SIZE = 12;

function formatCourseLabel(value?: string | null) {
  return String(value || "")
    .trim()
    .replace(/_/g, " ");
}

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

type StudentCoursesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function getPositiveIntParam(value: unknown, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function buildCoursesPageHref(params: {
  classId: string;
  sectionId: string;
  subjectId: string;
  query: string;
  page: number;
}) {
  const searchParams = new URLSearchParams();

  if (params.classId !== "all") {
    searchParams.set("classId", params.classId);
  }
  if (params.sectionId !== "all") {
    searchParams.set("sectionId", params.sectionId);
  }
  if (params.subjectId !== "all") {
    searchParams.set("subjectId", params.subjectId);
  }
  if (params.query.trim()) {
    searchParams.set("q", params.query.trim());
  }
  if (params.page > 1) {
    searchParams.set("page", String(params.page));
  }

  const query = searchParams.toString();
  return query ? `${COURSES_BASE_PATH}?${query}` : COURSES_BASE_PATH;
}

export default async function StudentCoursesPage({ searchParams }: StudentCoursesPageProps) {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    session.user.accountType !== "school_user" ||
    session.user.role !== "student"
  ) {
    redirect("/auth/signin");
  }

  const schoolKey = String(session.user.schoolKey || "").trim();
  const studentId = String(session.user.id || "").trim();
  const resolvedSearchParams = await searchParams;
  const selectedClassId = getSearchParam(resolvedSearchParams, "classId") || "all";
  const selectedSectionId =
    getSearchParam(resolvedSearchParams, "sectionId") || "all";
  const selectedSubjectId =
    getSearchParam(resolvedSearchParams, "subjectId") || "all";
  const searchQuery = getSearchParam(resolvedSearchParams, "q") || "";
  const requestedPage = getPositiveIntParam(
    getSearchParam(resolvedSearchParams, "page"),
    1,
  );
  const hasActiveFilters =
    selectedClassId !== "all" ||
    selectedSectionId !== "all" ||
    selectedSubjectId !== "all" ||
    searchQuery.trim().length > 0;

  if (!schoolKey || !studentId) {
    redirect("/auth/signin");
  }

  let courseList: Awaited<ReturnType<typeof listStudentCoursesPage>> = {
    items: [],
    total: 0,
    page: 1,
    pages: 1,
    limit: COURSES_PAGE_SIZE,
    filters: {},
    options: {
      classes: [],
      sections: [],
      subjects: [],
    },
    stats: {
      total: 0,
      inProgress: 0,
      completed: 0,
      requiredAssessments: 0,
    },
  };
  let loadError: string | null = null;

  try {
    courseList = await listStudentCoursesPage({
      schoolKey,
      studentId,
      studentPlacement: {
        classId: session.user.studentClassId,
        academicSectionId: session.user.studentAcademicSectionId,
      },
      filters: {
        classId: selectedClassId !== "all" ? selectedClassId : undefined,
        sectionId: selectedSectionId !== "all" ? selectedSectionId : undefined,
        subjectId: selectedSubjectId !== "all" ? selectedSubjectId : undefined,
        query: searchQuery,
      },
      page: requestedPage,
      limit: COURSES_PAGE_SIZE,
      includeOptions: true,
    });
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load courses.";
  }

  const classOptions = courseList.options.classes.map((item) => ({
    value: item._id,
    label: item.name,
  }));

  const sectionOptions = courseList.options.sections.map((section) => ({
    value: section._id,
    label: section.name,
  }));

  const subjectOptions = courseList.options.subjects.map((subject) => ({
    value: subject._id,
    label: subject.name,
  }));

  return (
    <div className="app-student-page-shell app-course-page">
      <PageHero
        className="app-learning-hero"
        eyebrow="Student Portal"
        title="Courses"
        variant="overview"
        density="compact"
        description="Continue your assigned learning paths."
      >
        <StudentPortalNav />
      </PageHero>

      {loadError ? (
        <div className="app-feedback app-feedback-error">{loadError}</div>
      ) : null}

      {!loadError && courseList.total === 0 ? (
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>
              {hasActiveFilters ? "No courses match these filters" : "No courses assigned yet"}
            </CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <p className="text-sm leading-6 text-muted-foreground">
              {hasActiveFilters
                ? "Try resetting one or more filters to broaden the results."
                : "When your school publishes a course for your class, it will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!loadError && (courseList.total > 0 || hasActiveFilters) ? (
        <div className="space-y-3">
          <CourseFiltersPanel
            classId={selectedClassId}
            classOptions={classOptions}
            sectionId={selectedSectionId}
            sectionOptions={sectionOptions}
            subjectId={selectedSubjectId}
            subjectOptions={subjectOptions}
            query={searchQuery}
            showClassFilter={classOptions.length > 1}
            showSectionFilter={sectionOptions.length > 1}
            showSubjectFilter={subjectOptions.length > 1}
            variant="embedded"
          />
          <div className="app-course-list-grid">
            {courseList.items.map((course) => {
              const startsAtLabel = formatCourseDate(course.metadata.startsAt);
              const dueAtLabel = formatCourseDate(course.metadata.dueAt);
              const assignedSections = course.assignedAcademicSections || [];
              const sectionSummary =
                assignedSections.length > 0
                  ? `${assignedSections.length} section${assignedSections.length === 1 ? "" : "s"}`
                  : course.class?.name
                    ? `All ${course.class.name} sections`
                    : "All sections";
              const availabilitySummary =
                course.availabilityStatus === "completed"
                  ? "Completed"
                  : dueAtLabel
                    ? `Due ${dueAtLabel}`
                    : startsAtLabel
                      ? `Starts ${startsAtLabel}`
                      : "Starts immediately";
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
                          {formatCourseLabel(course.status)}
                        </span>
                        {course.subjects.length > 0 ? (
                          <span className="app-course-meta-text">
                            {course.subjects.length} subject
                            {course.subjects.length === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                      <div className="space-y-1.5">
                        <CardTitle className="app-course-title">
                          {course.title}
                        </CardTitle>
                        <p className="app-course-summary app-course-summary-compact">
                          {course.summary || "No summary added yet."}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="app-course-list-body-compact">
                      <div className="app-course-inline-meta">
                        <span>{availabilitySummary}</span>
                        <span>Progress {course.completionPercent}%</span>
                        <span>{course.blockCount} blocks</span>
                      </div>
                      <div className="app-course-inline-meta">
                        <span>{sectionSummary}</span>
                        <span>
                          {course.metadata.enforceSequentialProgress
                            ? "Guided flow"
                            : "Flexible flow"}
                        </span>
                      </div>

                      <div className="app-course-action-row">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="app-row-action-button app-row-action-button-accent"
                          aria-label={`Open ${course.title}`}
                          title={`Open ${course.title}`}
                        >
                          <AppPrefetchLink
                            href={`${COURSES_BASE_PATH}/${course._id}`}
                            prefetchOnViewport={false}
                          >
                            {course.status === "not_started"
                              ? "Start Course"
                              : course.status === "completed"
                                ? "Review Course"
                                : "Open Course"}
                            <ArrowRight className="h-4 w-4" />
                          </AppPrefetchLink>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
          <ListPaginationLinks
            page={courseList.page}
            totalPages={courseList.pages}
            totalItems={courseList.total}
            pageSize={courseList.limit}
            itemLabel="courses"
            previousHref={
              courseList.page > 1
                ? buildCoursesPageHref({
                    classId: selectedClassId,
                    sectionId: selectedSectionId,
                    subjectId: selectedSubjectId,
                    query: searchQuery,
                    page: courseList.page - 1,
                  })
                : null
            }
            nextHref={
              courseList.page < courseList.pages
                ? buildCoursesPageHref({
                    classId: selectedClassId,
                    sectionId: selectedSectionId,
                    subjectId: selectedSubjectId,
                    query: searchQuery,
                    page: courseList.page + 1,
                  })
                : null
            }
          />
        </div>
      ) : null}
    </div>
  );
}
