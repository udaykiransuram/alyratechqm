/// <reference types="@playwright/test" />
import {
  expect,
  test,
  type Page,
  type Route,
} from "./helpers/strict-browser-test";
import { navigateToAppRoute } from "./helpers/navigation";
import { setSchoolAdminSession, setStudentSession } from "./helpers/session";

type SchoolClass = {
  _id: string;
  name: string;
};

type StudentListTest = {
  _id: string;
  title: string;
  duration: number;
  passingMarks: number;
  totalMarks: number;
  examDate?: string | null;
  onlineStartsAt?: string | null;
  onlineEndsAt?: string | null;
  class?: { _id: string; name: string } | null;
  subject?: { _id: string; name: string } | null;
  status: string;
  remainingTimeMs?: number | null;
  requiresManualReview?: boolean;
  attempt?: {
    submittedAt?: string | null;
    status?: string;
    totalMarksAwarded?: number;
  } | null;
};

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

function isoFromNow(minutesFromNow: number) {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}

function buildListTest(overrides: Partial<StudentListTest>): StudentListTest {
  return {
    _id: "paper-default",
    title: "Science Objective Test",
    duration: 30,
    passingMarks: 4,
    totalMarks: 6,
    examDate: isoFromNow(-5),
    onlineStartsAt: isoFromNow(-5),
    onlineEndsAt: isoFromNow(55),
    class: {
      _id: "class-x",
      name: "Class X",
    },
    subject: {
      _id: "subject-sci",
      name: "Science",
    },
    status: "available",
    remainingTimeMs: null,
    requiresManualReview: false,
    attempt: null,
    ...overrides,
  };
}

async function expectNoRuntimeFailure(page: Page) {
  await expect(page.locator("body")).not.toContainText(
    /Application error|Internal Server Error|Unhandled Runtime Error/i,
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

test.describe("Mobile readiness checks @mobile", () => {
  test("workspace manage classes keeps the primary actions visible on phones", async ({
    page,
  }) => {
    await setSchoolAdminSession(page);

    const classes: SchoolClass[] = [
      { _id: "class-1", name: "Grade 10" },
      { _id: "class-2", name: "Grade 11" },
    ];

    await page.route("**/api/classes**", async (route: Route) => {
      const request = route.request();
      const method = request.method();
      const url = new URL(request.url());

      if (!url.pathname.startsWith("/api/classes")) {
        await route.fallback();
        return;
      }

      if (method === "GET" && url.pathname === "/api/classes") {
        await route.fulfill(json({ success: true, classes }));
        return;
      }

      await route.fulfill(json({ success: true }));
    });

    const response = await navigateToAppRoute(page, "/workspace/manage/classes");
    expect(response, "manage classes page should respond").not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);

    await expect(
      page.getByRole("heading", { name: "Existing Classes" }),
    ).toBeVisible();
    await expect(page.getByText("Grade 10", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Archive" }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoRuntimeFailure(page);
  });

  test("student tests dashboard renders the compact mobile card list without overflow", async ({
    page,
  }) => {
    await setStudentSession(page);

    const tests: StudentListTest[] = [
      buildListTest({
        _id: "paper-available",
        title: "Chemistry Practice",
        status: "available",
      }),
      buildListTest({
        _id: "paper-progress",
        title: "Physics Quiz",
        status: "in_progress",
        remainingTimeMs: 14 * 60 * 1000,
      }),
      buildListTest({
        _id: "paper-submitted",
        title: "Biology Revision",
        status: "submitted",
        attempt: {
          submittedAt: isoFromNow(-1),
          status: "submitted",
          totalMarksAwarded: 5,
        },
      }),
    ];

    await page.route("**/api/student/tests**", async (route: Route) => {
      const url = new URL(route.request().url());
      if (url.pathname !== "/api/student/tests") {
        await route.fallback();
        return;
      }

      await route.fulfill(
        json({
          success: true,
          tests,
        }),
      );
    });

    const response = await navigateToAppRoute(page, "/student/tests");
    expect(response, "student tests page should respond").not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);

    await expect(page.getByRole("heading", { name: "Tests" })).toBeVisible();
    await expect(page.locator(".app-student-report-card-list").first()).toBeVisible();
    await expect(page.getByText("Chemistry Practice", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue" }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoRuntimeFailure(page);
  });

  test("public talent test page keeps the hero CTA visible on a phone viewport", async ({
    page,
  }) => {
    const response = await navigateToAppRoute(page, "/talent-test");
    expect(response, "talent test page should respond").not.toBeNull();
    expect(response?.status() ?? 0).toBeLessThan(400);

    await expect(
      page.getByRole("heading", { level: 1, name: /Ignite Brilliance/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Enroll Now/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Learn More" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoRuntimeFailure(page);
  });
});
