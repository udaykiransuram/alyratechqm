import type { ReactNode } from "react";

import ProductRouteShell from "@/components/layout/ProductRouteShell";

export default function CompanyLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ProductRouteShell variant="company">{children}</ProductRouteShell>;
}
