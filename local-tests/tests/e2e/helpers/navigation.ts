import type { Page } from "@playwright/test";

type NavigateToAppRouteOptions = {
  timeout?: number;
};

export async function navigateToAppRoute(
  page: Page,
  href: string,
  options: NavigateToAppRouteOptions = {},
) {
  const { timeout = 30_000 } = options;

  const response = await page.goto(href, {
    waitUntil: "commit",
    timeout,
  });

  await page
    .waitForLoadState("domcontentloaded", {
      timeout: Math.min(timeout, 5_000),
    })
    .catch(() => undefined);

  await page
    .waitForFunction(
      () =>
        document.documentElement.getAttribute("data-app-hydrated") === "true",
      undefined,
      {
        timeout: Math.min(timeout, 5_000),
      },
    )
    .catch(() => undefined);

  return response;
}
