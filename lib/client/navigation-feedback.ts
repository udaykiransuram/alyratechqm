export const APP_NAVIGATION_START_EVENT = "app:navigation-start";

type NavigationStartDetail = {
  href?: string | null;
};

export function announceNavigationStart(href?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<NavigationStartDetail>(APP_NAVIGATION_START_EVENT, {
      detail: { href: href || null },
    }),
  );
}
