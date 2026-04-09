/// <reference types="@playwright/test" />
import { expect, test, type Route } from "./helpers/strict-browser-test";
import { navigateToAppRoute } from "./helpers/navigation";
import { setStudentSession } from "./helpers/session";

type StudentAttempt = {
  _id: string;
  paper: string;
  student: string;
  status: "in_progress" | "submitted" | "auto_submitted";
  startedAt: string;
  submittedAt: string | null;
  lastSavedAt?: string | null;
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

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

const studentTestsApiRoute = /\/api\/student\/tests(?:\/.*)?(?:\?.*)?$/;

function isoFromNow(minutesFromNow: number) {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}

test.describe("Student test UI (network mocked) @desktop", () => {
  test("renders assigned test states and keeps the student dashboard actions clear", async ({
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

    await page.route("**/api/student/tests**", async (route) => {
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

    await navigateToAppRoute(page, "/student/tests?submitted=1");

    await expect(
      page.getByRole("heading", { name: "Tests" }),
    ).toBeVisible();
    await expect(
      page.getByText("Test submitted."),
    ).toBeVisible();
    const availableRow = page.getByRole("row", { name: /Chemistry Practice/ });
    const progressRow = page.getByRole("row", { name: /Physics Quiz/ });
    const submittedRow = page.getByRole("row", { name: /Biology Revision/ });

    await expect(availableRow.getByRole("link", { name: "Start" })).toBeVisible();
    await expect(progressRow.getByRole("link", { name: "Continue" })).toBeVisible();
    await expect(
      submittedRow.getByRole("link", { name: "Open Analysis Report" }),
    ).toBeVisible();
    await expect(progressRow).toContainText("Time left 14m 0s");
    await expect(submittedRow).toContainText("5 / 6");
  });

  test("supports save and submit flow from the student runner and redirects back to the dashboard", async ({
    page,
  }) => {
    await setStudentSession(page);

    const paper = {
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
              marks: 6,
              negativeMarks: 0,
            },
          ],
        },
      ],
    };

    let attempt: StudentAttempt = {
      _id: "attempt-1",
      paper: "paper-1",
      student: "student-1",
      status: "in_progress",
      startedAt: isoFromNow(-5),
      submittedAt: null,
      lastSavedAt: isoFromNow(-5),
      totalMarksAwarded: 0,
      sectionAnswers: [],
    };

    const savedPayloads: unknown[] = [];
    const submitPayloads: unknown[] = [];

    await page.route(studentTestsApiRoute, async (route: Route) => {
      const url = new URL(route.request().url());
      const { pathname } = url;
      const method = route.request().method();

      if (pathname === "/api/student/tests" && method === "GET") {
        const listStatus =
          attempt.status === "in_progress" ? "in_progress" : "submitted";

        await route.fulfill(
          json({
            success: true,
            tests: [
              buildListTest({
                _id: "paper-1",
                title: paper.title,
                status: listStatus,
                attempt: {
                  submittedAt: attempt.submittedAt,
                  status: attempt.status,
                  totalMarksAwarded: attempt.totalMarksAwarded,
                },
              }),
            ],
          }),
        );
        return;
      }

      if (pathname === "/api/student/tests/paper-1" && method === "GET") {
        await route.fulfill(
          json({
            success: true,
            paper,
            attempt,
            status: attempt.status,
            remainingTimeMs: 25 * 60 * 1000,
            deadlineAt: isoFromNow(25),
          }),
        );
        return;
      }

      if (pathname === "/api/student/tests/paper-1/attempt" && method === "PATCH") {
        const body = route.request().postDataJSON();
        savedPayloads.push(body);

        attempt = {
          ...attempt,
          lastSavedAt: isoFromNow(-1),
          sectionAnswers: Array.isArray((body as any)?.sectionAnswers)
            ? (body as any).sectionAnswers
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
        return;
      }

      if (pathname === "/api/student/tests/paper-1/submit" && method === "POST") {
        const body = route.request().postDataJSON();
        submitPayloads.push(body);

        attempt = {
          ...attempt,
          status: "submitted",
          submittedAt: isoFromNow(-1),
          lastSavedAt: isoFromNow(-1),
          totalMarksAwarded: 6,
          sectionAnswers: Array.isArray((body as any)?.sectionAnswers)
            ? (body as any).sectionAnswers
            : [],
        };

        await route.fulfill(
          json({
            success: true,
            attempt,
            status: attempt.status,
          }),
        );
        return;
      }

      await route.fallback();
    });

    await navigateToAppRoute(page, "/student/tests/paper-1");

    await expect(page.getByLabel("Notifications")).toHaveCount(0);
    await expect(
      page.getByLabel("Student portal navigation"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Save" }),
    ).toBeVisible({ timeout: 15_000 });
    const optionA = page
      .locator("label.app-exam-option")
      .filter({ has: page.locator('input[aria-label="Option A"]') })
      .first();
    await expect(optionA).toBeVisible({ timeout: 15_000 });
    await optionA.click();
    await page.getByRole("button", { name: "Save" }).click();

    await expect.poll(() => savedPayloads.length).toBe(1);
    expect(savedPayloads[0]).toMatchObject({
      sectionAnswers: [
        {
          sectionName: "Section A",
          answers: [{ question: "q1", selectedOptions: [0] }],
        },
      ],
    });
    expect(savedPayloads[0]).toHaveProperty("baseLastSavedAt");

    await page.getByRole("button", { name: "Submit" }).click();
    await expect(
      page.getByRole("button", { name: "Confirm Submit" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirm Submit" }).click();

    await expect.poll(() => submitPayloads.length).toBe(1);
    expect(submitPayloads[0]).toMatchObject({
      sectionAnswers: [
        {
          sectionName: "Section A",
          answers: [{ question: "q1", selectedOptions: [0] }],
        },
      ],
    });
    expect(submitPayloads[0]).toHaveProperty("baseLastSavedAt");

    await expect(page).toHaveURL(/\/student\/tests\?submitted=1/);
    await expect(
      page.getByText("Test submitted."),
    ).toBeVisible();
  });

  test("keeps the review-only runner stable even when submittedAt is missing", async ({
    page,
  }) => {
    await setStudentSession(page);

    await page.route("**/api/student/tests**", async (route: Route) => {
      const url = new URL(route.request().url());
      const { pathname } = url;
      const method = route.request().method();

      if (pathname === "/api/student/tests/paper-2" && method === "GET") {
        await route.fulfill(
          json({
            success: true,
            paper: {
              _id: "paper-2",
              title: "Mathematics Review",
              instructions: "",
              duration: 20,
              passingMarks: 3,
              totalMarks: 5,
              sections: [
                {
                  name: "Section A",
                  marks: 5,
                  questions: [
                    {
                      question: {
                        _id: "q1",
                        content: "<p>1 + 1 = ?</p>",
                        type: "single",
                        options: [
                          { content: "<p>2</p>" },
                          { content: "<p>3</p>" },
                        ],
                      },
                      marks: 5,
                      negativeMarks: 0,
                    },
                  ],
                },
              ],
            },
            attempt: {
              _id: "attempt-2",
              status: "submitted",
              startedAt: "2026-03-20T09:00:00.000Z",
              submittedAt: null,
              totalMarksAwarded: 5,
              sectionAnswers: [],
            },
            status: "submitted",
            remainingTimeMs: 0,
            deadlineAt: "2026-03-20T09:20:00.000Z",
          }),
        );
        return;
      }

      await route.fallback();
    });

    await navigateToAppRoute(page, "/student/tests/paper-2");

    await expect(
      page.getByText("Submission Summary", { exact: true }).last(),
    ).toBeVisible();
    await expect(page.getByText("Not available", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("5 / 5").first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to Tests" }),
    ).toBeVisible();
  });
});
