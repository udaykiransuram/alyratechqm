/// <reference types="@playwright/test" />
import { expect, test, type Page, type Route } from "./helpers/strict-browser-test";

import { navigateToAppRoute } from "./helpers/navigation";
import { setStudentSession } from "./helpers/session";

type StudentAttempt = {
  _id: string;
  paper: string;
  student: string;
  status: "in_progress" | "submitted" | "auto_submitted";
  startedAt: string;
  submittedAt: string | null;
  lastSavedAt: string | null;
  totalMarksAwarded: number;
  sectionAnswers: Array<{
    sectionName: string;
    answers: Array<{
      question: string;
      selectedOptions?: number[];
      answerText?: string;
      matrixSelections?: number[][];
    }>;
  }>;
};

type StudentPaper = {
  _id: string;
  title: string;
  instructions: string;
  duration: number;
  passingMarks: number;
  totalMarks: number;
  sections: Array<{
    name: string;
    description?: string;
    marks: number;
    questions: Array<{
      question: {
        _id: string;
        content: string;
        type: string;
        options?: Array<{ content: string }>;
      };
      marks: number;
      negativeMarks: number;
    }>;
  }>;
};

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const studentTestsApiRoute = /\/api\/student\/tests(?:\/.*)?(?:\?.*)?$/;

function isoFromNow(minutesFromNow: number) {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}

function buildPaper(): StudentPaper {
  return {
    _id: "paper-1",
    title: "Science Objective Test",
    instructions: "Choose the correct option.",
    duration: 30,
    passingMarks: 4,
    totalMarks: 6,
    sections: [
      {
        name: "Section A",
        description: "Answer all questions.",
        marks: 6,
        questions: [
          {
            question: {
              _id: "q1",
              content: "<p>2 + 2 = ?</p>",
              type: "single",
              options: [
                { content: "<p>4</p>" },
                { content: "<p>5</p>" },
              ],
            },
            marks: 3,
            negativeMarks: 0,
          },
          {
            question: {
              _id: "q2",
              content: "<p>3 + 3 = ?</p>",
              type: "single",
              options: [
                { content: "<p>6</p>" },
                { content: "<p>7</p>" },
              ],
            },
            marks: 3,
            negativeMarks: 0,
          },
        ],
      },
    ],
  };
}

function buildAttempt(overrides: Partial<StudentAttempt> = {}): StudentAttempt {
  return {
    _id: "attempt-1",
    paper: "paper-1",
    student: "student-1",
    status: "in_progress",
    startedAt: isoFromNow(-5),
    submittedAt: null,
    lastSavedAt: isoFromNow(-5),
    totalMarksAwarded: 0,
    sectionAnswers: [],
    ...overrides,
  };
}

function buildListResponse(paper: StudentPaper, attempt: StudentAttempt) {
  return {
    success: true,
    tests: [
      {
        _id: paper._id,
        title: paper.title,
        duration: paper.duration,
        passingMarks: paper.passingMarks,
        totalMarks: paper.totalMarks,
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
        status: attempt.status === "in_progress" ? "in_progress" : attempt.status,
        remainingTimeMs: attempt.status === "in_progress" ? 25 * 60 * 1000 : 0,
        requiresManualReview: false,
        attempt: {
          submittedAt: attempt.submittedAt,
          status: attempt.status,
          totalMarksAwarded: attempt.totalMarksAwarded,
        },
      },
    ],
  };
}

async function routeRunnerApis(
  page: Page,
  params: {
    paper: StudentPaper;
    getAttempt: () => StudentAttempt;
    onSave?: (route: Route, body: any) => Promise<void>;
    onSubmit?: (route: Route, body: any) => Promise<void>;
  },
) {
  await page.route(studentTestsApiRoute, async (route: Route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const method = route.request().method();
    const attempt = params.getAttempt();

    if (pathname === "/api/student/tests" && method === "GET") {
      await route.fulfill(json(buildListResponse(params.paper, attempt)));
      return;
    }

    if (pathname === `/api/student/tests/${params.paper._id}` && method === "GET") {
      await route.fulfill(
        json({
          success: true,
          paper: params.paper,
          attempt,
          status: attempt.status,
          remainingTimeMs: attempt.status === "in_progress" ? 25 * 60 * 1000 : 0,
          deadlineAt:
            attempt.status === "in_progress"
              ? isoFromNow(25)
              : attempt.submittedAt,
        }),
      );
      return;
    }

    if (
      pathname === `/api/student/tests/${params.paper._id}/attempt` &&
      method === "PATCH" &&
      params.onSave
    ) {
      await params.onSave(route, route.request().postDataJSON());
      return;
    }

    if (
      pathname === `/api/student/tests/${params.paper._id}/submit` &&
      method === "POST" &&
      params.onSubmit
    ) {
      await params.onSubmit(route, route.request().postDataJSON());
      return;
    }

    await route.fallback();
  });
}

