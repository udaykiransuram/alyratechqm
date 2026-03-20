"use client";

import { type ComponentType, useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getSchoolKeyFromCookie } from "@/lib/client/school";
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

function isCompanyRoute(pathname: string) {
  return (
    pathname === "/manage/schools" ||
    pathname.startsWith("/manage/schools/") ||
    pathname === "/manage/admin/indexing" ||
    pathname.startsWith("/manage/admin/indexing/")
  );
}

function isStudentRoute(pathname: string) {
  return pathname === "/student" || pathname.startsWith("/student/");
}

function isAuthRoute(pathname: string) {
  return pathname === "/auth/signin" || pathname === "/auth/company-signin";
}

const schoolSidebarGroups: SidebarGroup[] = [
  {
    title: "Workspace",
    items: [
      {
        label: "Home",
        icon: Layers,
        children: [{ href: "/", label: "Home" }],
      },
    ],
  },
  {
    title: "Assessments",
    items: [
      {
        label: "Question Papers",
        icon: BookOpen,
        children: [
          { href: "/question-papers", label: "All Question Papers" },
          { href: "/question-papers/create", label: "Create Question Paper" },
        ],
      },
      {
        label: "Question Bank",
        icon: FileQuestion,
        children: [
          { href: "/questions", label: "All Questions" },
          { href: "/questions/create", label: "Create Question" },
          { href: "/questions/bulk-upload", label: "Bulk Upload" },
        ],
      },
    ],
  },
  {
    title: "People",
    items: [
      {
        label: "Students",
        icon: GraduationCap,
        children: [
          { href: "/students", label: "All Students" },
          { href: "/students/create", label: "Create Student" },
        ],
      },
      {
        label: "Teachers",
        icon: UserCog,
        children: [
          { href: "/teachers", label: "All Teachers" },
          { href: "/teachers/create", label: "Create Teacher" },
        ],
      },
      {
        label: "Admins",
        icon: Settings2,
        children: [
          { href: "/admins", label: "All Admins" },
          { href: "/admins/create", label: "Create Admin" },
        ],
      },
      {
        label: "User Directory",
        icon: Users,
        children: [{ href: "/manage/users", label: "Manage School Users" }],
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
        label: "Classes & Sections",
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
    title: "Insights",
    items: [
      {
        label: "Analytics",
        icon: BarChart2,
        children: [
          { href: "/analytics", label: "Overview" },
          {
            href: "/analytics/student-tag-report/excel-upload",
            label: "Student Tag Upload",
          },
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
    ],
  },
  {
    title: "Tools",
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

const companySidebarGroups: SidebarGroup[] = [
  {
    title: "Company Operations",
    items: [
      {
        label: "Schools",
        icon: Building2,
        children: [{ href: "/manage/schools", label: "Manage Schools" }],
      },
      {
        label: "Maintenance",
        icon: BarChart2,
        children: [
          { href: "/manage/admin/indexing", label: "Maintenance Console" },
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
      className="app-nav-brand flex min-w-0 items-center gap-2.5 px-1.5 py-1.5"
    >
      <div className="app-nav-logo flex h-9 w-9 items-center justify-center rounded-xl">
        <Layers className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold tracking-wide">ALYRA TECH</p>
        <p className="text-xs text-muted-foreground">
          Quality Management Workspace
        </p>
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
  const [schoolKey, setSchoolKey] = useState("");

  useEffect(() => {
    setSchoolKey(getSchoolKeyFromCookie());
  }, []);

  if (!schoolKey) return null;

  const initials = getSchoolInitials(schoolKey, schoolKey);

  return (
    <div
      title={schoolKey}
      aria-label={`Current school: ${schoolKey}`}
      className="app-nav-chip mt-2.5 flex items-center justify-center p-1.5"
    >
      <div className="app-nav-logo flex h-9 w-9 items-center justify-center rounded-xl text-xs font-semibold tracking-[0.08em]">
        {initials}
      </div>
    </div>
  );
}

function CurrentSchoolBadge({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [schoolKey, setSchoolKey] = useState("");

  useEffect(() => {
    setSchoolKey(getSchoolKeyFromCookie());
  }, []);

  return (
    <div
      className={cn(
        "app-nav-chip flex items-center gap-2",
        compact ? "px-3 py-2" : "px-3 py-2.5",
      )}
    >
      <div className="app-nav-logo flex h-8 w-8 items-center justify-center rounded-xl">
        <Building2 className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          School Workspace
        </p>
        <p className="truncate text-sm font-medium text-foreground">
          {schoolKey || "No school selected"}
        </p>
      </div>
    </div>
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
    "app-sidebar-item flex w-full items-center rounded-xl text-sm transition-colors",
    collapsed ? "justify-center px-0 py-2" : "justify-between gap-3 px-3 py-2",
    isActive ? "app-sidebar-item-active" : null,
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
                  "app-sidebar-subitem block rounded-lg px-3 py-1.5 text-sm transition-colors",
                  childActive ? "app-sidebar-subitem-active font-medium" : null,
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
  return <SidebarNavGroups collapsed={collapsed} groups={schoolSidebarGroups} />;
}

function SidebarNavGroups({
  collapsed,
  groups,
}: {
  collapsed: boolean;
  groups: SidebarGroup[];
}) {
  return (
    <div className="flex h-full flex-col gap-4">
      {groups
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <div key={group.title}>
            {collapsed ? (
                <div className="mb-2 px-2" aria-hidden="true">
                <div className="app-nav-divider h-px rounded-full" />
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

function MobileSidebar({
  groups,
  showSchoolWorkspace,
}: {
  groups: SidebarGroup[];
  showSchoolWorkspace: boolean;
}) {
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
      <DialogContent className="app-nav-mobile-dialog inset-0 h-[100dvh] w-screen translate-x-0 translate-y-0 rounded-none p-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:w-full sm:max-w-sm sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl">
        <DialogHeader className="border-b border-[hsl(var(--app-nav-border)/0.85)] px-5 py-4">
          <DialogTitle>Navigation</DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(100dvh-80px)] overflow-y-auto px-4 py-4">
          {showSchoolWorkspace ? (
            <div className="mb-5">
              <CurrentSchoolBadge compact />
            </div>
          ) : null}
          <div className="flex h-full flex-col gap-4">
            {groups
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
                              "app-sidebar-item flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                              isActive ? "app-sidebar-item-active" : null,
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
                          className="app-nav-panel p-1.5"
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
                                    "app-sidebar-subitem block rounded-lg px-3 py-1.5 text-sm transition-colors",
                                    childActive ? "app-sidebar-subitem-active font-medium" : null,
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
  const pathname = usePathname() || "/";
  const [collapsed, setCollapsed] = useState(false);
  const schoolWorkspaceRoute =
    !isAuthRoute(pathname) && !isCompanyRoute(pathname) && !isStudentRoute(pathname);
  const companyRoute = isCompanyRoute(pathname);
  const studentRoute = isStudentRoute(pathname);
  const authRoute = isAuthRoute(pathname);
  const hasSidebar = !authRoute && !studentRoute;
  const activeSidebarGroups = companyRoute
    ? companySidebarGroups
    : schoolSidebarGroups;
  const showMobileContextBar = schoolWorkspaceRoute;
  const authSwitchHref = pathname === "/auth/company-signin"
    ? "/auth/signin"
    : "/auth/company-signin";
  const authSwitchLabel = pathname === "/auth/company-signin"
    ? "School Sign In"
    : "Company Sign In";

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
      hasSidebar
        ? collapsed
          ? SIDEBAR_COLLAPSED_WIDTH
          : SIDEBAR_EXPANDED_WIDTH
        : "0px",
    );
    document.documentElement.style.setProperty(
      "--app-mobile-school-switcher-height",
      showMobileContextBar ? "5rem" : "0px",
    );

    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch {
    }
  }, [collapsed, hasSidebar, showMobileContextBar]);

  async function handleSignOut() {
    await signOut({
      callbackUrl: companyRoute ? "/auth/company-signin" : "/auth/signin",
    });
  }

  return (
    <>
      <header className="app-nav-shell fixed inset-x-0 top-0 z-50 h-[var(--app-header-height)] border-b backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--app-nav-surface)/0.82)]">
        <div className="flex h-full items-center justify-between gap-3 px-3 lg:px-4">
          <div className="flex min-w-0 items-center gap-3">
            {hasSidebar ? (
              <MobileSidebar
                groups={activeSidebarGroups}
                showSchoolWorkspace={schoolWorkspaceRoute}
              />
            ) : null}
            <Brand />
          </div>

          <div className="hidden min-w-0 flex-1 items-center justify-end md:flex">
            <div className="flex items-center gap-3">
              {schoolWorkspaceRoute ? <CurrentSchoolBadge /> : null}
              {companyRoute ? (
                <div className="app-nav-chip px-3 py-2.5 text-sm font-medium text-foreground">
                  Company Admin Portal
                </div>
              ) : null}
              {studentRoute ? (
                <>
                  <div className="app-nav-chip px-3 py-2.5 text-sm font-medium text-foreground">
                    Student Test Portal
                  </div>
                  <Button
                    asChild
                    variant={pathname.startsWith("/student/tests") ? "default" : "outline"}
                    size="sm"
                  >
                    <Link href="/student/tests">Tests</Link>
                  </Button>
                  <Button
                    asChild
                    variant={pathname.startsWith("/student/account") ? "default" : "outline"}
                    size="sm"
                  >
                    <Link href="/student/account">Account</Link>
                  </Button>
                </>
              ) : null}
              {authRoute ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={authSwitchHref}>{authSwitchLabel}</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => void handleSignOut()}>
                  Sign out
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {showMobileContextBar ? (
        <div className="app-nav-shell fixed inset-x-0 top-[var(--app-header-height)] z-40 border-b px-3 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--app-nav-surface)/0.82)] md:hidden">
          <CurrentSchoolBadge compact />
        </div>
      ) : null}

      {hasSidebar ? (
        <aside className="app-sidebar-shell fixed bottom-0 left-0 top-[var(--app-header-height)] hidden w-[var(--app-sidebar-width)] border-r transition-[width] duration-200 ease-in-out lg:block">
        <div className="flex h-full flex-col">
          <div className={cn("border-b border-[hsl(var(--app-nav-border)/0.85)] py-2.5", collapsed ? "px-1.5" : "px-3")}>
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
                className="h-8 w-8 rounded-xl hover:bg-[hsl(var(--app-nav-hover)/0.72)]"
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
            {collapsed && schoolWorkspaceRoute ? <CollapsedSchoolBadge /> : null}
          </div>

          <div
            className={cn(
              "flex-1 overflow-y-auto py-4",
              collapsed ? "px-1.5" : "px-3",
            )}
          >
            <SidebarNavGroups collapsed={collapsed} groups={activeSidebarGroups} />
          </div>
        </div>
        </aside>
      ) : null}
    </>
  );
}
