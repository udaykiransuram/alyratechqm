import { StudentTagReportPageView } from "@/components/analytics/StudentTagReportPageView";

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
    />
  );
}
