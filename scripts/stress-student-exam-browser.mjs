#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { chromium, request } from '@playwright/test';

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
      'Usage: npm run stress:student-tests:browser -- --school=<schoolKey> --paper=<paperId> --students=<jsonFile> [options]',
      '',
      'Required:',
      '  --school=<schoolKey>              School key for the student accounts',
      '  --paper=<paperId>                 Online paper id to exercise',
      '  --students=<jsonFile>             JSON file with students[] entries',
      '',
      'Options:',
      '  --base=<url>                      App base URL (default: http://localhost:3000)',
      '  --concurrency=<n>                 Concurrent browser student flows (default: 10)',
      '  --rounds=<n>                      Answer/save rounds before submit (default: 3)',
      '  --round-delay-ms=<ms>             Delay between save rounds per student (default: 400)',
      '  --jitter-ms=<ms>                  Random delay jitter added per round (default: 150)',
      '  --navigation-timeout-ms=<ms>      Page navigation timeout (default: 30000)',
      '  --action-timeout-ms=<ms>          UI action timeout (default: 15000)',
      '  --headless=<true|false>           Launch Chromium in headless mode (default: true)',
      '  --submit=<true|false>             Submit after save rounds (default: true)',
      '  --warmup=<true|false>             Prewarm sign-in/list/detail routes before measuring (default: true)',
      '  --out=<jsonFile>                  Write JSON summary to a file',
      '  --help                            Show this help text',
      '',
      'Student file format:',
      '  See scripts/student-exam-stress.example.json',
      '',
      'Notes:',
      '  - This is a real browser/UI harness that signs in through /auth/signin and uses the student test pages.',
      '  - Each concurrent student flow gets an isolated browser context.',
      '  - Use disposable student accounts and a disposable paper when --submit=true.',
      '  - This script is much heavier than the API harness; start with lower concurrency if your machine is constrained.',
    ].join('\n'),
  );
}

function normalizeBaseUrl(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return 'http://localhost:3000';
  }

  const withScheme = /^https?:\/\//i.test(normalized)
    ? normalized
    : `http://${normalized}`;

  try {
    const parsed = new URL(withScheme);
    const hostname = String(parsed.hostname || '').trim().toLowerCase();
    if (
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1'
    ) {
      parsed.hostname = 'localhost';
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return withScheme.replace(/\/$/, '');
  }
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

function extractMessage(payload) {
  if (payload && typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }
  if (payload && typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim();
  }
  return '';
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

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

function buildSignInUrl(baseUrl) {
  const url = new URL('/auth/signin', baseUrl);
  url.searchParams.set('callbackUrl', new URL('/student/tests', baseUrl).toString());
  return url.toString();
}

function buildSchoolDisplayName(schoolKey) {
  const normalizedSchoolKey = String(schoolKey || '').trim();
  if (!normalizedSchoolKey) {
    return '';
  }
  return `Online Test Readiness ${normalizedSchoolKey}`;
}

function ensureNoPageErrors(pageErrors) {
  if (!Array.isArray(pageErrors) || pageErrors.length === 0) {
    return;
  }
  throw new Error(`Browser runtime error: ${pageErrors[0]}`);
}

async function waitForEnabled(locator, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const visible = await locator.isVisible().catch(() => false);
    const enabled = visible ? await locator.isEnabled().catch(() => false) : false;
    if (visible && enabled) {
      return;
    }
    await sleep(100);
  }

  throw new Error(`${label} did not become enabled within ${timeoutMs}ms.`);
}

async function waitForAnyVisible(candidates, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }
    await sleep(100);
  }

  throw new Error(`${label} did not become visible within ${timeoutMs}ms.`);
}

async function getVisibleAlertMessage(page) {
  const alerts = page.getByRole('alert');
  const count = await alerts.count().catch(() => 0);

  for (let index = 0; index < count; index += 1) {
    const alert = alerts.nth(index);
    const visible = await alert.isVisible().catch(() => false);
    if (!visible) {
      continue;
    }

    const text = String((await alert.textContent().catch(() => '')) || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) {
      return text;
    }
  }

  return '';
}

