"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

const excludedRouteMatchers = [
  (pathname: string) => pathname.startsWith("/auth/"),
  (pathname: string) => pathname.startsWith("/student/"),
  (pathname: string) =>
    pathname.startsWith("/workspace/analytics/student-tag-report/"),
  (pathname: string) =>
    pathname.startsWith("/workspace/analytics/class-tag-report/"),
  (pathname: string) => /^\/workspace\/question-papers\/[^/]+\/responses(?:\/|$)/.test(pathname),
];

function shouldUseWorkspaceShell(pathname: string) {
  return !excludedRouteMatchers.some((matcher) => matcher(pathname));
}

export default function AppViewport({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const content = <div className="app-page-frame">{children}</div>;

  if (!pathname || !shouldUseWorkspaceShell(pathname)) {
    return content;
  }

  return <div className="app-workspace-shell">{content}</div>;
}
