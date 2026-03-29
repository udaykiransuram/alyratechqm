export const APP_NAVIGATION_START_EVENT = "app:navigation-start";
export const NAVIGATION_FEEDBACK_RESET_TIMEOUT_MS = 12_000;

const APP_NAVIGATION_PENDING_ATTR = "data-app-navigation-pending";
const APP_NAVIGATION_MANAGED_BUSY_ATTR = "data-app-navigation-managed-busy";
const APP_NAVIGATION_ROOT_ATTR = "data-app-navigation-active";

type NavigationStartDetail = {
  href?: string | null;
};

let pendingNavigationElement: HTMLElement | null = null;
let pendingNavigationResetTimer: number | null = null;

function shouldIgnoreNavigationStart(rawHref?: string | null) {
  if (typeof window === "undefined") {
    return false;
  }

  const href = String(rawHref || "").trim();
  if (!href || href.startsWith("#")) {
    return true;
  }

  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) {
      return true;
    }
    if (url.pathname.startsWith("/api/")) {
      return true;
    }

    const currentTarget = `${window.location.pathname}${window.location.search}`;
    const nextTarget = `${url.pathname}${url.search}`;

    return nextTarget === currentTarget;
  } catch {
    return false;
  }
}

function clearPendingNavigationTimer() {
  if (pendingNavigationResetTimer === null || typeof window === "undefined") {
    return;
  }

  window.clearTimeout(pendingNavigationResetTimer);
  pendingNavigationResetTimer = null;
}

function clearPendingNavigationElementState(element: HTMLElement | null) {
  if (!element) {
    return;
  }

  element.removeAttribute(APP_NAVIGATION_PENDING_ATTR);

  if (element.getAttribute(APP_NAVIGATION_MANAGED_BUSY_ATTR) === "true") {
    element.removeAttribute("aria-busy");
    element.removeAttribute(APP_NAVIGATION_MANAGED_BUSY_ATTR);
  }
}

export function resetPendingNavigationFeedback() {
  if (typeof window === "undefined") {
    return;
  }

  clearPendingNavigationTimer();
  clearPendingNavigationElementState(pendingNavigationElement);
  pendingNavigationElement = null;
  document.documentElement.removeAttribute(APP_NAVIGATION_ROOT_ATTR);
}

export function markPendingNavigationElement(element?: HTMLElement | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (pendingNavigationElement && pendingNavigationElement !== element) {
    clearPendingNavigationElementState(pendingNavigationElement);
  }

  pendingNavigationElement = element ?? null;

  if (!pendingNavigationElement) {
    clearPendingNavigationTimer();
    document.documentElement.removeAttribute(APP_NAVIGATION_ROOT_ATTR);
    return;
  }

  pendingNavigationElement.setAttribute(APP_NAVIGATION_PENDING_ATTR, "true");
  if (!pendingNavigationElement.hasAttribute("aria-busy")) {
    pendingNavigationElement.setAttribute("aria-busy", "true");
    pendingNavigationElement.setAttribute(APP_NAVIGATION_MANAGED_BUSY_ATTR, "true");
  }

  document.documentElement.setAttribute(APP_NAVIGATION_ROOT_ATTR, "true");

  clearPendingNavigationTimer();
  pendingNavigationResetTimer = window.setTimeout(() => {
    resetPendingNavigationFeedback();
  }, NAVIGATION_FEEDBACK_RESET_TIMEOUT_MS);
}

export function announceNavigationStart(
  href?: string | null,
  element?: HTMLElement | null,
) {
  if (typeof window === "undefined") {
    return;
  }

  if (href && shouldIgnoreNavigationStart(href)) {
    resetPendingNavigationFeedback();
    return;
  }

  markPendingNavigationElement(element);

  window.dispatchEvent(
    new CustomEvent<NavigationStartDetail>(APP_NAVIGATION_START_EVENT, {
      detail: { href: href || null },
    }),
  );
}
