import type { ReactNode } from "react";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  getSummerCrashPortalAccessPolicy,
} from "@/lib/server/summer-crash";
import { isSummerCrashSession } from "@/lib/summer-crash/shared";
import { StudentPortalAccessProvider } from "@/components/student/StudentPortalAccessContext";
import StudentPortalChrome from "@/components/student/StudentPortalChrome";
import StudentSessionMonitor from "@/components/student/StudentSessionMonitor";

type StudentLayoutProps = {
  children: ReactNode;
};

export default async function StudentLayout({ children }: StudentLayoutProps) {
  const session = await getServerSession(authOptions);
  let restrictedMode = false;

  if (
    session?.user?.id &&
    isSummerCrashSession({
      accountType: session.user.accountType,
      role: session.user.role,
      schoolKey: session.user.schoolKey,
    })
  ) {
    const portalAccess = await getSummerCrashPortalAccessPolicy({
      schoolKey: String(session.user.schoolKey || ""),
      studentId: String(session.user.id || ""),
    });
    restrictedMode = portalAccess.applies && !portalAccess.isUnlocked;
  }

  return (
    <StudentPortalAccessProvider restrictedMode={restrictedMode}>
      <StudentSessionMonitor />
      <StudentPortalChrome />
      {children}
    </StudentPortalAccessProvider>
  );
}
