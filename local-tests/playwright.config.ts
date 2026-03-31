import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

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

const baseURL = normalizeBaseUrl(process.env.BASE_URL);
const parsedBaseURL = new URL(baseURL);
const webServerHost = parsedBaseURL.hostname || "127.0.0.1";
const webServerPort = parsedBaseURL.port || "3001";
const useExternalServer = process.env.PLAYWRIGHT_USE_EXTERNAL_SERVER === "1";
const isCI = Boolean(process.env.CI);
const useDevServer =
  process.env.PLAYWRIGHT_USE_DEV_SERVER === "1" ||
  (!isCI && process.env.PLAYWRIGHT_USE_DEV_SERVER !== "0");
const reuseExistingServer =
  !isCI && process.env.PLAYWRIGHT_REUSE_SERVER === "1";
const configuredWorkers = Number(process.env.PLAYWRIGHT_WORKERS || "2");
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const managedServerScriptPath = fileURLToPath(
  new URL("../scripts/playwright-web-server.mjs", import.meta.url),
);
const globalTeardownPath = fileURLToPath(
  new URL("./playwright.global-teardown.mjs", import.meta.url),
);
const managedServerLogPath = fileURLToPath(
  new URL("../test-results/playwright-web-server.log", import.meta.url),
);
const readinessUrl = new URL("/auth/company-signin", baseURL).toString();
const webServerCommand = `node ${JSON.stringify(managedServerScriptPath)}`;

process.env.PLAYWRIGHT_FAIL_ON_RUNTIME_ERRORS =
  process.env.PLAYWRIGHT_FAIL_ON_RUNTIME_ERRORS || "1";
process.env.PLAYWRIGHT_MANAGED_SERVER_LOG_PATH =
  process.env.PLAYWRIGHT_MANAGED_SERVER_LOG_PATH || managedServerLogPath;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 5_000 },
  globalTeardown: globalTeardownPath,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers:
    isCI
      ? 2
      : Number.isFinite(configuredWorkers) && configuredWorkers > 0
        ? configuredWorkers
        : 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    navigationTimeout: 60_000,
  },
  webServer: useExternalServer
    ? undefined
    : [
        {
          command: webServerCommand,
          cwd: projectRoot,
          // Avoid probing the DB-backed homepage just to determine server readiness.
          url: readinessUrl,
          // Default to a fresh local server so stale Node processes on the same port
          // fail fast instead of getting silently reused.
          reuseExistingServer,
          timeout: 600_000,
          env: {
            BROWSERSLIST_IGNORE_OLD_DATA:
              process.env.BROWSERSLIST_IGNORE_OLD_DATA || "1",
            MONGODB_URI:
              process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/test",
            NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "testsecret",
            NEXTAUTH_URL: process.env.NEXTAUTH_URL || baseURL,
            NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || baseURL,
            NEXT_PUBLIC_E2E_MOCK_MODE:
              process.env.NEXT_PUBLIC_E2E_MOCK_MODE || "1",
            NEXT_TELEMETRY_DISABLED:
              process.env.NEXT_TELEMETRY_DISABLED || "1",
            PLAYWRIGHT_MANAGED_SERVER_MODE: useDevServer
              ? "development"
              : "production",
            PLAYWRIGHT_MANAGED_SERVER_HOST: webServerHost,
            PLAYWRIGHT_MANAGED_SERVER_PORT: webServerPort,
            PLAYWRIGHT_MANAGED_SERVER_LOG_PATH: managedServerLogPath,
            NODE_ENV:
              process.env.NODE_ENV || (useDevServer ? "development" : "production"),
          },
        },
      ],
  projects: [
    {
      name: "chromium-desktop",
      grepInvert: /@mobile\b/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 768 },
      },
    },
    {
      name: "chromium-mobile",
      grepInvert: /@desktop\b/,
      use: { ...devices["Pixel 5"] },
    },
  ],
});
