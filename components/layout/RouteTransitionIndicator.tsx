"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { APP_NAVIGATION_START_EVENT } from "@/lib/client/navigation-feedback";

const NAVIGATION_RESET_TIMEOUT_MS = 12_000;
const NAVIGATION_INDICATOR_DELAY_MS = 80;

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

    const visibleTimer = window.setTimeout(() => {
      setShowIndicator(true);
    }, NAVIGATION_INDICATOR_DELAY_MS);

    const timeoutId = window.setTimeout(() => {
      setPendingHref(null);
      setShowIndicator(false);
    }, NAVIGATION_RESET_TIMEOUT_MS);

    return () => {
      window.clearTimeout(visibleTimer);
      window.clearTimeout(timeoutId);
    };
  }, [pendingHref]);

  useEffect(() => {
    setPendingHref(null);
    setShowIndicator(false);
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
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[10001] h-0.5 overflow-hidden bg-primary/10">
      <div className="h-full w-40 animate-pulse rounded-full bg-primary shadow-[0_0_20px_hsl(var(--primary)/0.45)]" />
    </div>
  );
}