test.describe("Student test UI resilience (network mocked) @desktop", () => {
  test("shows clear saving feedback while a slow save is in flight", async ({ page }) => {
    await setStudentSession(page);

    const paper = buildPaper();
    let attempt = buildAttempt();
    const savePayloads: unknown[] = [];

    await routeRunnerApis(page, {
      paper,
      getAttempt: () => attempt,
      onSave: async (route, body) => {
        savePayloads.push(body);
        await delay(1200);
        attempt = {
          ...attempt,
          lastSavedAt: isoFromNow(-1),
          sectionAnswers: Array.isArray(body?.sectionAnswers)
            ? body.sectionAnswers
            : [],
        };
        await route.fulfill(
          json({
            success: true,
            attempt,
            status: attempt.status,
            remainingTimeMs: 24 * 60 * 1000,
            deadlineAt: isoFromNow(24),
          }),
        );
      },
    });

    await navigateToAppRoute(page, "/student/tests/paper-1");

    const optionA = page
      .locator("label.app-exam-option")
      .filter({ has: page.locator('input[aria-label="Option A"]') })
      .first();
    await expect(optionA).toBeVisible({ timeout: 15_000 });
    await optionA.click();
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByLabel(/Save status Saving\.\.\./)).toBeVisible();
    await expect.poll(() => savePayloads.length).toBe(1);
    expect(savePayloads[0]).toMatchObject({
      sectionAnswers: [
        {
          sectionName: "Section A",
          answers: [{ question: "q1", selectedOptions: [0] }],
        },
      ],
    });
    expect(savePayloads[0]).toHaveProperty("baseLastSavedAt");

    await expect(page.getByLabel(/Save status Saving\.\.\./)).toHaveCount(0);
    await expect(page).toHaveURL(/\/student\/tests\/paper-1$/);
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  });

  test("retries a transient submit failure and still returns the student to the tests dashboard", async ({
    page,
  }) => {
    test.slow();
    await setStudentSession(page);

    const paper = buildPaper();
    let attempt = buildAttempt();
    let submitCount = 0;

    await routeRunnerApis(page, {
      paper,
      getAttempt: () => attempt,
      onSubmit: async (route, body) => {
        submitCount += 1;

        if (submitCount === 1) {
          await route.fulfill(
            json(
              {
                success: false,
                message: "We couldn't submit your test.",
                code: "EXAM_RUNTIME_UNAVAILABLE",
                retryable: true,
                httpStatus: 503,
              },
              503,
            ),
          );
          return;
        }

        attempt = {
          ...attempt,
          status: "submitted",
          submittedAt: isoFromNow(-1),
          lastSavedAt: isoFromNow(-1),
          totalMarksAwarded: 6,
          sectionAnswers: Array.isArray(body?.sectionAnswers)
            ? body.sectionAnswers
            : [],
        };
        await route.fulfill(
          json({
            success: true,
            attempt,
            status: attempt.status,
          }),
        );
      },
    });

    await navigateToAppRoute(page, "/student/tests/paper-1");

    const optionA = page
      .locator("label.app-exam-option")
      .filter({ has: page.locator('input[aria-label="Option A"]') })
      .first();
    await expect(optionA).toBeVisible({ timeout: 15_000 });
    await optionA.click();
    await page.getByRole("button", { name: "Submit" }).click();
    await page.getByRole("button", { name: "Confirm Submit" }).click();

    await expect.poll(() => submitCount > 0).toBe(true);
    await expect.poll(() => submitCount, { timeout: 10_000 }).toBe(2);
    await expect(page).toHaveURL(/\/student\/tests\?submitted=1/);
    await expect(page.getByText("Test submitted.")).toBeVisible();
  });

  test("redirects back to sign-in when the student session expires during save", async ({
    page,
  }) => {
    await setStudentSession(page);

    const paper = buildPaper();
    let attempt = buildAttempt();

    await page.route("**/api/auth/csrf", async (route) => {
      await route.fulfill(json({ csrfToken: "test-csrf-token" }));
    });
    await page.route("**/api/auth/signout**", async (route) => {
      const formData = new URLSearchParams(route.request().postData() || "");
      const callbackUrl =
        formData.get("callbackUrl") || "http://127.0.0.1:3001/auth/signin";
      await route.fulfill(
        json({
          url: callbackUrl,
        }),
      );
    });

    await routeRunnerApis(page, {
      paper,
      getAttempt: () => attempt,
      onSave: async (route) => {
        await route.fulfill(
          json(
            {
              success: false,
              message: "This student session is no longer active. Please sign in again.",
              code: "StudentSessionExpired",
              retryable: false,
              httpStatus: 401,
            },
            401,
          ),
        );
      },
    });

    await navigateToAppRoute(page, "/student/tests/paper-1");

    const optionA = page
      .locator("label.app-exam-option")
      .filter({ has: page.locator('input[aria-label="Option A"]') })
      .first();
    await expect(optionA).toBeVisible({ timeout: 15_000 });
    await optionA.click();
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(/\/auth\/signin\?/);
    await expect(page).toHaveURL(/error=StudentSessionExpired/);
    await expect(page).toHaveURL(/signedOut=1/);
    await expect(page).toHaveURL(/callbackUrl=/);
  });
});