async function waitForSignInClientReady(page, timeoutMs) {
  const readyMarker = page.locator(
    'form[data-school-signin-ready="true"]',
  ).first();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const alertMessage = await getVisibleAlertMessage(page);
    if (alertMessage) {
      throw new Error(alertMessage);
    }

    if (await readyMarker.isVisible().catch(() => false)) {
      return;
    }

    await sleep(100);
  }

  throw new Error(
    `The school sign-in form did not finish client hydration within ${timeoutMs}ms.`,
  );
}

async function waitForStatusText(page, predicate, timeoutMs) {
  const statusChip = page
    .locator('.app-exam-focus-topbar-meta .app-meta-chip')
    .filter({ hasText: 'Status ' })
    .first();
  const deadline = Date.now() + timeoutMs;
  let latestText = '';

  while (Date.now() < deadline) {
    latestText = String((await statusChip.textContent().catch(() => '')) || '').trim();
    if (latestText && predicate(latestText)) {
      return latestText;
    }
    await sleep(100);
  }

  throw new Error(
    `Exam status did not reach the expected state within ${timeoutMs}ms. Last status: ${latestText || 'Unavailable'}.`,
  );
}

async function setSchoolCookies(context, baseUrl, schoolKey, schoolDisplayName) {
  const cookies = [
    {
      name: 'schoolKey',
      value: String(schoolKey || '').trim(),
      url: baseUrl,
    },
  ];

  const normalizedDisplayName = String(schoolDisplayName || '').trim();
  if (normalizedDisplayName) {
    cookies.push({
      name: 'schoolDisplayName',
      value: normalizedDisplayName,
      url: baseUrl,
    });
  }

  await context.addCookies(cookies);
}

async function maybeSelectSchoolManually(page, schoolKey, schoolDisplayName, timeoutMs) {
  const chooseSchoolCopy = page.getByText(/Choose the school first/i).first();
  const needsManualSelection = await chooseSchoolCopy.isVisible().catch(() => false);
  if (!needsManualSelection) {
    return;
  }

  const combobox = page.getByRole('combobox').first();
  await combobox.click();

  const searchInput = page.getByPlaceholder('Search schools...').first();
  await searchInput.waitFor({ state: 'visible', timeout: timeoutMs });

  const preferredText = String(schoolDisplayName || schoolKey || '').trim();
  if (preferredText) {
    await searchInput.fill(preferredText);
  }

  const optionCandidates = [
    page.locator('[cmdk-item]').filter({ hasText: preferredText }).first(),
    page.getByText(preferredText, { exact: false }).last(),
  ];
  const option = await waitForAnyVisible(
    optionCandidates,
    timeoutMs,
    'The requested school option',
  );
  await option.click();
  await page.getByText(/Signing in to/i).first().waitFor({
    state: 'visible',
    timeout: timeoutMs,
  });
}

