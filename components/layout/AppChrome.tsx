"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ViewportHover from "@/components/ViewportHover";
import AppViewport from "@/components/layout/AppViewport";
import SiteHeader from "@/components/navigation/SiteHeader";
import { isPublicPathname } from "@/lib/navigation/canonical-paths";

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const publicRoute = isPublicPathname(pathname);

  useEffect(() => {
    if (!publicRoute) return;

    document.documentElement.style.setProperty("--app-sidebar-width", "0px");
    document.documentElement.style.setProperty(
      "--app-mobile-school-switcher-height",
      "0px",
    );
  }, [publicRoute]);

  if (publicRoute) {
    return (
      <div className="public-site-shell relative flex min-h-screen flex-col overflow-x-hidden">
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-100 via-cyan-50 to-blue-100" />
          <div className="absolute inset-0 bg-[url('/images/source-frontend/ttf-water-drops.png')] bg-[length:320px_320px] bg-repeat opacity-[0.18]" />
          <div className="absolute inset-0 opacity-[0.1] bg-[conic-gradient(from_210deg_at_10%_0%,rgba(255,255,255,0.25)_0deg,transparent_120deg)]" />
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
      <SiteHeader />
      <main className="min-h-screen pt-[calc(var(--app-header-height)+var(--app-mobile-school-switcher-height))] transition-[margin-left] duration-200 ease-in-out md:pt-[var(--app-header-height)] lg:ml-[var(--app-sidebar-width)]">
        <AppViewport>{children}</AppViewport>
      </main>
    </>
  );
}
