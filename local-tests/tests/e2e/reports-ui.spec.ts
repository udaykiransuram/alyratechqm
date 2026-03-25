/// <reference types="@playwright/test" />
import { test, expect, type Page, type Route } from "@playwright/test";
import { navigateToAppRoute } from "./helpers/navigation";
import { setSchoolAdminSession } from "./helpers/session";

type ReportJob = {
  _id: string;
  type: "student" | "teacher" | "admin" | "exam";
  status: "queued" | "processing" | "sent" | "failed";
  studentName?: string;
  paperTitle?: string;
  className?: string;
  academicSectionId?: string;
  academicSectionName?: string;
  mobileNumber?: string;
  error?: string;
  attempts?: number;
  maxAttempts?: number;
  updatedAt?: string;
  nextRetryAt?: string;
  providerAcceptedAt?: string;
  lastWebhookAt?: string;
  deliveryStatus?: "accepted" | "sent" | "delivered" | "read" | "failed";
  deliveryAttemptSummary?: {
    totalTracked: number;
    acceptedCount: number;
    expiredCount: number;
    pendingAckCount: number;
    awaitingProviderAck: boolean;
    ackWaitUntil?: string | null;
    recoveredStaleLock: boolean;
    latestAttempt?: {
      key: string;
      attemptNumber: number;
      state: "pending_ack" | "accepted" | "expired";
      createdAt?: string | null;
      acknowledgedAt?: string | null;
      deliveryStatus?: "accepted" | "sent" | "delivered" | "read" | "failed" | null;
      note?: string | null;
    } | null;
  };
};

const sectionOptions = [
  { value: "sec-a", label: "Grade 8 • Section A" },
  { value: "sec-b", label: "Grade 8 • Section B" },
];

function buildJob(overrides: Partial<ReportJob>): ReportJob {
  return {
    _id: "job-default",
    type: "student",
    status: "queued",
    studentName: "Student Name",
    paperTitle: "Baseline Paper",
    className: "Grade 8",
    academicSectionId: "sec-a",
    academicSectionName: "Section A",
    mobileNumber: "919999999999",
    attempts: 0,
    maxAttempts: 3,
    updatedAt: "2026-03-19T09:30:00.000Z",
    deliveryStatus: "accepted",
    deliveryAttemptSummary: {
      totalTracked: 0,
      acceptedCount: 0,
      expiredCount: 0,
      pendingAckCount: 0,
      awaitingProviderAck: false,
      ackWaitUntil: null,
      recoveredStaleLock: false,
      latestAttempt: null,
    },
    ...overrides,
  };
}

function filterJobs(
  jobs: ReportJob[],
  requestUrl: string,
) {
  const url = new URL(requestUrl);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const scope = url.searchParams.get("scope");
  const academicSectionId = url.searchParams.get("academicSectionId");

  return jobs.filter((job) => {
    if (status && status !== "all" && job.status !== status) {
      return false;
    }
    if (type && type !== "all" && job.type !== type) {
      return false;
    }
    if (scope === "benchmark" && job.type === "student") {
      return false;
    }
    if (scope === "student" && job.type !== "student") {
      return false;
    }
    if (
      academicSectionId &&
      academicSectionId !== "all" &&
      job.academicSectionId !== academicSectionId
    ) {
      return false;
    }
    return true;
  });
}

function getReportFilterSelect(page: Page, label: string) {
  return page
    .locator(".app-report-filter-card")
    .filter({ hasText: label })
    .locator("select");
}

