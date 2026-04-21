/// <reference types="@playwright/test" />
import { expect, test } from "./helpers/strict-browser-test";
import { MOCK_SUMMER_CRASH_LOCKED_STUDENT_ID } from "../../../lib/test-fixtures/summer-crash";
import { navigateToAppRoute } from "./helpers/navigation";
import { setStudentSession } from "./helpers/session";

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

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

  test("submits registration and lands on the Summer Crash student home", async ({
    page,
  }) => {
    await navigateToAppRoute(page, "/summer-crash-course/register");

    await page.getByLabel("Student name").fill("Ada Lovelace");
    await page.getByRole("combobox", { name: "Class" }).click();
    await page.getByRole("option", { name: "Class 7" }).click();
    await page.getByLabel(/School name/i).fill("Local Test School");
    await page.getByLabel("Parent name").fill("Parent One");
    await page.getByLabel("Phone number").fill("9876543210");
    await page
      .getByLabel("Password", { exact: true })
      .fill("SummerCrash#2026");
    await page
      .getByLabel("Confirm password", { exact: true })
      .fill("SummerCrash#2026");
    await page.getByRole("checkbox").check();

    await page.getByRole("button", { name: /^Create account$/i }).click();

    await expect(page).toHaveURL(/\/student\/crash-course(?:\?.*)?$/, {
      timeout: 20_000,
    });
    await expect(
      page.getByRole("heading", { name: "Your Summer Home" }),
    ).toBeVisible();
  });

  test("auto-opens payment on locked Summer home when registration asks for it", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const checkoutWindow = window as typeof window & {
        __summerCrashCheckoutCalls?: Array<{ paymentSessionId?: string }>;
      };

      checkoutWindow.__summerCrashCheckoutCalls = [];
      window.Cashfree = () => ({
        checkout: async (options) => {
          checkoutWindow.__summerCrashCheckoutCalls?.push(options);
          return { ok: true };
        },
      });
    });

    let paymentRequestCount = 0;
    await page.route(/\/api\/cashfree\/summer-crash-pay(?:\?.*)?$/, async (route) => {
      paymentRequestCount += 1;
      await route.fulfill(
        json({
          payment_session_id: "payment_session_test_123",
          orderId: "summer_order_test_123",
        }),
      );
    });

    await setStudentSession(page, {
      schoolKey: "summer-crash-course",
      schoolDisplayName: "Summer Crash Course",
      id: MOCK_SUMMER_CRASH_LOCKED_STUDENT_ID,
      studentSessionId: "summer-student-session-locked",
      studentClassId: "111111111111111111111111",
      studentAcademicSectionId: "222222222222222222222222",
    });

    await navigateToAppRoute(page, "/student/crash-course?promptPayment=1");

    await expect(page.getByRole("heading", { name: "Free Diagnostic" })).toBeVisible();
    await expect
      .poll(() => paymentRequestCount, {
        timeout: 10_000,
      })
      .toBe(1);
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as typeof window & {
                __summerCrashCheckoutCalls?: Array<{ paymentSessionId?: string }>;
              }).__summerCrashCheckoutCalls?.[0]?.paymentSessionId || null,
          ),
        {
          timeout: 10_000,
        },
      )
      .toBe("payment_session_test_123");
    await expect(page).toHaveURL(/\/student\/crash-course$/, {
      timeout: 10_000,
    });
  });
});
