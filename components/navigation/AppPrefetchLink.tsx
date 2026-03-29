"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  forwardRef,
  type ComponentProps,
  type FocusEventHandler,
  type MouseEventHandler,
  type PointerEventHandler,
  type TouchEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { announceNavigationStart } from "@/lib/client/navigation-feedback";
import { prefetchApiJson, type FetchApiJsonOptions } from "@/lib/client/api";
import { isMockedE2ETestMode } from "@/lib/test-mode";

type AppPrefetchLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  relatedHrefs?: string[];
  relatedApiPrefetches?: Array<
    | string
    | {
        url: string;
        options?: FetchApiJsonOptions;
      }
  >;
  prefetchOnIntent?: boolean;
  prefetchOnMount?: boolean;
  prefetchOnViewport?: boolean;
};

function isPrefetchableHref(href: string) {
  return href.startsWith("/") && !href.startsWith("/api/");
}

function isCoreAppHref(href: string) {
  return (
    href === "/workspace" ||
    href.startsWith("/workspace/") ||
    href === "/student" ||
    href.startsWith("/student/") ||
    href === "/auth/signin" ||
    href === "/auth/company-signin" ||
    href === "/company" ||
    href.startsWith("/company/")
  );
}

function shouldAnnounceNavigation(event: Parameters<MouseEventHandler<HTMLAnchorElement>>[0]) {
  if (event.defaultPrevented || event.button !== 0) {
    return false;
  }
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  const anchor = event.currentTarget;
  if (anchor.target && anchor.target !== "_self") {
    return false;
  }
  if (anchor.hasAttribute("download")) {
    return false;
  }

  return true;
}

const globallyPrefetchedHrefs = new Set<string>();
const VIEWPORT_PREFETCH_LINK_LIMIT = 24;
const prefetchDisabled = isMockedE2ETestMode();

function shouldSkipViewportPrefetch() {
  if (typeof window === "undefined") {
    return true;
  }

  if (typeof window.IntersectionObserver !== "function") {
    return true;
  }

  const networkNavigator = navigator as Navigator & {
    connection?: {
      effectiveType?: string;
      saveData?: boolean;
    };
  };
  const connection = networkNavigator.connection;
  const effectiveType = String(connection?.effectiveType || "").toLowerCase();
  if (connection?.saveData) {
    return true;
  }

  return (
    effectiveType === "slow-2g" ||
    effectiveType === "2g" ||
    effectiveType === "3g"
  );
}

