import type { ReactNode } from "react";

import ChromeDocumentRuntime from "@/components/layout/ChromeDocumentRuntime";
import StudentHeader from "@/components/navigation/StudentHeader";

export default function StudentRouteShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <ChromeDocumentRuntime
        visualMode="default"
        sidebarWidth="0px"
        mobileSchoolSwitcherHeight="0px"
      />
      <StudentHeader />
      <main className="app-route-main app-route-main-student">
        {children}
      </main>
    </>
  );
}
