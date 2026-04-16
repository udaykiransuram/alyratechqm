"use client";

import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import {
  CurrentSchoolBadge,
  getActiveSidebarChild,
  shouldPrefetchSidebarLinkOnMount,
  type CurrentSchoolInfo,
  type SidebarGroup,
} from "@/components/navigation/SiteHeaderShared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function SiteHeaderMobileSidebarDialog({
  open,
  onOpenChange,
  groups,
  school,
  showSchoolWorkspace,
  activePath,
  onNavigate,
  onSignOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: SidebarGroup[];
  school?: CurrentSchoolInfo;
  showSchoolWorkspace: boolean;
  activePath: string;
  onNavigate: (href: string) => void;
  onSignOut: () => void | Promise<void>;
}) {
  const navigableGroups = useMemo(
    () => groups.filter((group) => group.items.length > 0),
    [groups],
  );
  const [activeGroupTitle, setActiveGroupTitle] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () =>
      activeGroupTitle
        ? navigableGroups.find((group) => group.title === activeGroupTitle) || null
        : null,
    [activeGroupTitle, navigableGroups],
  );
  const activeGroupTitleFromPath = useMemo(
    () =>
      navigableGroups.find((group) =>
        group.items.some((item) => getActiveSidebarChild(activePath, item.children)),
      )?.title || null,
    [activePath, navigableGroups],
  );

  useEffect(() => {
    if (!open) {
      setActiveGroupTitle(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="app-nav-mobile-dialog inset-0 h-[100dvh] w-screen translate-x-0 translate-y-0 rounded-none p-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:w-full sm:max-w-sm sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[calc(var(--app-radius-lg)+1px)]">
        <DialogHeader className="border-b border-[hsl(var(--app-nav-border)/0.85)] px-4 py-3.5">
          <div className="flex items-center gap-2">
            {selectedGroup ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="app-nav-mobile-back"
                onClick={() => setActiveGroupTitle(null)}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Back to sections</span>
              </Button>
            ) : null}
            <div className="min-w-0">
              <DialogTitle className="app-nav-text truncate text-[15px]">
                {selectedGroup?.title || "Navigation"}
              </DialogTitle>
              <p className="app-nav-text-muted text-[11.5px]">
                {selectedGroup
                  ? "Select a destination"
                  : "Choose a section to continue"}
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="app-nav-mobile-scroll">
          {showSchoolWorkspace && school ? (
            <div className="mb-4 rounded-[calc(var(--app-radius-md)+0.125rem)] border border-[hsl(var(--app-nav-border)/0.68)] bg-[hsl(var(--app-nav-chip-surface)/0.56)] px-3.5 py-3">
              <p className="app-nav-group-label mb-2 px-0">Current school</p>
              <CurrentSchoolBadge school={school} compact />
              <p className="mt-2 text-[12px] leading-5 text-[hsl(var(--app-nav-muted))]">
                This workspace stays scoped to the selected school.
              </p>
            </div>
          ) : null}
          <div className="app-nav-mobile-shell">
            {selectedGroup ? (
              <div className="space-y-3">
                {selectedGroup.items.map((item) => {
                  const Icon = item.icon;
                  const directChild =
                    item.children.length === 1 ? item.children[0] : null;
                  const activeChild = getActiveSidebarChild(
                    activePath,
                    item.children,
                  );
                  const isActive = activeChild !== null;

                  if (directChild) {
                    return (
                      <AppPrefetchLink
                        key={item.label}
                        href={directChild.href}
                        prefetchOnMount={shouldPrefetchSidebarLinkOnMount(
                          directChild.href,
                        )}
                        onClick={() => {
                          onNavigate(directChild.href);
                          onOpenChange(false);
                        }}
                        className={cn(
                          "app-sidebar-item app-nav-mobile-task-link flex items-center gap-3 rounded-[var(--app-radius-md)] px-3.5 py-3 text-sm transition-colors",
                          isActive ? "app-sidebar-item-active" : null,
                        )}
                      >
                        <span className="app-sidebar-item-icon">
                          <Icon className="h-4 w-4 shrink-0" />
                        </span>
                        <span className="flex-1">{item.label}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
                      </AppPrefetchLink>
                    );
                  }

                  return (
                    <div key={item.label} className="app-nav-panel app-nav-mobile-task-panel p-2">
                      <div className="app-nav-text flex items-center gap-3 px-2.5 py-2 text-sm font-medium">
                        <span className="app-sidebar-item-icon">
                          <Icon className="h-4 w-4 shrink-0" />
                        </span>
                        <span className="min-w-0 truncate">{item.label}</span>
                      </div>
                      <div className="space-y-0.5">
                        {item.children.map((child) => {
                          const childActive = activeChild?.href === child.href;

                          return (
                            <AppPrefetchLink
                              key={child.href}
                              href={child.href}
                              prefetchOnMount={shouldPrefetchSidebarLinkOnMount(
                                child.href,
                              )}
                              onClick={() => {
                                onNavigate(child.href);
                                onOpenChange(false);
                              }}
                              className={cn(
                                "app-sidebar-subitem block rounded-[var(--app-radius-sm)] px-3.5 py-2.5 text-sm transition-colors",
                                childActive
                                  ? "app-sidebar-subitem-active font-medium"
                                  : null,
                              )}
                            >
                              {child.label}
                            </AppPrefetchLink>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="app-nav-mobile-group-list">
                {navigableGroups.map((group) => {
                  const routeCount = group.items.reduce(
                    (count, item) => count + item.children.length,
                    0,
                  );
                  const isActiveGroup = activeGroupTitleFromPath === group.title;

                  return (
                    <button
                      key={group.title}
                      type="button"
                      className={cn(
                        "app-nav-panel app-nav-mobile-group-button",
                        isActiveGroup && "app-nav-mobile-group-button-active",
                      )}
                      onClick={() => setActiveGroupTitle(group.title)}
                    >
                      <div className="app-nav-mobile-group-copy">
                        <p className="app-nav-mobile-group-title">{group.title}</p>
                        <p className="app-nav-mobile-group-meta">
                          {routeCount} destination{routeCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="app-nav-mobile-group-icon">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="border-t border-[hsl(var(--app-nav-border)/0.68)] pt-3.5">
              <Button
                type="button"
                variant="outline"
                className="app-button-page w-full justify-center border-[hsl(var(--app-nav-border)/0.76)] bg-[hsl(var(--app-nav-chip-surface)/0.68)] text-[hsl(var(--app-nav-foreground))] hover:bg-[hsl(var(--app-nav-hover)/0.72)] hover:text-[hsl(var(--app-nav-foreground))]"
                onClick={() => {
                  onOpenChange(false);
                  void onSignOut();
                }}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
