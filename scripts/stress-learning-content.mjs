#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { request } from "@playwright/test";

const args = Object.fromEntries(
  process.argv.slice(2).map((entry) => {
    const normalized = String(entry || "").replace(/^--/, "");
    const [key, ...rest] = normalized.split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }),
);

function printHelp() {
  console.log(
    [
      "Usage: npm run stress:learning-content -- --meta=<jsonFile> [options]",
      "",
      "Required:",
      "  --meta=<jsonFile>            Metadata file created by gate:learning-content:seed",
      "",
      "Options:",
      "  --base=<url>                 App base URL (default: http://127.0.0.1:3000)",
      "  --concurrency=<n>            Concurrent student flows (default: 40)",
      "  --rounds=<n>                 Course/diary interaction rounds per student (default: 2)",
      "  --delay-ms=<ms>              Delay between rounds per student (default: 150)",
      "  --jitter-ms=<ms>             Random round delay jitter (default: 75)",
      "  --timeout-ms=<ms>            Per-request timeout (default: 15000)",
      "  --out=<jsonFile>             Write JSON summary to a file",
      "  --help                       Show this help text",
      "",
      "Notes:",
      "  - This script signs real students in and hits the actual dashboard/course/diary/notification routes.",
      "  - Use data created by gate:learning-content:seed so the writes are disposable.",
    ].join("\n"),
  );
}

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

function parseNonNegativeInteger(value, fallback) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return fallback;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid non-negative integer value: ${value}`);
  }
  return Math.floor(parsed);
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "http://127.0.0.1:3000";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/$/, "");
  }
  return `http://${trimmed.replace(/\/$/, "")}`;
}

