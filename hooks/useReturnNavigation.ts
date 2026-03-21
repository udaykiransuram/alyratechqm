'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { canonicalizeAppPath } from '@/lib/navigation/canonical-paths';
import { buildHrefWithReturnTo, getSafeReturnToPath } from '@/lib/navigation/returnTo';

function hasSameOriginHistory() {
  if (typeof window === 'undefined') return false;
  if (window.history.length <= 1) return false;

  try {
    if (!document.referrer) return false;
    const referrerUrl = new URL(document.referrer);
    return referrerUrl.origin === window.location.origin;
  } catch {
    return false;
  }
}

function getCurrentSearch() {
  if (typeof window === 'undefined') return '';
  return window.location.search || '';
}

function getCurrentReturnTo() {
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    return getSafeReturnToPath(params.get('returnTo'));
  } catch {
    return null;
  }
}

export function useCurrentPathWithSearch(fallbackPath = '/') {
  const pathname = usePathname();

  if (!pathname) return canonicalizeAppPath(fallbackPath);

  const search = getCurrentSearch();
  return canonicalizeAppPath(`${pathname}${search}`);
}

export function useReturnHrefBuilder(fallbackPath = '/') {
  const currentPath = useCurrentPathWithSearch(fallbackPath);

  const buildReturnHref = useCallback(
    (targetPath: string) => buildHrefWithReturnTo(targetPath, currentPath),
    [currentPath],
  );

  return { currentPath, buildReturnHref };
}

export function useBackNavigation(fallbackPath: string) {
  const router = useRouter();
  usePathname();

  const returnTo = getCurrentReturnTo();
  const canonicalFallbackPath = canonicalizeAppPath(fallbackPath);

  const navigateBack = useCallback(() => {
    if (hasSameOriginHistory()) {
      router.back();
      return;
    }

    if (returnTo) {
      router.replace(returnTo);
      return;
    }

    router.replace(canonicalFallbackPath);
  }, [canonicalFallbackPath, returnTo, router]);

  return { returnTo, navigateBack };
}
