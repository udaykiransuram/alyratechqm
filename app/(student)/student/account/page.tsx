import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import StudentAccountPageClient from "@/components/student/account/StudentAccountPageClient";
import {
  getStudentAccountBootstrapData,
} from "@/lib/student-account/data";
import { authOptions } from "@/lib/auth";
import {
  assertSummerCrashStudentPageAccess,
} from "@/lib/server/summer-crash";


export default async function StudentAccountPage() {
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

  const accessCheck = await assertSummerCrashStudentPageAccess({
    schoolKey,
    studentId,
    target: {
      kind: "locked-student-content",
    },
  });
  if (!accessCheck.allowed) {
    redirect(accessCheck.policy.redirectHref);
  }

  const bootstrapData = await getStudentAccountBootstrapData({
    schoolKey,
    studentId,
    now: new Date(),
  });

  const initialStudent = bootstrapData.student;
  const initialReportTests = bootstrapData.reports;
  const initialError = initialStudent
    ? bootstrapData.studentError
    : bootstrapData.studentError || "Student profile not found.";
  const initialReportsError = bootstrapData.reportsError;

  return (
    <StudentAccountPageClient
      initialStudent={initialStudent}
      initialReportTests={initialReportTests}
      initialError={initialError}
      initialReportsError={initialReportsError}
    />
  );
}
