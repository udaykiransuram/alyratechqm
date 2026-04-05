"use client";

import { Bell, Layers } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchApiJson } from "@/lib/client/api";
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

function isTestsRoute(pathname: string) {
  return pathname === "/student/tests" || pathname.startsWith("/student/tests/");
}

function isCoursesRoute(pathname: string) {
  return pathname === "/student/courses" || pathname.startsWith("/student/courses/");
}

function isDiaryRoute(pathname: string) {
  return pathname === "/student/diary" || pathname.startsWith("/student/diary/");
}

function isAccountRoute(pathname: string) {
  return pathname === "/student/account" || pathname.startsWith("/student/account/");
}

export default function StudentHeader() {
  const pathname = usePathname() || "/student/tests";
  const [notifications, setNotifications] = useState<StudentNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignOut() {
    const targetUrl = new URL("/auth/signin", window.location.origin);
    targetUrl.searchParams.set("signedOut", "1");
    await performNextAuthSignOutAndRedirect({
      callbackUrl: targetUrl.toString(),
    });
  }

  const unreadLabel = useMemo(() => {
    if (unreadCount <= 0) return "";
    return unreadCount > 9 ? "9+" : String(unreadCount);
  }, [unreadCount]);

  const headerLinks = [
    { href: "/student", label: "Home", active: pathname === "/student" },
    { href: "/student/tests", label: "Tests", active: isTestsRoute(pathname) },
    { href: "/student/courses", label: "Courses", active: isCoursesRoute(pathname) },
    { href: "/student/diary", label: "Diary", active: isDiaryRoute(pathname) },
    { href: "/student/account", label: "Account", active: isAccountRoute(pathname) },
  ];

  const navLinkClass = (active: boolean) =>
    cn("app-student-header-link", active && "app-student-header-link-active");

  async function loadNotifications() {
    setIsLoading(true);
    try {
      const response = await fetchApiJson<{
        success?: boolean;
        notifications?: StudentNotificationItem[];
        unreadCount?: number;
      }>("/api/student/notifications", { method: "GET" });

      if (response?.success) {
        setNotifications(Array.isArray(response.notifications) ? response.notifications : []);
        setUnreadCount(Number(response.unreadCount || 0));
      }
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
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
    void loadNotifications();

    const source = new EventSource("/api/student/notifications/stream");

    const handleCreated = () => {
      void loadNotifications();
    };
    const handleConnected = () => {
      void loadNotifications();
    };

    source.addEventListener("notification.created", handleCreated);
    source.addEventListener("connected", handleConnected);
    source.onerror = () => {
      console.warn("Student notification stream disconnected; waiting for reconnect.");
    };

    return () => {
      source.removeEventListener("notification.created", handleCreated);
      source.removeEventListener("connected", handleConnected);
      source.close();
    };
  }, []);

  return (
    <header className="app-nav-shell fixed inset-x-0 top-0 z-50 h-[var(--app-header-height)] border-b">
      <div className="flex h-full items-center justify-between gap-3 px-3 lg:px-5">
        <AppPrefetchLink
          href="/student/tests"
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
          <div className="app-student-header-links">
            {headerLinks.map((link) => (
              <AppPrefetchLink
                key={link.href}
                href={link.href}
                className={navLinkClass(link.active)}
                aria-current={link.active ? "page" : undefined}
              >
                {link.label}
              </AppPrefetchLink>
            ))}
          </div>

          <Popover onOpenChange={(open) => {
            if (open) {
              void loadNotifications();
            }
          }}>
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
