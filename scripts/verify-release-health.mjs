import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { assertNoUnexpectedRuntimeErrorsInLogFile } from "./runtime-log-scan.mjs";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const npxCommand = isWindows ? "npx.cmd" : "npx";
const baseURL = String(process.env.BASE_URL || "http://127.0.0.1:3001").trim();
const readinessUrl = new URL("/auth/company-signin", baseURL).toString();
const serverUrl = new URL(baseURL);
const releaseReportDir = path.resolve(
  process.env.RELEASE_HEALTH_REPORT_DIR || "release-health-report",
);
mkdirSync(releaseReportDir, { recursive: true });
const releaseLogPath = path.join(releaseReportDir, "release-health.log");
const releaseSummaryPath = path.join(releaseReportDir, "summary.json");
const logStream = createWriteStream(releaseLogPath, { flags: "w" });

const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);

const formatArgs = (args) =>
  args
    .map((arg) => {
      if (typeof arg === "string") {
        return arg;
      }
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");

const createLogger = (level, originalFn) => (...args) => {
  const message = formatArgs(args);
  logStream.write(`${new Date().toISOString()} [${level}] ${message}\n`);
  originalFn(...args);
};

console.log = createLogger("log", originalConsoleLog);
console.error = createLogger("error", originalConsoleError);
console.warn = createLogger("warn", originalConsoleWarn);

let logStreamClosed = false;

const closeLogStream = () => {
  if (logStreamClosed) return;
  logStreamClosed = true;
  logStream.end();
};

process.once("exit", closeLogStream);
process.once("SIGINT", closeLogStream);
process.once("SIGTERM", closeLogStream);

const releaseReport = {
  startedAt: new Date().toISOString(),
  finishedAt: null,
  status: "pending",
  errorMessage: null,
  steps: [],
};

const recordStep = ({ label }, status, durationMs, reason = null) => {
  releaseReport.steps.push({
    label,
    status,
    durationMs,
    reason,
    timestamp: new Date().toISOString(),
  });
};

const finalizeReport = (status, errorMessage = null) => {
  releaseReport.status = status;
  releaseReport.errorMessage = errorMessage;
  releaseReport.finishedAt = new Date().toISOString();
  writeFileSync(releaseSummaryPath, JSON.stringify(releaseReport, null, 2));
  console.log(`[release-health] Summary recorded at ${releaseSummaryPath}`);
  console.log(`[release-health] Logs appended to ${releaseLogPath}`);
};

const getErrorMessage = (error) =>
  error instanceof Error ? error.message : `Unknown error: ${String(error)}`;

function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  return `${(ms / 1000).toFixed(1)}s`;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function pipeChildProcessOutput(child) {
  if (child.stdout) {
    child.stdout.on("data", (chunk) => {
      logStream.write(chunk);
      process.stdout.write(chunk);
    });
  }

  if (child.stderr) {
    child.stderr.on("data", (chunk) => {
      logStream.write(chunk);
      process.stderr.write(chunk);
    });
  }
}

async function runProcess(command, args, env = process.env) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env,
  });

  pipeChildProcessOutput(child);

  return await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      resolve({ code, signal });
    });
  });
}

async function waitForServerReady(url, serverProcess, timeoutMs = 120_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (serverProcess.exitCode !== null) {
      throw new Error(
        `Built server exited before becoming ready (exit code ${serverProcess.exitCode}).`,
      );
    }

    try {
      const response = await fetch(url, {
        redirect: "manual",
      });
      if (response.status >= 200 && response.status < 400) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await wait(1000);
  }

  throw new Error(`Timed out waiting for built server readiness at ${url}.`);
}

