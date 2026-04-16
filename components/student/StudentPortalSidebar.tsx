"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  getSidebarWidthPx,
} from "@/components/navigation/SiteHeaderShared";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import {
  isStudentPortalItemActive,
  STUDENT_PORTAL_ITEMS,
} from "@/components/student/student-portal-nav-config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STUDENT_SIDEBAR_STORAGE_KEY = "app-student-sidebar-collapsed";
const STUDENT_SIDEBAR_EXPANDED_WIDTH_PX = 220;

export default function StudentPortalSidebar() {
  const pathname = usePathname() || "/student";
  const [collapsed, setCollapsed] = useState(false);

  const sidebarGroups = useMemo(
    () => [
      {
        title: "Overview",
        items: STUDENT_PORTAL_ITEMS.filter((item) => item.href === "/student"),
      },
      {
        title: "Learning",
        items: STUDENT_PORTAL_ITEMS.filter((item) =>
          ["/student/tests", "/student/courses", "/student/live-classes", "/student/diary"].includes(
            item.href,
          ),
        ),
      },
      {
        title: "Profile",
        items: STUDENT_PORTAL_ITEMS.filter(
          (item) => item.href === "/student/account",
        ),
      },
    ].filter((group) => group.items.length > 0),
    [],
  );

  useEffect(() => {
    try {
      setCollapsed(
        window.localStorage.getItem(STUDENT_SIDEBAR_STORAGE_KEY) === "true",
      );
    } catch {}
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const nextWidth = `${getSidebarWidthPx(
      collapsed,
      STUDENT_SIDEBAR_EXPANDED_WIDTH_PX,
    )}px`;

    root.style.setProperty("--app-sidebar-width", nextWidth);

    try {
      window.localStorage.setItem(
        STUDENT_SIDEBAR_STORAGE_KEY,
        String(collapsed),
      );
    } catch {}

    return () => {
      if (root.style.getPropertyValue("--app-sidebar-width") === nextWidth) {
        root.style.removeProperty("--app-sidebar-width");
      }
    };
  }, [collapsed]);

  const toggleSidebarLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <aside
      className="app-sidebar-shell fixed bottom-0 left-0 top-[var(--app-header-height)] hidden w-[var(--app-sidebar-width)] border-r transition-[width] duration-200 ease-in-out lg:block"
      aria-label="Student portal navigation"
    >
      <div className="flex h-full flex-col">
        <div
          className={cn(
            "border-b border-[hsl(var(--app-nav-border)/0.85)] py-3",
            collapsed ? "px-1.5" : "px-3.5",
          )}
        >
          <div
            className={cn(
              "flex items-center",
              collapsed ? "justify-center" : "justify-between",
            )}
          >
            {!collapsed ? (
              <div className="space-y-1 px-2">
                <p className="app-nav-section-caption">Navigation</p>
                <p className="app-nav-text text-sm font-medium">
                  Student workspace
                </p>
              </div>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={toggleSidebarLabel}
              aria-label={toggleSidebarLabel}
              className="h-9 w-9 rounded-xl text-[hsl(var(--app-nav-foreground))] hover:bg-[hsl(var(--app-nav-hover)/0.72)] hover:text-[hsl(var(--app-nav-foreground))]"
              onClick={() => setCollapsed((current) => !current)}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "flex-1 overflow-y-auto py-4",
            collapsed ? "px-1.5" : "px-3",
          )}
        >
          <div className="flex h-full flex-col gap-4">
            {sidebarGroups.map((group) => (
              <div key={group.title}>
                {collapsed ? (
                  <div className="mb-2 px-2" aria-hidden="true">
                    <div className="app-nav-divider h-px rounded-full" />
                  </div>
                ) : (
                  <p className="app-nav-group-label mb-1.5 px-3">
                    {group.title}
                  </p>
                )}

                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isStudentPortalItemActive(pathname, item);
                    const Icon = item.icon;

                    return (
                      <AppPrefetchLink
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        aria-label={item.label}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "app-sidebar-item flex w-full items-center rounded-[var(--app-radius-md)] text-sm transition-colors",
                          collapsed
                            ? "justify-center px-0 py-2"
                            : "justify-start gap-3 px-3 py-2",
                          active && "app-sidebar-item-active",
                        )}
                      >
                        <span
                          className={cn(
                            "flex items-center",
                            collapsed ? "justify-center" : "gap-3",
                          )}
                        >
                          <span className="app-sidebar-item-icon">
                            <Icon className="h-4 w-4 shrink-0" />
                          </span>
                          {!collapsed ? (
                            <span className="truncate">{item.label}</span>
                          ) : null}
                        </span>
                      </AppPrefetchLink>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-auto" />
          </div>
        </div>
      </div>
    </aside>
  );
}
