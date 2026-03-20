"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const STUDENT_PORTAL_LINKS = [
  {
    href: "/student/tests",
    label: "Tests",
    note: "Assigned papers and saved attempts",
  },
  {
    href: "/student/account",
    label: "Account",
    note: "Profile access and password",
  },
];

function isActiveLink(pathname: string, href: string) {
  return href === "/student/tests"
    ? pathname === href || pathname.startsWith("/student/tests/")
    : pathname === href || pathname.startsWith(`${href}/`);
}

export default function StudentPortalNav() {
  const pathname = usePathname() || "/student/tests";
  const activeCopy = pathname.startsWith("/student/account")
    ? "Manage your student account details and sign-in settings."
    : "Open assigned tests, continue saved work, and review submissions.";

  return (
    <div className="app-toolbar">
      <div className="app-toolbar-row">
        <div className="app-toolbar-copy">
          <p className="app-toolbar-title">Student Workspace</p>
          <p className="app-toolbar-note">{activeCopy}</p>
        </div>
        <div className="app-toolbar-actions">
          <nav
            className="app-segmented-control"
            aria-label="Student portal sections"
          >
            {STUDENT_PORTAL_LINKS.map((link) => {
              const active = isActiveLink(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "app-segmented-link",
                    active && "app-segmented-link-active",
                  )}
                >
                  <span className="app-segmented-link-label">{link.label}</span>
                  <span className="app-segmented-link-note">{link.note}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
