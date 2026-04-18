import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { StudentTagReportPageView } from "@/components/analytics/StudentTagReportPageView";
import SummerCrashDiagnosticParentReport from "@/components/summer-crash/SummerCrashDiagnosticParentReport";
import { authOptions } from "@/lib/auth";
import { getStudentTagReportPageBootstrap } from "@/lib/analytics/student-tag-report-page";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
import { getSummerCrashDiagnosticParentReport } from "@/lib/server/summer-crash-parent-report";
import {
  assertSummerCrashStudentPageAccess,
} from "@/lib/server/summer-crash";
import { SUMMER_CRASH_HOME_PATH } from "@/lib/summer-crash/constants";

export default async function StudentReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ responseId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    session.user.accountType !== "school_user" ||
    session.user.role !== "student"
  ) {
    redirect("/auth/signin");
  }

  const [resolvedParams, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const schoolKey = String(session.user.schoolKey || "").trim();
  const studentId = String(session.user.id || "").trim();

  if (!schoolKey || !studentId) {
    redirect("/auth/signin");
  }

  const accessCheck = await assertSummerCrashStudentPageAccess({
    schoolKey,
    studentId,
    target: {
      kind: "diagnostic-report",
      responseId: resolvedParams.responseId,
    },
  });
  if (!accessCheck.allowed) {
    redirect(accessCheck.policy.redirectHref);
  }

  const rawReturnTo = Array.isArray(resolvedSearchParams?.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams?.returnTo;
  const defaultBackHref =
    accessCheck.policy.applies && !accessCheck.policy.isUnlocked
      ? SUMMER_CRASH_HOME_PATH
      : getSafeReturnToPath(rawReturnTo) || "/student/account";
  const isSummerDiagnosticReport =
    accessCheck.policy.applies &&
    accessCheck.policy.allowedDiagnosticResponseId === resolvedParams.responseId;

  if (isSummerDiagnosticReport) {
    const parentReport = await getSummerCrashDiagnosticParentReport({
      schoolKey,
      studentId,
      responseId: resolvedParams.responseId,
    });

    if (parentReport) {
      return (
        <SummerCrashDiagnosticParentReport
          report={parentReport}
          defaultBackHref={SUMMER_CRASH_HOME_PATH}
        />
      );
    }
  }

  return (
    <StudentTagReportPageView
      params={resolvedParams}
      portalMode="student"
      defaultBackHref={defaultBackHref}
      initialBootstrap={await getStudentTagReportPageBootstrap({
        responseId: resolvedParams.responseId,
        portalMode: "student",
      })}
    />
  );
}
