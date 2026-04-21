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

function buildListResponse(paper: StudentPaper, attempt: StudentAttempt | null) {
  const attemptStatus = attempt?.status || "available";

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
        status: attemptStatus === "in_progress" ? "in_progress" : attemptStatus,
        remainingTimeMs: attemptStatus === "in_progress" ? 25 * 60 * 1000 : null,
        requiresManualReview: false,
        attempt: attempt
          ? {
              submittedAt: attempt.submittedAt,
              status: attempt.status,
              totalMarksAwarded: attempt.totalMarksAwarded,
            }
          : null,
      },
    ],
  };
}

async function routeRunnerApis(
  page: Page,
  params: {
    paper: StudentPaper;
    getAttempt: () => StudentAttempt | null;
    onStart?: (route: Route) => Promise<void>;
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
          status: attempt?.status || "available",
          remainingTimeMs:
            attempt?.status === "in_progress" ? 25 * 60 * 1000 : null,
          deadlineAt:
            attempt?.status === "in_progress"
              ? isoFromNow(25)
              : attempt?.submittedAt || null,
        }),
      );
      return;
    }

    if (
      pathname === `/api/student/tests/${params.paper._id}/attempt` &&
      method === "POST" &&
      params.onStart
    ) {
      await params.onStart(route);
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

async function installFullscreenMock(
  page: Page,
  options: { autoGrant?: boolean } = {},
) {
  const { autoGrant = true } = options;

  await page.addInitScript((config: { autoGrant: boolean }) => {
    let fullscreenElement: Element | null = null;
    let requestsAllowed = config.autoGrant;

    const dispatchFullscreenChange = () => {
      document.dispatchEvent(new Event("fullscreenchange"));
    };

    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      get: () => true,
    });

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });

    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: async function requestFullscreenMock() {
        if (!requestsAllowed) {
          return;
        }
        fullscreenElement = this;
        dispatchFullscreenChange();
      },
    });

    Object.defineProperty(Document.prototype, "exitFullscreen", {
      configurable: true,
      value: async function exitFullscreenMock() {
        fullscreenElement = null;
        dispatchFullscreenChange();
      },
    });

    (window as Window & {
      __examFullscreenMock?: {
        exit: () => void;
        lock: () => void;
        unlock: () => void;
        active: () => boolean;
        allow: () => void;
      };
    }).__examFullscreenMock = {
      exit() {
        fullscreenElement = null;
        dispatchFullscreenChange();
      },
      lock() {
        window.dispatchEvent(new Event("blur"));
      },
      unlock() {
        window.dispatchEvent(new Event("focus"));
      },
      active() {
        return Boolean(fullscreenElement);
      },
      allow() {
        requestsAllowed = true;
      },
    };
  }, { autoGrant });
}

