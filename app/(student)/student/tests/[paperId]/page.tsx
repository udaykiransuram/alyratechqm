import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import StudentTestPageClient from "@/components/student/test-detail/StudentTestPageClient";
import { authOptions } from "@/lib/auth";
import type { StudentTestDetailResponse } from "@/components/student/test-detail/student-test-types";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
import {
  assertSummerCrashStudentPageAccess,
} from "@/lib/server/summer-crash";
import { SUMMER_CRASH_HOME_PATH } from "@/lib/summer-crash/constants";
import { getStudentTestDetailData } from "@/lib/server/student-tests";
import { isMockedE2ETestMode } from "@/lib/test-mode";


type StudentTestPageProps = {
  params: Promise<{ paperId: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function StudentTestPage({
  params,
  searchParams,
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
  const accessCheck = await assertSummerCrashStudentPageAccess({
    schoolKey,
    studentId,
    target: {
      kind: "diagnostic-test",
      paperId,
    },
  });
  if (!accessCheck.allowed) {
    redirect(accessCheck.policy.redirectHref);
  }

  const resolvedSearchParams = await searchParams;
  const rawReturnTo = Array.isArray(resolvedSearchParams?.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams?.returnTo;
  const safeReturnTo = getSafeReturnToPath(rawReturnTo);
  const returnToPath =
    accessCheck.policy.applies && !accessCheck.policy.isUnlocked
      ? safeReturnTo || SUMMER_CRASH_HOME_PATH
      : safeReturnTo || "/student/tests";
  const isSummerCrashDiagnostic =
    accessCheck.policy.applies && !accessCheck.policy.isUnlocked;
  const autoStart = isSummerCrashDiagnostic;
  const allowStartWithoutFullscreen = isSummerCrashDiagnostic;

  let initialData: StudentTestDetailResponse | null = null;
  let initialLoadError: string | null = null;

  if (!isMockedE2ETestMode()) {
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
  }

  return (
    <StudentTestPageClient
      paperId={paperId}
      initialData={initialData}
      initialLoadError={initialLoadError}
      returnToPath={returnToPath}
      autoStart={autoStart}
      allowStartWithoutFullscreen={allowStartWithoutFullscreen}
    />
  );
}
