/// <reference types="@playwright/test" />
import { test, expect } from "./helpers/strict-browser-test";
import type { Page } from "@playwright/test";

import { navigateToAppRoute } from "./helpers/navigation";
import { setSchoolAdminSession, setStudentSession } from "./helpers/session";

function toDateTimeLocal(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  const shifted = new Date(date.getTime() - offsetMs);
  return shifted.toISOString().slice(0, 16);
}

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "http://127.0.0.1:3001";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `http://${trimmed}`;
}

function buildAppUrl(page: Page, path: string) {
  const currentUrl = String(page.url() || "").trim();
  const baseUrl =
    currentUrl && /^https?:\/\//i.test(currentUrl)
      ? currentUrl
      : normalizeBaseUrl(process.env.BASE_URL);

  return new URL(path, baseUrl).toString();
}

type LiveSessionApiDetail = {
  _id: string;
  items: Array<{
    _id: string;
    type: string;
    promptHtml: string;
  }>;
};

async function createLiveSessionViaApi(
  page: Page,
  input: Record<string, unknown>,
) {
  const response = await page.request.post(buildAppUrl(page, "/api/live-sessions"), {
    data: input,
  });
  const payload = (await response.json()) as {
    success?: boolean;
    liveSession?: LiveSessionApiDetail;
  };

  expect(response.ok()).toBe(true);
  expect(payload.success).toBe(true);
  expect(payload.liveSession?._id).toBeTruthy();

  return payload.liveSession!;
}

async function createLiveItemViaApi(
  page: Page,
  liveSessionId: string,
  input: Record<string, unknown>,
) {
  const response = await page.request.post(
    buildAppUrl(page, `/api/live-sessions/${liveSessionId}/items`),
    {
      data: input,
    },
  );
  const payload = (await response.json()) as {
    success?: boolean;
    liveSession?: LiveSessionApiDetail;
  };

  expect(response.ok()).toBe(true);
  expect(payload.success).toBe(true);

  return payload.liveSession!;
}

async function activateLiveItemViaApi(
  page: Page,
  liveSessionId: string,
  itemId: string,
) {
  const response = await page.request.post(
    buildAppUrl(page, `/api/live-sessions/${liveSessionId}/items/${itemId}/activate`),
  );
  const payload = (await response.json()) as {
    success?: boolean;
    liveSession?: LiveSessionApiDetail;
  };

  expect(response.ok()).toBe(true);
  expect(payload.success).toBe(true);

  return payload.liveSession!;
}

async function updateTranscriptViaApi(
  page: Page,
  liveSessionId: string,
  input: Record<string, unknown>,
) {
  const response = await page.request.patch(
    buildAppUrl(page, `/api/live-sessions/${liveSessionId}/transcript`),
    {
      data: input,
    },
  );
  const payload = (await response.json()) as {
    success?: boolean;
    liveSession?: LiveSessionApiDetail;
  };

  expect(response.ok()).toBe(true);
  expect(payload.success).toBe(true);

  return payload.liveSession!;
}

async function deleteLiveSessionViaApi(page: Page, liveSessionId: string) {
  const response = await page.request.delete(
    buildAppUrl(page, `/api/live-sessions/${liveSessionId}`),
  );

  expect(response.ok()).toBe(true);
}

