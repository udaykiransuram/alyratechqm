import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import StudentLiveSessionCompanionClient from "@/components/live-sessions/StudentLiveSessionCompanionClient";
import PageHero from "@/components/layout/PageHero";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { authOptions } from "@/lib/auth";
import { getStudentLiveSessionById } from "@/lib/server/live-sessions";

export const runtime = "nodejs";

type StudentLiveClassDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatStatusLabel(value: string) {
  return String(value || "").replace(/_/g, " ");
}

export default async function StudentLiveClassDetailPage({
  params,
}: StudentLiveClassDetailPageProps) {
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

  const { id } = await params;
  const liveSession = await getStudentLiveSessionById({
    schoolKey,
    studentId,
    studentPlacement: {
      classId: session.user.studentClassId,
      academicSectionId: session.user.studentAcademicSectionId,
    },
    liveSessionId: id,
  });

  return (
    <div className="app-student-page-shell app-course-page">
      <PageHero
        className="app-learning-hero"
        eyebrow="Student Portal"
        title={liveSession?.title || "Live Class"}
        variant="overview"
        density="compact"
        description={
          liveSession?.description || "The requested live class could not be loaded."
        }
        meta={
          liveSession ? (
            <>
              <span className="app-meta-chip capitalize">
                {formatStatusLabel(liveSession.status)}
              </span>
              {liveSession.subject?.name ? (
                <span className="app-meta-chip">{liveSession.subject.name}</span>
              ) : null}
              {liveSession.hostTeacher?.name ? (
                <span className="app-meta-chip">{liveSession.hostTeacher.name}</span>
              ) : null}
            </>
          ) : undefined
        }
        stats={
          liveSession
            ? [
                {
                  label: "Starts",
                  value: formatDateTime(liveSession.scheduledStartAt),
                  meta: "Session start time",
                },
                {
                  label: "Ends",
                  value: formatDateTime(liveSession.scheduledEndAt),
                  meta: "Session end time",
                },
                {
                  label: "Attendance",
                  value: liveSession.attendanceStatus || "invited",
                  meta: "Updates while you stay on this page.",
                },
                {
                  label: "Times joined",
                  value: String(liveSession.joinClicks),
                  meta: "Counts each time the class link opens.",
                },
              ]
            : undefined
        }
      >
        <StudentPortalNav />
      </PageHero>

      {!liveSession ? (
        <div className="app-feedback app-feedback-error">This class could not be found.</div>
      ) : (
        <StudentLiveSessionCompanionClient initialLiveSession={liveSession} />
      )}
    </div>
  );
}