async function runMeasuredStep(metrics, studentLabel, step, fn) {
  const startedAt = performance.now();

  try {
    const details = (await fn()) || {};
    const durationMs = Math.round(performance.now() - startedAt);

    if (Array.isArray(metrics)) {
      metrics.push({
        student: studentLabel,
        step,
        durationMs,
        ok: true,
        status: Number(details?.status || 200),
        message: String(details?.message || ''),
      });
    }

    return details;
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

async function cleanupStudentSession({
  baseUrl,
  schoolKey,
  storageState,
  timeoutMs,
}) {
  const apiContext = await request.newContext({
    baseURL: baseUrl,
    storageState,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      Accept: 'application/json',
      'x-school-key': schoolKey,
    },
  });

  try {
    const csrfResponse = await apiContext.fetch('/api/auth/csrf', {
      method: 'GET',
      timeout: timeoutMs,
      failOnStatusCode: false,
    });
    const csrfText = await csrfResponse.text();
    const csrfData = parseMaybeJson(csrfText);
    const csrfToken = String(csrfData?.csrfToken || '').trim();

    if (!csrfResponse.ok() || !csrfToken) {
      throw new Error(
        extractMessage(csrfData) || 'Failed to obtain a CSRF token for sign out.',
      );
    }

    const signOutResponse = await apiContext.fetch('/api/auth/signout?json=true', {
      method: 'POST',
      timeout: timeoutMs,
      failOnStatusCode: false,
      form: {
        csrfToken,
        callbackUrl: `${baseUrl}/auth/signin`,
        json: 'true',
      },
    });
    const signOutText = await signOutResponse.text();
    const signOutData = parseMaybeJson(signOutText);

    if (!signOutResponse.ok()) {
      throw new Error(
        extractMessage(signOutData) ||
          `Student sign out failed (HTTP ${signOutResponse.status()}).`,
      );
    }
  } finally {
    await apiContext.dispose().catch(() => undefined);
  }
}

async function loadSignInPage({
  page,
  baseUrl,
  schoolKey,
  schoolDisplayName,
  studentLabel,
  metrics,
  navigationTimeoutMs,
  actionTimeoutMs,
  pageErrors,
}) {
  await runMeasuredStep(metrics, studentLabel, 'ui.auth.page', async () => {
    const pageReadyTimeoutMs = Math.max(actionTimeoutMs, navigationTimeoutMs);

    await setSchoolCookies(page.context(), baseUrl, schoolKey, schoolDisplayName);
    await page.goto(buildSignInUrl(baseUrl), {
      waitUntil: 'domcontentloaded',
      timeout: navigationTimeoutMs,
    });
    await page.locator('#identifier').waitFor({
      state: 'visible',
      timeout: pageReadyTimeoutMs,
    });
    await page.locator('#password').waitFor({
      state: 'visible',
      timeout: pageReadyTimeoutMs,
    });
    await maybeSelectSchoolManually(
      page,
      schoolKey,
      schoolDisplayName,
      pageReadyTimeoutMs,
    );
    const alertMessage = await getVisibleAlertMessage(page);
    if (alertMessage) {
      throw new Error(alertMessage);
    }
    ensureNoPageErrors(pageErrors);
  });
}

async function signInStudent({
  page,
  baseUrl,
  student,
  studentLabel,
  metrics,
  navigationTimeoutMs,
  actionTimeoutMs,
  pageErrors,
}) {
  const testsUrlPattern = new RegExp(
    `${escapeRegex(baseUrl)}/student/tests(?:\\?|$)`,
  );
  const signInUrlPattern = new RegExp(
    `${escapeRegex(baseUrl)}/auth/signin(?:\\?|$)`,
  );

  await runMeasuredStep(metrics, studentLabel, 'ui.auth.signin', async () => {
    const signInReadyTimeoutMs = Math.max(actionTimeoutMs, navigationTimeoutMs);

    await waitForSignInClientReady(page, signInReadyTimeoutMs);

    const identifierInput = page.locator('#identifier').first();
    const passwordInput = page.locator('#password').first();
    await identifierInput.waitFor({
      state: 'visible',
      timeout: actionTimeoutMs,
    });
    await passwordInput.waitFor({
      state: 'visible',
      timeout: actionTimeoutMs,
    });
    await identifierInput.fill(student.identifier);
    await passwordInput.fill(student.password);
    const alertMessage = await getVisibleAlertMessage(page);
    if (alertMessage) {
      throw new Error(alertMessage);
    }

    const signInButton = page.getByRole('button', { name: /Sign In/i }).first();
    await waitForEnabled(signInButton, signInReadyTimeoutMs, 'The sign-in button');

    let authCallbackRequestSeen = false;
    let signInPageNavigationUrl = '';
    const requestListener = (request) => {
      if (
        request.method() === 'POST' &&
        /\/api\/auth\/callback\/school-user(?:\?|$)/.test(request.url())
      ) {
        authCallbackRequestSeen = true;
      }
    };
    const frameNavigationListener = (frame) => {
      if (frame === page.mainFrame()) {
        const nextUrl = frame.url();
        if (signInUrlPattern.test(nextUrl)) {
          signInPageNavigationUrl = nextUrl;
        }
      }
    };

    page.on('request', requestListener);
    page.on('framenavigated', frameNavigationListener);

    try {
      await signInButton.click();

      const deadline = Date.now() + navigationTimeoutMs;
      while (Date.now() < deadline) {
        const currentUrl = page.url();
        if (testsUrlPattern.test(currentUrl)) {
          await page
            .locator('[data-student-tests-client-ready="true"]')
            .first()
            .waitFor({
              state: 'attached',
              timeout: actionTimeoutMs,
            });
          ensureNoPageErrors(pageErrors);
          return;
        }

        const alertMessage = await getVisibleAlertMessage(page);
        if (alertMessage) {
          throw new Error(`Student sign in failed: ${alertMessage}`);
        }

        if (signInPageNavigationUrl && !authCallbackRequestSeen) {
          throw new Error(
            `The sign-in form fell back to a full page navigation to ${signInPageNavigationUrl}. The page was likely not hydrated before submit.`,
          );
        }

        ensureNoPageErrors(pageErrors);
        await sleep(100);
      }

      throw new Error(
        `Student sign in did not reach the tests page within ${navigationTimeoutMs}ms. Final URL: ${page.url()}`,
      );
    } finally {
      page.off('request', requestListener);
      page.off('framenavigated', frameNavigationListener);
    }
  });
}

function getTargetTestLink(page, paperId) {
  return page
    .locator(
      `a[href="/student/tests/${paperId}"], a[href$="/student/tests/${paperId}"]`,
    )
    .first();
}

async function ensureTargetTestVisible({
  page,
  paperId,
  studentLabel,
  metrics,
  actionTimeoutMs,
  pageErrors,
}) {
  await runMeasuredStep(metrics, studentLabel, 'ui.test.list', async () => {
    const targetLink = getTargetTestLink(page, paperId);
    const emptyState = page.getByText(/No online tests are assigned right now/i).first();

    try {
      await waitForAnyVisible(
        [targetLink, emptyState],
        actionTimeoutMs,
        'The target online test in the student test list',
      );
    } catch {
      throw new Error('Target online test was not visible in the student test list.');
    }

    if (await emptyState.isVisible().catch(() => false)) {
      throw new Error('Target online test was not visible in the student test list.');
    }

    if (!(await targetLink.isVisible().catch(() => false))) {
      throw new Error('Target online test was not visible in the student test list.');
    }

    ensureNoPageErrors(pageErrors);
  });
}

async function openTargetTest({
  page,
  baseUrl,
  paperId,
  studentLabel,
  metrics,
  navigationTimeoutMs,
  actionTimeoutMs,
  pageErrors,
}) {
  await runMeasuredStep(metrics, studentLabel, 'ui.test.open', async () => {
    const targetLink = getTargetTestLink(page, paperId);
    await targetLink.waitFor({ state: 'visible', timeout: actionTimeoutMs });

    await Promise.all([
      page.waitForURL(
        new RegExp(`${escapeRegex(baseUrl)}/student/tests/${escapeRegex(paperId)}(?:\\?|$)`),
        {
          timeout: navigationTimeoutMs,
        },
      ),
      targetLink.click(),
    ]);

    await waitForAnyVisible(
      [
        page.getByRole('button', { name: 'Start Test' }).first(),
        page.getByRole('button', { name: 'Save Progress' }).first(),
        page.getByText(new RegExp(`Question\\s+1\\s+of`, 'i')).first(),
      ],
      actionTimeoutMs,
      'The test detail or runner page',
    );

    ensureNoPageErrors(pageErrors);
  });
}

async function startTestIfNeeded({
  page,
  studentLabel,
  metrics,
  navigationTimeoutMs,
  actionTimeoutMs,
  pageErrors,
}) {
  await runMeasuredStep(metrics, studentLabel, 'ui.test.start', async () => {
    const saveButton = page.getByRole('button', { name: 'Save Progress' }).first();
    if (await saveButton.isVisible().catch(() => false)) {
      await waitForEnabled(saveButton, actionTimeoutMs, 'The save button');
      ensureNoPageErrors(pageErrors);
      return {
        message: 'Runner already active.',
      };
    }

    const startButton = page.getByRole('button', { name: 'Start Test' }).first();
    await startButton.waitFor({ state: 'visible', timeout: actionTimeoutMs });
    await waitForEnabled(startButton, actionTimeoutMs, 'The start button');

    await Promise.all([
      waitForAnyVisible(
        [
          saveButton,
          page.getByText(new RegExp(`Question\\s+1\\s+of`, 'i')).first(),
        ],
        navigationTimeoutMs,
        'The live test runner',
      ),
      startButton.click(),
    ]);

    await waitForEnabled(saveButton, actionTimeoutMs, 'The save button');
    ensureNoPageErrors(pageErrors);
  });
}

async function getQuestionPaletteButtons(page, actionTimeoutMs) {
  const paletteButtons = page.locator('.app-exam-palette-button');
  await paletteButtons.first().waitFor({ state: 'visible', timeout: actionTimeoutMs });
  const count = await paletteButtons.count();
  if (count <= 0) {
    throw new Error('The online test runner does not show any question buttons.');
  }
  return paletteButtons;
}

async function jumpToQuestion(page, index, actionTimeoutMs) {
  const paletteButtons = await getQuestionPaletteButtons(page, actionTimeoutMs);
  const activeButton = page.locator('.app-exam-palette-button-active').first();
  const activeText = String((await activeButton.textContent().catch(() => '')) || '').trim();
  if (activeText === String(index + 1)) {
    return;
  }

  await paletteButtons.nth(index).click();

  const deadline = Date.now() + actionTimeoutMs;
  while (Date.now() < deadline) {
    const nextActiveText = String(
      (await activeButton.textContent().catch(() => '')) || '',
    ).trim();
    if (nextActiveText === String(index + 1)) {
      return;
    }
    await sleep(100);
  }

  throw new Error(`Question ${index + 1} did not become active within ${actionTimeoutMs}ms.`);
}

async function answerOptionQuestion(page, studentIndex, roundIndex) {
  const optionLabels = page.locator('label.app-exam-option');
  const optionCount = await optionLabels.count();
  if (optionCount <= 0) {
    throw new Error('Expected visible answer options in the runner.');
  }

  const optionStates = [];
  for (let index = 0; index < optionCount; index += 1) {
    const input = optionLabels.nth(index).locator('input').first();
    optionStates.push({
      index,
      type: String((await input.getAttribute('type').catch(() => '')) || '').trim(),
      checked: await input.isChecked().catch(() => false),
    });
  }

  const inputType = optionStates[0]?.type || 'radio';
  if (inputType === 'radio') {
    let targetIndex = (studentIndex + roundIndex) % optionCount;
    if (optionStates[targetIndex]?.checked && optionCount > 1) {
      targetIndex = (targetIndex + 1) % optionCount;
    }
    await optionLabels.nth(targetIndex).click();
    return;
  }

  let desiredIndexes = Array.from(
    new Set(
      Array.from({ length: Math.min(2, optionCount) }, (_item, offset) => {
        return (studentIndex + roundIndex + offset) % optionCount;
      }),
    ),
  ).sort((left, right) => left - right);

  const currentIndexes = optionStates
    .filter((option) => option.checked)
    .map((option) => option.index)
    .sort((left, right) => left - right);

  if (
    desiredIndexes.length === currentIndexes.length &&
    desiredIndexes.every((value, index) => value === currentIndexes[index]) &&
    optionCount > 1
  ) {
    desiredIndexes = desiredIndexes
      .map((value) => (value + 1) % optionCount)
      .sort((left, right) => left - right);
  }

  const desiredSet = new Set(desiredIndexes);
  for (const option of optionStates) {
    const shouldBeChecked = desiredSet.has(option.index);
    if (shouldBeChecked !== option.checked) {
      await optionLabels.nth(option.index).click();
    }
  }
}

async function answerDescriptiveQuestion(page, studentIndex, roundIndex) {
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ state: 'visible', timeout: 5000 });
  const nextValue = `Stress response ${studentIndex + 1}-${roundIndex + 1}`;
  await textarea.fill(nextValue);
}