test.describe("Report jobs UI (network mocked)", () => {
  test("filters visible jobs and exposes the automatic-processing messaging", async ({
    page,
  }) => {
    await setSchoolAdminSession(page);

    const jobs: ReportJob[] = [
      buildJob({
        _id: "job-student",
        type: "student",
        studentName: "Aarav",
        paperTitle: "Midterm PDF",
        academicSectionId: "sec-a",
        academicSectionName: "Section A",
      }),
      buildJob({
        _id: "job-admin",
        type: "admin",
        studentName: "Admin Desk",
        paperTitle: "Benchmark Workbook",
        className: "Grade 8",
        academicSectionId: "sec-b",
        academicSectionName: "Section B",
        status: "sent",
      }),
    ];

    await page.route("**/api/reports/jobs**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          jobs: filterJobs(jobs, route.request().url()),
          filters: { academicSections: sectionOptions },
        }),
      });
    });

    await navigateToAppRoute(page, "/workspace/manage/reports");

    await expect(page.getByRole("heading", { name: "Report Delivery" })).toBeVisible();
    await expect(page.getByText("Filters & Actions")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Aarav" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Admin Desk" })).toBeVisible();

    await getReportFilterSelect(page, "Recipients").selectOption("student");
    await expect(page.getByRole("cell", { name: "Aarav" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Admin Desk" })).toHaveCount(0);

    await getReportFilterSelect(page, "Report scope").selectOption("benchmark");
    await expect(page.getByRole("cell", { name: "Aarav" })).toHaveCount(0);
    await expect(page.getByText("No jobs found.")).toBeVisible();

    await getReportFilterSelect(page, "Report scope").selectOption("all");
    await getReportFilterSelect(page, "Recipients").selectOption("all");
    await getReportFilterSelect(page, "Class section").selectOption("sec-b");
    await expect(page.getByRole("cell", { name: "Admin Desk" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Aarav" })).toHaveCount(0);
  });

  test("retries failed jobs and lets admins manually run the worker", async ({
    page,
  }) => {
    await setSchoolAdminSession(page);

    const jobs: ReportJob[] = [
      buildJob({
        _id: "job-failed",
        type: "student",
        status: "failed",
        studentName: "Ishita",
        paperTitle: "Science Drill",
        error: "Delivery failed outside the conversation window",
        deliveryStatus: "failed",
        attempts: 2,
      }),
      buildJob({
        _id: "job-queued",
        type: "teacher",
        studentName: "Teacher Team",
        status: "queued",
        paperTitle: "Class Benchmark",
        deliveryStatus: "accepted",
      }),
    ];

    await page.route("**/api/reports/jobs**", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          jobs: filterJobs(jobs, route.request().url()),
          filters: { academicSections: sectionOptions },
        }),
      });
    });

    await page.route("**/api/reports/jobs/job-failed/retry**", async (route) => {
      const failedJob = jobs.find((job) => job._id === "job-failed");
      if (failedJob) {
        failedJob.status = "queued";
        failedJob.error = undefined;
        failedJob.deliveryStatus = "accepted";
        failedJob.attempts = 0;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, jobId: "job-failed" }),
      });
    });

    await page.route("**/api/reports/worker**", async (route) => {
      for (const job of jobs) {
        if (job.status === "queued") {
          job.status = "sent";
          job.deliveryStatus = "sent";
          job.error = undefined;
        }
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          processed: 2,
          sent: 2,
          failed: 0,
          remainingQueued: 0,
          deliveryMode: "document",
        }),
      });
    });

    await navigateToAppRoute(page, "/workspace/manage/reports");

    const failedRow = page.getByRole("row", { name: /Ishita/ });
    await expect(failedRow).toBeVisible();
    await failedRow.getByRole("button", { name: "Retry now" }).click();
    await expect(page.getByRole("row", { name: /Ishita/ })).toContainText(
      "queued",
    );

    await page.getByRole("button", { name: "Run Worker Now" }).click();
    await expect(
      page.getByText("Worker processed 2, sent 2, and failed 0."),
    ).toBeVisible();
    await expect(page.getByRole("row", { name: /Ishita/ })).toContainText(
      "sent",
    );
    await expect(page.getByRole("row", { name: /Teacher Team/ })).toContainText(
      "sent",
    );
  });

  test("shows provider acknowledgement waits and recovered stale-lock context", async ({
    page,
  }) => {
    await setSchoolAdminSession(page);

    const jobs: ReportJob[] = [
      buildJob({
        _id: "job-waiting",
        type: "student",
        status: "queued",
        studentName: "Nila",
        paperTitle: "Math Practice",
        error:
          "Recovered stale processing lock; waiting for provider acknowledgement before retrying at 2026-03-20T10:15:00.000Z.",
        nextRetryAt: "2026-03-20T10:15:00.000Z",
        deliveryAttemptSummary: {
          totalTracked: 2,
          acceptedCount: 1,
          expiredCount: 0,
          pendingAckCount: 1,
          awaitingProviderAck: true,
          ackWaitUntil: "2026-03-20T10:15:00.000Z",
          recoveredStaleLock: true,
          latestAttempt: {
            key: "rdj_waiting",
            attemptNumber: 2,
            state: "pending_ack",
            createdAt: "2026-03-20T09:30:00.000Z",
            deliveryStatus: "accepted",
          },
        },
      }),
    ];

    await page.route("**/api/reports/jobs**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          jobs: filterJobs(jobs, route.request().url()),
          filters: { academicSections: sectionOptions },
        }),
      });
    });

    await navigateToAppRoute(page, "/workspace/manage/reports");

    const waitingRow = page.getByRole("row", { name: /Nila/ });
    await expect(waitingRow).toContainText("Awaiting provider ack");
    await expect(waitingRow).toContainText("Recovered stale lock");
    await expect(waitingRow).toContainText("2 tracked");
    await expect(waitingRow).toContainText("1 pending ack");
    await expect(waitingRow).toContainText("Attempt #2 Pending Ack");
  });
});