const AppPrefetchLink = forwardRef<HTMLAnchorElement, AppPrefetchLinkProps>(
  function AppPrefetchLink(
    {
      href,
      relatedHrefs,
      relatedApiPrefetches,
      prefetchOnIntent = true,
      prefetchOnMount = false,
      prefetchOnViewport,
      onMouseEnter,
      onFocus,
      onPointerDown,
      onTouchStart,
      onClick,
      prefetch = true,
      ...props
    },
    ref,
  ) {
    const router = useRouter();
    const prefetchedHrefsRef = useRef<Set<string>>(new Set());
    const anchorRef = useRef<HTMLAnchorElement | null>(null);

    const shouldPrefetchOnViewport =
      prefetchOnViewport === true ||
      (typeof prefetchOnViewport === "undefined" &&
        prefetch !== false &&
        isCoreAppHref(href));

    const prefetchTargets = useMemo(
      () =>
        Array.from(new Set([href, ...(relatedHrefs ?? [])])).filter((target) =>
          isPrefetchableHref(String(target || "").trim()),
        ),
      [href, relatedHrefs],
    );

    const prefetchRoutes = useCallback(() => {
      if (prefetchDisabled) {
        return;
      }

      prefetchTargets.forEach((target) => {
        if (prefetchedHrefsRef.current.has(target) || globallyPrefetchedHrefs.has(target)) {
          return;
        }

        prefetchedHrefsRef.current.add(target);
        globallyPrefetchedHrefs.add(target);
        router.prefetch(target);
      });
    }, [prefetchTargets, router]);

    const prefetchRelatedApis = useCallback(() => {
      if (prefetchDisabled) {
        return;
      }

      relatedApiPrefetches?.forEach((target) => {
        if (typeof target === "string") {
          void prefetchApiJson(target);
          return;
        }

        void prefetchApiJson(target.url, target.options);
      });
    }, [relatedApiPrefetches]);

    useEffect(() => {
      if (!prefetchOnMount || prefetchDisabled) {
        return;
      }

      prefetchRoutes();
      prefetchRelatedApis();
    }, [prefetchOnMount, prefetchRelatedApis, prefetchRoutes]);

    useEffect(() => {
      if (
        !shouldPrefetchOnViewport ||
        prefetchDisabled ||
        shouldSkipViewportPrefetch()
      ) {
        return;
      }

      const anchor = anchorRef.current;
      if (!anchor) {
        return;
      }

      const alreadyPrefetched = prefetchTargets.every(
        (target) =>
          prefetchedHrefsRef.current.has(target) ||
          globallyPrefetchedHrefs.has(target),
      );
      if (alreadyPrefetched) {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const visibleEntry = entries.find((entry) => entry.isIntersecting);
          if (!visibleEntry) {
            return;
          }

          const overViewportPrefetchBudget =
            globallyPrefetchedHrefs.size >= VIEWPORT_PREFETCH_LINK_LIMIT &&
            !prefetchTargets.some((target) => globallyPrefetchedHrefs.has(target));
          if (overViewportPrefetchBudget) {
            observer.disconnect();
            return;
          }

          observer.disconnect();
          if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(() => {
              prefetchRoutes();
              prefetchRelatedApis();
            }, { timeout: 500 });
            return;
          }

          window.setTimeout(() => {
            prefetchRoutes();
            prefetchRelatedApis();
          }, 90);
        },
        {
          rootMargin: "240px",
          threshold: 0.01,
        },
      );

      observer.observe(anchor);
      return () => {
        observer.disconnect();
      };
    }, [
      prefetchRelatedApis,
      prefetchRoutes,
      prefetchTargets,
      shouldPrefetchOnViewport,
    ]);

    const handleMouseEnter: MouseEventHandler<HTMLAnchorElement> = (event) => {
      onMouseEnter?.(event);
      if (!event.defaultPrevented && prefetchOnIntent && !prefetchDisabled) {
        prefetchRoutes();
        prefetchRelatedApis();
      }
    };

    const handleFocus: FocusEventHandler<HTMLAnchorElement> = (event) => {
      onFocus?.(event);
      if (!event.defaultPrevented && prefetchOnIntent && !prefetchDisabled) {
        prefetchRoutes();
        prefetchRelatedApis();
      }
    };

    const handleTouchStart: TouchEventHandler<HTMLAnchorElement> = (event) => {
      onTouchStart?.(event);
      if (!event.defaultPrevented && prefetchOnIntent && !prefetchDisabled) {
        if (typeof window === "undefined") {
          prefetchRoutes();
          prefetchRelatedApis();
          return;
        }

        window.setTimeout(() => {
          prefetchRoutes();
          prefetchRelatedApis();
        }, 0);
      }
    };

    const handlePointerDown: PointerEventHandler<HTMLAnchorElement> = (event) => {
      onPointerDown?.(event);
      if (!event.defaultPrevented && prefetchOnIntent && !prefetchDisabled) {
        prefetchRoutes();
        prefetchRelatedApis();
      }
    };

    const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
      onClick?.(event);
      if (!shouldAnnounceNavigation(event)) {
        return;
      }

      announceNavigationStart(href, event.currentTarget);
    };

    return (
      <Link
        ref={(node) => {
          anchorRef.current = node;

          if (typeof ref === "function") {
            ref(node);
            return;
          }

          if (ref) {
            (ref as { current: HTMLAnchorElement | null }).current = node;
          }
        }}
        href={href}
        prefetch={
          prefetchDisabled || !isPrefetchableHref(href)
            ? false
            : prefetch
        }
        onMouseEnter={handleMouseEnter}
        onFocus={handleFocus}
        onPointerDown={handlePointerDown}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
        {...props}
      />
    );
  },
);

export default AppPrefetchLink;
