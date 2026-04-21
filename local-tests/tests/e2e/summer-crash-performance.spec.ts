/// <reference types="@playwright/test" />
import { expect, test } from "./helpers/strict-browser-test";

import { navigateToAppRoute } from "./helpers/navigation";

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

test.describe("Summer Crash performance guardrails @desktop", () => {
  test("avoids client-side session fetches on public summer pages", async ({
    page,
  }) => {
    let sessionRequestCount = 0;

    await page.route(/\/api\/auth\/session(?:\?.*)?$/, async (route) => {
      sessionRequestCount += 1;
      await route.fulfill(
        json({
          expires: new Date(Date.now() + 60_000).toISOString(),
        }),
      );
    });

    await navigateToAppRoute(page, "/summer-crash-course");
    await expect(
      page.getByRole("heading", {
        name: /Repair weak maths foundations/i,
      }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");

    await navigateToAppRoute(
      page,
      "/summer-crash-course/register?entry=diagnostic",
    );
    await expect(
      page.getByRole("heading", { name: "Register & start test" }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");

    await navigateToAppRoute(page, "/summer-crash-course/help");
    await expect(
      page.getByRole("heading", { name: "Find your child account" }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");

    await navigateToAppRoute(page, "/summer-crash-course/signin");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(sessionRequestCount).toBe(0);
  });

  test("avoids an automatic client lookup when summer sign-in opens prefilled", async ({
    page,
  }) => {
    let lookupRequestCount = 0;

    await page.route(
      /\/api\/summer-crash\/lookup-id(?:\?.*)?$/,
      async (route) => {
        lookupRequestCount += 1;
        await route.fulfill(
          json({
            success: true,
            matches: [
              {
                studentName: "Ada Lovelace",
                guardianName: "Parent One",
                classBand: "Class 8",
                summerId: "SC123456",
                maskedSummerId: "SC••56",
              },
            ],
          }),
        );
      },
    );

    await navigateToAppRoute(
      page,
      "/summer-crash-course/signin?phone=9876543210&summerId=SC123456&next=%2Fstudent%2Fcrash-course",
    );

    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(lookupRequestCount).toBe(0);
  });
});
