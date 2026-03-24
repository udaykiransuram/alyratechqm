#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { request } from '@playwright/test';

const args = Object.fromEntries(
  process.argv.slice(2).map((entry) => {
    const normalized = String(entry || '').replace(/^--/, '');
    const [key, ...rest] = normalized.split('=');
    return [key, rest.length ? rest.join('=') : 'true'];
  }),
);

function printHelp() {
  console.log(
    [
      'Usage: npm run stress:student-tests -- --school=<schoolKey> --paper=<paperId> --students=<jsonFile> [options]',
      '',
      'Required:',
      '  --school=<schoolKey>          School key for the student accounts',
      '  --paper=<paperId>             Online paper id to exercise',
      '  --students=<jsonFile>         JSON file with students[] entries',
      '',
      'Options:',
      '  --base=<url>                  App base URL (default: http://127.0.0.1:3000)',
      '  --concurrency=<n>             Concurrent student flows (default: 5)',
      '  --rounds=<n>                  Save rounds before final submit (default: 3)',
      '  --round-delay-ms=<ms>         Delay between save rounds per student (default: 400)',
      '  --jitter-ms=<ms>              Random delay jitter added per round (default: 150)',
      '  --submit=<true|false>         Submit after save rounds (default: true)',
      '  --heartbeat=<true|false>      Hit the student heartbeat during the flow (default: true)',
      '  --timeout-ms=<ms>             Per-request timeout (default: 15000)',
      '  --out=<jsonFile>              Write JSON summary to a file',
      '  --help                        Show this help text',
      '',
      'Student file format:',
      '  See scripts/student-exam-stress.example.json',
      '',
      'Notes:',
      '  - This exercises real student exam APIs and creates or updates attempts.',
      '  - Use disposable student accounts and a disposable paper when --submit=true.',
      '  - If an account is already locked in another active session, login will fail.',
    ].join('\n'),
  );
}

function parseBoolean(value, fallback) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  throw new Error(`Invalid boolean value: ${value}`);
}

