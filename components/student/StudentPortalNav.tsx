"use client";

import { usePathname } from "next/navigation";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import {
  isStudentPortalItemActive,
  STUDENT_PORTAL_ITEMS,
} from "@/components/student/student-portal-nav-config";
import { cn } from "@/lib/utils";

type StudentPortalNavVariant = "hero" | "mobile";

const MOBILE_NAV_ORDER = [
  "/student",
  "/student/tests",
  "/student/live-classes",
  "/student/diary",
  "/student/account",
];

const MOBILE_LABELS: Record<string, string> = {
  "/student/live-classes": "Live",
};

export default function StudentPortalNav({
  variant = "hero",
}: {
  variant?: StudentPortalNavVariant;
}) {
  const pathname = usePathname() || "/student";
  const items =
    variant === "mobile"
      ? MOBILE_NAV_ORDER.map(
          (href) => STUDENT_PORTAL_ITEMS.find((item) => item.href === href)!,
        ).filter(Boolean)
      : STUDENT_PORTAL_ITEMS;

  return (
    <nav
      className={cn(
        "app-segmented-control app-student-portal-sections app-student-portal-grid",
        variant === "mobile" && "app-student-portal-mobile",
      )}
      aria-label="Student portal sections"
    >
      {items.map((item) => {
        const active = isStudentPortalItemActive(pathname, item);
        const Icon = item.icon;
        const label =
          variant === "mobile" ? MOBILE_LABELS[item.href] || item.label : item.label;

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
            <span className="app-segmented-link-label">{label}</span>
          </AppPrefetchLink>
        );
      })}
    </nav>
  );
}
