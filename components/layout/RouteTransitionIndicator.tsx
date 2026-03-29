"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  APP_NAVIGATION_START_EVENT,
  NAVIGATION_FEEDBACK_RESET_TIMEOUT_MS,
  resetPendingNavigationFeedback,
} from "@/lib/client/navigation-feedback";

function resolveInternalNavigationTarget(rawHref: string | null | undefined) {
  if (typeof window === "undefined") {
    return null;
  }

  const href = String(rawHref || "").trim();
  if (!href || href.startsWith("#")) {
    return null;
  }

  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) {
      return null;
    }
    if (url.pathname.startsWith("/api/")) {
      return null;
    }

    const currentTarget = `${window.location.pathname}${window.location.search}`;
    const nextTarget = `${url.pathname}${url.search}`;

    return nextTarget === currentTarget ? null : nextTarget;
  } catch {
    return null;
  }
}

function shouldTrackAnchorNavigation(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") {
    return false;
  }
  if (anchor.hasAttribute("download")) {
    return false;
  }
  if (anchor.getAttribute("data-no-navigation-feedback") === "true") {
    return false;
  }

  return Boolean(resolveInternalNavigationTarget(anchor.getAttribute("href")));
}

export default function RouteTransitionIndicator() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [showIndicator, setShowIndicator] = useState(false);

  const routeKey = useMemo(() => {
    const query = searchParams?.toString() || "";
    return `${pathname}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!pendingHref) {
      return;
    }

    setShowIndicator(true);

    const timeoutId = window.setTimeout(() => {
      setPendingHref(null);
      setShowIndicator(false);
      resetPendingNavigationFeedback();
    }, NAVIGATION_FEEDBACK_RESET_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pendingHref]);

  useEffect(() => {
    setPendingHref(null);
    setShowIndicator(false);
    resetPendingNavigationFeedback();
  }, [routeKey]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      if (!shouldTrackAnchorNavigation(anchor)) {
        return;
      }

      const nextTarget = resolveInternalNavigationTarget(anchor.getAttribute("href"));
      if (nextTarget) {
        setPendingHref(nextTarget);
      }
    };

    const handleProgrammaticNavigation = (event: Event) => {
      const detail = (event as CustomEvent<{ href?: string | null }>).detail;
      const nextTarget = resolveInternalNavigationTarget(detail?.href || "");
      setPendingHref(nextTarget || "__pending__");
    };

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener(
      APP_NAVIGATION_START_EVENT,
      handleProgrammaticNavigation as EventListener,
    );

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener(
        APP_NAVIGATION_START_EVENT,
        handleProgrammaticNavigation as EventListener,
      );
    };
  }, []);

  if (!pendingHref || !showIndicator) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[10001]">
      <div className="h-1 overflow-hidden bg-[hsl(var(--primary)/0.14)] shadow-[0_1px_0_hsl(var(--app-shadow-deep)/0.08)]">
        <div className="h-full w-56 max-w-[45vw] animate-pulse rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
      </div>
    </div>
  );
}
