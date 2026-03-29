import { StudentTagReportPageView } from "@/components/analytics/StudentTagReportPageView";
import { getStudentTagReportPageBootstrap } from "@/lib/analytics/student-tag-report-page";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

export default async function WorkspaceStudentTagReportPage({
  params,
}: {
  params: Promise<{ responseId: string }>;
}) {
  await requireWorkspaceStaffSession();
  const resolvedParams = await params;

  return (
    <StudentTagReportPageView
      params={resolvedParams}
      initialBootstrap={await getStudentTagReportPageBootstrap({
        responseId: resolvedParams.responseId,
        portalMode: "admin",
      })}
    />
  );
}
