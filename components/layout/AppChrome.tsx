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
import { isPublicPathname } from "@/lib/navigation/canonical-paths";

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const publicRoute = isPublicPathname(pathname);
  const homePublicRoute = pathname === "/platform-home";
  const authRoute =
    pathname === "/auth/signin" || pathname === "/auth/company-signin";
  const studentRoute =
    pathname === "/student" || pathname.startsWith("/student/");

  useEffect(() => {
    document.documentElement.setAttribute("data-app-hydrated", "true");

    return () => {
      document.documentElement.removeAttribute("data-app-hydrated");
    };
  }, []);

  useEffect(() => {
    resetPendingNavigationFeedback();
  }, [pathname]);

  if (publicRoute) {
    if (homePublicRoute) {
      return <HomeRouteChrome>{children}</HomeRouteChrome>;
    }

    return <PublicRouteChrome>{children}</PublicRouteChrome>;
  }

  if (authRoute) {
    return <AuthRouteChrome>{children}</AuthRouteChrome>;
  }

  if (studentRoute) {
    return <StudentRouteChrome>{children}</StudentRouteChrome>;
  }

  return <ProductRouteChrome pathname={pathname}>{children}</ProductRouteChrome>;
}
