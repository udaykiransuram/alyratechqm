"use client";

import { LogOut } from "lucide-react";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="app-nav-mobile-dialog inset-0 h-[100dvh] w-screen translate-x-0 translate-y-0 rounded-none p-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:w-full sm:max-w-sm sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[calc(var(--app-radius-lg)+1px)]">
        <DialogHeader className="border-b border-[hsl(var(--app-nav-border)/0.85)] px-5 py-4">
          <DialogTitle className="app-nav-text">Navigation</DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(100dvh-80px)] overflow-y-auto px-4 py-3.5">
          {showSchoolWorkspace && school ? (
            <div className="mb-4 rounded-[calc(var(--app-radius-md)+0.125rem)] border border-[hsl(var(--app-nav-border)/0.68)] bg-[hsl(var(--app-nav-chip-surface)/0.56)] px-3.5 py-3">
              <p className="app-nav-group-label mb-2 px-0">Current school</p>
              <CurrentSchoolBadge school={school} compact />
              <p className="mt-2 text-[12px] leading-5 text-[hsl(var(--app-nav-muted))]">
                This workspace stays scoped to the selected school.
              </p>
            </div>
          ) : null}
          <div className="flex h-full flex-col gap-4">
            {groups
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <div key={group.title}>
                  <p className="app-nav-group-label mb-1.5 px-3">
                    {group.title}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
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
                              "app-sidebar-item flex items-center gap-3 rounded-[var(--app-radius-md)] px-3.5 py-3 text-sm transition-colors",
                              isActive ? "app-sidebar-item-active" : null,
                            )}
                          >
                            <span className="app-sidebar-item-icon">
                              <Icon className="h-4 w-4 shrink-0" />
                            </span>
                            <span>{item.label}</span>
                          </AppPrefetchLink>
                        );
                      }

                      return (
                        <div key={item.label} className="app-nav-panel p-2">
                          <div className="app-nav-text flex items-center gap-3 px-2.5 py-2 text-sm font-medium">
                            <span className="app-sidebar-item-icon">
                              <Icon className="h-4 w-4 shrink-0" />
                            </span>
                            <span>{item.label}</span>
                          </div>
                          <div className="space-y-0.5">
                            {item.children.map((child) => {
                              const childActive =
                                activeChild?.href === child.href;

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
                </div>
              ))}
            <div className="border-t border-[hsl(var(--app-nav-border)/0.68)] pt-4">
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
