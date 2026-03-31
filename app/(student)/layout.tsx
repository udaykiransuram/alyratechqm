import type { ReactNode } from "react";

import StudentRouteShell from "@/components/layout/StudentRouteShell";

export default function StudentAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <StudentRouteShell>{children}</StudentRouteShell>;
}
