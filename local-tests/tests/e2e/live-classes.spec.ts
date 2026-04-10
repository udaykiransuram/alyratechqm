/// <reference types="@playwright/test" />
import { test, expect } from "./helpers/strict-browser-test";
import { navigateToAppRoute } from "./helpers/navigation";
import { setSchoolAdminSession, setStudentSession } from "./helpers/session";

function toDateTimeLocal(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  const shifted = new Date(date.getTime() - offsetMs);
  return shifted.toISOString().slice(0, 16);
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
});
