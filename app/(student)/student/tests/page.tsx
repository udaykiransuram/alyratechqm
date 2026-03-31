import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { listStudentTestsData } from "@/app/api/student/tests/data";
import StudentTestsPageClient, {
  type StudentTest,
} from "@/components/student/StudentTestsPageClient";
import { authOptions } from "@/lib/auth";
import {
  buildExamRuntimeErrorPayload,
  isExamRuntimeEnabled,
} from "@/lib/exam-runtime";
import { isMockedE2ETestMode } from "@/lib/test-mode";

export const dynamic = "force-dynamic";

type StudentTestsPageProps = {
  searchParams: Promise<{
    submitted?: string | string[];
  }>;
};

function getSearchParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StudentTestsPage({
  searchParams,
}: StudentTestsPageProps) {
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

  let initialTests: StudentTest[] = [];
  let initialError: string | null = null;
  const resolvedSearchParams = await searchParams;

  if (!isMockedE2ETestMode()) {
    try {
      const tests = await listStudentTestsData({
        schoolKey,
        studentId,
        studentPlacement: {
          classId: session.user.studentClassId,
          academicSectionId: session.user.studentAcademicSectionId,
        },
        now: new Date(),
      });
      initialTests = Array.isArray(tests) ? (tests as StudentTest[]) : [];
    } catch (error: any) {
      if (await isExamRuntimeEnabled()) {
        initialError = buildExamRuntimeErrorPayload(
          error,
          "Failed to load assigned tests.",
        ).message;
      } else {
        initialError = error?.message || "Failed to load assigned tests.";
      }
    }
  }

  const submissionNotice =
    getSearchParamValue(resolvedSearchParams?.submitted) === "1"
      ? "Test submitted."
      : null;

  return (
    <StudentTestsPageClient
      initialTests={initialTests}
      initialError={initialError}
      submissionNotice={submissionNotice}
    />
  );
}
