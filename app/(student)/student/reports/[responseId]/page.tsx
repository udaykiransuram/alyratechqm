import { StudentTagReportPageView } from "@/components/analytics/StudentTagReportPageView";
import { getStudentTagReportPageBootstrap } from "@/lib/analytics/student-tag-report-page";

export default async function StudentReportDetailPage({
  params,
}: {
  params: Promise<{ responseId: string }>;
}) {
  const resolvedParams = await params;
  return (
    <StudentTagReportPageView
      params={resolvedParams}
      portalMode="student"
      defaultBackHref="/student/account"
      initialBootstrap={await getStudentTagReportPageBootstrap({
        responseId: resolvedParams.responseId,
        portalMode: "student",
      })}
    />
  );
}