test.describe("Live classes workflow @desktop", () => {
  test("admin can schedule a live class that students join and attendance can be marked", async ({
    page,
  }) => {
    const liveClassTitle = `E2E Live Class ${Date.now()}`;
    const description = "Mocked live session for Playwright coverage.";
    const studentJoinLink = "https://meet.example.com/live-class-e2e";
    const hostJoinLink = "https://meet.example.com/host/live-class-e2e";
    const start = new Date(Date.now() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    await setSchoolAdminSession(page);
    const workspaceResponse = await navigateToAppRoute(page, "/workspace/live-classes");
    expect(workspaceResponse?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Live Classes" })).toBeVisible();

    await page.getByRole("link", { name: /Schedule live class/i }).click();
    await expect(page.getByRole("heading", { name: "Schedule Live Class" })).toBeVisible();

    await page.getByLabel("Title").fill(liveClassTitle);
    await page.getByLabel("Description").fill(description);

    await page.getByRole("button", { name: /Select class/i }).click();
    await page.getByRole("option", { name: "CLASS X" }).click();

    await page.getByRole("button", { name: /Select subject/i }).click();
    await page.getByRole("option", { name: "Mathematics" }).click();

    await page.getByRole("button", {
      name: /Whole class or selected sections/i,
    }).click();
    await page.getByRole("option", { name: "Watson" }).click();
    await page.getByRole("button", { name: "Done" }).click();

    await page.getByRole("button", { name: /Select host teacher/i }).click();
    await page.getByRole("option", { name: "Mock Mathematics Teacher" }).click();

    await page.getByLabel("Start time").fill(toDateTimeLocal(start));
    await page.getByLabel("End time").fill(toDateTimeLocal(end));
    await page.getByLabel("Student join link").fill(studentJoinLink);
    await page.getByLabel("Host join link").fill(hostJoinLink);
    await page.getByLabel("Meeting code").fill("E2E-101");
    await page.getByLabel("Meeting passcode").fill("E2E-CODE");
    await page
      .getByLabel("Join instructions")
      .fill("Bring a notebook and keep audio muted unless invited.");

    await Promise.all([
      page.waitForURL(/\/workspace\/live-classes\/[^/]+$/),
      page.getByRole("button", { name: /Create live class/i }).click(),
    ]);

    await expect(page.getByText("Session Operations")).toBeVisible();
    const detailUrl = page.url();
    const liveSessionId = detailUrl.split("/").pop() ?? "";
    expect(liveSessionId).not.toBe("");

    await setStudentSession(page);
    await navigateToAppRoute(page, "/student/live-classes");
    await expect(page.getByRole("heading", { name: liveClassTitle })).toBeVisible();

    const joinResponse = await page.request.get(
      new URL(`/api/student/live-sessions/${liveSessionId}/join`, page.url()).toString(),
    );
    expect(joinResponse.status()).toBeLessThan(400);

    await navigateToAppRoute(page, "/student/live-classes");
    await expect(page.getByText(/You joined 1 time/i)).toBeVisible();

    await setSchoolAdminSession(page);
    const detailResponse = await navigateToAppRoute(
      page,
      `/workspace/live-classes/${liveSessionId}`,
    );
    expect(detailResponse?.status() ?? 0).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: liveClassTitle })).toBeVisible();

    const studentRow = page.locator("tbody tr", { hasText: "Aarav" }).first();
    await studentRow.waitFor();

    const presentAction = studentRow.getByRole("button", { name: "Present" });
    const attendanceRequest = page.waitForResponse((response) =>
      response.url().includes(`/api/live-sessions/${liveSessionId}/attendance`) &&
      response.request().method() === "PATCH",
    );

    await Promise.all([presentAction.click(), attendanceRequest]);
    const updatedRow = page.locator("tbody tr", { hasText: "Aarav" }).first();
    await expect(updatedRow.getByText(/Present/i)).toBeVisible();
  });

  test("student companion supports rich live items, transcript summary, and teacher review", async ({
    page,
  }) => {
    let liveSessionId = "";

    await setSchoolAdminSession(page);
    const workspaceResponse = await navigateToAppRoute(page, "/workspace/live-classes");
    expect(workspaceResponse?.status() ?? 0).toBeLessThan(400);

    const start = new Date(Date.now() + 30 * 60 * 1000);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    try {
      const createdSession = await createLiveSessionViaApi(page, {
        title: `Live Class V2 ${Date.now()}`,
        description: "Browser coverage for the new live-class companion experience.",
        classId: "111111111111111111111111",
        subjectId: "444444444444444444444444",
        assignedAcademicSectionIds: ["222222222222222222222222"],
        hostTeacherId: "live-session-teacher-1",
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
        studentJoinUrl: "https://meet.example.com/student/live-class-v2",
        hostJoinUrl: "https://meet.example.com/host/live-class-v2",
        meetingCode: "LIVE-V2",
        meetingPasscode: "BROWSER",
        joinInstructions: "Open the meeting in one tab and keep this companion page visible.",
        status: "scheduled",
      });
      liveSessionId = createdSession._id;

      await createLiveItemViaApi(page, liveSessionId, {
        type: "single",
        promptHtml: "<p>Pick the fastest warm-up before the full class begins.</p>",
        options: [
          { contentHtml: "<p>Open a blank page and wait.</p>" },
          { contentHtml: "<p>Review one solved example.</p>" },
        ],
        answerIndexes: [1],
        explanationHtml: "<p>Looking at one solved example is the fastest warm-up.</p>",
      });

      const afterMultipleCreate = await createLiveItemViaApi(page, liveSessionId, {
        type: "multiple",
        promptHtml:
          '<p>Select the two checks you should complete before the teacher starts.</p><p><span data-type="math" data-latex="2+2" data-display-mode="false"></span> stays here as a rendering check.</p>',
        options: [
          { contentHtml: "<p>Keep your notebook ready.</p>" },
          { contentHtml: "<p>Leave time for a final review.</p>" },
          { contentHtml: "<p>Skip the instructions entirely.</p>" },
        ],
        answerIndexes: [0, 1],
        explanationHtml: "<p>Preparation and review time are both expected.</p>",
      });

      const multipleItem = afterMultipleCreate.items.find(
        (item) => item.type === "multiple",
      );
      expect(multipleItem?._id).toBeTruthy();

      const afterShortTextCreate = await createLiveItemViaApi(page, liveSessionId, {
        type: "short-text",
        promptHtml:
          "<p>Write one full-sentence takeaway you will apply in the next test.</p>",
        options: [],
        answerIndexes: [],
        explanationHtml: "",
      });

      const shortTextItem = afterShortTextCreate.items.find(
        (item) => item.type === "short-text",
      );
      expect(shortTextItem?._id).toBeTruthy();

      await updateTranscriptViaApi(page, liveSessionId, {
        rawText: "Teacher reminded students to keep the notebook ready and leave time for review.",
        summaryHtml:
          "<p><strong>Focus:</strong> keep your workings tidy and leave time for a final check.</p>",
        isPublished: true,
      });

      await activateLiveItemViaApi(page, liveSessionId, multipleItem!._id);

      await setStudentSession(page);
      const studentDetailResponse = await navigateToAppRoute(
        page,
        `/student/live-classes/${liveSessionId}`,
      );
      expect(studentDetailResponse?.status() ?? 0).toBeLessThan(400);

      await expect(page.getByText("Current live item")).toBeVisible();
      await expect(
        page.getByText(/Select the two checks you should complete/i),
      ).toBeVisible();
      await expect(
        page.getByText(/Focus:\s*keep your workings tidy and leave time for a final check/i),
      ).toBeVisible();

      await page.getByRole("button", { name: /select option 1/i }).click();
      await page.getByRole("button", { name: /select option 2/i }).click();
      await page.getByRole("button", { name: "Submit response" }).click();
      await expect(page.getByText(/Response saved/i)).toBeVisible();

      await setSchoolAdminSession(page);
      const teacherObjectiveResponse = await navigateToAppRoute(
        page,
        `/workspace/live-classes/${liveSessionId}`,
      );
      expect(teacherObjectiveResponse?.status() ?? 0).toBeLessThan(400);
      await expect(page.getByText(/1 responses/i)).toBeVisible();
      await expect(page.getByText(/1 correct/i)).toBeVisible();

      await activateLiveItemViaApi(page, liveSessionId, shortTextItem!._id);

      await setStudentSession(page);
      await navigateToAppRoute(page, `/student/live-classes/${liveSessionId}`);
      await expect(
        page.getByText(/Write one full-sentence takeaway you will apply/i),
      ).toBeVisible();

      const editor = page.locator(".ProseMirror").first();
      await editor.click();
      await editor.fill(
        "I will show every calculation step clearly and still leave time to review my final answer.",
      );
      await page.getByRole("button", { name: "Save answer" }).click();
      await expect(page.getByText(/Response saved/i)).toBeVisible();

      await setSchoolAdminSession(page);
      await navigateToAppRoute(page, `/workspace/live-classes/${liveSessionId}`);
      await page.getByRole("button", { name: /View responses/i }).first().click();
      await expect(page.getByRole("dialog")).toContainText(
        "I will show every calculation step clearly and still leave time to review my final answer.",
      );
    } finally {
      if (liveSessionId) {
        await setSchoolAdminSession(page);
        await deleteLiveSessionViaApi(page, liveSessionId);
      }
    }
  });
});
