"use client";

import React from "react";
import { StudentTagReportPageView } from "@/components/analytics/StudentTagReportPageView";

export default function WorkspaceStudentTagReportPage({
  params,
}: {
  params: Promise<{ responseId: string }>;
}) {
  const resolvedParams = React.use(params);
  return <StudentTagReportPageView params={resolvedParams} />;
}