async function answerMatrixQuestion(page, studentIndex, roundIndex) {
  const rows = page.locator('table tbody tr');
  const rowCount = await rows.count();
  if (rowCount <= 0) {
    throw new Error('Expected visible matrix rows in the runner.');
  }

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = rows.nth(rowIndex);
    const checkboxes = row.locator('input[type="checkbox"]');
    const columnCount = await checkboxes.count();
    if (columnCount <= 0) {
      continue;
    }

    let targetIndex = (studentIndex + roundIndex + rowIndex) % columnCount;
    const currentlyChecked = [];
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      if (await checkboxes.nth(columnIndex).isChecked().catch(() => false)) {
        currentlyChecked.push(columnIndex);
      }
    }

    if (currentlyChecked.length === 1 && currentlyChecked[0] === targetIndex && columnCount > 1) {
      targetIndex = (targetIndex + 1) % columnCount;
    }

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const checkbox = checkboxes.nth(columnIndex);
      const checked = await checkbox.isChecked().catch(() => false);
      const shouldBeChecked = columnIndex === targetIndex;
      if (checked !== shouldBeChecked) {
        await checkbox.click();
      }
    }
  }
}

async function answerCurrentQuestion(page, studentIndex, roundIndex, actionTimeoutMs) {
  await waitForAnyVisible(
    [
      page.locator('label.app-exam-option').first(),
      page.locator('textarea').first(),
      page.locator('table tbody tr').first(),
    ],
    actionTimeoutMs,
    'A supported question input',
  );

  const optionLabel = page.locator('label.app-exam-option').first();
  if (await optionLabel.isVisible().catch(() => false)) {
    await answerOptionQuestion(page, studentIndex, roundIndex);
    return;
  }

  const textarea = page.locator('textarea').first();
  if (await textarea.isVisible().catch(() => false)) {
    await answerDescriptiveQuestion(page, studentIndex, roundIndex);
    return;
  }

  const matrixRow = page.locator('table tbody tr').first();
  if (await matrixRow.isVisible().catch(() => false)) {
    await answerMatrixQuestion(page, studentIndex, roundIndex);
    return;
  }

  throw new Error('The current question type is not supported by the browser stress harness.');
}

