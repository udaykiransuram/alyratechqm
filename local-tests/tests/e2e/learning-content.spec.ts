/// <reference types="@playwright/test" />
import { expect, test, type Page } from "./helpers/strict-browser-test";
import { navigateToAppRoute } from "./helpers/navigation";
import {
  setSchoolAdminSession,
  setStudentSession,
} from "./helpers/session";
import {
  MOCK_COURSE_ID,
  MOCK_DIARY_MATH_ID,
} from "@/lib/test-fixtures/learning-content";

async function expectNoRuntimeFailure(page: Page) {
  await expect(page.locator("body")).not.toContainText(
    /Application error|Internal Server Error|Unhandled Runtime Error/i,
  );
}

test.describe("Learning content automation @desktop", () => {
  test("workspace course and diary routes render mock content and builder controls", async ({
    page,
  }) => {
    await setSchoolAdminSession(page, {
      id: "workspace-learning-admin",
    });

    let response = await navigateToAppRoute(page, "/workspace/courses");
    expect(response, "workspace courses page should respond").not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Courses" })).toBeVisible();
    await expect(page.getByText("Diagnostic Foundations")).toBeVisible();

    response = await navigateToAppRoute(page, `/workspace/courses/${MOCK_COURSE_ID}`);
    expect(response, "workspace course detail should respond").not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Diagnostic Foundations" })).toBeVisible();
    await expect(page.getByText("Baseline readiness check")).toBeVisible();

    response = await navigateToAppRoute(page, "/workspace/courses/create");
    expect(response, "workspace course create page should respond").not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Create Course" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Course Setup" })).toBeVisible();
    await page.getByRole("button", { name: "Lesson" }).click();
    await page.getByRole("button", { name: "Assessment" }).click();
    await expect(page.getByDisplayValue("Lesson 1")).toBeVisible();
    await expect(page.getByText("Linked paper")).toBeVisible();

    response = await navigateToAppRoute(page, "/workspace/diary");
    expect(response, "workspace diary page should respond").not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "E-Diary" })).toBeVisible();
    await expect(page.getByText("Fractions recap and correction work")).toBeVisible();

    response = await navigateToAppRoute(page, `/workspace/diary/${MOCK_DIARY_MATH_ID}`);
    expect(response, "workspace diary detail should respond").not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: "Fractions recap and correction work" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Roster Status" })).toBeVisible();

    response = await navigateToAppRoute(page, "/workspace/diary/create");
    expect(response, "workspace diary create page should respond").not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: "Create Diary Entry" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Diary Setup" })).toBeVisible();
    await page.getByRole("button", { name: "Image" }).click();
    await page.getByRole("button", { name: "YouTube" }).click();
    await page.getByRole("button", { name: "File" }).click();
    await expect(page.getByText("Resource 1")).toBeVisible();
    await expect(page.getByText("Resource 3")).toBeVisible();

    await expectNoRuntimeFailure(page);
  });

  test("student course detail supports note and completion updates", async ({
    page,
  }) => {
    await setStudentSession(page, {
      id: "student-course-e2e-1",
      studentSessionId: "student-course-session-1",
    });

    let response = await navigateToAppRoute(page, "/student/courses");
    expect(response, "student courses page should respond").not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Courses" })).toBeVisible();
    await expect(page.getByText("Diagnostic Foundations")).toBeVisible();

    response = await navigateToAppRoute(page, `/student/courses/${MOCK_COURSE_ID}`);
    expect(response, "student course detail should respond").not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Diagnostic Foundations" })).toBeVisible();

    const noteArea = page.getByPlaceholder("Add your notes for this lesson...");
    await noteArea.fill("Focus on misconception clusters.");
    await page.getByRole("button", { name: "Save Note" }).first().click();
    await expect(page.getByText("Saved").first()).toBeVisible();

    await page.getByRole("button", { name: /Mark complete/i }).first().click();
    await expect(page.getByRole("button", { name: "Completed" }).first()).toBeVisible();

    await expectNoRuntimeFailure(page);
  });

  test("student diary detail supports seen and completed state updates", async ({
    page,
  }) => {
    await setStudentSession(page, {
      id: "student-diary-e2e-1",
      studentSessionId: "student-diary-session-1",
    });

    let response = await navigateToAppRoute(page, "/student/diary");
    expect(response, "student diary page should respond").not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Diary" })).toBeVisible();
    await expect(page.getByText("Fractions recap and correction work")).toBeVisible();

    response = await navigateToAppRoute(page, `/student/diary/${MOCK_DIARY_MATH_ID}`);
    expect(response, "student diary detail should respond").not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: "Fractions recap and correction work" }),
    ).toBeVisible();
    await expect(page.getByText("Seen").first()).toBeVisible();

    await page.getByRole("button", { name: "Mark Completed" }).click();
    await expect(page.getByRole("button", { name: "Completed" })).toBeVisible();

    await expectNoRuntimeFailure(page);
  });
});
