"use client";

import { type ComponentType, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  getSchoolDisplayNameFromCookie,
  getSchoolKeyFromCookie,
  setSchoolSelectionCookies,
} from "@/lib/client/school";
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

type CurrentSchoolInfo = {
  key: string;
  label: string;
  initials: string;
};

const SIDEBAR_EXPANDED_WIDTH = "var(--app-sidebar-expanded-width)";
const SIDEBAR_COLLAPSED_WIDTH = "var(--app-sidebar-collapsed-width)";
const SIDEBAR_STORAGE_KEY = "app-sidebar-collapsed";

function isCompanyRoute(pathname: string) {
  return pathname === "/company" || pathname.startsWith("/company/");
}

function isStudentRoute(pathname: string) {
  return pathname === "/student" || pathname.startsWith("/student/");
}

function isAuthRoute(pathname: string) {
  return pathname === "/auth/signin" || pathname === "/auth/company-signin";
}

function isPublicRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/about" ||
    pathname.startsWith("/about/") ||
    pathname === "/benefits" ||
    pathname.startsWith("/benefits/") ||
    pathname === "/talent-test" ||
    pathname.startsWith("/talent-test/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/") ||
    pathname === "/terms" ||
    pathname.startsWith("/terms/") ||
    pathname === "/success" ||
    pathname.startsWith("/success/") ||
    pathname === "/contact" ||
    pathname.startsWith("/contact/") ||
    pathname === "/product" ||
    pathname.startsWith("/product/") ||
    pathname === "/case-study" ||
    pathname.startsWith("/case-study/")
  );
}

function normalizeSidebarPath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function matchesSidebarChild(pathname: string, childHref: string) {
  const normalizedPath = normalizeSidebarPath(pathname);
  const normalizedHref = normalizeSidebarPath(childHref);

  if (normalizedHref === "/") {
    return normalizedPath === "/";
  }

  // Keep the workspace home item exact-only so it does not stay active
  // across every nested route within the app shell.
  if (normalizedHref === "/workspace") {
    return normalizedPath === "/workspace";
  }

  return (
    normalizedPath === normalizedHref ||
    normalizedPath.startsWith(`${normalizedHref}/`)
  );
}

function getActiveSidebarChild(pathname: string, children: SidebarChild[]) {
  let activeChild: SidebarChild | null = null;

  for (const child of children) {
    if (!matchesSidebarChild(pathname, child.href)) {
      continue;
    }

    if (
      !activeChild ||
      normalizeSidebarPath(child.href).length > normalizeSidebarPath(activeChild.href).length
    ) {
      activeChild = child;
    }
  }

  return activeChild;
}

