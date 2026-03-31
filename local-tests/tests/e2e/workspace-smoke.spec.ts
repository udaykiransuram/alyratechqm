/// <reference types="@playwright/test" />
import { expect, test, type Page } from "./helpers/strict-browser-test";
import { navigateToAppRoute } from "./helpers/navigation";
import { setSchoolAdminSession } from "./helpers/session";

async function expectNoRuntimeFailure(page: Page) {
  await expect(page.locator("body")).not.toContainText(
    /Application error|Internal Server Error|Unhandled Runtime Error/i,
  );
}

test.describe("Workspace smoke @desktop", () => {
  test("workspace overview loads for signed-in admins", async ({ page }) => {
    await setSchoolAdminSession(page);
    const response = await navigateToAppRoute(page, "/workspace");

    expect(response, "workspace landing should respond").not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);

    await expect(
      page.getByRole("heading", { name: /Workspace Overview/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create question paper" }),
    ).toBeVisible();
    await expectNoRuntimeFailure(page);
  });

  test("question paper builder shell renders for signed-in admins", async ({
    page,
  }) => {
    await setSchoolAdminSession(page);
    const response = await navigateToAppRoute(
      page,
      "/workspace/question-papers/create",
    );

    expect(response, "question paper builder should respond").not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);

    await expect(
      page.getByRole("heading", { name: "Create Question Paper" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expectNoRuntimeFailure(page);
  });

  test("bulk question upload page renders without errors", async ({ page }) => {
    await setSchoolAdminSession(page);
    const response = await navigateToAppRoute(page, "/workspace/questions/bulk-upload");

    expect(response, "question upload page should respond").not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);

    await expect(
      page.getByRole("heading", { name: "Bulk Question Upload" }),
    ).toBeVisible();
    await expect(page.getByLabel("Upload JSON File")).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload", exact: true })).toBeVisible();
    await expectNoRuntimeFailure(page);
  });
});
