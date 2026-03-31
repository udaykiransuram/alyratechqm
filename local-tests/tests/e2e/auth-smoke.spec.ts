/// <reference types="@playwright/test" />
import { expect, test } from "./helpers/strict-browser-test";
import { navigateToAppRoute } from "./helpers/navigation";

test.describe("Auth smoke @desktop", () => {
  test("school and company sign-in pages render and link to each other", async ({
    page,
  }) => {
    await navigateToAppRoute(page, "/auth/company-signin");
    await expect(
      page.getByRole("heading", { name: "Sign in to the company portal" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /use school sign in/i }),
    ).toHaveAttribute("href", "/auth/signin");

    await navigateToAppRoute(page, "/auth/signin");
    await expect(
      page.getByRole("heading", { name: "Sign in to your school" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Use company sign in" }),
    ).toHaveAttribute("href", "/auth/company-signin");
  });

  test("protected routes redirect unauthenticated users to the correct sign-in flow", async ({
    page,
  }) => {
    await navigateToAppRoute(page, "/student/tests");
    await expect(page).toHaveURL(/\/auth\/signin\?/);

    const schoolRedirect = new URL(page.url());
    expect(schoolRedirect.pathname).toBe("/auth/signin");
    expect(schoolRedirect.searchParams.get("callbackUrl") || "").toContain(
      "/student/tests",
    );

    await navigateToAppRoute(page, "/company/schools");
    await expect(page).toHaveURL(/\/auth\/company-signin\?/);

    const companyRedirect = new URL(page.url());
    expect(companyRedirect.pathname).toBe("/auth/company-signin");
    expect(companyRedirect.searchParams.get("callbackUrl") || "").toContain(
      "/company/schools",
    );
  });
});