async function saveCurrentProgress({
  page,
  studentLabel,
  metrics,
  actionTimeoutMs,
  pageErrors,
}) {
  await runMeasuredStep(metrics, studentLabel, 'ui.test.save', async () => {
    const saveButton = page.getByRole('button', { name: 'Save Progress' }).first();
    await waitForEnabled(saveButton, actionTimeoutMs, 'The save button');
    await saveButton.click();

    await waitForStatusText(
      page,
      (statusText) => /^Status Saved\b/i.test(statusText),
      actionTimeoutMs,
    );
    await waitForEnabled(saveButton, actionTimeoutMs, 'The save button');
    ensureNoPageErrors(pageErrors);
  });
}

async function submitTest({
  page,
  baseUrl,
  studentLabel,
  metrics,
  navigationTimeoutMs,
  actionTimeoutMs,
  pageErrors,
}) {
  await runMeasuredStep(metrics, studentLabel, 'ui.test.submit', async () => {
    const submitButton = page.getByRole('button', { name: 'Submit Test' }).first();
    await waitForEnabled(submitButton, actionTimeoutMs, 'The submit button');
    await submitButton.click();

    const confirmButton = page.getByRole('button', { name: 'Confirm Submit' }).first();
    await confirmButton.waitFor({ state: 'visible', timeout: actionTimeoutMs });

    await Promise.all([
      page.waitForURL(
        new RegExp(`${escapeRegex(baseUrl)}/student/tests(?:\\?submitted=1)?(?:#.*)?$`),
        {
          timeout: navigationTimeoutMs,
        },
      ),
      confirmButton.click(),
    ]);

    await waitForAnyVisible(
      [
        page.getByText('Test submitted.').first(),
        page.getByRole('heading', { name: 'Tests' }).first(),
      ],
      actionTimeoutMs,
      'The submission success state on the tests page',
    );
    ensureNoPageErrors(pageErrors);
  });
}

