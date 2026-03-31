import type { ReactNode } from "react";

import ChromeDocumentRuntime from "@/components/layout/ChromeDocumentRuntime";
import ClientApiRequestProbe from "@/components/layout/ClientApiRequestProbe";
import WorkspaceAppearanceBootstrap from "@/components/layout/WorkspaceAppearanceBootstrap";
import WorkspaceDataWarmup from "@/components/layout/WorkspaceDataWarmup";
import CompanySiteHeader from "@/components/navigation/CompanySiteHeader";
import WorkspaceSiteHeader from "@/components/navigation/WorkspaceSiteHeader";

const enableClientApiProbe = process.env.NODE_ENV !== "production";

export default function ProductRouteShell({
  children,
  variant,
}: {
  children: ReactNode;
  variant: "company" | "workspace";
}) {
  const workspaceVariant = variant === "workspace";

  return (
    <>
      <ChromeDocumentRuntime
        visualMode={workspaceVariant ? "workspace" : "default"}
      />
      {enableClientApiProbe ? <ClientApiRequestProbe /> : null}
      {workspaceVariant ? <WorkspaceAppearanceBootstrap enabled /> : null}
      {workspaceVariant ? <WorkspaceDataWarmup enabled /> : null}
      {workspaceVariant ? <WorkspaceSiteHeader /> : <CompanySiteHeader />}
      <main className="app-route-main app-route-main-workspace app-shell-sidebar-offset">
        {workspaceVariant ? (
          children
        ) : (
          <div className="app-page-frame">{children}</div>
        )}
      </main>
    </>
  );
}
