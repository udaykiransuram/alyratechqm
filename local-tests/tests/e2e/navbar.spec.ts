/// <reference types="@playwright/test" />
import { test, expect } from "./helpers/strict-browser-test";
import { navigateToAppRoute } from "./helpers/navigation";
import { setSchoolAdminSession } from "./helpers/session";

test.describe("Navbar layout and navigation", () => {
  test("desktop: brand left, nav centered, utilities right, workspace links visible @desktop", async ({
    page,
  }) => {
    await setSchoolAdminSession(page);
    await page.route("**/api/reports/jobs**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          jobs: [],
          filters: { academicSections: [] },
        }),
      });
    });
    await navigateToAppRoute(page, "/workspace/manage/reports");

    const header = page.getByRole("banner");
    // Brand visible on the left (scope to header to avoid multiple matches on page/footer)
    await expect(
      header.getByRole("link", { name: "ALYRA TECH" }),
    ).toBeVisible();

    // Authenticated workspace header shows quick actions.
    await expect(header.getByRole("button", { name: "Sign out" })).toBeVisible();

    // Utilities on the right are workspace-oriented links and controls.
  });

  test("mobile: hamburger opens full-screen menu and shows workspace sections @mobile", async ({
    page,
  }) => {
    await setSchoolAdminSession(page);
    await page.route("**/api/reports/jobs**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          jobs: [],
          filters: { academicSections: [] },
        }),
      });
    });
    await navigateToAppRoute(page, "/workspace/manage/reports");

    // Open menu
    const openMenuBtn = page.getByRole("button", { name: /open menu/i });
    await expect(openMenuBtn).toBeVisible();
    await openMenuBtn.click();

    // Menu items visible
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Navigation" })).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: "All Question Papers" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: "All Questions" }),
    ).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Home" })).toBeVisible();

    // Close menu by navigating.
    await dialog.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/workspace$/);
  });
});
