import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import CourseFiltersPanel from "@/components/courses/CourseFiltersPanel";
import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { listStudentCourses } from "@/lib/server/student-courses";

export const runtime = "nodejs";
const COURSES_BASE_PATH = "/student/courses";

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

  if (!schoolKey || !studentId) {
    redirect("/auth/signin");
  }

  let courses: Awaited<ReturnType<typeof listStudentCourses>> = [];
  let courseOptions: Awaited<ReturnType<typeof listStudentCourses>> = [];
  let loadError: string | null = null;

  try {
    const [allCourses, filteredCourses] = await Promise.all([
      listStudentCourses({
        schoolKey,
        studentId,
        studentPlacement: {
          classId: session.user.studentClassId,
          academicSectionId: session.user.studentAcademicSectionId,
        },
      }),
      listStudentCourses({
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
      }),
    ]);
    courseOptions = allCourses;
    courses = filteredCourses;
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load courses.";
  }

  const classOptions = Array.from(
    new Map(
      courseOptions
        .filter((course) => course.class?._id)
        .map((course) => [course.class!._id, course.class!]),
    ).values(),
  ).map((item) => ({
    value: item._id,
    label: item.name,
  }));

  const sectionOptions = Array.from(
    new Map(
      courseOptions
        .flatMap((course) => course.assignedAcademicSections || [])
        .filter((section) => section?._id)
        .map((section) => [section._id, section]),
    ).values(),
  ).map((section) => ({
    value: section._id,
    label: section.name,
  }));

  const subjectOptions = Array.from(
    new Map(
      courseOptions
        .flatMap((course) => course.subjects || [])
        .filter((subject) => subject?._id)
        .map((subject) => [subject._id, subject]),
    ).values(),
  ).map((subject) => ({
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
        description="Open guided learning paths, continue where you left off, and complete the linked assessments."
        meta={
          <>
            <span className="app-meta-chip">Learning flow</span>
            <span className="app-meta-chip">Assessment-linked</span>
          </>
        }
        stats={[
          {
            label: "Courses",
            value: String(courses.length),
            meta: "Assigned to you.",
          },
          {
            label: "In progress",
            value: String(courses.filter((course) => course.status === "in_progress").length),
            meta: "Resume-ready.",
          },
          {
            label: "Completed",
            value: String(courses.filter((course) => course.status === "completed").length),
            meta: "Required assessments done.",
          },
          {
            label: "Required assessments",
            value: String(
              courses.reduce(
                (sum, course) => sum + Number(course.requiredAssessmentCount || 0),
                0,
              ),
            ),
            meta: "Across all assigned courses.",
          },
        ]}
      >
        <StudentPortalNav />
      </PageHero>

      {loadError ? (
        <div className="app-feedback app-feedback-error">{loadError}</div>
      ) : null}

      {!loadError && courses.length === 0 ? (
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>No courses assigned yet</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <p className="text-sm leading-6 text-muted-foreground">
              When your school publishes a course for your class, it will appear
              here.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!loadError && courses.length > 0 ? (
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
            {courses.map((course) => {
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
              const learningTools = [
                `${course.blockCount} blocks`,
                course.metadata.enforceSequentialProgress ? "Sequential" : null,
                course.metadata.allowNotes ? "Notes" : null,
                course.metadata.allowBookmarks ? "Bookmarks" : null,
                course.metadata.completionBadgeLabel || null,
              ].filter(Boolean) as string[];
              const scheduleSummary = `${
                startsAtLabel ? `Starts ${startsAtLabel}` : "Starts immediately"
              }${dueAtLabel ? ` • Due ${dueAtLabel}` : ""}`;
              const progressWidth = Math.max(
                0,
                Math.min(100, Number(course.completionPercent) || 0),
              );

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
                      <div className="app-course-badge-row">
                        <Badge variant="secondary" className="capitalize">
                          {course.status.replace("_", " ")}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {course.availabilityStatus.replace("_", " ")}
                        </Badge>
                        {course.class?.name ? (
                          <Badge variant="outline">{course.class.name}</Badge>
                        ) : null}
                        {course.subjects.slice(0, 1).map((subject) => (
                          <Badge key={subject._id} variant="outline">
                            {subject.name}
                          </Badge>
                        ))}
                        {course.subjects.length > 1 ? (
                          <Badge variant="outline">
                            +{course.subjects.length - 1} subjects
                          </Badge>
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
                      <div className="app-course-stat-strip">
                        <div className="app-course-stat-pill">
                          <p className="app-course-stat-pill-label">Progress</p>
                          <p className="app-course-stat-pill-value">{course.completionPercent}%</p>
                        </div>
                        <div className="app-course-stat-pill">
                          <p className="app-course-stat-pill-label">Assessments</p>
                          <p className="app-course-stat-pill-value">
                            {course.completedAssessmentCount} / {course.requiredAssessmentCount}
                          </p>
                        </div>
                        <div className="app-course-stat-pill">
                          <p className="app-course-stat-pill-label">Blocks</p>
                          <p className="app-course-stat-pill-value">{course.blockCount}</p>
                        </div>
                        <div className="app-course-stat-pill">
                          <p className="app-course-stat-pill-label">Mode</p>
                          <p className="app-course-stat-pill-value">
                            {course.metadata.enforceSequentialProgress ? "Guided" : "Flexible"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="app-course-stat-pill-label">Current status</p>
                          <p className="text-[11px] font-medium text-muted-foreground">
                            {availabilitySummary}
                          </p>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted/20">
                          <div
                            className="h-full rounded-full bg-primary transition-[width] duration-300"
                            style={{ width: `${progressWidth}%` }}
                          />
                        </div>
                      </div>

                      <div className="app-course-inline-meta">
                        <span>{availabilitySummary}</span>
                        <span>{sectionSummary}</span>
                        <span>
                          {course.completedAssessmentCount}/{course.requiredAssessmentCount} assessments
                        </span>
                      </div>

                      <div className="app-course-action-row">
                        <Button asChild className="app-button-compact-primary app-course-action-button">
                          <AppPrefetchLink href={`${COURSES_BASE_PATH}/${course._id}`}>
                            {course.status === "not_started"
                              ? "Start Course"
                              : course.status === "completed"
                                ? "Review Course"
                                : "Open Course"}
                          </AppPrefetchLink>
                        </Button>
                      </div>

                      <div className="app-course-hover-expand" aria-hidden="true">
                        <div className="app-course-hover-expand-grid">
                          <div className="app-course-detail-card">
                            <p className="app-course-detail-label">Schedule</p>
                            <p className="app-course-detail-value">{scheduleSummary}</p>
                          </div>
                          <div className="app-course-detail-card">
                            <p className="app-course-detail-label">Assessment Progress</p>
                            <p className="app-course-detail-value">
                              {course.completedAssessmentCount} completed • {course.requiredAssessmentCount} required
                            </p>
                          </div>
                        </div>

                        <div className="app-course-hover-expand-grid">
                          <div className="app-course-detail-card">
                            <p className="app-course-detail-label">All Subjects</p>
                            <div className="app-course-chip-cloud">
                              {course.subjects.map((subject) => (
                                <span key={`${course._id}-full-${subject._id}`} className="app-meta-chip">
                                  {subject.name}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="app-course-detail-card">
                              <p className="app-course-detail-label">All Sections</p>
                              {assignedSections.length > 0 ? (
                                <div className="app-course-chip-cloud">
                                  {assignedSections.map((section) => (
                                    <span key={`${course._id}-full-${section._id}`} className="app-meta-chip">
                                    {section.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="app-course-detail-value">
                                Assigned to all sections available to your class.
                              </p>
                            )}
                          </div>
                        </div>

                        {learningTools.length > 0 ? (
                          <div className="app-course-detail-card">
                            <p className="app-course-detail-label">All Learning Tools</p>
                            <div className="app-course-chip-cloud">
                              {learningTools.map((tool) => (
                                <span key={`${course._id}-full-tool-${tool}`} className="app-meta-chip">
                                  {tool}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
