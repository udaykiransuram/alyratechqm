"use client";

import { type ComponentType, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { fetchApiJson } from "@/lib/client/api";
import { getSchoolKeyFromCookie } from "@/lib/client/school";
import SchoolSwitcher from "@/components/navigation/SchoolSwitcher";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  BarChart2,
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  GraduationCap,
  Layers,
  Menu,
  Megaphone,
  Settings2,
  Tags,
  Upload,
  UserCog,
  Users,
} from "lucide-react";

type SidebarChild = {
  href: string;
  label: string;
};

type SidebarItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  children: SidebarChild[];
};

type SidebarGroup = {
  title: string;
  items: SidebarItem[];
};

const SIDEBAR_EXPANDED_WIDTH = "var(--app-sidebar-expanded-width)";
const SIDEBAR_COLLAPSED_WIDTH = "var(--app-sidebar-collapsed-width)";
const SIDEBAR_STORAGE_KEY = "app-sidebar-collapsed";

const sidebarGroups: SidebarGroup[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Home",
        icon: Layers,
        children: [{ href: "/", label: "Home" }],
      },
    ],
  },
  {
    title: "Public",
    items: [
      {
        label: "Public",
        icon: Megaphone,
        children: [
          { href: "/register", label: "Register" },
          { href: "/marketing", label: "Product" },
        ],
      },
    ],
  },
  {
    title: "Assessment",
    items: [
      {
        label: "Papers",
        icon: BookOpen,
        children: [
          { href: "/question-papers", label: "All Papers" },
          { href: "/question-papers/create", label: "Create Paper" },
        ],
      },
      {
        label: "Questions",
        icon: FileQuestion,
        children: [
          { href: "/questions", label: "All Questions" },
          { href: "/questions/create", label: "Create Question" },
          { href: "/questions/bulk-upload", label: "Bulk Upload" },
        ],
      },
      {
        label: "Students",
        icon: GraduationCap,
        children: [
          { href: "/students", label: "All Students" },
          { href: "/students/create", label: "Create Student" },
        ],
      },
    ],
  },
  {
    title: "Academic Setup",
    items: [
      {
        label: "Subjects",
        icon: Layers,
        children: [
          { href: "/subjects", label: "All Subjects" },
          { href: "/subjects/create", label: "Create Subject" },
        ],
      },
      {
        label: "Tags",
        icon: Tags,
        children: [
          { href: "/tags", label: "All Tags" },
          { href: "/tags/create", label: "Create Tag" },
        ],
      },
      {
        label: "Classes",
        icon: Layers,
        children: [
          { href: "/manage/classes", label: "All Classes" },
          { href: "/manage/classes/create", label: "Create Class" },
          { href: "/manage/sections", label: "All Sections" },
          { href: "/manage/sections/create", label: "Create Section" },
        ],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        label: "Users",
        icon: Users,
        children: [{ href: "/manage/users", label: "Users" }],
      },
      {
        label: "Teachers",
        icon: UserCog,
        children: [
          { href: "/teachers", label: "Teachers List" },
          { href: "/teachers/create", label: "Create Teacher" },
        ],
      },
      {
        label: "Admins",
        icon: Settings2,
        children: [
          { href: "/admins", label: "Admins List" },
          { href: "/admins/create", label: "Create Admin" },
        ],
      },
      {
        label: "Reports",
        icon: BarChart2,
        children: [
          { href: "/manage/reports", label: "Report Jobs" },
          { href: "/manage/audit-logs", label: "Audit Logs" },
        ],
      },
      {
        label: "Schools",
        icon: Building2,
        children: [{ href: "/manage/schools", label: "Manage Schools" }],
      },
    ],
  },
  {
    title: "Analytics",
    items: [
      {
        label: "Analytics",
        icon: BarChart2,
        children: [
          { href: "/analytics", label: "Overview" },
          {
            href: "/analytics/student-tag-report/excel-upload",
            label: "Excel Upload",
          },
          { href: "/manage/reports", label: "Dispatch Jobs" },
        ],
      },
    ],
  },
  {
    title: "Utilities",
    items: [
      {
        label: "Upload Tools",
        icon: Upload,
        children: [
          { href: "/upload", label: "Upload" },
          { href: "/upload/getjson", label: "Get JSON" },
        ],
      },
    ],
  },
];

