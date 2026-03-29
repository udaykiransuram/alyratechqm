"use client";

import { type ComponentType, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  getSchoolDisplayNameFromCookie,
  getSchoolKeyFromCookie,
  setSchoolSelectionCookies,
} from "@/lib/client/school";
import { isMockedE2ETestMode } from "@/lib/test-mode";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Layers } from "lucide-react";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";

export type SidebarChild = {
  href: string;
  label: string;
};

export type SidebarItem = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  children: SidebarChild[];
};

export type SidebarGroup = {
  title: string;
  items: SidebarItem[];
};

export type CurrentSchoolInfo = {
  key: string;
  label: string;
  initials: string;
};

export const SIDEBAR_EXPANDED_WIDTH = "var(--app-sidebar-expanded-width)";
export const SIDEBAR_COLLAPSED_WIDTH = "var(--app-sidebar-collapsed-width)";
export const SIDEBAR_STORAGE_KEY = "app-sidebar-collapsed";
export const SIDEBAR_WIDTH_STORAGE_KEY = "app-sidebar-width";
export const SIDEBAR_EXPANDED_WIDTH_PX = 280;
export const SIDEBAR_COLLAPSED_WIDTH_PX = 88;
export const SIDEBAR_MAX_WIDTH_PX = 360;
export const SIDEBAR_COLLAPSE_THRESHOLD_PX = 160;
export const SIDEBAR_SNAP_WIDTH_PX = SIDEBAR_COLLAPSE_THRESHOLD_PX;

const sidebarPrefetchDisabled = isMockedE2ETestMode();

export function clampSidebarWidth(width: number) {
  return Math.min(
    SIDEBAR_MAX_WIDTH_PX,
    Math.max(SIDEBAR_COLLAPSED_WIDTH_PX, Math.round(width)),
  );
}

export function resolveExpandedSidebarWidth(width: number) {
  return Math.max(SIDEBAR_COLLAPSE_THRESHOLD_PX, clampSidebarWidth(width));
}

export function parseStoredSidebarWidth(value: string | null | undefined) {
  const numericWidth = Number(value);

  if (!Number.isFinite(numericWidth)) {
    return SIDEBAR_EXPANDED_WIDTH_PX;
  }

  return resolveExpandedSidebarWidth(numericWidth);
}

export function shouldCollapseSidebar(width: number) {
  return clampSidebarWidth(width) < SIDEBAR_COLLAPSE_THRESHOLD_PX;
}

export function getSidebarWidthPx(
  collapsed: boolean,
  expandedWidth = SIDEBAR_EXPANDED_WIDTH_PX,
) {
  return collapsed
    ? SIDEBAR_COLLAPSED_WIDTH_PX
    : resolveExpandedSidebarWidth(expandedWidth);
}

export function isCompanyRoute(pathname: string) {
  return pathname === "/company" || pathname.startsWith("/company/");
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

  if (normalizedHref === "/workspace") {
    return normalizedPath === "/workspace";
  }

  return (
    normalizedPath === normalizedHref ||
    normalizedPath.startsWith(`${normalizedHref}/`)
  );
}

export function getActiveSidebarChild(
  pathname: string,
  children: SidebarChild[],
) {
  let activeChild: SidebarChild | null = null;

  for (const child of children) {
    if (!matchesSidebarChild(pathname, child.href)) {
      continue;
    }

    if (
      !activeChild ||
      normalizeSidebarPath(child.href).length >
        normalizeSidebarPath(activeChild.href).length
    ) {
      activeChild = child;
    }
  }

  return activeChild;
}

export function shouldPrefetchSidebarLinkOnMount(href: string) {
  const normalizedHref = normalizeSidebarPath(href);
  return (
    normalizedHref.startsWith("/workspace/") &&
    normalizedHref.endsWith("/create")
  );
}