async function prewarmBrowserRoutes({
  browser,
  baseUrl,
  schoolKey,
  schoolDisplayName,
  paperId,
  student,
  navigationTimeoutMs,
  actionTimeoutMs,
}) {
  console.log('\nPrewarming auth and online-test browser routes (not measured)...');

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      'x-school-key': schoolKey,
    },
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(navigationTimeoutMs);
  page.setDefaultTimeout(actionTimeoutMs);

  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error instanceof Error ? error.message : String(error));
  });

  try {
    await loadSignInPage({
      page,
      baseUrl,
      schoolKey,
      schoolDisplayName,
      studentLabel: student.label,
      metrics: null,
      navigationTimeoutMs,
      actionTimeoutMs,
      pageErrors,
    });
    await signInStudent({
      page,
      baseUrl,
      student,
      studentLabel: student.label,
      metrics: null,
      navigationTimeoutMs,
      actionTimeoutMs,
      pageErrors,
    });
    await ensureTargetTestVisible({
      page,
      paperId,
      studentLabel: student.label,
      metrics: null,
      actionTimeoutMs,
      pageErrors,
    });
    await openTargetTest({
      page,
      baseUrl,
      paperId,
      studentLabel: student.label,
      metrics: null,
      navigationTimeoutMs,
      actionTimeoutMs,
      pageErrors,
    });
  } finally {
    const storageState = await context.storageState().catch(() => null);
    if (storageState) {
      await cleanupStudentSession({
        baseUrl,
        schoolKey,
        storageState,
        timeoutMs: Math.max(actionTimeoutMs, navigationTimeoutMs),
      }).catch(() => undefined);
    }
    await context.close().catch(() => undefined);
  }

  await sleep(250);
}

