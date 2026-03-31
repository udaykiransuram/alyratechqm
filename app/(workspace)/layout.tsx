import type { ReactNode } from "react";

import ProductRouteShell from "@/components/layout/ProductRouteShell";

export default function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ProductRouteShell variant="workspace">{children}</ProductRouteShell>;
}
