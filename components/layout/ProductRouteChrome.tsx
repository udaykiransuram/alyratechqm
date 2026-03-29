"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import AppViewport from "@/components/layout/AppViewport";
import ClientApiRequestProbe from "@/components/layout/ClientApiRequestProbe";
import WorkspaceAppearanceBootstrap from "@/components/layout/WorkspaceAppearanceBootstrap";
import WorkspaceDataWarmup from "@/components/layout/WorkspaceDataWarmup";
import SiteHeader from "@/components/navigation/SiteHeader";
import {
  APP_SCHOOL_SELECTION_CHANGE_EVENT,
  getSchoolKeyFromCookie,
} from "@/lib/client/school";

const enableClientApiProbe = process.env.NODE_ENV !== "production";

export default function ProductRouteChrome({
  children,
  pathname,
}: {
  children: ReactNode;
  pathname: string;
}) {
  const [schoolKey, setSchoolKey] = useState(() => getSchoolKeyFromCookie());
  const workspaceVisualMode = pathname.startsWith("/workspace");

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(
      "data-app-visual-mode",
      workspaceVisualMode ? "workspace" : "default",
    );

    return () => {
      root.removeAttribute("data-app-visual-mode");
    };
  }, [workspaceVisualMode]);

  useEffect(() => {
    const handleSchoolSelectionChange = () => {
      setSchoolKey(getSchoolKeyFromCookie());
    };

    window.addEventListener(
      APP_SCHOOL_SELECTION_CHANGE_EVENT,
      handleSchoolSelectionChange as EventListener,
    );

    return () => {
      window.removeEventListener(
        APP_SCHOOL_SELECTION_CHANGE_EVENT,
        handleSchoolSelectionChange as EventListener,
      );
    };
  }, []);

  return (
    <>
      <WorkspaceAppearanceBootstrap enabled={workspaceVisualMode} />
      {enableClientApiProbe ? <ClientApiRequestProbe /> : null}
      <WorkspaceDataWarmup enabled={workspaceVisualMode} />
      <SiteHeader />
      <main className="app-route-main app-route-main-workspace app-shell-sidebar-offset">
        <AppViewport key={schoolKey || "no-school"}>{children}</AppViewport>
      </main>
    </>
  );
}
