#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { request } from "@playwright/test";
import { encode } from "next-auth/jwt";

const MOCK_CLASS_ID = "111111111111111111111111";
const MOCK_SECTION_ID = "222222222222222222222222";
const MOCK_COURSE_ID = "666666666666666666666666";
const MOCK_DIARY_ID = "777777777777777777777777";
const SCHOOL_KEY = "demo-school";
const SCHOOL_DISPLAY_NAME = "Demo School";

const args = Object.fromEntries(
  process.argv.slice(2).map((entry) => {
    const normalized = String(entry || "").replace(/^--/, "");
    const [key, ...rest] = normalized.split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }),
);

function parsePositiveInteger(value, fallback) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return fallback;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer value: ${value}`);
  }
  return Math.floor(parsed);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function percentile(values, percentileValue) {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return Math.round(sorted[rank]);
}

function average(values) {
  if (!values.length) {
    return null;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "http://127.0.0.1:3000";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

function printHelp() {
  console.log(
    [
      "Usage: npm run stress:learning-content -- [options]",
      "",
      "Options:",
      "  --base=<url>           App base URL (default: http://127.0.0.1:3000)",
      "  --concurrency=<n>      Concurrent workers (default: 6)",
      "  --iterations=<n>       Iterations per worker (default: 5)",
      "  --delay-ms=<ms>        Delay between iterations per worker (default: 100)",
      "  --timeout-ms=<ms>      Per-request timeout (default: 15000)",
      "  --out=<jsonFile>       Optional JSON summary output path",
      "  --help                 Show this help text",
      "",
      "Notes:",
      "  - Start the app first, or point --base to an existing dev/prod server.",
      "  - This runner uses the repo's E2E mock-mode session shape for Courses and E-Diary.",
    ].join("\n"),
  );
}

async function createSessionCookie(params) {
  const nextAuthSecret = process.env.NEXTAUTH_SECRET || "testsecret";
  const sessionToken = await encode({
    secret: nextAuthSecret,
    token: {
      sub: params.id,
      id: params.id,
      name: params.name,
      email: params.email,
      accountType: "school_user",
      role: params.role,
      schoolKey: SCHOOL_KEY,
      ...(params.role === "student"
        ? {
            studentSessionId: params.studentSessionId,
            studentClassId: MOCK_CLASS_ID,
            studentAcademicSectionId: MOCK_SECTION_ID,
          }
        : {}),
    },
    maxAge: 60 * 60,
  });

  return [
    `next-auth.session-token=${encodeURIComponent(sessionToken)}`,
    `schoolKey=${encodeURIComponent(SCHOOL_KEY)}`,
    `schoolDisplayName=${encodeURIComponent(SCHOOL_DISPLAY_NAME)}`,
  ].join("; ");
}

async function createApiContext(baseURL, session) {
  const cookie = await createSessionCookie(session);
  return request.newContext({
    baseURL,
    extraHTTPHeaders: {
      cookie,
      "x-school-key": SCHOOL_KEY,
    },
    ignoreHTTPSErrors: true,
  });
}

async function executeStep(apiContext, step, timeoutMs) {
  const startedAt = performance.now();
  let response;

  if (step.method === "PATCH") {
    response = await apiContext.patch(step.url, {
      data: step.body,
      timeout: timeoutMs,
    });
  } else {
    response = await apiContext.get(step.url, {
      timeout: timeoutMs,
    });
  }

  const durationMs = Math.round(performance.now() - startedAt);
  const text = await response.text();
  const contentType = String(response.headers()["content-type"] || "");
  let parsed = null;

  if (contentType.includes("application/json") && text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  const ok =
    response.ok() &&
    (!parsed ||
      typeof parsed !== "object" ||
      !("success" in parsed) ||
      parsed.success !== false);

  return {
    step: step.label,
    ok,
    status: response.status(),
    durationMs,
    message:
      parsed && typeof parsed.message === "string"
        ? parsed.message
        : response.statusText(),
  };
}

function summarizeEvents(events) {
  const grouped = new Map();

  for (const event of events) {
    if (!grouped.has(event.step)) {
      grouped.set(event.step, []);
    }
    grouped.get(event.step).push(event);
  }

  return Array.from(grouped.entries()).map(([step, entries]) => {
    const durations = entries.map((entry) => entry.durationMs);
    const failures = entries.filter((entry) => !entry.ok);
    return {
      step,
      count: entries.length,
      failures: failures.length,
      avgMs: average(durations),
      p95Ms: percentile(durations, 95),
      maxMs: durations.length ? Math.max(...durations) : null,
      sampleFailure: failures[0]
        ? {
            status: failures[0].status,
            message: failures[0].message,
          }
        : null,
    };
  });
}

async function main() {
  if (args.help === "true") {
    printHelp();
    return;
  }

  const baseURL = normalizeBaseUrl(args.base || process.env.BASE_URL);
  const concurrency = parsePositiveInteger(args.concurrency, 6);
  const iterations = parsePositiveInteger(args.iterations, 5);
  const delayMs = parsePositiveInteger(args["delay-ms"], 100);
  const timeoutMs = parsePositiveInteger(args["timeout-ms"], 15_000);
  const outPath = String(args.out || "").trim();

  const startedAt = new Date().toISOString();
  const allEvents = [];

  const adminContext = await createApiContext(baseURL, {
    id: "stress-admin-1",
    name: "Stress Admin",
    email: "stress-admin@example.com",
    role: "admin",
  });

  const createStudentSteps = (workerIndex) => {
    const studentId = `stress-student-${workerIndex + 1}`;
    return {
      session: {
        id: studentId,
        name: `Stress Student ${workerIndex + 1}`,
        email: `${studentId}@example.com`,
        role: "student",
        studentSessionId: `stress-session-${workerIndex + 1}`,
      },
      steps: [
        { label: "student courses page", method: "GET", url: "/student/courses" },
        { label: "student diary page", method: "GET", url: "/student/diary" },
        { label: "student courses api", method: "GET", url: "/api/student/courses" },
        {
          label: "student course detail api",
          method: "GET",
          url: `/api/student/courses/${MOCK_COURSE_ID}`,
        },
        {
          label: "student course progress patch",
          method: "PATCH",
          url: `/api/student/courses/${MOCK_COURSE_ID}/progress`,
          body: {
            note: {
              blockId: "course-lesson-1",
              text: `Stress note ${workerIndex + 1}`,
            },
          },
        },
        { label: "student diary api", method: "GET", url: "/api/student/diary" },
        {
          label: "student diary detail api",
          method: "GET",
          url: `/api/student/diary/${MOCK_DIARY_ID}`,
        },
        {
          label: "student diary state patch",
          method: "PATCH",
          url: `/api/student/diary/${MOCK_DIARY_ID}/state`,
          body: { markSeen: true },
        },
      ],
    };
  };

  const adminSteps = [
    { label: "workspace courses page", method: "GET", url: "/workspace/courses" },
    { label: "workspace diary page", method: "GET", url: "/workspace/diary" },
    { label: "workspace courses api", method: "GET", url: "/api/courses" },
    {
      label: "workspace course detail api",
      method: "GET",
      url: `/api/courses/${MOCK_COURSE_ID}`,
    },
    { label: "workspace diary api", method: "GET", url: "/api/diary" },
    {
      label: "workspace diary detail api",
      method: "GET",
      url: `/api/diary/${MOCK_DIARY_ID}`,
    },
    {
      label: "workspace course create page",
      method: "GET",
      url: "/workspace/courses/create",
    },
    {
      label: "workspace diary create page",
      method: "GET",
      url: "/workspace/diary/create",
    },
  ];

  try {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const adminPromises = adminSteps.map((step) =>
        executeStep(adminContext, step, timeoutMs).then((event) => {
          allEvents.push(event);
          return event;
        }),
      );

      const studentWorkers = Array.from({ length: concurrency }, (_, workerIndex) =>
        (async () => {
          const studentBundle = createStudentSteps(workerIndex);
          const studentContext = await createApiContext(baseURL, studentBundle.session);

          try {
            for (const step of studentBundle.steps) {
              const event = await executeStep(studentContext, step, timeoutMs);
              allEvents.push(event);
            }
          } finally {
            await studentContext.dispose();
          }
        })(),
      );

      await Promise.all([...adminPromises, ...studentWorkers]);

      if (iteration < iterations - 1) {
        await sleep(delayMs);
      }
    }
  } finally {
    await adminContext.dispose();
  }

  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    baseURL,
    concurrency,
    iterations,
    totalRequests: allEvents.length,
    failedRequests: allEvents.filter((event) => !event.ok).length,
    steps: summarizeEvents(allEvents),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (outPath) {
    const resolvedOutPath = path.resolve(outPath);
    await fs.mkdir(path.dirname(resolvedOutPath), { recursive: true });
    await fs.writeFile(resolvedOutPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }

  if (summary.failedRequests > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.stack || error.message : String(error),
  );
  process.exitCode = 1;
});
