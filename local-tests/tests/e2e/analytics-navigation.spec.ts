/// <reference types="@playwright/test" />
import { test, expect } from "@playwright/test";
import { navigateToAppRoute } from "./helpers/navigation";
import { setSchoolAdminSession } from "./helpers/session";

test.describe("Analytics navigation", () => {
  test("analytics hub exposes the key workflows", async ({ page }) => {
    await setSchoolAdminSession(page);
    await navigateToAppRoute(page, "/workspace/analytics");

    await expect(
      page.getByRole("heading", { name: "Analytics Hub" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Open Question Papers/i })).toHaveAttribute(
      "href",
      "/workspace/question-papers",
    );
    await expect(page.getByRole("link", { name: /Open Excel Upload/i })).toHaveAttribute(
      "href",
      "/workspace/analytics/student-tag-report/excel-upload",
    );
    await expect(page.getByRole("link", { name: /Open Report Jobs/i })).toHaveAttribute(
      "href",
      "/workspace/manage/reports",
    );
  });

  test("desktop sidebar analytics section is populated @desktop", async ({ page }) => {
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

    const sidebar = page.locator("aside");
    await sidebar.getByRole("button", { name: "Analytics" }).click();

    await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Student Tag Upload" }),
    ).toBeVisible();
  });
});
