"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  forwardRef,
  type ComponentProps,
  type FocusEventHandler,
  type MouseEventHandler,
  type TouchEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { announceNavigationStart } from "@/lib/client/navigation-feedback";
import { prefetchApiJson, type FetchApiJsonOptions } from "@/lib/client/api";

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
};

function isPrefetchableHref(href: string) {
  return href.startsWith("/") && !href.startsWith("/api/");
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

const AppPrefetchLink = forwardRef<HTMLAnchorElement, AppPrefetchLinkProps>(
  function AppPrefetchLink(
    {
      href,
      relatedHrefs,
      relatedApiPrefetches,
      prefetchOnIntent = true,
      prefetchOnMount = false,
      onMouseEnter,
      onFocus,
      onTouchStart,
      onClick,
      prefetch = false,
      ...props
    },
    ref,
  ) {
    const router = useRouter();
    const prefetchedHrefsRef = useRef<Set<string>>(new Set());

    const prefetchTargets = useMemo(
      () =>
        Array.from(new Set([href, ...(relatedHrefs ?? [])])).filter((target) =>
          isPrefetchableHref(String(target || "").trim()),
        ),
      [href, relatedHrefs],
    );

    const prefetchRoutes = useCallback(() => {
      prefetchTargets.forEach((target) => {
        if (prefetchedHrefsRef.current.has(target) || globallyPrefetchedHrefs.has(target)) {
          return;
        }

        prefetchedHrefsRef.current.add(target);
        globallyPrefetchedHrefs.add(target);
        router.prefetch(target);
      });
      relatedApiPrefetches?.forEach((target) => {
        if (typeof target === "string") {
          void prefetchApiJson(target);
          return;
        }

        void prefetchApiJson(target.url, target.options);
      });
    }, [prefetchTargets, relatedApiPrefetches, router]);

    useEffect(() => {
      if (!prefetchOnMount) {
        return;
      }

      prefetchRoutes();
    }, [prefetchOnMount, prefetchRoutes]);

    const handleMouseEnter: MouseEventHandler<HTMLAnchorElement> = (event) => {
      onMouseEnter?.(event);
      if (!event.defaultPrevented && prefetchOnIntent) {
        prefetchRoutes();
      }
    };

    const handleFocus: FocusEventHandler<HTMLAnchorElement> = (event) => {
      onFocus?.(event);
      if (!event.defaultPrevented && prefetchOnIntent) {
        prefetchRoutes();
      }
    };

    const handleTouchStart: TouchEventHandler<HTMLAnchorElement> = (event) => {
      onTouchStart?.(event);
      if (!event.defaultPrevented && prefetchOnIntent) {
        if (typeof window === "undefined") {
          prefetchRoutes();
          return;
        }

        window.setTimeout(() => {
          prefetchRoutes();
        }, 0);
      }
    };

    const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
      onClick?.(event);
      if (!shouldAnnounceNavigation(event)) {
        return;
      }

      announceNavigationStart(href);
    };

    return (
      <Link
        ref={ref}
        href={href}
        prefetch={prefetch}
        onMouseEnter={handleMouseEnter}
        onFocus={handleFocus}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
        {...props}
      />
    );
  },
);

export default AppPrefetchLink;
