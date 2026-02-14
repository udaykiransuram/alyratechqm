import { test, expect } from "@playwright/test";

test.describe("Navbar layout and navigation", () => {
  test("desktop: brand left, nav centered, utilities right, Register visible", async ({
    page,
  }) => {
    await page.goto("/");

    // Brand visible on the left
    await expect(page.getByText("ALYRA TECH")).toBeVisible();

    // Core nav links centered
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Product" })).toBeVisible();

    // Utilities on the right (Register button visible at md+ widths)
    await expect(page.getByRole("link", { name: "Register" })).toBeVisible();
  });

  test("mobile: hamburger opens full-screen menu and shows Register & sections", async ({
    page,
    browserName,
  }) => {
    // Use the mobile project (Pixel 5) for this test via project config
    await page.goto("/");

    // Open menu
    const openMenuBtn = page.getByRole("button", { name: "Open menu" });
    await expect(openMenuBtn).toBeVisible();
    await openMenuBtn.click();

    // Menu items visible
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Register" })).toBeVisible();
    await expect(page.getByText("Papers")).toBeVisible();
    await expect(page.getByText("Questions")).toBeVisible();

    // Close menu by clicking a navigation item
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
