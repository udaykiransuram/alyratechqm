import type { ReactNode } from "react";

import HomeRouteShell from "@/components/layout/HomeRouteShell";

export default function HomeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <HomeRouteShell>{children}</HomeRouteShell>;
}
