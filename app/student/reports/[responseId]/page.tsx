import { StudentTagReportPageView } from "@/components/analytics/StudentTagReportPageView";

export default function StudentReportDetailPage({
  params,
}: {
  params: { responseId: string };
}) {
  return (
    <StudentTagReportPageView
      params={params}
      portalMode="student"
      defaultBackHref="/student/account"
    />
  );
}
