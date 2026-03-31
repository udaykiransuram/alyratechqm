import type { ReactNode } from "react";

import HomeFooter from "@/components/home/HomeFooter";
import HomeNavbar from "@/components/home/HomeNavbar";
import ChromeDocumentRuntime from "@/components/layout/ChromeDocumentRuntime";
import ClientApiRequestProbe from "@/components/layout/ClientApiRequestProbe";

const enableClientApiProbe = process.env.NODE_ENV !== "production";

export default function HomeRouteShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="home-route-shell relative flex min-h-screen flex-col">
      <ChromeDocumentRuntime
        visualMode="public"
        sidebarWidth="0px"
        mobileSchoolSwitcherHeight="0px"
        publicTheme="clear"
        publicHomeVariant="cinematic"
      />
      {enableClientApiProbe ? <ClientApiRequestProbe /> : null}
      <HomeNavbar />
      <main className="flex-1">{children}</main>
      <HomeFooter />
    </div>
  );
}
