import type { ReactNode } from "react";

import PublicRouteShell from "@/components/layout/PublicRouteShell";

export default function LandingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <PublicRouteShell>{children}</PublicRouteShell>;
}
