"use client";

import { usePathname } from "next/navigation";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import {
  isStudentPortalItemActive,
  STUDENT_PORTAL_ITEMS,
} from "@/components/student/student-portal-nav-config";
import { cn } from "@/lib/utils";

export default function StudentPortalNav() {
  const pathname = usePathname() || "/student";

  return (
    <nav
      className="app-segmented-control app-student-portal-sections app-student-portal-grid"
      aria-label="Student portal sections"
    >
      {STUDENT_PORTAL_ITEMS.map((item) => {
        const active = isStudentPortalItemActive(pathname, item);
        const Icon = item.icon;

        return (
          <AppPrefetchLink
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "app-segmented-link app-student-portal-link app-student-portal-grid-link items-center text-center",
              active && "app-segmented-link-active",
            )}
          >
            <span className="app-student-portal-link-icon" aria-hidden="true">
              <Icon className="h-4 w-4" />
            </span>
            <span className="app-segmented-link-label">{item.label}</span>
          </AppPrefetchLink>
        );
      })}
    </nav>
  );
}
