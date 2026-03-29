"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

import Footer from "@/components/Footer";
import ClientApiRequestProbe from "@/components/layout/ClientApiRequestProbe";
import Navbar from "@/components/Navbar";
import ViewportHover from "@/components/ViewportHover";
import {
  PUBLIC_THEME_CHANGE_EVENT,
  applyPublicThemeToElement,
  clearPublicThemeFromElement,
  resolveStoredPublicTheme,
} from "@/lib/client/public-theme";
import { cn } from "@/lib/utils";

const enableClientApiProbe = process.env.NODE_ENV !== "production";

export default function PublicRouteChrome({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname() || "/";
  const isHomeRoute = pathname === "/";

  useEffect(() => {
    const root = document.documentElement;

    root.style.setProperty("--app-sidebar-width", "0px");
    root.style.setProperty("--app-mobile-school-switcher-height", "0px");
    root.setAttribute("data-app-visual-mode", "public");
    root.removeAttribute("data-public-home-cinematic");
    root.removeAttribute("data-public-home-flagship");

    const syncPublicTheme = () => {
      const { style, palette } = resolveStoredPublicTheme();
      applyPublicThemeToElement(root, style, palette);
    };

    syncPublicTheme();
    window.addEventListener(PUBLIC_THEME_CHANGE_EVENT, syncPublicTheme);

    return () => {
      window.removeEventListener(PUBLIC_THEME_CHANGE_EVENT, syncPublicTheme);
      root.removeAttribute("data-app-visual-mode");
      clearPublicThemeFromElement(root);
    };
  }, []);

  return (
    <div className="public-site-shell relative flex min-h-screen flex-col overflow-x-hidden">
      {enableClientApiProbe ? <ClientApiRequestProbe /> : null}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(180deg, hsl(var(--public-bg)) 0%, hsl(var(--public-surface)) 38%, hsl(var(--public-surface-2) / 0.44) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at top left, hsl(var(--public-accent) / 0.08) 0%, transparent 28rem), radial-gradient(circle at top right, hsl(var(--public-warm) / 0.1) 0%, transparent 20rem), radial-gradient(circle at 50% 0%, hsl(var(--public-accent-strong) / 0.04) 0%, transparent 24rem)",
          }}
        />
        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:132px_132px] [mask-image:linear-gradient(180deg,rgba(0,0,0,0.24),transparent_82%)]" />
      </div>
      <Navbar />
      <ViewportHover />
      <main
        className={cn(
          "app-route-main app-route-main-public flex-1",
          isHomeRoute && "app-route-main-public-home",
        )}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}
