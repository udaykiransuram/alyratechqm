/// <reference types="@playwright/test" />
import { expect, test } from "./helpers/strict-browser-test";
import { navigateToAppRoute } from "./helpers/navigation";

const publicRouteChecks = [
  { href: "/", label: "home" },
  { href: "/about", label: "about" },
  { href: "/product", label: "product" },
];

test.describe("Release health smoke @desktop", () => {
  for (const route of publicRouteChecks) {
    test(`${route.label} route renders without runtime failure`, async ({
      page,
    }) => {
      const response = await navigateToAppRoute(page, route.href);
      expect(response, `No response received for ${route.href}.`).not.toBeNull();
      expect(
        response?.status() ?? 0,
        `Unexpected HTTP status for ${route.href}.`,
      ).toBeLessThan(400);

      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.locator("body")).not.toContainText(
        /Application error|Internal Server Error|Unhandled Runtime Error/i,
      );
    });
  }

  test("health endpoint confirms the app is ready", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();

    const payload = await response.json();
    expect(typeof payload.ok).toBe("boolean");
    expect(["up", "down"]).toContain(payload.db);
    expect(typeof payload.totalMs).toBe("number");
    if (payload.db === "down") {
      expect(typeof payload.error).toBe("string");
    }
  });
});
