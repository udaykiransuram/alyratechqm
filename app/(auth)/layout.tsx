import type { ReactNode } from "react";

import AuthRouteShell from "@/components/layout/AuthRouteShell";

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AuthRouteShell>{children}</AuthRouteShell>;
}