function isChildActive(pathname: string, child: SidebarChild) {
  return child.href === "/" ? pathname === "/" : pathname.startsWith(child.href);
}

function isItemActive(pathname: string, item: SidebarItem) {
  return item.children.some((child) => isChildActive(pathname, child));
}

function Brand() {
  return (
    <Link
      href="/"
      className="flex min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-accent/70"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Layers className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold tracking-wide">ALYRA TECH</p>
        <p className="text-xs text-muted-foreground">Young Scholars Talent Test</p>
      </div>
    </Link>
  );
}

function getSchoolInitials(label: string, key: string) {
  const source = label.trim() || key.trim();
  const words = source
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
  }

  return source.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "SC";
}

function CollapsedSchoolBadge() {
  const [school, setSchool] = useState<{ key: string; displayName: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSchool() {
      try {
        const schoolKey = getSchoolKeyFromCookie();

        if (!schoolKey) {
          if (!cancelled) setSchool(null);
          return;
        }

        try {
          const json = await fetchApiJson<any>("/api/schools", {
            cache: "no-store",
            schoolKey: "",
            fallbackMessage: "Failed to load schools.",
          });
          const currentSchool = Array.isArray(json.schools)
            ? json.schools.find((entry: any) => String(entry?.key || "") === schoolKey)
            : null;

          if (!cancelled) {
            setSchool(
              currentSchool
                ? {
                    key: String(currentSchool.key || schoolKey),
                    displayName: String(currentSchool.displayName || currentSchool.key || schoolKey),
                  }
                : { key: schoolKey, displayName: schoolKey },
            );
          }
        } catch {
          if (!cancelled) {
            setSchool({ key: schoolKey, displayName: schoolKey });
          }
        }
      } catch {
        if (!cancelled) setSchool(null);
      }
    }

    loadSchool();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!school) return null;

  const initials = getSchoolInitials(school.displayName, school.key);

  return (
    <Link
      href="/manage/schools"
      title={`${school.displayName} (${school.key})`}
      aria-label={`Current school: ${school.displayName}`}
      className="mt-2.5 flex items-center justify-center rounded-xl border border-border/60 bg-card/60 p-1.5 shadow-sm transition-colors hover:bg-accent/60"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-semibold tracking-[0.08em] text-primary">
        {initials}
      </div>
    </Link>
  );
}