async function runStudentFlow({
  browser,
  baseUrl,
  schoolKey,
  schoolDisplayName,
  paperId,
  student,
  studentIndex,
  rounds,
  roundDelayMs,
  jitterMs,
  submitEnabled,
  navigationTimeoutMs,
  actionTimeoutMs,
  metrics,
}) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      'x-school-key': schoolKey,
    },
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(navigationTimeoutMs);
  page.setDefaultTimeout(actionTimeoutMs);

  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error instanceof Error ? error.message : String(error));
  });

  const startedAt = performance.now();
  let cleanupWarning = '';
  let signedIn = false;
  let result = null;

  try {
    await loadSignInPage({
      page,
      baseUrl,
      schoolKey,
      schoolDisplayName,
      studentLabel: student.label,
      metrics,
      navigationTimeoutMs,
      actionTimeoutMs,
      pageErrors,
    });
    await signInStudent({
      page,
      baseUrl,
      student,
      studentLabel: student.label,
      metrics,
      navigationTimeoutMs,
      actionTimeoutMs,
      pageErrors,
    });
    signedIn = true;

    await ensureTargetTestVisible({
      page,
      paperId,
      studentLabel: student.label,
      metrics,
      actionTimeoutMs,
      pageErrors,
    });
    await openTargetTest({
      page,
      baseUrl,
      paperId,
      studentLabel: student.label,
      metrics,
      navigationTimeoutMs,
      actionTimeoutMs,
      pageErrors,
    });
    await startTestIfNeeded({
      page,
      studentLabel: student.label,
      metrics,
      navigationTimeoutMs,
      actionTimeoutMs,
      pageErrors,
    });

    const paletteButtons = await getQuestionPaletteButtons(page, actionTimeoutMs);
    const questionCount = await paletteButtons.count();

    for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
      const targetIndex = questionCount <= 1 ? 0 : roundIndex % questionCount;
      await jumpToQuestion(page, targetIndex, actionTimeoutMs);
      await answerCurrentQuestion(page, studentIndex, roundIndex, actionTimeoutMs);
      await saveCurrentProgress({
        page,
        studentLabel: student.label,
        metrics,
        actionTimeoutMs,
        pageErrors,
      });

      if (roundIndex < rounds - 1) {
        await sleep(withJitter(roundDelayMs, jitterMs));
      }
    }

    if (submitEnabled) {
      await submitTest({
        page,
        baseUrl,
        studentLabel: student.label,
        metrics,
        navigationTimeoutMs,
        actionTimeoutMs,
        pageErrors,
      });
    }

    result = {
      student: student.label,
      identifier: student.identifier,
      ok: true,
      status: submitEnabled ? 'submitted' : 'saved',
      totalDurationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    result = {
      student: student.label,
      identifier: student.identifier,
      ok: false,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      totalDurationMs: Math.round(performance.now() - startedAt),
    };
  } finally {
    if (signedIn) {
      const storageState = await context.storageState().catch(() => null);
      if (storageState) {
        await cleanupStudentSession({
          baseUrl,
          schoolKey,
          storageState,
          timeoutMs: Math.max(actionTimeoutMs, navigationTimeoutMs),
        }).catch((error) => {
          cleanupWarning = error instanceof Error ? error.message : String(error);
        });
      }
    }

    await context.close().catch(() => undefined);
  }

  if (result) {
    result.cleanupWarning = cleanupWarning || undefined;
  }

  return result;
}

