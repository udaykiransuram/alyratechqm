/// <reference types="@playwright/test" />
import { expect, test } from "./helpers/strict-browser-test";
import { navigateToAppRoute } from "./helpers/navigation";

test.describe("Summer Crash register page", () => {
  test("renders a calmer parent-facing signup shell", async ({ page }) => {
    await navigateToAppRoute(page, "/summer-crash-course/register");

    await expect(
      page.getByRole("heading", { name: "Create parent account" }),
    ).toBeVisible();
    await expect(
      page.getByText("Use one parent sign-in for the full Summer Crash flow."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

    await expect(page.getByLabel("Student name")).toBeVisible();
    const classSelector = page.getByRole("combobox", { name: "Class" });
    await expect(classSelector).toBeVisible();
    await classSelector.click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await expect(page.getByLabel(/School name/i)).toBeVisible();
    await expect(page.getByLabel("Parent name")).toBeVisible();
    await expect(page.getByLabel("Phone number")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(
      page.getByLabel("Confirm password", { exact: true }),
    ).toBeVisible();
  });
});
