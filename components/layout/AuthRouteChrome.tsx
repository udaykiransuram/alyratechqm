"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import AuthHeader from "@/components/navigation/AuthHeader";

export default function AuthRouteChrome({
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
      <AuthHeader />
      <main className="min-h-screen pt-[var(--app-header-height)]">
        {children}
      </main>
    </>
  );
}
