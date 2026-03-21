"use client";

import { StudentTagReportPageView } from "@/components/analytics/StudentTagReportPageView";

export default function WorkspaceStudentTagReportPage({
  params,
}: {
  params: { responseId: string };
}) {
  return <StudentTagReportPageView params={params} />;
}