function DesktopSidebarItem({
  item,
  collapsed,
}: {
  item: SidebarItem;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const Icon = item.icon;
  const directChild = item.children.length === 1 ? item.children[0] : null;
  const isActive = isItemActive(pathname, item);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const triggerClassName = cn(
    "flex w-full items-center rounded-xl text-sm transition-colors",
    collapsed ? "justify-center px-0 py-2" : "justify-between gap-3 px-3 py-2",
    isActive
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-foreground/75 hover:bg-accent hover:text-accent-foreground",
  );

  const content = (
    <>
      <span className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </span>
      {!collapsed && !directChild && <span className="text-xs opacity-70">›</span>}
    </>
  );

  if (directChild) {
    return (
      <Link
        href={directChild.href}
        title={item.label}
        aria-label={item.label}
        className={triggerClassName}
      >
        {content}
      </Link>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={item.label}
          aria-label={item.label}
          className={triggerClassName}
        >
          {content}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={collapsed ? 14 : 10}
        className="w-56 p-1.5"
      >
        <div className="space-y-0.5">
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
            {item.label}
          </p>
          {item.children.map((child) => {
            const childActive = isChildActive(pathname, child);

            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block rounded-lg px-3 py-1.5 text-sm transition-colors",
                  childActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground/75 hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SidebarNav({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex h-full flex-col gap-4">
      {sidebarGroups
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <div key={group.title}>
            {collapsed ? (
              <div className="mb-2 px-2" aria-hidden="true">
                <div className="h-px rounded-full bg-border" />
              </div>
            ) : (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <DesktopSidebarItem
                  key={item.label}
                  item={item}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

function MobileSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-xl lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="inset-0 h-[100dvh] w-screen translate-x-0 translate-y-0 rounded-none p-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:w-full sm:max-w-sm sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Navigation</DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(100dvh-80px)] overflow-y-auto px-4 py-4">
          <div className="mb-5 rounded-2xl border border-border/60 bg-card/40 p-3">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              School Workspace
            </p>
            <SchoolSwitcher
              className="max-w-none border-0 bg-transparent p-0 shadow-none backdrop-blur-0"
              showCreateButton={false}
              onManageClick={() => setOpen(false)}
            />
          </div>
          <div className="flex h-full flex-col gap-4">
            {sidebarGroups
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <div key={group.title}>
                  <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {group.title}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const directChild =
                        item.children.length === 1 ? item.children[0] : null;
                      const isActive = isItemActive(pathname, item);

                      if (directChild) {
                        return (
                          <Link
                            key={item.label}
                            href={directChild.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                              isActive
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-foreground/75 hover:bg-accent hover:text-accent-foreground",
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      }

                      return (
                        <div
                          key={item.label}
                          className="rounded-xl border bg-card/40 p-1.5"
                        >
                          <div className="flex items-center gap-3 px-2 py-1.5 text-sm font-medium">
                            <Icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                          </div>
                          <div className="space-y-0.5">
                            {item.children.map((child) => {
                              const childActive = isChildActive(pathname, child);

                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={() => setOpen(false)}
                                  className={cn(
                                    "block rounded-lg px-3 py-1.5 text-sm transition-colors",
                                    childActive
                                      ? "bg-primary/10 font-medium text-primary"
                                      : "text-foreground/75 hover:bg-accent hover:text-accent-foreground",
                                  )}
                                >
                                  {child.label}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SiteHeader() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const savedState = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (savedState === "true") {
        setCollapsed(true);
      }
    } catch {
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--app-sidebar-width",
      collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
    );

    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch {
    }
  }, [collapsed]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-[var(--app-header-height)] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="flex h-full items-center justify-between gap-3 px-3 lg:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <MobileSidebar />
            <Brand />
          </div>

          <div className="hidden min-w-0 flex-1 items-center justify-end md:flex">
            <SchoolSwitcher className="max-w-[24rem] xl:max-w-[28rem]" />
          </div>
        </div>
      </header>

      <div className="fixed inset-x-0 top-[var(--app-header-height)] z-40 border-b bg-background/95 px-3 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/75 md:hidden">
        <SchoolSwitcher className="max-w-none" showCreateButton={false} />
      </div>

      <aside className="fixed bottom-0 left-0 top-[var(--app-header-height)] hidden w-[var(--app-sidebar-width)] border-r bg-background transition-[width] duration-200 ease-in-out lg:block">
        <div className="flex h-full flex-col">
          <div className={cn("border-b py-2.5", collapsed ? "px-1.5" : "px-3")}>
            <div
              className={cn(
                "flex items-center",
                collapsed ? "justify-center" : "justify-between",
              )}
            >
              {!collapsed && (
                <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Navigation
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="h-8 w-8 rounded-xl"
                onClick={() => setCollapsed((value) => !value)}
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {collapsed ? "Expand sidebar" : "Collapse sidebar"}
                </span>
              </Button>
            </div>
            {collapsed ? <CollapsedSchoolBadge /> : null}
          </div>

          <div
            className={cn(
              "flex-1 overflow-y-auto py-4",
              collapsed ? "px-1.5" : "px-3",
            )}
          >
            <SidebarNav collapsed={collapsed} />
          </div>
        </div>
      </aside>
    </>
  );
}
