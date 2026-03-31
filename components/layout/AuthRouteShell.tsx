import type { ReactNode } from "react";

import AuthHeader from "@/components/navigation/AuthHeader";
import ChromeDocumentRuntime from "@/components/layout/ChromeDocumentRuntime";

export default function AuthRouteShell({
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
      <AuthHeader />
      <main className="min-h-screen pt-[var(--app-header-height)]">
        {children}
      </main>
    </>
  );
}