async function main() {
  if (args.help) {
    printHelp();
    return;
  }

  const schoolKey = String(args.school || '').trim().toLowerCase();
  const paperId = String(args.paper || '').trim();
  const studentsFile = String(args.students || '').trim();
  if (!schoolKey || !paperId || !studentsFile) {
    throw new Error('Missing required --school, --paper, or --students argument.');
  }

  const baseUrl = normalizeBaseUrl(args.base);
  const concurrency = parsePositiveInteger(args.concurrency, 10);
  const rounds = parsePositiveInteger(args.rounds, 3);
  const roundDelayMs = parsePositiveInteger(args['round-delay-ms'], 400);
  const jitterMs = parseNonNegativeInteger(args['jitter-ms'], 150);
  const navigationTimeoutMs = parsePositiveInteger(args['navigation-timeout-ms'], 30000);
  const actionTimeoutMs = parsePositiveInteger(args['action-timeout-ms'], 15000);
  const submitEnabled = parseBoolean(args.submit, true);
  const warmupEnabled = parseBoolean(args.warmup, true);
  const headless = parseBoolean(args.headless, true);
  const outFile = args.out
    ? path.resolve(String(args.out))
    : path.resolve(`/tmp/student-exam-browser-stress-${Date.now()}.json`);

  await fs.mkdir(path.dirname(outFile), { recursive: true });

  const students = await loadStudents(studentsFile);
  const schoolDisplayName = buildSchoolDisplayName(schoolKey);

  console.log('Student exam browser stress run started');
  console.log(`  base: ${baseUrl}`);
  console.log(`  school: ${schoolKey}`);
  console.log(`  paper: ${paperId}`);
  console.log(`  students: ${students.length}`);
  console.log(`  concurrency: ${Math.min(concurrency, students.length)}`);
  console.log(`  rounds: ${rounds}`);
  console.log(`  submit: ${submitEnabled ? 'yes' : 'no'}`);
  console.log(`  warmup: ${warmupEnabled ? 'yes' : 'no'}`);
  console.log(`  headless: ${headless ? 'yes' : 'no'}`);

  const browser = await chromium.launch({
    headless,
  });

  try {
    if (warmupEnabled && students.length > 0) {
      await prewarmBrowserRoutes({
        browser,
        baseUrl,
        schoolKey,
        schoolDisplayName,
        paperId,
        student: students[0],
        navigationTimeoutMs,
        actionTimeoutMs,
      });
    }

    const metrics = [];
    const results = new Array(students.length);
    const startedAt = performance.now();
    let cursor = 0;

    async function workerLoop() {
      while (true) {
        const studentIndex = cursor;
        if (studentIndex >= students.length) {
          return;
        }
        cursor += 1;

        const student = students[studentIndex];
        results[studentIndex] = await runStudentFlow({
          browser,
          baseUrl,
          schoolKey,
          schoolDisplayName,
          paperId,
          student,
          studentIndex,
          rounds,
          roundDelayMs,
          jitterMs,
          submitEnabled,
          navigationTimeoutMs,
          actionTimeoutMs,
          metrics,
        });
      }
    }

    const workerCount = Math.min(concurrency, students.length);
    await Promise.all(
      Array.from({ length: workerCount }, () => workerLoop()),
    );

    const totalDurationMs = Math.round(performance.now() - startedAt);
    const succeeded = results.filter((result) => result?.ok).length;
    const failedResults = results.filter((result) => result && !result.ok);
    const cleanupWarnings = results.filter((result) => result?.cleanupWarning).length;
    const requestSummary = summarizeRequestEvents(metrics);

    const summary = {
      students: students.length,
      succeeded,
      failed: failedResults.length,
      cleanupWarnings,
      totalDurationMs,
    };

    const output = {
      generatedAt: new Date().toISOString(),
      config: {
        baseUrl,
        schoolKey,
        paperId,
        studentsFile: path.resolve(studentsFile),
        concurrency,
        rounds,
        roundDelayMs,
        jitterMs,
        navigationTimeoutMs,
        actionTimeoutMs,
        submitEnabled,
        warmupEnabled,
        headless,
      },
      summary,
      requestSummary,
      results,
    };

    console.log('\nFlow summary');
    console.table([summary]);

    console.log('\nUI step latency summary');
    console.table(requestSummary);

    if (failedResults.length > 0) {
      console.log('\nFailed students');
      console.table(
        failedResults.map((result) => ({
          student: result.student,
          identifier: result.identifier,
          error: result.error || result.status,
          totalDurationMs: result.totalDurationMs ?? null,
        })),
      );
    }

    await fs.writeFile(outFile, JSON.stringify(output, null, 2), 'utf8');
    console.log(`\nJSON summary written to ${outFile}`);

    if (failedResults.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (/Executable doesn't exist|browserType\.launch/i.test(message)) {
    console.error(`${message}\nRun "npx playwright install chromium" and try again.`);
  } else {
    console.error(message);
  }
  process.exitCode = 1;
});
