"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { shouldHideStudentChrome } from "@/components/student/student-route-chrome";
import { cn } from "@/lib/utils";

export default function StudentRouteMain({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const hideStudentChrome = shouldHideStudentChrome(pathname);

  return (
    <main
      className={cn(
        "app-route-main app-route-main-student",
        hideStudentChrome && "app-route-main-student-exam",
      )}
    >
      {children}
    </main>
  );
}