const schoolSidebarGroups: SidebarGroup[] = [
  {
    title: "Workspace",
    items: [
      {
        label: "Home",
        icon: Layers,
        children: [{ href: "/workspace", label: "Home" }],
      },
    ],
  },
  {
    title: "Assessments",
    items: [
      {
        label: "Papers",
        icon: BookOpen,
        children: [
          { href: "/workspace/question-papers", label: "All Question Papers" },
          { href: "/workspace/question-papers/create", label: "Create Question Paper" },
        ],
      },
      {
        label: "Questions",
        icon: FileQuestion,
        children: [
          { href: "/workspace/questions", label: "All Questions" },
          { href: "/workspace/questions/create", label: "Create Question" },
          { href: "/workspace/questions/bulk-upload", label: "Bulk Upload" },
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
          { href: "/workspace/students", label: "All Students" },
          { href: "/workspace/students/create", label: "Create Student" },
        ],
      },
      {
        label: "Teachers",
        icon: UserCog,
        children: [
          { href: "/workspace/teachers", label: "All Teachers" },
          { href: "/workspace/teachers/create", label: "Create Teacher" },
        ],
      },
      {
        label: "Admins",
        icon: Settings2,
        children: [
          { href: "/workspace/admins", label: "All Admins" },
          { href: "/workspace/admins/create", label: "Create Admin" },
        ],
      },
      {
        label: "Users",
        icon: Users,
        children: [{ href: "/workspace/manage/users", label: "Users" }],
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
          { href: "/workspace/subjects", label: "All Subjects" },
          { href: "/workspace/subjects/create", label: "Create Subject" },
        ],
      },
      {
        label: "Tags",
        icon: Tags,
        children: [
          { href: "/workspace/tags", label: "All Tags" },
          { href: "/workspace/tags/create", label: "Create Tag" },
        ],
      },
      {
        label: "Sections",
        icon: Layers,
        children: [
          { href: "/workspace/manage/classes", label: "All Classes" },
          { href: "/workspace/manage/classes/create", label: "Create Class" },
          { href: "/workspace/manage/sections", label: "All Sections" },
          { href: "/workspace/manage/sections/create", label: "Create Section" },
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
          { href: "/workspace/analytics", label: "Overview" },
          {
            href: "/workspace/analytics/student-tag-report/excel-upload",
            label: "Student Tag Upload",
          },
        ],
      },
      {
        label: "Reports",
        icon: BarChart2,
        children: [
          { href: "/workspace/manage/reports", label: "Report Jobs" },
          { href: "/workspace/manage/audit-logs", label: "Audit Logs" },
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
          { href: "/workspace/upload", label: "Upload" },
          { href: "/workspace/upload/getjson", label: "Get JSON" },
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
        children: [{ href: "/company/schools", label: "Manage Schools" }],
      },
      {
        label: "Maintenance",
        icon: BarChart2,
        children: [
          { href: "/company/activity", label: "Operations Activity" },
          { href: "/company/indexing", label: "Maintenance Console" },
          { href: "/company/talent-test", label: "Talent Test" },
        ],
      },
      {
        label: "Public Site CMS",
        icon: BookOpen,
        children: [
          { href: "/company/content", label: "Dashboard" },
          { href: "/company/content/stats", label: "Site Stats" },
          { href: "/company/content/testimonials", label: "Testimonials" },
          { href: "/company/content/messages", label: "Messages" },
          { href: "/company/content/case-studies", label: "Case Studies" },
          { href: "/company/content/pricing", label: "Pricing Plans" },
          { href: "/company/content/faq", label: "FAQs" },
          { href: "/company/content/contact-info", label: "Contact Info" },
        ],
      },
    ],
  },
];

