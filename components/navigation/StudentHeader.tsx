"use client";

import { Bell, Layers } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { shouldHideStudentChrome } from "@/components/student/student-route-chrome";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchApiJson } from "@/lib/client/api";
import { getStudentPortalSignInPath } from "@/lib/client/student-portal-signin-path";
import { performNextAuthSignOutAndRedirect } from "@/lib/client/next-auth-client";
import { cn } from "@/lib/utils";

type StudentNotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string;
  createdAt: string | null;
  readAt: string | null;
};

type StudentHeaderProps = {
  initialUnreadCount?: number;
};

export default function StudentHeader({
  initialUnreadCount = 0,
}: StudentHeaderProps) {
  const pathname = usePathname();
  const hideStudentChrome = shouldHideStudentChrome(pathname);
  const [notifications, setNotifications] = useState<StudentNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(
    Number.isFinite(initialUnreadCount) ? Math.max(0, Number(initialUnreadCount)) : 0,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [hasLoadedNotifications, setHasLoadedNotifications] = useState(false);
  const isPopoverOpenRef = useRef(false);
  const hasLoadedNotificationsRef = useRef(false);
  const unreadRefreshTimeoutRef = useRef<number | null>(null);
  const unreadCountRequestInFlightRef = useRef(false);
  const notificationsRequestInFlightRef = useRef(false);

  async function handleSignOut() {
    const targetUrl = new URL(
      getStudentPortalSignInPath(),
      window.location.origin,
    );
    targetUrl.searchParams.set("signedOut", "1");
    await performNextAuthSignOutAndRedirect({
      callbackUrl: targetUrl.toString(),
    });
  }

  const unreadLabel = useMemo(() => {
    if (unreadCount <= 0) return "";
    return unreadCount > 9 ? "9+" : String(unreadCount);
  }, [unreadCount]);

  async function loadUnreadCount() {
    if (unreadCountRequestInFlightRef.current) {
      return;
    }

    unreadCountRequestInFlightRef.current = true;
    try {
      const response = await fetchApiJson<{
        success?: boolean;
        unreadCount?: number;
      }>("/api/student/notifications?mode=unread", { method: "GET" });

      if (response?.success) {
        setUnreadCount(Number(response.unreadCount || 0));
      }
    } catch (error) {
      console.error("Failed to load unread notifications count:", error);
    } finally {
      unreadCountRequestInFlightRef.current = false;
    }
  }

  async function loadNotifications() {
    if (notificationsRequestInFlightRef.current) {
      return;
    }

    notificationsRequestInFlightRef.current = true;
    setIsLoading(true);
    try {
      const response = await fetchApiJson<{
        success?: boolean;
        notifications?: StudentNotificationItem[];
        unreadCount?: number;
      }>("/api/student/notifications?limit=20", { method: "GET" });

      if (response?.success) {
        setNotifications(Array.isArray(response.notifications) ? response.notifications : []);
        setUnreadCount(Number(response.unreadCount || 0));
        setHasLoadedNotifications(true);
      }
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      notificationsRequestInFlightRef.current = false;
      setIsLoading(false);
    }
  }

  async function markAllRead() {
    try {
      await fetchApiJson("/api/student/notifications/read-all", { method: "POST" });
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
    }
  }

  async function markRead(id: string) {
    try {
      await fetchApiJson(`/api/student/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) => {
        let wasUnread = false;
        const next = prev.map((item) => {
          if (item.id !== id) return item;
          if (!item.readAt) {
            wasUnread = true;
          }
          return { ...item, readAt: item.readAt || new Date().toISOString() };
        });
        if (wasUnread) {
          setUnreadCount((prevCount) => Math.max(0, prevCount - 1));
        }
        return next;
      });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }

  useEffect(() => {
    isPopoverOpenRef.current = isPopoverOpen;
  }, [isPopoverOpen]);

  useEffect(() => {
    hasLoadedNotificationsRef.current = hasLoadedNotifications;
  }, [hasLoadedNotifications]);

  useEffect(() => {
    if (hideStudentChrome) {
      return;
    }

    const clearScheduledUnreadRefresh = () => {
      if (unreadRefreshTimeoutRef.current !== null) {
        window.clearTimeout(unreadRefreshTimeoutRef.current);
        unreadRefreshTimeoutRef.current = null;
      }
    };

    const scheduleUnreadRefresh = () => {
      clearScheduledUnreadRefresh();
      unreadRefreshTimeoutRef.current = window.setTimeout(() => {
        unreadRefreshTimeoutRef.current = null;
        void loadUnreadCount();
      }, 500);
    };

    const source = new EventSource("/api/student/notifications/stream");

    const handleCreated = () => {
      if (isPopoverOpenRef.current && hasLoadedNotificationsRef.current) {
        void loadNotifications();
        return;
      }

      scheduleUnreadRefresh();
    };

    source.addEventListener("notification.created", handleCreated);
    source.onerror = () => {
      console.warn("Student notification stream disconnected; waiting for reconnect.");
    };

    return () => {
      clearScheduledUnreadRefresh();
      source.removeEventListener("notification.created", handleCreated);
      source.close();
    };
  }, [hideStudentChrome]);

  if (hideStudentChrome) {
    return null;
  }

  return (
    <header className="app-nav-shell fixed inset-x-0 top-0 z-50 h-[var(--app-header-height)] border-b">
      <div className="flex h-full items-center justify-between gap-3 px-3 lg:px-5">
        <AppPrefetchLink
          href="/student"
          className="app-nav-brand app-student-header-brand flex min-w-0 items-center gap-3 px-2 py-1.5"
        >
          <div className="app-nav-logo flex h-10 w-10 items-center justify-center rounded-[var(--app-radius-md)]">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="app-nav-text text-[14px] font-semibold tracking-[0.01em]">
              Alyra Tech
            </p>
          </div>
        </AppPrefetchLink>

        <div className="flex items-center gap-2">
          <Popover
            onOpenChange={(open) => {
              setIsPopoverOpen(open);
              if (open) {
                void loadNotifications();
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="student-notification-trigger app-button-compact-icon shrink-0"
                aria-label="Notifications"
                title="Notifications"
                data-has-unread={unreadCount > 0 ? "true" : "false"}
              >
                <Bell className="h-4 w-4" />
                {unreadLabel ? (
                  <span className="student-notification-badge">{unreadLabel}</span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="student-notification-popover">
              <div className="student-notification-header">
                <div>
                  <p className="student-notification-title">Notifications</p>
                  <p className="student-notification-subtitle">
                    {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="student-notification-mark"
                  disabled={unreadCount === 0}
                  onClick={() => void markAllRead()}
                >
                  Mark all read
                </Button>
              </div>
              <div className="student-notification-list">
                {isLoading ? (
                  <p className="student-notification-empty">Loading notifications…</p>
                ) : !hasLoadedNotifications ? (
                  <p className="student-notification-empty">
                    Open notifications to load latest updates.
                  </p>
                ) : notifications.length === 0 ? (
                  <p className="student-notification-empty">
                    No notifications yet.
                  </p>
                ) : (
                  notifications.map((item) => (
                    <AppPrefetchLink
                      key={item.id}
                      href={item.linkUrl || "/student"}
                      className={cn(
                        "student-notification-item",
                        !item.readAt && "student-notification-item--unread",
                      )}
                      onClick={() => void markRead(item.id)}
                    >
                      <div className="student-notification-item-body">
                        <p className="student-notification-item-title">{item.title}</p>
                        <p className="student-notification-item-message">{item.message}</p>
                      </div>
                      <span className="student-notification-item-time">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })
                          : ""}
                      </span>
                    </AppPrefetchLink>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            className="app-button-compact app-student-header-signout"
            onClick={() => void handleSignOut()}
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