test.describe("Student test UI resilience (network mocked) @desktop", () => {
  test("starts the test directly in fullscreen without showing the resume gate", async ({
    page,
  }) => {
    await installFullscreenMock(page);
    await setStudentSession(page);

    const paper = buildPaper();
    let attempt: StudentAttempt | null = null;

    await routeRunnerApis(page, {
      paper,
      getAttempt: () => attempt,
      onStart: async (route) => {
        attempt = buildAttempt();
        await route.fulfill(
          json({
            success: true,
            attempt,
            status: attempt.status,
            remainingTimeMs: 25 * 60 * 1000,
            deadlineAt: isoFromNow(25),
          }),
        );
      },
    });

    await navigateToAppRoute(page, "/student/tests/paper-1");

    await expect(
      page.getByRole("button", { name: "Start Test" }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Start Test" }).click();

    await expect
      .poll(() =>
        page.evaluate(() => {
          return (
            (
              window as Window & {
                __examFullscreenMock?: { active: () => boolean };
              }
            ).__examFullscreenMock?.active() ?? false
          );
        }),
      )
      .toBe(true);
    await expect(
      page.getByRole("heading", { name: "Fullscreen required" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("keeps a resumed attempt locked until fullscreen is restored", async ({ page }) => {
    await installFullscreenMock(page, { autoGrant: false });
    await setStudentSession(page);

    const paper = buildPaper();
    const attempt = buildAttempt();

    await routeRunnerApis(page, {
      paper,
      getAttempt: () => attempt,
    });

    await navigateToAppRoute(page, "/student/tests/paper-1");

    await expect(
      page.getByLabel("Student portal navigation"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Fullscreen required" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);

    await page.evaluate(() => {
      (window as Window & {
        __examFullscreenMock?: { allow: () => void };
      }).__examFullscreenMock?.allow();
    });

    await page.getByRole("button", { name: "Resume in fullscreen" }).click();

    await expect(
      page.getByRole("heading", { name: "Fullscreen required" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  });

  test("resumes the test after re-entering fullscreen", async ({ page }) => {
    await installFullscreenMock(page);
    await setStudentSession(page);

    const paper = buildPaper();
    const attempt = buildAttempt();

    await routeRunnerApis(page, {
      paper,
      getAttempt: () => attempt,
    });

    await navigateToAppRoute(page, "/student/tests/paper-1");

    await expect(page.getByRole("button", { name: "Save" })).toBeVisible({
      timeout: 15_000,
    });

    await page.evaluate(() => {
      (window as Window & {
        __examFullscreenMock?: { exit: () => void };
      }).__examFullscreenMock?.exit();
    });

    await expect(
      page.getByRole("heading", { name: "Fullscreen required" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);

    await page.getByRole("button", { name: "Resume in fullscreen" }).click();

    await expect(
      page.getByRole("heading", { name: "Fullscreen required" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          return (
            (
              window as Window & {
                __examFullscreenMock?: { active: () => boolean };
              }
            ).__examFullscreenMock?.active() ?? false
          );
        }),
      )
      .toBe(true);
  });

  test("unlocks the test again when focus returns in fullscreen", async ({ page }) => {
    await installFullscreenMock(page);
    await setStudentSession(page);

    const paper = buildPaper();
    const attempt = buildAttempt();

    await routeRunnerApis(page, {
      paper,
      getAttempt: () => attempt,
    });

    await navigateToAppRoute(page, "/student/tests/paper-1");

    await expect(page.getByRole("button", { name: "Save" })).toBeVisible({
      timeout: 15_000,
    });

    await page.evaluate(async () => {
      const examShell = document.querySelector(".app-exam-focus-shell");
      if (!(examShell instanceof HTMLElement)) {
        throw new Error("Exam shell not found");
      }

      await examShell.requestFullscreen();
    });

    await expect(
      page.getByRole("heading", { name: "Fullscreen required" }),
    ).toHaveCount(0);

    await page.evaluate(() => {
      (window as Window & {
        __examFullscreenMock?: { lock: () => void };
      }).__examFullscreenMock?.lock();
    });

    await expect(
      page.getByRole("heading", { name: "Fullscreen required" }),
    ).toBeVisible();

    await page.evaluate(() => {
      (window as Window & {
        __examFullscreenMock?: { unlock: () => void };
      }).__examFullscreenMock?.unlock();
    });

    await expect(
      page.getByRole("heading", { name: "Fullscreen required" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  });

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

test.describe("Student test UI resilience (network mocked) @mobile", () => {
  test("keeps auto-start phone flows interactive when fullscreen is optional", async ({
    page,
  }) => {
    await setStudentSession(page);

    const paper = buildPaper();
    let attempt: StudentAttempt | null = null;
    let saveCount = 0;

    await routeRunnerApis(page, {
      paper,
      getAttempt: () => attempt,
      onStart: async (route) => {
        attempt = buildAttempt();
        await route.fulfill(
          json({
            success: true,
            attempt,
            status: attempt.status,
            remainingTimeMs: 25 * 60 * 1000,
            deadlineAt: isoFromNow(25),
          }),
        );
      },
      onSave: async (route, body) => {
        saveCount += 1;
        attempt = {
          ...(attempt ?? buildAttempt()),
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

    await navigateToAppRoute(page, "/student/tests/paper-1?autoStart=1");

    await expect(page.getByText("2 + 2 = ?")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Fullscreen required" }),
    ).toHaveCount(0);

    const firstOption = page.locator(".app-exam-option").first();
    await firstOption.click();
    await expect(firstOption).toHaveClass(/app-exam-option-selected/);

    await expect
      .poll(() =>
        page
          .locator(".app-exam-focus-topbar")
          .evaluate((element) => getComputedStyle(element).position),
      )
      .toBe("static");

    await expect
      .poll(() =>
        page
          .locator(".app-exam-focus-shell")
          .evaluate((element) => getComputedStyle(element).paddingTop),
      )
      .toBe("0px");

    await expect
      .poll(() =>
        page
          .locator(".app-exam-nav-row")
          .evaluate((element) => getComputedStyle(element).position),
      )
      .toBe("static");

    const previousButton = page.getByRole("button", { name: "Prev" });
    const nextButton = page.getByRole("button", { name: "Next" });

    await expect(previousButton).toBeVisible();
    await expect(nextButton).toBeVisible();

    const previousButtonBox = await previousButton.boundingBox();
    const nextButtonBox = await nextButton.boundingBox();

    expect(previousButtonBox).not.toBeNull();
    expect(nextButtonBox).not.toBeNull();

    if (!previousButtonBox || !nextButtonBox) {
      throw new Error("Expected laptop navigation buttons to have layout boxes");
    }

    expect(Math.abs(previousButtonBox.y - nextButtonBox.y)).toBeLessThan(8);
    expect(nextButtonBox.x).toBeGreaterThan(previousButtonBox.x);

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("3 + 3 = ?")).toBeVisible();
    await expect.poll(() => saveCount).toBe(1);
  });

  test("keeps sub-xl laptop layouts interactive when the bottom helper bar is visible", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await setStudentSession(page);

    const paper = buildPaper();
    let attempt: StudentAttempt | null = null;
    let saveCount = 0;

    await routeRunnerApis(page, {
      paper,
      getAttempt: () => attempt,
      onStart: async (route) => {
        attempt = buildAttempt();
        await route.fulfill(
          json({
            success: true,
            attempt,
            status: attempt.status,
            remainingTimeMs: 25 * 60 * 1000,
            deadlineAt: isoFromNow(25),
          }),
        );
      },
      onSave: async (route, body) => {
        saveCount += 1;
        attempt = {
          ...(attempt ?? buildAttempt()),
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

    await navigateToAppRoute(page, "/student/tests/paper-1?autoStart=1");

    await expect(page.getByText("2 + 2 = ?")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".app-exam-mobile-nav-bar")).toBeVisible();

    const firstOption = page.locator(".app-exam-option").first();
    await firstOption.click();
    await expect(firstOption).toHaveClass(/app-exam-option-selected/);

    await expect
      .poll(() =>
        page
          .locator(".app-exam-focus-topbar")
          .evaluate((element) => getComputedStyle(element).position),
      )
      .toBe("static");

    await expect
      .poll(() =>
        page
          .locator(".app-exam-focus-shell")
          .evaluate((element) => getComputedStyle(element).paddingTop),
      )
      .toBe("0px");

    await expect
      .poll(() =>
        page
          .locator(".app-exam-nav-row")
          .evaluate((element) => getComputedStyle(element).position),
      )
      .toBe("static");

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("3 + 3 = ?")).toBeVisible();
    await expect.poll(() => saveCount).toBe(1);
  });
});