function Brand() {
  const pathname = usePathname() || "/";
  const publicRoute = isPublicRoute(pathname);
  const companyRoute = isCompanyRoute(pathname);
  const studentRoute = isStudentRoute(pathname);
  const href = publicRoute
    ? "/"
    : companyRoute
      ? "/company/schools"
      : studentRoute
        ? "/student/tests"
        : "/workspace";
  const subtitle = publicRoute
    ? "Talent Test & STEM Assessment"
    : "Quality Management Workspace";

  return (
    <Link
      href={href}
      className="app-nav-brand flex min-w-0 items-center gap-2.5 px-1.5 py-1.5"
    >
      <div className="app-nav-logo flex h-9 w-9 items-center justify-center rounded-xl">
        <Layers className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold tracking-wide">ALYRA TECH</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
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

function useCurrentSchoolInfo(enabled: boolean): CurrentSchoolInfo {
  const [school, setSchool] = useState({
    key: "",
    label: "",
    resolved: false,
  });

  useEffect(() => {
    let active = true;

    if (!enabled) {
      setSchool({ key: "", label: "", resolved: false });
      return () => {
        active = false;
      };
    }

    const schoolKey = getSchoolKeyFromCookie();
    const schoolDisplayName = getSchoolDisplayNameFromCookie();

    setSchool({
      key: schoolKey,
      label: schoolDisplayName,
      resolved: !schoolKey || Boolean(schoolDisplayName),
    });

    if (!schoolKey || schoolDisplayName) {
      return () => {
        active = false;
      };
    }

    void (async () => {
      try {
        const response = await fetch("/api/public/schools", { cache: "no-store" });
        const data = (await response.json()) as {
          schools?: Array<{ key?: string; displayName?: string }>;
        };
        const matchedSchool = Array.isArray(data?.schools)
          ? data.schools.find(
              (school) => String(school?.key || "").trim() === schoolKey,
            )
          : null;
        const resolvedLabel = String(
          matchedSchool?.displayName || matchedSchool?.key || "",
        ).trim();

        if (!active) {
          return;
        }

        if (resolvedLabel) {
          setSchoolSelectionCookies(schoolKey, resolvedLabel);
          setSchool({ key: schoolKey, label: resolvedLabel, resolved: true });
          return;
        }

        setSchool({ key: schoolKey, label: schoolKey, resolved: true });
      } catch {
        if (!active) {
          return;
        }
        setSchool({ key: schoolKey, label: schoolKey, resolved: true });
      }
    })();

    return () => {
      active = false;
    };
  }, [enabled]);

  const label =
    school.label ||
    (school.key ? (school.resolved ? school.key : "Loading school...") : "");

  return {
    key: school.key,
    label,
    initials: getSchoolInitials(label || school.key, school.key),
  };
}

function CollapsedSchoolBadge({ school }: { school: CurrentSchoolInfo }) {
  if (!school.key) return null;

  return (
    <div
      title={school.label ? `${school.label} (${school.key})` : school.key}
      aria-label={`Current school: ${school.label || school.key}`}
      className="app-nav-chip mt-2.5 flex items-center justify-center p-1.5"
    >
      <div className="app-nav-logo flex h-9 w-9 items-center justify-center rounded-xl text-xs font-semibold tracking-[0.08em]">
        {school.initials}
      </div>
    </div>
  );
}

function CurrentSchoolBadge({
  school,
  compact = false,
}: {
  school: CurrentSchoolInfo;
  compact?: boolean;
}) {
  const label = school.label || "No school selected";
  const title = school.key && school.label
    ? `${school.label} (${school.key})`
    : label;

  return (
    <div
      title={title}
      aria-label={title}
      className={cn(
        "app-nav-chip flex h-9 max-w-[min(32rem,44vw)] items-center gap-2 px-3",
        compact ? "max-w-full" : null,
      )}
    >
      <div className="app-nav-logo flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-semibold tracking-[0.08em]">
        {school.initials}
      </div>
      <p className="min-w-0 truncate text-[13px] font-medium leading-none text-foreground">
        {label}
      </p>
    </div>
  );
}

function DesktopSidebarItem({
  item,
  collapsed,
  activePath,
  onNavigate,
}: {
  item: SidebarItem;
  collapsed: boolean;
  activePath: string;
  onNavigate: (href: string) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const hasPrefetchedChildrenRef = useRef(false);
  const Icon = item.icon;
  const directChild = item.children.length === 1 ? item.children[0] : null;
  const activeChild = getActiveSidebarChild(activePath, item.children);
  const isActive = activeChild !== null;

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const openMenu = () => {
    clearCloseTimeout();
    if (!hasPrefetchedChildrenRef.current) {
      hasPrefetchedChildrenRef.current = true;
      item.children.forEach((child) => {
        router.prefetch(child.href);
      });
    }
    setOpen(true);
  };

  const scheduleClose = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimeoutRef.current = null;
    }, 180);
  };

  useEffect(() => {
    clearCloseTimeout();
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, []);

  const triggerClassName = cn(
    "app-sidebar-item flex w-full items-center rounded-xl text-sm transition-colors",
    collapsed ? "justify-center px-0 py-2" : "justify-between gap-3 px-3 py-2",
    isActive ? "app-sidebar-item-active" : null,
  );

  const content = (
    <>
      <span className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
        <span className="app-sidebar-item-icon">
          <Icon className="h-4 w-4 shrink-0" />
        </span>
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
        onClick={() => onNavigate(directChild.href)}
      >
        {content}
      </Link>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          clearCloseTimeout();
        }
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          title={item.label}
          aria-label={item.label}
          className={triggerClassName}
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
          onFocus={openMenu}
        >
          {content}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={collapsed ? 10 : 8}
        className="app-nav-popover w-56 p-1.5"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
        <div className="space-y-0.5">
          <p className="app-nav-popover-title">
            {item.label}
          </p>
          {item.children.map((child) => {
            const childActive = activeChild?.href === child.href;

            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={() => {
                  onNavigate(child.href);
                  setOpen(false);
                }}
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

function SidebarNavGroups({
  collapsed,
  groups,
  activePath,
  onNavigate,
}: {
  collapsed: boolean;
  groups: SidebarGroup[];
  activePath: string;
  onNavigate: (href: string) => void;
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
                  activePath={activePath}
                  onNavigate={onNavigate}
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
  school,
  showSchoolWorkspace,
  activePath,
  onNavigate,
}: {
  groups: SidebarGroup[];
  school: CurrentSchoolInfo;
  showSchoolWorkspace: boolean;
  activePath: string;
  onNavigate: (href: string) => void;
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
              <CurrentSchoolBadge school={school} compact />
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
                      const activeChild = getActiveSidebarChild(activePath, item.children);
                      const isActive = activeChild !== null;

                      if (directChild) {
                        return (
                          <Link
                            key={item.label}
                            href={directChild.href}
                            onClick={() => {
                              onNavigate(directChild.href);
                              setOpen(false);
                            }}
                            className={cn(
                              "app-sidebar-item flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                              isActive ? "app-sidebar-item-active" : null,
                            )}
                          >
                            <span className="app-sidebar-item-icon">
                              <Icon className="h-4 w-4 shrink-0" />
                            </span>
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
                            <span className="app-sidebar-item-icon">
                              <Icon className="h-4 w-4 shrink-0" />
                            </span>
                            <span>{item.label}</span>
                          </div>
                          <div className="space-y-0.5">
                            {item.children.map((child) => {
                              const childActive = activeChild?.href === child.href;

                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={() => {
                                    onNavigate(child.href);
                                    setOpen(false);
                                  }}
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
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const publicRoute = isPublicRoute(pathname);
  const schoolWorkspaceRoute =
    !isAuthRoute(pathname) &&
    !isCompanyRoute(pathname) &&
    !isStudentRoute(pathname) &&
    !publicRoute;
  const companyRoute = isCompanyRoute(pathname);
  const studentRoute = isStudentRoute(pathname);
  const authRoute = isAuthRoute(pathname);
  const hasSidebar = !authRoute && !studentRoute && !publicRoute;
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
  const currentSchool = useCurrentSchoolInfo(schoolWorkspaceRoute);
  const activePath = pendingPath || pathname;

  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  const handleNavigate = (href: string) => {
    setPendingPath(href);
  };

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
                school={currentSchool}
                showSchoolWorkspace={schoolWorkspaceRoute}
                activePath={activePath}
                onNavigate={handleNavigate}
              />
            ) : null}
            <Brand />
          </div>

          <div className="hidden min-w-0 flex-1 items-center justify-end md:flex">
            <div className="flex items-center gap-3">
              {schoolWorkspaceRoute ? <CurrentSchoolBadge school={currentSchool} /> : null}
              {companyRoute ? (
                <div className="app-nav-chip flex h-9 items-center px-3 text-[13px] font-medium text-foreground">
                  Company Admin Portal
                </div>
              ) : null}
              {studentRoute ? (
                <>
                  <div className="app-nav-chip flex h-9 items-center px-3 text-[13px] font-medium text-foreground">
                    Student Test Portal
                  </div>
                  <Button
                    asChild
                    variant={activePath.startsWith("/student/tests") ? "default" : "outline"}
                    size="sm"
                  >
                    <Link href="/student/tests" onClick={() => handleNavigate("/student/tests")}>
                      Tests
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant={activePath.startsWith("/student/account") ? "default" : "outline"}
                    size="sm"
                  >
                    <Link
                      href="/student/account"
                      onClick={() => handleNavigate("/student/account")}
                    >
                      Account
                    </Link>
                  </Button>
                </>
              ) : null}
              {publicRoute ? (
                <>
                  {pathname !== "/register" ? (
                    <Button asChild size="sm">
                      <Link href="/register">Register now</Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" size="sm">
                    <Link href="/auth/signin">School Sign In</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/auth/company-signin">Company Sign In</Link>
                  </Button>
                </>
              ) : authRoute ? (
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
          <CurrentSchoolBadge school={currentSchool} compact />
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
            {collapsed && schoolWorkspaceRoute ? (
              <CollapsedSchoolBadge school={currentSchool} />
            ) : null}
          </div>

          <div
            className={cn(
              "flex-1 overflow-y-auto py-4",
              collapsed ? "px-1.5" : "px-3",
            )}
          >
            <SidebarNavGroups
              collapsed={collapsed}
              groups={activeSidebarGroups}
              activePath={activePath}
              onNavigate={handleNavigate}
            />
          </div>
        </div>
        </aside>
      ) : null}
    </>
  );
}