function parsePositiveInteger(value, fallback) {
  const normalized = String(value ?? '').trim();
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
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return fallback;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid non-negative integer value: ${value}`);
  }
  return Math.floor(parsed);
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

function extractMessage(payload) {
  if (payload && typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }
  if (payload && typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim();
  }
  return '';
}

function parseMaybeJson(text) {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return null;
  }
  try {
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

function getNextAuthCallbackError(baseUrl, payload) {
  const callbackUrl =
    payload && typeof payload.url === 'string' ? payload.url.trim() : '';
  if (!callbackUrl) {
    return '';
  }
  try {
    const url = new URL(callbackUrl, baseUrl);
    return String(url.searchParams.get('error') || '').trim();
  } catch {
    return '';
  }
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
      const failures = stepEvents.filter((event) => !event.ok).length;
      return {
        step,
        count: stepEvents.length,
        failures,
        avgMs: average(durations),
        p50Ms: percentile(durations, 50),
        p95Ms: percentile(durations, 95),
        maxMs: durations.length > 0 ? Math.round(Math.max(...durations)) : null,
      };
    })
    .sort((left, right) => left.step.localeCompare(right.step));
}

async function loadStudents(filePath) {
  const resolvedPath = path.resolve(filePath);
  const raw = await fs.readFile(resolvedPath, 'utf8');
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
      entry?.identifier || entry?.rollNumber || entry?.email || '',
    ).trim();
    const password = String(entry?.password || '').trim();
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

function buildGeneratedAnswer(question, studentIndex, questionIndex) {
  const normalizedQuestionId = String(question?._id || '').trim();
  if (!normalizedQuestionId) {
    return null;
  }

  const questionType = String(question?.type || '').trim();
  const options = Array.isArray(question?.options) ? question.options : [];
  const matrixRows = Array.isArray(question?.matrixRows) ? question.matrixRows : [];
  const matrixColumns = Array.isArray(question?.matrixColumns)
    ? question.matrixColumns
    : [];
  const seed = studentIndex + questionIndex;

  if (questionType === 'single') {
    if (options.length === 0) {
      return null;
    }
    return {
      question: normalizedQuestionId,
      selectedOptions: [seed % options.length],
    };
  }

  if (questionType === 'multiple') {
    if (options.length === 0) {
      return null;
    }
    const desiredCount = Math.min(2, options.length);
    const picks = new Set();
    for (let offset = 0; offset < desiredCount; offset += 1) {
      picks.add((seed + offset) % options.length);
    }
    return {
      question: normalizedQuestionId,
      selectedOptions: Array.from(picks).sort((left, right) => left - right),
    };
  }

  if (questionType === 'descriptive') {
    return {
      question: normalizedQuestionId,
      answerText: `Stress response ${studentIndex + 1}-${questionIndex + 1}`,
    };
  }

  if (questionType === 'matrix-match') {
    if (matrixRows.length === 0 || matrixColumns.length === 0) {
      return null;
    }
    return {
      question: normalizedQuestionId,
      matrixSelections: matrixRows.map((_row, rowIndex) => [
        (seed + rowIndex) % matrixColumns.length,
      ]),
    };
  }

  return null;
}

function buildAnswerEntries(paper, studentIndex) {
  const entries = [];
  let runningQuestionIndex = 0;

  for (const section of Array.isArray(paper?.sections) ? paper.sections : []) {
    const sectionName = String(section?.name || '').trim();
    if (!sectionName) {
      continue;
    }

    for (const questionEntry of Array.isArray(section?.questions)
      ? section.questions
      : []) {
      const answer = buildGeneratedAnswer(
        questionEntry?.question || null,
        studentIndex,
        runningQuestionIndex,
      );
      runningQuestionIndex += 1;

      if (!answer) {
        continue;
      }

      entries.push({
        sectionName,
        answer,
      });
    }
  }

  return entries;
}

function buildSectionAnswersPayload(entries, round, totalRounds) {
  const cappedRound = Math.max(1, Math.min(round, totalRounds));
  const limit = Math.max(1, Math.ceil((entries.length * cappedRound) / totalRounds));
  const grouped = new Map();

  for (const entry of entries.slice(0, limit)) {
    if (!grouped.has(entry.sectionName)) {
      grouped.set(entry.sectionName, {
        sectionName: entry.sectionName,
        answers: [],
      });
    }
    grouped.get(entry.sectionName).answers.push(entry.answer);
  }

  return Array.from(grouped.values()).filter(
    (sectionAnswer) => sectionAnswer.answers.length > 0,
  );
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

    metrics.push({
      student: studentLabel,
      step,
      durationMs,
      ok:
        response.ok() &&
        !(
          data &&
          typeof data === 'object' &&
          'success' in data &&
          data.success === false
        ),
      status: response.status(),
      message: extractMessage(data),
    });

    return {
      response,
      data,
      durationMs,
      rawText: text,
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    metrics.push({
      student: studentLabel,
      step,
      durationMs,
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function ensureApiSuccess(result, fallbackMessage) {
  const apiMessage = extractMessage(result.data);
  if (!result.response.ok()) {
    throw new Error(
      apiMessage || `${fallbackMessage} (HTTP ${result.response.status()})`,
    );
  }
  if (
    result.data &&
    typeof result.data === 'object' &&
    'success' in result.data &&
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
    'auth.csrf',
    '/api/auth/csrf',
    {
      method: 'GET',
      timeoutMs,
    },
  );
  if (!response.response.ok() || !response.data?.csrfToken) {
    throw new Error(
      extractMessage(response.data) || 'Failed to obtain a CSRF token.',
    );
  }
  return String(response.data.csrfToken);
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
    'auth.signin',
    '/api/auth/callback/school-user?json=true',
    {
      method: 'POST',
      form: {
        csrfToken,
        identifier: student.identifier,
        password: student.password,
        schoolKey,
        callbackUrl: `${baseUrl}/student/tests`,
        json: 'true',
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
    'auth.session',
    '/api/auth/session',
    {
      method: 'GET',
      timeoutMs,
    },
  );

  if (!sessionResult.response.ok() || !sessionResult.data?.user?.id) {
    throw new Error('Student sign in did not produce a usable session.');
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

  const signOutResult = await runRequest(
    context,
    metrics,
    student.label,
    'auth.signout',
    '/api/auth/signout?json=true',
    {
      method: 'POST',
      form: {
        csrfToken,
        callbackUrl: `${baseUrl}/auth/signin`,
        json: 'true',
      },
      timeoutMs,
    },
  );

  if (!signOutResult.response.ok()) {
    throw new Error(
      extractMessage(signOutResult.data) ||
        `Student sign out failed (HTTP ${signOutResult.response.status()}).`,
    );
  }
}

async function heartbeatStudent(context, metrics, studentLabel, timeoutMs) {
  const result = await runRequest(
    context,
    metrics,
    studentLabel,
    'session.heartbeat',
    '/api/student/session/heartbeat',
    {
      method: 'POST',
      timeoutMs,
    },
  );

  if (!result.response.ok()) {
    throw new Error(
      extractMessage(result.data) ||
        `Student heartbeat failed (HTTP ${result.response.status()}).`,
    );
  }
}

async function runStudentFlow({
  baseUrl,
  schoolKey,
  paperId,
  student,
  studentIndex,
  rounds,
  roundDelayMs,
  jitterMs,
  submitEnabled,
  heartbeatEnabled,
  timeoutMs,
  metrics,
}) {
  const context = await request.newContext({
    baseURL: baseUrl,
    extraHTTPHeaders: {
      Accept: 'application/json',
      'x-school-key': schoolKey,
    },
    ignoreHTTPSErrors: true,
  });
  const startedAt = performance.now();
  let signedIn = false;
  let cleanupWarning = '';

  try {
    await signInStudent({
      context,
      baseUrl,
      schoolKey,
      student,
      metrics,
      timeoutMs,
    });
    signedIn = true;

    if (heartbeatEnabled) {
      await heartbeatStudent(context, metrics, student.label, timeoutMs);
    }

    const detailResult = await runRequest(
      context,
      metrics,
      student.label,
      'test.detail',
      `/api/student/tests/${paperId}`,
      {
        method: 'GET',
        timeoutMs,
      },
    );
    const detail = ensureApiSuccess(detailResult, 'Failed to load test detail.');

    if (!detail?.paper) {
      throw new Error('Test detail response did not include the paper payload.');
    }

    let attempt = detail.attempt || null;
    const currentStatus = String(detail.status || attempt?.status || '').trim();
    if (currentStatus === 'submitted' || currentStatus === 'auto_submitted') {
      throw new Error('Attempt is already submitted for this paper.');
    }

    if (!attempt?._id || !attempt?.startedAt) {
      const startResult = await runRequest(
        context,
        metrics,
        student.label,
        'test.start',
        `/api/student/tests/${paperId}/attempt`,
        {
          method: 'POST',
          timeoutMs,
        },
      );
      const startedAttempt = ensureApiSuccess(
        startResult,
        'Failed to start the online test.',
      );
      attempt = startedAttempt?.attempt || null;
      if (!attempt?._id) {
        throw new Error('Start test response did not include an attempt.');
      }
    }

    const entries = buildAnswerEntries(detail.paper, studentIndex);
    if (entries.length === 0) {
      throw new Error(
        'Could not build a valid answer payload from the online paper.',
      );
    }

    for (let round = 1; round <= rounds; round += 1) {
      const sectionAnswers = buildSectionAnswersPayload(entries, round, rounds);
      const saveResult = await runRequest(
        context,
        metrics,
        student.label,
        'test.save',
        `/api/student/tests/${paperId}/attempt`,
        {
          method: 'PATCH',
          data: { sectionAnswers },
          timeoutMs,
        },
      );
      ensureApiSuccess(saveResult, 'Failed to save the online test.');

      if (heartbeatEnabled) {
        await heartbeatStudent(context, metrics, student.label, timeoutMs);
      }

      if (round < rounds) {
        await sleep(withJitter(roundDelayMs, jitterMs));
      }
    }

    let finalStatus = String(attempt?.status || 'in_progress');
    if (submitEnabled) {
      const submitResult = await runRequest(
        context,
        metrics,
        student.label,
        'test.submit',
        `/api/student/tests/${paperId}/submit`,
        {
          method: 'POST',
          data: {
            sectionAnswers: buildSectionAnswersPayload(entries, rounds, rounds),
          },
          timeoutMs,
        },
      );
      const submittedAttempt = ensureApiSuccess(
        submitResult,
        'Failed to submit the online test.',
      );
      finalStatus = String(
        submittedAttempt?.status || submittedAttempt?.attempt?.status || 'submitted',
      );
    }

    return {
      student: student.label,
      identifier: student.identifier,
      ok: true,
      status: finalStatus,
      cleanupWarning: '',
      totalDurationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    return {
      student: student.label,
      identifier: student.identifier,
      ok: false,
      status: 'failed',
      cleanupWarning: '',
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
      } catch (error) {
        cleanupWarning =
          error instanceof Error ? error.message : String(error);
      }
    }

    await context.dispose().catch(() => undefined);

    if (cleanupWarning) {
      metrics.push({
        student: student.label,
        step: 'auth.cleanup-warning',
        durationMs: 0,
        ok: false,
        status: 0,
        message: cleanupWarning,
      });
    }
  }
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}

async function main() {
  if (args.help === 'true' || args.h === 'true') {
    printHelp();
    return;
  }

  const baseUrl = String(args.base || 'http://127.0.0.1:3000').replace(/\/$/, '');
  const schoolKey = String(args.school || '').trim().toLowerCase();
  const paperId = String(args.paper || '').trim();
  const studentsFile = String(args.students || '').trim();
  const concurrency = parsePositiveInteger(args.concurrency, 5);
  const rounds = parsePositiveInteger(args.rounds, 3);
  const roundDelayMs = parseNonNegativeInteger(args['round-delay-ms'], 400);
  const jitterMs = parseNonNegativeInteger(args['jitter-ms'], 150);
  const submitEnabled = parseBoolean(args.submit, true);
  const heartbeatEnabled = parseBoolean(args.heartbeat, true);
  const timeoutMs = parsePositiveInteger(args['timeout-ms'], 15_000);
  const outputPath = String(args.out || '').trim();

  if (!schoolKey || !paperId || !studentsFile) {
    printHelp();
    throw new Error('Missing required --school, --paper, or --students argument.');
  }

  const students = await loadStudents(studentsFile);
  if (students.length === 0) {
    throw new Error('Student list is empty.');
  }

  const metrics = [];
  const startedAt = performance.now();

  console.log(
    [
      `Student exam stress run started`,
      `  base: ${baseUrl}`,
      `  school: ${schoolKey}`,
      `  paper: ${paperId}`,
      `  students: ${students.length}`,
      `  concurrency: ${Math.min(concurrency, students.length)}`,
      `  rounds: ${rounds}`,
      `  submit: ${submitEnabled ? 'yes' : 'no'}`,
      `  heartbeat: ${heartbeatEnabled ? 'yes' : 'no'}`,
    ].join('\n'),
  );

  const results = await runWithConcurrency(
    students,
    concurrency,
    async (student, studentIndex) =>
      runStudentFlow({
        baseUrl,
        schoolKey,
        paperId,
        student,
        studentIndex,
        rounds,
        roundDelayMs,
        jitterMs,
        submitEnabled,
        heartbeatEnabled,
        timeoutMs,
        metrics,
      }),
  );

  const totalDurationMs = Math.round(performance.now() - startedAt);
  const succeeded = results.filter((result) => result?.ok);
  const failed = results.filter((result) => !result?.ok);
  const cleanupWarnings = metrics.filter(
    (event) => event.step === 'auth.cleanup-warning',
  );
  const requestSummary = summarizeRequestEvents(metrics);
  const summary = {
    students: students.length,
    succeeded: succeeded.length,
    failed: failed.length,
    cleanupWarnings: cleanupWarnings.length,
    totalDurationMs,
  };

  console.log('\nFlow summary');
  console.table([summary]);

  console.log('\nRequest latency summary');
  console.table(requestSummary);

  if (failed.length > 0) {
    console.log('\nFailed students');
    console.table(
      failed.map((result) => ({
        student: result.student,
        identifier: result.identifier,
        error: result.error,
        totalDurationMs: result.totalDurationMs,
      })),
    );
  }

  if (cleanupWarnings.length > 0) {
    console.log('\nCleanup warnings');
    console.table(
      cleanupWarnings.map((event) => ({
        student: event.student,
        message: event.message,
      })),
    );
  }

  if (outputPath) {
    const resolvedPath = path.resolve(outputPath);
    await fs.writeFile(
      resolvedPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          config: {
            baseUrl,
            schoolKey,
            paperId,
            students: students.length,
            concurrency: Math.min(concurrency, students.length),
            rounds,
            roundDelayMs,
            jitterMs,
            submitEnabled,
            heartbeatEnabled,
            timeoutMs,
          },
          summary,
          requestSummary,
          results,
        },
        null,
        2,
      ),
      'utf8',
    );
    console.log(`\nJSON summary written to ${resolvedPath}`);
  }

  if (failed.length > 0 || cleanupWarnings.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
