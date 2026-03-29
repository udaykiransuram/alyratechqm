"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import StudentHeader from "@/components/navigation/StudentHeader";

export default function StudentRouteChrome({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--app-sidebar-width", "0px");
    root.style.setProperty("--app-mobile-school-switcher-height", "0px");
    root.setAttribute("data-app-visual-mode", "default");

    return () => {
      root.removeAttribute("data-app-visual-mode");
    };
  }, []);

  return (
    <>
      <StudentHeader />
      <main className="app-route-main app-route-main-student">
        {children}
      </main>
    </>
  );
}
