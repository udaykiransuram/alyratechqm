import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import StudentTestPageClient from "@/components/student/test-detail/StudentTestPageClient";
import { getStudentTestDetailData } from "@/app/api/student/tests/[paperId]/data";
import { authOptions } from "@/lib/auth";
import type { StudentTestDetailResponse } from "@/components/student/test-detail/student-test-types";

export const dynamic = "force-dynamic";

type StudentTestPageProps = {
  params: Promise<{ paperId: string }>;
};

export default async function StudentTestPage({
  params,
}: StudentTestPageProps) {
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

  const { paperId } = await params;

  let initialData: StudentTestDetailResponse | null = null;
  let initialLoadError: string | null = null;

  try {
    initialData = await getStudentTestDetailData({
      schoolKey,
      studentId,
      paperId,
      studentPlacement: {
        classId: session.user.studentClassId,
        academicSectionId: session.user.studentAcademicSectionId,
      },
      now: new Date(),
    });
  } catch (error) {
    initialLoadError =
      error instanceof Error
        ? error.message
        : "We couldn't load the online test.";
  }

  return (
    <StudentTestPageClient
      paperId={paperId}
      initialData={initialData}
      initialLoadError={initialLoadError}
    />
  );
}