export function Brand({
  href,
  subtitle,
}: {
  href: string;
  subtitle: string;
}) {
  return (
    <AppPrefetchLink
      href={href}
      className="app-nav-brand flex min-w-0 items-center gap-3 px-2 py-1.5"
    >
      <div className="app-nav-logo flex h-10 w-10 items-center justify-center rounded-[var(--app-radius-md)]">
        <Layers className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="app-nav-text text-[14px] font-semibold tracking-[0.01em]">
          Alyra Tech
        </p>
        <p className="app-nav-text-muted text-[11px]">{subtitle}</p>
      </div>
    </AppPrefetchLink>
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

  return (
    source
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || "SC"
  );
}

export function useCurrentSchoolInfo(enabled: boolean): CurrentSchoolInfo {
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

    if (sidebarPrefetchDisabled) {
      setSchool({
        key: schoolKey,
        label: schoolDisplayName || schoolKey,
        resolved: true,
      });

      return () => {
        active = false;
      };
    }

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
        const response = await fetch("/api/public/schools", {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          schools?: Array<{ key?: string; displayName?: string }>;
        };
        const matchedSchool = Array.isArray(data?.schools)
          ? data.schools.find(
              (schoolEntry) =>
                String(schoolEntry?.key || "").trim() === schoolKey,
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

export function CollapsedSchoolBadge({
  school,
}: {
  school: CurrentSchoolInfo;
}) {
  if (!school.key) return null;

  return (
    <div
      title={school.label ? `${school.label} (${school.key})` : school.key}
      aria-label={`Current school: ${school.label || school.key}`}
      className="app-nav-chip mt-2.5 flex items-center justify-center p-1.5"
    >
      <div className="app-nav-logo flex h-9 w-9 items-center justify-center rounded-[var(--app-radius-md)] text-xs font-semibold tracking-[0.1em]">
        {school.initials}
      </div>
    </div>
  );
}

export function CurrentSchoolBadge({
  school,
  compact = false,
}: {
  school: CurrentSchoolInfo;
  compact?: boolean;
}) {
  const label = school.label || "No school selected";
  const title =
    school.key && school.label ? `${school.label} (${school.key})` : label;

  return (
    <div
      title={title}
      aria-label={title}
      className={cn(
        "app-nav-chip flex h-10 max-w-[min(32rem,44vw)] items-center gap-2.5 px-3.5",
        compact ? "max-w-full" : null,
      )}
    >
      <div className="app-nav-logo flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-semibold tracking-[0.1em]">
        {school.initials}
      </div>
      <p className="app-nav-text min-w-0 truncate text-[13px] font-medium leading-none">
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
    if (!sidebarPrefetchDisabled && !hasPrefetchedChildrenRef.current) {
      hasPrefetchedChildrenRef.current = true;
      item.children.forEach((child) => {
        router.prefetch(child.href);
      });
    }
    setOpen(true);
  };

  const toggleMenu = () => {
    clearCloseTimeout();
    setOpen((currentOpen) => !currentOpen);
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
    "app-sidebar-item flex w-full items-center rounded-[var(--app-radius-md)] text-sm transition-colors",
    collapsed ? "justify-center px-0 py-2" : "justify-between gap-3 px-3 py-2",
    isActive ? "app-sidebar-item-active" : null,
  );

  const content = (
    <>
      <span
        className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "gap-3",
        )}
      >
        <span className="app-sidebar-item-icon">
          <Icon className="h-4 w-4 shrink-0" />
        </span>
        {!collapsed && <span className="truncate">{item.label}</span>}
      </span>
      {!collapsed && !directChild ? (
        <span className="text-xs opacity-70">›</span>
      ) : null}
    </>
  );

  if (directChild) {
    return (
      <AppPrefetchLink
        href={directChild.href}
        prefetchOnMount={shouldPrefetchSidebarLinkOnMount(directChild.href)}
        title={item.label}
        aria-label={item.label}
        className={triggerClassName}
        onClick={() => onNavigate(directChild.href)}
      >
        {content}
      </AppPrefetchLink>
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
      <PopoverAnchor asChild>
        <button
          type="button"
          title={item.label}
          aria-label={item.label}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={triggerClassName}
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
          onFocus={openMenu}
          onClick={toggleMenu}
        >
          {content}
        </button>
      </PopoverAnchor>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={collapsed ? 10 : 8}
        className="app-nav-popover w-[16.25rem] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
        <div className="app-nav-popover-header">
          <p className="app-nav-popover-eyebrow">Quick access</p>
          <p className="app-nav-popover-title">{item.label}</p>
        </div>
        <div className="app-nav-popover-list">
          {item.children.map((child) => {
            const childActive = activeChild?.href === child.href;

            return (
              <AppPrefetchLink
                key={child.href}
                href={child.href}
                prefetchOnMount={shouldPrefetchSidebarLinkOnMount(child.href)}
                onClick={() => {
                  onNavigate(child.href);
                  setOpen(false);
                }}
                className={cn(
                  "app-sidebar-subitem group flex items-center gap-3 rounded-[var(--app-radius-md)] px-3.5 py-3 text-sm transition-all",
                  childActive ? "app-sidebar-subitem-active" : null,
                )}
              >
                <span className="app-sidebar-subitem-marker" aria-hidden="true" />
                <span className="app-sidebar-subitem-label min-w-0 flex-1 truncate">
                  {child.label}
                </span>
                <ChevronRight
                  className="app-sidebar-subitem-trailing h-4 w-4"
                  aria-hidden="true"
                />
              </AppPrefetchLink>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SidebarNavGroups({
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
              <p className="app-nav-group-label mb-1.5 px-3">
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

export function DesktopSidebarShell({
  collapsed,
  sidebarWidth,
  title,
  groups,
  activePath,
  onNavigate,
  onToggleSidebar,
  onSidebarResizeStart,
  onSidebarResize,
  onSidebarResizeEnd,
  isSidebarResizing = false,
  toggleSidebarLabel,
  school,
  showCollapsedSchoolBadge = false,
}: {
  collapsed: boolean;
  sidebarWidth: number;
  title: string;
  groups: SidebarGroup[];
  activePath: string;
  onNavigate: (href: string) => void;
  onToggleSidebar: () => void;
  onSidebarResizeStart: () => void;
  onSidebarResize: (width: number) => void;
  onSidebarResizeEnd: (width: number) => void;
  isSidebarResizing?: boolean;
  toggleSidebarLabel: string;
  school?: CurrentSchoolInfo;
  showCollapsedSchoolBadge?: boolean;
}) {
  const dragStateRef = useRef<{
    startX: number;
    startWidth: number;
    currentWidth: number;
  } | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const beginSidebarResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.preventDefault();

    dragStateRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
      currentWidth: sidebarWidth,
    };

    onSidebarResizeStart();

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      const delta = moveEvent.clientX - dragState.startX;
      const nextWidth = clampSidebarWidth(dragState.startWidth + delta);
      dragState.currentWidth = nextWidth;
      onSidebarResize(nextWidth);
    };

    const finishResize = () => {
      const dragState = dragStateRef.current;
      dragStateRef.current = null;
      dragCleanupRef.current = null;

      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);

      document.body.style.userSelect = "";
      document.body.style.cursor = "";

      onSidebarResizeEnd(dragState?.currentWidth ?? sidebarWidth);
    };

    dragCleanupRef.current = () => {
      dragStateRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);
  };

  return (
    <aside
      data-resizing={isSidebarResizing ? "true" : "false"}
      className="app-sidebar-shell fixed bottom-0 left-0 top-[var(--app-header-height)] hidden w-[var(--app-sidebar-width)] border-r transition-[width] duration-200 ease-in-out lg:block"
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
                <p className="app-nav-text text-sm font-medium">{title}</p>
              </div>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={toggleSidebarLabel}
              aria-label={toggleSidebarLabel}
              className="h-9 w-9 rounded-xl text-[hsl(var(--app-nav-foreground))] hover:bg-[hsl(var(--app-nav-hover)/0.72)] hover:text-[hsl(var(--app-nav-foreground))]"
              onClick={onToggleSidebar}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
              <span className="sr-only">{toggleSidebarLabel}</span>
            </Button>
          </div>
          {collapsed && showCollapsedSchoolBadge && school ? (
            <CollapsedSchoolBadge school={school} />
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
            groups={groups}
            activePath={activePath}
            onNavigate={onNavigate}
          />
        </div>
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        className="app-sidebar-resize-handle"
        onDoubleClick={onToggleSidebar}
        onPointerDown={beginSidebarResize}
      />
    </aside>
  );
}
