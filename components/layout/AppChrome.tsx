"use client";

import type { ReactNode } from "react";
import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import ClientApiRequestProbe from "@/components/layout/ClientApiRequestProbe";
import AppViewport from "@/components/layout/AppViewport";
import RouteTransitionIndicator from "@/components/layout/RouteTransitionIndicator";
import WorkspaceDataWarmup from "@/components/layout/WorkspaceDataWarmup";
import {
  APP_SCHOOL_SELECTION_CHANGE_EVENT,
  getSchoolKeyFromCookie,
} from "@/lib/client/school";
import { isPublicPathname } from "@/lib/navigation/canonical-paths";

const Footer = dynamic(() => import("@/components/Footer"));
const Navbar = dynamic(() => import("@/components/Navbar"));
const ViewportHover = dynamic(() => import("@/components/ViewportHover"));
const SiteHeader = dynamic(() => import("@/components/navigation/SiteHeader"));

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const publicRoute = isPublicPathname(pathname);
  const [schoolKey, setSchoolKey] = useState(() => getSchoolKeyFromCookie());

  useEffect(() => {
    document.documentElement.setAttribute("data-app-hydrated", "true");

    return () => {
      document.documentElement.removeAttribute("data-app-hydrated");
    };
  }, []);

  useEffect(() => {
    if (!publicRoute) return;

    document.documentElement.style.setProperty("--app-sidebar-width", "0px");
    document.documentElement.style.setProperty(
      "--app-mobile-school-switcher-height",
      "0px",
    );
  }, [publicRoute]);

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

  if (publicRoute) {
    return (
      <div className="public-site-shell relative flex min-h-screen flex-col overflow-x-hidden">
        <ClientApiRequestProbe />
        <Suspense fallback={null}>
          <RouteTransitionIndicator />
        </Suspense>
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(180deg, hsl(var(--app-surface-1)) 0%, hsl(var(--background)) 38%, hsl(var(--secondary) / 0.58) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at top left, hsl(var(--app-surface-tint) / 0.72) 0%, transparent 24rem), radial-gradient(circle at top right, hsl(var(--primary) / 0.14) 0%, transparent 18rem)",
            }}
          />
          <div className="absolute inset-0 bg-[url('/images/source-frontend/ttf-water-drops.png')] bg-[length:360px_360px] bg-repeat opacity-[0.06] mix-blend-multiply" />
        </div>
        <Navbar />
        <ViewportHover />
        <main className="flex-1 pt-20">{children}</main>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <ClientApiRequestProbe />
      <WorkspaceDataWarmup enabled={pathname.startsWith("/workspace")} />
      <Suspense fallback={null}>
        <RouteTransitionIndicator />
      </Suspense>
      <SiteHeader />
      <main className="min-h-screen pt-[calc(var(--app-header-height)+var(--app-mobile-school-switcher-height))] transition-[margin-left,margin-right] duration-200 ease-in-out md:pt-[var(--app-header-height)] lg:ml-[var(--app-sidebar-left-width,0px)] lg:mr-[var(--app-sidebar-right-width,0px)]">
        <AppViewport key={schoolKey || "no-school"}>{children}</AppViewport>
      </main>
    </>
  );
}
