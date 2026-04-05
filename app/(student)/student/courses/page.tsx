import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { listStudentCourses } from "@/lib/server/student-courses";

export const dynamic = "force-dynamic";

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

export default async function StudentCoursesPage() {
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

  if (!schoolKey || !studentId) {
    redirect("/auth/signin");
  }

  let courses: Awaited<ReturnType<typeof listStudentCourses>> = [];
  let loadError: string | null = null;

  try {
    courses = await listStudentCourses({
      schoolKey,
      studentId,
      studentPlacement: {
        classId: session.user.studentClassId,
        academicSectionId: session.user.studentAcademicSectionId,
      },
    });
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load courses.";
  }

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
        <div className="app-course-list-grid">
          {courses.map((course) => (
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
              <CardHeader className="app-section-header space-y-1.5">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-2">
                    <Badge className="capitalize">
                      {course.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {course.availabilityStatus.replace("_", " ")}
                    </Badge>
                    {course.class?.name ? (
                      <Badge variant="outline">{course.class.name}</Badge>
                    ) : null}
                    {course.metadata.completionBadgeLabel ? (
                      <Badge variant="outline">
                        {course.metadata.completionBadgeLabel}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1">
                    <CardTitle className="app-course-title">{course.title}</CardTitle>
                    <p className="app-course-summary">
                      {course.summary || "No summary added yet."}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="app-section-body flex flex-1 flex-col gap-3">
                <div className="app-course-metric-grid">
                  <div className="app-course-metric-card">
                    <p className="app-course-metric-label">Progress</p>
                    <p className="app-course-metric-value">{course.completionPercent}%</p>
                  </div>
                  <div className="app-course-metric-card">
                    <p className="app-course-metric-label">Assessments</p>
                    <p className="app-course-metric-value">
                      {course.completedAssessmentCount} / {course.requiredAssessmentCount} completed
                    </p>
                  </div>
                  <div className="app-course-metric-card">
                    <p className="app-course-metric-label">Availability</p>
                    <p className="app-course-metric-value">
                      {formatCourseDate(course.metadata.startsAt)
                        ? `Starts ${formatCourseDate(course.metadata.startsAt)}`
                        : "Starts immediately"}
                      {formatCourseDate(course.metadata.dueAt)
                        ? ` • Due ${formatCourseDate(course.metadata.dueAt)}`
                        : ""}
                    </p>
                  </div>
                  <div className="app-course-metric-card">
                    <p className="app-course-metric-label">Learning tools</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">{course.blockCount} blocks</Badge>
                      {course.metadata.enforceSequentialProgress ? (
                        <Badge variant="outline">Sequential</Badge>
                      ) : null}
                      {course.metadata.allowNotes ? (
                        <Badge variant="outline">Notes</Badge>
                      ) : null}
                      {course.metadata.allowBookmarks ? (
                        <Badge variant="outline">Bookmarks</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Current status
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {course.metadata.dueAt && course.availabilityStatus !== "completed"
                        ? `Due ${formatCourseDate(course.metadata.dueAt) || "soon"}`
                        : "Keep learning"}
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted/20">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-300"
                      style={{ width: `${Math.max(0, Math.min(100, course.completionPercent))}%` }}
                    />
                  </div>
                </div>

                <div className="app-course-action-row">
                  <Button asChild className="app-button-compact-primary app-course-action-button">
                    <AppPrefetchLink href={`/student/courses/${course._id}`}>
                      {course.status === "not_started" ? "Start Course" : "Open Course"}
                    </AppPrefetchLink>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
