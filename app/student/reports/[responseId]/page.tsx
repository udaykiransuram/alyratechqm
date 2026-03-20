import StudentTagReportPage from "@/app/analytics/student-tag-report/[responseId]/page";

export default function StudentReportDetailPage({
  params,
}: {
  params: { responseId: string };
}) {
  return (
    <StudentTagReportPage
      params={params}
      portalMode="student"
      defaultBackHref="/student/account"
    />
  );
}
