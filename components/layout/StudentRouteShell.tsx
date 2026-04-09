import type { ReactNode } from "react";
import { getServerSession } from "next-auth";

import ChromeDocumentRuntime from "@/components/layout/ChromeDocumentRuntime";
import StudentRouteMain from "@/components/layout/StudentRouteMain";
import StudentHeader from "@/components/navigation/StudentHeader";
import { authOptions } from "@/lib/auth";
import { getStudentNotificationUnreadCount } from "@/lib/server/student-notifications";

export default async function StudentRouteShell({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const schoolKey = String(session?.user?.schoolKey || "").trim();
  const studentId = String(session?.user?.id || "").trim();
  const shouldLoadUnreadCount =
    session?.user?.accountType === "school_user" &&
    session?.user?.role === "student" &&
    Boolean(schoolKey) &&
    Boolean(studentId);
  const initialUnreadCount = shouldLoadUnreadCount
    ? await getStudentNotificationUnreadCount({
        schoolKey,
        studentId,
      }).catch(() => 0)
    : 0;

  return (
    <>
      <ChromeDocumentRuntime
        visualMode="default"
        sidebarWidth="13.75rem"
        mobileSchoolSwitcherHeight="0px"
      />
      <StudentHeader initialUnreadCount={initialUnreadCount} />
      <StudentRouteMain>{children}</StudentRouteMain>
    </>
  );
}