async function runStep(step) {
  const startedAt = Date.now();
  console.log(`\n[release-health] ${step.label}`);

  const result = await runProcess(step.command, step.args, {
    ...process.env,
    ...step.env,
  });

  if (result.code !== 0) {
    const reasonParts = [];
    if (typeof result.code === "number") {
      reasonParts.push(`exit ${result.code}`);
    }
    if (result.signal) {
      reasonParts.push(`signal ${result.signal}`);
    }
    recordStep(step, "failed", Date.now() - startedAt, reasonParts.join(" ") || null);
    throw new Error(
      `${step.label} failed after ${formatDuration(Date.now() - startedAt)}.`,
    );
  }

  recordStep(step, "passed", Date.now() - startedAt);

  console.log(
    `[release-health] ${step.label} passed in ${formatDuration(Date.now() - startedAt)}.`,
  );
}

function getReleaseHealthEnv(overrides = {}) {
  return {
    ...process.env,
    BASE_URL: baseURL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "testsecret",
    NEXTAUTH_URL: baseURL,
    NEXT_PUBLIC_SITE_URL: baseURL,
    NEXT_PUBLIC_E2E_MOCK_MODE:
      process.env.NEXT_PUBLIC_E2E_MOCK_MODE || "1",
    NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || "1",
    BROWSERSLIST_IGNORE_OLD_DATA:
      process.env.BROWSERSLIST_IGNORE_OLD_DATA || "1",
    ...overrides,
  };
}

function scanReleaseHealthRuntimeLog() {
  const step = { label: "Runtime log scan" };
  const startedAt = Date.now();
  console.log(`\n[release-health] ${step.label}`);

  try {
    assertNoUnexpectedRuntimeErrorsInLogFile(
      releaseLogPath,
      "release health runtime log",
    );
    recordStep(step, "passed", Date.now() - startedAt);
    console.log(
      `[release-health] ${step.label} passed in ${formatDuration(
        Date.now() - startedAt,
      )}.`,
    );
  } catch (error) {
    const reason = getErrorMessage(error);
    recordStep(step, "failed", Date.now() - startedAt, reason);
    throw error;
  }
}

async function main() {
  const steps = [
    {
      label: "Lint",
      command: npmCommand,
      args: ["run", "lint"],
    },
    {
      label: "Typecheck",
      command: npmCommand,
      args: ["run", "typecheck"],
    },
    {
      label: "Build",
      command: npmCommand,
      args: ["run", "build"],
      env: getReleaseHealthEnv(),
    },
  ];

  try {
    for (const step of steps) {
      await runStep(step);
    }

    console.log(`\n[release-health] Starting built server at ${baseURL}.`);
    const serverProcess = spawn(
      npxCommand,
      [
        "next",
        "start",
        "--hostname",
        serverUrl.hostname || "127.0.0.1",
        "--port",
        serverUrl.port || "3001",
      ],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        env: getReleaseHealthEnv(),
      },
    );
    pipeChildProcessOutput(serverProcess);

    const shutdownServer = () => {
      if (serverProcess.exitCode === null && !serverProcess.killed) {
        serverProcess.kill("SIGTERM");
      }
    };

    const handleSignal = (signal) => {
      console.error(`\n[release-health] Interrupted by ${signal}.`);
      shutdownServer();
      process.exit(1);
    };

    process.once("SIGINT", handleSignal);
    process.once("SIGTERM", handleSignal);

    try {
      await waitForServerReady(readinessUrl, serverProcess);
      await runStep({
        label: "Smoke tests",
        command: npmCommand,
        args: ["run", "test:e2e:smoke:external"],
        env: getReleaseHealthEnv(),
      });
    } finally {
      shutdownServer();
      process.removeListener("SIGINT", handleSignal);
      process.removeListener("SIGTERM", handleSignal);
      await wait(250);
    }

    scanReleaseHealthRuntimeLog();
    console.log("\n[release-health] All release checks passed.");
    finalizeReport("passed");
  } catch (error) {
    const message = getErrorMessage(error);
    finalizeReport("failed", message);
    throw error;
  }
}

main().catch((error) => {
  const message = getErrorMessage(error);
  console.error(`\n[release-health] ${message}`);
  process.exit(1);
});
