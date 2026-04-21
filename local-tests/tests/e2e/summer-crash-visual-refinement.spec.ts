/// <reference types="@playwright/test" />
import { expect, test } from "./helpers/strict-browser-test";
import { navigateToAppRoute } from "./helpers/navigation";
import { setStudentSession } from "./helpers/session";

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

test.describe("Summer Crash visual refinement contract", () => {
  test("keeps the public utility flow shells and premium CTAs visible on mobile @mobile", async ({
    page,
  }) => {
    await navigateToAppRoute(page, "/summer-crash-course/register");
    await expect(
      page.getByRole("heading", { name: "Create parent account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create account/i }),
    ).toBeVisible();

    await navigateToAppRoute(page, "/summer-crash-course/signin");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue|sign in/i }).first(),
    ).toBeVisible();

    await navigateToAppRoute(page, "/summer-crash-course/help");
    await expect(
      page.getByRole("heading", { name: "Find your child account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /find account/i }),
    ).toBeVisible();
  });

  test("keeps the signed-in summer home summary and lesson actions visible @desktop", async ({
    page,
  }) => {
    await setStudentSession(page, {
      schoolKey: "summer-crash",
      schoolDisplayName: "Summer Crash Course",
      id: "111111111111111111111111",
      studentSessionId: "summer-student-session-1",
      studentClassId: "111111111111111111111111",
      studentAcademicSectionId: "222222222222222222222222",
    });

    await navigateToAppRoute(page, "/student/crash-course");
    await expect(
      page.getByRole("heading", { name: "Your Summer Home" }),
    ).toBeVisible();
    await expect(page.getByText("Class Band")).toBeVisible();
    await expect(page.getByText("Course Access")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /numbers & foundations/i }),
    ).toBeVisible();
  });
});
