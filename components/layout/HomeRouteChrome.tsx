"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import HomeFooter from "@/components/home/HomeFooter";
import HomeNavbar from "@/components/home/HomeNavbar";
import ClientApiRequestProbe from "@/components/layout/ClientApiRequestProbe";
import { clearPublicThemeFromElement } from "@/lib/client/public-theme";

const enableClientApiProbe = process.env.NODE_ENV !== "production";

export default function HomeRouteChrome({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--app-sidebar-width", "0px");
    root.style.setProperty("--app-mobile-school-switcher-height", "0px");
    root.setAttribute("data-app-visual-mode", "public");
    root.setAttribute("data-public-home-cinematic", "true");
    root.removeAttribute("data-public-home-flagship");
    clearPublicThemeFromElement(root);

    return () => {
      root.removeAttribute("data-app-visual-mode");
      root.removeAttribute("data-public-home-cinematic");
      clearPublicThemeFromElement(root);
    };
  }, []);

  return (
    <div className="home-route-shell relative flex min-h-screen flex-col">
      {enableClientApiProbe ? <ClientApiRequestProbe /> : null}
      <HomeNavbar />
      <main className="flex-1">{children}</main>
      <HomeFooter />
    </div>
  );
}
