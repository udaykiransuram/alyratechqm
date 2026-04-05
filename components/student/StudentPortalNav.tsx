"use client";

import { usePathname } from "next/navigation";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { cn } from "@/lib/utils";

const STUDENT_PORTAL_LINKS = [
  {
    href: "/student",
    label: "Home",
  },
  {
    href: "/student/tests",
    label: "Tests",
  },
  {
    href: "/student/courses",
    label: "Courses",
  },
  {
    href: "/student/diary",
    label: "Diary",
  },
  {
    href: "/student/account",
    label: "Account",
  },
];

function isActiveLink(pathname: string, href: string) {
  if (href === "/student") {
    return pathname === "/student";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function StudentPortalNav() {
  const pathname = usePathname() || "/student/tests";

  return (
    <nav className="app-segmented-control" aria-label="Student portal sections">
      {STUDENT_PORTAL_LINKS.map((link) => {
        const active = isActiveLink(pathname, link.href);

        return (
          <AppPrefetchLink
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "app-segmented-link app-student-portal-link min-w-[6.5rem] items-center text-center",
              active && "app-segmented-link-active",
            )}
          >
            <span className="app-segmented-link-label">{link.label}</span>
          </AppPrefetchLink>
        );
      })}
    </nav>
  );
}
