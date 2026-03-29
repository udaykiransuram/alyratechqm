"use client";

import { useEffect, useState } from "react";
import {
  BarChart2,
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import DeferredSiteHeaderMobileSidebar from "@/components/navigation/DeferredSiteHeaderMobileSidebar";
import {
  Brand,
  clampSidebarWidth,
  DesktopSidebarShell,
  getSidebarWidthPx,
  parseStoredSidebarWidth,
  resolveExpandedSidebarWidth,
  SIDEBAR_STORAGE_KEY,
  SIDEBAR_WIDTH_STORAGE_KEY,
  shouldCollapseSidebar,
  type SidebarGroup,
} from "@/components/navigation/SiteHeaderShared";
import { Button } from "@/components/ui/button";
import { performNextAuthSignOutAndRedirect } from "@/lib/client/next-auth-client";

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

export default function CompanySiteHeader({
  pathname,
}: {
  pathname: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSidebarWidth, setExpandedSidebarWidth] = useState(() =>
    getSidebarWidthPx(false),
  );
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    getSidebarWidthPx(false),
  );
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
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
    const targetUrl = new URL("/auth/company-signin", window.location.origin);
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
              groups={companySidebarGroups}
              showSchoolWorkspace={false}
              activePath={activePath}
              onNavigate={handleNavigate}
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
            <Brand href="/company/schools" subtitle="Company Admin Portal" />
          </div>

          <div className="hidden min-w-0 flex-1 items-center justify-end md:flex">
            <div className="flex items-center gap-3">
              <div className="app-nav-chip app-nav-text flex h-9 items-center px-3 text-[13px] font-medium">
                Company Admin Portal
              </div>
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
        title="Company operations"
        groups={companySidebarGroups}
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
      />
    </>
  );
}
