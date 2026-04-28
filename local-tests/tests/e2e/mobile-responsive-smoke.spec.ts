/// <reference types="@playwright/test" />
import { expect, test } from "./helpers/strict-browser-test";
import { navigateToAppRoute } from "./helpers/navigation";
import { setSchoolAdminSession, setStudentSession } from "./helpers/session";

function isoFromNow(minutesFromNow: number) {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

test.describe("Mobile-first page behavior @mobile", () => {
  test("workspace reports keeps mobile nav + card queue usable @mobile", async ({
    page,
  }) => {
    await setSchoolAdminSession(page);

    await page.route("**/api/reports/jobs**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const statusFilter = requestUrl.searchParams.get("status") || "all";

      const allJobs = [
        {
          _id: "job-student-1",
          type: "student",
          status: "queued",
          studentName: "Aarav",
          paperTitle: "Fractions Checkpoint",
          className: "Class X",
          academicSectionId: "sec-a",
          academicSectionName: "Section A",
          mobileNumber: "919999999999",
          attempts: 0,
          maxAttempts: 3,
          updatedAt: isoFromNow(-8),
          deliveryStatus: "accepted",
          deliveryAttemptSummary: {
            totalTracked: 1,
            acceptedCount: 1,
            expiredCount: 0,
            pendingAckCount: 0,
            awaitingProviderAck: false,
            ackWaitUntil: null,
            recoveredStaleLock: false,
            latestAttempt: null,
          },
        },
        {
          _id: "job-admin-1",
          type: "admin",
          status: "sent",
          studentName: "Admin Desk",
          paperTitle: "Benchmark Digest",
          className: "Class X",
          academicSectionId: "sec-b",
          academicSectionName: "Section B",
          mobileNumber: "919111111111",
          attempts: 1,
          maxAttempts: 3,
          updatedAt: isoFromNow(-30),
          deliveryStatus: "sent",
          deliveryAttemptSummary: {
            totalTracked: 1,
            acceptedCount: 1,
            expiredCount: 0,
            pendingAckCount: 0,
            awaitingProviderAck: false,
            ackWaitUntil: null,
            recoveredStaleLock: false,
            latestAttempt: null,
          },
        },
      ];

      const jobs =
        statusFilter && statusFilter !== "all"
          ? allJobs.filter((job) => job.status === statusFilter)
          : allJobs;

      await route.fulfill(
        json({
          success: true,
          jobs,
          total: jobs.length,
          page: 1,
          pages: 1,
          limit: 20,
          filters: {
            academicSections: [
              { value: "sec-a", label: "Class X - Section A" },
              { value: "sec-b", label: "Class X - Section B" },
            ],
          },
        }),
      );
    });

    await navigateToAppRoute(page, "/workspace/manage/reports");

    await expect(
      page.getByRole("heading", { name: "Report Delivery Queue" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /open menu/i })).toBeVisible();

    await page.getByRole("button", { name: /open menu/i }).click();
    const mobileNavDialog = page.getByRole("dialog");
    await expect(mobileNavDialog).toBeVisible();
    await expect(
      mobileNavDialog.getByRole("heading", { name: "Navigation" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(mobileNavDialog).toHaveCount(0);

    await expect(page.getByText("Report Filters")).toBeVisible();
    await expect(page.getByText("Dispatch Queue")).toBeVisible();
    await expect(
      page.getByRole("article").filter({ hasText: "Aarav" }),
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: "Aarav" })).toHaveCount(0);
  });

  test("student tests renders compact mobile cards with clear actions @mobile", async ({
    page,
  }) => {
    await setStudentSession(page);

    await page.route("**/api/student/tests**", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.pathname !== "/api/student/tests") {
        await route.fallback();
        return;
      }

      await route.fulfill(
        json({
          success: true,
          tests: [
            {
              _id: "paper-available",
              title: "Chemistry Practice",
              duration: 30,
              passingMarks: 12,
              totalMarks: 20,
              examDate: isoFromNow(-20),
              onlineStartsAt: isoFromNow(-20),
              onlineEndsAt: isoFromNow(40),
              class: { _id: "class-x", name: "Class X" },
              subject: { _id: "subject-chem", name: "Chemistry" },
              status: "available",
              remainingTimeMs: null,
              requiresManualReview: false,
              attempt: null,
            },
            {
              _id: "paper-progress",
              title: "Physics Quiz",
              duration: 25,
              passingMarks: 10,
              totalMarks: 20,
              examDate: isoFromNow(-15),
              onlineStartsAt: isoFromNow(-15),
              onlineEndsAt: isoFromNow(25),
              class: { _id: "class-x", name: "Class X" },
              subject: { _id: "subject-phy", name: "Physics" },
              status: "in_progress",
              remainingTimeMs: 11 * 60 * 1000,
              requiresManualReview: false,
              attempt: null,
            },
          ],
        }),
      );
    });

    await navigateToAppRoute(page, "/student/tests");

    await expect(page.getByRole("heading", { name: "Tests" })).toBeVisible();
    await expect(page.getByText("Assigned Tests", { exact: true })).toBeVisible();

    const chemistryCard = page
      .getByRole("article")
      .filter({ hasText: "Chemistry Practice" });
    const physicsCard = page.getByRole("article").filter({ hasText: "Physics Quiz" });

    await expect(chemistryCard).toBeVisible();
    await expect(physicsCard).toBeVisible();
    await expect(chemistryCard.getByRole("link", { name: "Start" })).toBeVisible();
    await expect(physicsCard.getByRole("link", { name: "Continue" })).toBeVisible();

    await expect(page.getByRole("columnheader", { name: "Action" })).toHaveCount(0);
  });

  test("public product page keeps mobile nav discoverable and usable @mobile", async ({
    page,
  }) => {
    await navigateToAppRoute(page, "/product");

    await expect(
      page.getByRole("heading", {
        name: "Everything your school needs to operate, diagnose, and grow",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /open navigation/i })).toBeVisible();

    await page.getByRole("button", { name: /open navigation/i }).click();
    const mobileNavDialog = page.getByRole("dialog", {
      name: "Mobile navigation",
    });

    await expect(mobileNavDialog).toBeVisible();
    await expect(mobileNavDialog.getByRole("menuitem", { name: "Home" })).toBeVisible();
    await expect(
      mobileNavDialog.getByRole("menuitem", { name: "Solutions" }).first(),
    ).toBeVisible();

    await mobileNavDialog.getByRole("menuitem", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
