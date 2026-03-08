"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

const excludedRouteMatchers = [
  (pathname: string) => pathname === "/",
  (pathname: string) => pathname === "/marketing" || pathname.startsWith("/marketing/"),
  (pathname: string) => pathname === "/register" || pathname.startsWith("/register/"),
  (pathname: string) => pathname === "/manage/reports" || pathname.startsWith("/manage/reports/"),
  (pathname: string) => pathname === "/analytics" || pathname.startsWith("/analytics/"),
  (pathname: string) => pathname.includes("/report"),
  (pathname: string) => /^\/question-paper\/[^/]+\/responses(?:\/|$)/.test(pathname),
];

function shouldUseWorkspaceShell(pathname: string) {
  return !excludedRouteMatchers.some((matcher) => matcher(pathname));
}

export default function AppViewport({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (!pathname || !shouldUseWorkspaceShell(pathname)) {
    return <>{children}</>;
  }

  return <div className="app-workspace-shell">{children}</div>;
}
