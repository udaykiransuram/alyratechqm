"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

import AuthRouteChrome from "@/components/layout/AuthRouteChrome";
import HomeRouteChrome from "@/components/layout/HomeRouteChrome";
import ProductRouteChrome from "@/components/layout/ProductRouteChrome";
import PublicRouteChrome from "@/components/layout/PublicRouteChrome";
import StudentRouteChrome from "@/components/layout/StudentRouteChrome";
import { resetPendingNavigationFeedback } from "@/lib/client/navigation-feedback";
import { resolveAppChromeKind } from "@/lib/navigation/canonical-paths";

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const chromeKind = resolveAppChromeKind(pathname);

  useEffect(() => {
    document.documentElement.setAttribute("data-app-hydrated", "true");

    return () => {
      document.documentElement.removeAttribute("data-app-hydrated");
    };
  }, []);

  useEffect(() => {
    resetPendingNavigationFeedback();
  }, [pathname]);

  switch (chromeKind) {
    case "home":
      return <HomeRouteChrome key="home">{children}</HomeRouteChrome>;
    case "public":
      return <PublicRouteChrome key="public">{children}</PublicRouteChrome>;
    case "auth":
      return <AuthRouteChrome key="auth">{children}</AuthRouteChrome>;
    case "student":
      return <StudentRouteChrome key="student">{children}</StudentRouteChrome>;
    default:
      return (
        <ProductRouteChrome key="product" pathname={pathname}>
          {children}
        </ProductRouteChrome>
      );
  }
}