function sleep(ms) {
  if (!ms || ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function withJitter(baseMs, jitterMs) {
  if (!jitterMs) {
    return baseMs;
  }
  return baseMs + Math.floor(Math.random() * (jitterMs + 1));
}

function percentile(values, percentileValue) {
  if (!Array.isArray(values) || values.length === 0) {
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
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

function parseMaybeJson(text) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return null;
  }

  try {
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

function extractMessage(payload) {
  if (payload && typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  if (payload && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  return "";
}

function summarizeRequestEvents(events) {
  const grouped = new Map();

  for (const event of events) {
    if (!grouped.has(event.step)) {
      grouped.set(event.step, []);
    }
    grouped.get(event.step).push(event);
  }

  return Array.from(grouped.entries())
    .map(([step, stepEvents]) => {
      const durations = stepEvents.map((event) => event.durationMs);
      const failures = stepEvents.filter((event) => !event.ok);
      return {
        step,
        count: stepEvents.length,
        failures: failures.length,
        avgMs: average(durations),
        p50Ms: percentile(durations, 50),
        p95Ms: percentile(durations, 95),
        p99Ms: percentile(durations, 99),
        maxMs: durations.length > 0 ? Math.round(Math.max(...durations)) : null,
        sampleFailure: failures[0]
          ? {
              status: failures[0].status,
              message: failures[0].message,
            }
          : null,
      };
    })
    .sort((left, right) => left.step.localeCompare(right.step));
}

async function loadMeta(filePath) {
  const resolvedPath = path.resolve(filePath);
  const raw = await fs.readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw);
  const studentsFile = String(parsed?.studentsFile || "").trim();
  const courseProgress = parsed?.courseProgress || {};

  if (
    !parsed?.schoolKey ||
    !parsed?.courseId ||
    !parsed?.diaryEntryId ||
    !studentsFile ||
    !courseProgress?.viewedBlockId ||
    !courseProgress?.completedBlockId ||
    !courseProgress?.bookmarkedBlockId ||
    !courseProgress?.noteBlockId
  ) {
    throw new Error(
      `Invalid learning-content metadata file: ${resolvedPath}`,
    );
  }

  return {
    resolvedPath,
    schoolKey: String(parsed.schoolKey),
    courseId: String(parsed.courseId),
    diaryEntryId: String(parsed.diaryEntryId),
    studentsFile: path.isAbsolute(studentsFile)
      ? studentsFile
      : path.resolve(path.dirname(resolvedPath), studentsFile),
    courseProgress: {
      viewedBlockId: String(courseProgress.viewedBlockId),
      completedBlockId: String(courseProgress.completedBlockId),
      bookmarkedBlockId: String(courseProgress.bookmarkedBlockId),
      noteBlockId: String(courseProgress.noteBlockId),
    },
  };
}

async function loadStudents(filePath) {
  const resolvedPath = path.resolve(filePath);
  const raw = await fs.readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw);
  const source = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.students)
      ? parsed.students
      : null;

  if (!source) {
    throw new Error(
      `Student file must be an array or an object with a students array: ${resolvedPath}`,
    );
  }

  return source.map((entry, index) => {
    const identifier = String(
      entry?.identifier || entry?.rollNumber || entry?.email || "",
    ).trim();
    const password = String(entry?.password || "").trim();
    const label = String(
      entry?.label || entry?.name || identifier || `student-${index + 1}`,
    ).trim();

    if (!identifier || !password) {
      throw new Error(
        `Student entry ${index + 1} in ${resolvedPath} is missing identifier or password.`,
      );
    }

    return {
      identifier,
      password,
      label,
    };
  });
}

async function runRequest(context, metrics, studentLabel, step, url, options = {}) {
  const startedAt = performance.now();
  const { timeoutMs, ...requestOptions } = options;

  try {
    const response = await context.fetch(url, {
      failOnStatusCode: false,
      timeout: timeoutMs,
      ...requestOptions,
    });
    const durationMs = Math.round(performance.now() - startedAt);
    const text = await response.text();
    const data = parseMaybeJson(text);

    if (Array.isArray(metrics)) {
      metrics.push({
        student: studentLabel,
        step,
        durationMs,
        ok:
          response.ok() &&
          !(
            data &&
            typeof data === "object" &&
            "success" in data &&
            data.success === false
          ),
        status: response.status(),
        message: extractMessage(data),
      });
    }

    return {
      response,
      data,
      durationMs,
      rawText: text,
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    if (Array.isArray(metrics)) {
      metrics.push({
        student: studentLabel,
        step,
        durationMs,
        ok: false,
        status: 0,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}

function ensureRequestSuccess(result, fallbackMessage) {
  const apiMessage = extractMessage(result.data);
  if (!result.response.ok()) {
    throw new Error(
      apiMessage || `${fallbackMessage} (HTTP ${result.response.status()})`,
    );
  }
  if (
    result.data &&
    typeof result.data === "object" &&
    "success" in result.data &&
    result.data.success === false
  ) {
    throw new Error(apiMessage || fallbackMessage);
  }
  return result.data;
}

async function fetchCsrfToken(context, metrics, studentLabel, timeoutMs) {
  const response = await runRequest(
    context,
    metrics,
    studentLabel,
    "auth.csrf",
    "/api/auth/csrf",
    {
      method: "GET",
      timeoutMs,
    },
  );

  if (!response.response.ok() || !response.data?.csrfToken) {
    throw new Error(
      extractMessage(response.data) || "Failed to obtain a CSRF token.",
    );
  }

  return String(response.data.csrfToken);
}

function getNextAuthCallbackError(baseUrl, payload) {
  const callbackUrl =
    payload && typeof payload.url === "string" ? payload.url.trim() : "";
  if (!callbackUrl) {
    return "";
  }
  try {
    const url = new URL(callbackUrl, baseUrl);
    return String(url.searchParams.get("error") || "").trim();
  } catch {
    return "";
  }
}

async function signInStudent({
  context,
  baseUrl,
  schoolKey,
  student,
  metrics,
  timeoutMs,
}) {
  const csrfToken = await fetchCsrfToken(
    context,
    metrics,
    student.label,
    timeoutMs,
  );

  const signInResult = await runRequest(
    context,
    metrics,
    student.label,
    "auth.signin",
    "/api/auth/callback/school-user?json=true",
    {
      method: "POST",
      form: {
        csrfToken,
        identifier: student.identifier,
        password: student.password,
        schoolKey,
        callbackUrl: `${baseUrl}/student`,
        json: "true",
      },
      timeoutMs,
    },
  );

  if (!signInResult.response.ok()) {
    throw new Error(
      extractMessage(signInResult.data) ||
        `Student sign in failed (HTTP ${signInResult.response.status()}).`,
    );
  }

  const callbackError = getNextAuthCallbackError(baseUrl, signInResult.data);
  if (callbackError) {
    throw new Error(`Student sign in failed: ${callbackError}`);
  }

  const sessionResult = await runRequest(
    context,
    metrics,
    student.label,
    "auth.session",
    "/api/auth/session",
    {
      method: "GET",
      timeoutMs,
    },
  );

  if (!sessionResult.response.ok() || !sessionResult.data?.user?.id) {
    throw new Error("Student sign in did not produce a usable session.");
  }

  return sessionResult.data;
}

async function signOutStudent({
  context,
  baseUrl,
  student,
  metrics,
  timeoutMs,
}) {
  const csrfToken = await fetchCsrfToken(
    context,
    metrics,
    student.label,
    timeoutMs,
  );

  await runRequest(
    context,
    metrics,
    student.label,
    "auth.signout",
    "/api/auth/signout?json=true",
    {
      method: "POST",
      form: {
        csrfToken,
        callbackUrl: `${baseUrl}/auth/signin`,
        json: "true",
      },
      timeoutMs,
    },
  );
}

function buildCourseNoteText(identifier, round) {
  return `Load gate note ${identifier} round ${round}`;
}

async function runStudentFlow({
  baseUrl,
  schoolKey,
  meta,
  student,
  rounds,
  roundDelayMs,
  jitterMs,
  timeoutMs,
  metrics,
}) {
  const context = await request.newContext({
    baseURL: baseUrl,
    extraHTTPHeaders: {
      "x-school-key": schoolKey,
    },
    ignoreHTTPSErrors: true,
  });
  const startedAt = performance.now();
  let signedIn = false;
  let session = null;

  try {
    session = await signInStudent({
      context,
      baseUrl,
      schoolKey,
      student,
      metrics,
      timeoutMs,
    });
    signedIn = true;

    for (let round = 1; round <= rounds; round += 1) {
      ensureRequestSuccess(
        await runRequest(
          context,
          metrics,
          student.label,
          "page.student.dashboard",
          "/student",
          {
            method: "GET",
            timeoutMs,
          },
        ),
        "Failed to load the student dashboard page.",
      );

      ensureRequestSuccess(
        await runRequest(
          context,
          metrics,
          student.label,
          "api.student.dashboard",
          "/api/student/dashboard",
          {
            method: "GET",
            timeoutMs,
          },
        ),
        "Failed to load the student dashboard API.",
      );

      ensureRequestSuccess(
        await runRequest(
          context,
          metrics,
          student.label,
          "page.student.courses",
          "/student/courses",
          {
            method: "GET",
            timeoutMs,
          },
        ),
        "Failed to load the student courses page.",
      );

      ensureRequestSuccess(
        await runRequest(
          context,
          metrics,
          student.label,
          "api.student.courses",
          "/api/student/courses",
          {
            method: "GET",
            timeoutMs,
          },
        ),
        "Failed to load the student courses API.",
      );

      ensureRequestSuccess(
        await runRequest(
          context,
          metrics,
          student.label,
          "api.student.course.detail",
          `/api/student/courses/${meta.courseId}`,
          {
            method: "GET",
            timeoutMs,
          },
        ),
        "Failed to load the student course detail API.",
      );

      ensureRequestSuccess(
        await runRequest(
          context,
          metrics,
          student.label,
          "api.student.course.progress",
          `/api/student/courses/${meta.courseId}/progress`,
          {
            method: "PATCH",
            data: {
              lastViewedBlockId: meta.courseProgress.viewedBlockId,
              viewedBlockId: meta.courseProgress.viewedBlockId,
              completedBlockId: meta.courseProgress.completedBlockId,
              completed: true,
              bookmarkedBlockId: meta.courseProgress.bookmarkedBlockId,
              bookmarked: true,
              note: {
                blockId: meta.courseProgress.noteBlockId,
                text: buildCourseNoteText(student.identifier, round),
              },
            },
            timeoutMs,
          },
        ),
        "Failed to update student course progress.",
      );

      ensureRequestSuccess(
        await runRequest(
          context,
          metrics,
          student.label,
          "page.student.diary",
          "/student/diary",
          {
            method: "GET",
            timeoutMs,
          },
        ),
        "Failed to load the student diary page.",
      );

      ensureRequestSuccess(
        await runRequest(
          context,
          metrics,
          student.label,
          "api.student.diary",
          "/api/student/diary",
          {
            method: "GET",
            timeoutMs,
          },
        ),
        "Failed to load the student diary API.",
      );

      ensureRequestSuccess(
        await runRequest(
          context,
          metrics,
          student.label,
          "api.student.diary.detail",
          `/api/student/diary/${meta.diaryEntryId}`,
          {
            method: "GET",
            timeoutMs,
          },
        ),
        "Failed to load the student diary detail API.",
      );

      ensureRequestSuccess(
        await runRequest(
          context,
          metrics,
          student.label,
          "api.student.diary.state",
          `/api/student/diary/${meta.diaryEntryId}/state`,
          {
            method: "PATCH",
            data: {
              markSeen: true,
              markCompleted: true,
            },
            timeoutMs,
          },
        ),
        "Failed to update student diary state.",
      );

      ensureRequestSuccess(
        await runRequest(
          context,
          metrics,
          student.label,
          "api.student.notifications",
          "/api/student/notifications",
          {
            method: "GET",
            timeoutMs,
          },
        ),
        "Failed to load student notifications.",
      );

      if (round < rounds) {
        await sleep(withJitter(roundDelayMs, jitterMs));
      }
    }

    const totalDurationMs = Math.round(performance.now() - startedAt);

    return {
      student: student.label,
      identifier: student.identifier,
      studentId: String(session?.user?.id || ""),
      ok: true,
      totalDurationMs,
    };
  } catch (error) {
    return {
      student: student.label,
      identifier: student.identifier,
      studentId: String(session?.user?.id || ""),
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      totalDurationMs: Math.round(performance.now() - startedAt),
    };
  } finally {
    if (signedIn) {
      try {
        await signOutStudent({
          context,
          baseUrl,
          student,
          metrics,
          timeoutMs,
        });
      } catch {}
    }

    await context.dispose().catch(() => undefined);
  }
}

async function main() {
  if (args.help === "true") {
    printHelp();
    return;
  }

  const metaFile = String(args.meta || "").trim();
  if (!metaFile) {
    throw new Error("Missing required --meta argument.");
  }

  const baseUrl = normalizeBaseUrl(args.base || process.env.BASE_URL);
  const concurrency = parsePositiveInteger(args.concurrency, 40);
  const rounds = parsePositiveInteger(args.rounds, 2);
  const roundDelayMs = parseNonNegativeInteger(args["delay-ms"], 150);
  const jitterMs = parseNonNegativeInteger(args["jitter-ms"], 75);
  const timeoutMs = parsePositiveInteger(args["timeout-ms"], 15_000);
  const outPath = String(args.out || "").trim();
  const meta = await loadMeta(metaFile);
  const students = await loadStudents(meta.studentsFile);
  const startedAt = performance.now();
  const requestEvents = [];
  const results = new Array(students.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, students.length) },
    async () => {
      while (true) {
        const currentIndex = cursor;
        cursor += 1;
        if (currentIndex >= students.length) {
          return;
        }

        results[currentIndex] = await runStudentFlow({
          baseUrl,
          schoolKey: meta.schoolKey,
          meta,
          student: students[currentIndex],
          rounds,
          roundDelayMs,
          jitterMs,
          timeoutMs,
          metrics: requestEvents,
        });
      }
    },
  );

  await Promise.all(workers);

  const totalDurationMs = Math.round(performance.now() - startedAt);
  const normalizedResults = results.filter(Boolean);
  const succeeded = normalizedResults.filter((result) => result.ok).length;
  const failed = normalizedResults.length - succeeded;
  const output = {
    generatedAt: new Date().toISOString(),
    config: {
      baseUrl,
      concurrency,
      rounds,
      roundDelayMs,
      jitterMs,
      timeoutMs,
      metaFile: meta.resolvedPath,
      schoolKey: meta.schoolKey,
      courseId: meta.courseId,
      diaryEntryId: meta.diaryEntryId,
    },
    summary: {
      students: normalizedResults.length,
      succeeded,
      failed,
      totalDurationMs,
    },
    requestSummary: summarizeRequestEvents(requestEvents),
    results: normalizedResults,
  };

  if (outPath) {
    const resolvedOutPath = path.resolve(outPath);
    await fs.mkdir(path.dirname(resolvedOutPath), { recursive: true });
    await fs.writeFile(resolvedOutPath, JSON.stringify(output, null, 2), "utf8");
    console.log(`[stress-learning-content] wrote ${resolvedOutPath}`);
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
