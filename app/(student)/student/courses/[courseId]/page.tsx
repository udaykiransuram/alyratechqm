import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import StudentCourseDetailPageClient from "@/components/student/courses/StudentCourseDetailPageClient";
import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { authOptions } from "@/lib/auth";
import { getStudentCourseDetail } from "@/lib/server/student-courses";

export const dynamic = "force-dynamic";

type StudentCoursePageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function StudentCoursePage({
  params,
}: StudentCoursePageProps) {
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

  const { courseId } = await params;

  let course = null;
  let loadError: string | null = null;

  try {
    course = await getStudentCourseDetail({
      schoolKey,
      studentId,
      studentPlacement: {
        classId: session.user.studentClassId,
        academicSectionId: session.user.studentAcademicSectionId,
      },
      courseId,
    });
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load course.";
  }

  if (!course) {
    return (
      <div className="app-student-page-shell">
        <PageHero
          eyebrow="Student Portal"
          title="Course"
          variant="overview"
          density="compact"
          description="We couldn't open this course right now."
          actions={
            <Button asChild variant="outline" size="lg" className="app-student-action-secondary">
              <AppPrefetchLink href="/student/courses">Back to Courses</AppPrefetchLink>
            </Button>
          }
        >
        </PageHero>
        <FeedbackNotice variant="error">
          {loadError || "Course not found."}
        </FeedbackNotice>
      </div>
    );
  }

  return <StudentCourseDetailPageClient courseId={courseId} initialCourse={course} />;
}
