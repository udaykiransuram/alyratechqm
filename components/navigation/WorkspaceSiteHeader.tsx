"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  GraduationCap,
  Layers,
  Settings2,
  Tags,
  Upload,
  UserCog,
  Users,
} from "lucide-react";

import DeferredSiteHeaderMobileSidebar from "@/components/navigation/DeferredSiteHeaderMobileSidebar";
import {
  Brand,
  clampSidebarWidth,
  CurrentSchoolBadge,
  DesktopSidebarShell,
  getSidebarWidthPx,
  parseStoredSidebarWidth,
  resolveExpandedSidebarWidth,
  SIDEBAR_STORAGE_KEY,
  SIDEBAR_WIDTH_STORAGE_KEY,
  shouldCollapseSidebar,
  type SidebarGroup,
  useCurrentSchoolInfo,
} from "@/components/navigation/SiteHeaderShared";
import { Button } from "@/components/ui/button";
import { performNextAuthSignOutAndRedirect } from "@/lib/client/next-auth-client";

const schoolSidebarGroups: SidebarGroup[] = [
  {
    title: "Overview",
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
        label: "Question Papers",
        icon: BookOpen,
        children: [
          { href: "/workspace/question-papers", label: "All Question Papers" },
          {
            href: "/workspace/question-papers/create",
            label: "Create Question Paper",
          },
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
    title: "Learners & Staff",
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
        children: [
          { href: "/workspace/manage/users", label: "Manage Users" },
          { href: "/workspace/manage/users/create", label: "Create Users" },
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
        label: "Classes & Sections",
        icon: Layers,
        children: [
          { href: "/workspace/manage/classes", label: "All Classes" },
          { href: "/workspace/manage/classes/create", label: "Create Class" },
          { href: "/workspace/manage/sections", label: "All Sections" },
          {
            href: "/workspace/manage/sections/create",
            label: "Create Section",
          },
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
          { href: "/workspace/analytics", label: "Analytics Hub" },
          {
            href: "/workspace/analytics/student-tag-report/excel-upload",
            label: "Student Tag Upload",
          },
        ],
      },
      {
        label: "Reporting Ops",
        icon: BarChart2,
        children: [
          { href: "/workspace/manage/reports", label: "Report Delivery" },
          { href: "/workspace/manage/audit-logs", label: "Audit Logs" },
        ],
      },
    ],
  },
  {
    title: "Tools",
    items: [
      {
        label: "Settings",
        icon: Settings2,
        children: [{ href: "/workspace/settings", label: "Appearance Settings" }],
      },
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

export default function WorkspaceSiteHeader() {
  const pathname = usePathname() || "/workspace";
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSidebarWidth, setExpandedSidebarWidth] = useState(() =>
    getSidebarWidthPx(false),
  );
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    getSidebarWidthPx(false),
  );
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const currentSchool = useCurrentSchoolInfo(true);
  const activePath = pendingPath || pathname;

  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  useEffect(() => {
    try {
      const savedCollapsed =
        window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
      const savedExpandedWidth = parseStoredSidebarWidth(
        window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY),
      );

      setCollapsed(savedCollapsed);
      setExpandedSidebarWidth(savedExpandedWidth);
      setSidebarWidth(getSidebarWidthPx(savedCollapsed, savedExpandedWidth));
    } catch {}
  }, []);

  useEffect(() => {
    if (!isSidebarResizing) {
      setSidebarWidth(getSidebarWidthPx(collapsed, expandedSidebarWidth));
    }
  }, [collapsed, expandedSidebarWidth, isSidebarResizing]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--app-sidebar-width",
      `${clampSidebarWidth(sidebarWidth)}px`,
    );
    document.documentElement.style.setProperty(
      "--app-mobile-school-switcher-height",
      "0px",
    );

    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
      window.localStorage.setItem(
        SIDEBAR_WIDTH_STORAGE_KEY,
        String(resolveExpandedSidebarWidth(expandedSidebarWidth)),
      );
    } catch {}
  }, [collapsed, expandedSidebarWidth, sidebarWidth]);

  useEffect(() => {
    const root = document.documentElement;

    if (isSidebarResizing) {
      root.setAttribute("data-app-sidebar-resizing", "true");
    } else {
      root.removeAttribute("data-app-sidebar-resizing");
    }

    return () => {
      root.removeAttribute("data-app-sidebar-resizing");
    };
  }, [isSidebarResizing]);

  const toggleSidebarLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  const handleNavigate = (href: string) => {
    setPendingPath(href);
  };

  const handleSidebarResizeEnd = (nextWidth: number) => {
    const clampedWidth = clampSidebarWidth(nextWidth);
    setIsSidebarResizing(false);

    if (shouldCollapseSidebar(clampedWidth)) {
      setCollapsed(true);
      setSidebarWidth(getSidebarWidthPx(true, expandedSidebarWidth));
      return;
    }

    const nextExpandedWidth = resolveExpandedSidebarWidth(clampedWidth);
    setExpandedSidebarWidth(nextExpandedWidth);
    setCollapsed(false);
    setSidebarWidth(getSidebarWidthPx(false, nextExpandedWidth));
  };

  const handleSidebarToggle = () => {
    setIsSidebarResizing(false);
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    setSidebarWidth(getSidebarWidthPx(nextCollapsed, expandedSidebarWidth));
  };

  async function handleSignOut() {
    const targetUrl = new URL("/auth/signin", window.location.origin);
    targetUrl.searchParams.set("signedOut", "1");
    await performNextAuthSignOutAndRedirect({
      callbackUrl: targetUrl.toString(),
    });
  }

  return (
    <>
      <header className="app-nav-shell fixed inset-x-0 top-0 z-50 h-[var(--app-header-height)] border-b">
        <div className="flex h-full items-center justify-between gap-3 px-3 lg:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <DeferredSiteHeaderMobileSidebar
              groups={schoolSidebarGroups}
              school={currentSchool}
              showSchoolWorkspace
              activePath={activePath}
              onNavigate={handleNavigate}
              onSignOut={() => void handleSignOut()}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title={toggleSidebarLabel}
              aria-label={toggleSidebarLabel}
              className="hidden h-9 rounded-xl px-2.5 text-[hsl(var(--app-nav-foreground))] hover:bg-[hsl(var(--app-nav-hover)/0.72)] hover:text-[hsl(var(--app-nav-foreground))] lg:inline-flex"
              onClick={handleSidebarToggle}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
              <span className="hidden xl:inline">
                {collapsed ? "Expand nav" : "Collapse nav"}
              </span>
            </Button>
            <Brand
              href="/workspace"
              subtitle="Quality Management Workspace"
            />
            <div className="hidden min-w-0 sm:block md:hidden">
              <CurrentSchoolBadge school={currentSchool} compact />
            </div>
          </div>

          <div className="hidden min-w-0 flex-1 items-center justify-end md:flex">
            <div className="flex items-center gap-3">
              <CurrentSchoolBadge school={currentSchool} />
              <Button
                variant="outline"
                size="sm"
                className="app-button-compact"
                onClick={() => void handleSignOut()}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <DesktopSidebarShell
        collapsed={collapsed}
        sidebarWidth={sidebarWidth}
        title="School workspace"
        groups={schoolSidebarGroups}
        activePath={activePath}
        onNavigate={handleNavigate}
        onToggleSidebar={handleSidebarToggle}
        onSidebarResizeStart={() => setIsSidebarResizing(true)}
        onSidebarResize={(nextWidth) =>
          setSidebarWidth(clampSidebarWidth(nextWidth))
        }
        onSidebarResizeEnd={handleSidebarResizeEnd}
        isSidebarResizing={isSidebarResizing}
        toggleSidebarLabel={toggleSidebarLabel}
        school={currentSchool}
        showCollapsedSchoolBadge
      />
    </>
  );
}
